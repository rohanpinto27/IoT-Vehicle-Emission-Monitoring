// Firebase configuration
export const firebaseConfig = {
    apiKey: "AIzaSyAyJWZw-yYP9jiy-hhPk7OwazCTqs4-YZI",
    authDomain: "pollutionmonitoring-4156-69176.firebaseapp.com",
    databaseURL: "https://pollutionmonitoring-4156-69176-default-rtdb.firebaseio.com",
    projectId: "pollutionmonitoring-4156-69176",
    storageBucket: "pollutionmonitoring-4156-69176.firebasestorage.app",
    messagingSenderId: "1026339122896",
    appId: "1:1026339122896:web:5e699be8ba0a7fb60df8d5",
    measurementId: "G-S2JRQTFMHC"
};

// Thresholds for CO2 air quality (PPM)
export const THRESHOLDS = {
    NORMAL: 1000,    // PPM (Good/Healthy)
    MODERATE: 2000,  // PPM (Moderate / Caution)
    CRITICAL: 2500   // PPM (High / Hazardous)
};

// Map configuration (Default Bangalore coordinates)
export const MAP_CONFIG = {
    center: [12.9716, 77.5946],
    zoom: 13,
    tileLayer: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
};