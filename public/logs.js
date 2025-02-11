// @ts-nocheck
// Declare Chart.js availability
/* global Chart */

// State management
let logs = [];
let isRealTime = true;
console.log("recieving js file")
let sortConfig = { field: 'timestamp', direction: 'desc' };
let filters = {
  search: '',
  method: '',
  status: '',
  startDate: '',
  endDate: ''
};

// Charts
let responseTimeChart;
let statusChart;

// WebSocket connection
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${wsProtocol}//${window.location.host}`);
const connectionStatus = document.getElementById('connectionStatus');
const requestCount = document.getElementById('requestCount');

// WebSocket error handling
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
  if (connectionStatus) {
    connectionStatus.textContent = '🔴 Error';
    connectionStatus.style.color = '#e74c3c';
  }
};

if (connectionStatus) {
  ws.onopen = () => {
    connectionStatus.textContent = '🟢 Connected';
    connectionStatus.style.color = '#2ecc71';
  };

  ws.onclose = () => {
    connectionStatus.textContent = '🔴 Disconnected';
    connectionStatus.style.color = '#e74c3c';
  };
}

// Validation functions
function isValidLogEntry(log) {
  return log && typeof log === 'object' &&
    typeof log.timestamp === 'string' &&
    typeof log.method === 'string' &&
    typeof log.status === 'number';
}

function isValidDate(dateStr) {
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date);
}

ws.onmessage = (event) => {
  if (!isRealTime) return;

  try {
    const log = JSON.parse(event.data);
    if (isValidLogEntry(log)) {
      logs.unshift(log);
      updateUI();
      updateCharts();
    } else {
      console.error('Invalid log entry:', log);
    }
  } catch (error) {
    console.error('Error processing log:', error);
  }
};

// Event Listeners
const searchInput = document.getElementById('search');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    if (e.target && 'value' in e.target) {
      filters.search = e.target.value.toLowerCase();
      updateUI();
    }
  });
}

const methodFilter = document.getElementById('filterMethod');
if (methodFilter) {
  methodFilter.addEventListener('change', (e) => {
    if (e.target && 'value' in e.target) {
      filters.method = e.target.value;
      updateUI();
    }
  });
}

const statusFilter = document.getElementById('filterStatus');
if (statusFilter) {
  statusFilter.addEventListener('change', (e) => {
    if (e.target && 'value' in e.target) {
      filters.status = e.target.value;
      updateUI();
    }
  });
}

const startDateInput = document.getElementById('startDate');
if (startDateInput) {
  startDateInput.addEventListener('change', (e) => {
    if (e.target && 'value' in e.target) {
      filters.startDate = e.target.value ? new Date(e.target.value).toISOString() : '';
      updateUI();
    }
  });
}

const endDateInput = document.getElementById('endDate');
if (endDateInput) {
  endDateInput.addEventListener('change', (e) => {
    if (e.target && 'value' in e.target) {
      filters.endDate = e.target.value ? new Date(e.target.value).toISOString() : '';
      updateUI();
    }
  });
}

const toggleButton = document.getElementById('toggleRealTime');
if (toggleButton) {
  toggleButton.addEventListener('click', (e) => {
    isRealTime = !isRealTime;
    if (e.target && 'textContent' in e.target) {
      e.target.textContent = isRealTime ? 'Pause Real-Time' : 'Resume Real-Time';
    }
  });
}

const exportButton = document.getElementById('exportLogs');
if (exportButton) {
  exportButton.addEventListener('click', exportLogs);
}

const clearButton = document.getElementById('clearFilters');
if (clearButton) {
  clearButton.addEventListener('click', clearFilters);
}

// Table header sorting
document.querySelectorAll('th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const field = th.dataset ? th.dataset.sort || '' : '';
    if (sortConfig.field === field) {
      sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
      sortConfig.field = field;
      sortConfig.direction = 'asc';
    }
    updateUI();
  });
});

// UI Updates
function updateUI() {
  const filteredLogs = filterLogs();
  const sortedLogs = sortLogs(filteredLogs);
  renderTable(sortedLogs);
  updateAnalytics(filteredLogs);
  if (requestCount) {
    requestCount.textContent = `Total Requests: ${logs.length}`;
  }
}

function filterLogs() {
  return logs.filter(log => {
    const matchesSearch = !filters.search ||
      Object.values(log).some(val =>
        String(val).toLowerCase().includes(filters.search)
      );

    const matchesMethod = !filters.method ||
      log.method === filters.method;

    const matchesStatus = !filters.status ||
      String(log.status).startsWith(filters.status[0]);

    const logDate = new Date(log.timestamp);
    const startDate = filters.startDate ? new Date(filters.startDate) : null;
    const endDate = filters.endDate ? new Date(filters.endDate) : null;

    const matchesDateRange = (!startDate || logDate >= startDate) &&
      (!endDate || logDate <= endDate);

    return matchesSearch && matchesMethod && matchesStatus && matchesDateRange;
  });
}

function sortLogs(logs) {
  return [...logs].sort((a, b) => {
    const aVal = a[sortConfig.field];
    const bVal = b[sortConfig.field];
    const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });
}

function renderTable(logs) {
  const tbody = document.querySelector('#logsTable tbody');
  if (tbody) {
    tbody.innerHTML = logs.map(log => `
      <tr onclick="showDetails('${log.fingerprint}')">
        <td>${formatDate(log.timestamp)}</td>
        <td>${log.method}</td>
        <td>${formatStatus(log.security?.statusCode || 200)}</td>
        <td>${log.responseTime || 0}ms</td>
        <td>${log.ip}</td>
        <td>${log.geo?.city ? `${log.geo.city}, ${log.geo.country}` : 'N/A'}</td>
        <td>${log.os?.name} ${log.os?.version || ''}</td>
        <td>${log.browser?.name} ${log.browser?.version || ''}</td>
        <td>${log.device?.type || 'N/A'} ${log.device?.brand || ''} ${log.device?.model || ''}</td>
        <td>${log.url}</td>
        <td>${log.sessionID || 'Anonymous'}</td>
        <td>${formatJSON(log.headers || {})}</td>
        <td>N/A</td>
        <td>N/A</td>
        <td>N/A</td>
      </tr>
    `).join('');
  }
}

// Charts and Analytics
function initCharts() {
  const responseTimeCanvas = document.getElementById('responseTimeChart');
  if (responseTimeCanvas instanceof HTMLCanvasElement) {
    const ctx = responseTimeCanvas.getContext('2d');
    if (ctx instanceof CanvasRenderingContext2D) {
      responseTimeChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Response Time (ms)',
            data: [],
            borderColor: '#3498db',
            tension: 0.1
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }
  }

  const statusCanvas = document.getElementById('statusChart');
  if (statusCanvas instanceof HTMLCanvasElement) {
    const ctx = statusCanvas.getContext('2d');
    if (ctx instanceof CanvasRenderingContext2D) {
      statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['2xx', '3xx', '4xx', '5xx'],
          datasets: [{
            data: [0, 0, 0, 0],
            backgroundColor: ['#2ecc71', '#3498db', '#f1c40f', '#e74c3c']
          }]
        },
        options: {
          responsive: true
        }
      });
    }
  }
}

function updateCharts() {
  if (!responseTimeChart || !statusChart) return;

  // Update response time chart
  const recentLogs = logs.slice(0, 50).reverse();
  responseTimeChart.data.labels = recentLogs.map(log => formatDate(log.timestamp));
  responseTimeChart.data.datasets[0].data = recentLogs.map(log => log.responseTime);
  responseTimeChart.update();

  // Update status distribution chart
  const statusCounts = logs.reduce((acc, log) => {
    const statusClass = Math.floor(log.status / 100);
    acc[statusClass] = (acc[statusClass] || 0) + 1;
    return acc;
  }, {});

  statusChart.data.datasets[0].data = [
    statusCounts[2] || 0,
    statusCounts[3] || 0,
    statusCounts[4] || 0,
    statusCounts[5] || 0
  ];
  statusChart.update();
}

function updateAnalytics(filteredLogs) {
  const topEndpointsElement = document.getElementById('topEndpoints');
  if (!topEndpointsElement) return;

  // Update top endpoints
  const endpoints = {};
  filteredLogs.forEach(log => {
    const url = new URL(log.url, window.location.origin);
    const endpoint = url.pathname;
    endpoints[endpoint] = (endpoints[endpoint] || 0) + 1;
  });

  const topEndpointsHtml = Object.entries(endpoints)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([endpoint, count]) => `
      <div class="endpoint-stat">
        <span>${endpoint}</span>
        <span>${count} requests</span>
      </div>
    `).join('');

  topEndpointsElement.innerHTML = topEndpointsHtml;
}

// Utility Functions
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function formatStatus(status) {
  const statusClass = Math.floor(status / 100);
  const colors = {
    2: '#2ecc71',
    3: '#3498db',
    4: '#f1c40f',
    5: '#e74c3c'
  };
  return `<span style="color: ${colors[statusClass]}">${status}</span>`;
}

function formatJSON(obj) {
  if (!obj) return 'N/A';
  return `<pre>${JSON.stringify(obj, null, 2)}</pre>`;
}

function showDetails(fingerprint) {
  const log = logs.find(l => l.fingerprint === fingerprint);
  if (!log) return;

  const modal = document.getElementById('detailsModal');
  const content = modal ? modal.querySelector('.tab-content') : null;
  if (!modal || !content) return;

  // Populate tab content
  const tabContent = {
    request: `
      <h3>Request Details</h3>
      <pre>${JSON.stringify({
        timestamp: formatDate(log.timestamp),
        method: log.method,
        url: log.url,
        protocol: log.protocol,
        headers: log.headers
      }, null, 2)}</pre>
    `,
    response: `
      <h3>Performance Details</h3>
      <pre>${JSON.stringify({
        responseTime: log.responseTime + 'ms',
        status: log.security?.statusCode || 200
      }, null, 2)}</pre>
    `,
    timeline: `
      <h3>Security Timeline</h3>
      <div class="timeline">
        <div class="timeline-item">
          <span class="time">Security Score: ${log.security?.threatScore || 0}/100</span>
          <span class="event">Threat Assessment</span>
        </div>
        <div class="timeline-item">
          <span class="event">Proxy Detection: ${log.security?.isProxy ? '⚠️ Detected' : '✅ Clear'}</span>
        </div>
        <div class="timeline-item">
          <span class="event">Tor Detection: ${log.security?.isTor ? '⚠️ Detected' : '✅ Clear'}</span>
        </div>
        <div class="timeline-item">
          <span class="event">VPN Detection: ${log.security?.isVPN ? '⚠️ Detected' : '✅ Clear'}</span>
        </div>
      </div>
    `,
    context: `
      <h3>Request Context</h3>
      <pre>${JSON.stringify({
        network: {
          ip: log.ip,
          ipVersion: log.ipVersion,
          geo: log.geo,
          hostname: log.network?.hostName
        },
        client: {
          os: log.os,
          browser: log.browser,
          device: log.device
        },
        session: {
          id: log.sessionID,
          language: log.language,
          fingerprint: log.fingerprint
        }
      }, null, 2)}</pre>
    `
  };

  const activeTab = modal.querySelector('.tab-btn.active');
  if (activeTab && typeof activeTab.click === 'function') {
    activeTab.click();
  }
  modal.style.display = 'block';
}

function exportLogs() {
  const filteredLogs = filterLogs();
  const csv = [
    Object.keys(filteredLogs[0]).join(','),
    ...filteredLogs.map(log => Object.values(log).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `logs-${new Date().toISOString()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function clearFilters() {
  filters = {
    search: '',
    method: '',
    status: '',
    startDate: '',
    endDate: ''
  };

  const elements = {
    search: document.getElementById('search'),
    method: document.getElementById('filterMethod'),
    status: document.getElementById('filterStatus'),
    startDate: document.getElementById('startDate'),
    endDate: document.getElementById('endDate')
  };

  Object.values(elements).forEach(element => {
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) {
      element.value = '';
    }
  });

  updateUI();
}

// Initialize
async function fetchInitialLogs() {
  try {
    const response = await fetch('http://localhost:5000/api/logs/tracking');
    if (!response.ok) throw new Error('Failed to fetch logs');
    const data = await response.json();
    logs = data.data || [];
    updateUI();
  } catch (error) {
    console.error('Error fetching logs:', error);
  }
}

let chartsInitialized = false;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await fetchInitialLogs();
    if (window.Chart) {
      initCharts();
      chartsInitialized = true;
    }
    updateUI();
  } catch (error) {
    console.error('Failed to initialize dashboard:', error);
  }
});

function updateCharts() {
  if (!chartsInitialized || !responseTimeChart || !statusChart) return;
  // ... rest of updateCharts function unchanged
}

async function fetchInitialLogs() {
  try {
    const response = await fetch('http://localhost:5000/api/logs/tracking');
    if (!response.ok) throw new Error(`Failed to fetch logs: ${response.statusText}`);
    const data = await response.json();
    logs = Array.isArray(data.data) ? data.data : [];
    console.log('Loaded initial logs:', logs.length);
  } catch (error) {
    console.error('Error fetching logs:', error);
    logs = [];
  }
}
