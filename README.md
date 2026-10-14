# 🌍 CityFleet IoT Pollution & Environmental Monitoring System

An end-to-end IoT, cloud, and geospatial environmental tracking platform designed to monitor vehicular emissions and ambient air quality in real time. The platform integrates an ESP32 edge node with gas, climate, and GPS sensors, syncing telemetry with Google Firebase Realtime Database and displaying live data on both an interactive Web GIS dashboard and an ANSI terminal monitor.

---

## 🏗️ System Architecture

```
                      +-----------------------------+
                      |   ESP32 Physical Node       |
                      |   Vehicle: KA01-5522        |
                      |  - MQ-135 (ADC Pin 34)      |
                      |  - DHT11 (GPIO Pin 4)       |
                      |  - NEO-6M GPS (UART2 26/27) |
                      +--------------+--------------+
                                     |
               HTTP PATCH / POST     | Wi-Fi (every 3 seconds)
               REST API calls        v
       +-----------------------------------------------------------+
       |           Google Firebase Realtime Database               |
       |  https://pollutionmonitoring-4156-69176-default-rtdb...    |
       |                                                           |
       |  Paths:                                                   |
       |    /vehicles/{vehicle_id}                                 |
       |    /alerts/{alert_id}                                     |
       +--------------+-----------------------------+--------------+
                      |                             |
     HTTP GET (2.0s)  |                             | HTTP GET (2.0s)
     REST polling     v                             v REST polling
+---------------------------+        +-----------------------------------+
| Python CLI Dashboard      |        | Web Browser Dashboard             |
| `monitor.py`              |        | `public/index.html`               |
| - Terminal ANSI Output    |        | - Leaflet Map & Heatmap Layer     |
| - Tabular Fleet Status    |        | - Chart.js Telemetry Graph        |
| - Node Detail View        |        | - Radial CSS Conic Gauge          |
| - Alert Stream Log        |        | - Web Audio Incident Chimes       |
| - Optional USB Serial     |        | - CSV & JSON Client-Side Export   |
+---------------------------+        +-----------------------------------+
```

---

## 🛠️ Hardware Wiring & Pin Assignments

| Sensor / Module | Signal / Pin | ESP32 Pin | Notes |
| :--- | :--- | :--- | :--- |
| **MQ-135 Gas Sensor** | VCC | 5V (VIN) | Heater circuit requires 5V |
| | GND | GND | Common ground |
| | AOUT (Analog Out) | **GPIO 34** | Must use ADC1 channel to avoid Wi-Fi conflicts |
| **DHT11 Sensor** | VCC | 3.3V | |
| | GND | GND | |
| | DATA | **GPIO 4** | 10k pull-up resistor to 3.3V recommended |
| **NEO-6M GPS Module** | VCC | 3.3V / 5V | |
| | GND | GND | |
| | TX | **GPIO 26** (RX2) | HardwareSerial(2) |
| | RX | **GPIO 27** (TX2) | HardwareSerial(2) |

---

## 📍 Indoor GPS & Demonstration Fallback Mode

When demonstrating the system indoors where satellite signals cannot be acquired, the firmware and dashboard automatically switch to demonstration fallback mode with clear labeling:

- **Reference Location:** **Alva's Institute of Engineering and Technology (AIET)**  
  Shobhavana Campus, Mijar, Moodbidri, Mangalore, Karnataka 574225, India.  
  - **Latitude:** `13.0236`  
  - **Longitude:** `74.9676`  
- **GPS Status Labels:**
  - `📡 LIVE GPS`: Genuine satellite lock acquired ($N \ge 3$ satellites).
  - `🏢 DEMO LOCATION (AIET)`: Demonstration fallback active; satellite fix unavailable.
- **Configurable Fallback:** Can be toggled via `#define ENABLE_DEMO_GPS_FALLBACK true` in `Arduino_Code/config.h`.

---

## 💻 Software & Dashboard Quickstart

### 1. Web Dashboard (Local Host)

The web dashboard is built using pure vanilla HTML5, CSS3, and ES6+ JavaScript. It requires no Node.js build step or bundlers.

Run Python's built-in HTTP server:
```bash
python3 -m http.server 5000 --directory public
```
Open **`http://localhost:5000`** in your browser (compatible with all modern browsers including Brave and Chrome).

### 2. Terminal Monitor (`monitor.py`)

Run the terminal telemetry monitor in cloud polling mode:
```bash
python3 monitor.py
```

Run in demonstration simulation mode (offline presentation):
```bash
python3 monitor.py --demo
```

Monitor directly over USB serial cable (`/dev/ttyUSB0`):
```bash
python3 monitor.py --serial /dev/ttyUSB0
```

---

## ⚡ Flashing the ESP32 Firmware

1. Install [Arduino IDE](https://www.arduino.cc/en/software) (version 2.0+).
2. Add ESP32 board support via Boards Manager (`esp32` by Espressif Systems).
3. Install required libraries from Arduino Library Manager:
   - `ArduinoJson` by Benoit Blanchon (Version 6.x or 7.x)
   - `DHT sensor library` by Adafruit
   - `TinyGPSPlus` by Mikal Hart
4. Copy `Arduino_Code/secrets.h.example` to `Arduino_Code/secrets.h`:
   ```bash
   cp Arduino_Code/secrets.h.example Arduino_Code/secrets.h
   ```
5. Open `Arduino_Code/secrets.h` and configure your Wi-Fi SSID and password:
   ```cpp
   #define WIFI_SSID     "Your_WiFi_Name"
   #define WIFI_PASSWORD "Your_WiFi_Password"
   ```
6. Open `Arduino_Code/pollution_monitor.ino` in Arduino IDE.
7. Select Board: **ESP32 Dev Module** and choose your serial COM port.
8. Click **Upload**. Open Serial Monitor at **115200 baud** to view real-time diagnostics.

---

## 🔐 Firebase Configuration & Recommended Security Rules

The application uses Google Firebase Realtime Database. Configure your rules in the Firebase Console under **Realtime Database > Rules**:

```json
{
  "rules": {
    "vehicles": {
      ".read": true,
      ".write": true
    },
    "alerts": {
      ".read": true,
      ".write": true
    }
  }
}
```

> **Security Note:** In production, authenticate ESP32 requests using Firebase Authentication REST tokens or restricted Database Secrets rather than global write access.

---

## 📂 Project Structure

```text
Pollution_Monitoring/
├── Arduino_Code/
│   ├── config.h                 # Central hardware pins, thresholds & demo coordinates
│   ├── secrets.h.example        # Private Wi-Fi & database credentials template
│   └── pollution_monitor.ino    # Complete ESP32 firmware sketch
├── public/
│   ├── index.html               # Main single-page web application
│   ├── app.js                   # Modular JavaScript controller
│   ├── config.js                # Centralized frontend configuration & fixtures
│   ├── styles.css               # Premium glassmorphism design system
│   └── 404.html                 # Fallback error page
├── monitor.py                   # Python terminal telemetry dashboard
├── demo.json                    # Baseline sample database fixture
├── firebase.json                # Firebase Hosting configuration
├── .firebaserc                  # Firebase project identifier
├── PROJECT_STATUS_REPORT.md     # Initial engineering audit report
├── PROJECT_COMPLETION_REPORT.md # Final completion and verification report
└── README.md                    # Project documentation
```

---

## 👨‍💻 Author

**Shivanand Hanchinal**  
GitHub: [https://github.com/ShivuAH](https://github.com/ShivuAH)
