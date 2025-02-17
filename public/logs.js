// @ts-nocheck
// Declare Chart.js availability
/* global Chart */

// State management
let logs = [];
let isRealTime = true;
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

// Get the base API URL from the current window location
const baseApiUrl = window.location.origin;

// WebSocket connection with specific path
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProtocol}//${window.location.host}/ws/logs`; // Updated WebSocket URL
let ws = null;
const connectionStatus = document.getElementById('connectionStatus');
const requestCount = document.getElementById('requestCount');

// WebSocket connection management
function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return; // Already connected
  }

  if (ws) {
    ws.close();
  }

  console.log('Connecting to WebSocket...', wsUrl);
  ws = new WebSocket(wsUrl);

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    updateConnectionStatus('error');
  };

  ws.onopen = () => {
    console.log('WebSocket connected');
    updateConnectionStatus('connected');
  };

  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;

  ws.onclose = () => {
    updateConnectionStatus('disconnected');
    reconnectAttempts++;

    if (reconnectAttempts <= maxReconnectAttempts) {
      console.log(`WebSocket reconnecting... Attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
      // Exponential backoff for reconnection
      setTimeout(connectWebSocket, Math.min(1000 * Math.pow(2, reconnectAttempts), 30000));
    } else {
      console.log('Max reconnection attempts reached. Please refresh the page.');
    }
  };

  ws.onmessage = (event) => {
    try {
      const log = JSON.parse(event.data);
      if (isValidLogEntry(log)) {
        logs.unshift(log);
        if (logs.length > 1000) { // Keep max 1000 logs in memory
          logs.pop();
        }
        // Always update UI for new logs regardless of real-time setting
        updateUI();
        updateCharts();
      } else {
        console.error('Invalid log entry:', log);
      }
    } catch (error) {
      console.error('Error processing log:', error);
    }
  };
}

function updateConnectionStatus(status) {
  if (!connectionStatus) return;

  switch (status) {
    case 'connected':
      connectionStatus.textContent = '🟢 Connected';
      connectionStatus.style.color = '#2ecc71';
      break;
    case 'disconnected':
      connectionStatus.textContent = '🔴 Disconnected';
      connectionStatus.style.color = '#e74c3c';
      break;
    case 'error':
      connectionStatus.textContent = '🔴 Error';
      connectionStatus.style.color = '#e74c3c';
      break;
  }
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
  try {
    console.log('Updating UI with logs count:', logs.length);

    // Update request count first
    if (requestCount) {
      requestCount.textContent = `Total Requests: ${logs.length}`;
    }

    // Get filtered and sorted logs
    const filteredLogs = filterLogs();
    console.log('Filtered logs count:', filteredLogs.length);
    const sortedLogs = sortLogs(filteredLogs);

    // Render table
    renderTable(sortedLogs);

    // Update analytics only if charts are initialized
    if (chartsInitialized) {
      updateAnalytics(filteredLogs);
      updateCharts();
    }

    // Update connection status display
    if (ws && ws.readyState === WebSocket.OPEN) {
      updateConnectionStatus('connected');
    }
  } catch (error) {
    console.error('Error updating UI:', error);
    // Attempt recovery by clearing filters
    clearFilters();
  }
}

function filterLogs() {
  // If no filters are active, return all logs
  if (!filters.search && !filters.method && !filters.status && !filters.startDate && !filters.endDate) {
    return logs;
  }

  return logs.filter(log => {
    // Search filter
    const matchesSearch = !filters.search ||
      Object.entries(log).some(([key, val]) => {
        // Only search through specific fields
        if (['method', 'url', 'ip', 'browser', 'os'].includes(key)) {
          return String(val).toLowerCase().includes(filters.search.toLowerCase());
        }
        return false;
      });

    // Method filter
    const matchesMethod = !filters.method || log.method === filters.method;

    // Status filter
    const matchesStatus = !filters.status ||
      (log.status && String(log.status).startsWith(filters.status[0]));

    // Date range filter
    let matchesDateRange = true;
    if (filters.startDate || filters.endDate) {
      const logDate = new Date(log.timestamp);
      const startDate = filters.startDate ? new Date(filters.startDate) : null;
      const endDate = filters.endDate ? new Date(filters.endDate) : null;
      matchesDateRange = (!startDate || logDate >= startDate) &&
        (!endDate || logDate <= endDate);
    }

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
  if (!tbody) {
    console.error('Table body element not found');
    return;
  }

  try {
    console.log('Rendering table with', logs.length, 'logs');

    if (!Array.isArray(logs) || logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12">No logs to display</td></tr>';
      return;
    }

    const rows = logs.map(log => {
      try {
        if (!log) return '';

        // Safely access nested properties
        const timestamp = log.timestamp ? formatDate(log.timestamp) : 'Invalid Date';
        const method = log.method || 'Unknown';
        const status = typeof log.status === 'number' ? formatStatus(log.status) : 'Unknown';
        const responseTime = typeof log.responseTime === 'number' ? `${log.responseTime}ms` : '0ms';
        const ip = log.ip || 'Unknown';
        const geo = log.geo || {};
        const location = geo.city ? `${geo.city}, ${geo.country}` : 'N/A';
        const os = log.os || {};
        const browser = log.browser || {};
        const device = log.device || {};
        const url = log.url || 'Unknown';
        const sessionId = log.sessionID || 'Anonymous';
        const headers = log.headers ? formatJSON(log.headers) : 'N/A';

        return `
          <tr onclick="showDetails('${log.fingerprint || ''}')">
            <td>${timestamp}</td>
            <td>${method}</td>
            <td>${status}</td>
            <td>${responseTime}</td>
            <td>${ip}</td>
            <td>${location}</td>
            <td>${os.name || 'Unknown'} ${os.version || ''}</td>
            <td>${browser.name || 'Unknown'} ${browser.version || ''}</td>
            <td>${device.type || 'N/A'} ${device.brand || ''} ${device.model || ''}</td>
            <td>${url}</td>
            <td>${sessionId}</td>
            <td>${headers}</td>
          </tr>
        `;
      } catch (error) {
        console.error('Error rendering log row:', error, log);
        return '';
      }
    }).filter(row => row !== ''); // Remove any failed rows

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12">Error rendering logs</td></tr>';
      return;
    }

    tbody.innerHTML = rows.join('');
    console.log('Table rendered successfully');
  } catch (error) {
    console.error('Error in renderTable:', error);
    tbody.innerHTML = '<tr><td colspan="12">Error rendering table data</td></tr>';
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
  if (!chartsInitialized || !responseTimeChart || !statusChart) return;

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
        status: log.status
      }, null, 2)}</pre>
    `,
    security: `
      <h3>Security Details</h3>
      <div class="timeline">
        <div class="timeline-item">
          <span class="time">Threat Score: ${log.security?.threatScore || 0}/100</span>
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
  if (activeTab && typeof activeTab.dataset.tab === 'string') {
    content.innerHTML = tabContent[activeTab.dataset.tab] || '';
  }
  modal.style.display = 'block';
}

function exportLogs() {
  const filteredLogs = filterLogs();
  const csv = [
    Object.keys(filteredLogs[0] || {}).join(','),
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
    console.log('Fetching initial logs...');
    const response = await fetch(`${baseApiUrl}/api/logs/tracking`);
    if (!response.ok) throw new Error(`Failed to fetch logs: ${response.statusText}`);
    const data = await response.json();
    logs = Array.isArray(data.data) ? data.data : [];
    console.log('Loaded initial logs:', logs.length);
    updateUI();
    updateCharts();
  } catch (error) {
    console.error('Error fetching logs:', error);
    logs = [];
    // Retry after 5 seconds
    setTimeout(fetchInitialLogs, 5000);
  }
}

// Add periodic refresh of initial logs
setInterval(fetchInitialLogs, 30000); // Refresh every 30 seconds

let chartsInitialized = false;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    connectWebSocket();
    await fetchInitialLogs();
    if (window.Chart) {
      initCharts();
      chartsInitialized = true;
      updateCharts();
    }
  } catch (error) {
    console.error('Failed to initialize dashboard:', error);
  }
});
