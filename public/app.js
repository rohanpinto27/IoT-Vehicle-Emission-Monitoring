// ==========================================================================
// CityFleet IoT Pollution Monitoring — Real-Time Frontend Controller
// Pure Native Client (Zero External SDK Blocking / Compatible with Brave & All Browsers)
// ==========================================================================

const RTDB_BASE_URL = "https://pollutionmonitoring-4156-69176-default-rtdb.firebaseio.com";

const THRESHOLDS = {
    NORMAL: 1000,
    MODERATE: 2000,
    CRITICAL: 2500
};

const MAP_CONFIG = {
    center: [12.9716, 77.5946],
    zoom: 13,
    tileLayer: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
};

// Global State
let map = null;
let vehicleMarkers = {};
let heatLayer = null;
let chart = null;

let selectedVehicle = "KA01-5522";
let fleetData = {};
let alertsData = {};
let heatmapVisible = true;
let audioAlertsEnabled = true;
let activeChartMetric = "co2"; // 'co2' | 'temp' | 'humidity'
let lastPacketTimestamp = Date.now();

const chartHistory = {
    labels: [],
    co2: [],
    temp: [],
    humidity: []
};

/* ---------------- INITIALIZATION ---------------- */
function initDashboard() {
    console.log("Initializing CityFleet Dashboard...");
    initLeafletMap();
    initChart();
    setupUIControls();
    startHeartbeatTimer();

    // 1. Immediate fetch
    fetchLiveData();

    // 2. High-frequency 1.5s real-time polling loop
    setInterval(fetchLiveData, 1500);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDashboard);
} else {
    initDashboard();
}

/* ---------------- DATA FETCHING ---------------- */
async function fetchLiveData() {
    try {
        // Parallel fetch for optimal performance
        const [vehiclesRes, alertsRes] = await Promise.all([
            fetch(`${RTDB_BASE_URL}/vehicles.json?t=${Date.now()}`),
            fetch(`${RTDB_BASE_URL}/alerts.json?t=${Date.now()}`)
        ]);

        if (vehiclesRes.ok) {
            const vData = await vehiclesRes.json();
            if (vData && typeof vData === 'object') {
                fleetData = vData;
                lastPacketTimestamp = Date.now();

                renderFleetList(vData);
                renderKpis(vData);
                renderMapTelemetry(vData);

                if (!selectedVehicle || !vData[selectedVehicle]) {
                    selectedVehicle = Object.keys(vData)[0] || "KA01-5522";
                }

                if (vData[selectedVehicle]) {
                    renderSelectedVehicleTelemetry(vData[selectedVehicle], selectedVehicle);
                    pushChartTelemetry(vData[selectedVehicle]);
                }
            }
        }

        if (alertsRes.ok) {
            const aData = await alertsRes.json();
            if (aData && typeof aData === 'object') {
                alertsData = aData;
                renderAlerts(aData);
            }
        }
    } catch (err) {
        console.warn("Live telemetry fetch warning:", err);
    }
}

/* ---------------- LEAFLET MAP ---------------- */
function initLeafletMap() {
    try {
        if (typeof L === "undefined") {
            console.warn("Leaflet script not yet ready, retrying in 400ms...");
            setTimeout(initLeafletMap, 400);
            return;
        }

        const mapElem = document.getElementById("map");
        if (!mapElem || map) return;

        map = L.map("map", {
            center: MAP_CONFIG.center,
            zoom: MAP_CONFIG.zoom,
            zoomControl: true
        });

        L.tileLayer(MAP_CONFIG.tileLayer, {
            attribution: MAP_CONFIG.attribution,
            maxZoom: 19
        }).addTo(map);

        if (typeof L.heatLayer === "function") {
            heatLayer = L.heatLayer([], {
                radius: 30,
                blur: 20,
                maxZoom: 17,
                gradient: { 0.2: '#10b981', 0.5: '#f59e0b', 0.8: '#ef4444' }
            }).addTo(map);
        }

        // Trigger map resize calculation
        setTimeout(() => map && map.invalidateSize(), 500);

    } catch (err) {
        console.error("Map initialization error:", err);
    }
}

/* ---------------- CHART.JS ---------------- */
function initChart() {
    try {
        if (typeof Chart === "undefined") {
            console.warn("Chart.js script not yet ready, retrying in 400ms...");
            setTimeout(initChart, 400);
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
                animation: { duration: 200 },
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
                            maxTicksLimit: 8
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
        console.error("Chart initialization error:", err);
    }
}

/* ---------------- RENDER TELEMETRY & KPIS ---------------- */
function renderFleetList(vehicles) {
    const list = document.getElementById("vehicleList");
    if (!list) return;
    list.innerHTML = "";

    Object.keys(vehicles).forEach(id => {
        const v = vehicles[id];
        const status = getAqiStatus(v.co2_ppm || 0);

        const li = document.createElement("li");
        li.className = `vehicle-item ${id === selectedVehicle ? 'active' : ''}`;
        li.innerHTML = `
            <div>
                <div class="vehicle-id">${id}</div>
                <div style="font-size:11px; color:#64748b;">${v.co2_ppm || 0} PPM &bull; ${v.temperature != null ? Number(v.temperature).toFixed(1) + '°C' : '--'}</div>
            </div>
            <span class="vehicle-status-badge status-${status.class}">${status.label}</span>
        `;

        li.onclick = () => {
            selectedVehicle = id;
            renderFleetList(vehicles);
            renderSelectedVehicleTelemetry(vehicles[id], id);
            centerVehicleOnMap(vehicles[id]);
        };

        list.appendChild(li);
    });

    const fleetBadge = document.getElementById("fleetBadge");
    if (fleetBadge) {
        fleetBadge.textContent = `${Object.keys(vehicles).length} Active`;
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
        if (v.co2_ppm) {
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
        statusSub.textContent = `Fleet Status: ${avgStatus.label}`;
        statusSub.style.color = avgStatus.color;
    }

    if (latestTemp != null) {
        const kpiTemp = document.getElementById("kpiTemp");
        if (kpiTemp) kpiTemp.innerHTML = `${Number(latestTemp).toFixed(1)} <small>°C</small>`;
    }
    if (latestHumidity != null) {
        const kpiHumidity = document.getElementById("kpiHumidity");
        if (kpiHumidity) kpiHumidity.innerHTML = `${Math.round(latestHumidity)} <small>%</small>`;
    }
}

function renderSelectedVehicleTelemetry(v, id) {
    const ppm = v.co2_ppm || 0;
    const aqi = getAqiStatus(ppm);

    const vehNum = document.getElementById("vehicleNumber");
    if (vehNum) vehNum.textContent = id;

    const co2Lvl = document.getElementById("co2Level");
    if (co2Lvl) co2Lvl.textContent = ppm;

    const emPerKm = document.getElementById("emissionPerKm");
    if (emPerKm) emPerKm.innerHTML = `${v.emission_per_km || (ppm / 200).toFixed(2)} <small>g/km</small>`;

    const totEm = document.getElementById("totalEmission");
    if (totEm) totEm.innerHTML = `${v.total_emission || 0} <small>g</small>`;

    const nodeT = document.getElementById("nodeTemp");
    if (nodeT) nodeT.innerHTML = `${v.temperature != null ? Number(v.temperature).toFixed(1) : '--'} <small>°C</small>`;

    const nodeH = document.getElementById("nodeHumidity");
    if (nodeH) nodeH.innerHTML = `${v.humidity != null ? Math.round(v.humidity) : '--'} <small>%</small>`;

    const lat = v.latitude ? Number(v.latitude).toFixed(4) : "12.9716";
    const lng = v.longitude ? Number(v.longitude).toFixed(4) : "77.5946";
    const gpsCoord = document.getElementById("gpsCoordinates");
    if (gpsCoord) gpsCoord.textContent = `Lat: ${lat} | Lng: ${lng}`;

    const statusBadge = document.getElementById("vehicleStatusBadge");
    if (statusBadge) {
        statusBadge.textContent = aqi.label;
        statusBadge.className = `status-tag status-${aqi.class}`;
    }

    const aqiCategory = document.getElementById("aqiCategory");
    if (aqiCategory) {
        aqiCategory.textContent = aqi.label;
        aqiCategory.className = `gauge-quality status-${aqi.class}`;
    }

    const percent = Math.min(Math.max((ppm / 2800) * 280, 20), 280);
    const gauge = document.getElementById("gaugeCircle");
    if (gauge) {
        gauge.style.background = `conic-gradient(${aqi.color} 0deg ${percent}deg, #e2e8f0 ${percent}deg 360deg)`;
    }
}

/* ---------------- CHART UPDATER ---------------- */
function pushChartTelemetry(v) {
    if (!v) return;

    const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    chartHistory.labels.push(timeLabel);
    chartHistory.co2.push(v.co2_ppm || 0);
    chartHistory.temp.push(v.temperature != null ? Number(v.temperature) : 25);
    chartHistory.humidity.push(v.humidity != null ? Number(v.humidity) : 50);

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

/* ---------------- MAP TELEMETRY & HEATMAP ---------------- */
function renderMapTelemetry(vehicles) {
    if (!map) return;

    const heatPoints = [];

    Object.keys(vehicles).forEach(id => {
        const v = vehicles[id];
        if (!v.latitude || !v.longitude) return;

        const lat = Number(v.latitude);
        const lng = Number(v.longitude);
        const ppm = v.co2_ppm || 400;

        const intensity = Math.min(ppm / 2500, 1.0);
        heatPoints.push([lat, lng, intensity]);

        if (!vehicleMarkers[id]) {
            const customIcon = L.divIcon({
                className: "custom-map-icon",
                html: `<div class="leaflet-vehicle-marker" id="marker-${id}"></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
            marker.bindPopup(`
                <div style="font-family:'Plus Jakarta Sans',sans-serif; padding:4px;">
                    <strong style="font-size:14px;">🚚 ${id}</strong><br>
                    <strong>CO₂:</strong> ${ppm} PPM<br>
                    <strong>Temp:</strong> ${v.temperature != null ? Number(v.temperature).toFixed(1) + '°C' : '--'}<br>
                    <strong>Humidity:</strong> ${v.humidity != null ? Math.round(v.humidity) + '%' : '--'}<br>
                    <strong>Status:</strong> ${v.status || 'Normal'}
                </div>
            `);

            marker.on('click', () => {
                selectedVehicle = id;
                renderFleetList(vehicles);
                renderSelectedVehicleTelemetry(v, id);
            });

            vehicleMarkers[id] = marker;
        } else {
            vehicleMarkers[id].setLatLng([lat, lng]);
            const popup = vehicleMarkers[id].getPopup();
            if (popup) {
                popup.setContent(`
                    <div style="font-family:'Plus Jakarta Sans',sans-serif; padding:4px;">
                        <strong style="font-size:14px;">🚚 ${id}</strong><br>
                        <strong>CO₂:</strong> ${ppm} PPM<br>
                        <strong>Temp:</strong> ${v.temperature != null ? Number(v.temperature).toFixed(1) + '°C' : '--'}<br>
                        <strong>Humidity:</strong> ${v.humidity != null ? Math.round(v.humidity) + '%' : '--'}<br>
                        <strong>Status:</strong> ${v.status || 'Normal'}
                    </div>
                `);
            }
        }
    });

    if (heatLayer) {
        heatLayer.setLatLngs(heatPoints);
    }
}

function centerVehicleOnMap(v) {
    if (!map || !v || !v.latitude || !v.longitude) return;
    map.flyTo([Number(v.latitude), Number(v.longitude)], 15, { animate: true, duration: 1 });
}

/* ---------------- ALERTS FEED ---------------- */
function renderAlerts(alerts) {
    const tbody = document.getElementById("alertsBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const alertList = Object.values(alerts).reverse();
    const countElem = document.getElementById("alertCount");
    if (countElem) countElem.textContent = alertList.length;

    const badgeElem = document.getElementById("alertCounterBadge");
    if (badgeElem) badgeElem.textContent = `${alertList.length} Incidents Logged`;

    if (alertList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">No alerts recorded. All systems within safe parameters.</td></tr>`;
        return;
    }

    let hasCritical = false;

    alertList.forEach(a => {
        const aqi = getAqiStatus(a.co2 || 1200);
        if (a.status === "High" || (a.co2 && a.co2 > THRESHOLDS.MODERATE)) {
            hasCritical = true;
        }

        const dateStr = a.time ? new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now';

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${a.vehicle || 'Unknown'}</strong></td>
            <td><strong>${a.co2 || '--'}</strong> PPM</td>
            <td>${dateStr}</td>
            <td><code>${a.location || '12.9716, 77.5946'}</code></td>
            <td><span class="status-tag status-${aqi.class}">${a.status || aqi.label}</span></td>
            <td><small>${a.note || 'Automatic threshold trigger'}</small></td>
        `;
        tbody.appendChild(tr);
    });

    if (hasCritical && audioAlertsEnabled) {
        playAlertChime();
    }
}

/* ---------------- AUDIO ALERT SYNTHESIZER ---------------- */
function playAlertChime() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const audioCtx = new AudioCtx();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
        // Ignore audio errors
    }
}

/* ---------------- UI CONTROLS ---------------- */
function setupUIControls() {
    document.getElementById("refreshBtn")?.addEventListener("click", () => {
        fetchLiveData();
    });

    document.querySelectorAll(".chart-tab").forEach(tab => {
        tab.addEventListener("click", (e) => {
            document.querySelectorAll(".chart-tab").forEach(t => t.classList.remove("active"));
            e.target.classList.add("active");
            activeChartMetric = e.target.getAttribute("data-chart");
            updateChartDisplay();
        });
    });

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

    document.getElementById("audioToggleBtn")?.addEventListener("click", () => {
        audioAlertsEnabled = !audioAlertsEnabled;
        const txt = document.getElementById("audioStateText");
        if (txt) txt.textContent = audioAlertsEnabled ? "ON" : "MUTED";
    });

    document.getElementById("recenterMapBtn")?.addEventListener("click", () => {
        if (fleetData[selectedVehicle]) {
            centerVehicleOnMap(fleetData[selectedVehicle]);
        } else if (map) {
            map.setView(MAP_CONFIG.center, MAP_CONFIG.zoom);
        }
    });

    document.getElementById("downloadCSV")?.addEventListener("click", (e) => {
        e.preventDefault();
        exportFleetCSV();
    });

    document.getElementById("downloadJSON")?.addEventListener("click", (e) => {
        e.preventDefault();
        exportFleetJSON();
    });
}

function exportFleetCSV() {
    let csv = "Vehicle_ID,CO2_PPM,Temperature_C,Humidity_Pct,Emission_per_km,Total_Emission,Latitude,Longitude,Status,Timestamp\n";
    Object.keys(fleetData).forEach(id => {
        const v = fleetData[id];
        csv += `${id},${v.co2_ppm || 0},${v.temperature || ''},${v.humidity || ''},${v.emission_per_km || ''},${v.total_emission || ''},${v.latitude || ''},${v.longitude || ''},${v.status || ''},${v.timestamp || ''}\n`;
    });

    downloadFile(csv, "text/csv", `cityfleet_pollution_${Date.now()}.csv`);
}

function exportFleetJSON() {
    const jsonStr = JSON.stringify(fleetData, null, 2);
    downloadFile(jsonStr, "application/json", `cityfleet_pollution_${Date.now()}.json`);
}

function downloadFile(content, mimeType, filename) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/* ---------------- HEARTBEAT TIMER ---------------- */
function startHeartbeatTimer() {
    setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - lastPacketTimestamp) / 1000);
        const timerElem = document.getElementById("lastSyncTimer");
        if (timerElem) {
            if (elapsedSec < 3) {
                timerElem.textContent = "Updated: Just now";
            } else {
                timerElem.textContent = `Updated: ${elapsedSec}s ago`;
            }
        }
    }, 1000);
}

/* ---------------- AQI HELPER ---------------- */
function getAqiStatus(ppm) {
    if (ppm <= THRESHOLDS.NORMAL) {
        return { label: "Good Air", class: "normal", color: "#10b981" };
    }
    if (ppm <= THRESHOLDS.MODERATE) {
        return { label: "Moderate", class: "moderate", color: "#f59e0b" };
    }
    return { label: "High / Alert", class: "high", color: "#ef4444" };
}
