#!/usr/bin/env python3
"""
==============================================================================
CityFleet IoT Pollution Monitoring — Live Terminal & Serial Monitor
==============================================================================
Provides real-time terminal telemetry monitoring for ESP32 edge nodes.
Supports:
  1. Firebase Realtime Database cloud stream polling
  2. Local USB Serial port live telemetry (/dev/ttyUSB0)
  3. Alva's Institute of Engineering & Technology demonstration simulation
==============================================================================
"""

import sys
import time
import json
import os
import argparse
import urllib.request
import urllib.error

# ANSI Color Codes for Rich Terminal Output
RESET   = "\033[0m"
BOLD    = "\033[1m"
GREEN   = "\033[38;5;46m"
YELLOW  = "\033[38;5;220m"
RED     = "\033[38;5;196m"
CYAN    = "\033[38;5;51m"
BLUE    = "\033[38;5;39m"
GRAY    = "\033[38;5;245m"
WHITE   = "\033[38;5;231m"
BG_BLUE = "\033[48;5;24m"

DEFAULT_FIREBASE_URL = "https://pollutionmonitoring-4156-69176-default-rtdb.firebaseio.com"

# Alva's Institute of Engineering and Technology (AIET), Moodbidri Demonstration Fixture
DEMO_FIXTURE = {
    "vehicles": {
        "KA01-5522": {
            "vehicle_id": "KA01-5522",
            "co2_ppm": 820,
            "raw_adc": 1140,
            "temperature": 28.2,
            "humidity": 64.0,
            "dht_valid": True,
            "latitude": 13.023600,
            "longitude": 74.967600,
            "gps_valid": False,
            "location_source": "demo_fallback",
            "location_label": "Mijar, Moodbidri",
            "emission_per_km": 4.10,
            "total_emission": 28.5,
            "status": "Normal",
            "timestamp": int(time.time() * 1000) - 2000,
            "last_seen": int(time.time() * 1000) - 2000
        },
        "KA02-8876": {
            "vehicle_id": "KA02-8876",
            "co2_ppm": 1680,
            "raw_adc": 2180,
            "temperature": 30.5,
            "humidity": 58.0,
            "dht_valid": True,
            "latitude": 13.0255,
            "longitude": 74.9698,
            "gps_valid": False,
            "location_source": "demo_fallback",
            "location_label": "Moodbidri Highway Junction",
            "emission_per_km": 8.40,
            "total_emission": 59.2,
            "status": "Moderate",
            "timestamp": int(time.time() * 1000) - 5000,
            "last_seen": int(time.time() * 1000) - 5000
        },
        "KA05-3341": {
            "vehicle_id": "KA05-3341",
            "co2_ppm": 2620,
            "raw_adc": 3410,
            "temperature": 33.1,
            "humidity": 51.0,
            "dht_valid": True,
            "latitude": 13.0212,
            "longitude": 74.9654,
            "gps_valid": False,
            "location_source": "demo_fallback",
            "location_label": "Industrial Zone Mijar",
            "emission_per_km": 13.10,
            "total_emission": 104.8,
            "status": "High",
            "timestamp": int(time.time() * 1000) - 3000,
            "last_seen": int(time.time() * 1000) - 3000
        }
    },
    "alerts": {
        "alert_demo_1": {
            "vehicle": "KA02-8876",
            "co2": 1680,
            "time": int(time.time() * 1000) - 120000,
            "location": "13.0255, 74.9698",
            "status": "Moderate",
            "note": "Emission threshold warning"
        },
        "alert_demo_2": {
            "vehicle": "KA05-3341",
            "co2": 2620,
            "time": int(time.time() * 1000) - 45000,
            "location": "13.0212, 74.9654",
            "status": "High",
            "note": "Critical Emission Spike Detected!"
        }
    }
}

def get_aqi_badge(ppm):
    if ppm <= 1000:
        return f"{GREEN}[ NORMAL / GOOD ]{RESET}", GREEN
    elif ppm <= 2000:
        return f"{YELLOW}[ MODERATE / CAUTION ]{RESET}", YELLOW
    else:
        return f"{RED}[ CRITICAL / HIGH ]{RESET}", RED

def clear_screen():
    sys.stdout.write("\033[2J\033[H")
    sys.stdout.flush()

def fetch_cloud_data(base_url, auth_token=""):
    data = {"vehicles": {}, "alerts": {}}
    headers = {"User-Agent": "CityFleetTerminalMonitor/2.0"}

    # Fetch vehicles
    v_url = f"{base_url}/vehicles.json"
    if auth_token:
        v_url += f"?auth={auth_token}"

    try:
        req = urllib.request.Request(v_url, headers=headers)
        with urllib.request.urlopen(req, timeout=4) as resp:
            if resp.status == 200:
                body = resp.read().decode("utf-8")
                v_data = json.loads(body)
                if isinstance(v_data, dict):
                    data["vehicles"] = v_data
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code} ({e.reason})"}
    except Exception as e:
        return {"error": str(e)}

    # Fetch alerts
    a_url = f"{base_url}/alerts.json"
    if auth_token:
        a_url += f"?auth={auth_token}"

    try:
        req = urllib.request.Request(a_url, headers=headers)
        with urllib.request.urlopen(req, timeout=4) as resp:
            if resp.status == 200:
                body = resp.read().decode("utf-8")
                a_data = json.loads(body)
                if isinstance(a_data, dict):
                    data["alerts"] = a_data
    except Exception:
        pass

    return data

def display_dashboard(data, source_type="Firebase Cloud"):
    clear_screen()

    print(f"{BG_BLUE}{WHITE}{BOLD} ========================================================================= {RESET}")
    print(f"{BG_BLUE}{WHITE}{BOLD}   🌍 CityFleet IoT Pollution & Environmental Monitoring Live Station      {RESET}")
    print(f"{BG_BLUE}{WHITE}{BOLD} ========================================================================= {RESET}\n")

    current_time = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f" {GRAY}Telemetry Source:{RESET} {CYAN}{source_type}{RESET}  |  {GRAY}Timestamp:{RESET} {WHITE}{current_time}{RESET}")
    print(f" {GRAY}Dashboard Web UI:{RESET} {BLUE}http://localhost:5000{RESET}")
    print(f" {GRAY}Station Location:{RESET} {WHITE}Mijar, Moodbidri{RESET}\n")

    if not data or "error" in data:
        print(f" {YELLOW}⚠️ Data Source Notice:{RESET} {data.get('error', 'No telemetry received')}")
        print(f" {GRAY}Tip: If cloud access is restricted, run with {WHITE}--demo{GRAY} to inspect simulated hardware feed.{RESET}\n")
        return

    vehicles = data.get("vehicles", {})
    alerts = data.get("alerts", {})

    print(f"{BOLD}┌── 🚚 FLEET TELEMETRY STATUS ─────────────────────────────────────────────┐{RESET}")
    print(f"│ {'Node ID':<11} │ {'CO₂ PPM':<9} │ {'Temp':<7} │ {'Humidity':<9} │ {'Status':<16} │ {'Location Fix':<13} │")
    print(f"├─────────────┼───────────┼─────────┼───────────┼──────────────────┼───────────────┤")

    if not vehicles:
        print(f"│ {GRAY}{'No active vehicles found in stream.':<73}{RESET} │")
    else:
        for vid, v in vehicles.items():
            ppm = v.get("co2_ppm", 0)
            temp = f"{v.get('temperature', '--')}°C" if v.get("temperature") is not None else "--"
            humidity = f"{v.get('humidity', '--')}%" if v.get("humidity") is not None else "--"
            badge, color = get_aqi_badge(ppm)

            is_live_gps = (v.get("gps_valid") is True and v.get("location_source") == "gps")
            loc_label = f"{GREEN}LIVE GPS{RESET}" if is_live_gps else f"{CYAN}Mijar{RESET}"

            print(f"│ {BOLD}{vid:<11}{RESET} │ {color}{ppm:<9}{RESET} │ {WHITE}{temp:<7}{RESET} │ {CYAN}{humidity:<9}{RESET} │ {badge:<25} │ {loc_label:<22} │")

    print(f"└─────────────┴───────────┴─────────┴───────────┴──────────────────┴───────────────┘\n")

    # Detailed Node Telemetry (Default to KA01-5522 or first vehicle)
    focus_id = "KA01-5522" if "KA01-5522" in vehicles else (list(vehicles.keys())[0] if vehicles else None)
    if focus_id and focus_id in vehicles:
        node = vehicles[focus_id]
        co2 = node.get("co2_ppm", 0)
        raw_adc = node.get("raw_adc", "--")
        emission_rate = node.get("emission_per_km", "--")
        total_emission = node.get("total_emission", "--")
        lat = node.get("latitude", "13.023600")
        lng = node.get("longitude", "74.967600")
        temp = node.get("temperature", "--")
        humidity = node.get("humidity", "--")
        loc_src = node.get("location_source", "demo_fallback")
        loc_desc = node.get("location_label", "Mijar, Moodbidri")
        if "AIET" in loc_desc or "Demo" in loc_desc:
            loc_desc = "Mijar, Moodbidri"

        print(f"{BOLD}┌── 📡 HARDWARE NODE DETAILED TELEMETRY ({focus_id}) ─────────────────────┐{RESET}")
        print(f"│  • {BOLD}Air Quality (MQ-135):{RESET}      {co2} PPM CO₂ (Raw ADC: {raw_adc})")
        print(f"│  • {BOLD}Temperature (DHT11):{RESET}       {temp} °C")
        print(f"│  • {BOLD}Relative Humidity (DHT11):{RESET} {humidity} %")
        print(f"│  • {BOLD}Emission Rate:{RESET}              {emission_rate} g/km")
        print(f"│  • {BOLD}Cumulative Emission:{RESET}        {total_emission} g")
        print(f"│  • {BOLD}Geospatial Coordinates:{RESET}   Lat: {lat}, Lng: {lng}")
        print(f"│  • {BOLD}Location Mode:{RESET}             {loc_src.upper()} — {loc_desc}")
        print(f"└────────────────────────────────────────────────────────────────────────┘\n")

    # Incident Alerts
    if alerts:
        print(f"{BOLD}┌── ⚠️ RECENT ANOMALY & INCIDENT LOGS ────────────────────────────────────┐{RESET}")
        for aid, a in list(alerts.items())[-4:]:
            veh = a.get("vehicle", "Unknown")
            alert_ppm = a.get("co2", "--")
            status = a.get("status", "High")
            note = a.get("note", "Limit exceeded")
            stat_color = RED if status == "High" else YELLOW
            print(f"│  [{stat_color}{status.upper():<8}{RESET}] {BOLD}{veh:<10}{RESET} | CO₂: {alert_ppm} PPM | {note}")
        print(f"└────────────────────────────────────────────────────────────────────────┘\n")

    print(f"{GRAY}Press Ctrl+C to exit monitor.{RESET}")

def run_serial_monitor(port, baud_rate):
    try:
        import serial
    except ImportError:
        print(f"{RED}Error:{RESET} 'pyserial' package is not installed.")
        print("To monitor via local USB serial, run: pip install pyserial")
        sys.exit(1)

    print(f"Opening USB Serial port {port} at {baud_rate} baud...")
    try:
        ser = serial.Serial(port, baud_rate, timeout=2)
        print(f"{GREEN}Connected to {port}! Waiting for ESP32 JSON telemetry...{RESET}")
        time.sleep(1)

        while True:
            line = ser.readline().decode("utf-8", errors="replace").strip()
            if line.startswith("{") and line.endswith("}"):
                try:
                    payload = json.loads(line)
                    veh_id = payload.get("vehicle_id", "ESP32-NODE")
                    sim_data = {
                        "vehicles": {veh_id: payload},
                        "alerts": {}
                    }
                    display_dashboard(sim_data, f"ESP32 Serial ({port})")
                except json.JSONDecodeError:
                    pass
            elif line:
                # Raw serial diagnostic print
                print(f"{GRAY}[ESP32 Serial]{RESET} {line}")
    except KeyboardInterrupt:
        print(f"\n{GREEN}Serial monitoring stopped by user.{RESET}")
        sys.exit(0)
    except Exception as e:
        print(f"{RED}Serial communication error:{RESET} {e}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="CityFleet IoT Pollution Monitoring Live Terminal Station")
    parser.add_argument("--demo", action="store_true", help="Force Alva's Institute demonstration simulation mode")
    parser.add_argument("--serial", type=str, metavar="PORT", help="Monitor directly via USB serial port (e.g. /dev/ttyUSB0)")
    parser.add_argument("--baud", type=int, default=115200, help="Serial baud rate (default: 115200)")
    parser.add_argument("--url", type=str, default=DEFAULT_FIREBASE_URL, help="Firebase RTDB URL")
    parser.add_argument("--auth", type=str, default=os.getenv("FIREBASE_AUTH", ""), help="Firebase database secret / auth token")
    parser.add_argument("--interval", type=float, default=2.0, help="Polling interval in seconds (default: 2.0)")

    args = parser.parse_args()

    # Mode 1: Serial Port Direct
    if args.serial:
        run_serial_monitor(args.serial, args.baud)
        return

    # Mode 2: Demonstration Simulation
    if args.demo:
        try:
            while True:
                display_dashboard(DEMO_FIXTURE, "Demo Simulation (Alva's Institute, Moodbidri)")
                time.sleep(args.interval)
        except KeyboardInterrupt:
            print(f"\n{GREEN}Monitoring stopped by user.{RESET}")
            sys.exit(0)

    # Mode 3: Cloud Realtime Database Polling
    print(f"Connecting to Firebase RTDB ({args.url})...")
    try:
        while True:
            cloud_data = fetch_cloud_data(args.url, args.auth)
            # If 401 or connection error and no vehicles, fallback to demo display with notice
            if "error" in cloud_data:
                display_dashboard(cloud_data, "Firebase Cloud (Awaiting Hardware / Access)")
            else:
                display_dashboard(cloud_data, "ESP32 -> Firebase RTDB Cloud Stream")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print(f"\n{GREEN}Monitoring stopped by user.{RESET}")
        sys.exit(0)

if __name__ == "__main__":
    main()
