/*
 * ==============================================================================
 * Project: CityFleet IoT Pollution Monitoring System
 * Hardware: ESP32 + MQ-135 Gas Sensor + DHT11 Temp/Humidity + NEO-6M GPS
 * Target Cloud: Firebase Realtime Database
 * ==============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <HardwareSerial.h>
#include <TinyGPSPlus.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ==========================================
// 1. Wi-Fi & Firebase Configuration
// ==========================================
const char* WIFI_SSID     = "Shivu";
const char* WIFI_PASSWORD = "12345678";

// Firebase Realtime Database URL and Secret / Auth Key
// Database URL format: "https://<PROJECT_ID>-default-rtdb.firebaseio.com"
const char* FIREBASE_HOST = "https://pollutionmonitoring-4156-69176-default-rtdb.firebaseio.com";
const char* FIREBASE_AUTH = "Yp3TIa3LJsekyl7uSorerohHrijf97UVjQMHkwR5k"; // Or leave empty if public rules are enabled for testing

// Vehicle Identifier (Matches the dashboard schema)
const char* VEHICLE_ID    = "KA01-5522";

// ==========================================
// 2. Hardware Pin Definitions
// ==========================================
// MQ-135 Gas Sensor (Must use ADC1 pin: GPIO 32-39 to avoid Wi-Fi conflicts)
#define MQ135_ANALOG_PIN  34

// DHT11 Sensor
#define DHTPIN            4
#define DHTTYPE           DHT11

// NEO-6M GPS Module (HardwareSerial 2)
#define GPS_RX_PIN        26  // Connect to NEO-6M TX
#define GPS_TX_PIN        27  // Connect to NEO-6M RX
#define GPS_BAUD          9600

// ==========================================
// 3. Sensor Objects & Global Variables
// ==========================================
DHT dht(DHTPIN, DHTTYPE);
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

// Thresholds matching public/config.js
const int THRESHOLD_NORMAL   = 1000;
const int THRESHOLD_MODERATE = 2000;

// Emission tracking variables
float cumulative_emission = 0.0;
unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL_MS = 3000; // Send telemetry every 3 seconds

// ==========================================
// 4. Helper Functions
// ==========================================

// Estimate CO2 / Air Quality PPM from MQ-135 analog voltage
float readMQ135PPM() {
  int rawValue = analogRead(MQ135_ANALOG_PIN);
  float voltage = (rawValue / 4095.0) * 3.3;
  
  // Approximate MQ-135 PPM mapping (Calibrate with baseline R0 in clean air)
  // Standard curve approximation for MQ-135
  float ppm = map(rawValue, 0, 4095, 350, 3000);
  if (ppm < 350) ppm = 350;
  return ppm;
}

// Determine status string based on PPM
String getStatus(float ppm) {
  if (ppm <= THRESHOLD_NORMAL) return "Normal";
  if (ppm <= THRESHOLD_MODERATE) return "Moderate";
  return "High";
}

// Send HTTP PUT/PATCH request to Firebase RTDB REST API
void sendToFirebase(String path, String jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Disconnected! Reconnecting...");
    WiFi.reconnect();
    return;
  }

  HTTPClient http;
  String url = String(FIREBASE_HOST) + path + ".json";
  if (strlen(FIREBASE_AUTH) > 0) {
    url += "?auth=" + String(FIREBASE_AUTH);
  }

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.PATCH(jsonPayload); // Use PATCH to update fields without overwriting everything

  if (httpCode > 0) {
    Serial.printf("[Firebase] Telemetry synced (%d): %s\n", httpCode, jsonPayload.c_str());
  } else {
    Serial.printf("[Firebase] HTTP error: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
}

// Send an alert record when threshold exceeded
void sendAlert(String vehicleId, float ppm, float lat, float lng, String status, String note) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(FIREBASE_HOST) + "/alerts.json";
  if (strlen(FIREBASE_AUTH) > 0) {
    url += "?auth=" + String(FIREBASE_AUTH);
  }

  StaticJsonDocument<256> alertDoc;
  alertDoc["vehicle"] = vehicleId;
  alertDoc["co2"] = (int)ppm;
  alertDoc["time"] = millis(); // or epoch timestamp if NTP is configured
  alertDoc["location"] = String(lat, 4) + ", " + String(lng, 4);
  alertDoc["status"] = status;
  alertDoc["note"] = note;

  String alertPayload;
  serializeJson(alertDoc, alertPayload);

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  int httpCode = http.POST(alertPayload);
  http.end();
}

// ==========================================
// 5. Setup
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- Starting CityFleet Pollution Monitor ---");

  // Initialize Sensors
  pinMode(MQ135_ANALOG_PIN, INPUT);
  dht.begin();
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  // Connect to Wi-Fi
  Serial.printf("Connecting to Wi-Fi: %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
}

// ==========================================
// 6. Main Loop
// ==========================================
void loop() {
  // Continuously feed incoming GPS characters to TinyGPS++
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // Periodic Telemetry Publishing
  if (millis() - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = millis();

    // 1. Read Gas & Environmental Sensors
    float co2_ppm = readMQ135PPM();
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();

    // 2. Read GPS Coordinates (default fallback to Bangalore if searching for satellites)
    float latitude = 12.9716;
    float longitude = 77.5946;
    if (gps.location.isValid()) {
      latitude = gps.location.lat();
      longitude = gps.location.lng();
    } else {
      Serial.println("[GPS] Searching for satellite fix... using default location coordinates.");
    }

    // 3. Compute stats
    String status = getStatus(co2_ppm);
    float emission_per_km = (co2_ppm / 200.0); // Derived emission metric
    cumulative_emission += (emission_per_km * 0.05); // Accumulating emission over time

    // 4. Construct JSON Payload matching dashboard schema
    StaticJsonDocument<384> doc;
    doc["co2_ppm"] = (int)co2_ppm;
    doc["emission_per_km"] = serialized(String(emission_per_km, 2));
    doc["total_emission"] = serialized(String(cumulative_emission, 1));
    doc["latitude"] = serialized(String(latitude, 6));
    doc["longitude"] = serialized(String(longitude, 6));
    doc["temperature"] = isnan(temperature) ? 25.0 : temperature;
    doc["humidity"] = isnan(humidity) ? 60.0 : humidity;
    doc["timestamp"] = millis();
    doc["status"] = status;

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    // 5. Push to Firebase RTDB under /vehicles/<VEHICLE_ID>
    String vehiclePath = "/vehicles/" + String(VEHICLE_ID);
    sendToFirebase(vehiclePath, jsonPayload);

    // 6. Trigger alert if High / Moderate
    if (co2_ppm > THRESHOLD_MODERATE) {
      sendAlert(VEHICLE_ID, co2_ppm, latitude, longitude, "High", "Emission Limit Exceeded — Critical Level!");
    } else if (co2_ppm > THRESHOLD_NORMAL) {
      sendAlert(VEHICLE_ID, co2_ppm, latitude, longitude, "Moderate", "Threshold nearing upper limit.");
    }
  }
}
