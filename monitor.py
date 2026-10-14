#!/usr/bin/env python3
"""
==============================================================================
CityFleet IoT Pollution Monitoring — Live Terminal & Serial Monitor
==============================================================================
Monitors ESP32 hardware telemetry either directly from the serial port
(/dev/ttyUSB0) or via the Firebase Realtime Database cloud stream.
==============================================================================
"""

import sys
import time
import json
import urllib.request
import urllib.error

# ANSI Color Codes for Rich Terminal Output
RESET = "\033[0m"
BOLD = "\033[1m"
GREEN = "\033[38;5;46m"
YELLOW = "\033[38;5;220m"
RED = "\033[38;5;196m"
CYAN = "\033[38;5;51m"
BLUE = "\033[38;5;39m"
GRAY = "\033[38;5;245m"
WHITE = "\033[38;5;231m"
BG_BLUE = "\033[48;5;24m"

FIREBASE_URL = "https://pollutionmonitoring-4156-69176-default-rtdb.firebaseio.com"
FIREBASE_AUTH = "Yp3TIa3LJsekyl7uSorerohHrijf97UVjQMHkwR5k"
SERIAL_PORT = "/dev/ttyUSB0"
BAUD_RATE = 115200

def get_aqi_badge(ppm):
    if ppm <= 1000:
        return f"{GREEN}[ NORMAL / GOOD ]{RESET}", GREEN
    elif ppm <= 2000:
        return f"{YELLOW}[ MODERATE / CAUTION ]{RESET}", YELLOW
    else:
        return f"{RED}[ CRITICAL / HIGH ]{RESET}", RED

def fetch_cloud_data():
    try:
        url = f"{FIREBASE_URL}/.json?auth={FIREBASE_AUTH}"
        req = urllib.request.Request(url, headers={'User-Agent': 'CityFleetMonitor/1.0'})
        with urllib.request.urlopen(req, timeout=4) as response:
            if response.status == 200:
                return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        return {"error": str(e)}
    return None

def clear_screen():
    sys.stdout.write("\033[2J\033[H")
    sys.stdout.flush()

def display_dashboard(data, source_type="Firebase Cloud"):
    clear_screen()
    
    print(f"{BG_BLUE}{WHITE}{BOLD} ========================================================================= {RESET}")
    print(f"{BG_BLUE}{WHITE}{BOLD}   🌍 CityFleet IoT Pollution & Environmental Monitoring Live Station      {RESET}")
    print(f"{BG_BLUE}{WHITE}{BOLD} ========================================================================= {RESET}\n")

    current_time = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f" {GRAY}Telemetry Source:{RESET} {CYAN}{source_type}{RESET}  |  {GRAY}Timestamp:{RESET} {WHITE}{current_time}{RESET}")
    print(f" {GRAY}Dashboard Web UI:{RESET} {BLUE}http://localhost:5000{RESET}\n")

    if not data or "error" in data:
        print(f" {RED}⚠️ Error connecting to data source:{RESET} {data.get('error', 'No data')}")
        return

    vehicles = data.get("vehicles", {})
    alerts = data.get("alerts", {})

    print(f"{BOLD}┌── 🚚 FLEET TELEMETRY STATUS ─────────────────────────────────────────────┐{RESET}")
    print(f"│ {'Node ID':<11} │ {'CO₂ PPM':<9} │ {'Temp':<7} │ {'Humidity':<9} │ {'Status':<16} │ {'GPS Fix':<10} │")
    print(f"├─────────────┼───────────┼─────────┼───────────┼──────────────────┼────────────┤")

    for vid, v in vehicles.items():
        ppm = v.get("co2_ppm", 0)
        temp = f"{v.get('temperature', '--')}°C"
        humidity = f"{v.get('humidity', '--')}%"
        badge, color = get_aqi_badge(ppm)
        lat = v.get("latitude", "12.9716")
        lng = v.get("longitude", "77.5946")
        gps_summary = f"{float(lat):.2f},{float(lng):.2f}"

        print(f"│ {BOLD}{vid:<11}{RESET} │ {color}{ppm:<9}{RESET} │ {WHITE}{temp:<7}{RESET} │ {CYAN}{humidity:<9}{RESET} │ {badge:<25} │ {GRAY}{gps_summary:<10}{RESET} │")

    print(f"└─────────────┴───────────┴─────────┴───────────┴──────────────────┴────────────┘\n")

    # Detailed view for ESP32 Node (KA01-5522)
    esp32_data = vehicles.get("KA01-5522", {})
    if esp32_data:
        co2 = esp32_data.get("co2_ppm", 0)
        emission_rate = esp32_data.get("emission_per_km", "--")
        total_emission = esp32_data.get("total_emission", "--")
        lat = esp32_data.get("latitude", "12.9716")
        lng = esp32_data.get("longitude", "77.5946")
        temp = esp32_data.get("temperature", "--")
        humidity = esp32_data.get("humidity", "--")

        print(f"{BOLD}┌── 📡 LIVE ESP32 HARDWARE NODE DETAILS (KA01-5522) ───────────────────────┐{RESET}")
        print(f"│  • {BOLD}Air Quality (MQ-135):{RESET}    {co2} PPM CO₂")
        print(f"│  • {BOLD}Temperature (DHT11):{RESET}     {temp} °C")
        print(f"│  • {BOLD}Relative Humidity (DHT11):{RESET} {humidity} %")
        print(f"│  • {BOLD}Emission Rate:{RESET}            {emission_rate} g/km")
        print(f"│  • {BOLD}Cumulative Emission:{RESET}      {total_emission} g")
        print(f"│  • {BOLD}GPS Coordinates:{RESET}          Lat: {lat}, Lng: {lng}")
        print(f"└────────────────────────────────────────────────────────────────────────┘\n")

    # Recent Alerts Section
    if alerts:
        print(f"{BOLD}┌── ⚠️ RECENT ANOMALY & ALERT LOGS ────────────────────────────────────────┐{RESET}")
        for aid, a in list(alerts.items())[-4:]:
            veh = a.get("vehicle", "Unknown")
            alert_ppm = a.get("co2", "--")
            status = a.get("status", "High")
            note = a.get("note", "Limit exceeded")
            stat_color = RED if status == "High" else YELLOW
            print(f"│  [{stat_color}{status.upper()}{RESET}] {BOLD}{veh}{RESET} | CO₂: {alert_ppm} PPM | {note}")
        print(f"└────────────────────────────────────────────────────────────────────────┘\n")

    print(f"{GRAY}Press Ctrl+C to stop monitoring.{RESET}")

def main():
    print("Starting CityFleet Pollution Monitor CLI...")
    try:
        while True:
            cloud_data = fetch_cloud_data()
            if cloud_data:
                display_dashboard(cloud_data, "ESP32 -> Firebase Cloud")
            time.sleep(2)
    except KeyboardInterrupt:
        print(f"\n{GREEN}Monitoring stopped by user.{RESET}")
        sys.exit(0)

if __name__ == "__main__":
    main()
