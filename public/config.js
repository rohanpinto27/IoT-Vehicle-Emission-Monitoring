// ==============================================================================
// CityFleet IoT Pollution Monitoring — Central Frontend Configuration
// ==============================================================================

export const RTDB_BASE_URL = "https://pollutionmonitoring-4156-69176-default-rtdb.firebaseio.com";

// Air Quality PPM Thresholds (MQ-135 / CO2 equivalent)
export const THRESHOLDS = {
    NORMAL: 1000,    // Good / Safe Air (PPM)
    MODERATE: 2000,  // Caution / Moderate Level (PPM)
    CRITICAL: 2500   // High / Hazardous Spike (PPM)
};

// Location Configuration — Mijar, Moodbidri, Karnataka 574225, India
export const DEMO_LOCATION = {
    name: "Mijar, Moodbidri",
    center: [13.023600, 74.967600],
    zoom: 14
};

// Leaflet Map Configuration
export const MAP_CONFIG = {
    center: DEMO_LOCATION.center,
    zoom: DEMO_LOCATION.zoom,
    tileLayer: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
};

// Telemetry Timing & Health
export const POLLING_INTERVAL_MS = 10000; // 10-second cloud polling interval
export const STALE_THRESHOLD_MS  = 25000; // Device considered stale if no packet in 25s

// Fallback Simulation Fixture (Active when Firebase RTDB is restricted or offline)
export const DEMO_FIXTURE = {
    vehicles: {
        "KA01-5522": {
            vehicle_id: "KA01-5522",
            co2_ppm: 820,
            raw_adc: 1140,
            gas_calibrated: false,
            temperature: 28.2,
            humidity: 64.0,
            dht_valid: true,
            latitude: 13.023600,
            longitude: 74.967600,
            gps_valid: false,
            location_source: "demo_fallback",
            location_label: "Mijar, Moodbidri",
            emission_per_km: 4.1,
            total_emission: 28.5,
            status: "Normal",
            timestamp: Date.now() - 2000,
            last_seen: Date.now() - 2000,
            is_simulated: true
        },
        "KA02-8876": {
            vehicle_id: "KA02-8876",
            co2_ppm: 1680,
            raw_adc: 2180,
            gas_calibrated: false,
            temperature: 30.5,
            humidity: 58.0,
            dht_valid: true,
            latitude: 13.025500,
            longitude: 74.969800,
            gps_valid: false,
            location_source: "demo_fallback",
            location_label: "Moodbidri Highway Junction",
            emission_per_km: 8.4,
            total_emission: 59.2,
            status: "Moderate",
            timestamp: Date.now() - 5000,
            last_seen: Date.now() - 5000,
            is_simulated: true
        },
        "KA05-3341": {
            vehicle_id: "KA05-3341",
            co2_ppm: 2620,
            raw_adc: 3410,
            gas_calibrated: false,
            temperature: 33.1,
            humidity: 51.0,
            dht_valid: true,
            latitude: 13.021200,
            longitude: 74.965400,
            gps_valid: false,
            location_source: "demo_fallback",
            location_label: "Industrial Zone Mijar",
            emission_per_km: 13.1,
            total_emission: 104.8,
            status: "High",
            timestamp: Date.now() - 3000,
            last_seen: Date.now() - 3000,
            is_simulated: true
        }
    },
    alerts: {
        "alert_demo_1": {
            vehicle: "KA02-8876",
            co2: 1680,
            time: Date.now() - 180000,
            location: "13.0255, 74.9698",
            status: "Moderate",
            note: "Emission nearing upper threshold"
        },
        "alert_demo_2": {
            vehicle: "KA05-3341",
            co2: 2620,
            time: Date.now() - 60000,
            location: "13.0212, 74.9654",
            status: "High",
            note: "Critical Emission Spike Detected!"
        }
    }
};