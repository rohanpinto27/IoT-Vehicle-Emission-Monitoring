# Project Status & Handover Report: CityFleet IoT Pollution Monitoring System

**Document Version:** 1.0.0  
**Inspection Date:** 2026-10-14  
**Author:** Antigravity Senior Engineering Audit  
**Target Repository:** `/home/shivuah/Pollution_Monitoring`  
**Git Branch:** `main` (Remote: `origin/main` at commit `7e2756c`)

---

## 1. Project Overview

### 1.1 Purpose & Domain
The **CityFleet IoT Pollution Monitoring System** is an end-to-end Internet of Things (IoT) and geospatial environmental tracking platform. It monitors vehicular pollution and ambient environmental conditions in real time. The system collects data from physical ESP32 edge nodes equipped with gas, environmental, and GPS sensors, streams telemetry to a cloud database (Firebase Realtime Database), and visualizes the telemetry across both a rich Web GIS Dashboard and a terminal-based CLI monitor.

### 1.2 Core Capabilities & Features
- **Real-Time Air Purity & CO₂ Telemetry:** Measures air quality / CO₂ equivalent in PPM using an MQ-135 electrochemical gas sensor.
- **Ambient Climate Monitoring:** Measures ambient temperature (°C) and relative humidity (%) using a DHT11 sensor.
- **Geospatial Fleet Tracking & Anomaly Heatmap:** Captures GPS coordinates (latitude, longitude) via NEO-6M GPS, displays real-time markers with popup telemetry, and renders an interpolation pollution heatmap on a Leaflet map.
- **Vehicle Telemetry Analytics:** Computes derived metrics including emission rate ($g/\text{km}$), cumulative emission ($g$), and categorized Air Quality Index (AQI) status (`Normal` / `Moderate` / `High`).
- **Telemetry Visualizations:** Dynamic Line charts (CO₂, Temperature, Humidity switching via Chart.js), radial SVG/CSS conic gradient gauge for real-time PPM levels, and responsive KPI statistic cards.
- **Acoustic & Visual Alarm Feeds:** Audio chime alerts synthesized via the Web Audio API on critical emission breaches, with an incident log table.
- **Data Export:** Client-side CSV export of fleet sensor snapshots.
- **Multi-Client Monitoring:** Parallel monitoring through both a standalone Web UI and a lightweight ANSI terminal monitor (`monitor.py`).

### 1.3 Technology Stack

| Layer | Technologies / Tools | Description / Role |
| :--- | :--- | :--- |
| **Embedded Hardware** | ESP32-WROOM-32, MQ-135, DHT11, NEO-6M GPS | Edge sensing, Wi-Fi telemetry transmission, GPS parsing |
| **Firmware Language** | Embedded C++ / Arduino Framework | Sensor reading, HTTP REST serialization, Wi-Fi stack |
| **Firmware Libraries** | `WiFi.h`, `HTTPClient.h`, `TinyGPSPlus.h`, `DHT.h`, `ArduinoJson.h` (v6+) | Hardware communication and JSON serialization |
| **Cloud Database** | Google Firebase Realtime Database (RTDB) | Schema-less NoSQL JSON document store for real-time telemetry syncing |
| **Cloud Hosting** | Firebase Hosting | Static asset hosting for the web dashboard |
| **CLI Monitoring** | Python 3 (Tested on 3.14.4), `urllib.request`, ANSI terminal codes | Headless desktop telemetry polling and live status display |
| **Web Frontend** | Vanilla HTML5, Vanilla CSS3 (Custom Glassmorphism), Modern Vanilla JavaScript (ES6+) | User interface without build-tool dependencies |
| **Frontend Libraries** | Leaflet.js v1.9.4, Leaflet.heat v0.2.0, Chart.js v4.4.1 (UMD), Google Fonts | Map rendering, heatmaps, and time-series graphing |
| **Version Control** | Git | Distributed source control |

---

## 2. Folder Structure & File Manifest

### 2.1 Workspace Hierarchy

```text
/home/shivuah/Pollution_Monitoring/
├── .firebaserc                          # Firebase project alias configuration
├── .gitignore                           # Git ignore rules for node, python, logs, and caches
├── Arduino_Code/
│   └── pollution_monitor.ino            # ESP32 firmware sketch for sensors, GPS & Firebase sync
├── dataconnect/                         # Firebase Data Connect boilerplate (UNUSED)
│   ├── dataconnect.yaml                 # Data connect service descriptor
│   ├── example/
│   │   ├── connector.yaml               # Connector config
│   │   ├── mutations.gql                # GraphQL mutation templates (Movie review app)
│   │   └── queries.gql                  # GraphQL query templates (Movie review app)
│   ├── schema/
│   │   └── schema.gql                   # GraphQL schema definition (Movie review app)
│   └── seed_data.gql                    # Seed GraphQL dataset (Movie review app)
├── demo.json                            # Reference / mock seed JSON for Firebase RTDB
├── firebase.json                        # Firebase hosting configuration
├── monitor.py                           # Python terminal dashboard for live cloud polling
├── public/                              # Web application assets deployed to Firebase Hosting
│   ├── 404.html                         # Fallback error page
│   ├── app.js                           # Modular JavaScript controller for web dashboard
│   ├── config.js                        # Configuration module (Firebase keys, thresholds, map coords)
│   ├── index.html                       # Primary single-page web dashboard (currently monolithic)
│   └── styles.css                       # Standalone CSS stylesheet matching index.html styles
├── README.md                            # High-level project summary and wiring overview
└── __pycache__/                         # Python bytecode cache directory
```

### 2.2 File Purposes and Manifest Details

- [`.firebaserc`](file:///home/shivuah/Pollution_Monitoring/.firebaserc): Links the local project directory to Firebase project ID `pollutionmonitoring-4156-69176`.
- [`firebase.json`](file:///home/shivuah/Pollution_Monitoring/firebase.json): Configures Firebase Hosting pointing to the `public/` directory with standard ignore rules.
- [`Arduino_Code/pollution_monitor.ino`](file:///home/shivuah/Pollution_Monitoring/Arduino_Code/pollution_monitor.ino): The complete embedded firmware for the ESP32. Handles GPIO pin reads (MQ-135 on Pin 34, DHT11 on Pin 4), hardware UART2 for GPS (Pins 26/27), Wi-Fi connection, periodic JSON construction, and HTTP PATCH/POST calls to Firebase RTDB.
- [`monitor.py`](file:///home/shivuah/Pollution_Monitoring/monitor.py): Standalone terminal utility that polls Firebase RTDB every 2 seconds and prints an ANSI-colored console dashboard displaying vehicle states, alert records, and individual node data.
- [`public/index.html`](file:///home/shivuah/Pollution_Monitoring/public/index.html): The active web dashboard. Currently contains all HTML structure, inlined CSS styles (lines 21–635), and inlined JavaScript logic (lines 856–1276).
- [`public/app.js`](file:///home/shivuah/Pollution_Monitoring/public/app.js): External modular JavaScript file containing the frontend controller logic. **Note:** Currently not loaded by `public/index.html`.
- [`public/styles.css`](file:///home/shivuah/Pollution_Monitoring/public/styles.css): External stylesheet defining the glassmorphism design tokens, CSS variables, and layout classes. **Note:** Currently not linked by `public/index.html`.
- [`public/config.js`](file:///home/shivuah/Pollution_Monitoring/public/config.js): Exports `firebaseConfig`, `THRESHOLDS`, and `MAP_CONFIG`. **Note:** Currently orphaned and unimported.
- [`public/404.html`](file:///home/shivuah/Pollution_Monitoring/public/404.html): Standard Firebase 404 page.
- [`demo.json`](file:///home/shivuah/Pollution_Monitoring/demo.json): Static JSON structure containing sample vehicle coordinates, routes, and alerts used as initial database fixture or manual import.
- [`dataconnect/`](file:///home/shivuah/Pollution_Monitoring/dataconnect): Contains default GraphQL/CloudSQL schema files from Firebase Data Connect init for a movie review app. Completely disconnected from this project.

---

## 3. Current Progress Matrix

| Feature / Component | Status | Verification Evidence & Location |
| :--- | :--- | :--- |
| **ESP32 Sensor Sampling (MQ-135 & DHT11)** | **Completed** | [pollution_monitor.ino:L66-76, L175-177](file:///home/shivuah/Pollution_Monitoring/Arduino_Code/pollution_monitor.ino#L66-L76) - Functional analog and digital read logic implemented. |
| **ESP32 GPS Telemetry (NEO-6M)** | **Completed** | [pollution_monitor.ino:L166-168, L180-187](file:///home/shivuah/Pollution_Monitoring/Arduino_Code/pollution_monitor.ino#L166-L187) - Serial2 decoding with default fallback coordinates. |
| **ESP32 Firebase RTDB Publishing** | **Completed** | [pollution_monitor.ino:L85-109, L209-212](file:///home/shivuah/Pollution_Monitoring/Arduino_Code/pollution_monitor.ino#L85-L109) - Sends HTTP PATCH to `/vehicles/<ID>.json`. |
| **ESP32 Real-Time Alert Triggering** | **Partially Completed** | [pollution_monitor.ino:L112-136, L214-218](file:///home/shivuah/Pollution_Monitoring/Arduino_Code/pollution_monitor.ino#L112-L136) - Sends HTTP POST to `/alerts.json`, but lacks alert debounce/rate limiting and uses `millis()` rather than epoch time. |
| **Python CLI Terminal Monitor** | **Partially Completed** | [monitor.py:L42-51, L57-125](file:///home/shivuah/Pollution_Monitoring/monitor.py#L42-L51) - Cloud polling and dashboard rendering verified. Serial port monitoring (`/dev/ttyUSB0`) declared in header/variables but **not implemented**. |
| **Web UI Glassmorphism Design & Layout** | **Completed** | [index.html:L21-635](file:///home/shivuah/Pollution_Monitoring/public/index.html#L21-L635) and [styles.css:L1-616](file:///home/shivuah/Pollution_Monitoring/public/styles.css#L1-L616) - Rich UI with KPI cards, radial gauge, responsive grids. |
| **Web Leaflet Map & Heatmap** | **Completed** | [index.html:L925-950, L1103-1160](file:///home/shivuah/Pollution_Monitoring/public/index.html#L925-L950) - Real-time vehicle markers, coordinate centering, dynamic heatlayer updates. |
| **Web Chart.js Real-Time Telemetry** | **Completed** | [index.html:L952-1014, L1073-1101](file:///home/shivuah/Pollution_Monitoring/public/index.html#L952-L1014) - Rolling 25-point time-series graph with interactive CO₂ / Temp / Humidity tab switching. |
| **Web Audio Synthesized Chime** | **Completed** | [index.html:L1192-1207](file:///home/shivuah/Pollution_Monitoring/public/index.html#L1192-L1207) - Native Web Audio API oscillator generated sound on high threshold alerts. |
| **Web Data Export (CSV)** | **Completed** | [index.html:L1241-1254](file:///home/shivuah/Pollution_Monitoring/public/index.html#L1241-L1254) - Generates blob and initiates download. |
| **Frontend Modularity & Asset Linkage** | **Broken / Disconnected** | [index.html](file:///home/shivuah/Pollution_Monitoring/public/index.html) does not link to `styles.css` or `app.js`. `config.js` is unimported. Changes to external files do not affect the running page. |
| **Firebase Data Connect Integration** | **Not Implemented (Dead Code)** | [dataconnect/schema/schema.gql](file:///home/shivuah/Pollution_Monitoring/dataconnect/schema/schema.gql) contains uncustomized Movie review boilerplate. |
| **MQ-135 Sensor Calibration Curve** | **Broken / Unverified** | [pollution_monitor.ino:L66-75](file:///home/shivuah/Pollution_Monitoring/Arduino_Code/pollution_monitor.ino#L66-L75) uses crude linear mapping `map(rawValue, 0, 4095, 350, 3000)` instead of logarithmic resistance ratio ($R_s/R_0$). |
| **Secure Secrets & Config Management** | **Broken / Insecure** | Wi-Fi passwords and Firebase Database secrets hardcoded across `pollution_monitor.ino`, `monitor.py`, and `config.js`. |

---

## 4. Existing Functionality & System Architecture

### 4.1 End-to-End Architecture & Data Flow

```
                      +-----------------------------+
                      |   ESP32 Physical Node       |
                      |   Vehicle: KA01-5522        |
                      |  - MQ-135 (ADC Pin 34)      |
                      |  - DHT11 (GPIO Pin 4)       |
                      |  - NEO-6M GPS (UART2 26/27) |
                      +--------------+--------------+
                                     |
               HTTP PATCH / POST     | Wi-Fi (3s interval)
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
     HTTP GET (2.0s)  |                             | HTTP GET (1.5s)
     REST polling     v                             v REST polling
+---------------------------+        +-----------------------------------+
| Python CLI Dashboard      |        | Web Browser Dashboard             |
| `monitor.py`              |        | `public/index.html`               |
| - Terminal ANSI Output    |        | - Leaflet Map & Heatmap Layer     |
| - Tabular Fleet Status    |        | - Chart.js Telemetry Graph        |
| - Node Detail View        |        | - Radial CSS Conic Gauge          |
| - Alert Stream Log        |        | - Web Audio Incident Chimes       |
+---------------------------+        | - CSV Client-Side Export          |
                                     +-----------------------------------+
```

### 4.2 Data Schemas in Firebase RTDB

#### `/vehicles/{vehicleId}` Schema:
```json
{
  "co2_ppm": 820,
  "emission_per_km": 4.1,
  "total_emission": 28.5,
  "latitude": 12.9719,
  "longitude": 77.5937,
  "temperature": 27.5,
  "humidity": 62.0,
  "status": "Normal",
  "timestamp": 1710001100000
}
```

#### `/alerts/{alertId}` Schema:
```json
{
  "vehicle": "KA01-5522",
  "co2": 2150,
  "location": "12.9716, 77.5946",
  "status": "High",
  "note": "Emission Limit Exceeded — Critical Level!",
  "time": 1710001200000
}
```

### 4.3 Detailed Feature Walkthrough

1. **Firmware Telemetry Engine (`pollution_monitor.ino`):**
   - Initializes hardware pins and Wi-Fi connection in `setup()`.
   - In `loop()`, feeds the GPS NMEA stream from `HardwareSerial(2)` into `TinyGPSPlus`.
   - Every 3000ms, samples the MQ-135 analog voltage and computes PPM; samples DHT11 temperature/humidity; grabs GPS latitude and longitude (fallback to `12.9716, 77.5946`).
   - Uses `ArduinoJson` (v6) to serialize the document and issues an HTTP `PATCH` to `/vehicles/KA01-5522.json`.
   - If PPM exceeds thresholds, serializes an alert object and issues an HTTP `POST` to `/alerts.json`.

2. **Web Dashboard Engine (`public/index.html`):**
   - Automatically polls `/vehicles.json` and `/alerts.json` concurrently via `Promise.all` every 1500ms using the browser `fetch` API.
   - Updates the Fleet Node list on the left sidebar, showing active vehicles, CO₂ readings, and status badges.
   - Calculates fleet aggregate KPIs (Average CO₂, Current Connected Vehicle count, Ambient Temperature, Humidity).
   - Renders the selected vehicle in the center telemetry view: updates the dynamic radial gauge via CSS `conic-gradient`, displays coordinates, and derived emission figures.
   - Pushes readings to a rolling 25-point Chart.js dataset with tab toggling between CO₂ (blue), Temperature (orange), and Humidity (cyan).
   - Pins GPS markers onto the Leaflet map and plots pollution density onto `L.heatLayer`.
   - Populates the alert feed table and triggers an 880Hz -> 440Hz alert chime if critical readings are detected.

3. **Terminal Monitor Engine (`monitor.py`):**
   - Polls `FIREBASE_URL/.json?auth=...` every 2 seconds via `urllib.request`.
   - Clears the terminal screen using ANSI escape sequences (`\033[2J\033[H`).
   - Displays a clean ASCII tabular fleet summary, detailed metrics for node `KA01-5522`, and the 4 most recent alert entries.

---

## 5. Current Errors, Inconsistencies, and Technical Issues

### 5.1 Critical / High Severity Issues

1. **Complete Decoupling of Frontend Modules (Code Duplication)**
   - **Location:** [`public/index.html`](file:///home/shivuah/Pollution_Monitoring/public/index.html), [`public/app.js`](file:///home/shivuah/Pollution_Monitoring/public/app.js), [`public/styles.css`](file:///home/shivuah/Pollution_Monitoring/public/styles.css), [`public/config.js`](file:///home/shivuah/Pollution_Monitoring/public/config.js)
   - **Details:** `index.html` contains 615 lines of inlined CSS ([index.html:L21-635](file:///home/shivuah/Pollution_Monitoring/public/index.html#L21-L635)) and 420 lines of inlined JavaScript ([index.html:L856-1276](file:///home/shivuah/Pollution_Monitoring/public/index.html#L856-L1276)). It does not import or link `app.js` or `styles.css`.
   - **Impact:** Any developer modifying `app.js` or `styles.css` will observe zero effect in the browser. Furthermore, `config.js` is completely orphaned, leading to multiple hardcoded database URLs across files.
   - **Divergence:** `app.js` contains a JSON export function (`exportFleetJSON`) and listens to element `#downloadJSON` ([app.js:L577](file:///home/shivuah/Pollution_Monitoring/public/app.js#L577)), but `index.html` lacks this button. In `index.html`, the button ID is `downloadCSVBtn`, whereas `app.js:L572` looks for `downloadCSV`.

2. **Uncalibrated Gas Sensor Mapping (Inaccurate Environmental Metrics)**
   - **Location:** [`Arduino_Code/pollution_monitor.ino:L66-75`](file:///home/shivuah/Pollution_Monitoring/Arduino_Code/pollution_monitor.ino#L66-L75)
   - **Details:** The function `readMQ135PPM()` uses Arduino's linear mapping:
     ```cpp
     float ppm = map(rawValue, 0, 4095, 350, 3000);
     ```
   - **Impact:** MQ-135 sensors have a non-linear logarithmic sensitivity response curve to CO₂/gases ($PPM = a \cdot (R_s/R_0)^b$) and require baseline resistance ($R_0$) calibration in clean air. A linear map results in fabricated pollution values.

3. **Alert Flooding / Absence of Debounce & Cooldown**
   - **Location:** [`Arduino_Code/pollution_monitor.ino:L214-218`](file:///home/shivuah/Pollution_Monitoring/Arduino_Code/pollution_monitor.ino#L214-L218)
   - **Details:** In `loop()`, whenever `co2_ppm > THRESHOLD_NORMAL`, `sendAlert()` is invoked unconditionally every 3 seconds.
   - **Impact:** In a moderate-to-high pollution environment, the ESP32 will inject 20 alerts per minute into `/alerts.json`, quickly bloating Firebase RTDB and causing memory/rendering degradation on client dashboards.

4. **Invalid Timestamps (Epoch Milliseconds vs Device Uptime)**
   - **Location:** [`Arduino_Code/pollution_monitor.ino:L124, L203`](file:///home/shivuah/Pollution_Monitoring/Arduino_Code/pollution_monitor.ino#L124)
   - **Details:** The ESP32 sets `"timestamp": millis()` and `"time": millis()`.
   - **Impact:** `millis()` counts milliseconds since hardware power-on. The web dashboard executes `new Date(a.time)` ([index.html:L1173](file:///home/shivuah/Pollution_Monitoring/public/index.html#L1173)), which assumes a Unix epoch timestamp. Device uptime values (e.g., 30000ms) will display as dates in January 1970.

### 5.2 Medium Severity Issues

5. **Phantom Serial Monitoring in `monitor.py`**
   - **Location:** [`monitor.py:L6-7, L31-32, L126-136`](file:///home/shivuah/Pollution_Monitoring/monitor.py#L6-L7)
   - **Details:** The module docstring claims the script monitors telemetry "either directly from the serial port (/dev/ttyUSB0) or via the Firebase Realtime Database cloud stream." However, `pyserial` is not imported, and the execution loop only queries the cloud URL.

6. **Full-Database Polling Overhead in `monitor.py`**
   - **Location:** [`monitor.py:L44`](file:///home/shivuah/Pollution_Monitoring/monitor.py#L44)
   - **Details:** Calls `GET /.json?auth=...`. Fetching the root node downloads the entire database including all historical alerts and routes, which scales poorly as data accumulates.

7. **Dead Code: Unused Firebase Data Connect Boilerplate**
   - **Location:** [`dataconnect/`](file:///home/shivuah/Pollution_Monitoring/dataconnect) (entire directory)
   - **Details:** Contains boilerplate GraphQL schemas for a movie review app. This adds noise and confusion to the codebase.

8. **Uncommitted Working Tree State & Untracked Core Files**
   - **Location:** Workspace root Git index
   - **Details:** The entire redesign on August 26–27, 2026, was never committed. `Arduino_Code/` and `monitor.py` are untracked. Any accidental `git checkout .` or `git clean` would destroy this work.

### 5.3 Low Severity / Security Configuration Issues

9. **Plaintext Hardcoded Secrets**
   - **Location:** [`Arduino_Code/pollution_monitor.ino:L19-25`](file:///home/shivuah/Pollution_Monitoring/Arduino_Code/pollution_monitor.ino#L19-L25), [`monitor.py:L29-30`](file:///home/shivuah/Pollution_Monitoring/monitor.py#L29-L30), [`public/config.js:L2-11`](file:///home/shivuah/Pollution_Monitoring/public/config.js#L2-L11)
   - **Details:** Wi-Fi credentials (`WIFI_SSID = "Shivu"`), Firebase database secrets, and Firebase API keys are committed or staged in plain text.
   - **Remediation:** Wi-Fi credentials should be managed via WiFiManager or an untracked `secrets.h`. Firebase database rules should enforce user/token auth rather than legacy database secrets.

---

## 6. Last Development Point Analysis

### 6.1 Confirmed Timeline & Facts (Evidence-Based)

From file modification timestamps, git status, and git log inspection:

1. **Initial Commit (`f4c8427`, 2025-11-09):** Contained early Firebase setup with Google Maps API and Firebase Web SDK v9.
2. **README Update (`7e2756c`, 2026-07-21):** Shivanand Hanchinal updated project description and tech stack in `README.md`.
3. **Major Overhaul Session (Night of August 26–27, 2026):**
   - `23:19:58` – `.firebaserc` modified to set default project `pollutionmonitoring-4156-69176`.
   - `23:20:05` – `firebase.json` modified to match the new hosting target.
   - `23:46:26` – `Arduino_Code/pollution_monitor.ino` created/updated with sensor loops and HTTP REST client.
   - `00:09:07` – `public/config.js` written with new database endpoints.
   - `00:10:53` – `monitor.py` written to stream live telemetry to terminal.
   - `00:11:24` – `__pycache__/` created, confirming `monitor.py` was executed.
   - `00:28:58` – `public/app.js` modified to implement Leaflet and native REST polling.
   - `00:41:48` – `public/index.html` modified to inline all CSS and JS for standalone testing.
   - `00:42:32` – `public/styles.css` modified to store the extracted stylesheet.

### 6.2 Stopping Point Determination

Development stopped immediately after **`public/styles.css`** was updated at **`00:42:32 +05:30 on August 27, 2026`**.
The developer had just finished modernizing the web UI into a glassmorphism theme with Leaflet mapping and Chart.js, and inlined the assets into `public/index.html` for rapid manual verification. 

### 6.3 What Remained Incomplete When Work Stopped

1. Re-linking `public/index.html` back to external modular files (`app.js`, `styles.css`, `config.js`).
2. Synchronizing feature discrepancies (such as JSON export and button IDs) between `app.js` and `index.html`.
3. Implementing the local serial port fallback reader in `monitor.py`.
4. Adding NTP synchronization to ESP32 firmware for realistic Unix timestamps.
5. Staging and committing the unstaged and untracked changes to Git.

---

## 7. How to Run and Inspect the Project

> [!IMPORTANT]
> In accordance with safety rules, these instructions only use non-modifying inspection commands.

### 7.1 Prerequisites
- **Python:** Python 3.8+ (System has Python 3.14.4 installed at `/usr/bin/python3`).
- **Web Browser:** Any modern browser (Chrome, Firefox, Brave, Edge).
- **Arduino IDE / ESP32 Core:** Arduino IDE 2.x with ESP32 board package (version 2.0.x or 3.x) and libraries: `TinyGPSPlus`, `DHT sensor library`, `ArduinoJson` (v6+).

### 7.2 Running the Web Dashboard Locally

Since the frontend is built entirely with vanilla web technologies and accesses Firebase RTDB directly via HTTP REST, it requires no Node.js build step or bundler.

To launch a local HTTP server from the project directory:

```bash
# Option A: Using Python built-in HTTP server (Read-only, served from public/)
python3 -m http.server 5000 --directory public
```

Then open `http://localhost:5000` in your web browser.
*(Alternatively, opening `public/index.html` directly in the browser works because scripts and styles are currently inlined.)*

### 7.3 Running the Python Terminal Monitor

To run the terminal dashboard and view live cloud telemetry:

```bash
python3 monitor.py
```
*(Press `Ctrl+C` to terminate).*

### 7.4 Compiling / Inspecting the ESP32 Firmware

1. Launch Arduino IDE.
2. Open [`Arduino_Code/pollution_monitor.ino`](file:///home/shivuah/Pollution_Monitoring/Arduino_Code/pollution_monitor.ino).
3. Select Board: **ESP32 Dev Module**.
4. Required Arduino Library Manager packages:
   - `ArduinoJson` by Benoit Blanchon (Version 6.x recommended)
   - `DHT sensor library` by Adafruit
   - `TinyGPSPlus` by Mikal Hart
5. Verify / Compile (Check mark icon) to ensure all header symbols resolve.

---

## 8. Prioritized Next Steps

The following table provides the prioritized development backlog for the next engineer or AI assistant.

| Priority | Task Title | Description & Objectives | Target Files | Blockers / Clarifications Needed |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Preserve & Commit Unsaved Progress** | Stage and commit the existing modified and untracked files (`Arduino_Code/`, `monitor.py`, `public/*`) onto a new branch (`feature/modern-iot-dashboard`) to prevent data loss. | Git Index | None. Can be done immediately. |
| **2** | **Unify & Clean Frontend Modularity** | Remove duplicate inlined `<style>` and `<script>` blocks from `public/index.html`. Link to `styles.css` and `app.js` via `<link>` and `<script type="module">`. Import `config.js` in `app.js`. Reconcile element IDs (`downloadCSVBtn` vs `downloadCSV`, add `downloadJSON`). | `public/index.html`<br>`public/app.js`<br>`public/config.js` | Clarify if standalone single-file `index.html` was intentional for distribution or an interim testing hack. |
| **3** | **Implement NTP Time Sync on ESP32** | Replace `millis()` timestamps with true epoch milliseconds using ESP32's built-in SNTP (`configTime()` and `time(nullptr)`). This ensures charts and alert history display correct real-world dates. | `Arduino_Code/pollution_monitor.ino` | Confirm Wi-Fi network has internet access to reach NTP pool servers (`pool.ntp.org`). |
| **4** | **Add Alert Debounce & Rate Limiting** | Add stateful alert hysteresis and a cooldown timer (e.g., minimum 60 seconds between alerts) in `pollution_monitor.ino` to prevent database flooding when pollution stays elevated. | `Arduino_Code/pollution_monitor.ino` | Confirm desired alert cooldown duration and latching logic. |
| **5** | **Calibrate MQ-135 Gas Calculation** | Upgrade `readMQ135PPM()` from linear interpolation to standard logarithmic ratio calculation based on baseline clean air resistance $R_0$. | `Arduino_Code/pollution_monitor.ino` | Inquire whether user has measured the sensor's $R_0$ baseline value in clean air. |
| **6** | **Implement Local Serial Port Fallback in `monitor.py`** | Use `pyserial` to allow `monitor.py` to optionally read serial JSON strings directly from `/dev/ttyUSB0` when offline or debugging hardware, as stated in its docstring. | `monitor.py` | Confirm whether hardware serial output format matches Firebase JSON payload. |
| **7** | **Clean Up Unused Data Connect Boilerplate** | Remove the orphaned `dataconnect/` directory and its reference in `.gitignore`, or document its intended future purpose if Cloud SQL migration is planned. | `dataconnect/`<br>`.gitignore` | Clarify if Firebase Data Connect (Cloud SQL Postgres) was ever intended for this project. |
| **8** | **Externalize Credentials to Config / Secrets** | Extract Wi-Fi credentials and Firebase database secrets out of source code into an untracked header (`secrets.h`) and `.env` file. | `Arduino_Code/pollution_monitor.ino`<br>`monitor.py`<br>`public/config.js` | None. Standard security hygiene. |

---

## 9. Important Files to Inspect First

When continuing work on this project, the next assistant or engineer should read the following files in priority order:

1. [`Arduino_Code/pollution_monitor.ino`](file:///home/shivuah/Pollution_Monitoring/Arduino_Code/pollution_monitor.ino): The source of truth for telemetry generation, GPIO pin assignments, JSON payload formats, and cloud sync intervals.
2. [`public/index.html`](file:///home/shivuah/Pollution_Monitoring/public/index.html): The active dashboard entry point containing the full working UI, inlined styles, and active event handlers.
3. [`public/app.js`](file:///home/shivuah/Pollution_Monitoring/public/app.js): The intended modular client controller; inspect to reconcile with `index.html`.
4. [`monitor.py`](file:///home/shivuah/Pollution_Monitoring/monitor.py): Demonstrates how external clients parse and consume the Firebase RTDB fleet schema.
5. [`public/config.js`](file:///home/shivuah/Pollution_Monitoring/public/config.js): Contains centralized threshold configurations and map constants.
6. [`demo.json`](file:///home/shivuah/Pollution_Monitoring/demo.json): Useful baseline schema and mock data for offline simulation.

---

## 10. Final Handover Summary

- **Project Core:** IoT Vehicular Pollution Monitoring System combining ESP32 sensor hardware, Firebase Realtime Database, a Python terminal monitor, and a Leaflet/Chart.js Web GIS Dashboard.
- **Current Architecture:** ESP32 nodes push telemetry directly via HTTP PATCH to Firebase RTDB REST endpoints every 3s. Clients (Web dashboard at 1.5s interval and Python CLI at 2.0s interval) pull updates concurrently without a custom backend server.
- **Completed Components:** Full hardware reading loops, cloud syncing, rich glassmorphism UI, Leaflet geospatial mapping, pollution heatmaps, multi-metric Chart.js graphs, Web Audio synthesizer chime, and terminal monitor.
- **Bugs & Technical Debt:** Frontend code duplication (inlined CSS/JS in `index.html` bypassing `app.js` and `styles.css`), crude linear MQ-135 calibration, missing NTP timestamps (causing 1970 date displays), alert flooding without debounce, and hardcoded plaintext credentials.
- **Likely Stopping Point:** August 27, 2026, 00:42 AM IST, right after extracting `public/styles.css` following the web dashboard redesign.
- **Key Files:** [`Arduino_Code/pollution_monitor.ino`](file:///home/shivuah/Pollution_Monitoring/Arduino_Code/pollution_monitor.ino), [`public/index.html`](file:///home/shivuah/Pollution_Monitoring/public/index.html), [`public/app.js`](file:///home/shivuah/Pollution_Monitoring/public/app.js), [`monitor.py`](file:///home/shivuah/Pollution_Monitoring/monitor.py).
- **Recommended Immediate Task:** Secure all uncommitted work in Git, then clean up the frontend architecture by properly linking `index.html` to `app.js` and `styles.css`.
- **Constraints to Preserve:** Maintain the zero-external-SDK architecture in the frontend (pure browser `fetch` to Firebase REST API), which ensures compatibility across privacy-focused browsers like Brave without ad-blocker interference.
