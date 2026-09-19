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

// Overview Metrics
async function loadOverview() {
  const res = await apiCall('/health/stats/');
  if (res.ok) {
    const m = res.data.metrics;
    document.getElementById('metricDocs').textContent = m.total_documents;
    document.getElementById('metricTasks').textContent = m.total_tasks;
    document.getElementById('metricModels').textContent = m.registered_models;
    document.getElementById('metricReceipts').textContent = m.sovereignty_receipts_issued;
    document.getElementById('metricAudits').textContent = m.audit_logs_recorded;
  }
}

// Model Registry
async function loadModels() {
  const res = await apiCall('/models/');
  const container = document.getElementById('modelsGrid');
  if (!container) return;
  
  if (res.ok) {
    state.models = res.data;
    container.innerHTML = res.data.map(m => `
      <div class="metric-card">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <span class="tag cyan">${m.provider}</span>
            <span class="tag green">${m.status}</span>
          </div>
          <h3 style="margin-top: 0.75rem; font-size: 1.05rem; font-weight: 700;">${m.name}</h3>
          <p style="font-size: 0.78rem; color: var(--text-muted); font-family: var(--font-mono); margin-top: 0.2rem;">Type: ${m.model_type}</p>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.5rem;">
            ${m.capabilities?.specialty || 'General Sovereign AI Model'}
          </p>
          <div style="margin-top: 0.5rem; font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">
            Endpoint: ${m.endpoint || 'Internal Local Process'}
          </div>
        </div>
        <div style="margin-top: 1rem;">
          <button class="btn btn-secondary btn-sm" onclick="pingModel('${m.id}', '${m.name}')" style="width: 100%;">
            ⚡ Ping Local Diagnostic
          </button>
        </div>
      </div>
    `).join('');
  } else if (res.status === 403) {
    container.innerHTML = `<p style="color: var(--status-warning);">Access restricted: Your current role (${state.currentRole}) lacks permission to manage models (Engineer or Admin required).</p>`;
  }
}

async function pingModel(modelId, modelName) {
  const outputBox = document.getElementById('terminalOutput');
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
  } else {
    alert(`Upload failed: ${JSON.stringify(res.data)}`);
  }
}

// Knowledge Base Indexing (RAG)
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

    // Also populate KB selector in agent task form
    const kbSelect = document.getElementById('taskKbSelect');
    if (kbSelect) {
      kbSelect.innerHTML = `<option value="">-- No Knowledge Base (Direct Inference) --</option>` +
        res.data.filter(kb => kb.rag_indexed).map(kb =>
          `<option value="${kb.id}">${kb.name} (${kb.chunk_count} chunks)</option>`
        ).join('');
    }
  } else if (res.ok) {
    container.innerHTML = `<p style="color: var(--text-muted);">No knowledge bases seeded yet. Run <code>python manage.py seed_workbench</code>.</p>`;
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
  const fileSelect = document.getElementById('taskFileSelect');
  const kbSelect = document.getElementById('taskKbSelect');
  const terminal = document.getElementById('agentExecutionTerminal');
  const receiptPanel = document.getElementById('streamReceiptPanel');

  if (receiptPanel) receiptPanel.style.display = 'none';

  const knowledgeBaseId = kbSelect?.value || null;
  const payload = {
    task_type: typeSelect.value,
    input: {
      prompt: promptInput.value,
      tools: ['cad_stress_analyzer', 'weld_seam_flaw_detector'],
      files: fileSelect.value ? [fileSelect.value] : [],
      ...(knowledgeBaseId && { knowledge_base_id: knowledgeBaseId }),
    }
  };

  // Clear and show terminal
  terminal.innerHTML = '';
  appendTerminalLine(terminal, '>> SOVEREIGN AI WORKBENCH — AGENT DISPATCH', 'cyan');
  appendTerminalLine(terminal, `>> Creating task: ${payload.task_type}...`, 'muted');

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
    // Use fetch with streaming since EventSource doesn't support POST with auth headers
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
              // Print synthesis word-wrapped
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
    // Deliberate simulated tamper verification test
    statusEl.textContent = 'COMPUTING MATHEMETICAL SHA-256 CHECK...';
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
      loadKnowledgeBases();
      break;
    case 'receipts':
      // Keep existing receipt view
      break;
    case 'audit':
      loadAuditLogs();
      break;
  }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Wire Tab Buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Wire Role Switcher
  const roleSelect = document.getElementById('roleSelect');
  if (roleSelect) {
    roleSelect.addEventListener('change', (e) => authenticateRole(e.target.value));
  }

  // Wire Forms
  const docForm = document.getElementById('uploadDocForm');
  if (docForm) docForm.addEventListener('submit', uploadDocument);

  const taskForm = document.getElementById('agentTaskForm');
  if (taskForm) taskForm.addEventListener('submit', dispatchAgentTask);

  // Initial login as Admin
  authenticateRole('Admin');
  loadHealth();
  loadOverview();
  loadKnowledgeBases();
});

