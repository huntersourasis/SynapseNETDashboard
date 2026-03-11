// Configuration & State
const COLORS = {
    safe: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    accent: '#3b82f6',
    air: '#8b5cf6', // Purple accent for MQ135
    gridDark: 'rgba(255, 255, 255, 0.05)',
    gridLight: 'rgba(0, 0, 0, 0.05)'
};

let charts = {
    temp: null,
    gas: null,
    air: null
};

// --- 1. Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchData();
    setInterval(fetchData, 2000);
});

// --- 2. Theme Management ---
function initTheme() {
    const toggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    toggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateChartsTheme(); // Force chart colors to update
    });
}

function updateChartsTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? COLORS.gridDark : COLORS.gridLight;
    
    Object.values(charts).forEach(chart => {
        if (chart) {
            chart.options.scales.y.grid.color = gridColor;
            chart.update('none');
        }
    });
}

// --- 3. Data Fetching ---
async function fetchData() {
    try {
        const res = await fetch('/api/history');
        const history = await res.json();
        if (history.length === 0) return;

        const latest = history[history.length - 1];
        updateUI(latest);
        syncCharts(history);
        updateClock();
        
        document.getElementById("connection-text").innerText = "Live Sync";
        document.getElementById("connection-dot").className = "dot pulse-blue";
    } catch (error) {
        console.error("Sync Error:", error);
        document.getElementById("connection-text").innerText = "Offline";
        document.getElementById("connection-dot").className = "dot";
        document.getElementById("connection-dot").style.background = COLORS.danger;
    }
}

// --- 4. UI Rendering ---
function updateUI(latest) {
    document.getElementById("temp").innerText = `${latest.temp.toFixed(1)}°C`;
    document.getElementById("hum").innerText = `${latest.hum.toFixed(1)}%`;
    document.getElementById("mq2").innerText = latest.mq2;
    document.getElementById("mq135").innerText = latest.mq135;
    document.getElementById("vib").innerText = latest.vib > 0.5 ? "⚠ SHAKE" : "STABLE";

    const risk = latest.risk_score || 0;
    const riskPath = document.getElementById("risk-path");
    const riskScoreTxt = document.getElementById("risk-score");
    const statusTxt = document.getElementById("status-text");

    riskPath.style.strokeDasharray = `${risk}, 100`;
    riskScoreTxt.innerText = `${Math.round(risk)}%`;
    statusTxt.innerText = latest.status.toUpperCase();

    let stateColor = COLORS.safe;
    if (risk > 40) stateColor = COLORS.warning;
    if (risk > 75 || latest.status === "Danger") stateColor = COLORS.danger;

    riskPath.style.stroke = stateColor;
    riskScoreTxt.style.color = stateColor;
    statusTxt.style.color = stateColor;

    document.querySelector("#node-info span").innerText = latest.node || "Alpha-01";

    const alertList = document.getElementById("alerts-list");
    const alertCount = document.getElementById("alert-count");
    
    if (latest.alerts && latest.alerts.length > 0) {
        alertCount.style.display = "inline-flex";
        alertCount.innerText = latest.alerts.length;
        alertList.innerHTML = latest.alerts.map(a => `
            <div class="alert-item animate-shake">
                <i data-lucide="alert-triangle"></i>
                <span>CRITICAL: ${a.toUpperCase()}</span>
            </div>
        `).join('');
        lucide.createIcons();
    } else {
        alertCount.style.display = "none";
        alertList.innerHTML = `<div class="empty-state">System secure. No threats detected.</div>`;
    }
}

// --- 5. Professional Charting ---
function syncCharts(history) {
    const labels = history.map(d => d.time);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? COLORS.gridDark : COLORS.gridLight;

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { maxRotation: 0, font: { size: 10 } } },
            y: { grid: { color: gridColor }, ticks: { font: { size: 10 } } }
        }
    };

    // 1. Environmental Chart
    if (!charts.temp) {
        charts.temp = new Chart(document.getElementById('tempChart'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Temp', data: history.map(d => d.temp), borderColor: COLORS.danger, tension: 0.4, fill: true, backgroundColor: 'rgba(239, 68, 68, 0.05)', pointRadius: 0 },
                    { label: 'Hum', data: history.map(d => d.hum), borderColor: COLORS.accent, tension: 0.4, pointRadius: 0 }
                ]
            },
            options: chartOptions
        });
    } else {
        charts.temp.data.labels = labels;
        charts.temp.data.datasets[0].data = history.map(d => d.temp);
        charts.temp.data.datasets[1].data = history.map(d => d.hum);
    }

    // 2. Gas Chart (MQ-2)
    if (!charts.gas) {
        charts.gas = new Chart(document.getElementById('gasChart'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{ 
                    label: 'MQ2', 
                    data: history.map(d => d.mq2), 
                    borderColor: COLORS.warning, 
                    backgroundColor: 'rgba(245, 158, 11, 0.1)', 
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0
                }]
            },
            options: chartOptions
        });
    } else {
        charts.gas.data.labels = labels;
        charts.gas.data.datasets[0].data = history.map(d => d.mq2);
    }

    // 3. NEW: Air Quality Chart (MQ-135)
    if (!charts.air) {
        charts.air = new Chart(document.getElementById('airChart'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{ 
                    label: 'MQ135', 
                    data: history.map(d => d.mq135), 
                    borderColor: COLORS.air, 
                    backgroundColor: 'rgba(139, 92, 246, 0.1)', 
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0
                }]
            },
            options: chartOptions
        });
    } else {
        charts.air.data.labels = labels;
        charts.air.data.datasets[0].data = history.map(d => d.mq135);
    }

    // Global Refresh
    updateChartsTheme();
}

function updateClock() {
    const now = new Date();
    document.getElementById('clock').innerText = now.toLocaleTimeString([], { hour12: false });
}