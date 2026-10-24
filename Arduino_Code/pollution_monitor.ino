/*
 * ==============================================================================
 * Project: CityFleet IoT Pollution & Environmental Monitoring System
 * Target Hardware: ESP32-WROOM-32
 * Sensors: MQ-135 (Gas), DHT11 (Temp/Hum), NEO-6M (GPS)
 * Cloud Backend: Google Firebase Realtime Database
 * ==============================================================================
 * Standalone Consolidated Firmware:
 * All Wi-Fi, Firebase, pin assignments, thresholds, and calibration settings
 * are defined directly in this file. No external header files (config.h/secrets.h)
 * are required.
 * ==============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <HardwareSerial.h>
#include <TinyGPSPlus.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <time.h>

// ==============================================================================
// 1. Wi-Fi Access Point Credentials
// ==============================================================================
#define WIFI_SSID              "Rohan"
#define WIFI_PASSWORD          "098765432"

// ==============================================================================
// 2. Google Firebase Realtime Database Configuration
// ==============================================================================
#define FIREBASE_HOST          "https://pollutionmonitoring-4156-69176-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH          "p3TIa3LJsekyl7uSorerohHrijf97UVjQMHkwR5k"
#define VEHICLE_ID             "KA01-5522"

// ==============================================================================
// 3. Hardware Pin Assignments (ESP32-WROOM-32)
// ==============================================================================
// MQ-135 Gas Sensor (Must use an ADC1 pin: GPIO 32-39 to avoid Wi-Fi conflicts)
#define MQ135_ANALOG_PIN       34

// DHT11 Temperature & Relative Humidity Sensor
#define DHTPIN                 4
#define DHTTYPE                DHT11

// NEO-6M GPS Module (HardwareSerial 2)
#define GPS_RX_PIN             26  // ESP32 RX2 (GPIO 26) <- NEO-6M TX
#define GPS_TX_PIN             27  // ESP32 TX2 (GPIO 27) -> NEO-6M RX
#define GPS_BAUD               9600

// ==============================================================================
// 4. Indoor GPS & Demonstration Fallback
// ==============================================================================
// When testing indoors where satellite signal is unavailable, fallback is used.
#define ENABLE_DEMO_GPS_FALLBACK true
#define DEMO_LOCATION_NAME     "Mijar, Moodbidri"
#define DEMO_LATITUDE          13.023600
#define DEMO_LONGITUDE         74.967600

// ==============================================================================
// 5. MQ-135 Calibration Parameters & AQI Thresholds
// ==============================================================================
#define MQ135_RL_OHMS          10000.0       // 10k load resistor on typical breakout boards
#define MQ135_R0_CLEAN_AIR     10000.0       // Baseline reference placeholder
#define MQ135_CURVE_A          116.6020682   // Power-law curve coefficient A
#define MQ135_CURVE_B          -2.769034857  // Power-law curve coefficient B

#define THRESHOLD_NORMAL       1000          // Good / Healthy air (PPM)
#define THRESHOLD_MODERATE     2000          // Moderate / Caution level (PPM)
#define THRESHOLD_CRITICAL     2500          // High / Hazardous level (PPM)

// ==============================================================================
// 6. Timing, Alert Rate-Limiting & SNTP Clock Settings
// ==============================================================================
#define SEND_INTERVAL_MS       10000         // Telemetry transmission interval (10 seconds)
#define ALERT_COOLDOWN_MS      60000         // 60-second cooldown between alerts for continuous breach
#define HTTP_TIMEOUT_MS        4000          // 4-second HTTP timeout for Firebase REST calls

#define NTP_SERVER_1           "pool.ntp.org"
#define NTP_SERVER_2           "time.google.com"
#define GMT_OFFSET_SEC         19800         // IST: UTC + 5:30 (5.5 * 3600 = 19800 seconds)
#define DAYLIGHT_OFFSET_SEC    0

// ==============================================================================
// Hardware Objects
// ==============================================================================
DHT dht(DHTPIN, DHTTYPE);
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

// Telemetry State
float cumulative_emission = 0.0;
unsigned long lastSendTime = 0;

// Alert Debounce & Cooldown State
String lastAlertStatus = "Normal";
unsigned long lastAlertTime = 0;

// Time Sync State
bool ntpConfigured = false;

// ==============================================================================
// Helper: Obtain Epoch Timestamp (Milliseconds) via NTP
// ==============================================================================
uint64_t getEpochTimestampMs(bool &isSynced) {
  time_t now;
  if (time(&now) > 1700000000) { // Valid time after Nov 2023
    isSynced = true;
    return ((uint64_t)now * 1000ULL) + (millis() % 1000);
  }
  isSynced = false;
  return millis();
}

// ==============================================================================
// Helper: MQ-135 Gas Sensor Reading & Power-Law Approximation
// ==============================================================================
float readMQ135PPM(int &rawADC, float &sensorVoltage, float &Rs, float &ratio, float &ppm_raw) {
  rawADC = analogRead(MQ135_ANALOG_PIN);
  sensorVoltage = (rawADC / 4095.0f) * 3.3f;

  // Protect against divide-by-zero or short-circuits
  if (sensorVoltage <= 0.05f) sensorVoltage = 0.05f;
  if (sensorVoltage >= 3.25f) sensorVoltage = 3.25f;

  // Calculate sensor resistance: Rs = ((Vc - Vout) / Vout) * RL
  Rs = ((3.3f - sensorVoltage) / sensorVoltage) * MQ135_RL_OHMS;

  // Clean-air baseline reference for uncalibrated sensor operation:
  // In the power curve (PPM = A * (Rs/R0)^B), clean air (~400 PPM background CO2)
  // corresponds to a ratio of (400 / A)^(1/B) ≈ 0.641.
  // Establishing an uncalibrated fresh-air baseline reference (R0 = Rs_baseline / 0.641)
  // allows PPM estimates to dynamically track real sensor resistance fluctuations.
  static float mq135_baseline_rs = 0.0f;
  if (mq135_baseline_rs <= 0.0f) {
    mq135_baseline_rs = Rs;
  } else if (Rs > mq135_baseline_rs) {
    mq135_baseline_rs = (mq135_baseline_rs * 0.95f) + (Rs * 0.05f);
  }

  float r0;
  if (MQ135_R0_CLEAN_AIR > 0.0f && MQ135_R0_CLEAN_AIR != 10000.0f) {
    r0 = MQ135_R0_CLEAN_AIR;
  } else {
    float cleanAirRatio = pow(400.0f / MQ135_CURVE_A, 1.0f / MQ135_CURVE_B);
    r0 = mq135_baseline_rs / cleanAirRatio;
  }

  // Power-law curve approximation for CO2 equivalent: PPM = A * (Rs / R0) ^ B
  ratio = Rs / r0;
  ppm_raw = MQ135_CURVE_A * pow(ratio, MQ135_CURVE_B);

  float ppm = ppm_raw;

  // Bound within reasonable atmospheric and sensor measurement bounds
  if (ppm < 350.0f) ppm = 350.0f;
  if (ppm > 5000.0f) ppm = 5000.0f;

  return ppm;
}

// ==============================================================================
// Helper: Determine Status Tier
// ==============================================================================
String getStatusTier(float ppm) {
  if (ppm <= THRESHOLD_NORMAL) return "Normal";
  if (ppm <= THRESHOLD_MODERATE) return "Moderate";
  return "High";
}

// ==============================================================================
// Helper: Send HTTP PATCH Telemetry to Firebase RTDB
// ==============================================================================
bool sendTelemetryToFirebase(String jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Lost connection. Attempting auto-reconnect...");
    WiFi.reconnect();
    return false;
  }

  HTTPClient http;
  String url = String(FIREBASE_HOST) + "/vehicles/" + String(VEHICLE_ID) + ".json";
  if (strlen(FIREBASE_AUTH) > 0) {
    url += "?auth=" + String(FIREBASE_AUTH);
  }

  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.PATCH(jsonPayload);
  bool success = false;

  if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_NO_CONTENT) {
    Serial.printf("[Firebase] Telemetry synced successfully (HTTP %d)\n", httpCode);
    success = true;
  } else if (httpCode == 401) {
    Serial.printf("[Firebase AUTH FAILURE] HTTP 401 Unauthorized! Token rejected or rules locked: %s\n", http.getString().c_str());
  } else if (httpCode == 404) {
    Serial.printf("[Firebase PATH ERROR] HTTP 404 Not Found! Check database URL: %s\n", http.getString().c_str());
  } else if (httpCode > 0) {
    Serial.printf("[Firebase ERROR] Server returned HTTP %d: %s\n", httpCode, http.getString().c_str());
  } else {
    Serial.printf("[Firebase NETWORK ERROR] Connection failed: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
  return success;
}

// ==============================================================================
// Helper: Send Alert to Firebase RTDB (With Debounce & Cooldown)
// ==============================================================================
void checkAndSendAlert(String vehicleId, float ppm, float lat, float lng, String status, String note, uint64_t timestamp) {
  // Only trigger for non-normal conditions
  if (status == "Normal") {
    lastAlertStatus = "Normal";
    return;
  }

  bool statusChanged = (status != lastAlertStatus);
  bool cooldownElapsed = (millis() - lastAlertTime >= ALERT_COOLDOWN_MS);

  if (!statusChanged && !cooldownElapsed) {
    // Suppress redundant alert flooding
    return;
  }

  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(FIREBASE_HOST) + "/alerts.json";
  if (strlen(FIREBASE_AUTH) > 0) {
    url += "?auth=" + String(FIREBASE_AUTH);
  }

  StaticJsonDocument<384> alertDoc;
  alertDoc["vehicle"] = vehicleId;
  alertDoc["co2"] = (int)ppm;
  alertDoc["time"] = timestamp;
  alertDoc["location"] = String(lat, 4) + ", " + String(lng, 4);
  alertDoc["status"] = status;
  alertDoc["note"] = note;

  String alertPayload;
  serializeJson(alertDoc, alertPayload);

  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  int httpCode = http.POST(alertPayload);

  if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_NO_CONTENT) {
    Serial.printf("[Alert] Incident logged successfully (HTTP %d): %s | %d PPM\n", httpCode, status.c_str(), (int)ppm);
    lastAlertStatus = status;
    lastAlertTime = millis();
  } else if (httpCode == 401) {
    Serial.printf("[Alert AUTH FAILURE] HTTP 401 Unauthorized! Alert rejected by Firebase: %s\n", http.getString().c_str());
  } else {
    Serial.printf("[Alert ERROR] Failed to log incident (HTTP %d): %s\n", httpCode, http.getString().c_str());
  }

  http.end();
}

// ==============================================================================
// Setup Routine
// ==============================================================================
void setup() {
  Serial.begin(115200);
  delay(1200);

  Serial.println("\n=======================================================");
  Serial.println("  CityFleet IoT Pollution Monitoring Station (ESP32)");
  Serial.println("=======================================================");
  Serial.printf("Node ID: %s\n", VEHICLE_ID);
  Serial.printf("Demo Fallback: %s (%s)\n", 
                ENABLE_DEMO_GPS_FALLBACK ? "ENABLED" : "DISABLED", 
                DEMO_LOCATION_NAME);

  // Initialize Sensors
  pinMode(MQ135_ANALOG_PIN, INPUT);
  dht.begin();
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("[Sensors] MQ-135, DHT11, and NEO-6M initialized.");

  // Connect to Wi-Fi
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 15000) {
    delay(400);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
    // Configure NTP Time Sync
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER_1, NTP_SERVER_2);
    ntpConfigured = true;
    Serial.println("[NTP] SNTP time synchronization requested.");
  } else {
    Serial.println("\n[WiFi] Connection timed out. Running in offline/reconnect mode.");
  }
}

// ==============================================================================
// Main Loop Routine
// ==============================================================================
void loop() {
  // 1. Continuously process incoming NMEA characters from GPS module
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // 2. Periodic Telemetry Transmission Loop
  if (millis() - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = millis();

    // Re-trigger NTP config if connection was established late
    if (!ntpConfigured && WiFi.status() == WL_CONNECTED) {
      configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER_1, NTP_SERVER_2);
      ntpConfigured = true;
    }

    // A. Read MQ-135 Air Quality Sensor
    int rawADC = 0;
    float sensorVoltage = 0.0;
    float Rs = 0.0;
    float ratio = 0.0;
    float ppm_raw = 0.0;
    float co2_ppm = readMQ135PPM(rawADC, sensorVoltage, Rs, ratio, ppm_raw);
    String status = getStatusTier(co2_ppm);

    // B. Read DHT11 Temperature & Humidity
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();
    bool dht_valid = !isnan(temperature) && !isnan(humidity) &&
                     (temperature >= -10.0 && temperature <= 65.0) &&
                     (humidity >= 0.0 && humidity <= 100.0);

    // C. Read GPS Coordinates with Explicit Demonstration Fallback
    float latitude = 0.0;
    float longitude = 0.0;
    bool gps_valid = false;
    String location_source = "unavailable";
    String location_label = "Location Unavailable";

    if (gps.location.isValid() && (gps.location.age() < 5000)) {
      latitude = gps.location.lat();
      longitude = gps.location.lng();
      gps_valid = true;
      location_source = "gps";
      location_label = "Live GPS Fix (" + String(gps.satellites.value()) + " sats)";
    } else if (ENABLE_DEMO_GPS_FALLBACK) {
      latitude = DEMO_LATITUDE;
      longitude = DEMO_LONGITUDE;
      gps_valid = false;
      location_source = "demo_fallback";
      location_label = DEMO_LOCATION_NAME;
    }

    // D. Compute Derived Emission Metrics
    float emission_per_km = co2_ppm / 200.0;
    cumulative_emission += (emission_per_km * (SEND_INTERVAL_MS / 60000.0));

    // E. Resolve Network Timestamp
    bool time_synced = false;
    uint64_t timestamp = getEpochTimestampMs(time_synced);

    // F. Build JSON Payload
    StaticJsonDocument<512> doc;
    doc["vehicle_id"] = VEHICLE_ID;
    doc["co2_ppm"] = (int)co2_ppm;
    doc["raw_adc"] = rawADC;
    doc["gas_calibrated"] = false; // Flagged as uncalibrated model estimate

    if (dht_valid) {
      doc["temperature"] = serialized(String(temperature, 1));
      doc["humidity"] = serialized(String(humidity, 1));
      doc["dht_valid"] = true;
    } else {
      doc["temperature"] = nullptr;
      doc["humidity"] = nullptr;
      doc["dht_valid"] = false;
    }

    doc["latitude"] = serialized(String(latitude, 6));
    doc["longitude"] = serialized(String(longitude, 6));
    doc["gps_valid"] = gps_valid;
    doc["location_source"] = location_source;
    doc["location_label"] = location_label;

    doc["emission_per_km"] = serialized(String(emission_per_km, 2));
    doc["total_emission"] = serialized(String(cumulative_emission, 1));
    doc["status"] = status;
    doc["timestamp"] = timestamp;
    doc["time_synced"] = time_synced;
    doc["last_seen"] = timestamp;

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    // G. Output Diagnostics to Serial Monitor
    Serial.println("\n-------------------------------------------------------");
    Serial.printf("[Telemetry] Node: %s | CO2: %d PPM (ADC: %d) | Status: %s\n",
                  VEHICLE_ID, (int)co2_ppm, rawADC, status.c_str());
    Serial.printf("[MQ-135 Diagnostic] Raw ADC: %d | Vout: %.3f V | Rs: %.1f Ohm | Rs/R0: %.3f | Raw PPM: %.2f | Final PPM: %d\n",
                  rawADC, sensorVoltage, Rs, ratio, ppm_raw, (int)co2_ppm);
    if (dht_valid) {
      Serial.printf("[DHT11 Diagnostic] Pin: GPIO %d | Sensor: DHT11 | Temp: %.1f °C | Humidity: %.1f %% | Valid: YES\n",
                    DHTPIN, temperature, humidity);
    } else {
      Serial.printf("[DHT11 Diagnostic] Pin: GPIO %d | Sensor: DHT11 | Temp: %s | Humidity: %s | Valid: NO (NaN or out of bounds)\n",
                    DHTPIN,
                    isnan(temperature) ? "NaN" : String(temperature, 1).c_str(),
                    isnan(humidity) ? "NaN" : String(humidity, 1).c_str());
    }
    Serial.printf("[Location] Source: %s | Lat: %.4f, Lng: %.4f (%s)\n",
                  location_source.c_str(), latitude, longitude, location_label.c_str());
    Serial.printf("[Time] Epoch: %llu ms | Synced: %s\n",
                  (unsigned long long)timestamp, time_synced ? "YES" : "NO (uptime)");

    // H. Push Telemetry to Firebase RTDB
    sendTelemetryToFirebase(jsonPayload);

    // I. Check and Debounce Alerts
    if (status != "Normal") {
      String note = (status == "High") 
                    ? "Critical emission spike detected" 
                    : "Moderate emission threshold warning";
      checkAndSendAlert(VEHICLE_ID, co2_ppm, latitude, longitude, status, note, timestamp);
    }
  }
}
