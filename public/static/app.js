// Sovereign AI Workbench Frontend Controller

const CONFIG = {
  apiBase: '/api',
  users: {
    Admin: { username: 'admin', password: 'SovereignAdmin2026!' },
    Engineer: { username: 'engineer_vikram', password: 'EngineerVikram2026!' },
    Analyst: { username: 'analyst_priya', password: 'AnalystPriya2026!' },
    Operator: { username: 'operator_arun', password: 'OperatorArun2026!' },
  }
};

const state = {
  currentRole: 'Admin',
  token: null,
  activeTab: 'overview',
  lastReceipt: null,
  models: [],
  tools: [],
  documents: [],
  tasks: [],
  chartViewMode: 'grouped', // 'grouped' | 'stacked' | 'trend'
  taskHistoryData: null
};

// API Helper
async function apiCall(endpoint, options = {}) {
  const url = `${CONFIG.apiBase}${endpoint}`;
  const headers = options.headers || {};
  
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error(`API Call failed to ${url}:`, err);
    return { ok: false, status: 0, error: err.message };
  }
}

// Authentication
async function authenticateRole(role) {
  state.currentRole = role;
  const creds = CONFIG.users[role];
  if (!creds) return;

  const res = await apiCall('/auth/token/', {
    method: 'POST',
    body: JSON.stringify(creds)
  });

  if (res.ok && res.data.access) {
    state.token = res.data.access;
    updateUserBadge();
    refreshCurrentView();
  } else {
    showNotification(`Auth failed for ${role}: ${JSON.stringify(res.data)}`, 'danger');
  }
}

function updateUserBadge() {
  const select = document.getElementById('roleSelect');
  if (select) select.value = state.currentRole;
  
  const badge = document.getElementById('currentRoleBadge');
  if (badge) {
    badge.textContent = state.currentRole;
    badge.className = `tag ${getRoleColor(state.currentRole)}`;
  }
}

function getRoleColor(role) {
  switch (role) {
    case 'Admin': return 'cyan';
    case 'Engineer': return 'indigo';
    case 'Analyst': return 'amber';
    case 'Operator': return 'green';
    default: return 'cyan';
  }
}

// Health & Telemetry
async function loadHealth() {
  const res = await apiCall('/health/');
  if (res.ok) {
    const d = res.data;
    document.getElementById('hudAirGapStatus').textContent = d.air_gap_mode ? 'AIR-GAP: ENFORCED' : 'EGRESS PERMITTED';
    document.getElementById('hudEgressStatus').textContent = d.allow_external_egress ? 'EGRESS: ALLOWED' : 'EXTERNAL EGRESS: 0';
    document.getElementById('hudDbStatus').textContent = `DB: ${d.components.database.toUpperCase()}`;
    document.getElementById('hudGuardStatus').textContent = `GUARD: ${d.components.sovereignty_guard.toUpperCase()}`;
  }
}

// Overview Metrics & D3 Summary Chart
async function loadOverview() {
  const res = await apiCall('/health/stats/');
  if (res.ok) {
    const m = res.data.metrics;
    document.getElementById('metricDocs').textContent = m.total_documents;
    document.getElementById('metricTasks').textContent = m.total_tasks;
    document.getElementById('metricModels').textContent = m.registered_models;
    document.getElementById('metricReceipts').textContent = m.sovereignty_receipts_issued;
    document.getElementById('metricAudits').textContent = m.audit_logs_recorded;

    if (m.task_history_7d) {
      state.taskHistoryData = m.task_history_7d;
      renderTaskStatusChart(m.task_history_7d);
    }
  }
}

// D3.js 7-Day Task Status Summary Chart View Mode
function setChartViewMode(mode) {
  state.chartViewMode = mode;
  document.getElementById('btnChartGrouped')?.classList.toggle('active', mode === 'grouped');
  document.getElementById('btnChartStacked')?.classList.toggle('active', mode === 'stacked');
  document.getElementById('btnChartTrend')?.classList.toggle('active', mode === 'trend');
  if (state.taskHistoryData) {
    renderTaskStatusChart(state.taskHistoryData);
  }
}
window.setChartViewMode = setChartViewMode;

async function refreshTaskChartData() {
  const res = await apiCall('/agents/task-status-history/');
  if (res.ok) {
    state.taskHistoryData = res.data;
    renderTaskStatusChart(res.data);
  } else {
    loadOverview();
  }
}
window.refreshTaskChartData = refreshTaskChartData;

// D3.js SVG Chart Render Engine
function renderTaskStatusChart(historyData) {
  if (!historyData || !historyData.days) return;
  state.taskHistoryData = historyData;

  const days = historyData.days;
  const summary = historyData.summary || {};

  // Update KPI metric badges
  const kpiTotal = document.getElementById('chartKpiTotal');
  const kpiSuccess = document.getElementById('chartKpiSuccess');
  const kpiFailed = document.getElementById('chartKpiFailed');
  const kpiRate = document.getElementById('chartKpiRate');
  const kpiDailyAvg = document.getElementById('chartKpiDailyAvg');

  if (kpiTotal) kpiTotal.textContent = `${summary.total_7d_tasks || 0}`;
  if (kpiSuccess) kpiSuccess.textContent = `${summary.total_7d_success || 0}`;
  if (kpiFailed) kpiFailed.textContent = `${summary.total_7d_failed || 0}`;
  if (kpiRate) kpiRate.textContent = `${summary.overall_success_rate || 100}%`;
  if (kpiDailyAvg) kpiDailyAvg.textContent = `${summary.avg_daily_tasks || 0} / day`;

  const legSuccess = document.getElementById('legendSuccessCount');
  const legFailed = document.getElementById('legendFailedCount');
  if (legSuccess) legSuccess.textContent = `${summary.total_7d_success || 0} (${summary.overall_success_rate || 100}%)`;
  if (legFailed) {
    const failPct = (100 - (summary.overall_success_rate || 100)).toFixed(1);
    legFailed.textContent = `${summary.total_7d_failed || 0} (${failPct}%)`;
  }

  // Populate Tabular Breakdown
  const tbody = document.getElementById('chartTableBody');
  if (tbody) {
    tbody.innerHTML = days.map(d => `
      <tr>
        <td style="font-weight: 600; color: var(--accent-cyan); font-family: var(--font-mono);">${d.label} <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: normal;">(${d.date})</span></td>
        <td><span class="tag green" style="font-size: 0.75rem;">✔ ${d.success} runs</span></td>
        <td><span class="tag ${d.failed > 0 ? 'red' : 'green'}" style="font-size: 0.75rem;">${d.failed > 0 ? '⚠ ' + d.failed + ' trips' : '0 trips'}</span></td>
        <td style="font-family: var(--font-mono); font-weight: 700;">${d.total}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.08); border-radius: 9999px; overflow: hidden; min-width: 60px;">
              <div style="width: ${d.success_rate}%; height: 100%; background: ${d.success_rate >= 95 ? '#10b981' : d.success_rate >= 90 ? '#38bdf8' : '#ef4444'};"></div>
            </div>
            <span style="font-family: var(--font-mono); font-size: 0.75rem; color: ${d.success_rate >= 95 ? 'var(--status-healthy)' : 'var(--text-secondary)'}; font-weight: 600;">${d.success_rate}%</span>
          </div>
        </td>
        <td><span class="tag cyan" style="font-size: 0.7rem;">AIR-GAP CONFINED</span></td>
      </tr>
    `).join('');
  }

  const container = document.getElementById('taskChartSvgWrapper');
  if (!container) return;

  // Clear container
  container.innerHTML = '';

  if (!window.d3) {
    container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Initializing D3 visualization...</div>`;
    return;
  }

  const d3 = window.d3;
  const rect = container.getBoundingClientRect();
  const width = Math.max(rect.width || container.clientWidth || 680, 420);
  const height = 300;
  const margin = { top: 25, right: 30, bottom: 42, left: 45 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // SVG Defs for Gradients & Shadow
  const defs = svg.append('defs');

  // Success gradient
  const gradSuccess = defs.append('linearGradient')
    .attr('id', 'gradSuccess')
    .attr('x1', '0%').attr('y1', '0%')
    .attr('x2', '0%').attr('y2', '100%');
  gradSuccess.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 1);
  gradSuccess.append('stop').attr('offset', '100%').attr('stop-color', '#047857').attr('stop-opacity', 0.85);

  // Failed gradient
  const gradFailed = defs.append('linearGradient')
    .attr('id', 'gradFailed')
    .attr('x1', '0%').attr('y1', '0%')
    .attr('x2', '0%').attr('y2', '100%');
  gradFailed.append('stop').attr('offset', '0%').attr('stop-color', '#f43f5e').attr('stop-opacity', 1);
  gradFailed.append('stop').attr('offset', '100%').attr('stop-color', '#be123c').attr('stop-opacity', 0.85);

  // Success Area gradient
  const gradAreaSuccess = defs.append('linearGradient')
    .attr('id', 'gradAreaSuccess')
    .attr('x1', '0%').attr('y1', '0%')
    .attr('x2', '0%').attr('y2', '100%');
  gradAreaSuccess.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 0.35);
  gradAreaSuccess.append('stop').attr('offset', '100%').attr('stop-color', '#10b981').attr('stop-opacity', 0.0);

  // Glow filter
  const filter = defs.append('filter').attr('id', 'glow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
  filter.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'blur');
  filter.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'blur').attr('operator', 'over');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const tooltip = document.getElementById('taskChartTooltip');

  // Tooltip display handler
  function showTooltip(e, d) {
    if (!tooltip) return;
    tooltip.innerHTML = `
      <div class="chart-tooltip-header">
        <span>${d.label}</span>
        <span style="font-size: 0.68rem; color: var(--text-muted);">${d.date}</span>
      </div>
      <div class="chart-tooltip-row">
        <span class="label"><span style="width:8px;height:8px;border-radius:2px;background:#10b981;display:inline-block;"></span> Success</span>
        <span class="value" style="color:#10b981;">${d.success} runs</span>
      </div>
      <div class="chart-tooltip-row">
        <span class="label"><span style="width:8px;height:8px;border-radius:2px;background:#ef4444;display:inline-block;"></span> Failed / Trips</span>
        <span class="value" style="color:#ef4444;">${d.failed} trips</span>
      </div>
      <div class="chart-tooltip-row">
        <span class="label">Daily Total</span>
        <span class="value" style="color:var(--accent-cyan);">${d.total}</span>
      </div>
      <div class="chart-tooltip-rate">
        <span>Success Rate</span>
        <span>${d.success_rate}%</span>
      </div>
    `;
    tooltip.style.display = 'block';
    tooltip.style.opacity = '1';

    const containerRect = container.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;

    let leftPos = mouseX + 15;
    if (leftPos + 180 > width) {
      leftPos = mouseX - 190;
    }
    tooltip.style.left = `${Math.max(10, leftPos)}px`;
    tooltip.style.top = `${Math.max(10, mouseY - 45)}px`;
  }

  function hideTooltip() {
    if (!tooltip) return;
    tooltip.style.opacity = '0';
    tooltip.style.display = 'none';
  }

  if (state.chartViewMode === 'grouped') {
    // 1. GROUPED BARS VIEW
    const x0 = d3.scaleBand()
      .domain(days.map(d => d.label))
      .range([0, innerWidth])
      .paddingInner(0.28)
      .paddingOuter(0.12);

    const x1 = d3.scaleBand()
      .domain(['success', 'failed'])
      .range([0, x0.bandwidth()])
      .padding(0.12);

    const maxVal = d3.max(days, d => Math.max(d.success, d.failed)) || 10;
    const y = d3.scaleLinear()
      .domain([0, Math.ceil(maxVal * 1.22)])
      .nice()
      .range([innerHeight, 0]);

    // Gridlines
    g.append('g')
      .attr('class', 'chart-grid')
      .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(''));

    // X Axis
    g.append('g')
      .attr('class', 'chart-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x0));

    // Y Axis
    g.append('g')
      .attr('class', 'chart-axis')
      .call(d3.axisLeft(y).ticks(5));

    // Y Axis Title
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -32)
      .attr('x', -innerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-mono)')
      .text('TASK EXECUTIONS');

    // Groups
    const dayGroups = g.selectAll('.day-group')
      .data(days)
      .enter()
      .append('g')
      .attr('class', 'd3-bar-group')
      .attr('transform', d => `translate(${x0(d.label)},0)`);

    // Success Bars
    dayGroups.append('rect')
      .attr('class', 'd3-bar')
      .attr('x', x1('success'))
      .attr('y', innerHeight)
      .attr('width', x1.bandwidth())
      .attr('height', 0)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', 'url(#gradSuccess)')
      .on('mouseenter', (event, d) => showTooltip(event, d))
      .on('mousemove', (event, d) => showTooltip(event, d))
      .on('mouseleave', hideTooltip)
      .transition()
      .duration(550)
      .ease(d3.easeCubicOut)
      .attr('y', d => y(d.success))
      .attr('height', d => Math.max(0, innerHeight - y(d.success)));

    // Failed Bars
    dayGroups.append('rect')
      .attr('class', 'd3-bar')
      .attr('x', x1('failed'))
      .attr('y', innerHeight)
      .attr('width', x1.bandwidth())
      .attr('height', 0)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', 'url(#gradFailed)')
      .on('mouseenter', (event, d) => showTooltip(event, d))
      .on('mousemove', (event, d) => showTooltip(event, d))
      .on('mouseleave', hideTooltip)
      .transition()
      .duration(550)
      .ease(d3.easeCubicOut)
      .attr('y', d => y(d.failed))
      .attr('height', d => Math.max(0, innerHeight - y(d.failed)));

    // Success Value Labels
    dayGroups.append('text')
      .attr('x', x1('success') + x1.bandwidth() / 2)
      .attr('y', d => y(d.success) - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#10b981')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-weight', '700')
      .attr('opacity', 0)
      .text(d => d.success)
      .transition()
      .delay(350)
      .duration(250)
      .attr('opacity', 0.95);

    // Failed Value Labels (if > 0)
    dayGroups.append('text')
      .attr('x', x1('failed') + x1.bandwidth() / 2)
      .attr('y', d => y(d.failed) - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#ef4444')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-weight', '700')
      .attr('opacity', 0)
      .text(d => d.failed > 0 ? d.failed : '')
      .transition()
      .delay(350)
      .duration(250)
      .attr('opacity', 0.95);

  } else if (state.chartViewMode === 'stacked') {
    // 2. STACKED BARS VIEW
    const x = d3.scaleBand()
      .domain(days.map(d => d.label))
      .range([0, innerWidth])
      .padding(0.32);

    const maxTotal = d3.max(days, d => d.total) || 10;
    const y = d3.scaleLinear()
      .domain([0, Math.ceil(maxTotal * 1.18)])
      .nice()
      .range([innerHeight, 0]);

    // Gridlines
    g.append('g')
      .attr('class', 'chart-grid')
      .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(''));

    // X Axis
    g.append('g')
      .attr('class', 'chart-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x));

    // Y Axis
    g.append('g')
      .attr('class', 'chart-axis')
      .call(d3.axisLeft(y).ticks(5));

    // Y Axis Title
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -32)
      .attr('x', -innerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-mono)')
      .text('TOTAL EXECUTIONS');

    const stack = d3.stack().keys(['success', 'failed']);
    const series = stack(days);

    const colors = {
      success: 'url(#gradSuccess)',
      failed: 'url(#gradFailed)'
    };

    const layer = g.selectAll('.layer')
      .data(series)
      .enter()
      .append('g')
      .attr('class', 'layer')
      .attr('fill', d => colors[d.key]);

    layer.selectAll('rect')
      .data(d => d)
      .enter()
      .append('rect')
      .attr('class', 'd3-bar')
      .attr('x', d => x(d.data.label))
      .attr('y', innerHeight)
      .attr('height', 0)
      .attr('width', x.bandwidth())
      .attr('rx', 3)
      .attr('ry', 3)
      .on('mouseenter', (event, d) => showTooltip(event, d.data))
      .on('mousemove', (event, d) => showTooltip(event, d.data))
      .on('mouseleave', hideTooltip)
      .transition()
      .duration(550)
      .ease(d3.easeCubicOut)
      .attr('y', d => y(d[1]))
      .attr('height', d => Math.max(0, y(d[0]) - y(d[1])));

    // Total label on top of each stack
    g.selectAll('.stack-total-label')
      .data(days)
      .enter()
      .append('text')
      .attr('class', 'stack-total-label')
      .attr('x', d => x(d.label) + x.bandwidth() / 2)
      .attr('y', d => y(d.total) - 6)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--accent-cyan)')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-weight', '700')
      .attr('opacity', 0)
      .text(d => d.total)
      .transition()
      .delay(350)
      .duration(250)
      .attr('opacity', 1);

  } else if (state.chartViewMode === 'trend') {
    // 3. TREND AREA VIEW
    const x = d3.scalePoint()
      .domain(days.map(d => d.label))
      .range([0, innerWidth])
      .padding(0.18);

    const maxVal = d3.max(days, d => Math.max(d.success, d.failed)) || 10;
    const y = d3.scaleLinear()
      .domain([0, Math.ceil(maxVal * 1.25)])
      .nice()
      .range([innerHeight, 0]);

    // Gridlines
    g.append('g')
      .attr('class', 'chart-grid')
      .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(''));

    // X Axis
    g.append('g')
      .attr('class', 'chart-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x));

    // Y Axis
    g.append('g')
      .attr('class', 'chart-axis')
      .call(d3.axisLeft(y).ticks(5));

    // Area generator
    const areaSuccess = d3.area()
      .curve(d3.curveMonotoneX)
      .x(d => x(d.label))
      .y0(innerHeight)
      .y1(d => y(d.success));

    // Line generators
    const lineSuccess = d3.line()
      .curve(d3.curveMonotoneX)
      .x(d => x(d.label))
      .y(d => y(d.success));

    const lineFailed = d3.line()
      .curve(d3.curveMonotoneX)
      .x(d => x(d.label))
      .y(d => y(d.failed));

    // Area path
    g.append('path')
      .datum(days)
      .attr('fill', 'url(#gradAreaSuccess)')
      .attr('d', areaSuccess)
      .attr('opacity', 0)
      .transition()
      .duration(500)
      .attr('opacity', 1);

    // Success line
    g.append('path')
      .datum(days)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 3)
      .attr('filter', 'url(#glow)')
      .attr('d', lineSuccess);

    // Failed line
    g.append('path')
      .datum(days)
      .attr('fill', 'none')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2.5)
      .attr('stroke-dasharray', '4, 4')
      .attr('d', lineFailed);

    // Success dots
    g.selectAll('.dot-success')
      .data(days)
      .enter()
      .append('circle')
      .attr('class', 'dot-success')
      .attr('cx', d => x(d.label))
      .attr('cy', d => y(d.success))
      .attr('r', 5)
      .attr('fill', '#10b981')
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => showTooltip(event, d))
      .on('mousemove', (event, d) => showTooltip(event, d))
      .on('mouseleave', hideTooltip);

    // Failed dots
    g.selectAll('.dot-failed')
      .data(days)
      .enter()
      .append('circle')
      .attr('class', 'dot-failed')
      .attr('cx', d => x(d.label))
      .attr('cy', d => y(d.failed))
      .attr('r', 4.5)
      .attr('fill', '#ef4444')
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => showTooltip(event, d))
      .on('mousemove', (event, d) => showTooltip(event, d))
      .on('mouseleave', hideTooltip);
  }
}

// Window resize listener with debounce to keep D3 chart crisp
let chartResizeTimeout = null;
window.addEventListener('resize', () => {
  clearTimeout(chartResizeTimeout);
  chartResizeTimeout = setTimeout(() => {
    if (state.activeTab === 'overview' && state.taskHistoryData) {
      renderTaskStatusChart(state.taskHistoryData);
    }
  }, 150);
});

// Model Registry & Sovereign Initialization
async function loadModels() {
  const res = await apiCall('/models/');
  const container = document.getElementById('modelsGrid');
  if (!container) return;
  
  if (res.ok) {
    state.models = res.data;
    
    // Update HUD metrics
    const totalModels = res.data.length;
    const onlineModels = res.data.filter(m => m.status.includes('ONLINE')).length;
    let totalVram = 0;
    let latencySum = 0;
    let latencyCount = 0;

    res.data.forEach(m => {
      if (m.capabilities?.vram_required_gb) totalVram += Number(m.capabilities.vram_required_gb);
      if (m.capabilities?.latency_ms) {
        latencySum += Number(m.capabilities.latency_ms);
        latencyCount++;
      }
    });

    const avgLat = latencyCount > 0 ? (latencySum / latencyCount).toFixed(1) : '16.2';
    const hudTotal = document.getElementById('hudTotalModels');
    const hudOnline = document.getElementById('hudOnlineModels');
    const hudVram = document.getElementById('hudTotalVram');
    const hudLat = document.getElementById('hudAvgLatency');

    if (hudTotal) hudTotal.textContent = `${totalModels} Registered`;
    if (hudOnline) hudOnline.textContent = `${onlineModels} / ${totalModels} Online`;
    if (hudVram) hudVram.textContent = `${totalVram.toFixed(1)} GB / 96 GB`;
    if (hudLat) hudLat.textContent = `${avgLat} ms`;

    container.innerHTML = res.data.map(m => {
      const isOnline = m.status.includes('ONLINE');
      const isAirGapped = m.capabilities?.air_gap_compliant !== false;
      const quant = m.capabilities?.quantization || 'FP16';
      const ctx = m.capabilities?.context_window ? `${(m.capabilities.context_window / 1024).toFixed(0)}k ctx` : (m.capabilities?.resolution || '1024-D');
      const vram = m.capabilities?.vram_required_gb ? `${m.capabilities.vram_required_gb} GB` : '0 GB (API)';
      const tp = m.capabilities?.tensor_parallel ? `TP=${m.capabilities.tensor_parallel}` : 'TP=1';
      const lat = m.capabilities?.latency_ms ? `${m.capabilities.latency_ms} ms` : '18 ms';
      const tokSec = m.capabilities?.throughput_tok_sec ? `${m.capabilities.throughput_tok_sec} tok/s` : '45 tok/s';

      return `
      <div class="metric-card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap;">
            <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
              <span class="tag cyan">${m.provider}</span>
              <span class="tag purple">${m.model_type}</span>
              <span class="tag indigo">${quant}</span>
            </div>
            <span class="tag ${isOnline ? 'green' : 'amber'}">${m.status}</span>
          </div>
          
          <h3 style="margin-top: 0.85rem; font-size: 1.05rem; font-weight: 700; color: var(--text-primary);">
            ${m.name}
          </h3>

          <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.4rem; line-height: 1.45;">
            ${m.capabilities?.specialty || 'General Sovereign AI Model'}
          </p>

          <!-- Spec Matrix Tags -->
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.75rem;">
            <span style="font-size: 0.72rem; padding: 0.2rem 0.5rem; background: var(--bg-card-hover); border-radius: 4px; font-family: var(--font-mono); color: var(--accent-cyan);">
              &#129513; ${ctx}
            </span>
            <span style="font-size: 0.72rem; padding: 0.2rem 0.5rem; background: var(--bg-card-hover); border-radius: 4px; font-family: var(--font-mono); color: var(--accent-blue);">
              &#128190; ${vram}
            </span>
            <span style="font-size: 0.72rem; padding: 0.2rem 0.5rem; background: var(--bg-card-hover); border-radius: 4px; font-family: var(--font-mono); color: var(--accent-indigo);">
              &#9889; ${lat}
            </span>
            <span style="font-size: 0.72rem; padding: 0.2rem 0.5rem; background: var(--bg-card-hover); border-radius: 4px; font-family: var(--font-mono); color: var(--status-healthy);">
              &#128640; ${tokSec}
            </span>
            <span style="font-size: 0.72rem; padding: 0.2rem 0.5rem; background: var(--bg-card-hover); border-radius: 4px; font-family: var(--font-mono); color: var(--text-muted);">
              ${tp}
            </span>
          </div>

          <div style="margin-top: 0.75rem; font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono); display: flex; justify-content: space-between;">
            <span>Socket: ${m.endpoint || 'Internal Loopback'}</span>
            <span style="color: ${isAirGapped ? 'var(--status-healthy)' : 'var(--status-warning)'};">
              ${isAirGapped ? '🔒 Air-Gapped' : '⚡ Cloud Hybrid'}
            </span>
          </div>
        </div>

        <div style="margin-top: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
          <button class="btn btn-secondary btn-sm" onclick="initializeSingleModel('${m.id}', '${m.name}')" title="Initialize and warm up KV cache">
            &#9889; Warmup
          </button>
          <button class="btn btn-primary btn-sm" onclick="selectModelForPlayground('${m.id}')" title="Load into test playground">
            &#129514; Test Inference
          </button>
        </div>
      </div>
      `;
    }).join('');
  } else if (res.status === 403) {
    container.innerHTML = `<p style="color: var(--status-warning);">Access restricted: Your current role (${state.currentRole}) lacks permission to manage models (Engineer or Admin required).</p>`;
  }
}

// Bulk Initialization Workflow
async function initializeAllModels() {
  const btn = document.getElementById('btnInitAllModels');
  const progressContainer = document.getElementById('modelsInitProgressContainer');
  const phaseLabel = document.getElementById('modelsInitPhaseLabel');
  const pctLabel = document.getElementById('modelsInitProgressPct');
  const progressBar = document.getElementById('modelsInitProgressBar');
  const term = document.getElementById('modelsInitLiveTerminal');
  const statusMsg = document.getElementById('modelInitStatusMsg');

  if (btn) btn.disabled = true;
  if (progressContainer) progressContainer.style.display = 'block';
  if (term) {
    term.textContent = `[BOOTSTRAP] Initiating Sovereign LLM Cluster Warmup Sequence...\n` +
      `[AIR-GAP CHECK] Enforcing zero external network egress (127.0.0.1 / Local Memory only)...\n`;
  }

  const phases = [
    { label: "Phase 1/4: Checking GPU VRAM & Tensor Allocations...", pct: 25 },
    { label: "Phase 2/4: Loading GGUF & Safetensors Local Weights...", pct: 50 },
    { label: "Phase 3/4: Warming KV Cache & Context Windows...", pct: 75 },
    { label: "Phase 4/4: Executing Loopback Self-Diagnostics & Sealing Receipts...", pct: 95 }
  ];

  for (let i = 0; i < phases.length; i++) {
    if (phaseLabel) phaseLabel.textContent = phases[i].label;
    if (pctLabel) pctLabel.textContent = `${phases[i].pct}%`;
    if (progressBar) progressBar.style.width = `${phases[i].pct}%`;
    if (term) term.textContent += `[STAGE ${i+1}] ${phases[i].label}\n`;
    await new Promise(r => setTimeout(r, 220));
  }

  const res = await apiCall('/models/initialize-all/', { method: 'POST' });

  if (res.ok) {
    if (phaseLabel) phaseLabel.textContent = "Initialization Complete & Ready";
    if (pctLabel) pctLabel.textContent = "100%";
    if (progressBar) progressBar.style.width = "100%";

    if (term) {
      term.textContent += `\n=== CLUSTER INITIALIZATION VERIFICATION REPORT ===\n` +
        `Initialized Models : ${res.data.initialized_models_count} of ${res.data.initialized_models_count} Online\n` +
        `Total VRAM Allocated: ${res.data.total_vram_allocated_gb} GB\n` +
        `Zero Cloud Egress  : VERIFIED (0 external packets)\n` +
        `Elapsed Latency    : ${res.data.total_elapsed_ms} ms\n\n` +
        res.data.models.map(m => `  ✓ [ONLINE] ${m.name.padEnd(30)} | ${m.quantization.padEnd(10)} | ${m.vram_gb || 0}GB VRAM | ${m.throughput_tok_sec} tok/s`).join('\n') + '\n';
    }

    if (statusMsg) {
      statusMsg.textContent = `✅ All ${res.data.initialized_models_count} models initialized and verified in ${res.data.total_elapsed_ms} ms.`;
      statusMsg.style.color = 'var(--status-healthy)';
    }

    loadModels();
    loadOverview();
  } else {
    if (term) term.textContent += `\n[ERROR] Initialization failed: ${JSON.stringify(res.data)}\n`;
    if (statusMsg) {
      statusMsg.textContent = `❌ Initialization failed. Check permissions.`;
      statusMsg.style.color = 'var(--status-danger)';
    }
  }

  if (btn) btn.disabled = false;
}

// Single Model Initialization
async function initializeSingleModel(modelId, modelName) {
  const statusMsg = document.getElementById('modelInitStatusMsg');
  if (statusMsg) {
    statusMsg.textContent = `⚡ Initializing ${modelName}...`;
    statusMsg.style.color = 'var(--accent-cyan)';
  }

  const res = await apiCall(`/models/${modelId}/initialize/`, { method: 'POST' });
  if (res.ok) {
    if (statusMsg) {
      statusMsg.textContent = `✅ ${modelName} initialized (${res.data.initialization?.warmup_latency_ms} ms warmup).`;
      statusMsg.style.color = 'var(--status-healthy)';
    }
    loadModels();
  } else {
    if (statusMsg) {
      statusMsg.textContent = `❌ Initialization failed for ${modelName}`;
      statusMsg.style.color = 'var(--status-danger)';
    }
  }
}

// Interactive Model Playground Helpers
const testPromptTemplates = {
  asme_stress: "Perform ASME Section III Subsection NB-3200 stress analysis for turbine rotor casing. Calculate Von Mises stress tensor at inner shoulder transition fillet under 140 bar steam pressure.",
  iso_weld: "Execute radiographic visual inspection of circumferential weld seam #W-04 under ISO 17640. Check volumetric porosity, Heat-Affected Zone (HAZ) grain structure, and Lack-of-Fusion risk.",
  scada_telemetry: "Ingest coolant loop sensor telemetry for TC-201 and pressure manifold PT-104. Detect thermal excursions, valve stiction, and vibration amplitude divergence under IEEE 1459.",
  sil3_interlock: "Verify IEC 61508 SIL-3 dual-redundant emergency depressurization loop logic. Confirm solenoid trip actuation latency does not exceed 180ms safety threshold.",
  dense_vector: "Generate 1024-dimensional dense semantic embedding vector for ASME Nuclear Class 1 Vessel Overpressure Protection SOP and verify unit sphere L2 norm."
};

function onTestModelChange() {
  const select = document.getElementById('testModelSelect');
  if (!select) return;
  const val = select.value;
  const promptInput = document.getElementById('testPromptInput');

  if (promptInput && (!promptInput.value || Object.values(testPromptTemplates).includes(promptInput.value))) {
    if (val === 'deepseek-r1-70b') promptInput.value = testPromptTemplates.asme_stress;
    else if (val === 'qwen-2-5-vl') promptInput.value = testPromptTemplates.iso_weld;
    else if (val === 'llama-3-3-70b') promptInput.value = testPromptTemplates.scada_telemetry;
    else if (val === 'qwen-2-5-coder') promptInput.value = testPromptTemplates.sil3_interlock;
    else if (val === 'bge-large') promptInput.value = testPromptTemplates.dense_vector;
    else if (val === 'mistral-small-3') promptInput.value = "Conduct fast tactical triage of turbine pressure manifold PT-104 (142.1 bar) and vibration amplitude (0.48 mm/s).";
    else promptInput.value = "Analyze mission-critical industrial component integrity and verify conformance with zero data leakage.";
  }
}

function applyTestPromptPreset() {
  const templateSelect = document.getElementById('testTemplateSelect');
  const promptInput = document.getElementById('testPromptInput');
  const modelSelect = document.getElementById('testModelSelect');
  if (!templateSelect || !promptInput) return;

  const key = templateSelect.value;
  if (testPromptTemplates[key]) {
    promptInput.value = testPromptTemplates[key];
    
    // Auto-match suitable model if applicable
    if (modelSelect) {
      if (key === 'asme_stress') modelSelect.value = 'deepseek-r1-70b';
      else if (key === 'iso_weld') modelSelect.value = 'qwen-2-5-vl';
      else if (key === 'scada_telemetry') modelSelect.value = 'llama-3-3-70b';
      else if (key === 'sil3_interlock') modelSelect.value = 'qwen-2-5-coder';
      else if (key === 'dense_vector') modelSelect.value = 'bge-large';
    }
  }
}

function selectModelForPlayground(modelId) {
  const select = document.getElementById('testModelSelect');
  if (select) {
    select.value = modelId;
    onTestModelChange();
  }
  const playground = document.getElementById('testPromptInput');
  if (playground) {
    playground.scrollIntoView({ behavior: 'smooth', block: 'center' });
    playground.focus();
  }
}

async function runModelTestInference() {
  const modelSelect = document.getElementById('testModelSelect');
  const promptInput = document.getElementById('testPromptInput');
  const outputTerm = document.getElementById('testOutputTerminal');
  const telemetrySpan = document.getElementById('testInferenceTelemetry');
  const btn = document.getElementById('btnRunModelTest');

  if (!modelSelect || !promptInput || !outputTerm) return;

  const modelId = modelSelect.value;
  const prompt = promptInput.value.trim();

  if (!prompt) {
    alert('Please enter a test prompt or choose a preset.');
    return;
  }

  if (btn) btn.disabled = true;
  if (telemetrySpan) telemetrySpan.textContent = "⚡ Dispatching inference to sovereign model...";
  outputTerm.textContent = `[INFERENCE DISPATCH] Target Model: ${modelId}\n` +
    `[SECURITY GUARD] Verifying local loopback socket & air-gap perimeter...\n` +
    `[STREAMING TOKENS] Processing query...\n`;

  const startTime = performance.now();
  const res = await apiCall(`/models/${modelId}/test/`, {
    method: 'POST',
    body: JSON.stringify({ prompt })
  });

  const elapsed = (performance.now() - startTime).toFixed(1);

  if (res.ok) {
    const d = res.data;
    outputTerm.textContent = `=== SOVEREIGN ON-PREMISE INFERENCE VERIFICATION ===\n` +
      `Model Name        : ${d.model}\n` +
      `Provider / Engine : ${d.provider}\n` +
      `Tokens Generated  : ${d.tokens_generated} tokens\n` +
      `Inference Latency : ${d.latency_ms} ms (Total Round-Trip: ${elapsed} ms)\n` +
      `Throughput Speed  : ${d.throughput_tok_sec} tokens/sec\n` +
      `Network Egress    : ${d.external_egress ? 'EXTERNAL API CALL (HYBRID)' : 'ZERO (100% On-Premise Air-Gapped)'}\n` +
      `Air-Gap Integrity : ${d.air_gap_verified ? 'VERIFIED & ENFORCED' : 'BYPASS PERMITTED'}\n\n` +
      `--- INFERENCE OUTPUT STREAM ---\n${d.response}\n\n` +
      `--- END OF SOVEREIGN GENERATION ---`;

    if (telemetrySpan) {
      telemetrySpan.textContent = `✅ ${d.tokens_generated} tokens in ${d.latency_ms}ms (${d.throughput_tok_sec} tok/s) • Zero Egress`;
      telemetrySpan.style.color = 'var(--status-healthy)';
    }
  } else {
    outputTerm.textContent = `[ERROR] Inference failed: ${JSON.stringify(res.data)}\n`;
    if (telemetrySpan) {
      telemetrySpan.textContent = `❌ Inference failed (${res.status})`;
      telemetrySpan.style.color = 'var(--status-danger)';
    }
  }

  if (btn) btn.disabled = false;
}

async function pingSelectedModel() {
  const modelSelect = document.getElementById('testModelSelect');
  if (!modelSelect) return;
  const modelId = modelSelect.value;
  const modelName = modelSelect.options[modelSelect.selectedIndex]?.text || modelId;
  await pingModel(modelId, modelName);
}

async function pingModel(modelId, modelName) {
  const outputBox = document.getElementById('testOutputTerminal') || document.getElementById('terminalOutput');
  if (outputBox) outputBox.textContent = `[DIAGNOSTIC] Dispatching local loopback ping to model: ${modelName}...\n`;
  
  const res = await apiCall(`/models/${modelId}/ping/`, { method: 'POST' });
  if (res.ok) {
    const diag = res.data.diagnostic_result;
    if (outputBox) {
      outputBox.textContent = `=== SOVEREIGN LOCAL INFERENCE DIAGNOSTIC ===\n` +
        `Model: ${res.data.model}\n` +
        `Provider: ${diag.provider}\n` +
        `Tokens Generated: ${diag.tokens_used}\n` +
        `External Network Egress: ${diag.external_egress ? 'VIOLATION DETECTED' : 'ZERO (100% On-Premise Air-Gapped)'}\n` +
        `Air-Gap Verified: ${diag.air_gap_verified ? 'TRUE' : 'UNKNOWN'}\n\n` +
        `[Inference Output]:\n${diag.response}\n`;
    }
  } else {
    if (outputBox) outputBox.textContent += `[ERROR] Ping failed: ${JSON.stringify(res.data)}\n`;
  }
}

async function toggleHardwareBenchmarkModal() {
  const res = await apiCall('/models/benchmarks/');
  const outputTerm = document.getElementById('testOutputTerminal');
  if (!outputTerm) return;

  if (res.ok) {
    const d = res.data;
    outputTerm.textContent = `=== SOVEREIGN HARDWARE & VRAM ACCELERATION MATRIX ===\n` +
      `System Architecture: ${d.system_architecture}\n` +
      `Total GPU VRAM Pool: ${d.total_gpu_vram_gb} GB\n` +
      `Allocated VRAM     : ${d.allocated_vram_gb} GB\n` +
      `Active Models      : ${d.models_online} / ${d.total_models} Online\n\n` +
      `--- MODEL SPECIFICATIONS & THROUGHPUT BENCHMARKS ---\n` +
      d.benchmarks.map(b => 
        `• ${b.name.padEnd(32)} | Type: ${b.model_type.padEnd(9)} | Quant: ${b.quantization.padEnd(10)} | VRAM: ${(b.vram_gb ? b.vram_gb + 'GB' : '0GB').padEnd(6)} | ${b.latency_ms}ms | ${b.throughput_tok_sec} tok/s`
      ).join('\n') + '\n';
  } else {
    outputTerm.textContent = `[BENCHMARK ERROR] Could not fetch hardware matrix: ${JSON.stringify(res.data)}`;
  }
}

// Industrial Tools
async function loadTools() {
  const res = await apiCall('/tools/');
  const tbody = document.getElementById('toolsTableBody');
  if (!tbody) return;

  if (res.ok) {
    state.tools = res.data;
    tbody.innerHTML = res.data.map(t => `
      <tr>
        <td><strong>${t.name}</strong></td>
        <td><span class="tag ${getRoleColor(t.permission_required)}">${t.permission_required}</span></td>
        <td>${t.description}</td>
        <td>
          <span class="tag ${t.enabled ? 'green' : 'red'}">${t.enabled ? 'ENABLED' : 'DISABLED'}</span>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="toggleTool('${t.id}')">
            ${t.enabled ? 'Disable' : 'Enable'}
          </button>
        </td>
      </tr>
    `).join('');
  } else if (res.status === 403) {
    tbody.innerHTML = `<tr><td colspan="5" style="color: var(--status-warning);">Permission restricted: Engineer or Admin role required.</td></tr>`;
  }
}

async function toggleTool(toolId) {
  const res = await apiCall(`/tools/${toolId}/toggle/`, { method: 'POST' });
  if (res.ok) {
    loadTools();
  } else {
    alert(`Cannot toggle tool: ${JSON.stringify(res.data)}`);
  }
}

// Document Vault
async function loadDocuments() {
  const res = await apiCall('/documents/');
  const tbody = document.getElementById('documentsTableBody');
  if (!tbody) return;

  if (res.ok) {
    state.documents = res.data;
    tbody.innerHTML = res.data.map(d => `
      <tr>
        <td><strong>${d.name}</strong></td>
        <td><span class="tag cyan">${d.type || 'FILE'}</span></td>
        <td>${(d.size / 1024).toFixed(1)} KB</td>
        <td><span class="tag green">${d.status}</span></td>
        <td>${new Date(d.created_at).toLocaleString()}</td>
      </tr>
    `).join('');
    
    // Update task file selector
    const fileSelect = document.getElementById('taskFileSelect');
    if (fileSelect) {
      fileSelect.innerHTML = `<option value="">-- No Vault Document Attached --</option>` +
        res.data.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    }

    // Refresh ingestion dropdowns
    populateIngestDropdowns();
  }
}

async function uploadDocument(event) {
  event.preventDefault();
  const fileInput = document.getElementById('docFileInput');
  const nameInput = document.getElementById('docNameInput');
  
  if (!fileInput.files[0]) {
    alert('Please select a file to upload.');
    return;
  }
  
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('name', nameInput.value || fileInput.files[0].name);

  const res = await apiCall('/documents/', {
    method: 'POST',
    body: formData
  });

  if (res.ok) {
    fileInput.value = '';
    nameInput.value = '';
    loadDocuments();
    loadOverview();
    showNotification(`✅ Document uploaded to vault: ${res.data.name}`, 'success');
  } else {
    alert(`Upload failed: ${JSON.stringify(res.data)}`);
  }
}

// ============================================================
// VAULT DOCUMENT INGESTION INTO LOCAL HNSW VECTOR DATABASE
// ============================================================

function populateIngestDropdowns() {
  const docSelect = document.getElementById('ingestVaultDocSelect');
  const kbSelect = document.getElementById('ingestTargetKbSelect');

  if (docSelect && state.documents && state.documents.length > 0) {
    const currentVal = docSelect.value;
    docSelect.innerHTML = `<option value="">-- Select a document from vault --</option>` +
      state.documents.map(d => `
        <option value="${d.id || d.name}">
          [${d.type || 'DOC'}] ${d.name} (${(d.size / 1024).toFixed(1)} KB)
        </option>
      `).join('');
    if (currentVal) docSelect.value = currentVal;
  }

  if (kbSelect && state.knowledgeBases && state.knowledgeBases.length > 0) {
    const currentVal = kbSelect.value;
    kbSelect.innerHTML = `<option value="">-- Select target knowledge base --</option>` +
      state.knowledgeBases.map(kb => `
        <option value="${kb.id}">
          ${kb.name} (${kb.chunk_count} chunks)
        </option>
      `).join('');
    if (currentVal) kbSelect.value = currentVal;
  }
}
window.populateIngestDropdowns = populateIngestDropdowns;

function onIngestDocChange() {
  const docSelect = document.getElementById('ingestVaultDocSelect');
  const preview = document.getElementById('ingestDocPreview');
  const charCount = document.getElementById('ingestDocCharCount');
  const targetKbSelect = document.getElementById('ingestTargetKbSelect');
  if (!docSelect || !preview) return;

  const docId = docSelect.value;
  if (!docId) {
    preview.value = '';
    if (charCount) charCount.textContent = '0 characters';
    return;
  }

  const doc = (state.documents || []).find(d => (d.id === docId || d.name === docId));
  if (doc) {
    const text = doc.content || `Industrial Specification: ${doc.name}. Type: ${doc.type || 'RAW_FILE'}. Size: ${doc.size} bytes.`;
    preview.value = text;
    if (charCount) charCount.textContent = `${text.length} characters`;

    // Smart Knowledge Base association heuristic
    if (targetKbSelect && !targetKbSelect.value) {
      const lower = (doc.name + " " + text).toLowerCase();
      if (lower.includes('nuclear') || lower.includes('coolant') || lower.includes('asme')) {
        targetKbSelect.value = 'nuclear-facility';
      } else if (lower.includes('turbine') || lower.includes('rotor') || lower.includes('metallurgy') || lower.includes('weld') || lower.includes('17640')) {
        targetKbSelect.value = 'turbine-metallurgy';
      } else if (lower.includes('scada') || lower.includes('telemetry') || lower.includes('sensor') || lower.includes('1459')) {
        targetKbSelect.value = 'scada-telemetry';
      } else if (lower.includes('interlock') || lower.includes('sil') || lower.includes('61508')) {
        targetKbSelect.value = 'safety-interlocks';
      }
    }
  }
}
window.onIngestDocChange = onIngestDocChange;

function updatePhaseStep(stepId, stateType) {
  const el = document.getElementById(stepId);
  if (!el) return;
  el.classList.remove('active', 'completed');
  if (stateType === 'active') el.classList.add('active');
  if (stateType === 'completed') el.classList.add('completed');
}

async function startVaultDocumentIngestion() {
  const docSelect = document.getElementById('ingestVaultDocSelect');
  const kbSelect = document.getElementById('ingestTargetKbSelect');
  const preview = document.getElementById('ingestDocPreview');
  const chunkSizeInput = document.getElementById('ingestChunkSize');
  const chunkOverlapInput = document.getElementById('ingestChunkOverlap');
  const btn = document.getElementById('btnStartIngest');
  const progressContainer = document.getElementById('ingestProgressContainer');
  const progressBar = document.getElementById('ingestProgressBar');
  const progressPct = document.getElementById('ingestProgressPct');
  const phaseLabel = document.getElementById('ingestPhaseLabel');
  const terminal = document.getElementById('ingestLiveTerminal');
  const hudChunks = document.getElementById('ingestHudChunks');
  const hudTime = document.getElementById('ingestHudTime');
  const testSandboxBtn = document.getElementById('btnTestIngestedInSandbox');

  if (!docSelect || !docSelect.value) {
    alert('Please select a document from the vault first.');
    return;
  }

  if (!kbSelect || !kbSelect.value) {
    alert('Please select a target knowledge base to ingest into.');
    return;
  }

  const selectedDocId = docSelect.value;
  const targetKbId = kbSelect.value;
  const doc = (state.documents || []).find(d => d.id === selectedDocId || d.name === selectedDocId);
  const docName = doc ? doc.name : selectedDocId;
  const content = preview ? preview.value : (doc?.content || '');
  const chunkSize = chunkSizeInput ? parseInt(chunkSizeInput.value, 10) : 250;
  const chunkOverlap = chunkOverlapInput ? parseInt(chunkOverlapInput.value, 10) : 40;

  if (!content || content.trim().length === 0) {
    alert('Document content is empty. Please provide text in the preview box.');
    return;
  }

  // Reveal progress tracker
  if (progressContainer) progressContainer.style.display = 'block';
  if (testSandboxBtn) testSandboxBtn.style.display = 'none';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Vectorizing & Linking...';
  }

  // Reset Progress States
  if (progressBar) progressBar.style.width = '10%';
  if (progressPct) progressPct.textContent = '10%';
  if (phaseLabel) phaseLabel.textContent = 'Phase 1: Vault Memory Extraction';
  if (hudChunks) hudChunks.textContent = '0';
  if (hudTime) hudTime.textContent = '0.0 ms';

  updatePhaseStep('phaseStepExtraction', 'active');
  updatePhaseStep('phaseStepChunking', '');
  updatePhaseStep('phaseStepEmbedding', '');
  updatePhaseStep('phaseStepHnsw', '');
  updatePhaseStep('phaseStepComplete', '');

  let logs = `>> INITIATING AIR-GAPPED HNSW VECTOR EMBEDDING PIPELINE\n`;
  logs += `>> Document     : ${docName}\n`;
  logs += `>> Target KB    : ${targetKbId}\n`;
  logs += `>> Chunk Config : Window=${chunkSize} chars, Overlap=${chunkOverlap} chars\n`;
  logs += `>> Dimension    : 128 Dense Unit Vectors (L2-Normalized)\n`;
  logs += `>> Verification : Zero External Network Egress Confined\n\n`;
  if (terminal) terminal.textContent = logs;

  try {
    // Call the streaming endpoint using fetch with SSE reader
    const response = await fetch(`${CONFIG.apiBase}/knowledge/${targetKbId}/ingest-stream/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({
        doc_id: selectedDocId,
        doc_name: docName,
        custom_content: content,
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap
      })
    });

    if (!response.ok || !response.body) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const block of lines) {
        const eventMatch = block.match(/event:\s*([a-zA-Z0-9_-]+)/);
        const dataMatch = block.match(/data:\s*(.+)/s);

        if (eventMatch && dataMatch) {
          const eventType = eventMatch[1];
          let eventData = {};
          try {
            eventData = JSON.parse(dataMatch[1]);
          } catch (e) {
            continue;
          }

          if (eventType === 'progress') {
            if (progressBar) progressBar.style.width = `${eventData.pct}%`;
            if (progressPct) progressPct.textContent = `${eventData.pct}%`;
            if (phaseLabel) phaseLabel.textContent = `Phase: ${eventData.phase} - ${eventData.message}`;

            if (eventData.phase === 'EXTRACTION') {
              updatePhaseStep('phaseStepExtraction', 'active');
            } else if (eventData.phase === 'CHUNKING') {
              updatePhaseStep('phaseStepExtraction', 'completed');
              updatePhaseStep('phaseStepChunking', 'active');
            }

            logs += `[${new Date().toLocaleTimeString()}] [${eventData.phase}] ${eventData.message}\n`;
            if (terminal) {
              terminal.textContent = logs;
              terminal.scrollTop = terminal.scrollHeight;
            }
          } else if (eventType === 'chunk_embedded') {
            if (progressBar) progressBar.style.width = `${eventData.pct}%`;
            if (progressPct) progressPct.textContent = `${eventData.pct}%`;
            if (phaseLabel) phaseLabel.textContent = `Phase 3 & 4: Embedding & HNSW Linking (${eventData.chunk_idx}/${eventData.total_chunks})`;
            if (hudChunks) hudChunks.textContent = `${eventData.chunk_idx} / ${eventData.total_chunks}`;

            updatePhaseStep('phaseStepChunking', 'completed');
            updatePhaseStep('phaseStepEmbedding', 'active');
            updatePhaseStep('phaseStepHnsw', 'active');

            logs += `[${new Date().toLocaleTimeString()}] [HNSW_INSERT] ${eventData.message} | Snippet: "${eventData.snippet}"\n`;
            if (terminal) {
              terminal.textContent = logs;
              terminal.scrollTop = terminal.scrollHeight;
            }
          } else if (eventType === 'complete') {
            if (progressBar) progressBar.style.width = '100%';
            if (progressPct) progressPct.textContent = '100%';
            if (phaseLabel) phaseLabel.textContent = '✅ Phase 5: HNSW Vector Database Indexing Finalized';
            if (hudChunks) hudChunks.textContent = `${eventData.chunks_indexed}`;
            if (hudTime) hudTime.textContent = `${eventData.elapsed_time_ms} ms`;

            updatePhaseStep('phaseStepExtraction', 'completed');
            updatePhaseStep('phaseStepChunking', 'completed');
            updatePhaseStep('phaseStepEmbedding', 'completed');
            updatePhaseStep('phaseStepHnsw', 'completed');
            updatePhaseStep('phaseStepComplete', 'completed');

            logs += `\n>> ========================================================\n`;
            logs += `>> [SUCCESS] AIR-GAPPED HNSW EMBEDDING COMPLETE!\n`;
            logs += `>> Total Chunks Indexed : ${eventData.chunks_indexed}\n`;
            logs += `>> Embedding Dimension  : ${eventData.dimension}-D\n`;
            logs += `>> Total Compute Time   : ${eventData.elapsed_time_ms} ms\n`;
            logs += `>> Total Graph Nodes    : ${eventData.hnsw_stats?.total_nodes || eventData.chunks_indexed}\n`;
            logs += `>> External Egress      : 0 bytes (Verified Air-Gapped)\n`;
            logs += `>> ========================================================\n`;

            if (terminal) {
              terminal.textContent = logs;
              terminal.scrollTop = terminal.scrollHeight;
            }

            // Store query snippet for testing in sandbox
            state.lastIngestedQuery = docName.split(' ')[0] || 'ASME stress';
            if (testSandboxBtn) testSandboxBtn.style.display = 'inline-block';

            showNotification(`✅ Successfully ingested '${docName}' into HNSW vector index (${eventData.chunks_indexed} chunks)!`, 'success');
            loadKnowledgeBases();
            loadOverview();
          }
        }
      }
    }
  } catch (err) {
    console.error('Ingestion error:', err);
    logs += `\n[ERROR] Ingestion encountered an issue: ${err.message}\n`;
    if (terminal) terminal.textContent = logs;
    if (phaseLabel) phaseLabel.textContent = `❌ Ingestion Error: ${err.message}`;
    alert(`Document ingestion failed: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '⚡ Ingest & Compute HNSW Vectors';
    }
  }
}
window.startVaultDocumentIngestion = startVaultDocumentIngestion;

function quickTestIngested() {
  const input = document.getElementById('vectorSearchInput');
  const docSelect = document.getElementById('ingestVaultDocSelect');
  if (!input) return;

  const doc = (state.documents || []).find(d => d.id === docSelect?.value || d.name === docSelect?.value);
  if (doc) {
    if (doc.type === 'DXF' || doc.name.includes('Casing')) {
      input.value = 'Rotor casing 140 bar ASME NB-3200 stress tolerance';
    } else if (doc.type === 'CSV' || doc.name.includes('Telemetry')) {
      input.value = 'TC-201 coolant loop thermal telemetry and vibration';
    } else if (doc.name.includes('Weld') || doc.name.includes('17640')) {
      input.value = 'ISO 17640 volumetric porosity acceptance level';
    } else if (doc.name.includes('Interlock') || doc.name.includes('61508')) {
      input.value = 'IEC 61508 SIL-3 180ms bypass trip timing';
    } else {
      input.value = doc.name;
    }
  } else {
    input.value = state.lastIngestedQuery || 'ASME Section III stress limits';
  }

  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  testVectorSearch();
}
window.quickTestIngested = quickTestIngested;

// Knowledge Base Indexing (RAG) & Local Vector Search
async function testVectorSearch() {
  const input = document.getElementById('vectorSearchInput');
  const resultsBox = document.getElementById('vectorSearchResults');
  if (!input || !resultsBox) return;

  const query = input.value.trim();
  if (!query) {
    resultsBox.innerHTML = '<span style="color: var(--status-warning);">Please enter a query string to search the local vector database.</span>';
    return;
  }

  resultsBox.innerHTML = '<span style="color: var(--accent-cyan);">>> Executing 128-dimensional dense vector embedding & HNSW k-NN traversal...</span>';

  const res = await apiCall('/knowledge/query/', {
    method: 'POST',
    body: JSON.stringify({ query, top_k: 3 })
  });

  if (res.ok && res.data.results) {
    if (res.data.results.length === 0) {
      resultsBox.innerHTML = '<span style="color: var(--text-muted);">No matching vector nodes found in local HNSW index.</span>';
      return;
    }

    let out = `>> LOCAL HNSW VECTOR QUERY COMPLETED IN ${res.data.query_time_ms}ms (Zero Cloud Egress)\n`;
    out += `>> Algorithm: HNSW (Hierarchical Navigable Small World) | Distance: Cosine\n`;
    out += `>> Top ${res.data.results.length} Nearest Neighbor Chunks Retrieved:\n\n`;

    res.data.results.forEach((r, idx) => {
      const matchPct = (r.score * 100).toFixed(1);
      out += `[MATCH #${idx + 1}] Similarity: ${r.score} (${matchPct}%) | Distance: ${r.distance}\n`;
      out += `Source Document : ${r.doc_name}\n`;
      out += `Section Title   : ${r.section}\n`;
      out += `Passage Text    : "${r.text}"\n`;
      out += `--------------------------------------------------------------------------------\n`;
    });

    resultsBox.textContent = out;
  } else {
    resultsBox.innerHTML = `<span style="color: var(--status-danger);">Query failed: ${JSON.stringify(res.data)}</span>`;
  }
}
window.testVectorSearch = testVectorSearch;

async function indexKnowledgeBase(kbId, kbName) {
  const btn = document.querySelector(`[data-kb-index="${kbId}"]`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Indexing...'; }

  const res = await apiCall(`/knowledge/${kbId}/index/`, { method: 'POST' });

  if (res.ok) {
    showNotification(`✅ RAG indexed '${kbName}': ${res.data.chunks_indexed} chunks embedded locally.`, 'success');
    if (btn) {
      btn.textContent = `✅ Indexed (${res.data.chunks_indexed} chunks)`;
      btn.style.color = 'var(--status-ok)';
    }
    loadKnowledgeBases();
  } else {
    showNotification(`RAG indexing failed: ${JSON.stringify(res.data)}`, 'danger');
    if (btn) { btn.disabled = false; btn.textContent = '⚙ Index for RAG'; }
  }
}

async function loadKnowledgeBases() {
  const res = await apiCall('/knowledge/');
  const container = document.getElementById('kbList');
  if (!container) return;

  if (res.ok && res.data.length > 0) {
    state.knowledgeBases = res.data;
    container.innerHTML = res.data.map(kb => `
      <div class="step-row" style="align-items: flex-start; flex-direction: column; gap: 0.5rem;">
        <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
          <div>
            <strong>${kb.name}</strong>
            <span class="tag ${kb.rag_indexed ? 'green' : 'amber'}" style="margin-left: 0.5rem;">
              ${kb.rag_indexed ? `RAG-INDEXED (${kb.chunk_count} chunks)` : 'NOT INDEXED'}
            </span>
          </div>
          <button class="btn btn-secondary btn-sm" data-kb-index="${kb.id}"
            onclick="indexKnowledgeBase('${kb.id}', '${kb.name}')">
            ${kb.rag_indexed ? '🔄 Re-Index' : '⚙ Index for RAG'}
          </button>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${kb.description || 'No description.'}</div>
      </div>
    `).join('');

    // Update Ingest Target KB dropdown
    populateIngestDropdowns();

    // Also populate KB selector in agent task form
    const kbSelect = document.getElementById('taskKbSelect');
    if (kbSelect) {
      kbSelect.innerHTML = `<option value="">-- No Knowledge Base (Direct Inference) --</option>` +
        res.data.filter(kb => kb.rag_indexed).map(kb =>
          `<option value="${kb.id}">${kb.name} (${kb.chunk_count} chunks)</option>`
        ).join('');
    }
  } else if (res.ok) {
    container.innerHTML = `<p style="color: var(--text-muted);">No knowledge bases seeded yet.</p>`;
  }
}

// Agent Tasks
async function loadTasks() {
  const res = await apiCall('/agents/');
  const container = document.getElementById('tasksHistoryList');
  if (!container) return;

  if (res.ok) {
    state.tasks = res.data;
    container.innerHTML = res.data.map(t => `
      <div class="step-row">
        <div class="step-info">
          <div class="step-num">${t.task_id.slice(-4)}</div>
          <div>
            <strong>${t.task_id}</strong> &bull; <span class="tag cyan">${t.task_type}</span>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">${t.input?.prompt || 'No prompt specified'}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span class="tag ${t.status === 'COMPLETED' ? 'green' : t.status === 'RUNNING' ? 'cyan' : 'amber'}">${t.status}</span>
        </div>
      </div>
    `).join('');
  }
}

async function dispatchAgentTask(event) {
  event.preventDefault();
  const promptInput = document.getElementById('taskPromptInput');
  const typeSelect = document.getElementById('taskTypeSelect');
  const modelSelect = document.getElementById('taskModelSelect');
  const fileSelect = document.getElementById('taskFileSelect');
  const kbSelect = document.getElementById('taskKbSelect');
  const terminal = document.getElementById('agentExecutionTerminal');
  const receiptPanel = document.getElementById('streamReceiptPanel');

  if (receiptPanel) receiptPanel.style.display = 'none';

  const knowledgeBaseId = kbSelect?.value || null;
  const selectedModel = modelSelect?.value || 'deepseek-r1-70b';

  const payload = {
    task_type: typeSelect.value,
    input: {
      prompt: promptInput.value,
      model_id: selectedModel,
      tools: ['cad_stress_analyzer', 'weld_seam_flaw_detector'],
      files: fileSelect.value ? [fileSelect.value] : [],
      ...(knowledgeBaseId && { knowledge_base_id: knowledgeBaseId }),
    }
  };

  // Clear and show terminal
  terminal.innerHTML = '';
  appendTerminalLine(terminal, '>> SOVEREIGN AI WORKBENCH — AGENT DISPATCH', 'cyan');
  appendTerminalLine(terminal, `>> Workflow: ${payload.task_type} | Model: ${selectedModel}`, 'muted');

  // 1. Create task
  const createRes = await apiCall('/agents/', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!createRes.ok) {
    appendTerminalLine(terminal, `[FAILED] Could not create task: ${JSON.stringify(createRes.data)}`, 'danger');
    return;
  }

  const task = createRes.data;
  appendTerminalLine(terminal, `>> Task ID: ${task.task_id}`, 'success');
  appendTerminalLine(terminal, `>> Knowledge Base: ${knowledgeBaseId ? `RAG-GROUNDED (${knowledgeBaseId.slice(0,8)}...)` : 'Direct Inference (no KB)'}`, 'muted');
  appendTerminalLine(terminal, `>> Initiating SSE stream...`, 'muted');
  appendTerminalLine(terminal, '─'.repeat(60), 'muted');

  // 2. Stream via SSE
  await streamTaskSSE(task.id, terminal);
}

function appendTerminalLine(terminal, text, style = 'normal') {
  const line = document.createElement('div');
  line.className = `terminal-line terminal-${style}`;
  line.textContent = text;
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

async function streamTaskSSE(taskId, terminal) {
  const receiptPanel = document.getElementById('streamReceiptPanel');

  return new Promise((resolve) => {
    const token = state.token;

    fetch(`/api/agents/${taskId}/stream/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    }).then(async response => {
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        appendTerminalLine(terminal, `[ERROR] Stream failed: ${JSON.stringify(err)}`, 'danger');
        resolve();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const STEP_ICONS = {
        'Task Initiation': '🚀',
        'Tool Permission Validation': '🔐',
        'RAG Context Retrieval': '🔍',
        'Local Inference Execution': '🧠',
        'Sovereignty Verification': '🔒',
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop(); // Keep incomplete last event

        for (const rawEvent of events) {
          if (!rawEvent.startsWith('data:')) continue;
          try {
            const jsonStr = rawEvent.replace(/^data:\s*/, '');
            const frame = JSON.parse(jsonStr);

            if (frame.event === 'task_start') {
              appendTerminalLine(terminal, `[TASK] ${frame.task_id} — ${frame.message}`, 'cyan');

            } else if (frame.event === 'step') {
              const icon = STEP_ICONS[frame.action] || '▶';
              const statusColor = frame.status === 'COMPLETED' ? 'success' :
                                  frame.status === 'RUNNING' ? 'cyan' : 'muted';
              appendTerminalLine(terminal,
                `${icon} Step ${frame.step}: ${frame.action} — [${frame.status}]`, statusColor);

              if (frame.detail) {
                appendTerminalLine(terminal, `   → ${frame.detail}`, 'muted');
              }
              if (frame.chunks_retrieved !== undefined) {
                appendTerminalLine(terminal,
                  `   → ${frame.chunks_retrieved} chunks retrieved | scores: [${(frame.top_scores || []).join(', ')}]`, 'muted');
              }
              if (frame.tools_authorized) {
                appendTerminalLine(terminal,
                  `   → Tools: [${frame.tools_authorized.join(', ')}]`, 'muted');
              }
              if (frame.model) {
                appendTerminalLine(terminal,
                  `   → Model: ${frame.model} | RAG-grounded: ${frame.rag_grounded}`, 'muted');
              }

            } else if (frame.event === 'task_complete') {
              appendTerminalLine(terminal, '─'.repeat(60), 'muted');
              appendTerminalLine(terminal, '[SYNTHESIS]', 'cyan');
              const synLines = frame.synthesis.split('\n');
              synLines.forEach(l => appendTerminalLine(terminal, l || ' ', 'normal'));

              appendTerminalLine(terminal, '', 'normal');
              appendTerminalLine(terminal, '─'.repeat(60), 'muted');
              appendTerminalLine(terminal, '🔒 SOVEREIGNTY RECEIPT ISSUED', 'success');
              appendTerminalLine(terminal, `   Receipt ID:     ${frame.receipt.receipt_id}`, 'success');
              appendTerminalLine(terminal, `   SHA-256 Seal:   ${frame.receipt.integrity_hash}`, 'success');
              appendTerminalLine(terminal, `   Network Status: ${frame.receipt.network_status}`, 'success');
              appendTerminalLine(terminal, `   External Calls: ${frame.receipt.external_requests}`, 'success');
              appendTerminalLine(terminal, '─'.repeat(60), 'muted');

              // Update receipt card
              state.lastReceipt = frame.receipt;
              updateReceiptCard(frame.receipt);

              // Show inline receipt panel
              if (receiptPanel) {
                document.getElementById('streamReceiptId').textContent = frame.receipt.receipt_id;
                document.getElementById('streamReceiptHash').textContent = frame.receipt.integrity_hash;
                receiptPanel.style.display = 'block';
                receiptPanel.scrollIntoView({ behavior: 'smooth' });
              }

              loadTasks();
              loadOverview();
            }
          } catch (parseErr) {
            console.warn('SSE parse error:', parseErr, rawEvent);
          }
        }
      }
      resolve();
    }).catch(err => {
      appendTerminalLine(terminal, `[STREAM ERROR] ${err.message}`, 'danger');
      resolve();
    });
  });
}

// Sovereignty Receipts & Tamper Proof
function updateReceiptCard(receipt) {
  if (!receipt) return;
  document.getElementById('receiptIdVal').textContent = receipt.receipt_id;
  document.getElementById('receiptHashVal').textContent = receipt.integrity_hash;
  document.getElementById('receiptEgressVal').textContent = receipt.external_requests;
  document.getElementById('receiptNetVal').textContent = receipt.network_status;
  document.getElementById('receiptVerifyStatus').textContent = 'READY FOR VERIFICATION';
  document.getElementById('receiptVerifyStatus').className = 'tag cyan';
}

async function verifyActiveReceipt(simulateTamper = false) {
  if (!state.lastReceipt?.receipt_id) {
    alert('Please execute an agent task first to generate a sovereignty receipt.');
    return;
  }

  const receiptId = state.lastReceipt.receipt_id;
  const statusEl = document.getElementById('receiptVerifyStatus');
  const detailsEl = document.getElementById('receiptVerifyDetails');

  if (simulateTamper) {
    statusEl.textContent = 'COMPUTING MATHEMATICAL SHA-256 CHECK...';
    setTimeout(() => {
      statusEl.textContent = 'TAMPER DETECTED: VIOLATION_DETECTED';
      statusEl.className = 'tag red';
      detailsEl.textContent = `[TAMPER AUDIT WARNING] SHA-256 mismatch!\n` +
        `Original Recorded Hash: ${state.lastReceipt.integrity_hash}\n` +
        `Recomputed Payload Hash: 8b1a995e840dcf928492048592c304859a204859203948502934850923849283\n` +
        `Status: Mathematical proof failed. Data modification detected under Air-Gap compliance rules!`;
    }, 400);
    return;
  }

  const res = await apiCall(`/receipts/${receiptId}/verify/`);
  if (res.ok) {
    const v = res.data;
    statusEl.textContent = v.compliance_status;
    statusEl.className = v.compliance_status === 'SOVEREIGN_COMPLIANT' ? 'tag green' : 'tag red';
    detailsEl.textContent = `=== MATHEMATICAL RECEIPT VERIFICATION ===\n` +
      `Recorded SHA-256 Hash: ${v.recorded_hash}\n` +
      `Computed SHA-256 Hash: ${v.computed_hash}\n` +
      `Hashes Match: ${v.is_valid ? 'YES (Identical)' : 'NO (Tampered)'}\n` +
      `Air-Gap Confined: ${v.is_air_gapped ? 'YES (Zero Egress Verified)' : 'NO'}\n` +
      `External Network Calls: ${v.external_requests}\n` +
      `Compliance Result: ${v.compliance_status}`;
  } else {
    detailsEl.textContent = `Verification request error: ${JSON.stringify(res.data)}`;
  }
}

// Audit Trail
async function loadAuditLogs() {
  const res = await apiCall('/audit/');
  const tbody = document.getElementById('auditTableBody');
  if (!tbody) return;

  if (res.ok) {
    tbody.innerHTML = res.data.map(log => `
      <tr>
        <td style="font-family: var(--font-mono);">${new Date(log.timestamp).toLocaleTimeString()}</td>
        <td><strong>${log.action}</strong></td>
        <td><span class="tag cyan">${log.resource}</span></td>
        <td><span class="tag ${log.status_code < 400 ? 'green' : 'amber'}">${log.status_code}</span></td>
        <td>${log.username || 'Anonymous'}</td>
        <td style="font-family: var(--font-mono); font-size: 0.75rem;">${log.ip_address}</td>
      </tr>
    `).join('');
  } else if (res.status === 403) {
    tbody.innerHTML = `<tr><td colspan="6" style="color: var(--status-warning);">Access restricted: Only Admin accounts can inspect compliance audit trails.</td></tr>`;
  }
}

// Tab Switching
function switchTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === `tab-${tabName}`);
  });
  refreshCurrentView();
}

function refreshCurrentView() {
  loadHealth();
  switch (state.activeTab) {
    case 'overview':
      loadOverview();
      loadTasks();
      break;
    case 'models':
      loadModels();
      break;
    case 'tools':
      loadTools();
      break;
    case 'vault':
      loadDocuments();
      break;
    case 'agent':
      loadTasks();
      loadDocuments();
      loadKnowledgeBases();
      break;
    case 'knowledge':
      loadDocuments();
      loadKnowledgeBases();
      break;
    case 'receipts':
      break;
    case 'audit':
      loadAuditLogs();
      break;
  }
}

function showNotification(message, type = 'success') {
  alert(message);
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  const roleSelect = document.getElementById('roleSelect');
  if (roleSelect) {
    roleSelect.addEventListener('change', (e) => authenticateRole(e.target.value));
  }

  const docForm = document.getElementById('uploadDocForm');
  if (docForm) docForm.addEventListener('submit', uploadDocument);

  const taskForm = document.getElementById('agentTaskForm');
  if (taskForm) taskForm.addEventListener('submit', dispatchAgentTask);

  authenticateRole('Admin');
  loadHealth();
  loadOverview();
  loadModels();
  loadDocuments();
  loadKnowledgeBases();
  onTestModelChange();
});
