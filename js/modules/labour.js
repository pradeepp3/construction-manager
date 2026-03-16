// ============================================================
// LABOUR MODULE — Full Labour Management System
// Sub-modules: Masonry, Centring, Concrete, E&P, Tiles, Painting
// ============================================================

// ── Sub-module router ─────────────────────────────────────────
async function loadLabourView() {
    const sub = window._labourSub || 'masonry';
    return loadLabourSubView(sub);
}

async function loadLabourSubView(sub) {
    window._labourSub = sub;
    const proj = window.AppState.currentProject;
    if (!proj) return '<div class="alert alert-warning">No project selected.</div>';

    switch (sub) {
        case 'masonry':    return await loadMasonryView(proj._id);
        case 'centring':   return await loadCentringView(proj._id);
        case 'concrete':   return await loadConcreteView(proj._id);
        case 'ep':         return await loadEPView(proj._id);
        case 'tiles':      return await loadTilesView(proj._id);
        case 'painting':   return await loadPaintingView(proj._id);
        case 'report':     return await loadLabourReport(proj._id);
        default:           return await loadMasonryView(proj._id);
    }
}

function initializeLabour() {
    // Navigation is handled entirely by the sidebar tree.
    // labourShell() syncs the sidebar active state on each render.
}

// ── Shared shell ──────────────────────────────────────────────
// Top tabs removed — navigation is sidebar-only.
// This function also syncs the sidebar active state for the current sub.
function labourShell(activeSub, bodyHtml) {
    // Sync sidebar highlight after DOM settles
    setTimeout(() => {
        // Clear all labour child highlights
        document.querySelectorAll('.nav-tree-child').forEach(b => b.classList.remove('active'));
        // Highlight the matching child
        const activeBtn = document.querySelector(`.nav-tree-child[data-labour-sub="${activeSub}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        // Keep parent toggle open & highlighted
        const toggle = document.getElementById('labour-tree-toggle');
        if (toggle) toggle.classList.add('open', 'active');
        const children = document.getElementById('labour-tree-children');
        if (children) children.classList.add('open');
        // Deactivate other top-level nav items
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    }, 0);

    return `
        <div class="labour-page animate-fade-in">
            <div id="labour-sub-body" class="labour-sub-body">${bodyHtml}</div>
        </div>`;
}

// ════════════════════════════════════════════════════════════
// 1 — MASONRY
// ════════════════════════════════════════════════════════════

// ── Helper: deduplicate worker names case-insensitively ──────
function uniqueWorkerNames(entries) {
    const seen  = new Set();
    const names = [];
    for (const e of (entries || [])) {
        const raw  = String(e.workerName || '').trim();
        const key  = raw.toLowerCase();
        if (key && !seen.has(key)) {
            seen.add(key);
            // Store in Title Case for display
            names.push(raw.replace(/\b\w/g, c => c.toUpperCase()));
        }
    }
    return names;
}

// ── Team list view ───────────────────────────────────────────
async function loadMasonryView(projectId) {
    const teamsRes = await window.api.labour.masonry.getTeams(projectId);
    const teams = teamsRes.success ? teamsRes.data : [];

    let html = `
        <div class="lsub-header">
            <div>
                <h3 class="lsub-title"><i class="ph ph-wall"></i> Masonry Teams</h3>
                <p class="lsub-desc">Click a team card to view entries and manage attendance</p>
            </div>
            <button class="btn btn-primary btn-sm" onclick="showMasonryTeamModal()">
                <i class="ph ph-plus"></i> New Team
            </button>
        </div>`;

    if (teams.length === 0) {
        html += emptyState('ph-wall', 'No Masonry Teams', 'Create your first masonry team to start tracking attendance and wages.', 'showMasonryTeamModal()', 'New Team');
    } else {
        html += '<div class="team-grid">' + teams.map(team => masonryTeamCard(team)).join('') + '</div>';
    }

    html += masonryTeamModal();
    return labourShell('masonry', html);
}

// ── Team card — NO Add Entry / View buttons ──────────────────
function masonryTeamCard(team) {
    const entries     = team.entries || [];
    const totalShifts = entries.reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);
    const totalCost   = entries.reduce((s, e) => s + parseFloat(e.wageAmount  || 0), 0);

    // Unique members (case-insensitive)
    const uniqueNames  = uniqueWorkerNames(entries);
    const workerCount  = uniqueNames.length;

    // Member pills — show all unique names
    const memberPills = uniqueNames.length > 0
        ? `<div class="team-member-pills">
            ${uniqueNames.map(n => `<span class="team-member-pill">${esc(n)}</span>`).join('')}
           </div>`
        : `<p class="team-no-members">No members recorded yet</p>`;

    return `
        <div class="team-card team-card-clickable"
             onclick="openMasonryTeamDetail('${team._id}', '${esc(team.teamName)}', '${esc(team.paymentType||'daily')}')">
            <div class="team-card-head">
                <div class="team-card-avatar"><i class="ph ph-wall"></i></div>
                <div style="flex:1;min-width:0;">
                    <div class="team-card-name">${esc(team.teamName)}</div>
                    <div class="team-card-meta">${esc(team.paymentType === 'sqft' ? 'Per Sq.ft' : 'Daily Wage')}</div>
                </div>
                <button class="btn btn-danger btn-sm"
                        onclick="event.stopPropagation(); deleteMasonryTeam('${team._id}','${esc(team.teamName)}')"
                        title="Delete team">
                    <i class="ph ph-trash"></i>
                </button>
            </div>

            <div class="team-card-stats">
                <div class="tcs">
                    <span class="tcs-label">Workers</span>
                    <span class="tcs-val">${workerCount}</span>
                </div>
                <div class="tcs">
                    <span class="tcs-label">Shifts</span>
                    <span class="tcs-val">${totalShifts}</span>
                </div>
                <div class="tcs">
                    <span class="tcs-label">Total Cost</span>
                    <span class="tcs-val">${fmt(totalCost)}</span>
                </div>
            </div>

            <div class="team-card-members">
                <div class="team-members-label">
                    <i class="ph ph-users"></i> Members
                    <span class="team-members-count">${workerCount}</span>
                </div>
                ${memberPills}
            </div>

            <div class="team-card-footer">
                <span class="team-card-hint"><i class="ph ph-arrow-right"></i> Click to view &amp; manage entries</span>
            </div>
        </div>`;
}

// ── Create Team Modal (only modal needed on team list page) ──
function masonryTeamModal() {
    return `
    <div id="masonryTeamModal" class="modal">
        <div class="modal-content" style="max-width:420px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="ph ph-wall"></i> New Masonry Team</h3>
                <button class="modal-close" onclick="hideModal('masonryTeamModal')"><i class="ph ph-x"></i></button>
            </div>
            <div class="form-group">
                <label class="form-label">Team Name</label>
                <input type="text" id="masonryTeamName" class="form-input" placeholder="e.g. Ram Mestry Team" />
            </div>
            <div class="form-group">
                <label class="form-label">Payment Type</label>
                <select id="masonryPayType" class="form-select">
                    <option value="sqft">Per Sq.ft</option>
                    <option value="daily">Daily Wage</option>
                </select>
            </div>
            <div class="flex gap">
                <button class="btn btn-outline" onclick="hideModal('masonryTeamModal')">Cancel</button>
                <button class="btn btn-primary" onclick="saveMasonryTeam()"><i class="ph ph-check"></i> Create</button>
            </div>
        </div>
    </div>`;
}

// ── Team Detail Page ─────────────────────────────────────────
async function openMasonryTeamDetail(teamId, teamName, paymentType) {
    // Persist team context for use by save/delete handlers
    window._masonryDetailTeamId   = teamId;
    window._masonryDetailTeamName = teamName;
    window._masonryDetailPayType  = paymentType;

    // Show loading in whatever container is available
    const viewContainer = document.getElementById('view-container');
    const subBody       = document.getElementById('labour-sub-body');
    const target        = subBody || viewContainer;
    if (!target) return;

    target.innerHTML = '<div class="labour-loading" style="padding:3rem;"><div class="labour-spin"></div><span>Loading team…</span></div>';

    const res     = await window.api.labour.masonry.getEntries(teamId);
    const entries = res.success ? res.data : [];

    // Render detail page — wraps in labour-page so back-nav restores correctly
    const html = `<div class="labour-page animate-fade-in">
        <div id="labour-sub-body" class="labour-sub-body">
            ${masonryDetailPage(teamId, teamName, paymentType, entries)}
        </div>
    </div>`;

    if (viewContainer) {
        viewContainer.innerHTML = html;
    } else {
        target.innerHTML = masonryDetailPage(teamId, teamName, paymentType, entries);
    }

    // Sync sidebar highlight to masonry
    setTimeout(() => {
        document.querySelectorAll('.nav-tree-child').forEach(b => b.classList.remove('active'));
        const activeBtn = document.querySelector('.nav-tree-child[data-labour-sub="masonry"]');
        if (activeBtn) activeBtn.classList.add('active');
        const toggle = document.getElementById('labour-tree-toggle');
        if (toggle) toggle.classList.add('open', 'active');
        const children = document.getElementById('labour-tree-children');
        if (children) children.classList.add('open');
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    }, 0);
}

function masonryDetailPage(teamId, teamName, paymentType, entries) {
    // ── Summary stats ──
    const totalShifts  = entries.reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);
    const totalCost    = entries.reduce((s, e) => s + parseFloat(e.wageAmount  || 0), 0);
    const masonCount   = entries.filter(e => e.workerRole === 'Mason').length;
    const menCount     = entries.filter(e => e.workerRole === 'Men Helper').length;
    const womenCount   = entries.filter(e => e.workerRole === 'Women Helper').length;
    const uniqueNames  = uniqueWorkerNames(entries);

    // ── Entries table rows ──
    const tableRows = entries.length === 0
        ? `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">
                No entries yet. Click <strong>Add Entry</strong> to record attendance.
           </td></tr>`
        : [...entries]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(e => `
            <tr>
                <td>${fmtDate(e.date)}</td>
                <td><strong>${esc(e.workerName)}</strong></td>
                <td><span class="role-badge role-${(e.workerRole||'').toLowerCase().replace(/\s+/g,'-')}">${esc(e.workerRole)}</span></td>
                <td><strong style="font-family:var(--font-mono,monospace);">${e.shiftCount}</strong></td>
                <td style="font-family:var(--font-mono,monospace);">${fmt(e.wageAmount)}</td>
                <td style="color:var(--text-muted);font-size:.8rem;">${esc(e.notes || '—')}</td>
                <td>
                    <button class="btn btn-sm btn-danger"
                            onclick="deleteMasonryEntryFromDetail('${e._id}')"
                            title="Delete entry">
                        <i class="ph ph-trash"></i>
                    </button>
                </td>
            </tr>`).join('');

    return `
        <!-- Back header -->
        <div class="detail-page-header">
            <button class="btn btn-outline btn-sm" onclick="backToMasonryList()">
                <i class="ph ph-arrow-left"></i> All Teams
            </button>
            <div class="detail-page-title">
                <div class="team-card-avatar" style="width:36px;height:36px;font-size:1rem;">
                    <i class="ph ph-wall"></i>
                </div>
                <div>
                    <h3 style="margin:0;font-size:1rem;font-weight:700;color:var(--text-primary);">${esc(teamName)}</h3>
                    <span class="team-card-meta">${paymentType === 'sqft' ? 'Per Sq.ft' : 'Daily Wage'}</span>
                </div>
            </div>
            <button class="btn btn-primary btn-sm"
                    onclick="showMasonryEntryModalFromDetail('${teamId}','${esc(teamName)}')">
                <i class="ph ph-plus"></i> Add Entry
            </button>
        </div>

        <!-- Summary strip -->
        <div class="detail-stats-strip">
            <div class="detail-stat">
                <span class="tcs-label">Total Entries</span>
                <span class="tcs-val">${entries.length}</span>
            </div>
            <div class="detail-stat">
                <span class="tcs-label">Total Shifts</span>
                <span class="tcs-val">${totalShifts}</span>
            </div>
            <div class="detail-stat">
                <span class="tcs-label">Total Cost</span>
                <span class="tcs-val" style="color:var(--success,#10b981);">${fmt(totalCost)}</span>
            </div>
            <div class="detail-stat">
                <span class="tcs-label">Masons</span>
                <span class="tcs-val">${masonCount}</span>
            </div>
            <div class="detail-stat">
                <span class="tcs-label">Men Helpers</span>
                <span class="tcs-val">${menCount}</span>
            </div>
            <div class="detail-stat">
                <span class="tcs-label">Women Helpers</span>
                <span class="tcs-val">${womenCount}</span>
            </div>
            <div class="detail-stat">
                <span class="tcs-label">Unique Members</span>
                <span class="tcs-val">${uniqueNames.length}</span>
            </div>
        </div>

        <!-- Unique members section -->
        ${uniqueNames.length > 0 ? `
        <div class="detail-members-section">
            <div class="team-members-label" style="margin-bottom:.6rem;">
                <i class="ph ph-identification-badge"></i> Team Members
            </div>
            <div class="team-member-pills">
                ${uniqueNames.map(n => `<span class="team-member-pill">${esc(n)}</span>`).join('')}
            </div>
        </div>` : ''}

        <!-- Entries table -->
        <div class="detail-table-section">
            <div class="detail-table-header">
                <span style="font-size:.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;">
                    All Entries
                    <span style="font-weight:400;margin-left:.4rem;">(${entries.length})</span>
                </span>
            </div>
            <div class="entry-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Worker Name</th>
                            <th>Role</th>
                            <th>Shifts</th>
                            <th>Wage</th>
                            <th>Notes</th>
                            <th style="width:48px;"></th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        </div>

        <!-- Add Entry Modal (lives inside detail page) -->
        <div id="masonryEntryModal" class="modal">
            <div class="modal-content" style="max-width:480px;">
                <div class="modal-header">
                    <h3 class="modal-title">
                        <i class="ph ph-plus-circle"></i> Add Entry —
                        <span style="color:var(--brand,#f59e0b);">${esc(teamName)}</span>
                    </h3>
                    <button class="modal-close" onclick="hideModal('masonryEntryModal')"><i class="ph ph-x"></i></button>
                </div>
                <input type="hidden" id="masonryEntryTeamId" value="${teamId}" />
                <input type="hidden" id="masonryEntryTeamName" value="${esc(teamName)}" />
                <div class="grid grid-2 gap">
                    <div class="form-group">
                        <label class="form-label">Date</label>
                        <input type="date" id="masonryEntryDate" class="form-input" value="${todayDate()}" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Worker Role</label>
                        <select id="masonryEntryRole" class="form-select">
                            <option value="Mason">Mason</option>
                            <option value="Men Helper">Men Helper</option>
                            <option value="Women Helper">Women Helper</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Worker Name</label>
                    <input type="text" id="masonryEntryWorker" class="form-input" placeholder="Worker name" />
                </div>
                <div class="grid grid-2 gap">
                    <div class="form-group">
                        <label class="form-label">Shift Count <span class="lbadge">attendance</span></label>
                        <input type="number" id="masonryEntryShift" class="form-input"
                               step="0.5" min="0.5" value="1" placeholder="1 or 1.5" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Wage Amount (₹)</label>
                        <input type="number" id="masonryEntryWage" class="form-input"
                               step="0.01" min="0" placeholder="Amount paid" />
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Notes (optional)</label>
                    <input type="text" id="masonryEntryNotes" class="form-input" placeholder="Any remarks" />
                </div>
                <div class="flex gap">
                    <button class="btn btn-outline" onclick="hideModal('masonryEntryModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="saveMasonryEntryFromDetail()">
                        <i class="ph ph-check"></i> Save Entry
                    </button>
                </div>
            </div>
        </div>`;
}

// ── Navigation helpers ───────────────────────────────────────
function backToMasonryList() {
    window._masonryDetailTeamId   = null;
    window._masonryDetailTeamName = null;
    window._masonryDetailPayType  = null;
    refreshLabourSub();
}

function showMasonryEntryModalFromDetail(teamId, teamName) {
    const tidEl  = document.getElementById('masonryEntryTeamId');
    const tnEl   = document.getElementById('masonryEntryTeamName');
    const dateEl = document.getElementById('masonryEntryDate');
    const wkrEl  = document.getElementById('masonryEntryWorker');
    const shEl   = document.getElementById('masonryEntryShift');
    const wgEl   = document.getElementById('masonryEntryWage');
    const ntEl   = document.getElementById('masonryEntryNotes');
    if (tidEl)  tidEl.value  = teamId;
    if (tnEl)   tnEl.value   = teamName;
    if (dateEl) dateEl.value = todayDate();
    if (wkrEl)  wkrEl.value  = '';
    if (shEl)   shEl.value   = '1';
    if (wgEl)   wgEl.value   = '';
    if (ntEl)   ntEl.value   = '';
    showModal('masonryEntryModal');
}

async function saveMasonryEntryFromDetail() {
    const teamId = document.getElementById('masonryEntryTeamId').value;
    const date   = document.getElementById('masonryEntryDate').value;
    const worker = document.getElementById('masonryEntryWorker').value.trim();
    const role   = document.getElementById('masonryEntryRole').value;
    const shift  = parseFloat(document.getElementById('masonryEntryShift').value);
    const wage   = parseFloat(document.getElementById('masonryEntryWage').value) || 0;
    const notes  = document.getElementById('masonryEntryNotes').value.trim();

    if (!date || !worker) { showToast('Fill date and worker name', 'warning'); return; }
    if (isNaN(shift) || shift <= 0) { showToast('Enter valid shift count', 'warning'); return; }

    showLoading();
    const res = await window.api.labour.masonry.addEntry({
        teamId,
        projectId: AppState.currentProject._id,
        date, workerName: worker, workerRole: role,
        shiftCount: shift, wageAmount: wage, notes
    });
    hideLoading();

    if (res.success) {
        hideModal('masonryEntryModal');
        showToast('Entry saved', 'success');
        // Reload detail page with fresh data
        const teamName  = window._masonryDetailTeamName || '';
        const payType   = window._masonryDetailPayType  || 'daily';
        await openMasonryTeamDetail(teamId, teamName, payType);
    } else {
        showToast('Failed: ' + res.message, 'danger');
    }
}

async function deleteMasonryEntryFromDetail(entryId) {
    if (!confirm('Delete this entry?')) return;
    const teamId     = window._masonryDetailTeamId   || '';
    const teamName   = window._masonryDetailTeamName || '';
    const paymentType = window._masonryDetailPayType || 'daily';
    showLoading();
    await window.api.labour.masonry.deleteEntry(entryId);
    hideLoading();
    showToast('Entry deleted', 'success');
    await openMasonryTeamDetail(teamId, teamName, paymentType);
}

// ── Team CRUD (unchanged logic, kept for compatibility) ───────
function showMasonryTeamModal() {
    document.getElementById('masonryTeamName').value = '';
    showModal('masonryTeamModal');
}

async function saveMasonryTeam() {
    const name    = document.getElementById('masonryTeamName').value.trim();
    const payType = document.getElementById('masonryPayType').value;
    if (!name) { showToast('Enter a team name', 'warning'); return; }
    showLoading();
    const res = await window.api.labour.masonry.createTeam({
        projectId: AppState.currentProject._id,
        teamName: name,
        paymentType: payType
    });
    hideLoading();
    if (res.success) {
        hideModal('masonryTeamModal');
        showToast(`${name} created`, 'success');
        await refreshLabourSub();
    } else {
        showToast('Failed: ' + res.message, 'danger');
    }
}

async function deleteMasonryTeam(id, name) {
    if (!confirm(`Delete "${name}" and all its entries?`)) return;
    showLoading();
    await window.api.labour.masonry.deleteTeam(id);
    hideLoading();
    showToast(`${name} deleted`, 'success');
    await refreshLabourSub();
}

// Legacy stubs kept so any external references don't break
function showMasonryEntryModal(teamId, teamName) {
    showMasonryEntryModalFromDetail(teamId, teamName);
}
async function saveMasonryEntry() { await saveMasonryEntryFromDetail(); }
async function showMasonryEntries(teamId, teamName) {
    await openMasonryTeamDetail(teamId, teamName || window._masonryDetailTeamName || '', window._masonryDetailPayType || 'daily');
}
async function deleteMasonryEntry(entryId, teamId) {
    await deleteMasonryEntryFromDetail(entryId, teamId, window._masonryDetailTeamName || '', window._masonryDetailPayType || 'daily');
}

// ════════════════════════════════════════════════════════════
// 2 — CENTRING
// ════════════════════════════════════════════════════════════

// ── Team list view ───────────────────────────────────────────
async function loadCentringView(projectId) {
    const teamsRes = await window.api.labour.centring.getTeams(projectId);
    const teams = teamsRes.success ? teamsRes.data : [];

    let html = `
        <div class="lsub-header">
            <div>
                <h3 class="lsub-title"><i class="ph ph-columns"></i> Centring Teams</h3>
                <p class="lsub-desc">Click a team card to view entries and manage attendance</p>
            </div>
            <button class="btn btn-primary btn-sm" onclick="showCentringTeamModal()">
                <i class="ph ph-plus"></i> New Team
            </button>
        </div>`;

    if (teams.length === 0) {
        html += emptyState('ph-columns', 'No Centring Teams', 'Create your first centring team to start tracking attendance and wages.', 'showCentringTeamModal()', 'New Team');
    } else {
        html += '<div class="team-grid">' + teams.map(t => centringTeamCard(t)).join('') + '</div>';
    }
    html += centringTeamModal();
    return labourShell('centring', html);
}

// ── Team card — clickable, no Add Entry / View buttons ───────
function centringTeamCard(team) {
    const entries     = team.entries || [];
    const totalShifts = entries.reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);
    const totalCost   = entries.reduce((s, e) => s + parseFloat(e.wageAmount  || 0), 0);
    const uniqueNames = uniqueWorkerNames(entries);
    const workerCount = uniqueNames.length;

    const memberPills = uniqueNames.length > 0
        ? `<div class="team-member-pills">${uniqueNames.map(n => `<span class="team-member-pill">${esc(n)}</span>`).join('')}</div>`
        : `<p class="team-no-members">No members recorded yet</p>`;

    return `
        <div class="team-card team-card-clickable"
             onclick="openCentringTeamDetail('${team._id}','${esc(team.teamName)}','${esc(team.paymentType||'daily')}')">
            <div class="team-card-head">
                <div class="team-card-avatar" style="background:rgba(59,130,246,.15);color:#3b82f6;">
                    <i class="ph ph-columns"></i>
                </div>
                <div style="flex:1;min-width:0;">
                    <div class="team-card-name">${esc(team.teamName)}</div>
                    <div class="team-card-meta">${esc(team.paymentType === 'sqft' ? 'Per Sq.ft' : 'Daily Wage')}</div>
                </div>
                <button class="btn btn-danger btn-sm"
                        onclick="event.stopPropagation(); deleteCentringTeam('${team._id}','${esc(team.teamName)}')"
                        title="Delete team">
                    <i class="ph ph-trash"></i>
                </button>
            </div>
            <div class="team-card-stats">
                <div class="tcs"><span class="tcs-label">Workers</span><span class="tcs-val">${workerCount}</span></div>
                <div class="tcs"><span class="tcs-label">Shifts</span><span class="tcs-val">${totalShifts}</span></div>
                <div class="tcs"><span class="tcs-label">Total Cost</span><span class="tcs-val">${fmt(totalCost)}</span></div>
            </div>
            <div class="team-card-members">
                <div class="team-members-label">
                    <i class="ph ph-users"></i> Members
                    <span class="team-members-count">${workerCount}</span>
                </div>
                ${memberPills}
            </div>
            <div class="team-card-footer">
                <span class="team-card-hint"><i class="ph ph-arrow-right"></i> Click to view &amp; manage entries</span>
            </div>
        </div>`;
}

// ── Create Team Modal ────────────────────────────────────────
function centringTeamModal() {
    return `
    <div id="centringTeamModal" class="modal">
        <div class="modal-content" style="max-width:420px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="ph ph-columns"></i> New Centring Team</h3>
                <button class="modal-close" onclick="hideModal('centringTeamModal')"><i class="ph ph-x"></i></button>
            </div>
            <div class="form-group">
                <label class="form-label">Team Name</label>
                <input type="text" id="centringTeamName" class="form-input" placeholder="e.g. Centring Team A" />
            </div>
            <div class="form-group">
                <label class="form-label">Payment Type</label>
                <select id="centringPayType" class="form-select">
                    <option value="sqft">Per Sq.ft</option>
                    <option value="daily">Daily Wage</option>
                </select>
            </div>
            <div class="flex gap">
                <button class="btn btn-outline" onclick="hideModal('centringTeamModal')">Cancel</button>
                <button class="btn btn-primary" onclick="saveCentringTeam()"><i class="ph ph-check"></i> Create</button>
            </div>
        </div>
    </div>`;
}

// ── Team Detail Page ─────────────────────────────────────────
async function openCentringTeamDetail(teamId, teamName, paymentType) {
    window._centringDetailTeamId   = teamId;
    window._centringDetailTeamName = teamName;
    window._centringDetailPayType  = paymentType;

    const viewContainer = document.getElementById('view-container');
    const subBody       = document.getElementById('labour-sub-body');
    const target        = subBody || viewContainer;
    if (!target) return;

    target.innerHTML = '<div class="labour-loading" style="padding:3rem;"><div class="labour-spin"></div><span>Loading team…</span></div>';

    const res     = await window.api.labour.centring.getEntries(teamId);
    const entries = res.success ? res.data : [];

    const html = `<div class="labour-page animate-fade-in">
        <div id="labour-sub-body" class="labour-sub-body">
            ${centringDetailPage(teamId, teamName, paymentType, entries)}
        </div>
    </div>`;

    if (viewContainer) {
        viewContainer.innerHTML = html;
    } else {
        target.innerHTML = centringDetailPage(teamId, teamName, paymentType, entries);
    }

    setTimeout(() => {
        document.querySelectorAll('.nav-tree-child').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector('.nav-tree-child[data-labour-sub="centring"]');
        if (btn) btn.classList.add('active');
        const toggle = document.getElementById('labour-tree-toggle');
        if (toggle) toggle.classList.add('open', 'active');
        const children = document.getElementById('labour-tree-children');
        if (children) children.classList.add('open');
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    }, 0);
}

function centringDetailPage(teamId, teamName, paymentType, entries) {
    const totalShifts  = entries.reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);
    const totalCost    = entries.reduce((s, e) => s + parseFloat(e.wageAmount  || 0), 0);
    const totalSqft    = entries.reduce((s, e) => s + parseFloat(e.sqftCompleted || 0), 0);
    const uniqueNames  = uniqueWorkerNames(entries);

    const tableRows = entries.length === 0
        ? `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">
               No entries yet. Click <strong>Add Entry</strong> to record attendance.
           </td></tr>`
        : [...entries].sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => `
            <tr>
                <td>${fmtDate(e.date)}</td>
                <td><strong>${esc(e.workerName)}</strong></td>
                <td><strong style="font-family:var(--font-mono,monospace);">${e.shiftCount}</strong></td>
                <td style="font-family:var(--font-mono,monospace);">${e.sqftCompleted || 0}</td>
                <td style="font-family:var(--font-mono,monospace);">${fmt(e.wageAmount)}</td>
                <td>
                    <button class="btn btn-sm btn-danger"
                            onclick="deleteCentringEntryFromDetail('${e._id}')"
                            title="Delete entry">
                        <i class="ph ph-trash"></i>
                    </button>
                </td>
            </tr>`).join('');

    return `
        <div class="detail-page-header">
            <button class="btn btn-outline btn-sm" onclick="backToCentringList()">
                <i class="ph ph-arrow-left"></i> All Teams
            </button>
            <div class="detail-page-title">
                <div class="team-card-avatar" style="width:36px;height:36px;font-size:1rem;background:rgba(59,130,246,.15);color:#3b82f6;">
                    <i class="ph ph-columns"></i>
                </div>
                <div>
                    <h3 style="margin:0;font-size:1rem;font-weight:700;color:var(--text-primary);">${esc(teamName)}</h3>
                    <span class="team-card-meta">${paymentType === 'sqft' ? 'Per Sq.ft' : 'Daily Wage'}</span>
                </div>
            </div>
            <button class="btn btn-primary btn-sm"
                    onclick="showCentringEntryModalFromDetail('${teamId}','${esc(teamName)}','${esc(paymentType)}')">
                <i class="ph ph-plus"></i> Add Entry
            </button>
        </div>

        <div class="detail-stats-strip">
            <div class="detail-stat"><span class="tcs-label">Total Entries</span><span class="tcs-val">${entries.length}</span></div>
            <div class="detail-stat"><span class="tcs-label">Total Shifts</span><span class="tcs-val">${totalShifts}</span></div>
            <div class="detail-stat"><span class="tcs-label">Sq.ft Done</span><span class="tcs-val">${totalSqft.toFixed(1)}</span></div>
            <div class="detail-stat"><span class="tcs-label">Total Cost</span><span class="tcs-val" style="color:var(--success,#10b981);">${fmt(totalCost)}</span></div>
            <div class="detail-stat"><span class="tcs-label">Unique Workers</span><span class="tcs-val">${uniqueNames.length}</span></div>
        </div>

        ${uniqueNames.length > 0 ? `
        <div class="detail-members-section">
            <div class="team-members-label" style="margin-bottom:.6rem;">
                <i class="ph ph-identification-badge"></i> Team Members
            </div>
            <div class="team-member-pills">
                ${uniqueNames.map(n => `<span class="team-member-pill">${esc(n)}</span>`).join('')}
            </div>
        </div>` : ''}

        <div class="detail-table-section">
            <div class="detail-table-header">
                <span style="font-size:.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;">
                    All Entries <span style="font-weight:400;margin-left:.4rem;">(${entries.length})</span>
                </span>
            </div>
            <div class="entry-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th><th>Worker Name</th><th>Shifts</th>
                            <th>Sq.ft</th><th>Wage</th><th style="width:48px;"></th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        </div>

        <!-- Add Entry Modal -->
        <div id="centringEntryModal" class="modal">
            <div class="modal-content" style="max-width:480px;">
                <div class="modal-header">
                    <h3 class="modal-title">
                        <i class="ph ph-plus-circle"></i> Add Entry —
                        <span style="color:var(--brand,#f59e0b);">${esc(teamName)}</span>
                    </h3>
                    <button class="modal-close" onclick="hideModal('centringEntryModal')"><i class="ph ph-x"></i></button>
                </div>
                <input type="hidden" id="centringEntryTeamId" value="${teamId}" />
                <div class="grid grid-2 gap">
                    <div class="form-group">
                        <label class="form-label">Date</label>
                        <input type="date" id="centringEntryDate" class="form-input" value="${todayDate()}" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Worker Name</label>
                        <input type="text" id="centringEntryWorker" class="form-input" placeholder="Name" />
                    </div>
                </div>
                <div class="grid grid-2 gap">
                    <div class="form-group">
                        <label class="form-label">Shift Count <span class="lbadge">attendance</span></label>
                        <input type="number" id="centringEntryShift" class="form-input" step="0.5" min="0.5" value="1" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Wage Amount (₹)</label>
                        <input type="number" id="centringEntryWage" class="form-input" step="0.01" min="0" />
                    </div>
                </div>
                <div class="form-group" id="centringEntryQtyGroup"
                     style="display:${paymentType === 'sqft' ? 'block' : 'none'}">
                    <label class="form-label">Sq.ft Completed</label>
                    <input type="number" id="centringEntrySqft" class="form-input" step="0.01" min="0" value="0" />
                </div>
                <div class="flex gap">
                    <button class="btn btn-outline" onclick="hideModal('centringEntryModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="saveCentringEntryFromDetail()">
                        <i class="ph ph-check"></i> Save Entry
                    </button>
                </div>
            </div>
        </div>`;
}

// ── Navigation helpers ───────────────────────────────────────
function backToCentringList() {
    window._centringDetailTeamId   = null;
    window._centringDetailTeamName = null;
    window._centringDetailPayType  = null;
    refreshLabourSub();
}

function showCentringEntryModalFromDetail(teamId, teamName, paymentType) {
    const dateEl = document.getElementById('centringEntryDate');
    const wkrEl  = document.getElementById('centringEntryWorker');
    const shEl   = document.getElementById('centringEntryShift');
    const wgEl   = document.getElementById('centringEntryWage');
    const sqEl   = document.getElementById('centringEntrySqft');
    const qtyGrp = document.getElementById('centringEntryQtyGroup');
    if (dateEl) dateEl.value = todayDate();
    if (wkrEl)  wkrEl.value  = '';
    if (shEl)   shEl.value   = '1';
    if (wgEl)   wgEl.value   = '';
    if (sqEl)   sqEl.value   = '0';
    if (qtyGrp) qtyGrp.style.display = (paymentType === 'sqft') ? 'block' : 'none';
    showModal('centringEntryModal');
}

async function saveCentringEntryFromDetail() {
    const teamId = document.getElementById('centringEntryTeamId').value;
    const date   = document.getElementById('centringEntryDate').value;
    const worker = document.getElementById('centringEntryWorker').value.trim();
    const shift  = parseFloat(document.getElementById('centringEntryShift').value);
    const wage   = parseFloat(document.getElementById('centringEntryWage').value) || 0;
    const sqft   = parseFloat(document.getElementById('centringEntrySqft').value) || 0;

    if (!date || !worker) { showToast('Fill date and worker name', 'warning'); return; }
    if (isNaN(shift) || shift <= 0) { showToast('Enter valid shift count', 'warning'); return; }

    showLoading();
    const res = await window.api.labour.centring.addEntry({
        teamId, projectId: AppState.currentProject._id,
        date, workerName: worker, shiftCount: shift, wageAmount: wage, sqftCompleted: sqft
    });
    hideLoading();

    if (res.success) {
        hideModal('centringEntryModal');
        showToast('Entry saved', 'success');
        await openCentringTeamDetail(teamId, window._centringDetailTeamName || '', window._centringDetailPayType || 'daily');
    } else {
        showToast('Failed: ' + res.message, 'danger');
    }
}

async function deleteCentringEntryFromDetail(entryId) {
    if (!confirm('Delete this entry?')) return;
    const teamId      = window._centringDetailTeamId   || '';
    const teamName    = window._centringDetailTeamName || '';
    const paymentType = window._centringDetailPayType  || 'daily';
    showLoading();
    await window.api.labour.centring.deleteEntry(entryId);
    hideLoading();
    showToast('Entry deleted', 'success');
    await openCentringTeamDetail(teamId, teamName, paymentType);
}

// ── Team CRUD ────────────────────────────────────────────────
function showCentringTeamModal() {
    document.getElementById('centringTeamName').value = '';
    showModal('centringTeamModal');
}

async function saveCentringTeam() {
    const name    = document.getElementById('centringTeamName').value.trim();
    const payType = document.getElementById('centringPayType').value;
    if (!name) { showToast('Enter a team name', 'warning'); return; }
    showLoading();
    const res = await window.api.labour.centring.createTeam({ projectId: AppState.currentProject._id, teamName: name, paymentType: payType });
    hideLoading();
    if (res.success) { hideModal('centringTeamModal'); showToast(`${name} created`, 'success'); await refreshLabourSub(); }
    else showToast('Failed: ' + res.message, 'danger');
}

async function deleteCentringTeam(id, name) {
    if (!confirm(`Delete "${name}" and all its entries?`)) return;
    showLoading(); await window.api.labour.centring.deleteTeam(id); hideLoading();
    showToast(`${name} deleted`, 'success'); await refreshLabourSub();
}

// Legacy stubs
function showCentringEntryModal(teamId, teamName, payType) { showCentringEntryModalFromDetail(teamId, teamName, payType); }
async function saveCentringEntry() { await saveCentringEntryFromDetail(); }
async function showCentringEntries(teamId) { await openCentringTeamDetail(teamId, window._centringDetailTeamName || '', window._centringDetailPayType || 'daily'); }
async function deleteCentringEntry(entryId) { await deleteCentringEntryFromDetail(entryId); }

// ════════════════════════════════════════════════════════════
// 3 — CONCRETE TEAM
// ════════════════════════════════════════════════════════════
// Concrete has no separate team collection — entries are grouped
// by teamName string. We build virtual "team cards" from that.
// ════════════════════════════════════════════════════════════

// ── Helper: group concrete entries by teamName ───────────────
function groupConcreteByTeam(entries) {
    const map = new Map();
    for (const e of entries) {
        const raw = String(e.teamName || '').trim();
        const key = raw.toLowerCase();
        if (!key) continue;
        if (!map.has(key)) {
            map.set(key, { teamName: raw.replace(/\b\w/g, c => c.toUpperCase()), entries: [] });
        }
        map.get(key).entries.push(e);
    }
    // Sort teams alphabetically
    return [...map.values()].sort((a, b) => a.teamName.localeCompare(b.teamName));
}

// ── Team list view ───────────────────────────────────────────
async function loadConcreteView(projectId) {
    const res     = await window.api.labour.concrete.getAll(projectId);
    const allEntries = res.success ? res.data : [];
    const teams   = groupConcreteByTeam(allEntries);

    // Grand totals
    const grandCost   = allEntries.reduce((s, e) => s + parseFloat(e.amount    || 0), 0);
    const grandShifts = allEntries.reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);

    let html = `
        <div class="lsub-header">
            <div>
                <h3 class="lsub-title"><i class="ph ph-cylinder"></i> Concrete Teams</h3>
                <p class="lsub-desc">Click a team card to view records and add new entries</p>
            </div>
            <div class="flex gap-sm">
                ${allEntries.length > 0 ? `<div class="lsub-stat-chip"><i class="ph ph-currency-inr"></i> Total: ${fmt(grandCost)}</div>` : ''}
                <button class="btn btn-primary btn-sm" onclick="showConcreteAddTeamPrompt()">
                    <i class="ph ph-plus"></i> New Record
                </button>
            </div>
        </div>`;

    if (teams.length === 0) {
        html += emptyState('ph-cylinder', 'No Concrete Records', 'Add your first concrete pour record to start tracking shifts and costs.', 'showConcreteAddTeamPrompt()', 'Add Concrete Record');
    } else {
        html += '<div class="team-grid">' + teams.map(t => concreteTeamCard(t)).join('') + '</div>';
    }

    // Create Team Prompt Modal (lightweight — just asks for team name then opens detail)
    html += `
    <div id="concreteTeamPromptModal" class="modal">
        <div class="modal-content" style="max-width:420px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="ph ph-cylinder"></i> Add Concrete Record</h3>
                <button class="modal-close" onclick="hideModal('concreteTeamPromptModal')"><i class="ph ph-x"></i></button>
            </div>
            <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:1rem;">
                Enter the team or contractor name to open their record sheet.
            </p>
            <div class="form-group">
                <label class="form-label">Team / Contractor Name</label>
                <input type="text" id="concreteNewTeamName" class="form-input"
                       placeholder="e.g. Kumar Concrete Team" />
            </div>
            <div class="flex gap">
                <button class="btn btn-outline" onclick="hideModal('concreteTeamPromptModal')">Cancel</button>
                <button class="btn btn-primary" onclick="openConcreteTeamFromPrompt()">
                    <i class="ph ph-arrow-right"></i> Open Sheet
                </button>
            </div>
        </div>
    </div>`;

    return labourShell('concrete', html);
}

// ── Team card — clickable, no Add / View buttons ─────────────
function concreteTeamCard(team) {
    const entries     = team.entries || [];
    const totalShifts = entries.reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);
    const totalCost   = entries.reduce((s, e) => s + parseFloat(e.amount     || 0), 0);
    const totalMen    = entries.reduce((s, e) => s + parseInt(e.menCount     || 0), 0);
    const totalWomen  = entries.reduce((s, e) => s + parseInt(e.womenCount   || 0), 0);

    // For concrete, "members" = distinct payment types used + men/women counts as summary
    const lumpCount = entries.filter(e => e.paymentType === 'Lump Sum').length;
    const rmcCount  = entries.filter(e => e.paymentType === 'RMC').length;

    return `
        <div class="team-card team-card-clickable"
             onclick="openConcreteTeamDetail('${esc(team.teamName)}')">
            <div class="team-card-head">
                <div class="team-card-avatar" style="background:rgba(168,85,247,.15);color:#a855f7;">
                    <i class="ph ph-cylinder"></i>
                </div>
                <div style="flex:1;min-width:0;">
                    <div class="team-card-name">${esc(team.teamName)}</div>
                    <div class="team-card-meta">${entries.length} record(s)</div>
                </div>
                <button class="btn btn-danger btn-sm"
                        onclick="event.stopPropagation(); deleteConcreteTeamAll('${esc(team.teamName)}')"
                        title="Delete all records for this team">
                    <i class="ph ph-trash"></i>
                </button>
            </div>

            <div class="team-card-stats">
                <div class="tcs">
                    <span class="tcs-label">Total Shifts</span>
                    <span class="tcs-val">${totalShifts}</span>
                </div>
                <div class="tcs">
                    <span class="tcs-label">Total Cost</span>
                    <span class="tcs-val">${fmt(totalCost)}</span>
                </div>
                <div class="tcs">
                    <span class="tcs-label">Records</span>
                    <span class="tcs-val">${entries.length}</span>
                </div>
            </div>

            <div class="team-card-members">
                <div class="team-members-label">
                    <i class="ph ph-users-three"></i> Workforce Summary
                    <span class="team-members-count">${totalMen + totalWomen}</span>
                </div>
                <div class="team-member-pills">
                    ${totalMen    > 0 ? `<span class="team-member-pill" style="background:rgba(59,130,246,.1);color:#3b82f6;border-color:rgba(59,130,246,.2);">
                        <i class="ph ph-person"></i>&nbsp;${totalMen} Men</span>` : ''}
                    ${totalWomen  > 0 ? `<span class="team-member-pill" style="background:rgba(236,72,153,.1);color:#ec4899;border-color:rgba(236,72,153,.2);">
                        <i class="ph ph-person"></i>&nbsp;${totalWomen} Women</span>` : ''}
                    ${lumpCount   > 0 ? `<span class="team-member-pill" style="background:rgba(168,85,247,.1);color:#a855f7;border-color:rgba(168,85,247,.2);">
                        Lump Sum ×${lumpCount}</span>` : ''}
                    ${rmcCount    > 0 ? `<span class="team-member-pill" style="background:rgba(245,158,11,.1);color:#f59e0b;border-color:rgba(245,158,11,.2);">
                        RMC ×${rmcCount}</span>` : ''}
                    ${(totalMen + totalWomen + lumpCount + rmcCount) === 0
                        ? `<p class="team-no-members">No details recorded yet</p>` : ''}
                </div>
            </div>

            <div class="team-card-footer">
                <span class="team-card-hint"><i class="ph ph-arrow-right"></i> Click to view &amp; add records</span>
            </div>
        </div>`;
}

// ── Prompt: open or create a team by name ────────────────────
function showConcreteAddTeamPrompt() {
    const el = document.getElementById('concreteNewTeamName');
    if (el) el.value = '';
    showModal('concreteTeamPromptModal');
}

function openConcreteTeamFromPrompt() {
    const name = (document.getElementById('concreteNewTeamName').value || '').trim();
    if (!name) { showToast('Enter a team name', 'warning'); return; }
    hideModal('concreteTeamPromptModal');
    openConcreteTeamDetail(name);
}

// ── Team Detail Page ─────────────────────────────────────────
async function openConcreteTeamDetail(teamName) {
    window._concreteDetailTeamName = teamName;

    const viewContainer = document.getElementById('view-container');
    const subBody       = document.getElementById('labour-sub-body');
    const target        = subBody || viewContainer;
    if (!target) return;

    target.innerHTML = '<div class="labour-loading" style="padding:3rem;"><div class="labour-spin"></div><span>Loading team…</span></div>';

    // Fetch all concrete entries for this project, then filter by teamName
    const projId  = AppState.currentProject._id;
    const res     = await window.api.labour.concrete.getAll(projId);
    const allEntries = res.success ? res.data : [];
    const entries = allEntries.filter(e =>
        String(e.teamName || '').toLowerCase().trim() === String(teamName).toLowerCase().trim()
    );

    const html = `<div class="labour-page animate-fade-in">
        <div id="labour-sub-body" class="labour-sub-body">
            ${concreteDetailPage(teamName, entries)}
        </div>
    </div>`;

    if (viewContainer) {
        viewContainer.innerHTML = html;
    } else {
        target.innerHTML = concreteDetailPage(teamName, entries);
    }

    setTimeout(() => {
        document.querySelectorAll('.nav-tree-child').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector('.nav-tree-child[data-labour-sub="concrete"]');
        if (btn) btn.classList.add('active');
        const toggle = document.getElementById('labour-tree-toggle');
        if (toggle) toggle.classList.add('open', 'active');
        const children = document.getElementById('labour-tree-children');
        if (children) children.classList.add('open');
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    }, 0);
}

function concreteDetailPage(teamName, entries) {
    const totalShifts = entries.reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);
    const totalCost   = entries.reduce((s, e) => s + parseFloat(e.amount     || 0), 0);
    const totalMen    = entries.reduce((s, e) => s + parseInt(e.menCount     || 0), 0);
    const totalWomen  = entries.reduce((s, e) => s + parseInt(e.womenCount   || 0), 0);

    const tableRows = entries.length === 0
        ? `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted);">
               No records yet. Click <strong>Add Record</strong> to start.
           </td></tr>`
        : [...entries].sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => `
            <tr>
                <td>${fmtDate(e.date)}</td>
                <td><strong style="font-family:var(--font-mono,monospace);">${e.shiftCount}</strong></td>
                <td>${e.menCount}</td>
                <td>${e.womenCount}</td>
                <td><span class="role-badge" style="background:rgba(168,85,247,.15);color:#a855f7;">${esc(e.paymentType)}</span></td>
                <td style="font-family:var(--font-mono,monospace);">${fmt(e.amount)}</td>
                <td style="color:var(--text-muted);font-size:.8rem;">${esc(e.notes || '—')}</td>
                <td>
                    <button class="btn btn-sm btn-danger"
                            onclick="deleteConcreteEntryFromDetail('${e._id}')"
                            title="Delete record">
                        <i class="ph ph-trash"></i>
                    </button>
                </td>
            </tr>`).join('');

    return `
        <!-- Back header -->
        <div class="detail-page-header">
            <button class="btn btn-outline btn-sm" onclick="backToConcreteList()">
                <i class="ph ph-arrow-left"></i> All Teams
            </button>
            <div class="detail-page-title">
                <div class="team-card-avatar" style="width:36px;height:36px;font-size:1rem;background:rgba(168,85,247,.15);color:#a855f7;">
                    <i class="ph ph-cylinder"></i>
                </div>
                <div>
                    <h3 style="margin:0;font-size:1rem;font-weight:700;color:var(--text-primary);">${esc(teamName)}</h3>
                    <span class="team-card-meta">Concrete Team</span>
                </div>
            </div>
            <button class="btn btn-primary btn-sm"
                    onclick="showConcreteEntryModalFromDetail()">
                <i class="ph ph-plus"></i> Add Record
            </button>
        </div>

        <!-- Stats strip -->
        <div class="detail-stats-strip">
            <div class="detail-stat"><span class="tcs-label">Total Records</span><span class="tcs-val">${entries.length}</span></div>
            <div class="detail-stat"><span class="tcs-label">Total Shifts</span><span class="tcs-val">${totalShifts}</span></div>
            <div class="detail-stat"><span class="tcs-label">Total Men</span><span class="tcs-val">${totalMen}</span></div>
            <div class="detail-stat"><span class="tcs-label">Total Women</span><span class="tcs-val">${totalWomen}</span></div>
            <div class="detail-stat"><span class="tcs-label">Total Workers</span><span class="tcs-val">${totalMen + totalWomen}</span></div>
            <div class="detail-stat"><span class="tcs-label">Total Cost</span>
                <span class="tcs-val" style="color:var(--success,#10b981);">${fmt(totalCost)}</span>
            </div>
        </div>

        <!-- Entries table -->
        <div class="detail-table-section">
            <div class="detail-table-header">
                <span style="font-size:.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;">
                    All Records <span style="font-weight:400;margin-left:.4rem;">(${entries.length})</span>
                </span>
            </div>
            <div class="entry-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th><th>Shifts</th><th>Men</th><th>Women</th>
                            <th>Type</th><th>Amount</th><th>Notes</th>
                            <th style="width:48px;"></th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        </div>

        <!-- Add Record Modal — lives inside detail page -->
        <div id="concreteModal" class="modal">
            <div class="modal-content" style="max-width:520px;">
                <div class="modal-header">
                    <h3 class="modal-title">
                        <i class="ph ph-cylinder"></i> Add Record —
                        <span style="color:var(--brand,#f59e0b);">${esc(teamName)}</span>
                    </h3>
                    <button class="modal-close" onclick="hideModal('concreteModal')"><i class="ph ph-x"></i></button>
                </div>
                <input type="hidden" id="concTeamName" value="${esc(teamName)}" />
                <div class="form-group">
                    <label class="form-label">Date</label>
                    <input type="date" id="concDate" class="form-input" value="${todayDate()}" />
                </div>
                <div class="grid grid-3 gap">
                    <div class="form-group">
                        <label class="form-label">Shifts <span class="lbadge">attendance</span></label>
                        <input type="number" id="concShifts" class="form-input" step="0.5" min="0" value="1" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Men Count</label>
                        <input type="number" id="concMen" class="form-input" min="0" value="0" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Women Count</label>
                        <input type="number" id="concWomen" class="form-input" min="0" value="0" />
                    </div>
                </div>
                <div class="grid grid-2 gap">
                    <div class="form-group">
                        <label class="form-label">Payment Type</label>
                        <select id="concPayType" class="form-select">
                            <option value="Lump Sum">Lump Sum</option>
                            <option value="RMC">RMC</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Amount (₹)</label>
                        <input type="number" id="concAmount" class="form-input" step="0.01" min="0" />
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Notes (optional)</label>
                    <input type="text" id="concNotes" class="form-input" placeholder="Any remarks" />
                </div>
                <div class="flex gap">
                    <button class="btn btn-outline" onclick="hideModal('concreteModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="saveConcreteEntryFromDetail()">
                        <i class="ph ph-check"></i> Save Record
                    </button>
                </div>
            </div>
        </div>`;
}

// ── Navigation helpers ───────────────────────────────────────
function backToConcreteList() {
    window._concreteDetailTeamName = null;
    refreshLabourSub();
}

function showConcreteEntryModalFromDetail() {
    const dateEl = document.getElementById('concDate');
    if (dateEl) dateEl.value = todayDate();
    ['concShifts'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '1'; });
    ['concMen','concWomen','concAmount'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '0'; });
    const notesEl = document.getElementById('concNotes');
    if (notesEl) notesEl.value = '';
    showModal('concreteModal');
}

async function saveConcreteEntryFromDetail() {
    const teamName = document.getElementById('concTeamName').value;
    const date     = document.getElementById('concDate').value;
    const shifts   = parseFloat(document.getElementById('concShifts').value) || 0;
    const men      = parseInt(document.getElementById('concMen').value)      || 0;
    const women    = parseInt(document.getElementById('concWomen').value)    || 0;
    const payType  = document.getElementById('concPayType').value;
    const amount   = parseFloat(document.getElementById('concAmount').value) || 0;
    const notes    = document.getElementById('concNotes').value.trim();

    if (!date) { showToast('Select a date', 'warning'); return; }
    if (!teamName) { showToast('Team name missing', 'warning'); return; }

    showLoading();
    const res = await window.api.labour.concrete.add({
        projectId: AppState.currentProject._id,
        date, teamName, shiftCount: shifts,
        menCount: men, womenCount: women,
        paymentType: payType, amount, notes
    });
    hideLoading();

    if (res.success) {
        hideModal('concreteModal');
        showToast('Record saved', 'success');
        await openConcreteTeamDetail(teamName);
    } else {
        showToast('Failed: ' + res.message, 'danger');
    }
}

async function deleteConcreteEntryFromDetail(entryId) {
    if (!confirm('Delete this record?')) return;
    const teamName = window._concreteDetailTeamName || '';
    showLoading();
    await window.api.labour.concrete.delete(entryId);
    hideLoading();
    showToast('Record deleted', 'success');
    await openConcreteTeamDetail(teamName);
}

// Delete ALL entries for a team (from the team card trash button)
async function deleteConcreteTeamAll(teamName) {
    if (!confirm(`Delete ALL records for "${teamName}"? This cannot be undone.`)) return;

    const projId  = AppState.currentProject._id;
    showLoading();
    const res     = await window.api.labour.concrete.getAll(projId);
    const entries = res.success ? res.data.filter(e =>
        String(e.teamName || '').toLowerCase().trim() === String(teamName).toLowerCase().trim()
    ) : [];

    for (const e of entries) {
        await window.api.labour.concrete.delete(e._id);
    }
    hideLoading();
    showToast(`${teamName} deleted`, 'success');
    await refreshLabourSub();
}

// Legacy stubs — kept so any old onclick references still work
function showConcreteModal() { showConcreteEntryModalFromDetail(); }
async function saveConcreteEntry() { await saveConcreteEntryFromDetail(); }
async function deleteConcreteEntry(id) { await deleteConcreteEntryFromDetail(id); }

// ════════════════════════════════════════════════════════════
// 4 — ELECTRICAL & PLUMBING
// ════════════════════════════════════════════════════════════
// No separate team collection — entries are grouped by workerName
// to produce virtual contractor cards, identical UI to masonry.
// ════════════════════════════════════════════════════════════

// ── Helper: group E&P entries by workerName ──────────────────
function groupEPByWorker(entries) {
    const map = new Map();
    for (const e of entries) {
        const raw = String(e.workerName || '').trim();
        const key = raw.toLowerCase();
        if (!key) continue;
        if (!map.has(key)) {
            map.set(key, {
                workerName: raw.replace(/\b\w/g, c => c.toUpperCase()),
                entries: []
            });
        }
        map.get(key).entries.push(e);
    }
    return [...map.values()].sort((a, b) => a.workerName.localeCompare(b.workerName));
}

// ── Team (contractor) list view ──────────────────────────────
async function loadEPView(projectId) {
    const res        = await window.api.labour.ep.getAll(projectId);
    const allEntries = res.success ? res.data : [];
    const contractors = groupEPByWorker(allEntries);
    const grandCost  = allEntries.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

    let html = `
        <div class="lsub-header">
            <div>
                <h3 class="lsub-title"><i class="ph ph-lightning"></i> Elec &amp; Plumbing</h3>
                <p class="lsub-desc">Click a contractor card to view records and add new entries</p>
            </div>
            <div class="flex gap-sm">
                ${allEntries.length > 0 ? `<div class="lsub-stat-chip"><i class="ph ph-currency-inr"></i> Total: ${fmt(grandCost)}</div>` : ''}
                <button class="btn btn-primary btn-sm" onclick="showEPAddContractorPrompt()">
                    <i class="ph ph-plus"></i> Add Work
                </button>
            </div>
        </div>`;

    if (contractors.length === 0) {
        html += emptyState('ph-lightning', 'No E&amp;P Records', 'Add your first electrical or plumbing work entry.', 'showEPAddContractorPrompt()', 'Add Work');
    } else {
        html += '<div class="team-grid">' + contractors.map(c => epContractorCard(c)).join('') + '</div>';
    }

    // Contractor prompt modal
    html += `
    <div id="epContractorPromptModal" class="modal">
        <div class="modal-content" style="max-width:420px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="ph ph-lightning"></i> Add E&amp;P Work</h3>
                <button class="modal-close" onclick="hideModal('epContractorPromptModal')"><i class="ph ph-x"></i></button>
            </div>
            <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:1rem;">
                Enter the contractor or worker name to open their record sheet.
            </p>
            <div class="form-group">
                <label class="form-label">Worker / Contractor Name</label>
                <input type="text" id="epNewContractorName" class="form-input"
                       placeholder="e.g. Rajan Electricals" />
            </div>
            <div class="flex gap">
                <button class="btn btn-outline" onclick="hideModal('epContractorPromptModal')">Cancel</button>
                <button class="btn btn-primary" onclick="openEPContractorFromPrompt()">
                    <i class="ph ph-arrow-right"></i> Open Sheet
                </button>
            </div>
        </div>
    </div>`;

    return labourShell('ep', html);
}

// ── Contractor card — clickable, no Add/View buttons ─────────
function epContractorCard(contractor) {
    const entries    = contractor.entries || [];
    const totalCost  = entries.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const totalWork  = entries.length;

    // Unique work descriptions as member pills
    const seen = new Set();
    const uniqueDescs = [];
    for (const e of entries) {
        const key = String(e.description || '').toLowerCase().trim();
        if (key && !seen.has(key)) {
            seen.add(key);
            uniqueDescs.push(String(e.description).trim());
        }
    }

    const descPills = uniqueDescs.length > 0
        ? `<div class="team-member-pills">
            ${uniqueDescs.map(d => `<span class="team-member-pill" style="background:rgba(245,158,11,.1);color:#f59e0b;border-color:rgba(245,158,11,.2);">${esc(d)}</span>`).join('')}
           </div>`
        : `<p class="team-no-members">No work items recorded yet</p>`;

    return `
        <div class="team-card team-card-clickable"
             onclick="openEPContractorDetail('${esc(contractor.workerName)}')">
            <div class="team-card-head">
                <div class="team-card-avatar" style="background:rgba(245,158,11,.15);color:#f59e0b;">
                    <i class="ph ph-lightning"></i>
                </div>
                <div style="flex:1;min-width:0;">
                    <div class="team-card-name">${esc(contractor.workerName)}</div>
                    <div class="team-card-meta">${totalWork} work record(s)</div>
                </div>
                <button class="btn btn-danger btn-sm"
                        onclick="event.stopPropagation(); deleteEPContractorAll('${esc(contractor.workerName)}')"
                        title="Delete all records for this contractor">
                    <i class="ph ph-trash"></i>
                </button>
            </div>

            <div class="team-card-stats">
                <div class="tcs">
                    <span class="tcs-label">Records</span>
                    <span class="tcs-val">${totalWork}</span>
                </div>
                <div class="tcs">
                    <span class="tcs-label">Work Types</span>
                    <span class="tcs-val">${uniqueDescs.length}</span>
                </div>
                <div class="tcs">
                    <span class="tcs-label">Total Paid</span>
                    <span class="tcs-val">${fmt(totalCost)}</span>
                </div>
            </div>

            <div class="team-card-members">
                <div class="team-members-label">
                    <i class="ph ph-wrench"></i> Work Types
                    <span class="team-members-count">${uniqueDescs.length}</span>
                </div>
                ${descPills}
            </div>

            <div class="team-card-footer">
                <span class="team-card-hint"><i class="ph ph-arrow-right"></i> Click to view &amp; add records</span>
            </div>
        </div>`;
}

// ── Prompt helpers ───────────────────────────────────────────
function showEPAddContractorPrompt() {
    const el = document.getElementById('epNewContractorName');
    if (el) el.value = '';
    showModal('epContractorPromptModal');
}

function openEPContractorFromPrompt() {
    const name = (document.getElementById('epNewContractorName').value || '').trim();
    if (!name) { showToast('Enter contractor name', 'warning'); return; }
    hideModal('epContractorPromptModal');
    openEPContractorDetail(name);
}

// ── Contractor Detail Page ───────────────────────────────────
async function openEPContractorDetail(workerName) {
    window._epDetailWorkerName = workerName;

    const viewContainer = document.getElementById('view-container');
    const subBody       = document.getElementById('labour-sub-body');
    const target        = subBody || viewContainer;
    if (!target) return;

    target.innerHTML = '<div class="labour-loading" style="padding:3rem;"><div class="labour-spin"></div><span>Loading contractor…</span></div>';

    const projId     = AppState.currentProject._id;
    const res        = await window.api.labour.ep.getAll(projId);
    const allEntries = res.success ? res.data : [];
    const entries    = allEntries.filter(e =>
        String(e.workerName || '').toLowerCase().trim() === String(workerName).toLowerCase().trim()
    );

    const html = `<div class="labour-page animate-fade-in">
        <div id="labour-sub-body" class="labour-sub-body">
            ${epDetailPage(workerName, entries)}
        </div>
    </div>`;

    if (viewContainer) {
        viewContainer.innerHTML = html;
    } else {
        target.innerHTML = epDetailPage(workerName, entries);
    }

    setTimeout(() => {
        document.querySelectorAll('.nav-tree-child').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector('.nav-tree-child[data-labour-sub="ep"]');
        if (btn) btn.classList.add('active');
        const toggle = document.getElementById('labour-tree-toggle');
        if (toggle) toggle.classList.add('open', 'active');
        const children = document.getElementById('labour-tree-children');
        if (children) children.classList.add('open');
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    }, 0);
}

function epDetailPage(workerName, entries) {
    const totalCost = entries.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const totalWork = entries.length;

    // Unique work descriptions for member pills
    const seen = new Set(); const uniqueDescs = [];
    entries.forEach(e => {
        const key = String(e.description || '').toLowerCase().trim();
        if (key && !seen.has(key)) { seen.add(key); uniqueDescs.push(String(e.description).trim()); }
    });

    const tableRows = entries.length === 0
        ? `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted);">
               No records yet. Click <strong>Add Work</strong> to start.
           </td></tr>`
        : [...entries].sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => `
            <tr>
                <td>${fmtDate(e.date)}</td>
                <td>${esc(e.description)}</td>
                <td style="font-family:var(--font-mono,monospace);">${fmt(e.amount)}</td>
                <td style="color:var(--text-muted);font-size:.8rem;">${esc(e.notes || '—')}</td>
                <td>
                    <button class="btn btn-sm btn-danger"
                            onclick="deleteEPEntryFromDetail('${e._id}')"
                            title="Delete record">
                        <i class="ph ph-trash"></i>
                    </button>
                </td>
            </tr>`).join('');

    return `
        <div class="detail-page-header">
            <button class="btn btn-outline btn-sm" onclick="backToEPList()">
                <i class="ph ph-arrow-left"></i> All Contractors
            </button>
            <div class="detail-page-title">
                <div class="team-card-avatar" style="width:36px;height:36px;font-size:1rem;background:rgba(245,158,11,.15);color:#f59e0b;">
                    <i class="ph ph-lightning"></i>
                </div>
                <div>
                    <h3 style="margin:0;font-size:1rem;font-weight:700;color:var(--text-primary);">${esc(workerName)}</h3>
                    <span class="team-card-meta">Elec &amp; Plumbing Contractor</span>
                </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="showEPEntryModalFromDetail()">
                <i class="ph ph-plus"></i> Add Work
            </button>
        </div>

        <div class="detail-stats-strip">
            <div class="detail-stat"><span class="tcs-label">Total Records</span><span class="tcs-val">${totalWork}</span></div>
            <div class="detail-stat"><span class="tcs-label">Work Types</span><span class="tcs-val">${uniqueDescs.length}</span></div>
            <div class="detail-stat"><span class="tcs-label">Total Paid</span>
                <span class="tcs-val" style="color:var(--success,#10b981);">${fmt(totalCost)}</span>
            </div>
        </div>

        ${uniqueDescs.length > 0 ? `
        <div class="detail-members-section">
            <div class="team-members-label" style="margin-bottom:.6rem;">
                <i class="ph ph-wrench"></i> Work Categories
            </div>
            <div class="team-member-pills">
                ${uniqueDescs.map(d => `<span class="team-member-pill" style="background:rgba(245,158,11,.1);color:#f59e0b;border-color:rgba(245,158,11,.2);">${esc(d)}</span>`).join('')}
            </div>
        </div>` : ''}

        <div class="detail-table-section">
            <div class="detail-table-header">
                <span style="font-size:.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;">
                    All Records <span style="font-weight:400;margin-left:.4rem;">(${totalWork})</span>
                </span>
            </div>
            <div class="entry-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th><th>Description</th><th>Amount</th>
                            <th>Notes</th><th style="width:48px;"></th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        </div>

        <!-- Add Work Modal — lives inside detail page -->
        <div id="epModal" class="modal">
            <div class="modal-content" style="max-width:480px;">
                <div class="modal-header">
                    <h3 class="modal-title">
                        <i class="ph ph-lightning"></i> Add Work —
                        <span style="color:var(--brand,#f59e0b);">${esc(workerName)}</span>
                    </h3>
                    <button class="modal-close" onclick="hideModal('epModal')"><i class="ph ph-x"></i></button>
                </div>
                <input type="hidden" id="epWorkerName" value="${esc(workerName)}" />
                <div class="form-group">
                    <label class="form-label">Date</label>
                    <input type="date" id="epDate" class="form-input" value="${todayDate()}" />
                </div>
                <div class="form-group">
                    <label class="form-label">Work Description</label>
                    <input type="text" id="epDesc" class="form-input"
                           placeholder="e.g. 1st floor wiring, bathroom plumbing" />
                </div>
                <div class="form-group">
                    <label class="form-label">Payment Amount (₹)</label>
                    <input type="number" id="epAmount" class="form-input" step="0.01" min="0" />
                </div>
                <div class="form-group">
                    <label class="form-label">Notes (optional)</label>
                    <input type="text" id="epNotes" class="form-input" placeholder="Any remarks" />
                </div>
                <div class="flex gap">
                    <button class="btn btn-outline" onclick="hideModal('epModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="saveEPEntryFromDetail()">
                        <i class="ph ph-check"></i> Save Record
                    </button>
                </div>
            </div>
        </div>`;
}

// ── Navigation helpers ───────────────────────────────────────
function backToEPList() {
    window._epDetailWorkerName = null;
    refreshLabourSub();
}

function showEPEntryModalFromDetail() {
    const dateEl = document.getElementById('epDate');
    const descEl = document.getElementById('epDesc');
    const amtEl  = document.getElementById('epAmount');
    const ntEl   = document.getElementById('epNotes');
    if (dateEl) dateEl.value = todayDate();
    if (descEl) descEl.value = '';
    if (amtEl)  amtEl.value  = '';
    if (ntEl)   ntEl.value   = '';
    showModal('epModal');
}

async function saveEPEntryFromDetail() {
    const workerName = document.getElementById('epWorkerName').value;
    const date       = document.getElementById('epDate').value;
    const desc       = document.getElementById('epDesc').value.trim();
    const amount     = parseFloat(document.getElementById('epAmount').value) || 0;
    const notes      = document.getElementById('epNotes').value.trim();

    if (!date)  { showToast('Select a date', 'warning'); return; }
    if (!desc)  { showToast('Enter work description', 'warning'); return; }

    showLoading();
    const res = await window.api.labour.ep.add({
        projectId: AppState.currentProject._id,
        date, workerName, description: desc, amount, notes
    });
    hideLoading();

    if (res.success) {
        hideModal('epModal');
        showToast('Record saved', 'success');
        await openEPContractorDetail(workerName);
    } else {
        showToast('Failed: ' + res.message, 'danger');
    }
}

async function deleteEPEntryFromDetail(entryId) {
    if (!confirm('Delete this record?')) return;
    const workerName = window._epDetailWorkerName || '';
    showLoading();
    await window.api.labour.ep.delete(entryId);
    hideLoading();
    showToast('Record deleted', 'success');
    await openEPContractorDetail(workerName);
}

async function deleteEPContractorAll(workerName) {
    if (!confirm(`Delete ALL records for "${workerName}"? This cannot be undone.`)) return;
    const projId     = AppState.currentProject._id;
    showLoading();
    const res        = await window.api.labour.ep.getAll(projId);
    const toDelete   = res.success ? res.data.filter(e =>
        String(e.workerName || '').toLowerCase().trim() === String(workerName).toLowerCase().trim()
    ) : [];
    for (const e of toDelete) await window.api.labour.ep.delete(e._id);
    hideLoading();
    showToast(`${workerName} deleted`, 'success');
    await refreshLabourSub();
}

// Legacy stubs
function showEPModal() { showEPAddContractorPrompt(); }
async function saveEPEntry() { await saveEPEntryFromDetail(); }
async function deleteEPEntry(id) { await deleteEPEntryFromDetail(id); }

// ════════════════════════════════════════════════════════════
// 5 — TILES
// ════════════════════════════════════════════════════════════
// No separate team collection — entries grouped by masonName
// to produce virtual mason cards, identical UI to masonry.
// ════════════════════════════════════════════════════════════

// ── Helper: group Tiles entries by masonName ─────────────────
function groupTilesByMason(entries) {
    const map = new Map();
    for (const e of entries) {
        const raw = String(e.masonName || '').trim();
        const key = raw.toLowerCase();
        if (!key) continue;
        if (!map.has(key)) {
            map.set(key, {
                masonName: raw.replace(/\b\w/g, c => c.toUpperCase()),
                entries: []
            });
        }
        map.get(key).entries.push(e);
    }
    return [...map.values()].sort((a, b) => a.masonName.localeCompare(b.masonName));
}

// ── Mason list view ──────────────────────────────────────────
async function loadTilesView(projectId) {
    const res        = await window.api.labour.tiles.getAll(projectId);
    const allEntries = res.success ? res.data : [];
    const masons     = groupTilesByMason(allEntries);
    const grandCost  = allEntries.reduce((s, e) => s + parseFloat(e.wageAmount    || 0), 0);
    const grandSqft  = allEntries.reduce((s, e) => s + parseFloat(e.sqftCompleted || 0), 0);

    let html = `
        <div class="lsub-header">
            <div>
                <h3 class="lsub-title"><i class="ph ph-grid-four"></i> Tiles Work</h3>
                <p class="lsub-desc">Click a mason card to view records and add new entries</p>
            </div>
            <div class="flex gap-sm">
                ${allEntries.length > 0 ? `
                    <div class="lsub-stat-chip"><i class="ph ph-ruler"></i> ${grandSqft.toFixed(1)} sq.ft</div>
                    <div class="lsub-stat-chip"><i class="ph ph-currency-inr"></i> Total: ${fmt(grandCost)}</div>` : ''}
                <button class="btn btn-primary btn-sm" onclick="showTilesAddMasonPrompt()">
                    <i class="ph ph-plus"></i> Add Entry
                </button>
            </div>
        </div>`;

    if (masons.length === 0) {
        html += emptyState('ph-grid-four', 'No Tiles Records', 'Add your first tiles work entry.', 'showTilesAddMasonPrompt()', 'Add Entry');
    } else {
        html += '<div class="team-grid">' + masons.map(m => tilesMasonCard(m)).join('') + '</div>';
    }

    // Mason prompt modal
    html += `
    <div id="tilesMasonPromptModal" class="modal">
        <div class="modal-content" style="max-width:420px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="ph ph-grid-four"></i> Add Tiles Entry</h3>
                <button class="modal-close" onclick="hideModal('tilesMasonPromptModal')"><i class="ph ph-x"></i></button>
            </div>
            <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:1rem;">
                Enter the mason name to open their record sheet.
            </p>
            <div class="form-group">
                <label class="form-label">Mason Name</label>
                <input type="text" id="tilesNewMasonName" class="form-input"
                       placeholder="e.g. Suresh Mason" />
            </div>
            <div class="flex gap">
                <button class="btn btn-outline" onclick="hideModal('tilesMasonPromptModal')">Cancel</button>
                <button class="btn btn-primary" onclick="openTilesMasonFromPrompt()">
                    <i class="ph ph-arrow-right"></i> Open Sheet
                </button>
            </div>
        </div>
    </div>`;

    return labourShell('tiles', html);
}

// ── Mason card — clickable, no Add/View buttons ──────────────
function tilesMasonCard(mason) {
    const entries     = mason.entries || [];
    const totalCost   = entries.reduce((s, e) => s + parseFloat(e.wageAmount    || 0), 0);
    const totalSqft   = entries.reduce((s, e) => s + parseFloat(e.sqftCompleted || 0), 0);

    // Unique helper names as member pills
    const seenH = new Set(); const uniqueHelpers = [];
    entries.forEach(e => {
        const key = String(e.helperName || '').toLowerCase().trim();
        if (key && !seenH.has(key)) { seenH.add(key); uniqueHelpers.push(String(e.helperName).replace(/\b\w/g, c => c.toUpperCase())); }
    });

    const helperPills = uniqueHelpers.length > 0
        ? `<div class="team-member-pills">
            ${uniqueHelpers.map(h => `<span class="team-member-pill" style="background:rgba(16,185,129,.1);color:#10b981;border-color:rgba(16,185,129,.2);">${esc(h)}</span>`).join('')}
           </div>`
        : `<p class="team-no-members">No helpers recorded yet</p>`;

    return `
        <div class="team-card team-card-clickable"
             onclick="openTilesMasonDetail('${esc(mason.masonName)}')">
            <div class="team-card-head">
                <div class="team-card-avatar" style="background:rgba(16,185,129,.15);color:#10b981;">
                    <i class="ph ph-grid-four"></i>
                </div>
                <div style="flex:1;min-width:0;">
                    <div class="team-card-name">${esc(mason.masonName)}</div>
                    <div class="team-card-meta">${entries.length} record(s) · ${totalSqft.toFixed(1)} sq.ft</div>
                </div>
                <button class="btn btn-danger btn-sm"
                        onclick="event.stopPropagation(); deleteTilesMasonAll('${esc(mason.masonName)}')"
                        title="Delete all records for this mason">
                    <i class="ph ph-trash"></i>
                </button>
            </div>

            <div class="team-card-stats">
                <div class="tcs">
                    <span class="tcs-label">Records</span>
                    <span class="tcs-val">${entries.length}</span>
                </div>
                <div class="tcs">
                    <span class="tcs-label">Sq.ft Done</span>
                    <span class="tcs-val">${totalSqft.toFixed(1)}</span>
                </div>
                <div class="tcs">
                    <span class="tcs-label">Total Wage</span>
                    <span class="tcs-val">${fmt(totalCost)}</span>
                </div>
            </div>

            <div class="team-card-members">
                <div class="team-members-label">
                    <i class="ph ph-users"></i> Helpers
                    <span class="team-members-count">${uniqueHelpers.length}</span>
                </div>
                ${helperPills}
            </div>

            <div class="team-card-footer">
                <span class="team-card-hint"><i class="ph ph-arrow-right"></i> Click to view &amp; add records</span>
            </div>
        </div>`;
}

// ── Prompt helpers ───────────────────────────────────────────
function showTilesAddMasonPrompt() {
    const el = document.getElementById('tilesNewMasonName');
    if (el) el.value = '';
    showModal('tilesMasonPromptModal');
}

function openTilesMasonFromPrompt() {
    const name = (document.getElementById('tilesNewMasonName').value || '').trim();
    if (!name) { showToast('Enter mason name', 'warning'); return; }
    hideModal('tilesMasonPromptModal');
    openTilesMasonDetail(name);
}

// ── Mason Detail Page ────────────────────────────────────────
async function openTilesMasonDetail(masonName) {
    window._tilesDetailMasonName = masonName;

    const viewContainer = document.getElementById('view-container');
    const subBody       = document.getElementById('labour-sub-body');
    const target        = subBody || viewContainer;
    if (!target) return;

    target.innerHTML = '<div class="labour-loading" style="padding:3rem;"><div class="labour-spin"></div><span>Loading mason…</span></div>';

    const projId     = AppState.currentProject._id;
    const res        = await window.api.labour.tiles.getAll(projId);
    const allEntries = res.success ? res.data : [];
    const entries    = allEntries.filter(e =>
        String(e.masonName || '').toLowerCase().trim() === String(masonName).toLowerCase().trim()
    );

    const html = `<div class="labour-page animate-fade-in">
        <div id="labour-sub-body" class="labour-sub-body">
            ${tilesDetailPage(masonName, entries)}
        </div>
    </div>`;

    if (viewContainer) {
        viewContainer.innerHTML = html;
    } else {
        target.innerHTML = tilesDetailPage(masonName, entries);
    }

    setTimeout(() => {
        document.querySelectorAll('.nav-tree-child').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector('.nav-tree-child[data-labour-sub="tiles"]');
        if (btn) btn.classList.add('active');
        const toggle = document.getElementById('labour-tree-toggle');
        if (toggle) toggle.classList.add('open', 'active');
        const children = document.getElementById('labour-tree-children');
        if (children) children.classList.add('open');
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    }, 0);
}

function tilesDetailPage(masonName, entries) {
    const totalCost   = entries.reduce((s, e) => s + parseFloat(e.wageAmount    || 0), 0);
    const totalSqft   = entries.reduce((s, e) => s + parseFloat(e.sqftCompleted || 0), 0);

    // Unique helpers for member pills
    const seenH = new Set(); const uniqueHelpers = [];
    entries.forEach(e => {
        const key = String(e.helperName || '').toLowerCase().trim();
        if (key && !seenH.has(key)) { seenH.add(key); uniqueHelpers.push(String(e.helperName).replace(/\b\w/g, c => c.toUpperCase())); }
    });

    const tableRows = entries.length === 0
        ? `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">
               No records yet. Click <strong>Add Entry</strong> to start.
           </td></tr>`
        : [...entries].sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => `
            <tr>
                <td>${fmtDate(e.date)}</td>
                <td>${esc(e.helperName || '—')}</td>
                <td style="font-family:var(--font-mono,monospace);">${e.sqftCompleted || 0}</td>
                <td><span class="role-badge" style="background:rgba(16,185,129,.15);color:#10b981;">${esc(e.paymentType)}</span></td>
                <td style="font-family:var(--font-mono,monospace);">${fmt(e.wageAmount)}</td>
                <td style="color:var(--text-muted);font-size:.8rem;">${esc(e.notes || '—')}</td>
                <td>
                    <button class="btn btn-sm btn-danger"
                            onclick="deleteTilesEntryFromDetail('${e._id}')"
                            title="Delete record">
                        <i class="ph ph-trash"></i>
                    </button>
                </td>
            </tr>`).join('');

    return `
        <div class="detail-page-header">
            <button class="btn btn-outline btn-sm" onclick="backToTilesList()">
                <i class="ph ph-arrow-left"></i> All Masons
            </button>
            <div class="detail-page-title">
                <div class="team-card-avatar" style="width:36px;height:36px;font-size:1rem;background:rgba(16,185,129,.15);color:#10b981;">
                    <i class="ph ph-grid-four"></i>
                </div>
                <div>
                    <h3 style="margin:0;font-size:1rem;font-weight:700;color:var(--text-primary);">${esc(masonName)}</h3>
                    <span class="team-card-meta">Tiles Mason</span>
                </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="showTilesEntryModalFromDetail()">
                <i class="ph ph-plus"></i> Add Entry
            </button>
        </div>

        <div class="detail-stats-strip">
            <div class="detail-stat"><span class="tcs-label">Total Records</span><span class="tcs-val">${entries.length}</span></div>
            <div class="detail-stat"><span class="tcs-label">Sq.ft Done</span><span class="tcs-val">${totalSqft.toFixed(1)}</span></div>
            <div class="detail-stat"><span class="tcs-label">Unique Helpers</span><span class="tcs-val">${uniqueHelpers.length}</span></div>
            <div class="detail-stat"><span class="tcs-label">Total Wage</span>
                <span class="tcs-val" style="color:var(--success,#10b981);">${fmt(totalCost)}</span>
            </div>
        </div>

        ${uniqueHelpers.length > 0 ? `
        <div class="detail-members-section">
            <div class="team-members-label" style="margin-bottom:.6rem;">
                <i class="ph ph-users"></i> Helpers Worked With
            </div>
            <div class="team-member-pills">
                ${uniqueHelpers.map(h => `<span class="team-member-pill" style="background:rgba(16,185,129,.1);color:#10b981;border-color:rgba(16,185,129,.2);">${esc(h)}</span>`).join('')}
            </div>
        </div>` : ''}

        <div class="detail-table-section">
            <div class="detail-table-header">
                <span style="font-size:.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;">
                    All Entries <span style="font-weight:400;margin-left:.4rem;">(${entries.length})</span>
                </span>
            </div>
            <div class="entry-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th><th>Helper</th><th>Sq.ft</th>
                            <th>Type</th><th>Wage</th><th>Notes</th>
                            <th style="width:48px;"></th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        </div>

        <!-- Add Entry Modal — lives inside detail page -->
        <div id="tilesModal" class="modal">
            <div class="modal-content" style="max-width:500px;">
                <div class="modal-header">
                    <h3 class="modal-title">
                        <i class="ph ph-grid-four"></i> Add Entry —
                        <span style="color:var(--brand,#f59e0b);">${esc(masonName)}</span>
                    </h3>
                    <button class="modal-close" onclick="hideModal('tilesModal')"><i class="ph ph-x"></i></button>
                </div>
                <input type="hidden" id="tilesMasonName" value="${esc(masonName)}" />
                <div class="grid grid-2 gap">
                    <div class="form-group">
                        <label class="form-label">Date</label>
                        <input type="date" id="tilesDate" class="form-input" value="${todayDate()}" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Payment Type</label>
                        <select id="tilesPayType" class="form-select">
                            <option value="Sq.ft">Sq.ft</option>
                            <option value="Daily Wage">Daily Wage</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Helper Name (optional)</label>
                    <input type="text" id="tilesHelper" class="form-input" placeholder="Helper name" />
                </div>
                <div class="grid grid-2 gap">
                    <div class="form-group">
                        <label class="form-label">Sq.ft Completed</label>
                        <input type="number" id="tilesSqft" class="form-input" step="0.01" min="0" value="0" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Wage Amount (₹)</label>
                        <input type="number" id="tilesWage" class="form-input" step="0.01" min="0" />
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Notes (optional)</label>
                    <input type="text" id="tilesNotes" class="form-input" placeholder="Any remarks" />
                </div>
                <div class="flex gap">
                    <button class="btn btn-outline" onclick="hideModal('tilesModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="saveTilesEntryFromDetail()">
                        <i class="ph ph-check"></i> Save Entry
                    </button>
                </div>
            </div>
        </div>`;
}

// ── Navigation helpers ───────────────────────────────────────
function backToTilesList() {
    window._tilesDetailMasonName = null;
    refreshLabourSub();
}

function showTilesEntryModalFromDetail() {
    const dateEl = document.getElementById('tilesDate');
    const helpEl = document.getElementById('tilesHelper');
    const sqftEl = document.getElementById('tilesSqft');
    const wgEl   = document.getElementById('tilesWage');
    const ntEl   = document.getElementById('tilesNotes');
    if (dateEl) dateEl.value = todayDate();
    if (helpEl) helpEl.value = '';
    if (sqftEl) sqftEl.value = '0';
    if (wgEl)   wgEl.value   = '';
    if (ntEl)   ntEl.value   = '';
    showModal('tilesModal');
}

async function saveTilesEntryFromDetail() {
    const masonName = document.getElementById('tilesMasonName').value;
    const date      = document.getElementById('tilesDate').value;
    const helper    = document.getElementById('tilesHelper').value.trim();
    const sqft      = parseFloat(document.getElementById('tilesSqft').value) || 0;
    const wage      = parseFloat(document.getElementById('tilesWage').value)  || 0;
    const payType   = document.getElementById('tilesPayType').value;
    const notes     = document.getElementById('tilesNotes').value.trim();

    if (!date)  { showToast('Select a date', 'warning'); return; }

    showLoading();
    const res = await window.api.labour.tiles.add({
        projectId: AppState.currentProject._id,
        date, masonName, helperName: helper,
        sqftCompleted: sqft, wageAmount: wage,
        paymentType: payType, notes
    });
    hideLoading();

    if (res.success) {
        hideModal('tilesModal');
        showToast('Entry saved', 'success');
        await openTilesMasonDetail(masonName);
    } else {
        showToast('Failed: ' + res.message, 'danger');
    }
}

async function deleteTilesEntryFromDetail(entryId) {
    if (!confirm('Delete this entry?')) return;
    const masonName = window._tilesDetailMasonName || '';
    showLoading();
    await window.api.labour.tiles.delete(entryId);
    hideLoading();
    showToast('Entry deleted', 'success');
    await openTilesMasonDetail(masonName);
}

async function deleteTilesMasonAll(masonName) {
    if (!confirm(`Delete ALL records for "${masonName}"? This cannot be undone.`)) return;
    const projId   = AppState.currentProject._id;
    showLoading();
    const res      = await window.api.labour.tiles.getAll(projId);
    const toDelete = res.success ? res.data.filter(e =>
        String(e.masonName || '').toLowerCase().trim() === String(masonName).toLowerCase().trim()
    ) : [];
    for (const e of toDelete) await window.api.labour.tiles.delete(e._id);
    hideLoading();
    showToast(`${masonName} deleted`, 'success');
    await refreshLabourSub();
}

// Legacy stubs
function showTilesModal() { showTilesAddMasonPrompt(); }
async function saveTilesEntry() { await saveTilesEntryFromDetail(); }
async function deleteTilesEntry(id) { await deleteTilesEntryFromDetail(id); }

// ════════════════════════════════════════════════════════════
// 6 — PAINTING
// ════════════════════════════════════════════════════════════

// ── Team list view ───────────────────────────────────────────
async function loadPaintingView(projectId) {
    const teamsRes = await window.api.labour.painting.getTeams(projectId);
    const teams = teamsRes.success ? teamsRes.data : [];

    let html = `
        <div class="lsub-header">
            <div>
                <h3 class="lsub-title"><i class="ph ph-paint-brush"></i> Painting Teams</h3>
                <p class="lsub-desc">Click a team card to view entries and manage attendance</p>
            </div>
            <button class="btn btn-primary btn-sm" onclick="showPaintingTeamModal()">
                <i class="ph ph-plus"></i> New Team
            </button>
        </div>`;

    if (!teams.length) {
        html += emptyState('ph-paint-brush', 'No Painting Teams', 'Create your first painting team to start tracking attendance and wages.', 'showPaintingTeamModal()', 'New Team');
    } else {
        html += '<div class="team-grid">' + teams.map(t => paintingTeamCard(t)).join('') + '</div>';
    }
    html += paintingTeamModal();
    return labourShell('painting', html);
}

// ── Team card — clickable, no Add Entry / View buttons ───────
function paintingTeamCard(team) {
    const entries     = team.entries || [];
    const totalShifts = entries.reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);
    const totalCost   = entries.reduce((s, e) => s + parseFloat(e.wageAmount  || 0), 0);
    const uniqueNames = uniqueWorkerNames(entries);
    const workerCount = uniqueNames.length;

    const memberPills = uniqueNames.length > 0
        ? `<div class="team-member-pills">${uniqueNames.map(n => `<span class="team-member-pill" style="background:rgba(20,184,166,.1);color:#14b8a6;border-color:rgba(20,184,166,.2);">${esc(n)}</span>`).join('')}</div>`
        : `<p class="team-no-members">No members recorded yet</p>`;

    return `
        <div class="team-card team-card-clickable"
             onclick="openPaintingTeamDetail('${team._id}','${esc(team.teamName)}','${esc(team.paymentType||'daily')}')">
            <div class="team-card-head">
                <div class="team-card-avatar" style="background:rgba(20,184,166,.15);color:#14b8a6;">
                    <i class="ph ph-paint-brush"></i>
                </div>
                <div style="flex:1;min-width:0;">
                    <div class="team-card-name">${esc(team.teamName)}</div>
                    <div class="team-card-meta">${esc(team.paymentType === 'sqft' ? 'Per Sq.ft' : 'Daily Wage')}</div>
                </div>
                <button class="btn btn-danger btn-sm"
                        onclick="event.stopPropagation(); deletePaintingTeam('${team._id}','${esc(team.teamName)}')"
                        title="Delete team">
                    <i class="ph ph-trash"></i>
                </button>
            </div>
            <div class="team-card-stats">
                <div class="tcs"><span class="tcs-label">Workers</span><span class="tcs-val">${workerCount}</span></div>
                <div class="tcs"><span class="tcs-label">Shifts</span><span class="tcs-val">${totalShifts}</span></div>
                <div class="tcs"><span class="tcs-label">Total Cost</span><span class="tcs-val">${fmt(totalCost)}</span></div>
            </div>
            <div class="team-card-members">
                <div class="team-members-label">
                    <i class="ph ph-users"></i> Members
                    <span class="team-members-count">${workerCount}</span>
                </div>
                ${memberPills}
            </div>
            <div class="team-card-footer">
                <span class="team-card-hint"><i class="ph ph-arrow-right"></i> Click to view &amp; manage entries</span>
            </div>
        </div>`;
}

// ── Create Team Modal ────────────────────────────────────────
function paintingTeamModal() {
    return `
    <div id="paintingTeamModal" class="modal">
        <div class="modal-content" style="max-width:420px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="ph ph-paint-brush"></i> New Painting Team</h3>
                <button class="modal-close" onclick="hideModal('paintingTeamModal')"><i class="ph ph-x"></i></button>
            </div>
            <div class="form-group">
                <label class="form-label">Team Name</label>
                <input type="text" id="paintingTeamName" class="form-input" placeholder="e.g. Painter Team A" />
            </div>
            <div class="form-group">
                <label class="form-label">Payment Type</label>
                <select id="paintingPayType" class="form-select">
                    <option value="sqft">Sq.ft</option>
                    <option value="daily">Daily Wage</option>
                </select>
            </div>
            <div class="flex gap">
                <button class="btn btn-outline" onclick="hideModal('paintingTeamModal')">Cancel</button>
                <button class="btn btn-primary" onclick="savePaintingTeam()"><i class="ph ph-check"></i> Create</button>
            </div>
        </div>
    </div>`;
}

// ── Team Detail Page ─────────────────────────────────────────
async function openPaintingTeamDetail(teamId, teamName, paymentType) {
    window._paintingDetailTeamId   = teamId;
    window._paintingDetailTeamName = teamName;
    window._paintingDetailPayType  = paymentType;

    const viewContainer = document.getElementById('view-container');
    const subBody       = document.getElementById('labour-sub-body');
    const target        = subBody || viewContainer;
    if (!target) return;

    target.innerHTML = '<div class="labour-loading" style="padding:3rem;"><div class="labour-spin"></div><span>Loading team…</span></div>';

    const res     = await window.api.labour.painting.getEntries(teamId);
    const entries = res.success ? res.data : [];

    const html = `<div class="labour-page animate-fade-in">
        <div id="labour-sub-body" class="labour-sub-body">
            ${paintingDetailPage(teamId, teamName, paymentType, entries)}
        </div>
    </div>`;

    if (viewContainer) {
        viewContainer.innerHTML = html;
    } else {
        target.innerHTML = paintingDetailPage(teamId, teamName, paymentType, entries);
    }

    setTimeout(() => {
        document.querySelectorAll('.nav-tree-child').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector('.nav-tree-child[data-labour-sub="painting"]');
        if (btn) btn.classList.add('active');
        const toggle = document.getElementById('labour-tree-toggle');
        if (toggle) toggle.classList.add('open', 'active');
        const children = document.getElementById('labour-tree-children');
        if (children) children.classList.add('open');
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    }, 0);
}

function paintingDetailPage(teamId, teamName, paymentType, entries) {
    const totalShifts = entries.reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);
    const totalCost   = entries.reduce((s, e) => s + parseFloat(e.wageAmount  || 0), 0);
    const totalSqft   = entries.reduce((s, e) => s + parseFloat(e.sqftCompleted || 0), 0);
    const uniqueNames = uniqueWorkerNames(entries);

    const tableRows = entries.length === 0
        ? `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">
               No entries yet. Click <strong>Add Entry</strong> to record attendance.
           </td></tr>`
        : [...entries].sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => `
            <tr>
                <td>${fmtDate(e.date)}</td>
                <td><strong>${esc(e.workerName)}</strong></td>
                <td><strong style="font-family:var(--font-mono,monospace);">${e.shiftCount}</strong></td>
                <td style="font-family:var(--font-mono,monospace);">${e.sqftCompleted || 0}</td>
                <td style="font-family:var(--font-mono,monospace);">${fmt(e.wageAmount)}</td>
                <td>
                    <button class="btn btn-sm btn-danger"
                            onclick="deletePaintingEntryFromDetail('${e._id}')"
                            title="Delete entry">
                        <i class="ph ph-trash"></i>
                    </button>
                </td>
            </tr>`).join('');

    return `
        <div class="detail-page-header">
            <button class="btn btn-outline btn-sm" onclick="backToPaintingList()">
                <i class="ph ph-arrow-left"></i> All Teams
            </button>
            <div class="detail-page-title">
                <div class="team-card-avatar" style="width:36px;height:36px;font-size:1rem;background:rgba(20,184,166,.15);color:#14b8a6;">
                    <i class="ph ph-paint-brush"></i>
                </div>
                <div>
                    <h3 style="margin:0;font-size:1rem;font-weight:700;color:var(--text-primary);">${esc(teamName)}</h3>
                    <span class="team-card-meta">${paymentType === 'sqft' ? 'Per Sq.ft' : 'Daily Wage'}</span>
                </div>
            </div>
            <button class="btn btn-primary btn-sm"
                    onclick="showPaintingEntryModalFromDetail('${teamId}','${esc(teamName)}')">
                <i class="ph ph-plus"></i> Add Entry
            </button>
        </div>

        <div class="detail-stats-strip">
            <div class="detail-stat"><span class="tcs-label">Total Entries</span><span class="tcs-val">${entries.length}</span></div>
            <div class="detail-stat"><span class="tcs-label">Total Shifts</span><span class="tcs-val">${totalShifts}</span></div>
            <div class="detail-stat"><span class="tcs-label">Sq.ft Done</span><span class="tcs-val">${totalSqft.toFixed(1)}</span></div>
            <div class="detail-stat"><span class="tcs-label">Total Cost</span><span class="tcs-val" style="color:var(--success,#10b981);">${fmt(totalCost)}</span></div>
            <div class="detail-stat"><span class="tcs-label">Unique Workers</span><span class="tcs-val">${uniqueNames.length}</span></div>
        </div>

        ${uniqueNames.length > 0 ? `
        <div class="detail-members-section">
            <div class="team-members-label" style="margin-bottom:.6rem;">
                <i class="ph ph-identification-badge"></i> Team Members
            </div>
            <div class="team-member-pills">
                ${uniqueNames.map(n => `<span class="team-member-pill" style="background:rgba(20,184,166,.1);color:#14b8a6;border-color:rgba(20,184,166,.2);">${esc(n)}</span>`).join('')}
            </div>
        </div>` : ''}

        <div class="detail-table-section">
            <div class="detail-table-header">
                <span style="font-size:.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;">
                    All Entries <span style="font-weight:400;margin-left:.4rem;">(${entries.length})</span>
                </span>
            </div>
            <div class="entry-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th><th>Worker Name</th><th>Shifts</th>
                            <th>Sq.ft</th><th>Wage</th><th style="width:48px;"></th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        </div>

        <!-- Add Entry Modal -->
        <div id="paintingEntryModal" class="modal">
            <div class="modal-content" style="max-width:480px;">
                <div class="modal-header">
                    <h3 class="modal-title">
                        <i class="ph ph-plus-circle"></i> Add Entry —
                        <span style="color:var(--brand,#f59e0b);">${esc(teamName)}</span>
                    </h3>
                    <button class="modal-close" onclick="hideModal('paintingEntryModal')"><i class="ph ph-x"></i></button>
                </div>
                <input type="hidden" id="paintingEntryTeamId" value="${teamId}" />
                <div class="grid grid-2 gap">
                    <div class="form-group">
                        <label class="form-label">Date</label>
                        <input type="date" id="paintingEntryDate" class="form-input" value="${todayDate()}" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Worker Name</label>
                        <input type="text" id="paintingEntryWorker" class="form-input" placeholder="Worker name" />
                    </div>
                </div>
                <div class="grid grid-2 gap">
                    <div class="form-group">
                        <label class="form-label">Shift Count <span class="lbadge">attendance</span></label>
                        <input type="number" id="paintingEntryShift" class="form-input" step="0.5" min="0.5" value="1" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Wage Amount (₹)</label>
                        <input type="number" id="paintingEntryWage" class="form-input" step="0.01" min="0" />
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Sq.ft (if applicable)</label>
                    <input type="number" id="paintingEntrySqft" class="form-input" step="0.01" min="0" value="0" />
                </div>
                <div class="flex gap">
                    <button class="btn btn-outline" onclick="hideModal('paintingEntryModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="savePaintingEntryFromDetail()">
                        <i class="ph ph-check"></i> Save Entry
                    </button>
                </div>
            </div>
        </div>`;
}

// ── Navigation helpers ───────────────────────────────────────
function backToPaintingList() {
    window._paintingDetailTeamId   = null;
    window._paintingDetailTeamName = null;
    window._paintingDetailPayType  = null;
    refreshLabourSub();
}

function showPaintingEntryModalFromDetail(teamId, teamName) {
    const dateEl = document.getElementById('paintingEntryDate');
    const wkrEl  = document.getElementById('paintingEntryWorker');
    const shEl   = document.getElementById('paintingEntryShift');
    const wgEl   = document.getElementById('paintingEntryWage');
    const sqEl   = document.getElementById('paintingEntrySqft');
    if (dateEl) dateEl.value = todayDate();
    if (wkrEl)  wkrEl.value  = '';
    if (shEl)   shEl.value   = '1';
    if (wgEl)   wgEl.value   = '';
    if (sqEl)   sqEl.value   = '0';
    showModal('paintingEntryModal');
}

async function savePaintingEntryFromDetail() {
    const teamId = document.getElementById('paintingEntryTeamId').value;
    const date   = document.getElementById('paintingEntryDate').value;
    const worker = document.getElementById('paintingEntryWorker').value.trim();
    const shift  = parseFloat(document.getElementById('paintingEntryShift').value);
    const wage   = parseFloat(document.getElementById('paintingEntryWage').value) || 0;
    const sqft   = parseFloat(document.getElementById('paintingEntrySqft').value) || 0;

    if (!date || !worker) { showToast('Fill date and worker name', 'warning'); return; }
    if (isNaN(shift) || shift <= 0) { showToast('Enter valid shift count', 'warning'); return; }

    showLoading();
    const res = await window.api.labour.painting.addEntry({
        teamId, projectId: AppState.currentProject._id,
        date, workerName: worker, shiftCount: shift, wageAmount: wage, sqftCompleted: sqft
    });
    hideLoading();

    if (res.success) {
        hideModal('paintingEntryModal');
        showToast('Entry saved', 'success');
        await openPaintingTeamDetail(teamId, window._paintingDetailTeamName || '', window._paintingDetailPayType || 'daily');
    } else {
        showToast('Failed: ' + res.message, 'danger');
    }
}

async function deletePaintingEntryFromDetail(entryId) {
    if (!confirm('Delete this entry?')) return;
    const teamId      = window._paintingDetailTeamId   || '';
    const teamName    = window._paintingDetailTeamName || '';
    const paymentType = window._paintingDetailPayType  || 'daily';
    showLoading();
    await window.api.labour.painting.deleteEntry(entryId);
    hideLoading();
    showToast('Entry deleted', 'success');
    await openPaintingTeamDetail(teamId, teamName, paymentType);
}

// ── Team CRUD ────────────────────────────────────────────────
function showPaintingTeamModal() { document.getElementById('paintingTeamName').value = ''; showModal('paintingTeamModal'); }

async function savePaintingTeam() {
    const name    = document.getElementById('paintingTeamName').value.trim();
    const payType = document.getElementById('paintingPayType').value;
    if (!name) { showToast('Enter team name', 'warning'); return; }
    showLoading();
    const res = await window.api.labour.painting.createTeam({ projectId: AppState.currentProject._id, teamName: name, paymentType: payType });
    hideLoading();
    if (res.success) { hideModal('paintingTeamModal'); showToast(`${name} created`, 'success'); await refreshLabourSub(); }
    else showToast('Failed', 'danger');
}

async function deletePaintingTeam(id, name) {
    if (!confirm(`Delete "${name}" and all its entries?`)) return;
    showLoading();
    await window.api.labour.painting.deleteTeam(id);
    hideLoading();
    showToast('Deleted', 'success'); await refreshLabourSub();
}

// Legacy stubs
function showPaintingEntryModal(teamId, teamName) { showPaintingEntryModalFromDetail(teamId, teamName); }
async function savePaintingEntry() { await savePaintingEntryFromDetail(); }
async function showPaintingEntries(teamId) { await openPaintingTeamDetail(teamId, window._paintingDetailTeamName || '', window._paintingDetailPayType || 'daily'); }
async function deletePaintingEntry(entryId) { await deletePaintingEntryFromDetail(entryId); }

// ════════════════════════════════════════════════════════════
// WEEKLY REPORT
// ════════════════════════════════════════════════════════════
async function loadLabourReport(projectId) {
    // Fetch all data
    const [masonRes, centRes, concRes, epRes, tilesRes, paintRes] = await Promise.all([
        window.api.labour.masonry.getAllEntries(projectId),
        window.api.labour.centring.getAllEntries(projectId),
        window.api.labour.concrete.getAll(projectId),
        window.api.labour.ep.getAll(projectId),
        window.api.labour.tiles.getAll(projectId),
        window.api.labour.painting.getAllEntries(projectId),
    ]);

    const masonEntries   = masonRes.success   ? masonRes.data   : [];
    const centEntries    = centRes.success    ? centRes.data    : [];
    const concEntries    = concRes.success    ? concRes.data    : [];
    const epEntries      = epRes.success      ? epRes.data      : [];
    const tilesEntries   = tilesRes.success   ? tilesRes.data   : [];
    const paintEntries   = paintRes.success   ? paintRes.data   : [];

    // Group by week
    const allDated = [
        ...masonEntries.map(e => ({ ...e, _type: 'masonry' })),
        ...centEntries.map(e => ({ ...e, _type: 'centring' })),
        ...concEntries.map(e => ({ ...e, _type: 'concrete' })),
        ...epEntries.map(e => ({ ...e, _type: 'ep' })),
        ...tilesEntries.map(e => ({ ...e, _type: 'tiles' })),
        ...paintEntries.map(e => ({ ...e, _type: 'painting' })),
    ];

    if (!allDated.length) {
        return labourShell('report', `
            <div class="lsub-header"><div><h3 class="lsub-title"><i class="ph ph-chart-bar"></i> Weekly Labour Report</h3>
            <p class="lsub-desc">Aggregate weekly summary — no worker names shown</p></div></div>
            ${emptyState('ph-chart-bar', 'No Data Yet', 'Add labour entries in the other tabs to see weekly reports.')}`);
    }

    // Compute weekly buckets
    const weekMap = {};
    allDated.forEach(e => {
        const d = new Date(e.date);
        if (isNaN(d)) return;
        const mon = getMonday(d);
        const key = mon.toISOString().split('T')[0];
        if (!weekMap[key]) weekMap[key] = { mon, entries: [] };
        weekMap[key].entries.push(e);
    });

    const sortedWeeks = Object.keys(weekMap).sort();
    let html = `
        <div class="lsub-header">
            <div>
                <h3 class="lsub-title"><i class="ph ph-chart-bar"></i> Weekly Labour Report</h3>
                <p class="lsub-desc">Aggregate weekly summary — no worker names shown</p>
            </div>
            <button class="btn btn-outline btn-sm" onclick="printLabourReport()"><i class="ph ph-printer"></i> Print</button>
        </div>
        <div id="labour-report-content">`;

    sortedWeeks.forEach((weekKey, idx) => {
        const { mon, entries } = weekMap[weekKey];
        const sun = new Date(mon); sun.setDate(sun.getDate() + 6);

        // Masonry counts by role
        const mE = entries.filter(e => e._type === 'masonry');
        const masons        = mE.filter(e => e.workerRole === 'Mason').length;
        const menHelpers    = mE.filter(e => e.workerRole === 'Men Helper').length;
        const womenHelpers  = mE.filter(e => e.workerRole === 'Women Helper').length;
        const masonShifts   = mE.reduce((s,e) => s + parseFloat(e.shiftCount||0), 0);
        const masonCost     = mE.reduce((s,e) => s + parseFloat(e.wageAmount||0), 0);

        const cE = entries.filter(e => e._type === 'centring');
        const centWorkers   = [...new Set(cE.map(e => e.workerName))].length;
        const centShifts    = cE.reduce((s,e) => s + parseFloat(e.shiftCount||0), 0);
        const centCost      = cE.reduce((s,e) => s + parseFloat(e.wageAmount||0), 0);

        const ccE = entries.filter(e => e._type === 'concrete');
        const concShifts    = ccE.reduce((s,e) => s + parseFloat(e.shiftCount||0), 0);
        const concMen       = ccE.reduce((s,e) => s + parseInt(e.menCount||0), 0);
        const concWomen     = ccE.reduce((s,e) => s + parseInt(e.womenCount||0), 0);
        const concCost      = ccE.reduce((s,e) => s + parseFloat(e.amount||0), 0);

        const epE = entries.filter(e => e._type === 'ep');
        const epCost        = epE.reduce((s,e) => s + parseFloat(e.amount||0), 0);

        const tE = entries.filter(e => e._type === 'tiles');
        const tilesSqft     = tE.reduce((s,e) => s + parseFloat(e.sqftCompleted||0), 0);
        const tilesCost     = tE.reduce((s,e) => s + parseFloat(e.wageAmount||0), 0);

        const pE = entries.filter(e => e._type === 'painting');
        const paintWorkers  = [...new Set(pE.map(e => e.workerName))].length;
        const paintShifts   = pE.reduce((s,e) => s + parseFloat(e.shiftCount||0), 0);
        const paintCost     = pE.reduce((s,e) => s + parseFloat(e.wageAmount||0), 0);

        const totalCost = masonCost + centCost + concCost + epCost + tilesCost + paintCost;

        html += `
        <div class="report-week-card">
            <div class="report-week-head">
                <span class="report-week-num">Week ${idx + 1}</span>
                <span class="report-week-dates">${fmtDate(mon.toISOString())} — ${fmtDate(sun.toISOString())}</span>
                <span class="report-week-total">${fmt(totalCost)}</span>
            </div>
            <div class="report-sections">
                ${mE.length ? `<div class="report-section">
                    <div class="rs-head"><i class="ph ph-wall"></i> Masonry</div>
                    <div class="rs-grid">
                        <div class="rs-item"><span>Masons</span><strong>${masons}</strong></div>
                        <div class="rs-item"><span>Men Helpers</span><strong>${menHelpers}</strong></div>
                        <div class="rs-item"><span>Women Helpers</span><strong>${womenHelpers}</strong></div>
                        <div class="rs-item"><span>Total Shifts</span><strong>${masonShifts}</strong></div>
                        <div class="rs-item"><span>Total Cost</span><strong>${fmt(masonCost)}</strong></div>
                    </div>
                </div>` : ''}
                ${cE.length ? `<div class="report-section">
                    <div class="rs-head"><i class="ph ph-columns"></i> Centring</div>
                    <div class="rs-grid">
                        <div class="rs-item"><span>Workers</span><strong>${centWorkers}</strong></div>
                        <div class="rs-item"><span>Total Shifts</span><strong>${centShifts}</strong></div>
                        <div class="rs-item"><span>Total Cost</span><strong>${fmt(centCost)}</strong></div>
                    </div>
                </div>` : ''}
                ${ccE.length ? `<div class="report-section">
                    <div class="rs-head"><i class="ph ph-cylinder"></i> Concrete</div>
                    <div class="rs-grid">
                        <div class="rs-item"><span>Total Shifts</span><strong>${concShifts}</strong></div>
                        <div class="rs-item"><span>Men</span><strong>${concMen}</strong></div>
                        <div class="rs-item"><span>Women</span><strong>${concWomen}</strong></div>
                        <div class="rs-item"><span>Total Cost</span><strong>${fmt(concCost)}</strong></div>
                    </div>
                </div>` : ''}
                ${epE.length ? `<div class="report-section">
                    <div class="rs-head"><i class="ph ph-lightning"></i> Electrical & Plumbing</div>
                    <div class="rs-grid">
                        <div class="rs-item"><span>Entries</span><strong>${epE.length}</strong></div>
                        <div class="rs-item"><span>Total Cost</span><strong>${fmt(epCost)}</strong></div>
                    </div>
                </div>` : ''}
                ${tE.length ? `<div class="report-section">
                    <div class="rs-head"><i class="ph ph-grid-four"></i> Tiles</div>
                    <div class="rs-grid">
                        <div class="rs-item"><span>Entries</span><strong>${tE.length}</strong></div>
                        <div class="rs-item"><span>Total Sq.ft</span><strong>${tilesSqft.toFixed(1)}</strong></div>
                        <div class="rs-item"><span>Total Cost</span><strong>${fmt(tilesCost)}</strong></div>
                    </div>
                </div>` : ''}
                ${pE.length ? `<div class="report-section">
                    <div class="rs-head"><i class="ph ph-paint-brush"></i> Painting</div>
                    <div class="rs-grid">
                        <div class="rs-item"><span>Workers</span><strong>${paintWorkers}</strong></div>
                        <div class="rs-item"><span>Total Shifts</span><strong>${paintShifts}</strong></div>
                        <div class="rs-item"><span>Total Cost</span><strong>${fmt(paintCost)}</strong></div>
                    </div>
                </div>` : ''}
            </div>
        </div>`;
    });

    html += '</div>';
    return labourShell('report', html);
}

function printLabourReport() {
    const content = document.getElementById('labour-report-content');
    if (!content) return;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Labour Report — ${AppState.currentProject.name}</title>
    <style>
        body { font-family: Georgia, serif; max-width: 900px; margin: 30px auto; color: #1a1a2e; }
        .report-week-card { border: 1px solid #ddd; border-radius: 8px; margin-bottom: 1.5rem; overflow: hidden; }
        .report-week-head { display:flex; justify-content:space-between; align-items:center; padding: .75rem 1rem; background: #f5f5f5; font-weight: 700; }
        .report-week-num { font-size: 1rem; }
        .report-week-dates { font-size: .8rem; color: #666; }
        .report-week-total { color: #10b981; }
        .report-sections { padding: .75rem 1rem; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
        .report-section { background: #fafafa; border-radius: 6px; padding: .6rem; }
        .rs-head { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #888; margin-bottom: .4rem; }
        .rs-grid { display: grid; gap: .25rem; }
        .rs-item { display: flex; justify-content: space-between; font-size: .8rem; }
        .rs-item span { color: #666; }
        .rs-item strong { color: #1a1a2e; }
        @media print { body { margin: 0; } }
    </style></head><body>
    <h1 style="margin-bottom:.25rem;">${esc(AppState.currentProject.name)}</h1>
    <p style="color:#888;font-size:.85rem;margin-bottom:2rem;">Weekly Labour Report — Generated ${new Date().toLocaleDateString('en-IN')}</p>
    ${content.innerHTML}
    </body></html>`);
    w.document.close();
    w.print();
}

// ── Helpers ────────────────────────────────────────────────
function getMonday(d) {
    const day = new Date(d);
    const diff = (day.getDay() + 6) % 7;
    day.setDate(day.getDate() - diff);
    day.setHours(0, 0, 0, 0);
    return day;
}

async function refreshLabourSub() {
    const sub  = window._labourSub || 'masonry';
    const proj = window.AppState && window.AppState.currentProject;
    if (!proj) { await navigateTo('labour'); return; }

    const viewContainer = document.getElementById('view-container');
    if (!viewContainer) { await navigateTo('labour'); return; }

    let html = '';
    switch (sub) {
        case 'masonry':  html = await loadMasonryView(proj._id); break;
        case 'centring': html = await loadCentringView(proj._id); break;
        case 'concrete': html = await loadConcreteView(proj._id); break;
        case 'ep':       html = await loadEPView(proj._id); break;
        case 'tiles':    html = await loadTilesView(proj._id); break;
        case 'painting': html = await loadPaintingView(proj._id); break;
        case 'report':   html = await loadLabourReport(proj._id); break;
    }
    // Replace the full view-container so modals are always in DOM
    viewContainer.innerHTML = html;
}

function todayDate() {
    return new Date().toISOString().split('T')[0];
}

function fmtDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return d; }
}

function fmt(v) {
    if (window.formatCurrency) return window.formatCurrency(v);
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v || 0);
}

function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function emptyState(icon, title, desc, onclick, btnLabel) {
    const label = btnLabel || 'Get Started';
    return `
    <div class="empty-state-panel">
        <i class="ph ${icon}"></i>
        <h3>${title}</h3>
        <p>${desc}</p>
        ${onclick ? `<button class="btn btn-primary" onclick="${onclick}"><i class="ph ph-plus"></i> ${label}</button>` : ''}
    </div>`;
}

// ── Global exports ─────────────────────────────────────────
window.loadLabourView        = loadLabourView;
window.loadLabourSubView     = loadLabourSubView;
window.initializeLabour      = initializeLabour;

// ── Masonry ──────────────────────────────────────────────────
window.showMasonryTeamModal           = showMasonryTeamModal;
window.saveMasonryTeam                = saveMasonryTeam;
window.deleteMasonryTeam              = deleteMasonryTeam;
window.openMasonryTeamDetail          = openMasonryTeamDetail;
window.backToMasonryList              = backToMasonryList;
window.showMasonryEntryModalFromDetail = showMasonryEntryModalFromDetail;
window.saveMasonryEntryFromDetail     = saveMasonryEntryFromDetail;
window.deleteMasonryEntryFromDetail   = deleteMasonryEntryFromDetail;
// legacy stubs
window.showMasonryEntryModal = showMasonryEntryModal;
window.saveMasonryEntry      = saveMasonryEntry;
window.showMasonryEntries    = showMasonryEntries;
window.deleteMasonryEntry    = deleteMasonryEntry;

// ── Centring ─────────────────────────────────────────────────
window.showCentringTeamModal           = showCentringTeamModal;
window.saveCentringTeam                = saveCentringTeam;
window.deleteCentringTeam              = deleteCentringTeam;
window.openCentringTeamDetail          = openCentringTeamDetail;
window.backToCentringList              = backToCentringList;
window.showCentringEntryModalFromDetail = showCentringEntryModalFromDetail;
window.saveCentringEntryFromDetail     = saveCentringEntryFromDetail;
window.deleteCentringEntryFromDetail   = deleteCentringEntryFromDetail;
// legacy stubs
window.showCentringEntryModal = showCentringEntryModal;
window.saveCentringEntry      = saveCentringEntry;
window.showCentringEntries    = showCentringEntries;
window.deleteCentringEntry    = deleteCentringEntry;

// ── Concrete ─────────────────────────────────────────────────
window.showConcreteAddTeamPrompt       = showConcreteAddTeamPrompt;
window.openConcreteTeamFromPrompt      = openConcreteTeamFromPrompt;
window.openConcreteTeamDetail          = openConcreteTeamDetail;
window.backToConcreteList              = backToConcreteList;
window.showConcreteEntryModalFromDetail = showConcreteEntryModalFromDetail;
window.saveConcreteEntryFromDetail     = saveConcreteEntryFromDetail;
window.deleteConcreteEntryFromDetail   = deleteConcreteEntryFromDetail;
window.deleteConcreteTeamAll           = deleteConcreteTeamAll;
// legacy stubs
window.showConcreteModal   = showConcreteModal;
window.saveConcreteEntry   = saveConcreteEntry;
window.deleteConcreteEntry = deleteConcreteEntry;

// ── E&P ──────────────────────────────────────────────────────
window.showEPAddContractorPrompt      = showEPAddContractorPrompt;
window.openEPContractorFromPrompt     = openEPContractorFromPrompt;
window.openEPContractorDetail         = openEPContractorDetail;
window.backToEPList                   = backToEPList;
window.showEPEntryModalFromDetail     = showEPEntryModalFromDetail;
window.saveEPEntryFromDetail          = saveEPEntryFromDetail;
window.deleteEPEntryFromDetail        = deleteEPEntryFromDetail;
window.deleteEPContractorAll          = deleteEPContractorAll;
// legacy stubs
window.showEPModal   = showEPModal;
window.saveEPEntry   = saveEPEntry;
window.deleteEPEntry = deleteEPEntry;

// ── Tiles ────────────────────────────────────────────────────
window.showTilesAddMasonPrompt        = showTilesAddMasonPrompt;
window.openTilesMasonFromPrompt       = openTilesMasonFromPrompt;
window.openTilesMasonDetail           = openTilesMasonDetail;
window.backToTilesList                = backToTilesList;
window.showTilesEntryModalFromDetail  = showTilesEntryModalFromDetail;
window.saveTilesEntryFromDetail       = saveTilesEntryFromDetail;
window.deleteTilesEntryFromDetail     = deleteTilesEntryFromDetail;
window.deleteTilesMasonAll            = deleteTilesMasonAll;
// legacy stubs
window.showTilesModal   = showTilesModal;
window.saveTilesEntry   = saveTilesEntry;
window.deleteTilesEntry = deleteTilesEntry;

// ── Painting ─────────────────────────────────────────────────
window.showPaintingTeamModal            = showPaintingTeamModal;
window.savePaintingTeam                 = savePaintingTeam;
window.deletePaintingTeam               = deletePaintingTeam;
window.openPaintingTeamDetail           = openPaintingTeamDetail;
window.backToPaintingList               = backToPaintingList;
window.showPaintingEntryModalFromDetail  = showPaintingEntryModalFromDetail;
window.savePaintingEntryFromDetail      = savePaintingEntryFromDetail;
window.deletePaintingEntryFromDetail    = deletePaintingEntryFromDetail;
// legacy stubs
window.showPaintingEntryModal = showPaintingEntryModal;
window.savePaintingEntry      = savePaintingEntry;
window.showPaintingEntries    = showPaintingEntries;
window.deletePaintingEntry    = deletePaintingEntry;

// ── Report ───────────────────────────────────────────────────
window.printLabourReport = printLabourReport;