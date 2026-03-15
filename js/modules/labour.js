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
async function loadMasonryView(projectId) {
    const teamsRes = await window.api.labour.masonry.getTeams(projectId);
    const teams = teamsRes.success ? teamsRes.data : [];

    let html = `
        <div class="lsub-header">
            <div>
                <h3 class="lsub-title"><i class="ph ph-wall"></i> Masonry Teams</h3>
                <p class="lsub-desc">Track Mason, Men & Women Helpers with shift-based attendance</p>
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

    html += masonryModals();
    return labourShell('masonry', html);
}

function masonryTeamCard(team) {
    const totalShifts = (team.entries || []).reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);
    const totalCost   = (team.entries || []).reduce((s, e) => s + parseFloat(e.wageAmount || 0), 0);
    const workerCount = [...new Set((team.entries || []).map(e => e.workerName))].length;
    return `
        <div class="team-card">
            <div class="team-card-head">
                <div class="team-card-avatar"><i class="ph ph-wall"></i></div>
                <div>
                    <div class="team-card-name">${esc(team.teamName)}</div>
                    <div class="team-card-meta">${workerCount} worker(s) · ${totalShifts} shifts</div>
                </div>
                <button class="btn btn-danger btn-sm ms-auto" onclick="deleteMasonryTeam('${team._id}','${esc(team.teamName)}')">
                    <i class="ph ph-trash"></i>
                </button>
            </div>
            <div class="team-card-stats">
                <div class="tcs"><span class="tcs-label">Total Shifts</span><span class="tcs-val">${totalShifts}</span></div>
                <div class="tcs"><span class="tcs-label">Total Cost</span><span class="tcs-val">${fmt(totalCost)}</span></div>
                <div class="tcs"><span class="tcs-label">Entries</span><span class="tcs-val">${(team.entries||[]).length}</span></div>
            </div>
            <div class="team-card-actions">
                <button class="btn btn-outline btn-sm" onclick="showMasonryEntryModal('${team._id}','${esc(team.teamName)}')">
                    <i class="ph ph-plus"></i> Add Entry
                </button>
                <button class="btn btn-ghost btn-sm" onclick="showMasonryEntries('${team._id}','${esc(team.teamName)}')">
                    <i class="ph ph-list"></i> View
                </button>
            </div>
            <div id="masonry-entries-${team._id}" style="display:none;"></div>
        </div>`;
}

function masonryModals() {
    return `
    <!-- Create Team Modal -->
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
    </div>

    <!-- Add Entry Modal -->
    <div id="masonryEntryModal" class="modal">
        <div class="modal-content" style="max-width:480px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="ph ph-plus-circle"></i> Add Entry — <span id="masonryEntryTeamName"></span></h3>
                <button class="modal-close" onclick="hideModal('masonryEntryModal')"><i class="ph ph-x"></i></button>
            </div>
            <input type="hidden" id="masonryEntryTeamId" />
            <div class="grid grid-2 gap">
                <div class="form-group">
                    <label class="form-label">Date</label>
                    <input type="date" id="masonryEntryDate" class="form-input" />
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
                    <input type="number" id="masonryEntryShift" class="form-input" step="0.5" min="0.5" value="1" placeholder="1 or 1.5" />
                </div>
                <div class="form-group">
                    <label class="form-label">Wage Amount (₹)</label>
                    <input type="number" id="masonryEntryWage" class="form-input" step="0.01" min="0" placeholder="Amount paid" />
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Notes (optional)</label>
                <input type="text" id="masonryEntryNotes" class="form-input" placeholder="Any remarks" />
            </div>
            <div class="flex gap">
                <button class="btn btn-outline" onclick="hideModal('masonryEntryModal')">Cancel</button>
                <button class="btn btn-primary" onclick="saveMasonryEntry()"><i class="ph ph-check"></i> Save Entry</button>
            </div>
        </div>
    </div>`;
}

function showMasonryTeamModal() {
    document.getElementById('masonryTeamName').value = '';
    showModal('masonryTeamModal');
}

async function saveMasonryTeam() {
    const name = document.getElementById('masonryTeamName').value.trim();
    const payType = document.getElementById('masonryPayType').value;
    if (!name) { showToast('Enter a team name', 'warning'); return; }
    showLoading();
    const res = await window.api.labour.masonry.createTeam({ projectId: AppState.currentProject._id, teamName: name, paymentType: payType });
    hideLoading();
    if (res.success) {
        hideModal('masonryTeamModal');
        showToast(`${name} created`, 'success');
        await refreshLabourSub();
    } else { showToast('Failed: ' + res.message, 'danger'); }
}

async function deleteMasonryTeam(id, name) {
    if (!confirm(`Delete "${name}" and all its entries?`)) return;
    showLoading();
    await window.api.labour.masonry.deleteTeam(id);
    hideLoading();
    showToast(`${name} deleted`, 'success');
    await refreshLabourSub();
}

function showMasonryEntryModal(teamId, teamName) {
    document.getElementById('masonryEntryTeamId').value = teamId;
    document.getElementById('masonryEntryTeamName').textContent = teamName;
    document.getElementById('masonryEntryDate').value = todayDate();
    document.getElementById('masonryEntryWorker').value = '';
    document.getElementById('masonryEntryShift').value = '1';
    document.getElementById('masonryEntryWage').value = '';
    document.getElementById('masonryEntryNotes').value = '';
    showModal('masonryEntryModal');
}

async function saveMasonryEntry() {
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
    const res = await window.api.labour.masonry.addEntry({ teamId, projectId: AppState.currentProject._id, date, workerName: worker, workerRole: role, shiftCount: shift, wageAmount: wage, notes });
    hideLoading();
    if (res.success) {
        hideModal('masonryEntryModal');
        showToast('Entry saved', 'success');
        await refreshLabourSub();
    } else { showToast('Failed: ' + res.message, 'danger'); }
}

async function showMasonryEntries(teamId, teamName) {
    const container = document.getElementById(`masonry-entries-${teamId}`);
    if (!container) return;
    const visible = container.style.display !== 'none';
    if (visible) { container.style.display = 'none'; return; }
    container.style.display = 'block';
    container.innerHTML = '<div class="labour-loading"><div class="labour-spin"></div></div>';
    const res = await window.api.labour.masonry.getEntries(teamId);
    const entries = res.success ? res.data : [];
    if (entries.length === 0) { container.innerHTML = '<p class="text-muted text-center" style="padding:.75rem;">No entries yet.</p>'; return; }
    container.innerHTML = `
        <div class="entry-table-wrap">
            <table>
                <thead><tr><th>Date</th><th>Name</th><th>Role</th><th>Shifts</th><th>Wage</th><th>Notes</th><th></th></tr></thead>
                <tbody>${entries.map(e => `
                    <tr>
                        <td>${fmtDate(e.date)}</td>
                        <td>${esc(e.workerName)}</td>
                        <td><span class="role-badge role-${(e.workerRole||'').toLowerCase().replace(/\s+/g,'-')}">${esc(e.workerRole)}</span></td>
                        <td><strong>${e.shiftCount}</strong></td>
                        <td>${fmt(e.wageAmount)}</td>
                        <td>${esc(e.notes||'—')}</td>
                        <td><button class="btn btn-sm btn-danger" onclick="deleteMasonryEntry('${e._id}','${teamId}')"><i class="ph ph-trash"></i></button></td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
}

async function deleteMasonryEntry(entryId, teamId) {
    if (!confirm('Delete this entry?')) return;
    await window.api.labour.masonry.deleteEntry(entryId);
    showToast('Deleted', 'success');
    await showMasonryEntries(teamId, '');
    await showMasonryEntries(teamId, ''); // toggle twice to re-render
}

// ════════════════════════════════════════════════════════════
// 2 — CENTRING
// ════════════════════════════════════════════════════════════
async function loadCentringView(projectId) {
    const teamsRes = await window.api.labour.centring.getTeams(projectId);
    const teams = teamsRes.success ? teamsRes.data : [];

    let html = `
        <div class="lsub-header">
            <div>
                <h3 class="lsub-title"><i class="ph ph-columns"></i> Centring Teams</h3>
                <p class="lsub-desc">Track centring workers with daily/sq.ft wages</p>
            </div>
            <button class="btn btn-primary btn-sm" onclick="showCentringTeamModal()">
                <i class="ph ph-plus"></i> New Team
            </button>
        </div>`;

    if (teams.length === 0) {
        html += emptyState('ph-columns', 'No Centring Teams', 'Create your first centring team.', 'showCentringTeamModal()', 'New Team');
    } else {
        html += '<div class="team-grid">' + teams.map(t => centringTeamCard(t)).join('') + '</div>';
    }
    html += centringModals();
    return labourShell('centring', html);
}

function centringTeamCard(team) {
    const totalShifts = (team.entries||[]).reduce((s,e) => s + parseFloat(e.shiftCount||0), 0);
    const totalCost   = (team.entries||[]).reduce((s,e) => s + parseFloat(e.wageAmount||0), 0);
    const workerCount = [...new Set((team.entries||[]).map(e => e.workerName))].length;
    return `
        <div class="team-card">
            <div class="team-card-head">
                <div class="team-card-avatar" style="background:rgba(59,130,246,.15);color:#3b82f6;"><i class="ph ph-columns"></i></div>
                <div>
                    <div class="team-card-name">${esc(team.teamName)}</div>
                    <div class="team-card-meta">${workerCount} worker(s) · ${team.paymentType === 'sqft' ? 'Sq.ft' : 'Daily'}</div>
                </div>
                <button class="btn btn-danger btn-sm ms-auto" onclick="deleteCentringTeam('${team._id}','${esc(team.teamName)}')"><i class="ph ph-trash"></i></button>
            </div>
            <div class="team-card-stats">
                <div class="tcs"><span class="tcs-label">Shifts</span><span class="tcs-val">${totalShifts}</span></div>
                <div class="tcs"><span class="tcs-label">Cost</span><span class="tcs-val">${fmt(totalCost)}</span></div>
                <div class="tcs"><span class="tcs-label">Entries</span><span class="tcs-val">${(team.entries||[]).length}</span></div>
            </div>
            <div class="team-card-actions">
                <button class="btn btn-outline btn-sm" onclick="showCentringEntryModal('${team._id}','${esc(team.teamName)}','${team.paymentType}')">
                    <i class="ph ph-plus"></i> Add Entry
                </button>
                <button class="btn btn-ghost btn-sm" onclick="showCentringEntries('${team._id}')">
                    <i class="ph ph-list"></i> View
                </button>
            </div>
            <div id="centring-entries-${team._id}" style="display:none;"></div>
        </div>`;
}

function centringModals() {
    return `
    <div id="centringTeamModal" class="modal">
        <div class="modal-content" style="max-width:420px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="ph ph-columns"></i> New Centring Team</h3>
                <button class="modal-close" onclick="hideModal('centringTeamModal')"><i class="ph ph-x"></i></button>
            </div>
            <div class="form-group"><label class="form-label">Team Name</label>
                <input type="text" id="centringTeamName" class="form-input" placeholder="e.g. Centring Team A" /></div>
            <div class="form-group"><label class="form-label">Payment Type</label>
                <select id="centringPayType" class="form-select">
                    <option value="sqft">Per Sq.ft</option>
                    <option value="daily">Daily Wage</option>
                </select></div>
            <div class="flex gap">
                <button class="btn btn-outline" onclick="hideModal('centringTeamModal')">Cancel</button>
                <button class="btn btn-primary" onclick="saveCentringTeam()"><i class="ph ph-check"></i> Create</button>
            </div>
        </div>
    </div>
    <div id="centringEntryModal" class="modal">
        <div class="modal-content" style="max-width:480px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="ph ph-plus-circle"></i> Add Entry — <span id="centringEntryTeamName"></span></h3>
                <button class="modal-close" onclick="hideModal('centringEntryModal')"><i class="ph ph-x"></i></button>
            </div>
            <input type="hidden" id="centringEntryTeamId" />
            <div class="grid grid-2 gap">
                <div class="form-group"><label class="form-label">Date</label>
                    <input type="date" id="centringEntryDate" class="form-input" /></div>
                <div class="form-group"><label class="form-label">Worker Name</label>
                    <input type="text" id="centringEntryWorker" class="form-input" placeholder="Name" /></div>
            </div>
            <div class="grid grid-2 gap">
                <div class="form-group"><label class="form-label">Shift Count</label>
                    <input type="number" id="centringEntryShift" class="form-input" step="0.5" min="0.5" value="1" /></div>
                <div class="form-group"><label class="form-label">Wage Amount (₹)</label>
                    <input type="number" id="centringEntryWage" class="form-input" step="0.01" min="0" /></div>
            </div>
            <div class="form-group" id="centringEntryQtyGroup"><label class="form-label">Sq.ft Completed</label>
                <input type="number" id="centringEntrySqft" class="form-input" step="0.01" min="0" placeholder="0" /></div>
            <div class="flex gap">
                <button class="btn btn-outline" onclick="hideModal('centringEntryModal')">Cancel</button>
                <button class="btn btn-primary" onclick="saveCentringEntry()"><i class="ph ph-check"></i> Save</button>
            </div>
        </div>
    </div>`;
}

function showCentringTeamModal() {
    document.getElementById('centringTeamName').value = '';
    showModal('centringTeamModal');
}

async function saveCentringTeam() {
    const name = document.getElementById('centringTeamName').value.trim();
    const payType = document.getElementById('centringPayType').value;
    if (!name) { showToast('Enter a team name', 'warning'); return; }
    showLoading();
    const res = await window.api.labour.centring.createTeam({ projectId: AppState.currentProject._id, teamName: name, paymentType: payType });
    hideLoading();
    if (res.success) { hideModal('centringTeamModal'); showToast(`${name} created`, 'success'); await refreshLabourSub(); }
    else showToast('Failed: ' + res.message, 'danger');
}

async function deleteCentringTeam(id, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    showLoading(); await window.api.labour.centring.deleteTeam(id); hideLoading();
    showToast(`${name} deleted`, 'success'); await refreshLabourSub();
}

function showCentringEntryModal(teamId, teamName, payType) {
    document.getElementById('centringEntryTeamId').value = teamId;
    document.getElementById('centringEntryTeamName').textContent = teamName;
    document.getElementById('centringEntryDate').value = todayDate();
    document.getElementById('centringEntryWorker').value = '';
    document.getElementById('centringEntryShift').value = '1';
    document.getElementById('centringEntryWage').value = '';
    document.getElementById('centringEntrySqft').value = '';
    const sqftGroup = document.getElementById('centringEntryQtyGroup');
    if (sqftGroup) sqftGroup.style.display = payType === 'sqft' ? 'block' : 'none';
    showModal('centringEntryModal');
}

async function saveCentringEntry() {
    const teamId = document.getElementById('centringEntryTeamId').value;
    const date   = document.getElementById('centringEntryDate').value;
    const worker = document.getElementById('centringEntryWorker').value.trim();
    const shift  = parseFloat(document.getElementById('centringEntryShift').value);
    const wage   = parseFloat(document.getElementById('centringEntryWage').value) || 0;
    const sqft   = parseFloat(document.getElementById('centringEntrySqft').value) || 0;
    if (!date || !worker || isNaN(shift)) { showToast('Fill all required fields', 'warning'); return; }
    showLoading();
    const res = await window.api.labour.centring.addEntry({ teamId, projectId: AppState.currentProject._id, date, workerName: worker, shiftCount: shift, wageAmount: wage, sqftCompleted: sqft });
    hideLoading();
    if (res.success) { hideModal('centringEntryModal'); showToast('Entry saved', 'success'); await refreshLabourSub(); }
    else showToast('Failed: ' + res.message, 'danger');
}

async function showCentringEntries(teamId) {
    const container = document.getElementById(`centring-entries-${teamId}`);
    if (!container) return;
    if (container.style.display !== 'none') { container.style.display = 'none'; return; }
    container.style.display = 'block';
    const res = await window.api.labour.centring.getEntries(teamId);
    const entries = res.success ? res.data : [];
    if (!entries.length) { container.innerHTML = '<p class="text-muted text-center" style="padding:.75rem;">No entries.</p>'; return; }
    container.innerHTML = `<div class="entry-table-wrap"><table>
        <thead><tr><th>Date</th><th>Name</th><th>Shifts</th><th>Sq.ft</th><th>Wage</th><th></th></tr></thead>
        <tbody>${entries.map(e => `<tr>
            <td>${fmtDate(e.date)}</td><td>${esc(e.workerName)}</td>
            <td><strong>${e.shiftCount}</strong></td><td>${e.sqftCompleted||0}</td>
            <td>${fmt(e.wageAmount)}</td>
            <td><button class="btn btn-sm btn-danger" onclick="deleteCentringEntry('${e._id}','${teamId}')"><i class="ph ph-trash"></i></button></td>
        </tr>`).join('')}</tbody>
    </table></div>`;
}

async function deleteCentringEntry(entryId, teamId) {
    if (!confirm('Delete?')) return;
    await window.api.labour.centring.deleteEntry(entryId);
    showToast('Deleted', 'success');
    const c = document.getElementById(`centring-entries-${teamId}`);
    if (c) { c.style.display = 'none'; await showCentringEntries(teamId); }
}

// ════════════════════════════════════════════════════════════
// 3 — CONCRETE
// ════════════════════════════════════════════════════════════
async function loadConcreteView(projectId) {
    const res = await window.api.labour.concrete.getAll(projectId);
    const entries = res.success ? res.data : [];
    const totalCost = entries.reduce((s, e) => s + parseFloat(e.amount||0), 0);

    let html = `
        <div class="lsub-header">
            <div>
                <h3 class="lsub-title"><i class="ph ph-cylinder"></i> Concrete Team</h3>
                <p class="lsub-desc">Track concrete pouring work — Lump Sum or RMC</p>
            </div>
            <div class="flex gap-sm">
                <div class="lsub-stat-chip"><i class="ph ph-currency-inr"></i> Total: ${fmt(totalCost)}</div>
                <button class="btn btn-primary btn-sm" onclick="showConcreteModal()"><i class="ph ph-plus"></i> Add Concrete Record</button>
            </div>
        </div>`;

    if (!entries.length) {
        html += emptyState('ph-cylinder', 'No Concrete Records', 'Add your first concrete pour entry to start tracking shifts and costs.', 'showConcreteModal()', 'Add Concrete Record');
    } else {
        html += `<div class="entry-table-wrap"><table>
            <thead><tr><th>Date</th><th>Team</th><th>Shifts</th><th>Men</th><th>Women</th><th>Type</th><th>Amount</th><th>Notes</th><th></th></tr></thead>
            <tbody>${entries.map(e => `<tr>
                <td>${fmtDate(e.date)}</td>
                <td>${esc(e.teamName)}</td>
                <td>${e.shiftCount}</td>
                <td>${e.menCount}</td>
                <td>${e.womenCount}</td>
                <td><span class="role-badge">${esc(e.paymentType)}</span></td>
                <td>${fmt(e.amount)}</td>
                <td>${esc(e.notes||'—')}</td>
                <td><button class="btn btn-sm btn-danger" onclick="deleteConcreteEntry('${e._id}')"><i class="ph ph-trash"></i></button></td>
            </tr>`).join('')}</tbody>
        </table></div>`;
    }

    html += `<div id="concreteModal" class="modal">
        <div class="modal-content" style="max-width:520px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="ph ph-cylinder"></i> Add Concrete Work</h3>
                <button class="modal-close" onclick="hideModal('concreteModal')"><i class="ph ph-x"></i></button>
            </div>
            <div class="grid grid-2 gap">
                <div class="form-group"><label class="form-label">Date</label><input type="date" id="concDate" class="form-input" /></div>
                <div class="form-group"><label class="form-label">Team / Contractor Name</label><input type="text" id="concTeam" class="form-input" placeholder="Team name" /></div>
            </div>
            <div class="grid grid-3 gap">
                <div class="form-group"><label class="form-label">Shifts</label><input type="number" id="concShifts" class="form-input" step="0.5" min="0" value="1" /></div>
                <div class="form-group"><label class="form-label">Men</label><input type="number" id="concMen" class="form-input" min="0" value="0" /></div>
                <div class="form-group"><label class="form-label">Women</label><input type="number" id="concWomen" class="form-input" min="0" value="0" /></div>
            </div>
            <div class="grid grid-2 gap">
                <div class="form-group"><label class="form-label">Payment Type</label>
                    <select id="concPayType" class="form-select"><option value="Lump Sum">Lump Sum</option><option value="RMC">RMC</option></select></div>
                <div class="form-group"><label class="form-label">Amount (₹)</label><input type="number" id="concAmount" class="form-input" step="0.01" min="0" /></div>
            </div>
            <div class="form-group"><label class="form-label">Notes</label><input type="text" id="concNotes" class="form-input" placeholder="Optional" /></div>
            <div class="flex gap">
                <button class="btn btn-outline" onclick="hideModal('concreteModal')">Cancel</button>
                <button class="btn btn-primary" onclick="saveConcreteEntry()"><i class="ph ph-check"></i> Save</button>
            </div>
        </div>
    </div>`;

    return labourShell('concrete', html);
}

function showConcreteModal() {
    document.getElementById('concDate').value = todayDate();
    ['concTeam','concNotes'].forEach(id => document.getElementById(id).value = '');
    ['concShifts'].forEach(id => document.getElementById(id).value = '1');
    ['concMen','concWomen','concAmount'].forEach(id => document.getElementById(id).value = '0');
    showModal('concreteModal');
}

async function saveConcreteEntry() {
    const date     = document.getElementById('concDate').value;
    const teamName = document.getElementById('concTeam').value.trim();
    const shifts   = parseFloat(document.getElementById('concShifts').value)||0;
    const men      = parseInt(document.getElementById('concMen').value)||0;
    const women    = parseInt(document.getElementById('concWomen').value)||0;
    const payType  = document.getElementById('concPayType').value;
    const amount   = parseFloat(document.getElementById('concAmount').value)||0;
    const notes    = document.getElementById('concNotes').value.trim();
    if (!date || !teamName) { showToast('Fill date and team name', 'warning'); return; }
    showLoading();
    const res = await window.api.labour.concrete.add({ projectId: AppState.currentProject._id, date, teamName, shiftCount: shifts, menCount: men, womenCount: women, paymentType: payType, amount, notes });
    hideLoading();
    if (res.success) { hideModal('concreteModal'); showToast('Saved', 'success'); await refreshLabourSub(); }
    else showToast('Failed: ' + res.message, 'danger');
}

async function deleteConcreteEntry(id) {
    if (!confirm('Delete?')) return;
    await window.api.labour.concrete.delete(id);
    showToast('Deleted', 'success'); await refreshLabourSub();
}

// ════════════════════════════════════════════════════════════
// 4 — ELECTRICAL & PLUMBING
// ════════════════════════════════════════════════════════════
async function loadEPView(projectId) {
    const res = await window.api.labour.ep.getAll(projectId);
    const entries = res.success ? res.data : [];
    const totalCost = entries.reduce((s, e) => s + parseFloat(e.amount||0), 0);

    let html = `
        <div class="lsub-header">
            <div>
                <h3 class="lsub-title"><i class="ph ph-lightning"></i> Elec & Plumbing</h3>
                <p class="lsub-desc">Track electrical and plumbing contractor payments</p>
            </div>
            <div class="flex gap-sm">
                <div class="lsub-stat-chip"><i class="ph ph-currency-inr"></i> Total: ${fmt(totalCost)}</div>
                <button class="btn btn-primary btn-sm" onclick="showEPModal()"><i class="ph ph-plus"></i> Add Work</button>
            </div>
        </div>`;

    if (!entries.length) {
        html += emptyState('ph-lightning', 'No E&P Records', 'Add your first electrical or plumbing work entry.', 'showEPModal()', 'Add Work');
    } else {
        html += `<div class="entry-table-wrap"><table>
            <thead><tr><th>Date</th><th>Worker / Team</th><th>Description</th><th>Amount</th><th>Notes</th><th></th></tr></thead>
            <tbody>${entries.map(e => `<tr>
                <td>${fmtDate(e.date)}</td>
                <td><strong>${esc(e.workerName)}</strong></td>
                <td>${esc(e.description)}</td>
                <td>${fmt(e.amount)}</td>
                <td>${esc(e.notes||'—')}</td>
                <td><button class="btn btn-sm btn-danger" onclick="deleteEPEntry('${e._id}')"><i class="ph ph-trash"></i></button></td>
            </tr>`).join('')}</tbody>
        </table></div>`;
    }

    html += `<div id="epModal" class="modal">
        <div class="modal-content" style="max-width:480px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="ph ph-lightning"></i> Add E&P Work</h3>
                <button class="modal-close" onclick="hideModal('epModal')"><i class="ph ph-x"></i></button>
            </div>
            <div class="grid grid-2 gap">
                <div class="form-group"><label class="form-label">Date</label><input type="date" id="epDate" class="form-input" /></div>
                <div class="form-group"><label class="form-label">Worker / Team Name</label><input type="text" id="epWorker" class="form-input" placeholder="Name" /></div>
            </div>
            <div class="form-group"><label class="form-label">Work Description</label><input type="text" id="epDesc" class="form-input" placeholder="e.g. 1st floor wiring" /></div>
            <div class="form-group"><label class="form-label">Payment Amount (₹)</label><input type="number" id="epAmount" class="form-input" step="0.01" min="0" /></div>
            <div class="form-group"><label class="form-label">Notes</label><input type="text" id="epNotes" class="form-input" placeholder="Optional" /></div>
            <div class="flex gap">
                <button class="btn btn-outline" onclick="hideModal('epModal')">Cancel</button>
                <button class="btn btn-primary" onclick="saveEPEntry()"><i class="ph ph-check"></i> Save</button>
            </div>
        </div>
    </div>`;

    return labourShell('ep', html);
}

function showEPModal() {
    document.getElementById('epDate').value = todayDate();
    ['epWorker','epDesc','epNotes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('epAmount').value = '';
    showModal('epModal');
}

async function saveEPEntry() {
    const date   = document.getElementById('epDate').value;
    const worker = document.getElementById('epWorker').value.trim();
    const desc   = document.getElementById('epDesc').value.trim();
    const amount = parseFloat(document.getElementById('epAmount').value)||0;
    const notes  = document.getElementById('epNotes').value.trim();
    if (!date || !worker || !desc) { showToast('Fill date, name and description', 'warning'); return; }
    showLoading();
    const res = await window.api.labour.ep.add({ projectId: AppState.currentProject._id, date, workerName: worker, description: desc, amount, notes });
    hideLoading();
    if (res.success) { hideModal('epModal'); showToast('Saved', 'success'); await refreshLabourSub(); }
    else showToast('Failed: ' + res.message, 'danger');
}

async function deleteEPEntry(id) {
    if (!confirm('Delete?')) return;
    await window.api.labour.ep.delete(id);
    showToast('Deleted', 'success'); await refreshLabourSub();
}

// ════════════════════════════════════════════════════════════
// 5 — TILES
// ════════════════════════════════════════════════════════════
async function loadTilesView(projectId) {
    const res = await window.api.labour.tiles.getAll(projectId);
    const entries = res.success ? res.data : [];
    const totalSqft = entries.reduce((s, e) => s + parseFloat(e.sqftCompleted||0), 0);
    const totalCost = entries.reduce((s, e) => s + parseFloat(e.wageAmount||0), 0);

    let html = `
        <div class="lsub-header">
            <div>
                <h3 class="lsub-title"><i class="ph ph-grid-four"></i> Tiles Work</h3>
                <p class="lsub-desc">Track tiling by sq.ft or daily wages</p>
            </div>
            <div class="flex gap-sm">
                <div class="lsub-stat-chip"><i class="ph ph-ruler"></i> ${totalSqft.toFixed(1)} sq.ft</div>
                <div class="lsub-stat-chip"><i class="ph ph-currency-inr"></i> Total: ${fmt(totalCost)}</div>
                <button class="btn btn-primary btn-sm" onclick="showTilesModal()"><i class="ph ph-plus"></i> Add Entry</button>
            </div>
        </div>`;

    if (!entries.length) {
        html += emptyState('ph-grid-four', 'No Tiles Records', 'Add your first tiles work entry.', 'showTilesModal()', 'Add Entry');
    } else {
        html += `<div class="entry-table-wrap"><table>
            <thead><tr><th>Date</th><th>Mason</th><th>Helper</th><th>Sq.ft</th><th>Type</th><th>Wage</th><th>Notes</th><th></th></tr></thead>
            <tbody>${entries.map(e => `<tr>
                <td>${fmtDate(e.date)}</td>
                <td>${esc(e.masonName)}</td>
                <td>${esc(e.helperName||'—')}</td>
                <td>${e.sqftCompleted||0}</td>
                <td><span class="role-badge">${esc(e.paymentType)}</span></td>
                <td>${fmt(e.wageAmount)}</td>
                <td>${esc(e.notes||'—')}</td>
                <td><button class="btn btn-sm btn-danger" onclick="deleteTilesEntry('${e._id}')"><i class="ph ph-trash"></i></button></td>
            </tr>`).join('')}</tbody>
        </table></div>`;
    }

    html += `<div id="tilesModal" class="modal">
        <div class="modal-content" style="max-width:500px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="ph ph-grid-four"></i> Add Tiles Entry</h3>
                <button class="modal-close" onclick="hideModal('tilesModal')"><i class="ph ph-x"></i></button>
            </div>
            <div class="grid grid-2 gap">
                <div class="form-group"><label class="form-label">Date</label><input type="date" id="tilesDate" class="form-input" /></div>
                <div class="form-group"><label class="form-label">Payment Type</label>
                    <select id="tilesPayType" class="form-select"><option value="Sq.ft">Sq.ft</option><option value="Daily Wage">Daily Wage</option></select></div>
            </div>
            <div class="grid grid-2 gap">
                <div class="form-group"><label class="form-label">Mason Name</label><input type="text" id="tilesMason" class="form-input" placeholder="Mason name" /></div>
                <div class="form-group"><label class="form-label">Helper Name</label><input type="text" id="tilesHelper" class="form-input" placeholder="Helper name (optional)" /></div>
            </div>
            <div class="grid grid-2 gap">
                <div class="form-group"><label class="form-label">Sq.ft Completed</label><input type="number" id="tilesSqft" class="form-input" step="0.01" min="0" value="0" /></div>
                <div class="form-group"><label class="form-label">Wage Amount (₹)</label><input type="number" id="tilesWage" class="form-input" step="0.01" min="0" /></div>
            </div>
            <div class="form-group"><label class="form-label">Notes</label><input type="text" id="tilesNotes" class="form-input" placeholder="Optional" /></div>
            <div class="flex gap">
                <button class="btn btn-outline" onclick="hideModal('tilesModal')">Cancel</button>
                <button class="btn btn-primary" onclick="saveTilesEntry()"><i class="ph ph-check"></i> Save</button>
            </div>
        </div>
    </div>`;

    return labourShell('tiles', html);
}

function showTilesModal() {
    document.getElementById('tilesDate').value = todayDate();
    ['tilesMason','tilesHelper','tilesNotes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('tilesSqft').value = '0';
    document.getElementById('tilesWage').value = '';
    showModal('tilesModal');
}

async function saveTilesEntry() {
    const date    = document.getElementById('tilesDate').value;
    const mason   = document.getElementById('tilesMason').value.trim();
    const helper  = document.getElementById('tilesHelper').value.trim();
    const sqft    = parseFloat(document.getElementById('tilesSqft').value)||0;
    const wage    = parseFloat(document.getElementById('tilesWage').value)||0;
    const payType = document.getElementById('tilesPayType').value;
    const notes   = document.getElementById('tilesNotes').value.trim();
    if (!date || !mason) { showToast('Fill date and mason name', 'warning'); return; }
    showLoading();
    const res = await window.api.labour.tiles.add({ projectId: AppState.currentProject._id, date, masonName: mason, helperName: helper, sqftCompleted: sqft, wageAmount: wage, paymentType: payType, notes });
    hideLoading();
    if (res.success) { hideModal('tilesModal'); showToast('Saved', 'success'); await refreshLabourSub(); }
    else showToast('Failed: ' + res.message, 'danger');
}

async function deleteTilesEntry(id) {
    if (!confirm('Delete?')) return;
    await window.api.labour.tiles.delete(id);
    showToast('Deleted', 'success'); await refreshLabourSub();
}

// ════════════════════════════════════════════════════════════
// 6 — PAINTING
// ════════════════════════════════════════════════════════════
async function loadPaintingView(projectId) {
    const teamsRes = await window.api.labour.painting.getTeams(projectId);
    const teams = teamsRes.success ? teamsRes.data : [];

    let html = `
        <div class="lsub-header">
            <div>
                <h3 class="lsub-title"><i class="ph ph-paint-brush"></i> Painting Teams</h3>
                <p class="lsub-desc">Track painting crews with shift-based attendance</p>
            </div>
            <button class="btn btn-primary btn-sm" onclick="showPaintingTeamModal()">
                <i class="ph ph-plus"></i> New Team
            </button>
        </div>`;

    if (!teams.length) {
        html += emptyState('ph-paint-brush', 'No Painting Teams', 'Create your first painting team.', 'showPaintingTeamModal()', 'New Team');
    } else {
        html += '<div class="team-grid">' + teams.map(t => paintingTeamCard(t)).join('') + '</div>';
    }
    html += paintingModals();
    return labourShell('painting', html);
}

function paintingTeamCard(team) {
    const totalShifts = (team.entries||[]).reduce((s,e) => s + parseFloat(e.shiftCount||0), 0);
    const totalCost   = (team.entries||[]).reduce((s,e) => s + parseFloat(e.wageAmount||0), 0);
    return `
        <div class="team-card">
            <div class="team-card-head">
                <div class="team-card-avatar" style="background:rgba(20,184,166,.15);color:#14b8a6;"><i class="ph ph-paint-brush"></i></div>
                <div>
                    <div class="team-card-name">${esc(team.teamName)}</div>
                    <div class="team-card-meta">${team.paymentType === 'sqft' ? 'Sq.ft' : 'Daily'} · ${(team.entries||[]).length} entries</div>
                </div>
                <button class="btn btn-danger btn-sm ms-auto" onclick="deletePaintingTeam('${team._id}','${esc(team.teamName)}')"><i class="ph ph-trash"></i></button>
            </div>
            <div class="team-card-stats">
                <div class="tcs"><span class="tcs-label">Shifts</span><span class="tcs-val">${totalShifts}</span></div>
                <div class="tcs"><span class="tcs-label">Cost</span><span class="tcs-val">${fmt(totalCost)}</span></div>
                <div class="tcs"><span class="tcs-label">Entries</span><span class="tcs-val">${(team.entries||[]).length}</span></div>
            </div>
            <div class="team-card-actions">
                <button class="btn btn-outline btn-sm" onclick="showPaintingEntryModal('${team._id}','${esc(team.teamName)}')">
                    <i class="ph ph-plus"></i> Add Entry
                </button>
                <button class="btn btn-ghost btn-sm" onclick="showPaintingEntries('${team._id}')">
                    <i class="ph ph-list"></i> View
                </button>
            </div>
            <div id="painting-entries-${team._id}" style="display:none;"></div>
        </div>`;
}

function paintingModals() {
    return `
    <div id="paintingTeamModal" class="modal">
        <div class="modal-content" style="max-width:420px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="ph ph-paint-brush"></i> New Painting Team</h3>
                <button class="modal-close" onclick="hideModal('paintingTeamModal')"><i class="ph ph-x"></i></button>
            </div>
            <div class="form-group"><label class="form-label">Team Name</label>
                <input type="text" id="paintingTeamName" class="form-input" placeholder="e.g. Painter Team A" /></div>
            <div class="form-group"><label class="form-label">Payment Type</label>
                <select id="paintingPayType" class="form-select"><option value="sqft">Sq.ft</option><option value="daily">Daily Wage</option></select></div>
            <div class="flex gap">
                <button class="btn btn-outline" onclick="hideModal('paintingTeamModal')">Cancel</button>
                <button class="btn btn-primary" onclick="savePaintingTeam()"><i class="ph ph-check"></i> Create</button>
            </div>
        </div>
    </div>
    <div id="paintingEntryModal" class="modal">
        <div class="modal-content" style="max-width:480px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="ph ph-plus-circle"></i> Add Entry — <span id="paintingEntryTeamName"></span></h3>
                <button class="modal-close" onclick="hideModal('paintingEntryModal')"><i class="ph ph-x"></i></button>
            </div>
            <input type="hidden" id="paintingEntryTeamId" />
            <div class="grid grid-2 gap">
                <div class="form-group"><label class="form-label">Date</label><input type="date" id="paintingEntryDate" class="form-input" /></div>
                <div class="form-group"><label class="form-label">Worker Name</label><input type="text" id="paintingEntryWorker" class="form-input" /></div>
            </div>
            <div class="grid grid-2 gap">
                <div class="form-group"><label class="form-label">Shift Count</label><input type="number" id="paintingEntryShift" class="form-input" step="0.5" min="0.5" value="1" /></div>
                <div class="form-group"><label class="form-label">Wage Amount (₹)</label><input type="number" id="paintingEntryWage" class="form-input" step="0.01" min="0" /></div>
            </div>
            <div class="form-group"><label class="form-label">Sq.ft (if applicable)</label><input type="number" id="paintingEntrySqft" class="form-input" step="0.01" min="0" value="0" /></div>
            <div class="flex gap">
                <button class="btn btn-outline" onclick="hideModal('paintingEntryModal')">Cancel</button>
                <button class="btn btn-primary" onclick="savePaintingEntry()"><i class="ph ph-check"></i> Save</button>
            </div>
        </div>
    </div>`;
}

function showPaintingTeamModal() { document.getElementById('paintingTeamName').value = ''; showModal('paintingTeamModal'); }

async function savePaintingTeam() {
    const name = document.getElementById('paintingTeamName').value.trim();
    const payType = document.getElementById('paintingPayType').value;
    if (!name) { showToast('Enter team name', 'warning'); return; }
    showLoading();
    const res = await window.api.labour.painting.createTeam({ projectId: AppState.currentProject._id, teamName: name, paymentType: payType });
    hideLoading();
    if (res.success) { hideModal('paintingTeamModal'); showToast(`${name} created`, 'success'); await refreshLabourSub(); }
    else showToast('Failed', 'danger');
}

async function deletePaintingTeam(id, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    await window.api.labour.painting.deleteTeam(id);
    showToast('Deleted', 'success'); await refreshLabourSub();
}

function showPaintingEntryModal(teamId, teamName) {
    document.getElementById('paintingEntryTeamId').value = teamId;
    document.getElementById('paintingEntryTeamName').textContent = teamName;
    document.getElementById('paintingEntryDate').value = todayDate();
    document.getElementById('paintingEntryWorker').value = '';
    document.getElementById('paintingEntryShift').value = '1';
    document.getElementById('paintingEntryWage').value = '';
    document.getElementById('paintingEntrySqft').value = '0';
    showModal('paintingEntryModal');
}

async function savePaintingEntry() {
    const teamId = document.getElementById('paintingEntryTeamId').value;
    const date   = document.getElementById('paintingEntryDate').value;
    const worker = document.getElementById('paintingEntryWorker').value.trim();
    const shift  = parseFloat(document.getElementById('paintingEntryShift').value);
    const wage   = parseFloat(document.getElementById('paintingEntryWage').value)||0;
    const sqft   = parseFloat(document.getElementById('paintingEntrySqft').value)||0;
    if (!date || !worker || isNaN(shift)) { showToast('Fill required fields', 'warning'); return; }
    showLoading();
    const res = await window.api.labour.painting.addEntry({ teamId, projectId: AppState.currentProject._id, date, workerName: worker, shiftCount: shift, wageAmount: wage, sqftCompleted: sqft });
    hideLoading();
    if (res.success) { hideModal('paintingEntryModal'); showToast('Saved', 'success'); await refreshLabourSub(); }
    else showToast('Failed', 'danger');
}

async function showPaintingEntries(teamId) {
    const container = document.getElementById(`painting-entries-${teamId}`);
    if (!container) return;
    if (container.style.display !== 'none') { container.style.display = 'none'; return; }
    container.style.display = 'block';
    const res = await window.api.labour.painting.getEntries(teamId);
    const entries = res.success ? res.data : [];
    if (!entries.length) { container.innerHTML = '<p class="text-muted text-center" style="padding:.75rem;">No entries.</p>'; return; }
    container.innerHTML = `<div class="entry-table-wrap"><table>
        <thead><tr><th>Date</th><th>Name</th><th>Shifts</th><th>Sq.ft</th><th>Wage</th><th></th></tr></thead>
        <tbody>${entries.map(e => `<tr>
            <td>${fmtDate(e.date)}</td><td>${esc(e.workerName)}</td>
            <td>${e.shiftCount}</td><td>${e.sqftCompleted||0}</td><td>${fmt(e.wageAmount)}</td>
            <td><button class="btn btn-sm btn-danger" onclick="deletePaintingEntry('${e._id}','${teamId}')"><i class="ph ph-trash"></i></button></td>
        </tr>`).join('')}</tbody>
    </table></div>`;
}

async function deletePaintingEntry(entryId, teamId) {
    if (!confirm('Delete?')) return;
    await window.api.labour.painting.deleteEntry(entryId);
    showToast('Deleted', 'success');
    const c = document.getElementById(`painting-entries-${teamId}`);
    if (c) { c.style.display = 'none'; await showPaintingEntries(teamId); }
}

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
    const proj = window.AppState.currentProject;
    const body = document.getElementById('labour-sub-body');
    if (!body) { await navigateTo('labour'); return; }
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
    // Replace only the sub-body + re-init tabs
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const newBody = tmp.querySelector('#labour-sub-body');
    if (newBody) body.innerHTML = newBody.innerHTML;
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
// Masonry
window.showMasonryTeamModal  = showMasonryTeamModal;
window.saveMasonryTeam       = saveMasonryTeam;
window.deleteMasonryTeam     = deleteMasonryTeam;
window.showMasonryEntryModal = showMasonryEntryModal;
window.saveMasonryEntry      = saveMasonryEntry;
window.showMasonryEntries    = showMasonryEntries;
window.deleteMasonryEntry    = deleteMasonryEntry;
// Centring
window.showCentringTeamModal  = showCentringTeamModal;
window.saveCentringTeam       = saveCentringTeam;
window.deleteCentringTeam     = deleteCentringTeam;
window.showCentringEntryModal = showCentringEntryModal;
window.saveCentringEntry      = saveCentringEntry;
window.showCentringEntries    = showCentringEntries;
window.deleteCentringEntry    = deleteCentringEntry;
// Concrete
window.showConcreteModal   = showConcreteModal;
window.saveConcreteEntry   = saveConcreteEntry;
window.deleteConcreteEntry = deleteConcreteEntry;
// E&P
window.showEPModal   = showEPModal;
window.saveEPEntry   = saveEPEntry;
window.deleteEPEntry = deleteEPEntry;
// Tiles
window.showTilesModal   = showTilesModal;
window.saveTilesEntry   = saveTilesEntry;
window.deleteTilesEntry = deleteTilesEntry;
// Painting
window.showPaintingTeamModal  = showPaintingTeamModal;
window.savePaintingTeam       = savePaintingTeam;
window.deletePaintingTeam     = deletePaintingTeam;
window.showPaintingEntryModal = showPaintingEntryModal;
window.savePaintingEntry      = savePaintingEntry;
window.showPaintingEntries    = showPaintingEntries;
window.deletePaintingEntry    = deletePaintingEntry;
// Report
window.printLabourReport = printLabourReport;