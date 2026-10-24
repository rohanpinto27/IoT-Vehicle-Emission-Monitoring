// ==============================================================================
// CityFleet IoT Pollution Monitoring — Frontend Controller (Module)
// Native browser implementation (Zero SDK dependencies, Brave/Privacy compatible)
// ==============================================================================

import {
    RTDB_BASE_URL,
    THRESHOLDS,
    DEMO_LOCATION,
    MAP_CONFIG,
    POLLING_INTERVAL_MS,
    STALE_THRESHOLD_MS,
    DEMO_FIXTURE
} from './config.js';

// Global Application State
let map = null;
let vehicleMarkers = {};
let heatLayer = null;
let chart = null;

let selectedVehicle = "KA01-5522";
let fleetData = {};
let alertsData = {};
let isDemoSimulation = false;
let heatmapVisible = true;
let audioAlertsEnabled = true;
let activeChartMetric = "co2"; // 'co2' | 'temp' | 'humidity'
let lastPacketTimestamp = Date.now();
const processedAlertIds = new Set();

const chartHistory = {
    labels: [],
    co2: [],
    temp: [],
    humidity: []
};

/* -------------------------------------------------------------------------- */
/* Initialization                                                             */
/* -------------------------------------------------------------------------- */
function initDashboard() {
    console.log("[CityFleet] Initializing IoT Pollution Monitoring Dashboard...");
    initLeafletMap();
    initChart();
    setupUIControls();
    startHeartbeatTimer();

    // Initial fetch, then periodic polling
    fetchLiveData();
    setInterval(fetchLiveData, POLLING_INTERVAL_MS);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDashboard);
} else {
    initDashboard();
}

/* -------------------------------------------------------------------------- */
/* Data Fetching & Sync Engine                                                */
/* -------------------------------------------------------------------------- */
async function fetchLiveData() {
    // If user explicitly toggled offline demo mode
    if (isDemoSimulation) {
        applyTelemetryPayload(DEMO_FIXTURE.vehicles, DEMO_FIXTURE.alerts, true);
        return;
    }

    try {
        const [vehiclesRes, alertsRes] = await Promise.all([
            fetch(`${RTDB_BASE_URL}/vehicles.json?t=${Date.now()}`),
            fetch(`${RTDB_BASE_URL}/alerts.json?t=${Date.now()}`)
        ]);

        if (vehiclesRes.status === 401 || !vehiclesRes.ok) {
            const errDetail = (vehiclesRes.status === 401)
                ? "access is restricted (HTTP 401)"
                : `server returned HTTP ${vehiclesRes.status}`;
            console.warn(`[Firebase] HTTP ${vehiclesRes.status} Error. Switched to Demo Fixture.`);
            showSystemBanner("warning", `Firebase Realtime Database ${errDetail}. Switched to simulated telemetry fixture (Mijar, Moodbidri).`);
            applyTelemetryPayload(DEMO_FIXTURE.vehicles, DEMO_FIXTURE.alerts, true);
            return;
        }

        const vData = await vehiclesRes.json();
        const aData = alertsRes.ok ? await alertsRes.json() : {};

        if (vData && vData.error) {
            console.warn(`[Firebase] RTDB Error: ${vData.error}`);
            showSystemBanner("warning", `Firebase Realtime Database error: ${vData.error}. Switched to simulated telemetry fixture (Mijar, Moodbidri).`);
            applyTelemetryPayload(DEMO_FIXTURE.vehicles, DEMO_FIXTURE.alerts, true);
            return;
        }

        if (vData && typeof vData === 'object' && Object.keys(vData).length > 0) {
            showSystemBanner("live", "Connected to Live Firebase Cloud Stream. Receiving hardware telemetry.");
            applyTelemetryPayload(vData, aData || {}, false);
        } else {
            // Empty database
            showSystemBanner("info", "Connected to Firebase, but no active vehicle telemetry found. Loaded Demo Fixture.");
            applyTelemetryPayload(DEMO_FIXTURE.vehicles, DEMO_FIXTURE.alerts, true);
        }
    } catch (err) {
        console.warn("[CityFleet] Network/CORS error reaching Firebase:", err);
        showSystemBanner("warning", "Unable to reach Firebase cloud. Operating in simulated telemetry mode (Mijar, Moodbidri).");
        applyTelemetryPayload(DEMO_FIXTURE.vehicles, DEMO_FIXTURE.alerts, true);
    }
}

let currentIsSimulated = false;
let initialMapCentered = false;

function updateHeaderStatus(isSimulated) {
    currentIsSimulated = Boolean(isSimulated);
    const pill = document.getElementById("systemLivePill");
    const dot = document.getElementById("systemLiveDot");
    const text = document.getElementById("systemLiveText");
    const demoBtn = document.getElementById("toggleDemoModeBtn");

    if (currentIsSimulated) {
        if (pill) pill.className = "live-pill demo-pill";
        if (dot) dot.className = "demo-dot";
        if (text) text.textContent = "Demo Mode (Fixture)";
        if (demoBtn) {
            demoBtn.textContent = "⚡ Mode: Demo Fixture";
            demoBtn.className = "btn btn-secondary";
        }
    } else {
        if (pill) pill.className = "live-pill";
        if (dot) dot.className = "pulse-dot";
        if (text) text.textContent = "Live Cloud Stream";
        if (demoBtn) {
            demoBtn.textContent = "☁️ Mode: Live Cloud";
            demoBtn.className = "btn btn-primary";
        }
    }
}

function applyTelemetryPayload(vehicles, alerts, isSimulated) {
    fleetData = vehicles || {};
    alertsData = alerts || {};
    lastPacketTimestamp = Date.now();
    currentIsSimulated = Boolean(isSimulated);

    updateHeaderStatus(currentIsSimulated);
    renderFleetList(fleetData, currentIsSimulated);
    renderKpis(fleetData);
    renderMapTelemetry(fleetData, currentIsSimulated);

    if (!selectedVehicle || !fleetData[selectedVehicle]) {
        selectedVehicle = Object.keys(fleetData)[0] || "KA01-5522";
    }

    if (fleetData[selectedVehicle]) {
        renderSelectedVehicleTelemetry(fleetData[selectedVehicle], selectedVehicle, currentIsSimulated);
        pushChartTelemetry(fleetData[selectedVehicle], selectedVehicle);
        if (!initialMapCentered && map) {
            centerVehicleOnMap(fleetData[selectedVehicle]);
            initialMapCentered = true;
        }
    }

    renderAlerts(alertsData);
}

/* -------------------------------------------------------------------------- */
/* UI Banner Manager                                                          */
/* -------------------------------------------------------------------------- */
function showSystemBanner(type, message) {
    const banner = document.getElementById("systemBanner");
    const msgElem = document.getElementById("systemBannerText");
    if (!banner || !msgElem) return;

    banner.className = `system-banner system-banner-${type}`;
    msgElem.innerHTML = message;
}

/* -------------------------------------------------------------------------- */
/* Leaflet Map & Heatmap Controller                                           */
/* -------------------------------------------------------------------------- */
function initLeafletMap() {
    try {
        if (typeof L === "undefined") {
            setTimeout(initLeafletMap, 300);
            return;
        }

        const mapElem = document.getElementById("map");
        if (!mapElem || map) return;

        map = L.map("map", {
            center: DEMO_LOCATION.center,
            zoom: DEMO_LOCATION.zoom,
            zoomControl: true
        });

        L.tileLayer(MAP_CONFIG.tileLayer, {
            attribution: MAP_CONFIG.attribution,
            maxZoom: 19
        }).addTo(map);

        if (typeof L.heatLayer === "function") {
            heatLayer = L.heatLayer([], {
                radius: 32,
                blur: 22,
                maxZoom: 17,
                gradient: { 0.2: '#10b981', 0.5: '#f59e0b', 0.8: '#ef4444' }
            }).addTo(map);
        }

        setTimeout(() => map && map.invalidateSize(), 400);
    } catch (err) {
        console.error("[Map] Init error:", err);
    }
}

/**
 * Returns a clean, professional location label for vehicles without exposing
 * internal or implementation-oriented labels.
 */
export function getCleanLocationLabel(v) {
    if (v.gps_valid === true && v.location_source === "gps") {
        return "Live GPS Fix";
    }
    const label = v.location_label || "";
    if (v.location_source === "demo_fallback" || 
        label.includes("AIET") || 
        label.includes("Demo") || 
        label.includes("Indoor") ||
        !label ||
        (v.latitude && Math.abs(Number(v.latitude) - 13.0236) < 0.005)) {
        return "Mijar, Moodbidri";
    }
    return label;
}

function renderMapTelemetry(vehicles, isSimulated = false) {
    if (!map) return;

    const heatPoints = [];

    Object.keys(vehicles).forEach(id => {
        const v = vehicles[id];
        if (!v.latitude || !v.longitude) return;

        const lat = Number(v.latitude);
        const lng = Number(v.longitude);

        // Discard invalid (0,0) coordinates
        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

        const ppm = v.co2_ppm || 400;
        const intensity = Math.min(Math.max(ppm / 2500, 0.2), 1.0);
        heatPoints.push([lat, lng, intensity]);

        const aqi = getAqiStatus(ppm);
        const isLiveGps = (v.gps_valid === true && v.location_source === "gps");
        const cleanLoc = getCleanLocationLabel(v);
        const locationTag = isLiveGps 
            ? `<span class="gps-pill gps-live">📡 Live GPS Fix</span>` 
            : `<span class="gps-pill gps-demo">📍 ${cleanLoc}</span>`;

        const isNodeSimulated = isSimulated || Boolean(v.is_simulated);
        const sourcePill = isNodeSimulated
            ? `<span class="gps-pill gps-demo" style="background:#f3e8ff; color:#7e22ce; border-color:#e9d5ff;">🧪 Demo Fixture</span>`
            : `<span class="gps-pill gps-live">🟢 Live Cloud Stream</span>`;

        const popupContent = `
            <div style="font-family:'Plus Jakarta Sans',sans-serif; min-width:180px; padding:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <strong style="font-size:14px; color:#0f172a;">🚚 ${id}</strong>
                    <span class="status-badge status-${aqi.class}">${aqi.label}</span>
                </div>
                <div style="font-size:12px; color:#475569; line-height:1.6;">
                    <strong>Source:</strong> ${sourcePill}<br>
                    <strong>CO₂ Air Quality:</strong> ${ppm} PPM<br>
                    <strong>Temperature:</strong> ${v.temperature != null ? Number(v.temperature).toFixed(1) + '°C' : '--'}<br>
                    <strong>Humidity:</strong> ${v.humidity != null ? Math.round(v.humidity) + '%' : '--'}<br>
                    <strong>Location:</strong> ${locationTag}
                </div>
            </div>
        `;

        if (!vehicleMarkers[id]) {
            const customIcon = L.divIcon({
                className: "custom-map-icon",
                html: `<div class="leaflet-vehicle-marker" id="marker-${id}"></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
            marker.bindPopup(popupContent);
            marker.on('click', () => {
                selectedVehicle = id;
                renderFleetList(vehicles);
                renderSelectedVehicleTelemetry(v, id);
            });

            vehicleMarkers[id] = marker;
        } else {
            vehicleMarkers[id].setLatLng([lat, lng]);
            const popup = vehicleMarkers[id].getPopup();
            if (popup) popup.setContent(popupContent);
        }
    });

    if (heatLayer) {
        heatLayer.setLatLngs(heatPoints);
    }
}

function centerVehicleOnMap(v) {
    if (!map || !v || !v.latitude || !v.longitude) return;
    const lat = Number(v.latitude);
    const lng = Number(v.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
        map.flyTo([lat, lng], 15, { animate: true, duration: 0.8 });
    }
}

/* -------------------------------------------------------------------------- */
/* Chart.js Time-Series Engine                                                */
/* -------------------------------------------------------------------------- */
function initChart() {
    try {
        if (typeof Chart === "undefined") {
            setTimeout(initChart, 300);
            return;
        }

        const ctx = document.getElementById("co2Chart")?.getContext("2d");
        if (!ctx || chart) return;

        const gradient = ctx.createLinearGradient(0, 0, 0, 260);
        gradient.addColorStop(0, "rgba(37, 99, 235, 0.35)");
        gradient.addColorStop(1, "rgba(37, 99, 235, 0.0)");

        chart = new Chart(ctx, {
            type: "line",
            data: {
                labels: [],
                datasets: [{
                    label: "CO₂ Level (PPM)",
                    data: [],
                    borderColor: "#2563eb",
                    backgroundColor: gradient,
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: "#2563eb"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 250 },
                interaction: { intersect: false, mode: 'index' },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: { color: "rgba(226, 232, 240, 0.7)" },
                        ticks: {
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
                            color: "#64748b"
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
                            color: "#64748b",
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 7
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "rgba(15, 23, 42, 0.9)",
                        titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: '700' },
                        bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
                        padding: 10,
                        cornerRadius: 8
                    }
                }
            }
        });
    } catch (err) {
        console.error("[Chart] Init error:", err);
    }
}

let currentChartVehicle = null;
let lastChartPacketKey = null;

function pushChartTelemetry(v, vehicleId = selectedVehicle) {
    if (!v || !chart) return;

    // Reset rolling chart history if selected vehicle changed
    if (currentChartVehicle !== vehicleId) {
        currentChartVehicle = vehicleId;
        lastChartPacketKey = null;
        chartHistory.labels = [];
        chartHistory.co2 = [];
        chartHistory.temp = [];
        chartHistory.humidity = [];
    }

    // Packet identifier combining timestamp and primary metric values
    const packetKey = `${v.timestamp || v.last_seen || ''}_${v.co2_ppm}_${v.temperature}_${v.humidity}_${v.raw_adc}`;
    if (lastChartPacketKey === packetKey) {
        // Telemetry has not changed since last push; do not add duplicate chart point
        return;
    }
    lastChartPacketKey = packetKey;

    let timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (v.timestamp && typeof v.timestamp === "number" && v.timestamp > 1700000000000) {
        timeLabel = new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    chartHistory.labels.push(timeLabel);
    chartHistory.co2.push(v.co2_ppm || 0);
    chartHistory.temp.push(v.temperature != null ? Number(v.temperature) : null);
    chartHistory.humidity.push(v.humidity != null ? Math.round(Number(v.humidity)) : null);

    // Limit rolling history to 25 items to prevent unbounded memory growth
    if (chartHistory.labels.length > 25) {
        chartHistory.labels.shift();
        chartHistory.co2.shift();
        chartHistory.temp.shift();
        chartHistory.humidity.shift();
    }

    updateChartDisplay();
}

function updateChartDisplay() {
    if (!chart) return;

    chart.data.labels = chartHistory.labels;

    if (activeChartMetric === "co2") {
        chart.data.datasets[0].label = "CO₂ Level (PPM)";
        chart.data.datasets[0].data = chartHistory.co2;
        chart.data.datasets[0].borderColor = "#2563eb";
        chart.data.datasets[0].pointBackgroundColor = "#2563eb";
    } else if (activeChartMetric === "temp") {
        chart.data.datasets[0].label = "Ambient Temperature (°C)";
        chart.data.datasets[0].data = chartHistory.temp;
        chart.data.datasets[0].borderColor = "#f97316";
        chart.data.datasets[0].pointBackgroundColor = "#f97316";
    } else if (activeChartMetric === "humidity") {
        chart.data.datasets[0].label = "Relative Humidity (%)";
        chart.data.datasets[0].data = chartHistory.humidity;
        chart.data.datasets[0].borderColor = "#06b6d4";
        chart.data.datasets[0].pointBackgroundColor = "#06b6d4";
    }

    chart.update();
}

/* -------------------------------------------------------------------------- */
/* Fleet & Telemetry Rendering                                                */
/* -------------------------------------------------------------------------- */
function renderFleetList(vehicles, isSimulated = false) {
    const list = document.getElementById("vehicleList");
    if (!list) return;
    list.innerHTML = "";

    const ids = Object.keys(vehicles);
    let onlineCount = 0;

    ids.forEach(id => {
        const v = vehicles[id];
        const aqi = getAqiStatus(v.co2_ppm || 0);
        const freshness = getDeviceFreshness(v, isSimulated);
        if (freshness.state === "live") onlineCount++;

        const isLiveGps = (v.gps_valid === true && v.location_source === "gps");
        const cleanLoc = getCleanLocationLabel(v);
        const gpsBadge = isLiveGps
            ? `<span class="gps-pill gps-live" style="font-size:10px; padding:1px 6px;">GPS</span>`
            : `<span class="gps-pill gps-demo" style="font-size:10px; padding:1px 6px;">${cleanLoc}</span>`;

        const freshnessColor = (freshness.state === "demo") ? "#a855f7" : (freshness.state === "live" ? "#10b981" : (freshness.state === "stale" ? "#f59e0b" : "#ef4444"));

        const li = document.createElement("li");
        li.className = `vehicle-item ${id === selectedVehicle ? 'active' : ''}`;
        li.innerHTML = `
            <div>
                <div style="display:flex; align-items:center; gap:6px;">
                    <span class="v-id">${id}</span>
                    ${gpsBadge}
                </div>
                <div class="v-sub">${v.co2_ppm || 0} PPM &bull; ${v.temperature != null ? Number(v.temperature).toFixed(1) + '°C' : '--'}</div>
            </div>
            <div style="text-align:right;">
                <span class="status-badge status-${aqi.class}">${aqi.label}</span>
                <div style="font-size:10px; color:${freshnessColor}; margin-top:3px; font-weight:700;">${freshness.label}</div>
            </div>
        `;

        li.onclick = () => {
            selectedVehicle = id;
            renderFleetList(vehicles, isSimulated);
            renderSelectedVehicleTelemetry(vehicles[id], id, isSimulated);
            pushChartTelemetry(vehicles[id], id);
            centerVehicleOnMap(vehicles[id]);
        };

        list.appendChild(li);
    });

    const fleetBadge = document.getElementById("fleetBadge");
    if (fleetBadge) {
        if (isSimulated) {
            fleetBadge.textContent = `${ids.length} Demo Nodes`;
        } else {
            fleetBadge.textContent = `${onlineCount} / ${ids.length} Online`;
        }
    }
}

function renderKpis(vehicles) {
    const ids = Object.keys(vehicles);
    const count = ids.length;

    const countElem = document.getElementById("vehicleCount");
    if (countElem) countElem.textContent = count;

    let totalPpm = 0;
    let validPpmCount = 0;
    let latestTemp = null;
    let latestHumidity = null;

    ids.forEach(id => {
        const v = vehicles[id];
        if (v.co2_ppm != null) {
            totalPpm += Number(v.co2_ppm);
            validPpmCount++;
        }
        if (v.temperature != null) latestTemp = v.temperature;
        if (v.humidity != null) latestHumidity = v.humidity;
    });

    const avgPpm = validPpmCount > 0 ? Math.round(totalPpm / validPpmCount) : 0;
    const avgElem = document.getElementById("avgEmission");
    if (avgElem) avgElem.innerHTML = `${avgPpm} <small>PPM</small>`;

    const avgStatus = getAqiStatus(avgPpm);
    const statusSub = document.getElementById("avgEmissionStatus");
    if (statusSub) {
        statusSub.textContent = `Fleet AQI: ${avgStatus.label}`;
        statusSub.style.color = avgStatus.color;
    }

    const kpiTemp = document.getElementById("kpiTemp");
    if (kpiTemp) {
        kpiTemp.innerHTML = latestTemp != null ? `${Number(latestTemp).toFixed(1)} <small>°C</small>` : `-- <small>°C</small>`;
    }
    const kpiHumidity = document.getElementById("kpiHumidity");
    if (kpiHumidity) {
        kpiHumidity.innerHTML = latestHumidity != null ? `${Math.round(Number(latestHumidity))} <small>%</small>` : `-- <small>%</small>`;
    }
}

function renderSelectedVehicleTelemetry(v, id, isSimulated = false) {
    const ppm = v.co2_ppm || 0;
    const aqi = getAqiStatus(ppm);
    const freshness = getDeviceFreshness(v, isSimulated);
    const isNodeSimulated = isSimulated || Boolean(v.is_simulated);

    const vehNum = document.getElementById("vehicleNumber");
    if (vehNum) vehNum.textContent = id;

    const srcBadge = document.getElementById("telemetrySourceBadge");
    if (srcBadge) {
        if (isNodeSimulated) {
            srcBadge.className = "freshness-badge freshness-demo";
            srcBadge.textContent = "🧪 DEMO FIXTURE";
        } else {
            srcBadge.className = "freshness-badge freshness-live";
            srcBadge.textContent = "🟢 LIVE ESP32";
        }
    }

    const co2Lvl = document.getElementById("co2Level");
    if (co2Lvl) co2Lvl.textContent = ppm;

    const emPerKm = document.getElementById("emissionPerKm");
    if (emPerKm) emPerKm.innerHTML = `${v.emission_per_km || (ppm / 200).toFixed(2)} <small>g/km</small>`;

    const totEm = document.getElementById("totalEmission");
    if (totEm) totEm.innerHTML = `${v.total_emission || 0} <small>g</small>`;

    const nodeT = document.getElementById("nodeTemp");
    if (nodeT) nodeT.innerHTML = `${v.temperature != null ? Number(v.temperature).toFixed(1) : '--'} <small>°C</small>`;

    const nodeH = document.getElementById("nodeHumidity");
    if (nodeH) nodeH.innerHTML = `${v.humidity != null ? Math.round(Number(v.humidity)) : '--'} <small>%</small>`;

    // Raw ADC & Sensor Diagnostic
    const rawAdcElem = document.getElementById("nodeRawADC");
    if (rawAdcElem) rawAdcElem.textContent = v.raw_adc != null ? `ADC: ${v.raw_adc}` : 'ADC: N/A';

    // GPS Details & Coordinates
    const latVal = (v.latitude != null && !isNaN(v.latitude) && Number(v.latitude) !== 0) 
        ? Number(v.latitude) 
        : DEMO_LOCATION.center[0];
    const lngVal = (v.longitude != null && !isNaN(v.longitude) && Number(v.longitude) !== 0) 
        ? Number(v.longitude) 
        : DEMO_LOCATION.center[1];
    const gpsCoord = document.getElementById("gpsCoordinates");
    if (gpsCoord) gpsCoord.textContent = `Lat: ${latVal.toFixed(6)} | Lng: ${lngVal.toFixed(6)}`;

    // GPS Status Banner
    const isLiveGps = (v.gps_valid === true && v.location_source === "gps");
    const gpsSourceElem = document.getElementById("gpsSourceBadge");
    if (gpsSourceElem) {
        if (isLiveGps) {
            gpsSourceElem.className = "gps-pill gps-live";
            gpsSourceElem.innerHTML = "📡 LIVE GPS";
        } else {
            const cleanLoc = getCleanLocationLabel(v);
            if (cleanLoc) {
                gpsSourceElem.className = "gps-pill gps-demo";
                gpsSourceElem.innerHTML = `📍 ${cleanLoc}`;
            } else {
                gpsSourceElem.className = "gps-pill gps-none";
                gpsSourceElem.innerHTML = "⚠️ NO GPS FIX";
            }
        }
    }

    // Status Badges
    const statusBadge = document.getElementById("vehicleStatusBadge");
    if (statusBadge) {
        statusBadge.textContent = aqi.label;
        statusBadge.className = `status-badge status-${aqi.class}`;
    }

    const aqiTag = document.getElementById("aqiCategoryTag");
    if (aqiTag) {
        aqiTag.textContent = aqi.label;
        aqiTag.className = `gauge-tag status-${aqi.class}`;
    }

    // Radial Gauge Conic Gradient
    const percent = Math.min(Math.max((ppm / 2800) * 280, 20), 280);
    const gauge = document.getElementById("gaugeCircle");
    if (gauge) {
        gauge.style.background = `conic-gradient(${aqi.color} 0deg ${percent}deg, #e2e8f0 ${percent}deg 360deg)`;
    }
}

/* -------------------------------------------------------------------------- */
/* Incident Alerts Feed & Acoustic Chimes                                     */
/* -------------------------------------------------------------------------- */
function renderAlerts(alerts) {
    const tbody = document.getElementById("alertsBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const alertEntries = Object.entries(alerts).reverse();
    const countElem = document.getElementById("alertCount");
    if (countElem) countElem.textContent = alertEntries.length;

    const badgeElem = document.getElementById("alertCounterBadge");
    if (badgeElem) badgeElem.textContent = `${alertEntries.length} Incidents Logged`;

    if (alertEntries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">No active alerts recorded. All systems within safe environmental thresholds.</td></tr>`;
        return;
    }

    let newlyTriggeredHighAlert = false;

    alertEntries.forEach(([key, a]) => {
        const aqi = getAqiStatus(a.co2 || 1200);

        // Sound chime only once per unique alert key
        if (!processedAlertIds.has(key)) {
            processedAlertIds.add(key);
            if (a.status === "High" || (a.co2 && a.co2 >= THRESHOLDS.MODERATE)) {
                newlyTriggeredHighAlert = true;
            }
        }

        let dateStr = "Just now";
        if (a.time && typeof a.time === "number" && a.time > 1700000000000) {
            dateStr = new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${a.vehicle || 'Unknown'}</strong></td>
            <td><strong>${a.co2 || '--'}</strong> PPM</td>
            <td>${dateStr}</td>
            <td><code>${a.location || '13.0236, 74.9676'}</code></td>
            <td><span class="status-badge status-${aqi.class}">${a.status || aqi.label}</span></td>
            <td><small>${a.note || 'Automatic threshold breach trigger'}</small></td>
        `;
        tbody.appendChild(tr);
    });

    if (newlyTriggeredHighAlert && audioAlertsEnabled) {
        playAlertChime();
    }
}

function playAlertChime() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35);

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
        // Suppress browser autoplay restrictions
    }
}

/* -------------------------------------------------------------------------- */
/* UI Event Controls & Handlers                                               */
/* -------------------------------------------------------------------------- */
function setupUIControls() {
    // Refresh Button
    document.getElementById("refreshBtn")?.addEventListener("click", () => {
        fetchLiveData();
    });

    // Chart metric tab toggles
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            activeChartMetric = e.target.getAttribute("data-chart");
            updateChartDisplay();
        });
    });

    // Heatmap toggle
    document.getElementById("toggleHeatmapBtn")?.addEventListener("click", () => {
        if (!map || !heatLayer) return;
        heatmapVisible = !heatmapVisible;
        const btn = document.getElementById("toggleHeatmapBtn");
        if (heatmapVisible) {
            map.addLayer(heatLayer);
            btn.classList.remove("btn-secondary");
            btn.classList.add("btn-primary");
        } else {
            map.removeLayer(heatLayer);
            btn.classList.remove("btn-primary");
            btn.classList.add("btn-secondary");
        }
    });

    // Audio alarm toggle
    document.getElementById("audioToggleBtn")?.addEventListener("click", () => {
        audioAlertsEnabled = !audioAlertsEnabled;
        const txt = document.getElementById("audioStateText");
        if (txt) txt.textContent = audioAlertsEnabled ? "ON" : "MUTED";
    });

    // Map recenter button
    document.getElementById("recenterMapBtn")?.addEventListener("click", () => {
        if (fleetData[selectedVehicle]) {
            centerVehicleOnMap(fleetData[selectedVehicle]);
        } else if (map) {
            map.setView(DEMO_LOCATION.center, DEMO_LOCATION.zoom);
        }
    });

    // Demo Mode toggle
    document.getElementById("toggleDemoModeBtn")?.addEventListener("click", () => {
        isDemoSimulation = !isDemoSimulation;
        updateHeaderStatus(isDemoSimulation);
        if (isDemoSimulation) {
            showSystemBanner("info", "Operating in simulated telemetry mode (Mijar, Moodbidri). Showing simulated test fixture.");
        }
        fetchLiveData();
    });

    // CSV & JSON Exports
    document.getElementById("downloadCSVBtn")?.addEventListener("click", exportFleetCSV);
    document.getElementById("downloadJSONBtn")?.addEventListener("click", exportFleetJSON);
}

/* -------------------------------------------------------------------------- */
/* Data Export Modules                                                        */
/* -------------------------------------------------------------------------- */
function exportFleetCSV() {
    let csv = "Vehicle_ID,CO2_PPM,Raw_ADC,Temperature_C,Humidity_Pct,DHT_Valid,Latitude,Longitude,GPS_Valid,Location_Source,Emission_g_per_km,Total_Emission_g,Status,Timestamp\n";
    
    Object.keys(fleetData).forEach(id => {
        const v = fleetData[id];
        csv += `${id},${v.co2_ppm || 0},${v.raw_adc || ''},${v.temperature || ''},${v.humidity || ''},${v.dht_valid != null ? v.dht_valid : ''},${v.latitude || ''},${v.longitude || ''},${v.gps_valid != null ? v.gps_valid : ''},"${v.location_source || ''}",${v.emission_per_km || ''},${v.total_emission || ''},"${v.status || ''}",${v.timestamp || ''}\n`;
    });

    downloadBlob(csv, "text/csv", `cityfleet_telemetry_${Date.now()}.csv`);
}

function exportFleetJSON() {
    const payload = {
        exported_at: new Date().toISOString(),
        location_reference: DEMO_LOCATION.name,
        fleet: fleetData,
        alerts: alertsData
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    downloadBlob(jsonStr, "application/json", `cityfleet_snapshot_${Date.now()}.json`);
}

function downloadBlob(content, mimeType, filename) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------------------- */
/* Diagnostic & Status Helpers                                                */
/* -------------------------------------------------------------------------- */
function startHeartbeatTimer() {
    setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - lastPacketTimestamp) / 1000);
        const timerElem = document.getElementById("lastSyncTimer");
        if (timerElem) {
            timerElem.textContent = (elapsedSec < 3) ? "Updated: Just now" : `Updated: ${elapsedSec}s ago`;
        }
    }, 1000);
}

function getDeviceFreshness(v, isSimulated = false) {
    if (isSimulated || v.is_simulated) {
        return { label: "DEMO FIXTURE", state: "demo" };
    }

    const ts = v.last_seen || v.timestamp;
    if (!ts || typeof ts !== "number" || ts < 1700000000000) {
        return { label: "ONLINE (Uptime)", state: "live" };
    }

    const ageMs = Date.now() - ts;
    if (ageMs < STALE_THRESHOLD_MS) {
        return { label: "LIVE", state: "live" };
    } else if (ageMs < STALE_THRESHOLD_MS * 4) {
        return { label: "STALE", state: "stale" };
    }
    return { label: "OFFLINE", state: "offline" };
}

function getAqiStatus(ppm) {
    if (ppm <= THRESHOLDS.NORMAL) {
        return { label: "Good Air", class: "normal", color: "#10b981" };
    }
    if (ppm <= THRESHOLDS.MODERATE) {
        return { label: "Moderate", class: "moderate", color: "#f59e0b" };
    }
    return { label: "High / Alert", class: "high", color: "#ef4444" };
}
