// ============================================================
// LABOUR MODULE — Full Labour Management System
// Sub-modules: Masonry, Centring, Concrete, E&P, Tiles, Painting
// ============================================================

// ── Sub-module router ─────────────────────────────────────────
async function loadLabourView() {
    const sub = window._labourSub || 'masonry';
    // Pre-load settings
    if (window.AppState && window.AppState.currentProject) {
        const res = await window.api.labour.getSettings(window.AppState.currentProject._id);
        if (res.success) window._labourSettings = res.data;
    }
    return loadLabourSubView(sub);
}

async function loadLabourSubView(sub) {
    window._labourSub = sub;
    const proj = window.AppState.currentProject;
    if (!proj) return '<div class="alert alert-warning">No project selected.</div>';

    switch (sub) {
        case 'masonry': return await loadMasonryView(proj._id);
        case 'centring': return await loadCentringView(proj._id);
        case 'concrete': return await loadConcreteView(proj._id);
        case 'ep': return await loadEPView(proj._id);
        case 'tiles': return await loadTilesView(proj._id);
        case 'painting': return await loadPaintingView(proj._id);
        case 'report': return await loadLabourReport(proj._id);
        default: return await loadMasonryView(proj._id);
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
        </div>
        ${labourSettingsModal()}
        ${labourManageMembersModal()}
    `;
}

// ════════════════════════════════════════════════════════════
// 1 — MASONRY
// ════════════════════════════════════════════════════════════

// ── Helper: deduplicate worker names case-insensitively ──────
function uniqueWorkerNames(entries) {
    const seen = new Set();
    const names = [];
    for (const e of (entries || [])) {
        const raw = String(e.workerName || '').trim();
        const key = raw.toLowerCase();
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
            <div class="flex gap-sm">
                <button class="btn btn-outline btn-sm" onclick="showLabourSettingsModal()">
                    <i class="ph ph-gear"></i> Settings
                </button>
                <button class="btn btn-primary btn-sm" onclick="showMasonryTeamModal()">
                    <i class="ph ph-plus"></i> New Team
                </button>
            </div>
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
    const entries = team.entries || [];
    const totalShifts = entries.reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);
    const totalCost = entries.reduce((s, e) => s + parseFloat(e.wageAmount || 0), 0);

    // Unique members (case-insensitive)
    const uniqueNames = uniqueWorkerNames(entries);
    const workerCount = uniqueNames.length;

    // Member pills — show all unique names
    const memberPills = uniqueNames.length > 0
        ? `<div class="team-member-pills">
            ${uniqueNames.map(n => `<span class="team-member-pill">${esc(n)}</span>`).join('')}
           </div>`
        : `<p class="team-no-members">No members recorded yet</p>`;

    return `
        <div class="team-card team-card-clickable"
             onclick="openMasonryTeamDetail('${team._id}', '${esc(team.teamName)}', '${esc(team.paymentType || 'daily')}')">
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
    window._masonryDetailTeamId = teamId;
    window._masonryDetailTeamName = teamName;
    window._masonryDetailPayType = paymentType;

    // Show loading in whatever container is available
    const viewContainer = document.getElementById('view-container');
    const subBody = document.getElementById('labour-sub-body');
    const target = subBody || viewContainer;
    if (!target) return;

    target.innerHTML = '<div class="labour-loading" style="padding:3rem;"><div class="labour-spin"></div><span>Loading team…</span></div>';

    const teamRes = await window.api.labour.masonry.getTeams(AppState.currentProject._id);
    const team = teamRes.success ? teamRes.data.find(t => t._id === teamId) : null;
    const res = await window.api.labour.masonry.getEntries(teamId);
    const entries = res.success ? res.data : [];

    // Render detail page — wraps in labour-page so back-nav restores correctly
    const html = `<div class="labour-page animate-fade-in">
        <div id="labour-sub-body" class="labour-sub-body">
            ${masonryDetailPage(teamId, teamName, paymentType, entries, team)}
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

function masonryDetailPage(teamId, teamName, paymentType, entries, team) {
    // ── Summary stats ──
    const totalShifts = entries.reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);
    const totalCost = entries.reduce((s, e) => s + parseFloat(e.wageAmount || 0), 0);
    const masonCount = entries.filter(e => e.workerRole === 'Mason').length;
    const menCount = entries.filter(e => e.workerRole === 'Men Helper').length;
    const womenCount = entries.filter(e => e.workerRole === 'Women Helper').length;
    const uniqueNames = uniqueWorkerNames(entries);

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
                <td><span class="role-badge role-${(e.workerRole || '').toLowerCase().replace(/\s+/g, '-')}">${esc(e.workerRole)}</span></td>
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
            <div class="flex gap-sm">
                <button class="btn btn-outline btn-sm"
                        onclick="showManageMembersModal('masonry', '${teamId}', '${esc(teamName)}', '${esc(JSON.stringify(team?.members || []))}')">
                    <i class="ph ph-users"></i> Manage Members
                </button>
                <button class="btn btn-primary btn-sm"
                        onclick="showMasonryEntryModalFromDetail('${teamId}','${esc(teamName)}', '${esc(JSON.stringify(team?.members || []))}')">
                    <i class="ph ph-plus"></i> Add Entry
                </button>
            </div>
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
                        <select id="masonryEntryRole" class="form-select" onchange="updateEntryRoleWage(this.value, 'masonryEntryWage')">
                            <option value="Mason">Mason</option>
                            <option value="Men Helper">Men Helper</option>
                            <option value="Women Helper">Women Helper</option>
                            <option value="Worker">Worker</option>
                        </select>
                    </div>
                </div>
                <div id="masonryAttendanceGridArea" style="margin-bottom:1.5rem;"></div>
                
                <div id="masonryIndividualEntryArea">
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
                        <div class="form-group" style="display:none;">
                            <label class="form-label">Wage Amount (₹)</label>
                            <input type="number" id="masonryEntryWage" class="form-input"
                                   step="0.01" min="0" placeholder="Amount paid" />
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Notes (optional)</label>
                    <input type="text" id="masonryEntryNotes" class="form-input" placeholder="Any remarks" />
                </div>
                <div class="flex gap">
                    <button class="btn btn-outline" onclick="hideModal('masonryEntryModal')">Cancel</button>
                    <button class="btn btn-primary" id="masonrySaveBtn" onclick="saveMasonryEntryFromDetail()">
                        <i class="ph ph-check"></i> Save Entry
                    </button>
                    <button class="btn btn-primary" id="masonryBulkSaveBtn" style="display:none;" onclick="saveMasonryBulkAttendance()">
                        <i class="ph ph-check"></i> Save Attendance
                    </button>
                </div>
            </div>
        </div>`;
}

// ── Navigation helpers ───────────────────────────────────────
function backToMasonryList() {
    window._masonryDetailTeamId = null;
    window._masonryDetailTeamName = null;
    window._masonryDetailPayType = null;
    refreshLabourSub();
}

function showMasonryEntryModalFromDetail(teamId, teamName, membersJson) {
    const members = membersJson ? JSON.parse(membersJson) : [];
    const tidEl = document.getElementById('masonryEntryTeamId');
    const tnEl = document.getElementById('masonryEntryTeamName');
    const dateEl = document.getElementById('masonryEntryDate');
    const wkrEl = document.getElementById('masonryEntryWorker');
    const shEl = document.getElementById('masonryEntryShift');
    const wgEl = document.getElementById('masonryEntryWage');
    const ntEl = document.getElementById('masonryEntryNotes');

    if (tidEl) tidEl.value = teamId;
    if (tnEl) tnEl.value = teamName;
    if (dateEl) dateEl.value = todayDate();
    if (wkrEl) wkrEl.value = '';
    if (shEl) shEl.value = '1';
    if (wgEl) wgEl.value = '';
    if (ntEl) ntEl.value = '';

    // Attendance grid for members
    const gridArea = document.getElementById('masonryAttendanceGridArea');
    const individualArea = document.getElementById('masonryIndividualEntryArea');
    const saveBtn = document.getElementById('masonrySaveBtn');
    const bulkSaveBtn = document.getElementById('masonryBulkSaveBtn');

    if (members.length > 0) {
        gridArea.style.display = 'block';
        individualArea.style.display = 'none';
        saveBtn.style.display = 'none';
        bulkSaveBtn.style.display = 'block';

        let gridHtml = `
            <table class="attendance-table">
                <thead>
                    <tr><th></th><th>Role</th><th>Shift</th><th>Wage (₹)</th></tr>
                </thead>
                <tbody>`;
        members.forEach((m, idx) => {
            gridHtml += `
                <tr>
                    <td>
                        <label class="flex items-center gap-xs" style="cursor:pointer; margin:0;">
                            <input type="checkbox" class="masonry-member-present" checked onchange="toggleMasonryMemberShift(this)" />
                            <span style="font-size:.85rem;font-weight:600;">${esc(m.name)}</span>
                        </label>
                    </td>
                    <td>
                        <select class="form-select sm masonry-member-role" data-idx="${idx}" onchange="updateMasonryGridWage(this)">
                            <option value="Mason" ${m.role === 'Mason' ? 'selected' : ''}>Mason</option>
                            <option value="Men Helper" ${m.role === 'Men Helper' ? 'selected' : ''}>Men Helper</option>
                            <option value="Women Helper" ${m.role === 'Women Helper' ? 'selected' : ''}>Women Helper</option>
                        </select>
                    </td>
                    <td><input type="number" class="form-input sm masonry-member-shift" data-name="${esc(m.name)}" step="0.5" min="0" value="1" /></td>
                    <td style="display:none;"><input type="number" class="form-input sm masonry-member-wage" step="1" min="0" value="${m.wage || ''}" placeholder="Wage" /></td>
                </tr>`;
        });
        gridHtml += `</tbody></table>
            <div style="margin-top:1rem; text-align:center;">
                <button class="btn btn-sm btn-outline" onclick="toggleMasonryManualEntry()">
                    <i class="ph ph-plus"></i> Add Extra Person (Not in list)
                </button>
            </div>`;
        gridArea.innerHTML = gridHtml;
    } else {
        gridArea.style.display = 'none';
        individualArea.style.display = 'block';
        saveBtn.style.display = 'block';
        bulkSaveBtn.style.display = 'none';
    }

    showModal('masonryEntryModal');
}

function toggleMasonryManualEntry() {
    const individualArea = document.getElementById('masonryIndividualEntryArea');
    const saveBtn = document.getElementById('masonrySaveBtn');
    individualArea.style.display = individualArea.style.display === 'none' ? 'block' : 'none';
    saveBtn.style.display = saveBtn.style.display === 'none' ? 'block' : 'none';
}

async function saveMasonryBulkAttendance() {
    const teamId = document.getElementById('masonryEntryTeamId').value;
    const date = document.getElementById('masonryEntryDate').value;
    const notes = document.getElementById('masonryEntryNotes').value.trim();

    if (!date) { showToast('Select a date', 'warning'); return; }

    const rows = document.querySelectorAll('#masonryAttendanceGridArea tbody tr');
    const entries = [];
    rows.forEach(row => {
        const nameInput = row.querySelector('.masonry-member-shift');
        const name = nameInput.dataset.name;
        const role = row.querySelector('.masonry-member-role').value;
        const shift = parseFloat(nameInput.value) || 0;
        const wage = getRoleWage(role);

        if (shift > 0) {
            entries.push({
                teamId, projectId: AppState.currentProject._id,
                date, workerName: name, workerRole: role,
                shiftCount: shift, wageAmount: wage, notes
            });
        }
    });

    if (entries.length === 0) { showToast('No attendance marked', 'warning'); return; }

    showLoading();
    let successCount = 0;
    for (const entry of entries) {
        const res = await window.api.labour.masonry.addEntry(entry);
        if (res.success) successCount++;
    }
    hideLoading();

    showToast(`Saved attendance for ${successCount} workers`, 'success');
    hideModal('masonryEntryModal');
    await openMasonryTeamDetail(teamId, window._masonryDetailTeamName, window._masonryDetailPayType);
}

async function saveMasonryEntryFromDetail() {
    const teamId = document.getElementById('masonryEntryTeamId').value;
    const date = document.getElementById('masonryEntryDate').value;
    const worker = document.getElementById('masonryEntryWorker').value.trim();
    const role = document.getElementById('masonryEntryRole').value;
    const shift = parseFloat(document.getElementById('masonryEntryShift').value);
    const wage = getRoleWage(role);
    const notes = document.getElementById('masonryEntryNotes').value.trim();

    if (!date || !worker) { showToast('Fill date and worker name', 'warning'); return; }
    if (isNaN(shift) || shift <= 0) { showToast('Enter valid shift count', 'warning'); return; }

    showLoading();
    const res = await window.api.labour.masonry.addEntry({
        teamId,
        projectId: AppState.currentProject._id,
        date, workerName: worker, workerRole: role,
        shiftCount: shift, wageAmount: getRoleWage(role), notes
    });
    hideLoading();

    if (res.success) {
        hideModal('masonryEntryModal');
        showToast('Entry saved', 'success');
        // Reload detail page with fresh data
        const teamName = window._masonryDetailTeamName || '';
        const payType = window._masonryDetailPayType || 'daily';
        await openMasonryTeamDetail(teamId, teamName, payType);
    } else {
        showToast('Failed: ' + res.message, 'danger');
    }
}

function updateEntryRoleWage(role, wageInputId) {
    const wageInput = document.getElementById(wageInputId);
    if (!wageInput) return;
    const settings = window._labourSettings || { masonWage: 800, menHelperWage: 700, womenHelperWage: 600 };
    if (role === 'Mason') wageInput.value = settings.masonWage;
    else if (role === 'Men Helper') wageInput.value = settings.menHelperWage;
    else if (role === 'Women Helper') wageInput.value = settings.womenHelperWage;
}

function toggleMasonryMemberShift(checkbox) {
    const row = checkbox.closest('tr');
    const shiftInput = row.querySelector('.masonry-member-shift');
    if (shiftInput) shiftInput.value = checkbox.checked ? '1' : '0';
}

function updateMasonryGridWage(selectEl) {
    const role = selectEl.value;
    const row = selectEl.closest('tr');
    const wageInput = row.querySelector('.masonry-member-wage');
    wageInput.value = getRoleWage(role);
}

function getRoleWage(role) {
    const settings = window._labourSettings || {};
    const m = parseFloat(settings.masonWage) || 800;
    const mh = parseFloat(settings.menHelperWage) || 700;
    const wh = parseFloat(settings.womenHelperWage) || 600;
    const w = parseFloat(settings.workerWage) || mh || 700;

    if (role === 'Mason') return m;
    if (role === 'Men Helper') return mh;
    if (role === 'Women Helper') return wh;
    if (role === 'Worker') return w;
    return mh;
}

async function deleteMasonryEntryFromDetail(entryId) {
    if (!confirm('Delete this entry?')) return;
    const teamId = window._masonryDetailTeamId || '';
    const teamName = window._masonryDetailTeamName || '';
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
    const name = document.getElementById('masonryTeamName').value.trim();
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

async function openCentringTeamDetail(teamId, teamName, paymentType) {
    window._centringDetailTeamId = teamId;
    window._centringDetailTeamName = teamName;
    window._centringDetailPayType = paymentType;

    const viewContainer = document.getElementById('view-container');
    const subBody = document.getElementById('labour-sub-body');
    const target = subBody || viewContainer;
    if (!target) return;

    target.innerHTML = '<div class="labour-loading" style="padding:3rem;"><div class="labour-spin"></div><span>Loading team…</span></div>';

    const teamRes = await window.api.labour.centring.getTeams(AppState.currentProject._id);
    const team = teamRes.success ? teamRes.data.find(t => t._id === teamId) : null;
    const res = await window.api.labour.centring.getEntries(teamId);
    const entries = res.success ? res.data : [];

    const html = `<div class="labour-page animate-fade-in">
        <div id="labour-sub-body" class="labour-sub-body">
            ${centringDetailPage(teamId, teamName, paymentType, entries, team)}
        </div>
    </div>`;

    if (viewContainer) viewContainer.innerHTML = html;
    else target.innerHTML = centringDetailPage(teamId, teamName, paymentType, entries, team);
}

function centringDetailPage(teamId, teamName, paymentType, entries, team) {
    const totalShifts = entries.reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);
    const totalCost = entries.reduce((s, e) => s + parseFloat(e.wageAmount || 0), 0);
    const totalSqft = entries.reduce((s, e) => s + parseFloat(e.sqftCompleted || 0), 0);
    const uniqueNames = uniqueWorkerNames(entries);

    const tableRows = entries.length === 0
        ? `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">No entries yet.</td></tr>`
        : [...entries].sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => `
            <tr>
                <td>${fmtDate(e.date)}</td>
                <td><strong>${esc(e.workerName)}</strong></td>
                <td><strong style="font-family:var(--font-mono,monospace);">${e.shiftCount}</strong></td>
                <td>${esc(e.sqftCompleted || '0')}</td>
                <td style="font-family:var(--font-mono,monospace);">${fmt(e.wageAmount)}</td>
                <td style="color:var(--text-muted);font-size:.8rem;">${esc(e.notes || '—')}</td>
                <td><button class="btn btn-sm btn-danger" onclick="deleteCentringEntryFromDetail('${e._id}')"><i class="ph ph-trash"></i></button></td>
            </tr>`).join('');

    return `
        <div class="detail-page-header">
            <button class="btn btn-outline btn-sm" onclick="backToCentringList()"><i class="ph ph-arrow-left"></i> All Teams</button>
            <div class="detail-page-title">
                <div class="team-card-avatar" style="width:36px;height:36px;font-size:1rem;"><i class="ph ph-columns"></i></div>
                <div>
                    <h3 style="margin:0;font-size:1rem;font-weight:700;color:var(--text-primary);">${esc(teamName)}</h3>
                    <span class="team-card-meta">${paymentType === 'sqft' ? 'Per Sq.ft' : 'Daily Wage'}</span>
                </div>
            </div>
            <div class="flex gap-sm">
                <button class="btn btn-outline btn-sm" onclick="showManageMembersModal('centring', '${teamId}', '${esc(teamName)}', '${esc(JSON.stringify(team?.members || []))}')">
                    <i class="ph ph-users"></i> Manage Members
                </button>
                <button class="btn btn-primary btn-sm" onclick="showCentringEntryModalFromDetail('${teamId}','${esc(teamName)}', '${esc(JSON.stringify(team?.members || []))}')">
                    <i class="ph ph-plus"></i> Add Entry
                </button>
            </div>
        </div>
        <div class="detail-stats-strip">
            <div class="detail-stat"><span class="tcs-label">Entries</span><span class="tcs-val">${entries.length}</span></div>
            <div class="detail-stat"><span class="tcs-label">Shifts</span><span class="tcs-val">${totalShifts}</span></div>
            <div class="detail-stat"><span class="tcs-label">Sq Ft</span><span class="tcs-val">${totalSqft}</span></div>
            <div class="detail-stat"><span class="tcs-label">Total Cost</span><span class="tcs-val" style="color:var(--success);">${fmt(totalCost)}</span></div>
        </div>
        ${uniqueNames.length > 0 ? `<div class="detail-members-section"><div class="team-member-pills">
            ${uniqueNames.map(n => `<span class="team-member-pill">${esc(n)}</span>`).join('')}
        </div></div>` : ''}
        <div class="detail-table-section">
            <div class="entry-table-wrap">
                <table>
                    <thead><tr><th>Date</th><th>Worker</th><th>Shifts</th><th>Sq Ft</th><th>Wage</th><th>Notes</th><th></th></tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        </div>
        <div id="centringEntryModal" class="modal">
            <div class="modal-content" style="max-width:480px;">
                <div class="modal-header">
                    <h3 class="modal-title">Add Entry — <span style="color:var(--brand);">${esc(teamName)}</span></h3>
                    <button class="modal-close" onclick="hideModal('centringEntryModal')"><i class="ph ph-x"></i></button>
                </div>
                <input type="hidden" id="centringEntryTeamId" value="${teamId}" />
                <div class="form-group"><label class="form-label">Date</label><input type="date" id="centringEntryDate" class="form-input" value="${todayDate()}" /></div>
                
                <div id="centringAttendanceGridArea" style="margin-bottom:1.5rem;"></div>

                <div id="centringIndividualEntryArea">
                    <div class="form-group"><label class="form-label">Worker Name</label><input type="text" id="centringEntryWorker" class="form-input" placeholder="Worker name" /></div>
                    <div class="grid grid-3 gap">
                        <div class="form-group"><label class="form-label">Shifts</label><input type="number" id="centringEntryShift" class="form-input" step="0.5" value="1" /></div>
                        <div class="form-group"><label class="form-label">Sq Ft</label><input type="number" id="centringEntrySqft" class="form-input" value="0" /></div>
                        <div class="form-group"><label class="form-label">Wage</label><input type="number" id="centringEntryWage" class="form-input" /></div>
                    </div>
                </div>

                <div class="form-group"><label class="form-label">Notes</label><input type="text" id="centringEntryNotes" class="form-input" /></div>
                <div class="flex gap">
                    <button class="btn btn-outline" onclick="hideModal('centringEntryModal')">Cancel</button>
                    <button class="btn btn-primary" id="centringSaveBtn" onclick="saveCentringEntryFromDetail()"><i class="ph ph-check"></i> Save Entry</button>
                    <button class="btn btn-primary" id="centringBulkSaveBtn" style="display:none;" onclick="saveCentringBulkAttendance()"><i class="ph ph-check"></i> Save Attendance</button>
                </div>
            </div>
        </div>`;
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
            <div class="flex gap-sm">
                <button class="btn btn-outline btn-sm" onclick="showLabourSettingsModal()">
                    <i class="ph ph-gear"></i> Settings
                </button>
                <button class="btn btn-primary btn-sm" onclick="showCentringTeamModal()">
                    <i class="ph ph-plus"></i> New Team
                </button>
            </div>
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
    const entries = team.entries || [];
    const totalShifts = entries.reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);
    const totalCost = entries.reduce((s, e) => s + parseFloat(e.wageAmount || 0), 0);
    const uniqueNames = uniqueWorkerNames(entries);
    const workerCount = uniqueNames.length;

    const memberPills = uniqueNames.length > 0
        ? `<div class="team-member-pills">${uniqueNames.map(n => `<span class="team-member-pill">${esc(n)}</span>`).join('')}</div>`
        : `<p class="team-no-members">No members recorded yet</p>`;

    return `
        <div class="team-card team-card-clickable"
             onclick="openCentringTeamDetail('${team._id}','${esc(team.teamName)}','${esc(team.paymentType || 'daily')}')">
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
    window._centringDetailTeamId = teamId;
    window._centringDetailTeamName = teamName;
    window._centringDetailPayType = paymentType;

    const viewContainer = document.getElementById('view-container');
    const subBody = document.getElementById('labour-sub-body');
    const target = subBody || viewContainer;
    if (!target) return;

    target.innerHTML = '<div class="labour-loading" style="padding:3rem;"><div class="labour-spin"></div><span>Loading team…</span></div>';

    const res = await window.api.labour.centring.getEntries(teamId);
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

async function openCentringTeamDetail(teamId, teamName, paymentType) {
    window._centringDetailTeamId = teamId;
    window._centringDetailTeamName = teamName;
    window._centringDetailPayType = paymentType;

    const viewContainer = document.getElementById('view-container');
    const subBody = document.getElementById('labour-sub-body');
    const target = subBody || viewContainer;
    if (!target) return;

    target.innerHTML = '<div class="labour-loading" style="padding:3rem;"><div class="labour-spin"></div><span>Loading team…</span></div>';

    const teamRes = await window.api.labour.centring.getTeams(AppState.currentProject._id);
    const team = teamRes.success ? teamRes.data.find(t => t._id === teamId) : null;
    const res = await window.api.labour.centring.getEntries(teamId);
    const entries = res.success ? res.data : [];

    // Render detail page
    const html = `<div class="labour-page animate-fade-in">
        <div id="labour-sub-body" class="labour-sub-body">
            ${centringDetailPage(teamId, teamName, paymentType, entries, team)}
        </div>
    </div>`;

    if (viewContainer) viewContainer.innerHTML = html;
    else target.innerHTML = centringDetailPage(teamId, teamName, paymentType, entries, team);
}

function centringDetailPage(teamId, teamName, paymentType, entries, team) {
    const totalShifts = entries.reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);
    const totalCost = entries.reduce((s, e) => s + parseFloat(e.wageAmount || 0), 0);
    const totalSqft = entries.reduce((s, e) => s + parseFloat(e.sqftCompleted || 0), 0);
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
            <div class="flex gap-sm">
                <button class="btn btn-outline btn-sm"
                        onclick="showManageMembersModal('centring', '${teamId}', '${esc(teamName)}', '${esc(JSON.stringify(team?.members || []))}')">
                    <i class="ph ph-users"></i> Manage Members
                </button>
                <button class="btn btn-primary btn-sm"
                        onclick="showCentringEntryModalFromDetail('${teamId}','${esc(teamName)}','${esc(paymentType)}', '${esc(JSON.stringify(team?.members || []))}')">
                    <i class="ph ph-plus"></i> Add Entry
                </button>
            </div>
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
                <div id="centringAttendanceGridArea" style="margin-bottom:1.5rem;"></div>

                <div id="centringIndividualEntryArea">
                    <div class="grid grid-2 gap">
                        <div class="form-group">
                            <label class="form-label">Date</label>
                            <input type="date" id="centringEntryDate" class="form-input" value="${todayDate()}" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Worker Role</label>
                            <select id="centringEntryRole" class="form-select" onchange="updateEntryRoleWage(this.value, 'centringEntryWage')">
                                <option value="Mason">Mason</option>
                                <option value="Men Helper">Men Helper</option>
                                <option value="Women Helper">Women Helper</option>
                                <option value="Worker">Worker</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Worker Name</label>
                        <input type="text" id="centringEntryWorker" class="form-input" placeholder="Worker name" />
                    </div>
                    <div class="grid grid-2 gap">
                        <div class="form-group">
                            <label class="form-label">Shift Count <span class="lbadge">attendance</span></label>
                            <input type="number" id="centringEntryShift" class="form-input" step="0.5" min="0.5" value="1" />
                        </div>
                        <div class="form-group" style="display:none;">
                            <label class="form-label">Wage Amount (₹)</label>
                            <input type="number" id="centringEntryWage" class="form-input" step="0.01" min="0" />
                        </div>
                    </div>
                    <div class="form-group" id="centringEntryQtyGroup"
                         style="display:${paymentType === 'sqft' ? 'block' : 'none'}">
                        <label class="form-label">Sq.ft Completed</label>
                        <input type="number" id="centringEntrySqft" class="form-input" step="0.01" min="0" value="0" />
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Notes (optional)</label>
                    <input type="text" id="centringEntryNotes" class="form-input" placeholder="Any remarks" />
                </div>

                <div class="flex gap">
                    <button class="btn btn-outline" onclick="hideModal('centringEntryModal')">Cancel</button>
                    <button class="btn btn-primary" id="centringSaveBtn" onclick="saveCentringEntryFromDetail()">
                        <i class="ph ph-check"></i> Save Entry
                    </button>
                    <button class="btn btn-primary" id="centringBulkSaveBtn" style="display:none;" onclick="saveCentringBulkAttendance()">
                        <i class="ph ph-check"></i> Save Attendance
                    </button>
                </div>
            </div>
        </div>`;
}

// ── Navigation helpers ───────────────────────────────────────
function backToCentringList() {
    window._centringDetailTeamId = null;
    window._centringDetailTeamName = null;
    window._centringDetailPayType = null;
    refreshLabourSub();
}

function showCentringEntryModalFromDetail(teamId, teamName, paymentType, membersJson) {
    const members = membersJson ? JSON.parse(membersJson) : [];
    const dateEl = document.getElementById('centringEntryDate');
    const wkrEl = document.getElementById('centringEntryWorker');
    const shEl = document.getElementById('centringEntryShift');
    const wgEl = document.getElementById('centringEntryWage');
    const sqEl = document.getElementById('centringEntrySqft');
    const qtyGrp = document.getElementById('centringEntryQtyGroup');
    const ntEl = document.getElementById('centringEntryNotes');

    if (dateEl) dateEl.value = todayDate();
    if (wkrEl) wkrEl.value = '';
    if (shEl) shEl.value = '1';
    if (wgEl) wgEl.value = '';
    if (sqEl) sqEl.value = '0';
    if (ntEl) ntEl.value = '';
    if (qtyGrp) qtyGrp.style.display = (paymentType === 'sqft') ? 'block' : 'none';

    // Attendance grid
    const gridArea = document.getElementById('centringAttendanceGridArea');
    const individualArea = document.getElementById('centringIndividualEntryArea');
    const saveBtn = document.getElementById('centringSaveBtn');
    const bulkSaveBtn = document.getElementById('centringBulkSaveBtn');

    if (members.length > 0) {
        gridArea.style.display = 'block';
        individualArea.style.display = 'none';
        saveBtn.style.display = 'none';
        bulkSaveBtn.style.display = 'block';

        let gridHtml = `
            <table class="attendance-table">
                <thead>
                    <tr><th></th><th>Role</th><th>Shift</th>${paymentType === 'sqft' ? '<th>Sq.ft</th>' : ''}<th>Wage</th></tr>
                </thead>
                <tbody>`;
        members.forEach((m, idx) => {
            gridHtml += `
                <tr>
                    <td>
                        <label class="flex items-center gap-xs" style="cursor:pointer; margin:0;">
                            <input type="checkbox" class="centring-member-present" checked onchange="toggleCentringMemberShift(this)" />
                            <span style="font-size:.85rem;font-weight:600;">${esc(m.name)}</span>
                        </label>
                    </td>
                    <td>
                        <select class="form-select sm centring-member-role" data-idx="${idx}" onchange="updateCentringGridWage(this)">
                            <option value="Mason" ${m.role === 'Mason' ? 'selected' : ''}>Mason</option>
                            <option value="Men Helper" ${m.role === 'Men Helper' ? 'selected' : ''}>Men Helper</option>
                            <option value="Women Helper" ${m.role === 'Women Helper' ? 'selected' : ''}>Women Helper</option>
                            <option value="Worker" ${m.role === 'Worker' ? 'selected' : ''}>Worker</option>
                        </select>
                    </td>
                    <td><input type="number" class="form-input sm centring-member-shift" data-name="${esc(m.name)}" step="0.5" min="0" value="1" /></td>
                    ${paymentType === 'sqft' ? `<td><input type="number" class="form-input sm centring-member-sqft" value="0" /></td>` : ''}
                    <td style="display:none;"><input type="number" class="form-input sm centring-member-wage" step="1" min="0" value="${m.wage || ''}" placeholder="Wage" /></td>
                </tr>`;
        });
        gridHtml += `</tbody></table>
            <div style="margin-top:1rem; text-align:center;">
                <button class="btn btn-sm btn-outline" onclick="toggleCentringManualEntry()">
                    <i class="ph ph-plus"></i> Add Extra Person
                </button>
            </div>`;
        gridArea.innerHTML = gridHtml;
    } else {
        gridArea.style.display = 'none';
        individualArea.style.display = 'block';
        saveBtn.style.display = 'block';
        bulkSaveBtn.style.display = 'none';
    }

    showModal('centringEntryModal');
}

function toggleCentringManualEntry() {
    const individualArea = document.getElementById('centringIndividualEntryArea');
    const saveBtn = document.getElementById('centringSaveBtn');
    individualArea.style.display = individualArea.style.display === 'none' ? 'block' : 'none';
    saveBtn.style.display = saveBtn.style.display === 'none' ? 'block' : 'none';
}

async function saveCentringBulkAttendance() {
    const teamId = document.getElementById('centringEntryTeamId').value;
    const date = document.getElementById('centringEntryDate').value;
    const notes = document.getElementById('centringEntryNotes').value.trim();
    const payType = window._centringDetailPayType || 'daily';

    if (!date) { showToast('Select a date', 'warning'); return; }

    const rows = document.querySelectorAll('#centringAttendanceGridArea tbody tr');
    const entries = [];
    rows.forEach(row => {
        const nameInput = row.querySelector('.centring-member-shift');
        const name = nameInput.dataset.name;
        const role = row.querySelector('.centring-member-role').value;
        const shift = parseFloat(nameInput.value) || 0;
        const wage = parseFloat(row.querySelector('.centring-member-wage').value) || 0;
        const sqftInput = row.querySelector('.centring-member-sqft');
        const sqft = sqftInput ? parseFloat(sqftInput.value) || 0 : 0;

        if (shift > 0) {
            entries.push({
                teamId, projectId: AppState.currentProject._id,
                date, workerName: name, workerRole: role,
                shiftCount: shift, wageAmount: getRoleWage(role),
                sqftCompleted: sqft, notes
            });
        }
    });

    if (entries.length === 0) { showToast('No attendance marked', 'warning'); return; }

    showLoading();
    let successCount = 0;
    for (const entry of entries) {
        const res = await window.api.labour.centring.addEntry(entry);
        if (res.success) successCount++;
    }
    hideLoading();

    showToast(`Saved attendance for ${successCount} workers`, 'success');
    hideModal('centringEntryModal');
    await openCentringTeamDetail(teamId, window._centringDetailTeamName, payType);
}

function toggleCentringMemberShift(checkbox) {
    const row = checkbox.closest('tr');
    const shiftInput = row.querySelector('.centring-member-shift');
    if (shiftInput) shiftInput.value = checkbox.checked ? '1' : '0';
}

function updateCentringGridWage(selectEl) {
    const role = selectEl.value;
    const row = selectEl.closest('tr');
    const wageInput = row.querySelector('.centring-member-wage');
    wageInput.value = getRoleWage(role);
}

async function saveCentringEntryFromDetail() {
    const teamId = document.getElementById('centringEntryTeamId').value;
    const date = document.getElementById('centringEntryDate').value;
    const worker = document.getElementById('centringEntryWorker').value.trim();
    const role = document.getElementById('centringEntryRole').value;
    const shift = parseFloat(document.getElementById('centringEntryShift').value);
    const wage = parseFloat(document.getElementById('centringEntryWage').value) || 0;
    const sqft = parseFloat(document.getElementById('centringEntrySqft').value) || 0;

    if (!date || !worker) { showToast('Fill date and worker name', 'warning'); return; }
    if (isNaN(shift) || shift <= 0) { showToast('Enter valid shift count', 'warning'); return; }

    showLoading();
    const res = await window.api.labour.centring.addEntry({
        teamId, projectId: AppState.currentProject._id,
        date, workerName: worker, workerRole: role, shiftCount: shift, wageAmount: getRoleWage(role), sqftCompleted: sqft
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
    const teamId = window._centringDetailTeamId || '';
    const teamName = window._centringDetailTeamName || '';
    const paymentType = window._centringDetailPayType || 'daily';
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
    const res = await window.api.labour.concrete.getTeams(projectId);
    const teams = res.success ? res.data : [];

    let html = `
        <div class="lsub-header">
            <div>
                <h3 class="lsub-title"><i class="ph ph-cylinder"></i> Concrete Teams</h3>
                <p class="lsub-desc">Manage concrete teams and mark daily attendance</p>
            </div>
            <div class="flex gap-sm">
                <button class="btn btn-outline btn-sm" onclick="showLabourSettingsModal()">
                    <i class="ph ph-gear"></i> Settings
                </button>
                <button class="btn btn-primary btn-sm" onclick="showConcreteTeamModal()">
                    <i class="ph ph-plus"></i> New Team
                </button>
            </div>
        </div>`;

    if (teams.length === 0) {
        html += emptyState('ph-cylinder', 'No Concrete Teams', 'Create your first concrete team to start tracking attendance.', 'showConcreteTeamModal()', 'New Team');
    } else {
        html += '<div class="team-grid">' + teams.map(t => concreteTeamCard(t)).join('') + '</div>';
    }

    html += concreteTeamModal();
    return labourShell('concrete', html);
}

function concreteTeamCard(team) {
    const entries = team.entries || [];
    const totalCost = entries.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const workerCount = (team.members || []).length;

    return `
        <div class="team-card team-card-clickable"
             onclick="openConcreteTeamDetail('${team._id}','${esc(team.teamName)}')">
            <div class="team-card-head">
                <div class="team-card-avatar" style="background:rgba(168,85,247,.15);color:#a855f7;">
                    <i class="ph ph-cylinder"></i>
                </div>
                <div style="flex:1;min-width:0;">
                    <div class="team-card-name">${esc(team.teamName)}</div>
                    <div class="team-card-meta">${entries.length} record(s)</div>
                </div>
                <button class="btn btn-danger btn-sm"
                        onclick="event.stopPropagation(); deleteConcreteTeam('${team._id}','${esc(team.teamName)}')"
                        title="Delete team">
                    <i class="ph ph-trash"></i>
                </button>
            </div>
            <div class="team-card-stats">
                <div class="tcs"><span class="tcs-label">Members</span><span class="tcs-val">${workerCount}</span></div>
                <div class="tcs"><span class="tcs-label">Total Cost</span><span class="tcs-val">${fmt(totalCost)}</span></div>
            </div>
            <div class="team-card-members">
                ${(team.members || []).length > 0
            ? `<div class="team-member-pills">${team.members.map(m => `<span class="team-member-pill">${esc(m.name)}</span>`).join('')}</div>`
            : '<p class="team-no-members">No members tagged</p>'}
            </div>
        </div>`;
}

function concreteTeamModal() {
    return `
    <div id="concreteTeamModal" class="modal">
        <div class="modal-content" style="max-width:400px;">
            <div class="modal-header">
                <h3 class="modal-title">New Concrete Team</h3>
                <button class="modal-close" onclick="hideModal('concreteTeamModal')"><i class="ph ph-x"></i></button>
            </div>
            <div class="form-group">
                <label class="form-label">Team Name</label>
                <input type="text" id="concreteTeamName" class="form-input" placeholder="e.g. Kumar Team" />
            </div>
            <div class="flex gap">
                <button class="btn btn-outline" onclick="hideModal('concreteTeamModal')">Cancel</button>
                <button class="btn btn-primary" onclick="saveConcreteTeam()">Create Team</button>
            </div>
        </div>
    </div>`;
}

async function openConcreteTeamDetail(teamId, teamName) {
    window._concreteDetailTeamId = teamId;
    window._concreteDetailTeamName = teamName;

    const target = document.getElementById('labour-sub-body') || document.getElementById('view-container');
    if (!target) return;

    target.innerHTML = '<div class="labour-loading" style="padding:3rem;"><div class="labour-spin"></div><span>Loading...</span></div>';

    const teamRes = await window.api.labour.concrete.getTeams(AppState.currentProject._id);
    const team = teamRes.success ? teamRes.data.find(t => t._id === teamId) : null;
    const res = await window.api.labour.concrete.getEntries(teamId);
    const entries = res.success ? res.data : [];

    target.innerHTML = `<div class="labour-page animate-fade-in">${concreteDetailPage(teamId, teamName, entries, team)}</div>`;
}

function concreteDetailPage(teamId, teamName, entries, team) {
    const totalShifts = entries.reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);
    const totalCost = entries.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

    const tableRows = entries.length === 0
        ? `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">No records yet.</td></tr>`
        : [...entries].sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => `
            <tr>
                <td>${fmtDate(e.date)}</td>
                <td><strong>${esc(e.workerName || '—')}</strong></td>
                <td><strong style="font-family:var(--font-mono,monospace);">${e.shiftCount}</strong></td>
                <td>${esc(e.paymentType)}</td>
                <td style="font-family:var(--font-mono,monospace);">${fmt(e.amount)}</td>
                <td style="color:var(--text-muted);font-size:.8rem;">${esc(e.notes || '—')}</td>
                <td><button class="btn btn-sm btn-danger" onclick="deleteConcreteEntryFromDetail('${e._id}')"><i class="ph ph-trash"></i></button></td>
            </tr>`).join('');

    return `
        <div class="detail-page-header">
            <button class="btn btn-outline btn-sm" onclick="backToConcreteList()"><i class="ph ph-arrow-left"></i> All Teams</button>
            <div class="detail-page-title">
                <div class="team-card-avatar" style="width:36px;height:36px;font-size:1rem;color:#a855f7;"><i class="ph ph-cylinder"></i></div>
                <h3 style="margin:0;font-size:1rem;font-weight:700;">${esc(teamName)}</h3>
            </div>
            <div class="flex gap-sm">
                <button class="btn btn-outline btn-sm" onclick="showManageMembersModal('concrete', '${teamId}', '${esc(teamName)}', '${esc(JSON.stringify(team?.members || []))}')">
                    <i class="ph ph-users"></i> Manage Members
                </button>
                <button class="btn btn-primary btn-sm" onclick="showConcreteEntryModalFromDetail('${teamId}','${esc(teamName)}', '${esc(JSON.stringify(team?.members || []))}')">
                    <i class="ph ph-plus"></i> Add Entry
                </button>
            </div>
        </div>
        <div class="detail-stats-strip">
            <div class="detail-stat"><span class="tcs-label">Records</span><span class="tcs-val">${entries.length}</span></div>
            <div class="detail-stat"><span class="tcs-label">Total Shifts</span><span class="tcs-val">${totalShifts}</span></div>
            <div class="detail-stat"><span class="tcs-label">Total Cost</span><span class="tcs-val" style="color:var(--success);">${fmt(totalCost)}</span></div>
        </div>
        <div class="detail-table-section">
            <div class="entry-table-wrap">
                <table>
                    <thead><tr><th>Date</th><th>Worker</th><th>Shifts</th><th>Type</th><th>Amount</th><th>Notes</th><th></th></tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        </div>
        <div id="concreteEntryModal" class="modal">
            <div class="modal-content" style="max-width:480px;">
                <div class="modal-header">
                    <h3 class="modal-title">Add Entry — <span style="color:var(--brand);">${esc(teamName)}</span></h3>
                    <button class="modal-close" onclick="hideModal('concreteEntryModal')"><i class="ph ph-x"></i></button>
                </div>
                <div class="grid grid-2 gap">
                    <div class="form-group"><label class="form-label">Date</label><input type="date" id="concreteEntryDate" class="form-input" value="${todayDate()}" /></div>
                    <div class="form-group">
                        <label class="form-label">Worker Role</label>
                        <select id="concreteEntryRole" class="form-select" onchange="updateEntryRoleWage(this.value, 'concreteEntryAmount')">
                            <option value="Mason">Mason</option>
                            <option value="Men Helper">Men Helper</option>
                            <option value="Women Helper">Women Helper</option>
                            <option value="Worker">Worker</option>
                        </select>
                    </div>
                </div>

                <div id="concreteAttendanceGridArea" style="margin-bottom:1.5rem;"></div>

                <div id="concreteIndividualEntryArea">
                    <div class="form-group"><label class="form-label">Worker Name</label><input type="text" id="concreteEntryWorker" class="form-input" placeholder="Name" /></div>
                    <div class="grid grid-3 gap">
                        <div class="form-group"><label class="form-label">Shifts</label><input type="number" id="concreteEntryShift" class="form-input" step="0.5" value="1" /></div>
                        <div class="form-group"><label class="form-label">Pay Type</label><select id="concretePayType" class="form-select"><option value="Lump Sum">Lump Sum</option><option value="RMC">RMC</option></select></div>
                        <div class="form-group" style="display:none;"><label class="form-label">Amount</label><input type="number" id="concreteEntryAmount" class="form-input" /></div>
                    </div>
                </div>

                <div class="form-group"><label class="form-label">Notes</label><input type="text" id="concreteEntryNotes" class="form-input" /></div>
                <div class="flex gap">
                    <button class="btn btn-outline" onclick="hideModal('concreteEntryModal')">Cancel</button>
                    <button class="btn btn-primary" id="concreteSaveBtn" onclick="saveConcreteEntryFromDetail()"><i class="ph ph-check"></i> Save Entry</button>
                    <button class="btn btn-primary" id="concreteBulkSaveBtn" style="display:none;" onclick="saveConcreteBulkAttendance()"><i class="ph ph-check"></i> Save Attendance</button>
                </div>
            </div>
        </div>`;
}

// Concrete Attendance
function showConcreteEntryModalFromDetail(teamId, teamName, membersJson) {
    const members = membersJson ? JSON.parse(membersJson) : [];
    document.getElementById('concreteEntryTeamId').value = teamId;
    document.getElementById('concreteEntryDate').value = todayDate();
    document.getElementById('concreteEntryWorker').value = '';
    document.getElementById('concreteEntryShift').value = '1';
    document.getElementById('concreteEntryAmount').value = '';
    document.getElementById('concreteEntryNotes').value = '';

    const gridArea = document.getElementById('concreteAttendanceGridArea');
    const individualArea = document.getElementById('concreteIndividualEntryArea');
    const saveBtn = document.getElementById('concreteSaveBtn');
    const bulkSaveBtn = document.getElementById('concreteBulkSaveBtn');

    if (members.length > 0) {
        gridArea.style.display = 'block'; individualArea.style.display = 'none';
        saveBtn.style.display = 'none'; bulkSaveBtn.style.display = 'block';
        let gridHtml = `<table class="attendance-table"><thead><tr><th></th><th>Role</th><th>Shift</th><th>Wage (₹)</th></tr></thead><tbody>`;
        members.forEach((m, idx) => {
            gridHtml += `<tr>
                <td>
                    <label class="flex items-center gap-xs" style="cursor:pointer; margin:0;">
                        <input type="checkbox" class="concrete-member-present" checked onchange="toggleConcreteMemberShift(this)" />
                        <span style="font-size:.85rem;font-weight:600;">${esc(m.name)}</span>
                    </label>
                </td>
                <td>
                    <select class="form-select sm concrete-member-role" data-idx="${idx}" onchange="updateConcreteGridWage(this)">
                        <option value="Mason" ${m.role === 'Mason' ? 'selected' : ''}>Mason</option>
                        <option value="Men Helper" ${m.role === 'Men Helper' ? 'selected' : ''}>Men Helper</option>
                        <option value="Women Helper" ${m.role === 'Women Helper' ? 'selected' : ''}>Women Helper</option>
                        <option value="Worker" ${m.role === 'Worker' ? 'selected' : ''}>Worker</option>
                    </select>
                </td>
                <td><input type="number" class="form-input sm concrete-member-shift" data-name="${esc(m.name)}" step="0.5" min="0" value="1" /></td>
                <td style="display:none;"><input type="number" class="form-input sm concrete-member-wage" step="1" min="0" value="${m.wage || ''}" /></td>
            </tr>`;
        });
        gridHtml += `</tbody></table><div style="margin-top:1rem;text-align:center;"><button class="btn btn-sm btn-outline" onclick="toggleConcreteManualEntry()">Extra Person</button></div>`;
        gridArea.innerHTML = gridHtml;
    } else {
        gridArea.style.display = 'none'; individualArea.style.display = 'block';
        saveBtn.style.display = 'block'; bulkSaveBtn.style.display = 'none';
    }
    showModal('concreteEntryModal');
}

function toggleConcreteManualEntry() {
    const individualArea = document.getElementById('concreteIndividualEntryArea');
    const saveBtn = document.getElementById('concreteSaveBtn');
    individualArea.style.display = individualArea.style.display === 'none' ? 'block' : 'none';
    saveBtn.style.display = saveBtn.style.display === 'none' ? 'block' : 'none';
}

async function saveConcreteBulkAttendance() {
    const teamId = document.getElementById('concreteEntryTeamId').value;
    const date = document.getElementById('concreteEntryDate').value;
    const notes = document.getElementById('concreteEntryNotes').value.trim();
    if (!date) { showToast('Select a date', 'warning'); return; }

    const rows = document.querySelectorAll('#concreteAttendanceGridArea tbody tr');
    const entries = [];
    rows.forEach(row => {
        const nameInput = row.querySelector('.concrete-member-shift');
        const name = nameInput.dataset.name;
        const role = row.querySelector('.concrete-member-role').value;
        const shift = parseFloat(nameInput.value) || 0;
        const wage = getRoleWage(role);
        if (shift > 0) entries.push({ teamId, projectId: AppState.currentProject._id, date, workerName: name, workerRole: role, shiftCount: shift, amount: wage, paymentType: 'Lump Sum', notes });
    });

    if (entries.length === 0) { showToast('No attendance marked', 'warning'); return; }
    showLoading();
    for (const e of entries) await window.api.labour.concrete.addEntry(e);
    hideLoading();
    showToast(`Saved attendance`, 'success');
    hideModal('concreteEntryModal');
    await openConcreteTeamDetail(teamId, window._concreteDetailTeamName);
}

function toggleConcreteMemberShift(checkbox) {
    const row = checkbox.closest('tr');
    const shiftInput = row.querySelector('.concrete-member-shift');
    if (shiftInput) shiftInput.value = checkbox.checked ? '1' : '0';
}

function updateConcreteGridWage(selectEl) {
    const role = selectEl.value;
    const row = selectEl.closest('tr');
    const wageInput = row.querySelector('.concrete-member-wage');
    wageInput.value = getRoleWage(role);
}

async function saveConcreteEntryFromDetail() {
    const teamId = document.getElementById('concreteEntryTeamId').value;
    const date = document.getElementById('concreteEntryDate').value;
    const worker = document.getElementById('concreteEntryWorker').value.trim();
    const role = document.getElementById('concreteEntryRole').value;
    const shift = parseFloat(document.getElementById('concreteEntryShift').value);
    const amount = getRoleWage(role);
    const payType = document.getElementById('concretePayType').value;
    const notes = document.getElementById('concreteEntryNotes').value.trim();

    if (!date || !worker) { showToast('Fill all fields', 'warning'); return; }
    showLoading();
    await window.api.labour.concrete.addEntry({ teamId, projectId: AppState.currentProject._id, date, workerName: worker, shiftCount: shift, amount, paymentType: payType, notes });
    hideLoading();
    hideModal('concreteEntryModal');
    await openConcreteTeamDetail(teamId, window._concreteDetailTeamName);
}

async function deleteConcreteEntryFromDetail(id) {
    if (!confirm('Delete entry?')) return;
    showLoading(); await window.api.labour.concrete.deleteEntry(id); hideLoading();
    await openConcreteTeamDetail(window._concreteDetailTeamId, window._concreteDetailTeamName);
}

function showConcreteTeamModal() {
    document.getElementById('concreteTeamName').value = '';
    showModal('concreteTeamModal');
}

async function saveConcreteTeam() {
    const name = document.getElementById('concreteTeamName').value.trim();
    if (!name) return;
    showLoading();
    await window.api.labour.concrete.createTeam({ projectId: AppState.currentProject._id, teamName: name });
    hideLoading();
    hideModal('concreteTeamModal');
    await refreshLabourSub();
}

async function deleteConcreteTeam(id, name) {
    if (!confirm(`Delete ${name}?`)) return;
    showLoading(); await window.api.labour.concrete.deleteTeam(id); hideLoading();
    await refreshLabourSub();
}

function backToConcreteList() {
    window._concreteDetailTeamId = null;
    window._concreteDetailTeamName = null;
    refreshLabourSub();
}

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
    const res = await window.api.labour.ep.getAll(projectId);
    const allEntries = res.success ? res.data : [];
    const contractors = groupEPByWorker(allEntries);
    const grandCost = allEntries.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

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
    const entries = contractor.entries || [];
    const totalCost = entries.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const totalWork = entries.length;

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
    const subBody = document.getElementById('labour-sub-body');
    const target = subBody || viewContainer;
    if (!target) return;

    target.innerHTML = '<div class="labour-loading" style="padding:3rem;"><div class="labour-spin"></div><span>Loading contractor…</span></div>';

    const projId = AppState.currentProject._id;
    const res = await window.api.labour.ep.getAll(projId);
    const allEntries = res.success ? res.data : [];
    const entries = allEntries.filter(e =>
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
    const amtEl = document.getElementById('epAmount');
    const ntEl = document.getElementById('epNotes');
    if (dateEl) dateEl.value = todayDate();
    if (descEl) descEl.value = '';
    if (amtEl) amtEl.value = '';
    if (ntEl) ntEl.value = '';
    showModal('epModal');
}

async function saveEPEntryFromDetail() {
    const workerName = document.getElementById('epWorkerName').value;
    const date = document.getElementById('epDate').value;
    const desc = document.getElementById('epDesc').value.trim();
    const amount = parseFloat(document.getElementById('epAmount').value) || 0;
    const notes = document.getElementById('epNotes').value.trim();

    if (!date) { showToast('Select a date', 'warning'); return; }
    if (!desc) { showToast('Enter work description', 'warning'); return; }

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
    const projId = AppState.currentProject._id;
    showLoading();
    const res = await window.api.labour.ep.getAll(projId);
    const toDelete = res.success ? res.data.filter(e =>
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
    const res = await window.api.labour.tiles.getAll(projectId);
    const allEntries = res.success ? res.data : [];
    const masons = groupTilesByMason(allEntries);
    const grandCost = allEntries.reduce((s, e) => s + parseFloat(e.wageAmount || 0), 0);
    const grandSqft = allEntries.reduce((s, e) => s + parseFloat(e.sqftCompleted || 0), 0);

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
    const entries = mason.entries || [];
    const totalCost = entries.reduce((s, e) => s + parseFloat(e.wageAmount || 0), 0);
    const totalSqft = entries.reduce((s, e) => s + parseFloat(e.sqftCompleted || 0), 0);

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
    const subBody = document.getElementById('labour-sub-body');
    const target = subBody || viewContainer;
    if (!target) return;

    target.innerHTML = '<div class="labour-loading" style="padding:3rem;"><div class="labour-spin"></div><span>Loading mason…</span></div>';

    const projId = AppState.currentProject._id;
    const res = await window.api.labour.tiles.getAll(projId);
    const allEntries = res.success ? res.data : [];
    const entries = allEntries.filter(e =>
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
    const totalCost = entries.reduce((s, e) => s + parseFloat(e.wageAmount || 0), 0);
    const totalSqft = entries.reduce((s, e) => s + parseFloat(e.sqftCompleted || 0), 0);

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
    const wgEl = document.getElementById('tilesWage');
    const ntEl = document.getElementById('tilesNotes');
    if (dateEl) dateEl.value = todayDate();
    if (helpEl) helpEl.value = '';
    if (sqftEl) sqftEl.value = '0';
    if (wgEl) wgEl.value = '';
    if (ntEl) ntEl.value = '';
    showModal('tilesModal');
}

async function saveTilesEntryFromDetail() {
    const masonName = document.getElementById('tilesMasonName').value;
    const date = document.getElementById('tilesDate').value;
    const helper = document.getElementById('tilesHelper').value.trim();
    const sqft = parseFloat(document.getElementById('tilesSqft').value) || 0;
    const wage = parseFloat(document.getElementById('tilesWage').value) || 0;
    const payType = document.getElementById('tilesPayType').value;
    const notes = document.getElementById('tilesNotes').value.trim();

    if (!date) { showToast('Select a date', 'warning'); return; }

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
    const projId = AppState.currentProject._id;
    showLoading();
    const res = await window.api.labour.tiles.getAll(projId);
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
    const entries = team.entries || [];
    const totalShifts = entries.reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);
    const totalCost = entries.reduce((s, e) => s + parseFloat(e.wageAmount || 0), 0);
    const uniqueNames = uniqueWorkerNames(entries);
    const workerCount = uniqueNames.length;

    const memberPills = uniqueNames.length > 0
        ? `<div class="team-member-pills">${uniqueNames.map(n => `<span class="team-member-pill" style="background:rgba(20,184,166,.1);color:#14b8a6;border-color:rgba(20,184,166,.2);">${esc(n)}</span>`).join('')}</div>`
        : `<p class="team-no-members">No members recorded yet</p>`;

    return `
        <div class="team-card team-card-clickable"
             onclick="openPaintingTeamDetail('${team._id}','${esc(team.teamName)}','${esc(team.paymentType || 'daily')}')">
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
    window._paintingDetailTeamId = teamId;
    window._paintingDetailTeamName = teamName;
    window._paintingDetailPayType = paymentType;

    const viewContainer = document.getElementById('view-container');
    const subBody = document.getElementById('labour-sub-body');
    const target = subBody || viewContainer;
    if (!target) return;

    target.innerHTML = '<div class="labour-loading" style="padding:3rem;"><div class="labour-spin"></div><span>Loading team…</span></div>';

    const res = await window.api.labour.painting.getEntries(teamId);
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
    const totalCost = entries.reduce((s, e) => s + parseFloat(e.wageAmount || 0), 0);
    const totalSqft = entries.reduce((s, e) => s + parseFloat(e.sqftCompleted || 0), 0);
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
    window._paintingDetailTeamId = null;
    window._paintingDetailTeamName = null;
    window._paintingDetailPayType = null;
    refreshLabourSub();
}

function showPaintingEntryModalFromDetail(teamId, teamName) {
    const dateEl = document.getElementById('paintingEntryDate');
    const wkrEl = document.getElementById('paintingEntryWorker');
    const shEl = document.getElementById('paintingEntryShift');
    const wgEl = document.getElementById('paintingEntryWage');
    const sqEl = document.getElementById('paintingEntrySqft');
    if (dateEl) dateEl.value = todayDate();
    if (wkrEl) wkrEl.value = '';
    if (shEl) shEl.value = '1';
    if (wgEl) wgEl.value = '';
    if (sqEl) sqEl.value = '0';
    showModal('paintingEntryModal');
}

async function savePaintingEntryFromDetail() {
    const teamId = document.getElementById('paintingEntryTeamId').value;
    const date = document.getElementById('paintingEntryDate').value;
    const worker = document.getElementById('paintingEntryWorker').value.trim();
    const shift = parseFloat(document.getElementById('paintingEntryShift').value);
    const wage = parseFloat(document.getElementById('paintingEntryWage').value) || 0;
    const sqft = parseFloat(document.getElementById('paintingEntrySqft').value) || 0;

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
    const teamId = window._paintingDetailTeamId || '';
    const teamName = window._paintingDetailTeamName || '';
    const paymentType = window._paintingDetailPayType || 'daily';
    showLoading();
    await window.api.labour.painting.deleteEntry(entryId);
    hideLoading();
    showToast('Entry deleted', 'success');
    await openPaintingTeamDetail(teamId, teamName, paymentType);
}

// ── Team CRUD ────────────────────────────────────────────────
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

    const masonEntries = masonRes.success ? masonRes.data : [];
    const centEntries = centRes.success ? centRes.data : [];
    const concEntries = concRes.success ? concRes.data : [];
    const epEntries = epRes.success ? epRes.data : [];
    const tilesEntries = tilesRes.success ? tilesRes.data : [];
    const paintEntries = paintRes.success ? paintRes.data : [];

    // Group by week
    const allDated = [
        ...(Array.isArray(masonEntries) ? masonEntries.map(e => ({ ...e, _type: 'masonry' })) : []),
        ...(Array.isArray(centEntries) ? centEntries.map(e => ({ ...e, _type: 'centring' })) : []),
        ...(Array.isArray(concEntries) ? concEntries.map(e => ({ ...e, _type: 'concrete' })) : []),
        ...(Array.isArray(epEntries) ? epEntries.map(e => ({ ...e, _type: 'ep' })) : []),
        ...(Array.isArray(tilesEntries) ? tilesEntries.map(e => ({ ...e, _type: 'tiles' })) : []),
        ...(Array.isArray(paintEntries) ? paintEntries.map(e => ({ ...e, _type: 'painting' })) : []),
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
        const masonEntries = entries.filter(e => e._type === 'masonry');
        const masons = masonEntries.filter(e => e.workerRole === 'Mason').length;
        const menHelpers = masonEntries.filter(e => e.workerRole === 'Men Helper').length;
        const womenHelpers = masonEntries.filter(e => e.workerRole === 'Women Helper').length;
        const masonWorkers = masonEntries.filter(e => e.workerRole === 'Worker').length;
        const masonShifts = masonEntries.reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);
        const masonCost = masonEntries.reduce((s, e) => s + parseFloat(e.wageAmount || 0), 0);

        const cE = entries.filter(e => e._type === 'centring');
        const centWorkers = [...new Set(cE.map(e => e.workerName))].length;
        const centShifts = cE.reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);
        const centCost = cE.reduce((s, e) => s + parseFloat(e.wageAmount || 0), 0);

        const ccE = entries.filter(e => e._type === 'concrete');
        const concShifts = ccE.reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);
        const concMen = ccE.reduce((s, e) => s + parseInt(e.menCount || 0), 0);
        const concWomen = ccE.reduce((s, e) => s + parseInt(e.womenCount || 0), 0);
        const concCost = ccE.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

        const epE = entries.filter(e => e._type === 'ep');
        const epCost = epE.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

        const tE = entries.filter(e => e._type === 'tiles');
        const tilesSqft = tE.reduce((s, e) => s + parseFloat(e.sqftCompleted || 0), 0);
        const tilesCost = tE.reduce((s, e) => s + parseFloat(e.wageAmount || 0), 0);

        const pE = entries.filter(e => e._type === 'painting');
        const paintWorkers = [...new Set(pE.map(e => e.workerName))].length;
        const paintShifts = pE.reduce((s, e) => s + parseFloat(e.shiftCount || 0), 0);
        const paintCost = pE.reduce((s, e) => s + parseFloat(e.wageAmount || 0), 0);

        const totalCost = masonCost + centCost + concCost + epCost + tilesCost + paintCost;

        html += `
        <div class="report-week-card">
            <div class="report-week-head">
                <span class="report-week-num">Week ${idx + 1}</span>
                <span class="report-week-dates">${fmtDate(mon.toISOString())} — ${fmtDate(sun.toISOString())}</span>
                <span class="report-week-total">${fmt(totalCost)}</span>
            </div>
            <div class="report-sections">
                ${masonEntries.length ? `<div class="report-section">
                    <div class="rs-head"><i class="ph ph-wall"></i> Masonry</div>
                    <div class="rs-grid">
                        <div class="rs-item"><span>Masons</span><strong>${masons}</strong></div>
                        <div class="rs-item"><span>Men Helpers</span><strong>${menHelpers}</strong></div>
                        <div class="rs-item"><span>Women Helpers</span><strong>${womenHelpers}</strong></div>
                        <div class="rs-item"><span>Workers</span><strong>${masonWorkers}</strong></div>
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
    const sub = window._labourSub || 'masonry';
    const proj = window.AppState && window.AppState.currentProject;
    if (!proj) { await navigateTo('labour'); return; }

    const viewContainer = document.getElementById('view-container');
    if (!viewContainer) { await navigateTo('labour'); return; }

    let html = '';
    switch (sub) {
        case 'masonry': html = await loadMasonryView(proj._id); break;
        case 'centring': html = await loadCentringView(proj._id); break;
        case 'concrete': html = await loadConcreteView(proj._id); break;
        case 'ep': html = await loadEPView(proj._id); break;
        case 'tiles': html = await loadTilesView(proj._id); break;
        case 'painting': html = await loadPaintingView(proj._id); break;
        case 'report': html = await loadLabourReport(proj._id); break;
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

// ── Shared Member Management ─────────────────────────────────

function labourManageMembersModal() {
    return `
    <div id="manageMembersModal" class="modal">
        <div class="modal-content" style="max-width:500px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="ph ph-users"></i> Manage Team Members</h3>
                <button class="modal-close" onclick="hideModal('manageMembersModal')"><i class="ph ph-x"></i></button>
            </div>
            <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:1rem;">
                Add names of regular workers in this team for easier attendance tracking.
            </p>
            <input type="hidden" id="manageMembersModule" />
            <input type="hidden" id="manageMembersTeamId" />
            
            <div id="membersListArea" style="max-height:300px; overflow-y:auto; margin-bottom:1rem;">
                <!-- Member rows here -->
            </div>
            
            <button class="btn btn-outline btn-sm" style="width:100%; margin-bottom:1.5rem;" onclick="addTeamMemberRow()">
                <i class="ph ph-plus"></i> Add New Member
            </button>

            <div class="flex gap">
                <button class="btn btn-outline" onclick="hideModal('manageMembersModal')">Cancel</button>
                <button class="btn btn-primary" onclick="saveTeamMembers()">
                    <i class="ph ph-check"></i> Save Members
                </button>
            </div>
        </div>
    </div>`;
}

function showManageMembersModal(module, teamId, teamName, membersJson) {
    const members = membersJson ? JSON.parse(membersJson) : [];
    document.getElementById('manageMembersModule').value = module;
    document.getElementById('manageMembersTeamId').value = teamId;

    const listArea = document.getElementById('membersListArea');
    listArea.innerHTML = '';

    if (members.length === 0) {
        addTeamMemberRow(); // Add one empty row
    } else {
        members.forEach(m => addTeamMemberRow(m.name, m.role, m.wage));
    }

    showModal('manageMembersModal');
}

function addTeamMemberRow(name = '', role = '', wage = '') {
    const listArea = document.getElementById('membersListArea');
    const row = document.createElement('div');
    row.className = 'member-edit-row';
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.marginBottom = '8px';

    const module = document.getElementById('manageMembersModule').value;
    let rolesHtml = '';
    if (module === 'masonry' || module === 'centring' || module === 'concrete') {
        rolesHtml = `
            <option value="Mason" ${role === 'Mason' ? 'selected' : ''}>Mason</option>
            <option value="Men Helper" ${role === 'Men Helper' ? 'selected' : ''}>Men Helper</option>
            <option value="Women Helper" ${role === 'Women Helper' ? 'selected' : ''}>Women Helper</option>
            <option value="Worker" ${role === 'Worker' ? 'selected' : ''}>Worker</option>`;
    }

    const settings = window._labourSettings || { masonWage: 800, menHelperWage: 700, womenHelperWage: 600, workerWage: 700 };
    let finalWage = wage;
    if (!wage && role === 'Mason') finalWage = settings.masonWage;
    if (!wage && role === 'Men Helper') finalWage = settings.menHelperWage;
    if (!wage && role === 'Women Helper') finalWage = settings.womenHelperWage;
    if (!wage && role === 'Worker') finalWage = settings.workerWage || 700;

    row.innerHTML = `
        <input type="text" class="form-input mem-name" placeholder="Name" value="${esc(name)}" style="flex:2;" />
        <select class="form-select mem-role" style="flex:1.5;" onchange="updateMemberDefaultWage(this)">${rolesHtml}</select>
        <input type="number" class="form-input mem-wage" placeholder="Wage" value="${finalWage}" style="flex:1;" />
        <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()" style="padding:0 8px;"><i class="ph ph-trash"></i></button>
    `;
    listArea.appendChild(row);
}

function updateMemberDefaultWage(selectEl) {
    const role = selectEl.value;
    const wageInput = selectEl.parentElement.querySelector('.mem-wage');
    const settings = window._labourSettings || { masonWage: 800, menHelperWage: 700, womenHelperWage: 600, workerWage: 700 };

    if (role === 'Mason') wageInput.value = settings.masonWage;
    else if (role === 'Men Helper') wageInput.value = settings.menHelperWage;
    else if (role === 'Women Helper') wageInput.value = settings.womenHelperWage;
    else if (role === 'Worker') wageInput.value = settings.workerWage || 700;
}

async function saveTeamMembers() {
    const module = document.getElementById('manageMembersModule').value;
    const teamId = document.getElementById('manageMembersTeamId').value;
    const rows = document.querySelectorAll('.member-edit-row');

    const members = [];
    rows.forEach(row => {
        const name = row.querySelector('.mem-name').value.trim();
        const role = row.querySelector('.mem-role').value;
        const wage = parseFloat(row.querySelector('.mem-wage').value) || 0;
        if (name) members.push({ name, role, wage });
    });

    showLoading();
    let res;
    if (module === 'masonry') res = await window.api.labour.masonry.updateTeam(teamId, { members });
    else if (module === 'centring') res = await window.api.labour.centring.updateTeam(teamId, { members });
    else if (module === 'concrete') res = await window.api.labour.concrete.updateTeam(teamId, { members });

    hideLoading();
    if (res && res.success) {
        showToast('Members updated', 'success');
        hideModal('manageMembersModal');
        // Refresh detail page
        if (module === 'masonry') await openMasonryTeamDetail(teamId, window._masonryDetailTeamName, window._masonryDetailPayType);
        if (module === 'centring') await openCentringTeamDetail(teamId, window._centringDetailTeamName, window._centringDetailPayType);
        if (module === 'concrete') await openConcreteTeamDetail(teamId, window._concreteDetailTeamName);
    } else {
        showToast('Update failed', 'danger');
    }
}

// ── Global exports ─────────────────────────────────────────
window.loadLabourView = loadLabourView;
window.loadLabourSubView = loadLabourSubView;
window.initializeLabour = initializeLabour;

// ── Masonry ──────────────────────────────────────────────────
window.showMasonryTeamModal = showMasonryTeamModal;
window.saveMasonryTeam = saveMasonryTeam;
window.deleteMasonryTeam = deleteMasonryTeam;
window.openMasonryTeamDetail = openMasonryTeamDetail;
window.backToMasonryList = backToMasonryList;
window.showMasonryEntryModalFromDetail = showMasonryEntryModalFromDetail;
window.saveMasonryEntryFromDetail = saveMasonryEntryFromDetail;
window.deleteMasonryEntryFromDetail = deleteMasonryEntryFromDetail;
// legacy stubs
window.showMasonryEntryModal = showMasonryEntryModal;
window.saveMasonryEntry = saveMasonryEntry;
window.showMasonryEntries = showMasonryEntries;
window.deleteMasonryEntry = deleteMasonryEntry;
window.saveMasonryBulkAttendance = saveMasonryBulkAttendance;
window.toggleMasonryManualEntry = toggleMasonryManualEntry;

// ── Centring ─────────────────────────────────────────────────
window.showCentringTeamModal = showCentringTeamModal;
window.saveCentringTeam = saveCentringTeam;
window.deleteCentringTeam = deleteCentringTeam;
window.openCentringTeamDetail = openCentringTeamDetail;
window.backToCentringList = backToCentringList;
window.showCentringEntryModalFromDetail = showCentringEntryModalFromDetail;
window.saveCentringEntryFromDetail = saveCentringEntryFromDetail;
window.deleteCentringEntryFromDetail = deleteCentringEntryFromDetail;
// legacy stubs
window.showCentringEntryModal = showCentringEntryModal;
window.saveCentringEntry = saveCentringEntry;
window.showCentringEntries = showCentringEntries;
window.deleteCentringEntry = deleteCentringEntry;
window.saveCentringBulkAttendance = saveCentringBulkAttendance;
window.toggleCentringManualEntry = toggleCentringManualEntry;

// ── Concrete ─────────────────────────────────────────────────
window.showConcreteTeamModal = showConcreteTeamModal;
window.saveConcreteTeam = saveConcreteTeam;
window.deleteConcreteTeam = deleteConcreteTeam;
window.openConcreteTeamDetail = openConcreteTeamDetail;
window.backToConcreteList = backToConcreteList;
window.showConcreteEntryModalFromDetail = showConcreteEntryModalFromDetail;
window.saveConcreteEntryFromDetail = saveConcreteEntryFromDetail;
window.deleteConcreteEntryFromDetail = deleteConcreteEntryFromDetail;
window.saveConcreteBulkAttendance = saveConcreteBulkAttendance;
window.toggleConcreteManualEntry = toggleConcreteManualEntry;
// legacy stubs
window.showConcreteModal = showConcreteModal;
window.saveConcreteEntry = saveConcreteEntry;
window.deleteConcreteEntry = deleteConcreteEntry;

// ── Shared ───────────────────────────────────────────────────
window.showManageMembersModal = showManageMembersModal;
window.addTeamMemberRow = addTeamMemberRow;
window.saveTeamMembers = saveTeamMembers;

// ── E&P ──────────────────────────────────────────────────────
window.showEPAddContractorPrompt = showEPAddContractorPrompt;
window.openEPContractorFromPrompt = openEPContractorFromPrompt;
window.openEPContractorDetail = openEPContractorDetail;
window.backToEPList = backToEPList;
window.showEPEntryModalFromDetail = showEPEntryModalFromDetail;
window.saveEPEntryFromDetail = saveEPEntryFromDetail;
window.deleteEPEntryFromDetail = deleteEPEntryFromDetail;
window.deleteEPContractorAll = deleteEPContractorAll;
// legacy stubs
window.showEPModal = showEPModal;
window.saveEPEntry = saveEPEntry;
window.deleteEPEntry = deleteEPEntry;

// ── Tiles ────────────────────────────────────────────────────
window.showTilesAddMasonPrompt = showTilesAddMasonPrompt;
window.openTilesMasonFromPrompt = openTilesMasonFromPrompt;
window.openTilesMasonDetail = openTilesMasonDetail;
window.backToTilesList = backToTilesList;
window.showTilesEntryModalFromDetail = showTilesEntryModalFromDetail;
window.saveTilesEntryFromDetail = saveTilesEntryFromDetail;
window.deleteTilesEntryFromDetail = deleteTilesEntryFromDetail;
window.deleteTilesMasonAll = deleteTilesMasonAll;
// legacy stubs
window.showTilesModal = showTilesModal;
window.saveTilesEntry = saveTilesEntry;
window.deleteTilesEntry = deleteTilesEntry;

// ── Painting ─────────────────────────────────────────────────
window.showPaintingTeamModal = showPaintingTeamModal;
window.savePaintingTeam = savePaintingTeam;
window.deletePaintingTeam = deletePaintingTeam;
window.openPaintingTeamDetail = openPaintingTeamDetail;
window.backToPaintingList = backToPaintingList;
window.showPaintingEntryModalFromDetail = showPaintingEntryModalFromDetail;
window.savePaintingEntryFromDetail = savePaintingEntryFromDetail;
window.deletePaintingEntryFromDetail = deletePaintingEntryFromDetail;
// legacy stubs
window.showPaintingEntryModal = showPaintingEntryModal;
window.savePaintingEntry = savePaintingEntry;
window.showPaintingEntries = showPaintingEntries;
window.deletePaintingEntry = deletePaintingEntry;

// ── Report ───────────────────────────────────────────────────
window.printLabourReport = printLabourReport;

// ── Settings ──────────────────────────────────────────────────
window.showLabourSettingsModal = showLabourSettingsModal;
window.saveLabourSettings = saveLabourSettings;

function labourSettingsModal() {
    return `
    <div id="labourSettingsModal" class="modal">
        <div class="modal-content" style="max-width:420px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="ph ph-gear"></i> Labour Wage Settings</h3>
                <button class="modal-close" onclick="hideModal('labourSettingsModal')"><i class="ph ph-x"></i></button>
            </div>
            <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:1rem;">
                Set global default wages for roles. These will pre-fill when adding new members or marking attendance.
            </p>
            <div class="form-group">
                <label class="form-label">Mason Wage (₹ / shift)</label>
                <input type="number" id="setMasonWage" class="form-input" placeholder="e.g. 800" />
            </div>
            <div class="form-group">
                <label class="form-label">Men Helper Wage (₹ / shift)</label>
                <input type="number" id="setMenHelperWage" class="form-input" placeholder="e.g. 700" />
            </div>
            <div class="form-group">
                <label class="form-label">Women Helper Wage (₹ / shift)</label>
                <input type="number" id="setWomenHelperWage" class="form-input" placeholder="e.g. 600" />
            </div>
            <div class="form-group">
                <label class="form-label">Worker Wage (₹ / shift)</label>
                <input type="number" id="setWorkerWage" class="form-input" placeholder="e.g. 700" />
            </div>
            <div class="flex gap">
                <button class="btn btn-outline" onclick="hideModal('labourSettingsModal')">Cancel</button>
                <button class="btn btn-primary" onclick="saveLabourSettings()">
                    <i class="ph ph-check"></i> Save Settings
                </button>
            </div>
        </div>
    </div>`;
}

async function showLabourSettingsModal() {
    showLoading();
    const res = await window.api.labour.getSettings(AppState.currentProject._id);
    hideLoading();
    if (res.success) {
        document.getElementById('setMasonWage').value = res.data.masonWage || 800;
        document.getElementById('setMenHelperWage').value = res.data.menHelperWage || 700;
        document.getElementById('setWomenHelperWage').value = res.data.womenHelperWage || 600;
        document.getElementById('setWorkerWage').value = res.data.workerWage || 700;
        showModal('labourSettingsModal');
    }
}

async function saveLabourSettings() {
    const masonryWage = parseFloat(document.getElementById('setMasonWage').value) || 800;
    const menHelperWage = parseFloat(document.getElementById('setMenHelperWage').value) || 700;
    const womenHelperWage = parseFloat(document.getElementById('setWomenHelperWage').value) || 600;

    showLoading();
    const res = await window.api.labour.updateSettings(AppState.currentProject._id, {
        masonWage: parseFloat(document.getElementById('setMasonWage').value) || 800,
        menHelperWage: parseFloat(document.getElementById('setMenHelperWage').value) || 700,
        womenHelperWage: parseFloat(document.getElementById('setWomenHelperWage').value) || 600,
        workerWage: parseFloat(document.getElementById('setWorkerWage').value) || 700
    });
    hideLoading();

    if (res.success) {
        window._labourSettings = res.data;
        showToast('Settings saved', 'success');
        hideModal('labourSettingsModal');
        refreshLabourSub();
    }
}
