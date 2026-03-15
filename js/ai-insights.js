// ==========================================
// AI INSIGHTS MODULE
// Features: Anomaly Detection, Report Generation, Cost Forecasting
// Floating panel — works on any screen
// ==========================================

const AIInsights = (() => {

    // ── State ───────────────────────────────────────────────
    let _panelEl   = null;
    let _btnEl     = null;
    let _isOpen    = false;
    let _activeTab = 'anomalies'; // 'anomalies' | 'forecast' | 'report'
    let _cache     = {};          // keyed by projectId + tab

    // ── Constants ───────────────────────────────────────────
    const MODEL    = 'llama-3.1-8b-instant';

    const TABS = [
        { id: 'anomalies', label: 'Anomalies',  icon: 'ph-warning-circle' },
        { id: 'forecast',  label: 'Forecast',   icon: 'ph-trend-up'       },
        { id: 'report',    label: 'Report',      icon: 'ph-file-text'      },
    ];

    // ── Bootstrap ───────────────────────────────────────────
    function init() {
        _injectStyles();
        _createFAB();
        _createPanel();

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (_isOpen &&
                !e.target.closest('#ai-insights-panel') &&
                !e.target.closest('#ai-fab')) {
                close();
            }
        });
    }

    // ── FAB Button ──────────────────────────────────────────
    function _createFAB() {
        _btnEl = document.createElement('button');
        _btnEl.id = 'ai-fab';
        _btnEl.title = 'AI Insights';
        _btnEl.innerHTML = `
            <span class="ai-fab-ring"></span>
            <i class="ph ph-sparkle ai-fab-icon"></i>
            <span class="ai-fab-label">AI</span>
            <span id="ai-fab-badge" class="ai-fab-badge" style="display:none;"></span>
        `;
        _btnEl.addEventListener('click', toggle);
        document.body.appendChild(_btnEl);
    }

    // ── Panel Shell ─────────────────────────────────────────
    function _createPanel() {
        _panelEl = document.createElement('div');
        _panelEl.id = 'ai-insights-panel';
        _panelEl.setAttribute('aria-label', 'AI Insights Panel');
        _panelEl.innerHTML = _shellHTML();
        document.body.appendChild(_panelEl);

        // Tab clicks
        _panelEl.querySelectorAll('.ai-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                _activeTab = btn.dataset.tab;
                _renderTabs();
                _loadTab(_activeTab);
            });
        });

        // Refresh button
        _panelEl.querySelector('#ai-refresh-btn').addEventListener('click', () => {
            const key = _cacheKey(_activeTab);
            delete _cache[key];
            _loadTab(_activeTab);
        });

        // Export report button (delegated)
        _panelEl.addEventListener('click', (e) => {
            if (e.target.closest('#ai-export-btn')) _exportReport();
        });
    }

    function _shellHTML() {
        const tabsHTML = TABS.map(t => `
            <button class="ai-tab-btn ${t.id === _activeTab ? 'active' : ''}"
                    data-tab="${t.id}">
                <i class="ph ${t.icon}"></i>
                <span>${t.label}</span>
            </button>`).join('');

        return `
            <div class="ai-panel-header">
                <div class="ai-panel-title">
                    <i class="ph ph-sparkle" style="color:var(--ai-accent);"></i>
                    <span>AI Insights</span>
                    <span class="ai-powered-badge">Groq</span>
                </div>
                <div class="ai-panel-actions">
                    <button id="ai-refresh-btn" class="ai-icon-btn" title="Refresh">
                        <i class="ph ph-arrow-clockwise"></i>
                    </button>
                    <button class="ai-icon-btn" onclick="AIInsights.close()" title="Close">
                        <i class="ph ph-x"></i>
                    </button>
                </div>
            </div>

            <div class="ai-tab-bar">${tabsHTML}</div>

            <div id="ai-panel-body" class="ai-panel-body">
                <div class="ai-loading-state">
                    <div class="ai-spinner"></div>
                    <span>Analysing project data…</span>
                </div>
            </div>
        `;
    }

    // ── Open / Close ────────────────────────────────────────
    function open() {
        if (!AppState.currentProject) {
            showToast('Select a project first to use AI Insights', 'warning');
            return;
        }
        _isOpen = true;
        _panelEl.classList.add('active');
        _btnEl.classList.add('open');
        _renderTabs();
        _loadTab(_activeTab);
    }

    function close() {
        _isOpen = false;
        _panelEl.classList.remove('active');
        _btnEl.classList.remove('open');
    }

    function toggle() {
        _isOpen ? close() : open();
    }

    // ── Tab Rendering ────────────────────────────────────────
    function _renderTabs() {
        _panelEl.querySelectorAll('.ai-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === _activeTab);
        });
    }

    // ── Data Fetcher ─────────────────────────────────────────
    async function _fetchProjectData() {
        const p = AppState.currentProject;
        const id = p._id;

        const [summaryRes, labourRes, matRes, eqRes, expRes] = await Promise.all([
            window.api.finance.getSummary(id),
            window.api.labour.getAll(id),
            window.api.materials.getAll(id),
            window.api.equipment.getAll(id),
            window.api.finance.getExpenses(id).catch(() => ({ success: false, data: [] }))
        ]);

        const summary  = summaryRes.success  ? normalizeFinancialSummary(summaryRes.data) : {};
        const workers  = labourRes.success   ? labourRes.data   : [];
        const materials = matRes.success     ? matRes.data      : [];
        const equipment = eqRes.success      ? eqRes.data       : [];
        const expenses  = expRes.success     ? expRes.data      : [];

        return { p, summary, workers, materials, equipment, expenses };
    }

    // ── Cache Key ────────────────────────────────────────────
    function _cacheKey(tab) {
        return `${AppState.currentProject?._id}_${tab}`;
    }

    // ── Tab Loader ───────────────────────────────────────────
    async function _loadTab(tab) {
        const body = document.getElementById('ai-panel-body');
        if (!body) return;

        const key = _cacheKey(tab);
        if (_cache[key]) {
            body.innerHTML = _cache[key];
            _attachCopyButtons();
            return;
        }

        body.innerHTML = `
            <div class="ai-loading-state">
                <div class="ai-spinner"></div>
                <span>${_loadingMsg(tab)}</span>
            </div>`;

        try {
            const data = await _fetchProjectData();
            let html = '';

            if (tab === 'anomalies') html = await _runAnomalies(data);
            else if (tab === 'forecast') html = await _runForecast(data);
            else if (tab === 'report')   html = await _runReport(data);

            _cache[key] = html;
            body.innerHTML = html;
            _attachCopyButtons();
            _updateFABBadge();

        } catch (err) {
            body.innerHTML = _errorHTML(err.message);
        }
    }

    function _loadingMsg(tab) {
        return tab === 'anomalies' ? 'Scanning for anomalies…'
             : tab === 'forecast'  ? 'Computing cost forecast…'
             : 'Generating project report…';
    }

    // ── Groq API Call ────────────────────────────────────────
    async function _callClaude(systemPrompt, userPrompt) {
        const result = await window.api.ai.query({ systemPrompt, userPrompt });
        if (!result.success) {
            throw new Error(result.message || 'AI query failed');
        }

        const raw = result.data || '';
        return raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    }

    // ══════════════════════════════════════════════════════════
    // FEATURE 1 — ANOMALY DETECTION
    // ══════════════════════════════════════════════════════════
    async function _runAnomalies({ p, summary, workers, materials, equipment }) {
        const budget      = toNumber(p.budget);
        const totalSpent  = toNumber(summary.totalCost);
        const usedPct     = budget > 0 ? ((totalSpent / budget) * 100).toFixed(1) : 0;

        const prompt = `
You are a construction finance analyst. Analyse the data and return ONLY a JSON array of anomalies.
Each anomaly object must have:
  "severity": "critical" | "warning" | "info"
  "category": string (Labour / Materials / Equipment / Budget / General)
  "title": short title (max 8 words)
  "detail": one clear sentence explaining the issue
  "action": one actionable recommendation sentence

Project: "${p.name}"
Budget: ₹${budget.toLocaleString('en-IN')}
Total Spent: ₹${totalSpent.toLocaleString('en-IN')} (${usedPct}% used)
Labour Cost: ₹${toNumber(summary.labourCost).toLocaleString('en-IN')}
Material Cost: ₹${toNumber(summary.materialCost).toLocaleString('en-IN')}
Equipment Cost: ₹${toNumber(summary.equipmentCost).toLocaleString('en-IN')}
Other Expenses: ₹${toNumber(summary.otherExpenses).toLocaleString('en-IN')}
Worker Count: ${workers.length}
Workers with zero cost: ${workers.filter(w => toNumber(w.totalCost) <= 0 && w.category !== 'Electrician').length}
Material items with qty < 10: ${materials.filter(m => toNumber(m.quantity) < 10).length}
Equipment count: ${equipment.length}

Return ONLY the JSON array, no other text.`;

        const raw  = await _callClaude(
            'You are a construction finance anomaly detector. Output ONLY valid JSON arrays, no prose.',
            prompt
        );

        let anomalies = [];
        try { anomalies = JSON.parse(raw); } catch { anomalies = _fallbackAnomalies(summary, budget, workers, materials); }

        if (!Array.isArray(anomalies) || anomalies.length === 0) {
            return `<div class="ai-empty-state">
                <i class="ph ph-check-circle" style="color:var(--success);font-size:2rem;"></i>
                <p>No anomalies detected. Project finances look healthy!</p>
            </div>`;
        }

        const order = { critical: 0, warning: 1, info: 2 };
        anomalies.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));

        const critCount = anomalies.filter(a => a.severity === 'critical').length;
        const warnCount = anomalies.filter(a => a.severity === 'warning').length;

        return `
            <div class="ai-summary-strip">
                ${critCount > 0 ? `<span class="ai-pill pill-critical"><i class="ph ph-warning-octagon"></i> ${critCount} Critical</span>` : ''}
                ${warnCount > 0 ? `<span class="ai-pill pill-warning"><i class="ph ph-warning"></i> ${warnCount} Warning</span>` : ''}
                <span class="ai-pill pill-info"><i class="ph ph-info"></i> ${anomalies.length} Total</span>
            </div>
            <div class="ai-card-list">
                ${anomalies.map(a => `
                    <div class="ai-anomaly-card sev-${a.severity}">
                        <div class="ai-anomaly-header">
                            <span class="ai-sev-dot sev-${a.severity}"></span>
                            <strong>${_esc(a.title)}</strong>
                            <span class="ai-cat-badge">${_esc(a.category)}</span>
                        </div>
                        <p class="ai-anomaly-detail">${_esc(a.detail)}</p>
                        <div class="ai-anomaly-action">
                            <i class="ph ph-lightbulb" style="color:var(--ai-accent);flex-shrink:0;"></i>
                            <span>${_esc(a.action)}</span>
                        </div>
                    </div>`).join('')}
            </div>`;
    }

    function _fallbackAnomalies(summary, budget, workers, materials) {
        const anomalies = [];
        const spent = toNumber(summary.totalCost);
        if (budget > 0) {
            const pct = (spent / budget) * 100;
            if (pct >= 90) anomalies.push({ severity: 'critical', category: 'Budget', title: 'Budget nearly exhausted', detail: `${pct.toFixed(0)}% of budget consumed.`, action: 'Review all pending expenses immediately.' });
            else if (pct >= 75) anomalies.push({ severity: 'warning', category: 'Budget', title: 'High budget utilisation', detail: `${pct.toFixed(0)}% of budget used.`, action: 'Monitor spending closely.' });
        }
        const idle = workers.filter(w => toNumber(w.totalCost) <= 0 && w.category !== 'Electrician').length;
        if (idle > 0) anomalies.push({ severity: 'warning', category: 'Labour', title: 'Workers with no recorded cost', detail: `${idle} worker(s) have zero cost recorded.`, action: 'Verify attendance records.' });
        const lowStock = materials.filter(m => toNumber(m.quantity) < 10).length;
        if (lowStock > 0) anomalies.push({ severity: 'warning', category: 'Materials', title: 'Low stock items detected', detail: `${lowStock} material(s) below threshold.`, action: 'Reorder low-stock materials.' });
        return anomalies;
    }

    // ══════════════════════════════════════════════════════════
    // FEATURE 2 — COST FORECAST
    // ══════════════════════════════════════════════════════════
    async function _runForecast({ p, summary, workers, materials, equipment, expenses }) {
        const budget     = toNumber(p.budget);
        const totalSpent = toNumber(summary.totalCost);
        const startDate  = p.startDate ? new Date(p.startDate) : null;
        const today      = new Date();
        const daysElapsed = startDate ? Math.max(1, Math.ceil((today - startDate) / 86400000)) : 30;

        const prompt = `
You are a construction cost forecasting expert. Analyse the spending data and return ONLY a JSON object.
Required fields:
  "dailyBurnRate": number (₹/day average)
  "projectedTotalCost": number (estimated final cost)
  "estimatedDaysToExhaust": number | null (days until budget runs out, null if already over or no budget)
  "overBudgetBy": number (0 if within budget, else overage amount)
  "confidenceLevel": "High" | "Medium" | "Low"
  "forecastSummary": string (2 sentences max, plain text)
  "categoryForecasts": array of { "category": string, "currentSpend": number, "projectedFinal": number, "trend": "Rising" | "Stable" | "Declining" }
  "recommendations": array of strings (3 items max)

Project: "${p.name}"
Budget: ₹${budget.toLocaleString('en-IN')}
Total Spent So Far: ₹${totalSpent.toLocaleString('en-IN')}
Days Elapsed Since Start: ${daysElapsed}
Labour Cost: ₹${toNumber(summary.labourCost).toLocaleString('en-IN')}
Material Cost: ₹${toNumber(summary.materialCost).toLocaleString('en-IN')}
Equipment Cost: ₹${toNumber(summary.equipmentCost).toLocaleString('en-IN')}
Other Expenses: ₹${toNumber(summary.otherExpenses).toLocaleString('en-IN')}
Worker Count: ${workers.length}
Material Items: ${materials.length}
Equipment Units: ${equipment.length}
Recent Expense Records: ${expenses.length}

Return ONLY the JSON object, no other text.`;

        const raw = await _callClaude(
            'You are a construction cost forecasting model. Output ONLY valid JSON, no prose.',
            prompt
        );

        let fc = {};
        try { fc = JSON.parse(raw); } catch { fc = _fallbackForecast(summary, budget, daysElapsed); }

        const overBudget  = toNumber(fc.overBudgetBy) > 0;
        const exhaustDays = fc.estimatedDaysToExhaust;

        return `
            <div class="ai-forecast-hero ${overBudget ? 'over-budget' : 'on-track'}">
                <div class="ai-forecast-hero-label">${overBudget ? '⚠ Over Budget' : '✓ On Track'}</div>
                <div class="ai-forecast-big">
                    ${formatCurrency(toNumber(fc.projectedTotalCost))}
                </div>
                <div class="ai-forecast-sub">Projected Final Cost</div>
                ${overBudget
                    ? `<div class="ai-forecast-over">+${formatCurrency(toNumber(fc.overBudgetBy))} over budget</div>`
                    : exhaustDays != null
                        ? `<div class="ai-forecast-days"><i class="ph ph-clock"></i> ~${exhaustDays} days until budget exhausted</div>`
                        : ''}
            </div>

            <div class="ai-stats-row">
                <div class="ai-stat-box">
                    <div class="ai-stat-label">Daily Burn Rate</div>
                    <div class="ai-stat-val">${formatCurrency(toNumber(fc.dailyBurnRate))}</div>
                    <div class="ai-stat-sub">per day avg</div>
                </div>
                <div class="ai-stat-box">
                    <div class="ai-stat-label">Budget</div>
                    <div class="ai-stat-val">${formatCurrency(budget)}</div>
                    <div class="ai-stat-sub">allocated</div>
                </div>
                <div class="ai-stat-box">
                    <div class="ai-stat-label">Confidence</div>
                    <div class="ai-stat-val conf-${(fc.confidenceLevel||'').toLowerCase()}">${fc.confidenceLevel || 'Medium'}</div>
                    <div class="ai-stat-sub">forecast</div>
                </div>
            </div>

            ${fc.forecastSummary ? `
            <div class="ai-summary-box">
                <i class="ph ph-robot" style="color:var(--ai-accent);flex-shrink:0;margin-top:2px;"></i>
                <p>${_esc(fc.forecastSummary)}</p>
            </div>` : ''}

            ${Array.isArray(fc.categoryForecasts) && fc.categoryForecasts.length > 0 ? `
            <div class="ai-section-label">Category Breakdown</div>
            <div class="ai-cat-table">
                <div class="ai-cat-row ai-cat-head">
                    <span>Category</span><span>Current</span><span>Projected</span><span>Trend</span>
                </div>
                ${fc.categoryForecasts.map(c => `
                    <div class="ai-cat-row">
                        <span>${_esc(c.category)}</span>
                        <span>${formatCurrency(toNumber(c.currentSpend))}</span>
                        <span>${formatCurrency(toNumber(c.projectedFinal))}</span>
                        <span class="trend-badge trend-${(c.trend||'').toLowerCase()}">${_esc(c.trend)}</span>
                    </div>`).join('')}
            </div>` : ''}

            ${Array.isArray(fc.recommendations) && fc.recommendations.length > 0 ? `
            <div class="ai-section-label">Recommendations</div>
            <div class="ai-rec-list">
                ${fc.recommendations.map((r, i) => `
                    <div class="ai-rec-item">
                        <span class="ai-rec-num">${i + 1}</span>
                        <span>${_esc(r)}</span>
                    </div>`).join('')}
            </div>` : ''}`;
    }

    function _fallbackForecast(summary, budget, daysElapsed) {
        const spent = toNumber(summary.totalCost);
        const daily = daysElapsed > 0 ? spent / daysElapsed : 0;
        const projected = spent * 1.3;
        return {
            dailyBurnRate: daily,
            projectedTotalCost: projected,
            estimatedDaysToExhaust: budget > 0 && daily > 0 ? Math.ceil((budget - spent) / daily) : null,
            overBudgetBy: Math.max(0, projected - budget),
            confidenceLevel: 'Low',
            forecastSummary: 'Forecast based on current spending trajectory.',
            categoryForecasts: [],
            recommendations: ['Record all expenses regularly for better forecasting accuracy.']
        };
    }

    // ══════════════════════════════════════════════════════════
    // FEATURE 3 — AUTO REPORT
    // ══════════════════════════════════════════════════════════
    async function _runReport({ p, summary, workers, materials, equipment }) {
        const budget     = toNumber(p.budget);
        const totalSpent = toNumber(summary.totalCost);
        const remaining  = budget - totalSpent;
        const usedPct    = budget > 0 ? ((totalSpent / budget) * 100).toFixed(1) : 0;

        const prompt = `
You are a construction project manager writing an executive status report.
Return ONLY a JSON object with these fields:
  "overallStatus": "On Track" | "At Risk" | "Over Budget" | "Not Started"
  "executiveSummary": string (3-4 sentences, professional tone)
  "financialHealth": string (2-3 sentences on budget and spending)
  "labourStatus": string (1-2 sentences)
  "materialsStatus": string (1-2 sentences)
  "keyRisks": array of strings (max 3)
  "nextSteps": array of strings (max 3)
  "generatedDate": string (today's date in DD MMM YYYY format)

Project Name: "${p.name}"
Location: "${p.location || 'N/A'}"
Start Date: ${p.startDate ? new Date(p.startDate).toLocaleDateString('en-IN') : 'N/A'}
Budget: ₹${budget.toLocaleString('en-IN')}
Total Spent: ₹${totalSpent.toLocaleString('en-IN')} (${usedPct}%)
Remaining: ₹${remaining.toLocaleString('en-IN')}
Labour Cost: ₹${toNumber(summary.labourCost).toLocaleString('en-IN')}
Material Cost: ₹${toNumber(summary.materialCost).toLocaleString('en-IN')}
Equipment Cost: ₹${toNumber(summary.equipmentCost).toLocaleString('en-IN')}
Other Expenses: ₹${toNumber(summary.otherExpenses).toLocaleString('en-IN')}
Total Workers: ${workers.length}
Total Material Items: ${materials.length}
Equipment Units: ${equipment.length}

Return ONLY the JSON object.`;

        const raw = await _callClaude(
            'You are a professional construction project report writer. Output ONLY valid JSON, no prose.',
            prompt
        );

        let rpt = {};
        try { rpt = JSON.parse(raw); } catch { rpt = _fallbackReport(p, summary, budget, workers, materials, equipment); }

        const statusColor = {
            'On Track':    'var(--success)',
            'At Risk':     'var(--warning)',
            'Over Budget': 'var(--danger)',
            'Not Started': 'var(--text-muted)'
        }[rpt.overallStatus] || 'var(--brand)';

        return `
            <div class="ai-report-header">
                <div class="ai-report-project">${_esc(p.name)}</div>
                <div class="ai-report-meta">
                    <span><i class="ph ph-calendar"></i> ${rpt.generatedDate || new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</span>
                    <span class="ai-status-badge" style="background:${statusColor}20;color:${statusColor};">
                        ${_esc(rpt.overallStatus || 'Unknown')}
                    </span>
                </div>
            </div>

            <div class="ai-report-section">
                <div class="ai-section-label">Executive Summary</div>
                <p class="ai-report-para">${_esc(rpt.executiveSummary || '')}</p>
            </div>

            <div class="ai-report-section">
                <div class="ai-section-label">Financial Health</div>
                <p class="ai-report-para">${_esc(rpt.financialHealth || '')}</p>
                <div class="ai-mini-stats">
                    <div class="ai-mini-stat">
                        <span class="ai-mini-label">Budget</span>
                        <span class="ai-mini-val">${formatCurrency(budget)}</span>
                    </div>
                    <div class="ai-mini-stat">
                        <span class="ai-mini-label">Spent</span>
                        <span class="ai-mini-val" style="color:var(--warning);">${formatCurrency(totalSpent)}</span>
                    </div>
                    <div class="ai-mini-stat">
                        <span class="ai-mini-label">Remaining</span>
                        <span class="ai-mini-val" style="color:${remaining >= 0 ? 'var(--success)' : 'var(--danger)'};">${formatCurrency(remaining)}</span>
                    </div>
                </div>
            </div>

            <div class="ai-report-section">
                <div class="ai-section-label">Labour & Materials</div>
                <p class="ai-report-para">${_esc(rpt.labourStatus || '')} ${_esc(rpt.materialsStatus || '')}</p>
            </div>

            ${Array.isArray(rpt.keyRisks) && rpt.keyRisks.length > 0 ? `
            <div class="ai-report-section">
                <div class="ai-section-label">Key Risks</div>
                ${rpt.keyRisks.map(r => `
                    <div class="ai-risk-item">
                        <i class="ph ph-warning" style="color:var(--warning);flex-shrink:0;"></i>
                        <span>${_esc(r)}</span>
                    </div>`).join('')}
            </div>` : ''}

            ${Array.isArray(rpt.nextSteps) && rpt.nextSteps.length > 0 ? `
            <div class="ai-report-section">
                <div class="ai-section-label">Next Steps</div>
                ${rpt.nextSteps.map((s, i) => `
                    <div class="ai-rec-item">
                        <span class="ai-rec-num">${i + 1}</span>
                        <span>${_esc(s)}</span>
                    </div>`).join('')}
            </div>` : ''}

            <button id="ai-export-btn" class="ai-export-btn">
                <i class="ph ph-download-simple"></i> Export Report
            </button>`;
    }

    function _fallbackReport(p, summary, budget, workers, materials, equipment) {
        const spent = toNumber(summary.totalCost);
        const pct = budget > 0 ? (spent / budget * 100).toFixed(0) : 0;
        const status = pct >= 100 ? 'Over Budget' : pct >= 75 ? 'At Risk' : 'On Track';
        return {
            overallStatus: status,
            executiveSummary: `Project "${p.name}" is currently ${status.toLowerCase()}. ${pct}% of budget has been consumed.`,
            financialHealth: `Total spent is ${formatCurrency(spent)} of ${formatCurrency(budget)} budget.`,
            labourStatus: `${workers.length} workers are registered on this project.`,
            materialsStatus: `${materials.length} material items are tracked.`,
            keyRisks: pct >= 75 ? ['Budget nearing exhaustion'] : [],
            nextSteps: ['Review expenses', 'Update cost forecasts'],
            generatedDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        };
    }

    // ── Export Report ────────────────────────────────────────
    function _exportReport() {
        const body    = document.getElementById('ai-panel-body');
        const p       = AppState.currentProject;
        const content = body ? body.innerHTML : '';

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>AI Project Report — ${p?.name || 'Project'}</title>
<style>
  body { font-family: Georgia, serif; max-width: 760px; margin: 40px auto; padding: 0 24px; color: #1a1a2e; line-height: 1.7; }
  h1 { font-size: 1.6rem; margin-bottom: .25rem; }
  .ai-report-meta { display:flex; gap:1rem; font-size:.85rem; color:#555; margin-bottom:1.5rem; }
  .ai-section-label { font-size:.7rem; text-transform:uppercase; letter-spacing:.1em; color:#888; margin: 1.2rem 0 .4rem; font-family: monospace; }
  .ai-report-para { margin:.25rem 0 .75rem; }
  .ai-mini-stats { display:flex; gap:1.5rem; padding:.75rem; background:#f5f5f5; border-radius:8px; margin:.5rem 0; }
  .ai-mini-label { font-size:.7rem; color:#888; display:block; }
  .ai-mini-val { font-weight:700; font-size:1rem; }
  .ai-risk-item, .ai-rec-item { display:flex; gap:.5rem; margin:.35rem 0; align-items:flex-start; }
  .ai-rec-num { background:#1a1a2e; color:#fff; border-radius:50%; width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center; font-size:.7rem; flex-shrink:0; }
  .ai-export-btn, #ai-export-btn { display:none; }
  .ai-status-badge { padding:.2rem .75rem; border-radius:20px; font-size:.75rem; font-weight:600; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
${content}
<hr style="margin-top:2rem;border:none;border-top:1px solid #eee;">
<p style="font-size:.75rem;color:#aaa;text-align:center;">Generated by AI Insights (Groq / ${MODEL}) — ${new Date().toLocaleString('en-IN')}</p>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `AI_Report_${(p?.name || 'project').replace(/\s+/g, '_')}_${Date.now()}.html`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Report exported successfully!', 'success');
    }

    // ── FAB Badge Update ──────────────────────────────────────
    function _updateFABBadge() {
        const key     = _cacheKey('anomalies');
        const badge   = document.getElementById('ai-fab-badge');
        if (!badge || !_cache[key]) return;

        // Count critical/warning pills from cached HTML
        const tmp = document.createElement('div');
        tmp.innerHTML = _cache[key];
        const crits = tmp.querySelectorAll('.sev-critical').length;
        const warns = tmp.querySelectorAll('.sev-warning').length;
        const total = crits + warns;

        if (total > 0) {
            badge.textContent = total > 9 ? '9+' : total;
            badge.style.display = 'flex';
            badge.className = 'ai-fab-badge ' + (crits > 0 ? 'badge-critical' : 'badge-warning');
        } else {
            badge.style.display = 'none';
        }
    }

    // ── Copy Buttons ─────────────────────────────────────────
    function _attachCopyButtons() {
        // nothing for now — report export handles sharing
    }

    // ── Helpers ──────────────────────────────────────────────
    function _esc(str = '') {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function _errorHTML(msg) {
        return `<div class="ai-error-state">
            <i class="ph ph-warning-circle" style="font-size:1.8rem;color:var(--danger);"></i>
            <p>Failed to load insights</p>
            <small>${_esc(msg)}</small>
            <button class="ai-retry-btn" onclick="AIInsights.refresh()">
                <i class="ph ph-arrow-clockwise"></i> Retry
            </button>
        </div>`;
    }

    // ── Public API ───────────────────────────────────────────
    return { init, open, close, toggle, refresh() {
        const key = _cacheKey(_activeTab);
        delete _cache[key];
        _loadTab(_activeTab);
    }};

})();

// ── Styles Injector ──────────────────────────────────────────
AIInsights._injectStyles = function () {
    if (document.getElementById('ai-insights-styles')) return;
    const style = document.createElement('style');
    style.id = 'ai-insights-styles';
    style.textContent = `
/* ── CSS Variables ── */
:root {
  --ai-accent:   #A78BFA;
  --ai-bg:       var(--bg-card, #16162a);
  --ai-border:   var(--border-color, rgba(255,255,255,0.08));
  --ai-radius:   14px;
  --ai-shadow:   0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(167,139,250,0.12);
}

/* ── FAB ── */
#ai-fab {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 9998;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #7C3AED, #A78BFA);
  color: #fff;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  box-shadow: 0 8px 28px rgba(124,58,237,0.55);
  transition: transform .2s, box-shadow .2s;
  overflow: visible;
}
#ai-fab:hover { transform: scale(1.08); box-shadow: 0 12px 36px rgba(124,58,237,0.7); }
#ai-fab.open  { transform: scale(0.95); }

.ai-fab-ring {
  position: absolute; inset: -4px;
  border-radius: 50%;
  border: 2px solid rgba(167,139,250,0.35);
  animation: ai-pulse 2.5s ease-in-out infinite;
  pointer-events: none;
}
@keyframes ai-pulse {
  0%,100% { opacity:.6; transform:scale(1); }
  50%      { opacity:0;  transform:scale(1.18); }
}
.ai-fab-icon  { font-size: 1.25rem; line-height: 1; }
.ai-fab-label { font-size: .55rem; font-weight: 700; letter-spacing: .08em; line-height:1; }

.ai-fab-badge {
  position: absolute;
  top: -4px; right: -4px;
  min-width: 18px; height: 18px;
  border-radius: 9px;
  font-size: .65rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  padding: 0 4px;
  border: 2px solid var(--bg-base, #0d0d1a);
}
.ai-fab-badge.badge-critical { background: var(--danger, #ef4444); color: #fff; }
.ai-fab-badge.badge-warning  { background: var(--warning, #f59e0b); color: #000; }

/* ── Panel ── */
#ai-insights-panel {
  position: fixed;
  bottom: 96px;
  right: 28px;
  z-index: 9999;
  width: 380px;
  max-height: 72vh;
  border-radius: var(--ai-radius);
  background: var(--ai-bg);
  border: 1px solid var(--ai-border);
  box-shadow: var(--ai-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  opacity: 0;
  transform: translateY(16px) scale(.97);
  pointer-events: none;
  transition: opacity .22s, transform .22s;
}
#ai-insights-panel.active {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: all;
}

/* ── Panel Header ── */
.ai-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: .85rem 1rem .7rem;
  border-bottom: 1px solid var(--ai-border);
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(124,58,237,.15), rgba(167,139,250,.05));
}
.ai-panel-title {
  display: flex; align-items: center; gap: .5rem;
  font-weight: 700; font-size: .95rem;
  color: var(--text-primary, #f4f4f8);
}
.ai-powered-badge {
  font-size: .6rem; font-weight: 700; letter-spacing: .07em;
  background: rgba(167,139,250,.2); color: var(--ai-accent);
  padding: .15rem .45rem; border-radius: 4px;
  text-transform: uppercase;
}
.ai-panel-actions { display: flex; gap: .25rem; }
.ai-icon-btn {
  width: 28px; height: 28px; border-radius: 6px;
  border: none; background: transparent;
  color: var(--text-muted, #9999b3);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 1rem; transition: background .15s, color .15s;
}
.ai-icon-btn:hover { background: var(--ai-border); color: var(--text-primary, #f4f4f8); }

/* ── Tab Bar ── */
.ai-tab-bar {
  display: flex; gap: 0;
  border-bottom: 1px solid var(--ai-border);
  flex-shrink: 0;
}
.ai-tab-btn {
  flex: 1; padding: .55rem .25rem;
  border: none; background: transparent;
  color: var(--text-muted, #9999b3);
  font-size: .75rem; font-weight: 600;
  cursor: pointer; display: flex; align-items: center;
  justify-content: center; gap: .3rem;
  border-bottom: 2px solid transparent;
  transition: color .15s, border-color .15s;
  letter-spacing: .03em;
}
.ai-tab-btn:hover  { color: var(--text-primary, #f4f4f8); }
.ai-tab-btn.active { color: var(--ai-accent); border-bottom-color: var(--ai-accent); }

/* ── Panel Body ── */
.ai-panel-body {
  flex: 1; overflow-y: auto; padding: .9rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(167,139,250,.3) transparent;
}
.ai-panel-body::-webkit-scrollbar { width: 4px; }
.ai-panel-body::-webkit-scrollbar-thumb { background: rgba(167,139,250,.3); border-radius:2px; }

/* ── Loading ── */
.ai-loading-state {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: .75rem; padding: 2.5rem 1rem;
  color: var(--text-muted, #9999b3); font-size: .85rem;
}
.ai-spinner {
  width: 28px; height: 28px; border-radius: 50%;
  border: 3px solid rgba(167,139,250,.2);
  border-top-color: var(--ai-accent);
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform:rotate(360deg); } }

/* ── Empty / Error ── */
.ai-empty-state, .ai-error-state {
  display: flex; flex-direction: column;
  align-items: center; gap: .5rem;
  padding: 2rem 1rem; text-align: center;
  color: var(--text-muted, #9999b3); font-size: .85rem;
}
.ai-retry-btn {
  margin-top: .5rem; padding: .4rem .9rem;
  border-radius: 6px; border: 1px solid var(--ai-border);
  background: transparent; color: var(--ai-accent);
  cursor: pointer; font-size: .8rem;
}

/* ── Summary Strip ── */
.ai-summary-strip {
  display: flex; gap: .4rem; flex-wrap: wrap; margin-bottom: .75rem;
}
.ai-pill {
  display: flex; align-items: center; gap: .3rem;
  padding: .2rem .6rem; border-radius: 20px;
  font-size: .7rem; font-weight: 700;
}
.pill-critical { background:rgba(239,68,68,.15);  color:var(--danger, #ef4444); }
.pill-warning  { background:rgba(245,158,11,.15); color:var(--warning,#f59e0b); }
.pill-info     { background:rgba(96,165,250,.15); color:var(--info,  #60a5fa); }

/* ── Anomaly Cards ── */
.ai-card-list { display: flex; flex-direction: column; gap: .6rem; }
.ai-anomaly-card {
  border-radius: 8px; padding: .7rem .8rem;
  border: 1px solid var(--ai-border);
  background: rgba(255,255,255,.03);
}
.ai-anomaly-card.sev-critical { border-left: 3px solid var(--danger, #ef4444); }
.ai-anomaly-card.sev-warning  { border-left: 3px solid var(--warning,#f59e0b); }
.ai-anomaly-card.sev-info     { border-left: 3px solid var(--info,  #60a5fa); }

.ai-anomaly-header {
  display: flex; align-items: center; gap: .4rem;
  margin-bottom: .35rem; flex-wrap: wrap;
}
.ai-sev-dot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
}
.ai-sev-dot.sev-critical { background: var(--danger, #ef4444); }
.ai-sev-dot.sev-warning  { background: var(--warning,#f59e0b); }
.ai-sev-dot.sev-info     { background: var(--info,  #60a5fa); }

.ai-cat-badge {
  margin-left: auto; font-size: .6rem; font-weight: 700;
  padding: .1rem .4rem; border-radius: 4px;
  background: rgba(167,139,250,.15); color: var(--ai-accent);
  letter-spacing: .04em;
}
.ai-anomaly-detail {
  font-size: .78rem; color: var(--text-secondary, #c4c4dc);
  margin: 0 0 .4rem; line-height: 1.5;
}
.ai-anomaly-action {
  display: flex; gap: .4rem; align-items: flex-start;
  font-size: .73rem; color: var(--text-muted, #9999b3);
  background: rgba(167,139,250,.06); border-radius: 5px;
  padding: .35rem .5rem;
}

/* ── Forecast ── */
.ai-forecast-hero {
  border-radius: 10px; padding: 1rem; text-align: center;
  margin-bottom: .85rem;
}
.ai-forecast-hero.on-track  { background: linear-gradient(135deg,rgba(16,185,129,.15),rgba(16,185,129,.05)); border:1px solid rgba(16,185,129,.2); }
.ai-forecast-hero.over-budget{ background:linear-gradient(135deg,rgba(239,68,68,.15),rgba(239,68,68,.05)); border:1px solid rgba(239,68,68,.2); }

.ai-forecast-hero-label { font-size:.68rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; opacity:.7; margin-bottom:.3rem; }
.ai-forecast-big { font-size:1.7rem; font-weight:800; font-family:var(--font-mono,'monospace'); color:var(--text-primary,#f4f4f8); }
.ai-forecast-sub { font-size:.72rem; color:var(--text-muted,#9999b3); margin-top:.15rem; }
.ai-forecast-over { margin-top:.4rem; font-size:.8rem; font-weight:700; color:var(--danger,#ef4444); }
.ai-forecast-days { margin-top:.4rem; font-size:.78rem; color:var(--warning,#f59e0b); display:flex; align-items:center; justify-content:center; gap:.3rem; }

.ai-stats-row { display:grid; grid-template-columns:repeat(3,1fr); gap:.5rem; margin-bottom:.8rem; }
.ai-stat-box  { background:rgba(255,255,255,.04); border:1px solid var(--ai-border); border-radius:8px; padding:.55rem .5rem; text-align:center; }
.ai-stat-label { font-size:.62rem; color:var(--text-muted,#9999b3); text-transform:uppercase; letter-spacing:.04em; }
.ai-stat-val   { font-size:.85rem; font-weight:700; font-family:var(--font-mono,'monospace'); color:var(--text-primary,#f4f4f8); margin:.2rem 0 .1rem; }
.ai-stat-sub   { font-size:.6rem; color:var(--text-muted,#9999b3); }
.conf-high   { color:var(--success,#10b981); }
.conf-medium { color:var(--warning,#f59e0b); }
.conf-low    { color:var(--danger, #ef4444); }

.ai-summary-box {
  display:flex; gap:.5rem; align-items:flex-start;
  background:rgba(167,139,250,.08); border:1px solid rgba(167,139,250,.15);
  border-radius:8px; padding:.6rem .75rem; margin-bottom:.8rem;
  font-size:.78rem; color:var(--text-secondary,#c4c4dc); line-height:1.55;
}
.ai-summary-box p { margin:0; }

.ai-section-label { font-size:.62rem; text-transform:uppercase; letter-spacing:.1em; color:var(--text-muted,#9999b3); margin:.85rem 0 .4rem; font-weight:700; }

.ai-cat-table { border-radius:8px; overflow:hidden; border:1px solid var(--ai-border); margin-bottom:.5rem; }
.ai-cat-row {
  display:grid; grid-template-columns:1.4fr 1fr 1fr .8fr;
  padding:.45rem .7rem; font-size:.73rem; gap:.25rem; align-items:center;
}
.ai-cat-head { background:rgba(255,255,255,.04); font-weight:700; color:var(--text-muted,#9999b3); font-size:.65rem; text-transform:uppercase; letter-spacing:.05em; }
.ai-cat-row:not(.ai-cat-head) { border-top:1px solid var(--ai-border); color:var(--text-secondary,#c4c4dc); }

.trend-badge { font-size:.65rem; font-weight:700; padding:.1rem .35rem; border-radius:4px; }
.trend-rising   { background:rgba(239,68,68,.15);  color:var(--danger, #ef4444); }
.trend-stable   { background:rgba(96,165,250,.15); color:var(--info,  #60a5fa); }
.trend-declining{ background:rgba(16,185,129,.15); color:var(--success,#10b981); }

.ai-rec-list { display:flex; flex-direction:column; gap:.4rem; margin-bottom:.5rem; }
.ai-rec-item { display:flex; gap:.55rem; align-items:flex-start; font-size:.78rem; color:var(--text-secondary,#c4c4dc); }
.ai-rec-num  {
  min-width:20px; height:20px; border-radius:50%;
  background:linear-gradient(135deg,#7C3AED,#A78BFA);
  color:#fff; display:flex; align-items:center; justify-content:center;
  font-size:.65rem; font-weight:700; flex-shrink:0; margin-top:1px;
}

/* ── Report ── */
.ai-report-header { margin-bottom:.85rem; }
.ai-report-project { font-size:1rem; font-weight:800; color:var(--text-primary,#f4f4f8); margin-bottom:.3rem; }
.ai-report-meta { display:flex; align-items:center; gap:.6rem; flex-wrap:wrap; font-size:.72rem; color:var(--text-muted,#9999b3); }
.ai-status-badge { padding:.2rem .6rem; border-radius:20px; font-size:.68rem; font-weight:700; }

.ai-report-section { margin-bottom:.8rem; }
.ai-report-para { font-size:.78rem; color:var(--text-secondary,#c4c4dc); line-height:1.6; margin:.2rem 0 .5rem; }

.ai-mini-stats {
  display:grid; grid-template-columns:repeat(3,1fr);
  gap:.4rem; background:rgba(255,255,255,.03);
  border:1px solid var(--ai-border); border-radius:8px; padding:.6rem;
}
.ai-mini-stat { text-align:center; }
.ai-mini-label { font-size:.6rem; color:var(--text-muted,#9999b3); text-transform:uppercase; letter-spacing:.04em; display:block; margin-bottom:.2rem; }
.ai-mini-val   { font-size:.82rem; font-weight:700; font-family:var(--font-mono,'monospace'); color:var(--text-primary,#f4f4f8); }

.ai-risk-item {
  display:flex; gap:.45rem; align-items:flex-start;
  font-size:.78rem; color:var(--text-secondary,#c4c4dc);
  padding:.3rem 0; border-bottom:1px solid var(--ai-border);
}
.ai-risk-item:last-child { border-bottom:none; }

.ai-export-btn {
  width:100%; margin-top:.85rem; padding:.55rem;
  border-radius:8px; border:1px solid rgba(167,139,250,.3);
  background:rgba(167,139,250,.1); color:var(--ai-accent);
  cursor:pointer; font-size:.8rem; font-weight:600;
  display:flex; align-items:center; justify-content:center; gap:.4rem;
  transition:background .15s;
}
.ai-export-btn:hover { background:rgba(167,139,250,.2); }

/* ── Light theme overrides ── */
[data-theme="light"] {
  --ai-bg:     #ffffff;
  --ai-border: rgba(0,0,0,0.08);
  --ai-shadow: 0 24px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(124,58,237,0.1);
}
[data-theme="light"] .ai-anomaly-card { background:rgba(0,0,0,.02); }
[data-theme="light"] .ai-stat-box     { background:rgba(0,0,0,.03); }
[data-theme="light"] .ai-cat-head     { background:rgba(0,0,0,.03); }
[data-theme="light"] .ai-mini-stats   { background:rgba(0,0,0,.02); }
[data-theme="light"] .ai-summary-box  { background:rgba(124,58,237,.06); }
    `;
    document.head.appendChild(style);
};

// Re-attach _injectStyles so init() can call it
AIInsights._injectStylesAttached = AIInsights._injectStyles;
const _origInit = AIInsights.init;
AIInsights.init = function() {
    AIInsights._injectStyles();
    _origInit.call(AIInsights);
};

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AIInsights.init());
} else {
    AIInsights.init();
}


(function () {
    'use strict';

    const TABS = [
        { id: 'anomalies', label: 'Anomalies', icon: 'ph-warning-circle' },
        { id: 'forecast',  label: 'Forecast',  icon: 'ph-chart-line-up'  },
        { id: 'report',    label: 'Report',    icon: 'ph-file-text'      },
    ];

    let panelEl   = null;
    let fabEl     = null;
    let isOpen    = false;
    let activeTab = 'anomalies';
    let cache     = {};

    // ── Init ─────────────────────────────────────────────────
    function init() {
        if (document.getElementById('ai-fab')) return;
        injectStyles();
        createFAB();
        createPanel();
        document.addEventListener('click', function (e) {
            if (!isOpen) return;
            if (!e.target.closest('#ai-insights-panel') && !e.target.closest('#ai-fab')) close();
        });
    }

    // ── FAB ──────────────────────────────────────────────────
    function createFAB() {
        fabEl = document.createElement('button');
        fabEl.id = 'ai-fab';
        fabEl.title = 'AI Insights';
        fabEl.innerHTML =
            '<span class="ai-fab-ring"></span>' +
            '<i class="ph ph-sparkle"></i>' +
            '<span class="ai-fab-lbl">AI</span>' +
            '<span id="ai-fab-badge" class="ai-fab-badge"></span>';
        fabEl.addEventListener('click', toggle);
        document.body.appendChild(fabEl);
    }

    // ── Panel ─────────────────────────────────────────────────
    function createPanel() {
        panelEl = document.createElement('div');
        panelEl.id = 'ai-insights-panel';

        const tabsHtml = TABS.map(function (t) {
            return '<button class="ai-tab' + (t.id === activeTab ? ' active' : '') +
                '" data-tab="' + t.id + '"><i class="ph ' + t.icon + '"></i> ' + t.label + '</button>';
        }).join('');

        panelEl.innerHTML =
            '<div class="aip-header">' +
                '<div class="aip-title"><i class="ph ph-sparkle" style="color:#a78bfa;"></i> AI Insights <span class="aip-badge">Groq</span></div>' +
                '<div style="display:flex;gap:4px;">' +
                    '<button class="aip-icon-btn" id="aip-refresh" title="Refresh"><i class="ph ph-arrow-clockwise"></i></button>' +
                    '<button class="aip-icon-btn" id="aip-close" title="Close"><i class="ph ph-x"></i></button>' +
                '</div>' +
            '</div>' +
            '<div class="aip-tabs">' + tabsHtml + '</div>' +
            '<div id="aip-body" class="aip-body">' +
                '<div class="aip-loading"><div class="aip-spinner"></div><span>Initialising…</span></div>' +
            '</div>';

        document.body.appendChild(panelEl);

        panelEl.querySelectorAll('.ai-tab').forEach(function (btn) {
            btn.addEventListener('click', function () {
                activeTab = btn.dataset.tab;
                panelEl.querySelectorAll('.ai-tab').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                loadTab(activeTab);
            });
        });

        document.getElementById('aip-refresh').addEventListener('click', function () {
            delete cache[cacheKey(activeTab)];
            loadTab(activeTab);
        });
        document.getElementById('aip-close').addEventListener('click', close);

        panelEl.addEventListener('click', function (e) {
            if (e.target.closest('#aip-export-btn')) exportReport();
        });
    }

    // ── Open / Close ─────────────────────────────────────────
    function open() {
        if (!window.AppState || !window.AppState.currentProject) {
            if (window.showToast) window.showToast('Select a project first to use AI Insights', 'warning');
            return;
        }
        isOpen = true;
        panelEl.classList.add('active');
        fabEl.classList.add('open');
        loadTab(activeTab);
    }

    function close() {
        isOpen = false;
        panelEl.classList.remove('active');
        fabEl.classList.remove('open');
    }

    function toggle() { isOpen ? close() : open(); }

    function cacheKey(tab) {
        return (window.AppState && window.AppState.currentProject ? window.AppState.currentProject._id : 'x') + '_' + tab;
    }

    // ── Tab Loader ────────────────────────────────────────────
    async function loadTab(tab) {
        const body = document.getElementById('aip-body');
        if (!body) return;

        const key = cacheKey(tab);
        if (cache[key]) { body.innerHTML = cache[key]; return; }

        const msgs = { anomalies: 'Scanning for anomalies…', forecast: 'Computing forecast…', report: 'Generating report…' };
        body.innerHTML = '<div class="aip-loading"><div class="aip-spinner"></div><span>' + msgs[tab] + '</span></div>';

        try {
            const data = await fetchData();
            let html = '';
            if (tab === 'anomalies')     html = await tabAnomalies(data);
            else if (tab === 'forecast') html = await tabForecast(data);
            else                         html = await tabReport(data);

            cache[key] = html;
            body.innerHTML = html;
            updateBadge();
        } catch (err) {
            body.innerHTML =
                '<div class="aip-error"><i class="ph ph-warning-circle"></i><p>Failed to load insights</p>' +
                '<small>' + esc(err.message) + '</small>' +
                '<button onclick="window.AIInsights.refresh()" class="aip-retry-btn"><i class="ph ph-arrow-clockwise"></i> Retry</button></div>';
        }
    }

    // ── Fetch project data from MongoDB ───────────────────────
    async function fetchData() {
        const p  = window.AppState.currentProject;
        const id = p._id;
        const fn = window.normalizeFinancialSummary || function (s) { return s; };

        const [sumRes, labRes, matRes, eqRes, expRes] = await Promise.all([
            window.api.finance.getSummary(id),
            window.api.labour.getAll(id),
            window.api.materials.getAll(id),
            window.api.equipment.getAll(id),
            window.api.finance.getExpenses(id).catch(function () { return { success: false, data: [] }; })
        ]);

        return {
            p,
            summary:   sumRes.success ? fn(sumRes.data) : {},
            workers:   labRes.success ? labRes.data   : [],
            materials: matRes.success ? matRes.data   : [],
            equipment: eqRes.success  ? eqRes.data    : [],
            expenses:  expRes.success ? expRes.data   : []
        };
    }

    // ── Call Groq via IPC (main process handles the fetch) ────
    async function callGroq(systemPrompt, userPrompt) {
        const result = await window.api.ai.query({ systemPrompt, userPrompt });
        if (!result.success) throw new Error(result.message || 'AI query failed');
        let raw = result.data || '';
        raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        return raw;
    }

    // ════════════════════════════════════════════════════════
    // TAB 1 — ANOMALY DETECTION
    // ════════════════════════════════════════════════════════
    async function tabAnomalies(_ref) {
        const p = _ref.p, summary = _ref.summary, workers = _ref.workers, materials = _ref.materials;
        const budget    = num(p.budget);
        const spent     = num(summary.totalCost);
        const usedPct   = budget > 0 ? ((spent / budget) * 100).toFixed(1) : 0;
        const idleCount = workers.filter(function (w) { return num(w.totalCost) <= 0 && w.category !== 'Electrician'; }).length;
        const lowStock  = materials.filter(function (m) { return num(m.quantity) < 10; }).length;

        const prompt =
            'You are a construction finance analyst. Return ONLY a JSON array.\n' +
            'Each object: { "severity":"critical"|"warning"|"info", "category":string, "title":string(max 7 words), "detail":string(1 sentence), "action":string(1 sentence) }\n\n' +
            'Project: "' + p.name + '"\n' +
            'Budget: ₹' + budget.toLocaleString('en-IN') + '\n' +
            'Spent: ₹' + spent.toLocaleString('en-IN') + ' (' + usedPct + '% used)\n' +
            'Labour: ₹' + num(summary.labourCost).toLocaleString('en-IN') + '\n' +
            'Materials: ₹' + num(summary.materialCost).toLocaleString('en-IN') + '\n' +
            'Equipment: ₹' + num(summary.equipmentCost).toLocaleString('en-IN') + '\n' +
            'Other: ₹' + num(summary.otherExpenses).toLocaleString('en-IN') + '\n' +
            'Workers with zero cost: ' + idleCount + '\n' +
            'Low-stock items (qty<10): ' + lowStock + '\n\n' +
            'Return ONLY the JSON array. No markdown, no explanation.';

        let anomalies = [];
        try {
            const raw = await callGroq('Output ONLY valid JSON arrays. No prose, no markdown.', prompt);
            anomalies = JSON.parse(raw);
        } catch (e) {
            anomalies = fallbackAnomalies(summary, budget, idleCount, lowStock);
        }
        if (!Array.isArray(anomalies) || anomalies.length === 0) {
            anomalies = fallbackAnomalies(summary, budget, idleCount, lowStock);
        }

        const order = { critical: 0, warning: 1, info: 2 };
        anomalies.sort(function (a, b) { return (order[a.severity] || 3) - (order[b.severity] || 3); });

        if (anomalies.length === 0) {
            return '<div class="aip-empty"><i class="ph ph-check-circle" style="color:#10b981;font-size:2rem;"></i><p>No anomalies detected — finances look healthy!</p></div>';
        }

        const crit = anomalies.filter(function (a) { return a.severity === 'critical'; }).length;
        const warn = anomalies.filter(function (a) { return a.severity === 'warning'; }).length;

        return '<div class="aip-pills">' +
            (crit ? '<span class="aip-pill pill-crit"><i class="ph ph-warning-octagon"></i> ' + crit + ' Critical</span>' : '') +
            (warn ? '<span class="aip-pill pill-warn"><i class="ph ph-warning"></i> ' + warn + ' Warning</span>' : '') +
            '<span class="aip-pill pill-info"><i class="ph ph-info"></i> ' + anomalies.length + ' Total</span>' +
            '</div>' +
            anomalies.map(function (a) {
                return '<div class="aip-card sev-' + a.severity + '">' +
                    '<div class="aip-card-head"><span class="aip-dot sev-' + a.severity + '"></span>' +
                    '<strong>' + esc(a.title) + '</strong><span class="aip-cat">' + esc(a.category) + '</span></div>' +
                    '<p class="aip-detail">' + esc(a.detail) + '</p>' +
                    '<div class="aip-action"><i class="ph ph-lightbulb" style="color:#a78bfa;flex-shrink:0;"></i><span>' + esc(a.action) + '</span></div>' +
                    '</div>';
            }).join('');
    }

    function fallbackAnomalies(summary, budget, idleCount, lowStock) {
        const list = [];
        const spent = num(summary.totalCost);
        if (budget > 0) {
            const pct = (spent / budget) * 100;
            if (pct >= 100) list.push({ severity: 'critical', category: 'Budget', title: 'Project is over budget', detail: pct.toFixed(0) + '% of budget consumed.', action: 'Review all expenses immediately.' });
            else if (pct >= 90) list.push({ severity: 'critical', category: 'Budget', title: 'Budget critically low', detail: pct.toFixed(0) + '% used.', action: 'Freeze non-essential spending now.' });
            else if (pct >= 75) list.push({ severity: 'warning', category: 'Budget', title: 'High budget utilisation', detail: pct.toFixed(0) + '% consumed.', action: 'Monitor spending closely.' });
        }
        if (idleCount > 0) list.push({ severity: 'warning', category: 'Labour', title: 'Workers with no recorded cost', detail: idleCount + ' worker(s) have zero cost.', action: 'Verify attendance records.' });
        if (lowStock > 0) list.push({ severity: 'warning', category: 'Materials', title: 'Low stock detected', detail: lowStock + ' material(s) below qty 10.', action: 'Reorder low-stock items.' });
        if (list.length === 0) list.push({ severity: 'info', category: 'General', title: 'No issues detected', detail: 'All metrics appear within normal range.', action: 'Continue regular monitoring.' });
        return list;
    }

    // ════════════════════════════════════════════════════════
    // TAB 2 — COST FORECAST
    // ════════════════════════════════════════════════════════
    async function tabForecast(_ref) {
        const p = _ref.p, summary = _ref.summary, workers = _ref.workers, materials = _ref.materials, equipment = _ref.equipment, expenses = _ref.expenses;
        const budget  = num(p.budget);
        const spent   = num(summary.totalCost);
        const start   = p.startDate ? new Date(p.startDate) : null;
        const elapsed = start ? Math.max(1, Math.ceil((Date.now() - start) / 86400000)) : 30;

        const prompt =
            'You are a construction cost forecasting expert. Return ONLY a JSON object.\n' +
            'Fields: { "dailyBurnRate":number, "projectedTotalCost":number, "estimatedDaysToExhaust":number|null, ' +
            '"overBudgetBy":number, "confidenceLevel":"High"|"Medium"|"Low", "forecastSummary":string(2 sentences), ' +
            '"categoryForecasts":[{"category":string,"currentSpend":number,"projectedFinal":number,"trend":"Rising"|"Stable"|"Declining"}], ' +
            '"recommendations":[string,string,string] }\n\n' +
            'Project: "' + p.name + '"\nBudget: ₹' + budget.toLocaleString('en-IN') + '\n' +
            'Spent: ₹' + spent.toLocaleString('en-IN') + '\nDays Elapsed: ' + elapsed + '\n' +
            'Labour: ₹' + num(summary.labourCost).toLocaleString('en-IN') + '\n' +
            'Materials: ₹' + num(summary.materialCost).toLocaleString('en-IN') + '\n' +
            'Equipment: ₹' + num(summary.equipmentCost).toLocaleString('en-IN') + '\n' +
            'Other: ₹' + num(summary.otherExpenses).toLocaleString('en-IN') + '\n' +
            'Workers: ' + workers.length + ', Materials: ' + materials.length + ', Equipment: ' + equipment.length + ', Expense Records: ' + expenses.length + '\n\n' +
            'Return ONLY the JSON object.';

        let fc = {};
        try {
            const raw = await callGroq('Output ONLY valid JSON objects. No prose, no markdown.', prompt);
            fc = JSON.parse(raw);
        } catch (e) {
            fc = fallbackForecast(summary, budget, elapsed);
        }
        if (!fc || !fc.projectedTotalCost) fc = fallbackForecast(summary, budget, elapsed);

        const over = num(fc.overBudgetBy) > 0;
        const confClass = { High: 'conf-high', Medium: 'conf-medium', Low: 'conf-low' }[fc.confidenceLevel] || 'conf-low';

        let html =
            '<div class="aip-hero ' + (over ? 'hero-over' : 'hero-ok') + '">' +
                '<div class="aip-hero-label">' + (over ? '⚠ Over Budget' : '✓ On Track') + '</div>' +
                '<div class="aip-hero-big">' + fmt(num(fc.projectedTotalCost)) + '</div>' +
                '<div class="aip-hero-sub">Projected Final Cost</div>' +
                (over ? '<div class="aip-hero-over">+' + fmt(num(fc.overBudgetBy)) + ' over budget</div>' :
                    fc.estimatedDaysToExhaust != null ? '<div class="aip-hero-days"><i class="ph ph-clock"></i> ~' + fc.estimatedDaysToExhaust + ' days until budget runs out</div>' : '') +
            '</div>' +
            '<div class="aip-stat-row">' +
                '<div class="aip-stat"><div class="aip-stat-label">Daily Burn</div><div class="aip-stat-val">' + fmt(num(fc.dailyBurnRate)) + '</div><div class="aip-stat-sub">/day avg</div></div>' +
                '<div class="aip-stat"><div class="aip-stat-label">Budget</div><div class="aip-stat-val">' + fmt(budget) + '</div><div class="aip-stat-sub">allocated</div></div>' +
                '<div class="aip-stat"><div class="aip-stat-label">Confidence</div><div class="aip-stat-val ' + confClass + '">' + (fc.confidenceLevel || 'Low') + '</div><div class="aip-stat-sub">forecast</div></div>' +
            '</div>';

        if (fc.forecastSummary) {
            html += '<div class="aip-summary-box"><i class="ph ph-robot" style="color:#a78bfa;flex-shrink:0;margin-top:2px;"></i><p>' + esc(fc.forecastSummary) + '</p></div>';
        }

        if (Array.isArray(fc.categoryForecasts) && fc.categoryForecasts.length) {
            html += '<div class="aip-section-label">Category Breakdown</div><div class="aip-table">' +
                '<div class="aip-tr aip-thead"><span>Category</span><span>Current</span><span>Projected</span><span>Trend</span></div>' +
                fc.categoryForecasts.map(function (c) {
                    return '<div class="aip-tr"><span>' + esc(c.category) + '</span><span>' + fmt(num(c.currentSpend)) + '</span><span>' + fmt(num(c.projectedFinal)) + '</span>' +
                        '<span class="aip-trend-badge trend-' + (c.trend || 'stable').toLowerCase() + '">' + esc(c.trend) + '</span></div>';
                }).join('') + '</div>';
        }

        if (Array.isArray(fc.recommendations) && fc.recommendations.length) {
            html += '<div class="aip-section-label">Recommendations</div>' +
                fc.recommendations.map(function (r, i) {
                    return '<div class="aip-rec"><span class="aip-rec-num">' + (i + 1) + '</span><span>' + esc(r) + '</span></div>';
                }).join('');
        }

        return html;
    }

    function fallbackForecast(summary, budget, elapsed) {
        const spent = num(summary.totalCost);
        const daily = elapsed > 0 ? spent / elapsed : 0;
        const proj  = spent + daily * 60;
        return {
            dailyBurnRate: daily, projectedTotalCost: proj,
            estimatedDaysToExhaust: budget > 0 && daily > 0 ? Math.ceil((budget - spent) / daily) : null,
            overBudgetBy: Math.max(0, proj - budget), confidenceLevel: 'Low',
            forecastSummary: 'Forecast based on current spending trajectory with a 60-day projection window.',
            categoryForecasts: [], recommendations: ['Record all expenses regularly for better accuracy.']
        };
    }

    // ════════════════════════════════════════════════════════
    // TAB 3 — AUTO REPORT
    // ════════════════════════════════════════════════════════
    async function tabReport(_ref) {
        const p = _ref.p, summary = _ref.summary, workers = _ref.workers, materials = _ref.materials, equipment = _ref.equipment;
        const budget    = num(p.budget);
        const spent     = num(summary.totalCost);
        const remaining = budget - spent;
        const usedPct   = budget > 0 ? ((spent / budget) * 100).toFixed(1) : 0;

        const prompt =
            'You are a construction project manager. Return ONLY a JSON object for an executive status report.\n' +
            'Fields: { "overallStatus":"On Track"|"At Risk"|"Over Budget"|"Not Started", ' +
            '"executiveSummary":string(3-4 sentences), "financialHealth":string(2-3 sentences), ' +
            '"labourStatus":string(1-2 sentences), "materialsStatus":string(1-2 sentences), ' +
            '"keyRisks":[string,string,string], "nextSteps":[string,string,string], "generatedDate":string(DD MMM YYYY) }\n\n' +
            'Project: "' + p.name + '", Location: "' + (p.location || 'N/A') + '"\n' +
            'Start Date: ' + (p.startDate ? new Date(p.startDate).toLocaleDateString('en-IN') : 'N/A') + '\n' +
            'Budget: ₹' + budget.toLocaleString('en-IN') + '\n' +
            'Spent: ₹' + spent.toLocaleString('en-IN') + ' (' + usedPct + '%)\n' +
            'Remaining: ₹' + remaining.toLocaleString('en-IN') + '\n' +
            'Labour: ₹' + num(summary.labourCost).toLocaleString('en-IN') + '\n' +
            'Materials: ₹' + num(summary.materialCost).toLocaleString('en-IN') + '\n' +
            'Equipment: ₹' + num(summary.equipmentCost).toLocaleString('en-IN') + '\n' +
            'Workers: ' + workers.length + ', Material Items: ' + materials.length + ', Equipment: ' + equipment.length + '\n\n' +
            'Return ONLY the JSON object.';

        let rpt = {};
        try {
            const raw = await callGroq('Output ONLY valid JSON objects. No prose, no markdown.', prompt);
            rpt = JSON.parse(raw);
        } catch (e) {
            rpt = fallbackReport(p, summary, budget, workers, materials);
        }
        if (!rpt || !rpt.overallStatus) rpt = fallbackReport(p, summary, budget, workers, materials);

        const sc = { 'On Track': '#10b981', 'At Risk': '#f59e0b', 'Over Budget': '#ef4444', 'Not Started': '#6b7280' }[rpt.overallStatus] || '#a78bfa';

        let html =
            '<div class="aip-report-head">' +
                '<div class="aip-report-proj">' + esc(p.name) + '</div>' +
                '<div class="aip-report-meta">' +
                    '<span><i class="ph ph-calendar"></i> ' + (rpt.generatedDate || new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })) + '</span>' +
                    '<span class="aip-status-badge" style="background:' + sc + '20;color:' + sc + ';">' + esc(rpt.overallStatus || 'Unknown') + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="aip-section-label">Executive Summary</div><p class="aip-para">' + esc(rpt.executiveSummary || '') + '</p>' +
            '<div class="aip-section-label">Financial Health</div><p class="aip-para">' + esc(rpt.financialHealth || '') + '</p>' +
            '<div class="aip-mini-stats">' +
                '<div class="aip-mini"><span class="aip-mini-label">Budget</span><span class="aip-mini-val">' + fmt(budget) + '</span></div>' +
                '<div class="aip-mini"><span class="aip-mini-label">Spent</span><span class="aip-mini-val" style="color:#f59e0b;">' + fmt(spent) + '</span></div>' +
                '<div class="aip-mini"><span class="aip-mini-label">Remaining</span><span class="aip-mini-val" style="color:' + (remaining >= 0 ? '#10b981' : '#ef4444') + ';">' + fmt(remaining) + '</span></div>' +
            '</div>' +
            '<div class="aip-section-label">Labour & Materials</div>' +
            '<p class="aip-para">' + esc(rpt.labourStatus || '') + ' ' + esc(rpt.materialsStatus || '') + '</p>';

        if (Array.isArray(rpt.keyRisks) && rpt.keyRisks.length) {
            html += '<div class="aip-section-label">Key Risks</div>' +
                rpt.keyRisks.map(function (r) {
                    return '<div class="aip-risk"><i class="ph ph-warning" style="color:#f59e0b;flex-shrink:0;"></i><span>' + esc(r) + '</span></div>';
                }).join('');
        }

        if (Array.isArray(rpt.nextSteps) && rpt.nextSteps.length) {
            html += '<div class="aip-section-label">Next Steps</div>' +
                rpt.nextSteps.map(function (s, i) {
                    return '<div class="aip-rec"><span class="aip-rec-num">' + (i + 1) + '</span><span>' + esc(s) + '</span></div>';
                }).join('');
        }

        html += '<button id="aip-export-btn" class="aip-export-btn"><i class="ph ph-download-simple"></i> Export Report</button>';
        return html;
    }

    function fallbackReport(p, summary, budget, workers, materials) {
        const spent = num(summary.totalCost);
        const pct   = budget > 0 ? (spent / budget * 100).toFixed(0) : 0;
        const status = pct >= 100 ? 'Over Budget' : pct >= 75 ? 'At Risk' : spent === 0 ? 'Not Started' : 'On Track';
        return {
            overallStatus: status,
            executiveSummary: 'Project "' + p.name + '" is currently ' + status.toLowerCase() + '. ' + pct + '% of budget utilised.',
            financialHealth: 'Total expenditure: ' + fmt(spent) + ' of ' + fmt(budget) + ' budget.',
            labourStatus: workers.length + ' worker(s) registered.',
            materialsStatus: materials.length + ' material item(s) tracked.',
            keyRisks: pct >= 75 ? ['Budget utilisation is high'] : ['Ensure regular expense recording'],
            nextSteps: ['Review current expenses', 'Update cost forecasts', 'Check material stock levels'],
            generatedDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        };
    }

    // ── Export Report ─────────────────────────────────────────
    function exportReport() {
        const body = document.getElementById('aip-body');
        const p    = window.AppState && window.AppState.currentProject;
        if (!body) return;

        const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Report — ' + (p ? p.name : 'Project') + '</title>' +
            '<style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;color:#1a1a2e;line-height:1.7;}' +
            '.aip-report-proj{font-size:1.4rem;font-weight:800;margin-bottom:.3rem;}' +
            '.aip-report-meta{display:flex;gap:1rem;align-items:center;font-size:.85rem;color:#555;margin-bottom:1.5rem;}' +
            '.aip-status-badge{padding:.2rem .7rem;border-radius:20px;font-size:.75rem;font-weight:700;}' +
            '.aip-section-label{font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:#888;margin:1.2rem 0 .35rem;}' +
            '.aip-para{margin:.2rem 0 .6rem;font-size:.9rem;}' +
            '.aip-mini-stats{display:flex;gap:1.5rem;padding:.7rem;background:#f5f5f5;border-radius:8px;margin:.5rem 0;}' +
            '.aip-mini-label{font-size:.65rem;color:#888;display:block;}.aip-mini-val{font-weight:700;}' +
            '.aip-risk,.aip-rec{display:flex;gap:.5rem;margin:.3rem 0;font-size:.85rem;}' +
            '.aip-rec-num{background:#1a1a2e;color:#fff;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:.65rem;flex-shrink:0;}' +
            '#aip-export-btn,.aip-export-btn{display:none;}</style></head><body>' +
            body.innerHTML +
            '<hr style="margin-top:2rem;border:none;border-top:1px solid #eee;">' +
            '<p style="font-size:.72rem;color:#aaa;text-align:center;">Generated by AI Insights (Groq / llama-3.1-8b-instant) — ' + new Date().toLocaleString('en-IN') + '</p>' +
            '</body></html>';

        const blob = new Blob([html], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'Report_' + ((p ? p.name : 'project').replace(/\s+/g, '_')) + '_' + Date.now() + '.html';
        a.click();
        URL.revokeObjectURL(url);
        if (window.showToast) window.showToast('Report exported!', 'success');
    }

    // ── FAB Badge ─────────────────────────────────────────────
    function updateBadge() {
        const badge = document.getElementById('ai-fab-badge');
        const key   = cacheKey('anomalies');
        if (!badge || !cache[key]) return;
        const tmp = document.createElement('div');
        tmp.innerHTML = cache[key];
        const crits = tmp.querySelectorAll('.sev-critical').length;
        const warns = tmp.querySelectorAll('.sev-warning').length;
        const total = crits + warns;
        if (total > 0) {
            badge.textContent = total > 9 ? '9+' : total;
            badge.style.display = 'flex';
            badge.className = 'ai-fab-badge ' + (crits > 0 ? 'badge-crit' : 'badge-warn');
        } else {
            badge.style.display = 'none';
        }
    }

    // ── Helpers ───────────────────────────────────────────────
    function num(v, fb) {
        fb = fb === undefined ? 0 : fb;
        var n = typeof v === 'number' ? v : parseFloat(v);
        return isFinite(n) ? n : fb;
    }

    function fmt(v) {
        if (window.formatCurrency) return window.formatCurrency(v);
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v || 0);
    }

    function esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ── Styles ────────────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('ai-insights-css')) return;
        var s = document.createElement('style');
        s.id = 'ai-insights-css';
        s.textContent = [
            '#ai-fab{position:fixed;bottom:28px;right:28px;z-index:9000;width:58px;height:58px;border-radius:50%;border:none;',
            'background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;cursor:pointer;',
            'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;',
            'box-shadow:0 8px 28px rgba(124,58,237,.55);transition:transform .2s,box-shadow .2s;font-size:1.25rem;}',
            '#ai-fab:hover{transform:scale(1.1);box-shadow:0 12px 36px rgba(124,58,237,.7);}',
            '#ai-fab.open{transform:scale(.95);}',
            '.ai-fab-lbl{font-size:.52rem;font-weight:800;letter-spacing:.08em;line-height:1;}',
            '.ai-fab-ring{position:absolute;inset:-5px;border-radius:50%;border:2px solid rgba(167,139,250,.4);pointer-events:none;animation:aip-pulse 2.4s ease-in-out infinite;}',
            '@keyframes aip-pulse{0%,100%{opacity:.5;transform:scale(1);}50%{opacity:0;transform:scale(1.2);}}',
            '.ai-fab-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;',
            'font-size:.62rem;font-weight:800;align-items:center;justify-content:center;padding:0 4px;',
            'border:2px solid var(--bg-base,#0d0d1a);display:none;}',
            '.badge-crit{background:#ef4444;color:#fff;}.badge-warn{background:#f59e0b;color:#000;}',

            '#ai-insights-panel{position:fixed;bottom:100px;right:28px;z-index:9001;width:370px;max-height:70vh;',
            'border-radius:14px;background:var(--bg-card,#16162a);border:1px solid rgba(255,255,255,.08);',
            'box-shadow:0 24px 64px rgba(0,0,0,.6),0 0 0 1px rgba(167,139,250,.1);',
            'display:flex;flex-direction:column;overflow:hidden;',
            'opacity:0;transform:translateY(14px) scale(.97);pointer-events:none;transition:opacity .2s,transform .2s;}',
            '#ai-insights-panel.active{opacity:1;transform:translateY(0) scale(1);pointer-events:all;}',

            '.aip-header{display:flex;align-items:center;justify-content:space-between;padding:.8rem 1rem .7rem;',
            'border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0;',
            'background:linear-gradient(135deg,rgba(124,58,237,.18),rgba(167,139,250,.05));}',
            '.aip-title{display:flex;align-items:center;gap:.45rem;font-weight:700;font-size:.92rem;color:var(--text-primary,#f4f4f8);}',
            '.aip-badge{font-size:.58rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;',
            'background:rgba(167,139,250,.2);color:#a78bfa;padding:.13rem .42rem;border-radius:4px;}',
            '.aip-icon-btn{width:26px;height:26px;border-radius:6px;border:none;background:transparent;',
            'color:var(--text-muted,#9999b3);cursor:pointer;display:flex;align-items:center;justify-content:center;',
            'font-size:.95rem;transition:background .15s,color .15s;}',
            '.aip-icon-btn:hover{background:rgba(255,255,255,.07);color:var(--text-primary,#f4f4f8);}',

            '.aip-tabs{display:flex;border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0;}',
            '.ai-tab{flex:1;padding:.5rem .2rem;border:none;background:transparent;color:var(--text-muted,#9999b3);',
            'font-size:.72rem;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;',
            'gap:.3rem;border-bottom:2px solid transparent;transition:color .15s,border-color .15s;}',
            '.ai-tab:hover{color:var(--text-primary,#f4f4f8);}.ai-tab.active{color:#a78bfa;border-bottom-color:#a78bfa;}',

            '.aip-body{flex:1;overflow-y:auto;padding:.85rem;scrollbar-width:thin;scrollbar-color:rgba(167,139,250,.3) transparent;}',
            '.aip-body::-webkit-scrollbar{width:4px;}.aip-body::-webkit-scrollbar-thumb{background:rgba(167,139,250,.3);border-radius:2px;}',

            '.aip-loading,.aip-empty,.aip-error{display:flex;flex-direction:column;align-items:center;gap:.6rem;',
            'padding:2.2rem 1rem;text-align:center;color:var(--text-muted,#9999b3);font-size:.83rem;}',
            '.aip-spinner{width:26px;height:26px;border-radius:50%;border:3px solid rgba(167,139,250,.2);',
            'border-top-color:#a78bfa;animation:aip-spin .7s linear infinite;}',
            '@keyframes aip-spin{to{transform:rotate(360deg);}}',
            '.aip-retry-btn{margin-top:.35rem;padding:.35rem .85rem;border-radius:6px;',
            'border:1px solid rgba(255,255,255,.1);background:transparent;color:#a78bfa;cursor:pointer;font-size:.78rem;}',

            '.aip-pills{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.7rem;}',
            '.aip-pill{display:flex;align-items:center;gap:.3rem;padding:.18rem .55rem;border-radius:20px;font-size:.68rem;font-weight:700;}',
            '.pill-crit{background:rgba(239,68,68,.15);color:#ef4444;}.pill-warn{background:rgba(245,158,11,.15);color:#f59e0b;}',
            '.pill-info{background:rgba(96,165,250,.15);color:#60a5fa;}',

            '.aip-card{border-radius:8px;padding:.65rem .75rem;border:1px solid rgba(255,255,255,.06);',
            'background:rgba(255,255,255,.025);margin-bottom:.55rem;}',
            '.aip-card.sev-critical{border-left:3px solid #ef4444;}',
            '.aip-card.sev-warning{border-left:3px solid #f59e0b;}',
            '.aip-card.sev-info{border-left:3px solid #60a5fa;}',
            '.aip-card-head{display:flex;align-items:center;gap:.4rem;margin-bottom:.3rem;flex-wrap:wrap;}',
            '.aip-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}',
            '.aip-dot.sev-critical{background:#ef4444;}.aip-dot.sev-warning{background:#f59e0b;}.aip-dot.sev-info{background:#60a5fa;}',
            '.aip-cat{margin-left:auto;font-size:.6rem;font-weight:700;padding:.1rem .38rem;border-radius:4px;',
            'background:rgba(167,139,250,.15);color:#a78bfa;letter-spacing:.03em;}',
            '.aip-detail{font-size:.76rem;color:var(--text-secondary,#c4c4dc);margin:0 0 .38rem;line-height:1.5;}',
            '.aip-action{display:flex;gap:.38rem;align-items:flex-start;font-size:.72rem;color:var(--text-muted,#9999b3);',
            'background:rgba(167,139,250,.07);border-radius:5px;padding:.32rem .48rem;}',

            '.aip-hero{border-radius:10px;padding:.9rem;text-align:center;margin-bottom:.8rem;}',
            '.hero-ok{background:linear-gradient(135deg,rgba(16,185,129,.15),rgba(16,185,129,.05));border:1px solid rgba(16,185,129,.2);}',
            '.hero-over{background:linear-gradient(135deg,rgba(239,68,68,.15),rgba(239,68,68,.05));border:1px solid rgba(239,68,68,.2);}',
            '.aip-hero-label{font-size:.65rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.7;margin-bottom:.25rem;}',
            '.aip-hero-big{font-size:1.65rem;font-weight:800;font-family:var(--font-mono,monospace);color:var(--text-primary,#f4f4f8);}',
            '.aip-hero-sub{font-size:.7rem;color:var(--text-muted,#9999b3);margin-top:.12rem;}',
            '.aip-hero-over{margin-top:.35rem;font-size:.78rem;font-weight:700;color:#ef4444;}',
            '.aip-hero-days{margin-top:.35rem;font-size:.76rem;color:#f59e0b;display:flex;align-items:center;justify-content:center;gap:.3rem;}',

            '.aip-stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:.45rem;margin-bottom:.75rem;}',
            '.aip-stat{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:.5rem .45rem;text-align:center;}',
            '.aip-stat-label{font-size:.6rem;color:var(--text-muted,#9999b3);text-transform:uppercase;letter-spacing:.04em;}',
            '.aip-stat-val{font-size:.82rem;font-weight:700;font-family:var(--font-mono,monospace);color:var(--text-primary,#f4f4f8);margin:.18rem 0 .08rem;}',
            '.aip-stat-sub{font-size:.58rem;color:var(--text-muted,#9999b3);}',
            '.conf-high{color:#10b981;}.conf-medium{color:#f59e0b;}.conf-low{color:#ef4444;}',

            '.aip-summary-box{display:flex;gap:.45rem;align-items:flex-start;background:rgba(167,139,250,.08);',
            'border:1px solid rgba(167,139,250,.15);border-radius:8px;padding:.55rem .7rem;margin-bottom:.75rem;',
            'font-size:.76rem;color:var(--text-secondary,#c4c4dc);line-height:1.55;}',
            '.aip-summary-box p{margin:0;}',

            '.aip-section-label{font-size:.6rem;text-transform:uppercase;letter-spacing:.1em;',
            'color:var(--text-muted,#9999b3);margin:.8rem 0 .35rem;font-weight:700;}',

            '.aip-table{border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,.07);margin-bottom:.5rem;}',
            '.aip-tr{display:grid;grid-template-columns:1.4fr 1fr 1fr .8fr;padding:.42rem .65rem;font-size:.72rem;gap:.2rem;align-items:center;}',
            '.aip-thead{background:rgba(255,255,255,.04);font-weight:700;color:var(--text-muted,#9999b3);font-size:.62rem;text-transform:uppercase;letter-spacing:.04em;}',
            '.aip-tr:not(.aip-thead){border-top:1px solid rgba(255,255,255,.05);color:var(--text-secondary,#c4c4dc);}',
            '.aip-trend-badge{font-size:.62rem;font-weight:700;padding:.1rem .32rem;border-radius:4px;}',
            '.trend-rising{background:rgba(239,68,68,.15);color:#ef4444;}',
            '.trend-stable{background:rgba(96,165,250,.15);color:#60a5fa;}',
            '.trend-declining{background:rgba(16,185,129,.15);color:#10b981;}',

            '.aip-rec{display:flex;gap:.5rem;align-items:flex-start;font-size:.76rem;color:var(--text-secondary,#c4c4dc);margin-bottom:.4rem;}',
            '.aip-rec-num{min-width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#a78bfa);',
            'color:#fff;display:flex;align-items:center;justify-content:center;font-size:.62rem;font-weight:700;flex-shrink:0;margin-top:1px;}',

            '.aip-report-head{margin-bottom:.8rem;}',
            '.aip-report-proj{font-size:.98rem;font-weight:800;color:var(--text-primary,#f4f4f8);margin-bottom:.28rem;}',
            '.aip-report-meta{display:flex;align-items:center;gap:.55rem;flex-wrap:wrap;font-size:.7rem;color:var(--text-muted,#9999b3);}',
            '.aip-status-badge{padding:.18rem .55rem;border-radius:20px;font-size:.66rem;font-weight:700;}',
            '.aip-para{font-size:.76rem;color:var(--text-secondary,#c4c4dc);line-height:1.6;margin:.18rem 0 .5rem;}',
            '.aip-mini-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.38rem;background:rgba(255,255,255,.03);',
            'border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:.55rem;margin:.4rem 0;}',
            '.aip-mini{text-align:center;}',
            '.aip-mini-label{font-size:.58rem;color:var(--text-muted,#9999b3);text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:.18rem;}',
            '.aip-mini-val{font-size:.8rem;font-weight:700;font-family:var(--font-mono,monospace);color:var(--text-primary,#f4f4f8);}',
            '.aip-risk{display:flex;gap:.42rem;align-items:flex-start;font-size:.76rem;color:var(--text-secondary,#c4c4dc);',
            'padding:.28rem 0;border-bottom:1px solid rgba(255,255,255,.05);}',
            '.aip-risk:last-of-type{border-bottom:none;}',

            '.aip-export-btn{width:100%;margin-top:.8rem;padding:.52rem;border-radius:8px;',
            'border:1px solid rgba(167,139,250,.3);background:rgba(167,139,250,.1);color:#a78bfa;',
            'cursor:pointer;font-size:.78rem;font-weight:600;display:flex;align-items:center;justify-content:center;gap:.4rem;transition:background .15s;}',
            '.aip-export-btn:hover{background:rgba(167,139,250,.22);}',

            '[data-theme="light"] #ai-insights-panel{background:#fff;border-color:rgba(0,0,0,.08);',
            'box-shadow:0 24px 64px rgba(0,0,0,.18),0 0 0 1px rgba(124,58,237,.1);}',
            '[data-theme="light"] .aip-card{background:rgba(0,0,0,.02);}',
            '[data-theme="light"] .aip-stat{background:rgba(0,0,0,.03);}',
            '[data-theme="light"] .aip-mini-stats{background:rgba(0,0,0,.02);}',
            '[data-theme="light"] .aip-summary-box{background:rgba(124,58,237,.06);}',
            '[data-theme="light"] .aip-table{border-color:rgba(0,0,0,.08);}',
            '[data-theme="light"] .aip-thead{background:rgba(0,0,0,.03);}',
            '[data-theme="light"] .ai-fab-badge{border-color:#fff;}'
        ].join('');
        document.head.appendChild(s);
    }

    // ── Public API ────────────────────────────────────────────
    window.AIInsights = {
        open: open, close: close, toggle: toggle,
        refresh: function () { delete cache[cacheKey(activeTab)]; loadTab(activeTab); }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();


window.AIInsights = AIInsights;