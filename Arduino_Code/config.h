#ifndef CITYFLEET_CONFIG_H
#define CITYFLEET_CONFIG_H

/* ==============================================================================
 * CityFleet IoT Pollution Monitoring System — Hardware & Firmware Configuration
 * ==============================================================================
 * Central configuration file for ESP32, MQ-135, DHT11, NEO-6M GPS & Firebase.
 * ============================================================================== */

// Optional: include private secrets if present
#if __has_include("secrets.h")
  #include "secrets.h"
#else
  // Fallback defaults for Wi-Fi and Firebase (replace with your credentials in secrets.h)
  #ifndef WIFI_SSID
    #define WIFI_SSID        "YOUR_WIFI_SSID"
  #endif
  #ifndef WIFI_PASSWORD
    #define WIFI_PASSWORD    "YOUR_WIFI_PASSWORD"
  #endif
  #ifndef FIREBASE_HOST
    #define FIREBASE_HOST    "https://pollutionmonitoring-4156-69176-default-rtdb.firebaseio.com"
  #endif
  #ifndef FIREBASE_AUTH
    #define FIREBASE_AUTH    "" // Database secret or auth token (leave empty if rules handle access)
  #endif
#endif

// ==========================================
// 1. Vehicle / Node Identification
// ==========================================
#ifndef VEHICLE_ID
  #define VEHICLE_ID         "KA01-5522"
#endif

// ==========================================
// 2. Hardware Pin Assignments (ESP32-WROOM-32)
// ==========================================
// MQ-135 Gas Sensor (Must use an ADC1 pin: GPIO 32-39 to avoid Wi-Fi ADC conflicts)
#define MQ135_ANALOG_PIN     34

// DHT11 Temperature & Relative Humidity Sensor
#define DHTPIN               4
#define DHTTYPE              DHT11

// NEO-6M GPS Module (HardwareSerial 2)
#define GPS_RX_PIN           26  // ESP32 RX2 <- NEO-6M TX
#define GPS_TX_PIN           27  // ESP32 TX2 -> NEO-6M RX
#define GPS_BAUD             9600

// ==========================================
// 3. Indoor GPS & Demonstration Fallback
// ==========================================
// When indoor testing prevents satellite reception, enable fallback mode.
// Set to 'false' for strict outdoor-only genuine GPS enforcement.
#define ENABLE_DEMO_GPS_FALLBACK true

// Coordinates for Alva's Institute of Engineering and Technology (AIET)
// Shobhavana Campus, Mijar, Moodbidri, Mangalore, Karnataka 574225, India
#define DEMO_LOCATION_NAME   "AIET Mijar, Moodbidri (Indoor Demo)"
#define DEMO_LATITUDE        13.023600
#define DEMO_LONGITUDE       74.967600

// ==========================================
// 4. Sensor Calibration & Processing Parameters
// ==========================================
// MQ-135 Model: Rs = ((3.3V - Vout) / Vout) * RL
// CO2 curve power model: PPM = A * (Rs / R0) ^ B
#define MQ135_RL_OHMS        10000.0   // 10k load resistor on typical breakout boards
#define MQ135_R0_CLEAN_AIR   10000.0   // Baseline resistance in clean air (calibrate per sensor)
#define MQ135_CURVE_A        116.6020682
#define MQ135_CURVE_B        -2.769034857

// Thresholds for CO2 air quality (PPM) matching web dashboard
#define THRESHOLD_NORMAL     1000  // Good / Healthy air
#define THRESHOLD_MODERATE   2000  // Moderate / Caution level
#define THRESHOLD_CRITICAL   2500  // High / Hazardous level

// ==========================================
// 5. Timing, NTP & Alert Rate-Limiting
// ==========================================
#define SEND_INTERVAL_MS     3000      // Transmit telemetry every 3000ms (3 seconds)
#define ALERT_COOLDOWN_MS    60000     // 60-second cooldown between alerts for continuous breach
#define HTTP_TIMEOUT_MS      4000      // 4-second HTTP timeout for Firebase REST calls

// SNTP Time Configuration (IST = UTC + 5:30 -> 5.5 * 3600 = 19800 seconds)
#define NTP_SERVER_1         "pool.ntp.org"
#define NTP_SERVER_2         "time.google.com"
#define GMT_OFFSET_SEC       19800
#define DAYLIGHT_OFFSET_SEC  0

#endif // CITYFLEET_CONFIG_H
