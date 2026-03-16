// Application State
const AppState = {
    currentUser: null,
    currentProject: null,
    currentView: 'login'
};

function createHtmlFragment(html) {
    return document.createRange().createContextualFragment(html);
}

function replaceHtml(element, html) {
    if (!element) return;
    element.replaceChildren(createHtmlFragment(html));
}

function showCriticalStartupError() {
    document.body.replaceChildren(createHtmlFragment(`
        <div style="padding: 2rem; color: red;">
            <h1>Critical Error</h1>
            <p>Application API not initialized. This typically happens if the preload script failed to load.</p>
            <p>Please restart the application. If the problem persists, check the console for errors.</p>
        </div>
    `));
}

// Router - Navigate between views
async function navigateTo(viewName) {
    AppState.currentView = viewName;

    const viewContainer = document.getElementById('view-container');
    const sidebar = document.getElementById('sidebar');
    const topHeader = document.getElementById('top-header');
    const mainContent = document.getElementById('main-content');

    // Update active nav button
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === viewName) {
            btn.classList.add('active');
        }
    });

    // Show loading
    showLoading();

    try {
        let content = '';

        // Handle Sidebar and Header Visibility
        if (viewName === 'login') {
            if (sidebar) sidebar.style.display = 'none';
            if (topHeader) topHeader.style.display = 'none';
            if (mainContent) mainContent.style.marginLeft = '0';
        } else {
            if (sidebar) sidebar.style.display = 'flex';
            if (topHeader) topHeader.style.display = 'flex';
            if (mainContent) mainContent.style.marginLeft = 'var(--sidebar-w)';

            // Check if project is selected for project-specific views
            if (['dashboard', 'labour', 'materials', 'equipment', 'other-expenses', 'finance', 'electrician-payments'].includes(viewName)) {
                if (!AppState.currentProject) {
                    navigateTo('projects');
                    return;
                }
                // Update header title
                if (viewName === 'electrician-payments' && AppState.currentElectricianWorker) {
                    document.getElementById('headerProjectName').textContent =
                        `⚡ ${AppState.currentElectricianWorker.name} — Payments`;
                } else {
                    document.getElementById('headerProjectName').textContent = AppState.currentProject.name;
                }
            } else if (viewName === 'projects') {
                document.getElementById('headerProjectName').textContent = 'My Projects';
            }
        }

        switch (viewName) {
            case 'login':
                content = await loadLoginView();
                break;
            case 'projects':
                content = await loadProjectsView();
                break;
            case 'dashboard':
                content = await loadDashboardView();
                break;
            case 'labour':
                content = await loadLabourView();
                break;
            case 'electrician-payments':
                content = await loadElectricianPaymentsView();
                break;
            case 'materials':
                content = await loadMaterialsView();
                break;
            case 'equipment':
                content = await loadEquipmentView();
                break;
            case 'other-expenses':
                content = await loadOtherExpensesView();
                break;
            case 'finance':
                content = await loadFinanceView();
                break;
            case 'settings':
                content = await loadSettingsView();
                break;
            default:
                content = '<h1>Page Not Found</h1>';
        }

        replaceHtml(viewContainer, content);

        // Initialize view-specific functionality
        initializeCurrentView(viewName);

    } catch (error) {
        console.error('Navigation error:', error);
        const safeMessage = escapeHtml ? escapeHtml(error.message) : String(error.message);
        replaceHtml(viewContainer, `<div class="alert alert-danger">Error loading view: ${safeMessage}</div>`);
    } finally {
        hideLoading();
    }
}

// Initialize view-specific event handlers
function initializeCurrentView(viewName) {
    switch (viewName) {
        case 'login':
            initializeLogin();
            break;
        case 'projects':
            initializeProjects();
            break;
        case 'dashboard':
            initializeDashboard();
            break;
        case 'labour':
            initializeLabour();
            break;
        case 'electrician-payments':
            initializeElectricianPayments();
            break;
        case 'materials':
            initializeMaterials();
            break;
        case 'equipment':
            initializeEquipment();
            break;
        case 'other-expenses':
            initializeOtherExpenses();
            break;
        case 'finance':
            initializeFinance();
            break;
        case 'settings':
            initializeSettings();
            break;
    }
}

// ==========================================
// DASHBOARD VIEW (Bento Grid)
// ==========================================

async function loadDashboardView() {
    const proj = AppState.currentProject;
    return `
        <div class="bento-grid dashboard animate-fade-in">

            <!-- Budget Overview (Large — span2 row2) -->
            <div class="widget-card span-2 row-span-2 widget-kpi">
                <div class="widget-header">
                    <div class="widget-title"><i class="ph ph-wallet"></i> Budget Overview</div>
                    <div class="widget-action" onclick="navigateTo('finance')" title="Open Finance"><i class="ph ph-arrow-right"></i></div>
                </div>
                <div style="flex:1; display:flex; flex-direction:column; justify-content:space-between; gap:1rem;">
                    <div>
                        <div class="widget-value-huge" id="dashTotalBudget" data-target="0">₹0</div>
                        <div class="widget-subtext"><span class="trend neutral" id="dashRemainingPct">0%</span>&nbsp; funds remaining</div>
                    </div>
                    <div class="chart-container" style="min-height:140px;">
                        <canvas id="budgetDonut"></canvas>
                        <div id="budgetDonutCenter" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;">
                            <div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;">Spent</div>
                            <div style="font-size:1.1rem;font-weight:700;font-family:var(--font-mono);color:var(--text-primary);" id="budgetSpentPct">0%</div>
                        </div>
                    </div>
                    <div class="progress-bar-container">
                        <div id="dashBudgetBar" class="progress-bar-fill" style="width:0%"></div>
                    </div>
                    <div style="display:flex;gap:1rem;flex-wrap:wrap;">
                        <div>
                            <div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">Labour</div>
                            <div style="font-weight:700;font-family:var(--font-mono);color:var(--brand);" id="dashLabourCost">₹0</div>
                        </div>
                        <div>
                            <div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">Materials</div>
                            <div style="font-weight:700;font-family:var(--font-mono);color:var(--blue);" id="dashMaterialCost">₹0</div>
                        </div>
                        <div>
                            <div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">Equipment</div>
                            <div style="font-weight:700;font-family:var(--font-mono);color:var(--purple);" id="dashEquipCost">₹0</div>
                        </div>
                        <div>
                            <div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">Other</div>
                            <div style="font-weight:700;font-family:var(--font-mono);color:var(--teal);" id="dashOtherCost">₹0</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Team Pulse -->
            <div class="widget-card span-1 row-span-2">
                <div class="widget-header">
                    <div class="widget-title"><i class="ph ph-users"></i> Team Pulse</div>
                    <div class="widget-action" onclick="navigateTo('labour')" title="Add Worker"><i class="ph ph-plus"></i></div>
                </div>
                <div class="flex-column" id="dashTeamList" style="gap:.1rem; flex:1; overflow:hidden;">
                    <div class="text-muted text-center" style="padding:2rem 0;">
                        <i class="ph ph-spinner animate-spin"></i> Loading...
                    </div>
                </div>
            </div>

            <!-- Project Status KPI -->
            <div class="widget-card span-1">
                <div class="widget-header">
                    <div class="widget-title"><i class="ph ph-chart-line-up"></i> Project Status</div>
                </div>
                <div class="widget-value-large" style="color:var(--success);">On Track</div>
                <div class="widget-subtext" style="color:var(--success);"><i class="ph ph-check-circle"></i>&nbsp; Milestones on schedule</div>
            </div>

            <!-- Alerts -->
            <div class="widget-card span-1">
                <div class="widget-header">
                    <div class="widget-title"><i class="ph ph-bell"></i> Alerts</div>
                </div>
                <div class="widget-value-large" id="dashAlertCount" data-target="0">0</div>
                <div class="widget-subtext">Pending approvals</div>
            </div>

            <!-- Inventory -->
            <div class="widget-card span-1">
                <div class="widget-header">
                    <div class="widget-title"><i class="ph ph-package"></i> Inventory</div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:flex-end;">
                    <div>
                        <div class="widget-value-large" id="dashMaterialCount" data-target="0">0</div>
                        <div class="widget-subtext">Items stocked</div>
                    </div>
                    <div class="trend neutral" id="dashLowStockBadge" style="display:none;"><i class="ph ph-warning"></i> Low Stock</div>
                </div>
            </div>

            <!-- Equipment -->
            <div class="widget-card span-1">
                <div class="widget-header">
                    <div class="widget-title"><i class="ph ph-truck"></i> Equipment</div>
                </div>
                <div>
                    <div class="widget-value-large" id="dashEquipmentCount" data-target="0">0</div>
                    <div class="widget-subtext">Active units</div>
                </div>
            </div>

            <!-- Site Info -->
            <div class="widget-card span-2">
                <div class="widget-header">
                    <div class="widget-title"><i class="ph ph-map-pin"></i> Site Information</div>
                    <div class="badge badge-success">Active</div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;flex:1;align-items:center;">
                    <div>
                        <div class="stat-label">Project Name</div>
                        <div style="font-weight:700;font-size:1.05rem;color:var(--text-primary);margin-top:.25rem;">${proj ? escapeHtml(proj.name) : '—'}</div>
                    </div>
                    <div>
                        <div class="stat-label">Location</div>
                        <div style="font-weight:600;color:var(--text-secondary);margin-top:.25rem;">
                            <i class="ph ph-navigation-arrow" style="color:var(--brand);"></i>
                            ${proj ? escapeHtml(proj.location) : '—'}
                        </div>
                    </div>
                    <div>
                        <div class="stat-label">Start Date</div>
                        <div style="font-weight:600;color:var(--text-secondary);margin-top:.25rem;font-family:var(--font-mono);">${proj ? formatDate(proj.startDate) : '—'}</div>
                    </div>
                    <div>
                        <div class="stat-label">Total Budget</div>
                        <div style="font-weight:700;color:var(--success);margin-top:.25rem;font-family:var(--font-mono);" id="dashSiteBudget">${proj ? formatCurrency(proj.budget) : '—'}</div>
                    </div>
                </div>
            </div>

        </div>
    `;
}

// ==========================================
// ELECTRICIAN PAYMENTS VIEW
// ==========================================

// ==========================================
// ELECTRICIAN PAYMENTS VIEW (Team-based)
// ==========================================

async function loadElectricianPaymentsView() {
    const worker = AppState.currentElectricianWorker;
    if (!worker) {
        return `<div class="alert alert-warning"><h3>No Electrician Selected</h3><p>Please go back to Labour and click on an electrician.</p><button class="btn btn-primary" onclick="navigateTo('labour')">Back to Labour</button></div>`;
    }

    // Load all members for this electrician
    let members = [];
    const membersRes = await window.api.electrician.getMembers(worker._id);
    if (membersRes.success) members = membersRes.data;

    // Load payments for each member
    const memberPayments = {};
    let grandTotal = 0;
    for (const m of members) {
        const pRes = await window.api.electrician.getPayments(m._id);
        const payments = pRes.success ? pRes.data : [];
        memberPayments[m._id] = payments;
        grandTotal += payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    }

    const memberSections = members.length === 0 ? `
        <div class="empty-state-panel" style="margin-top:1.5rem;">
            <i class="ph ph-users"></i>
            <h3>No team members added yet</h3>
            <p>Add the electrician crew members here and track weekly payments clearly.</p>
            <button class="btn btn-primary" onclick="showAddMemberModal()">
                <i class="ph ph-plus"></i> Add First Member
            </button>
        </div>` :
        members.map(member => {
            const payments = memberPayments[member._id] || [];
            const memberTotal = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
            const paymentRows = payments.length === 0
                ? `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding: 1.5rem;">No payments yet</td></tr>`
                : payments.map((p, idx) => `
                    <tr>
                        <td style="color:var(--text-muted); font-size:0.85rem;">${idx + 1}</td>
                        <td><strong>${escapeHtml(p.weekLabel || 'Week Payment')}</strong></td>
                        <td style="font-size:0.85rem; color:var(--text-muted);">${p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</td>
                        <td><strong style="color:var(--success); font-size:1.05rem;">${formatCurrency(parseFloat(p.amount) || 0)}</strong></td>
                        <td>${escapeHtml(p.notes || '-')}</td>
                        <td>
                            <button class="btn btn-sm btn-danger" onclick="deleteElectricianPayment('${p._id}')">
                                <i class="ph ph-trash"></i>
                            </button>
                        </td>
                    </tr>`).join('');

            return `
            <div class="card mt-2 electrician-member-card">
                <div class="card-header electrician-member-header">
                    <div style="display:flex; align-items:center; gap:0.75rem; min-width:0;">
                        <div class="electrician-member-avatar">
                            ${escapeHtml(member.name.charAt(0).toUpperCase())}
                        </div>
                        <div style="min-width:0;">
                            <div class="electrician-member-name">${escapeHtml(member.name)}</div>
                            <div class="electrician-member-role">${member.role ? `<i class="ph ph-wrench"></i> ${escapeHtml(member.role)}` : '<i class="ph ph-lightning"></i> Electrician'}</div>
                        </div>
                    </div>
                    <div class="electrician-member-actions">
                        <div class="electrician-member-total">
                            <div class="electrician-member-total-label">Total Paid</div>
                            <div class="electrician-member-total-value">${formatCurrency(memberTotal)}</div>
                        </div>
                        <button class="btn btn-sm btn-primary" onclick="showAddPaymentModal('${member._id}', '${escapeHtml(member.name)}')"
                                title="Add weekly payment for ${escapeHtml(member.name)}">
                            <i class="ph ph-plus"></i> Add Week
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteMember('${member._id}', '${escapeHtml(member.name)}')"
                                title="Remove ${escapeHtml(member.name)} from team">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body" style="padding: 0;">
                    <div class="table-container" style="margin:0;">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width:40px;">#</th>
                                    <th>Week / Label</th>
                                    <th>Date</th>
                                    <th>Amount</th>
                                    <th>Notes</th>
                                    <th style="width:60px;">Del</th>
                                </tr>
                            </thead>
                            <tbody>${paymentRows}</tbody>
                        </table>
                    </div>
                </div>
            </div>`;
        }).join('');

    return `
        <div class="electrician-payments-page">
            <!-- Back + Header -->
            <div class="electrician-topbar card-header" style="margin-bottom:1.5rem;">
                <div style="display:flex; align-items:center; gap:1rem; min-width:0;">
                    <button class="btn btn-outline btn-sm" onclick="navigateTo('labour')">
                        <i class="ph ph-arrow-left"></i> Back
                    </button>
                    <div style="min-width:0;">
                        <h2 class="card-title" style="margin-bottom:0.15rem;">
                            <i class="ph ph-lightning" style="color:var(--warning);"></i>
                            ${escapeHtml(worker.name)} — Team Payments
                        </h2>
                        <div class="electrician-page-subtitle">
                            <i class="ph ph-phone"></i> ${escapeHtml(worker.phone)} &nbsp;&bull;&nbsp; Electrician Contractor
                        </div>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="showAddMemberModal()">
                    <i class="ph ph-user-plus"></i> Add Member
                </button>
            </div>

            <!-- Grand Total Summary -->
            <div class="grid grid-3 gap" style="margin-bottom:1.5rem;">
                <div class="stat-card electrician-stat-card electrician-stat-blue">
                    <div class="stat-label"><i class="ph ph-users"></i> Team Members</div>
                    <div class="stat-value" style="font-size:2rem;">${members.length}</div>
                    <div class="stat-label">Active workers</div>
                </div>
                <div class="stat-card electrician-stat-card electrician-stat-green">
                    <div class="stat-label"><i class="ph ph-currency-inr"></i> Total Paid (All Members)</div>
                    <div class="stat-value" style="font-size:1.6rem;">${formatCurrency(grandTotal)}</div>
                    <div class="stat-label">Across all weeks</div>
                </div>
                <div class="stat-card electrician-stat-card electrician-stat-amber">
                    <div class="stat-label"><i class="ph ph-calendar"></i> Total Weeks Recorded</div>
                    <div class="stat-value" style="font-size:2rem;">
                        ${Object.values(memberPayments).reduce((sum, arr) => sum + arr.length, 0)}
                    </div>
                    <div class="stat-label">Payment entries</div>
                </div>
            </div>

            <!-- Member Sections -->
            ${memberSections}
        </div>

        <!-- Add Member Modal -->
        <div id="addMemberModal" class="modal">
            <div class="modal-content" style="max-width:420px;">
                <div class="modal-header">
                    <h3 class="modal-title"><i class="ph ph-user-plus"></i> Add Team Member</h3>
                    <button class="modal-close" onclick="hideModal('addMemberModal')"><i class="ph ph-x"></i></button>
                </div>
                <form id="addMemberForm" onsubmit="event.preventDefault(); saveMember();">
                    <div class="form-group">
                        <label class="form-label">Member Name</label>
                        <input type="text" id="memberName" class="form-input" placeholder="e.g., Ravi, Kumar" required />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Role / Skill <span style="color:var(--text-muted); font-weight:400;">(optional)</span></label>
                        <input type="text" id="memberRole" class="form-input" placeholder="e.g., Wiring, Panel work, Fitting" />
                    </div>
                    <div class="flex gap">
                        <button type="button" class="btn btn-outline" onclick="hideModal('addMemberModal')">Cancel</button>
                        <button type="submit" class="btn btn-primary"><i class="ph ph-check"></i> Add Member</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Add Payment Modal -->
        <div id="addPaymentModal" class="modal">
            <div class="modal-content" style="max-width:420px;">
                <div class="modal-header">
                    <h3 class="modal-title"><i class="ph ph-coins"></i> Add Weekly Payment</h3>
                    <button class="modal-close" onclick="hideModal('addPaymentModal')"><i class="ph ph-x"></i></button>
                </div>
                <div style="font-size:0.85rem; color:var(--text-muted); padding: 0.5rem 1.5rem 0; margin-bottom: -0.5rem;">
                    Member: <strong id="paymentMemberName" style="color:var(--warning);"></strong>
                </div>
                <input type="hidden" id="paymentMemberId" />
                <form id="addPaymentForm" onsubmit="event.preventDefault(); savePayment();">
                    <div class="form-group">
                        <label class="form-label">Week / Label</label>
                        <input type="text" id="paymentWeekLabel" class="form-input"
                               placeholder="e.g., Week 1, March Wk 2" required />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Amount Paid (₹)</label>
                        <input type="number" id="paymentAmount" class="form-input"
                               step="0.01" min="0.01" required placeholder="Enter amount"
                               style="font-size:1.1rem;" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Notes (optional)</label>
                        <input type="text" id="paymentNotes" class="form-input" placeholder="Any remarks..." />
                    </div>
                    <div class="flex gap">
                        <button type="button" class="btn btn-outline" onclick="hideModal('addPaymentModal')">Cancel</button>
                        <button type="submit" class="btn btn-primary"><i class="ph ph-check"></i> Save Payment</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function initializeElectricianPayments() {
    // Inline handlers — nothing extra needed
}

function showAddMemberModal() {
    const form = document.getElementById('addMemberForm');
    if (form) form.reset();
    showModal('addMemberModal');
}

async function saveMember() {
    const worker = AppState.currentElectricianWorker;
    if (!worker) return;
    const name = document.getElementById('memberName').value.trim();
    const role = document.getElementById('memberRole') ? document.getElementById('memberRole').value.trim() : '';
    if (!name) { showAlert('Please enter a member name', 'warning'); return; }

    showLoading();
    const result = await window.api.electrician.addMember({
        workerId: worker._id,
        projectId: AppState.currentProject._id,
        name,
        role
    });
    hideLoading();

    if (result.success) {
        hideModal('addMemberModal');
        showAlert(`${name} added to team`, 'success');
        const content = await loadElectricianPaymentsView();
        replaceHtml(document.getElementById('view-container'), content);
        initializeElectricianPayments();
    } else {
        showAlert('Failed to add member: ' + result.message, 'danger');
    }
}

async function deleteMember(memberId, memberName) {
    if (!confirm(`Remove "${memberName}" and all their payment records?`)) return;
    showLoading();
    const result = await window.api.electrician.deleteMember(memberId);
    hideLoading();
    if (result.success) {
        showAlert(`${memberName} removed`, 'success');
        const content = await loadElectricianPaymentsView();
        replaceHtml(document.getElementById('view-container'), content);
    } else {
        showAlert('Failed to remove member', 'danger');
    }
}

function showAddPaymentModal(memberId, memberName) {
    const form = document.getElementById('addPaymentForm');
    if (form) form.reset();
    document.getElementById('paymentMemberId').value = memberId;
    document.getElementById('paymentMemberName').textContent = memberName;
    showModal('addPaymentModal');
}

async function savePayment() {
    const memberId = document.getElementById('paymentMemberId').value;
    const weekLabel = document.getElementById('paymentWeekLabel').value.trim();
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const notes = document.getElementById('paymentNotes').value.trim();

    if (!weekLabel) { showAlert('Please enter a week label', 'warning'); return; }
    if (isNaN(amount) || amount <= 0) { showAlert('Please enter a valid amount', 'warning'); return; }

    showLoading();
    const result = await window.api.electrician.addPayment({
        memberId,
        workerId: AppState.currentElectricianWorker._id,
        projectId: AppState.currentProject._id,
        weekLabel,
        amount,
        notes
    });
    hideLoading();

    if (result.success) {
        hideModal('addPaymentModal');
        showAlert('Payment saved', 'success');
        const content = await loadElectricianPaymentsView();
        replaceHtml(document.getElementById('view-container'), content);
        initializeElectricianPayments();
    } else {
        showAlert('Failed to save payment: ' + result.message, 'danger');
    }
}

async function deleteElectricianPayment(paymentId) {
    if (!confirm('Delete this payment record?')) return;
    showLoading();
    const result = await window.api.electrician.deletePayment(paymentId);
    hideLoading();
    if (result.success) {
        showAlert('Payment deleted', 'success');
        const content = await loadElectricianPaymentsView();
        replaceHtml(document.getElementById('view-container'), content);
        initializeElectricianPayments();
    } else {
        showAlert('Failed to delete payment', 'danger');
    }
}

async function initializeDashboard() {
    if (!AppState.currentProject) return;

    const p           = AppState.currentProject;
    const totalBudget = p.budget || 0;

    // Fetch financial summary — now includes all new labour collections
    let summary = { labourCost: 0, materialCost: 0, equipmentCost: 0, otherExpenses: 0, totalCost: 0 };
    try {
        const summaryRes = await window.api.finance.getSummary(p._id);
        if (summaryRes.success) summary = normalizeFinancialSummary(summaryRes.data);
    } catch (e) { console.error('Dashboard finance summary error:', e); }

    const totalSpent = summary.totalCost;
    const remaining  = totalBudget - totalSpent;
    const remainPct  = totalBudget > 0 ? ((remaining / totalBudget) * 100).toFixed(1) : 0;
    // Calculate raw spent percentage; if no budget is set but there are expenses, treat as unbounded
    const rawUsePct  = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : (totalSpent > 0 ? 100 : 0);
    const usePct     = Math.min(rawUsePct, 100);

    // Animate counters
    animateCounter('dashTotalBudget', totalBudget, true);
    document.getElementById('dashLabourCost').textContent   = formatCurrency(summary.labourCost);
    document.getElementById('dashMaterialCost').textContent = formatCurrency(summary.materialCost);
    document.getElementById('dashEquipCost').textContent    = formatCurrency(summary.equipmentCost);
    const otherEl = document.getElementById('dashOtherCost');
    if (otherEl) otherEl.textContent = formatCurrency(summary.otherExpenses);

    const pctEl = document.getElementById('dashRemainingPct');
    if (pctEl) {
        pctEl.textContent = `${remainPct}%`;
        pctEl.className   = 'trend ' + (remainPct < 20 ? 'down' : remainPct < 50 ? 'neutral' : 'up');
    }
    const spentEl = document.getElementById('budgetSpentPct');
    if (spentEl) spentEl.textContent = formatSpentPct(rawUsePct);

    setTimeout(() => {
        const bar = document.getElementById('dashBudgetBar');
        if (bar) {
            bar.style.width = `${usePct}%`;
            if      (usePct > 90) bar.style.background = 'var(--danger)';
            else if (usePct > 70) bar.style.background = 'linear-gradient(90deg, var(--warning), var(--brand))';
            else                  bar.style.background = '';
        }
    }, 200);

    renderBudgetDonut(summary, totalBudget);
    loadDashboardCounts(p._id, summary, totalBudget);
}

function renderBudgetDonut(summary, totalBudget) {
    const canvas = document.getElementById('budgetDonut');
    if (!canvas || typeof Chart === 'undefined') return;

    const labour    = (summary && summary.labourCost)    || 0;
    const materials = (summary && summary.materialCost)  || 0;
    const equipment = (summary && summary.equipmentCost) || 0;
    const other     = (summary && summary.otherExpenses) || 0;
    const spent     = labour + materials + equipment + other;
    const remaining = Math.max(0, totalBudget - spent);

    if (window._budgetChart) { window._budgetChart.destroy(); }

    // Palette aligned with dashboard legend colours
    const COLOURS = {
        labour:    '#F59E0B',
        materials: '#3B82F6',
        equipment: '#8B5CF6',
        other:     '#14B8A6',
        remaining: 'rgba(255,255,255,0.07)'
    };

    const hasSpend = spent > 0;
    const chartData    = hasSpend
        ? [labour, materials, equipment, other, remaining]
        : (totalBudget > 0 ? [0, 0, 0, 0, totalBudget] : [1]);
    const chartColors  = hasSpend
        ? [COLOURS.labour, COLOURS.materials, COLOURS.equipment, COLOURS.other, COLOURS.remaining]
        : [COLOURS.remaining];

    window._budgetChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Labour', 'Materials', 'Equipment', 'Other', 'Remaining'],
            datasets: [{
                data:            chartData,
                backgroundColor: chartColors,
                borderColor:     'transparent',
                borderWidth:     0,
                hoverOffset:     10,
                spacing:         hasSpend ? 2 : 0
            }]
        },
        options: {
            cutout: '74%',
            responsive: true,
            maintainAspectRatio: true,
            layout: { padding: 6 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: totalBudget > 0 || hasSpend,
                    backgroundColor: 'rgba(13,13,20,0.96)',
                    titleColor:      '#F4F4F8',
                    bodyColor:       '#9999B3',
                    borderColor:     'rgba(255,255,255,0.10)',
                    borderWidth:     1,
                    padding:         10,
                    cornerRadius:    8,
                    callbacks: {
                        label: (ctx) => {
                            if (!hasSpend && totalBudget > 0) return ` Budget unspent: ${formatCurrency(totalBudget)}`;
                            if (!hasSpend) return ' No cost data yet';
                            const pct = totalBudget > 0 ? ` (${(ctx.raw / totalBudget * 100).toFixed(1)}%)` : '';
                            return ` ${ctx.label}: ${formatCurrency(ctx.raw)}${pct}`;
                        }
                    }
                }
            },
            animation: { animateRotate: true, duration: 900, easing: 'easeOutQuart' }
        }
    });
}

function animateCounter(elemId, target, isCurrency) {
    const el = document.getElementById(elemId);
    if (!el || target === 0) {
        if (el) el.textContent = isCurrency ? formatCurrency(0) : '0';
        return;
    }
    const duration = 900;
    const start = Date.now();
    const tick = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out
        const current = Math.round(eased * target);
        el.textContent = isCurrency ? formatCurrency(current) : current;
        if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

const avatarColors = ['av-1', 'av-2', 'av-3', 'av-4', 'av-5', 'av-6'];

async function loadDashboardCounts(projectId, summary, totalBudget) {
    summary     = normalizeFinancialSummary(summary || {});
    totalBudget = toNumber(totalBudget ?? (AppState.currentProject ? AppState.currentProject.budget : 0));

    const notifications = [];

    try {
        // ── Team Pulse ─────────────────────────────────────────
        // Collect workers from BOTH old and new labour collections
        const [legacyRes, masonRes, centRes, concRes, epRes, tilesRes, paintRes] = await Promise.all([
            window.api.labour.getAll(projectId).catch(() => ({ success: false, data: [] })),
            window.api.labour.masonry.getAllEntries(projectId).catch(() => ({ success: false, data: [] })),
            window.api.labour.centring.getAllEntries(projectId).catch(() => ({ success: false, data: [] })),
            window.api.labour.concrete.getAll(projectId).catch(() => ({ success: false, data: [] })),
            window.api.labour.ep.getAll(projectId).catch(() => ({ success: false, data: [] })),
            window.api.labour.tiles.getAll(projectId).catch(() => ({ success: false, data: [] })),
            window.api.labour.painting.getAllEntries(projectId).catch(() => ({ success: false, data: [] })),
        ]);

        // Build a combined deduplicated worker list for Team Pulse display
        const teamPulseWorkers = [];
        const seenNames = new Set();

        // Legacy workers
        const legacyWorkers = legacyRes.success ? legacyRes.data : [];
        legacyWorkers.forEach(w => {
            const key = String(w.name || '').toLowerCase().trim();
            if (key && !seenNames.has(key)) {
                seenNames.add(key);
                teamPulseWorkers.push({ name: w.name, category: w.category || 'Worker', hasData: toNumber(w.totalCost) > 0 });
            }
        });

        // New module workers — masonry
        const masonEntries = masonRes.success ? masonRes.data : [];
        masonEntries.forEach(e => {
            const key = String(e.workerName || '').toLowerCase().trim();
            if (key && !seenNames.has(key)) {
                seenNames.add(key);
                teamPulseWorkers.push({ name: e.workerName, category: 'Masonry', hasData: true });
            }
        });

        // Centring
        const centEntries = centRes.success ? centRes.data : [];
        centEntries.forEach(e => {
            const key = String(e.workerName || '').toLowerCase().trim();
            if (key && !seenNames.has(key)) {
                seenNames.add(key);
                teamPulseWorkers.push({ name: e.workerName, category: 'Centring', hasData: true });
            }
        });

        // Concrete — team names
        const concEntries = concRes.success ? concRes.data : [];
        concEntries.forEach(e => {
            const key = String(e.teamName || '').toLowerCase().trim();
            if (key && !seenNames.has(key)) {
                seenNames.add(key);
                teamPulseWorkers.push({ name: e.teamName, category: 'Concrete', hasData: true });
            }
        });

        // E&P — worker/team names
        const epEntries = epRes.success ? epRes.data : [];
        epEntries.forEach(e => {
            const key = String(e.workerName || '').toLowerCase().trim();
            if (key && !seenNames.has(key)) {
                seenNames.add(key);
                teamPulseWorkers.push({ name: e.workerName, category: 'Elec & Plumbing', hasData: true });
            }
        });

        // Tiles — mason names
        const tilesEntries = tilesRes.success ? tilesRes.data : [];
        tilesEntries.forEach(e => {
            const key = String(e.masonName || '').toLowerCase().trim();
            if (key && !seenNames.has(key)) {
                seenNames.add(key);
                teamPulseWorkers.push({ name: e.masonName, category: 'Tiles', hasData: true });
            }
        });

        // Painting
        const paintEntries = paintRes.success ? paintRes.data : [];
        paintEntries.forEach(e => {
            const key = String(e.workerName || '').toLowerCase().trim();
            if (key && !seenNames.has(key)) {
                seenNames.add(key);
                teamPulseWorkers.push({ name: e.workerName, category: 'Painting', hasData: true });
            }
        });

        // Render Team Pulse
        const teamList = document.getElementById('dashTeamList');
        if (teamList) {
            const avatarColors = ['av-1', 'av-2', 'av-3', 'av-4', 'av-5', 'av-6'];
            if (teamPulseWorkers.length === 0) {
                teamList.innerHTML = '<div class="text-muted text-center" style="padding:2rem 0;">No workers added yet</div>';
            } else {
                const displayWorkers = teamPulseWorkers.slice(0, 6);
                teamList.innerHTML = displayWorkers.map((w, i) => `
                    <div class="list-widget-item">
                        <div class="user-avatar-group">
                            <div class="user-avatar ${avatarColors[i % avatarColors.length]}">${(w.name || '?').charAt(0).toUpperCase()}</div>
                            <div class="user-info">
                                <span class="name">${escapeHtml(w.name || '')}</span>
                                <span class="status">${escapeHtml(w.category)}</span>
                            </div>
                        </div>
                        <div class="trend ${w.hasData ? 'up' : 'neutral'}">${w.hasData ? 'Active' : 'Idle'}</div>
                    </div>`).join('') +
                    (teamPulseWorkers.length > 6
                        ? `<div style="text-align:center;padding:.5rem 0;font-size:.75rem;color:var(--text-muted);">+${teamPulseWorkers.length - 6} more</div>`
                        : '');
            }
        }

        // Notification: legacy idle workers
        const idleWorkers = legacyWorkers.filter(w => toNumber(w.totalCost) <= 0 && w.category !== 'Electrician');
        if (idleWorkers.length > 0) {
            notifications.push({ type: 'warning', icon: 'ph-hard-hat', title: 'Idle Workers', msg: `${idleWorkers.length} worker(s) have no recorded cost yet.` });
        }

        // ── Materials ─────────────────────────────────────────
        const matRes = await window.api.materials.getAll(projectId);
        if (matRes.success) {
            animateCounter('dashMaterialCount', matRes.data.length, false);
            const lowStockItems = matRes.data.filter(m => toNumber(m.quantity) < 10);
            if (lowStockItems.length > 0) {
                const badge = document.getElementById('dashLowStockBadge');
                if (badge) badge.style.display = 'inline-flex';
                notifications.push({ type: 'warning', icon: 'ph-package', title: 'Low Stock Alert', msg: `${lowStockItems.length} material(s) have quantity below 10.` });
            }
        }

        // ── Equipment ─────────────────────────────────────────
        const eqRes = await window.api.equipment.getAll(projectId);
        if (eqRes.success) animateCounter('dashEquipmentCount', eqRes.data.length, false);

        // ── Budget notifications ───────────────────────────────
        if (totalBudget > 0) {
            const usedPct = (summary.totalCost / totalBudget) * 100;
            if (usedPct >= 100) {
                notifications.push({ type: 'danger', icon: 'ph-warning-octagon', title: 'Over Budget!', msg: `Spent ${formatCurrency(summary.totalCost)} — exceeded by ${formatCurrency(summary.totalCost - totalBudget)}.` });
            } else if (usedPct >= 90) {
                notifications.push({ type: 'danger', icon: 'ph-warning-circle', title: 'Budget Critical', msg: `${usedPct.toFixed(0)}% used — only ${formatCurrency(totalBudget - summary.totalCost)} remaining.` });
            } else if (usedPct >= 75) {
                notifications.push({ type: 'warning', icon: 'ph-chart-line-up', title: 'Budget Alert', msg: `${usedPct.toFixed(0)}% of budget consumed. Monitor spending carefully.` });
            } else if (summary.totalCost === 0) {
                notifications.push({ type: 'info', icon: 'ph-info', title: 'No Costs Recorded', msg: 'No expenses recorded yet for this project.' });
            }
        } else {
            notifications.push({ type: 'info', icon: 'ph-currency-inr', title: 'No Budget Set', msg: 'Set a project budget in Finance to enable tracking.' });
        }

        // Update alert count and badge
        const alertVal = notifications.length;
        animateCounter('dashAlertCount', alertVal, false);
        const badge = document.getElementById('notifBadge');
        if (badge) {
            badge.textContent    = alertVal > 9 ? '9+' : alertVal;
            badge.style.display  = alertVal > 0 ? 'flex' : 'none';
        }

        window._appNotifications = notifications;

    } catch (e) {
        console.error('Dashboard counts error:', e);
    }
}


// Loading utilities
function showLoading() {
    document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

// Update current project display
function updateProjectDisplay() {
    const projectNameElement = document.getElementById('currentProjectName');
    if (projectNameElement) {
        projectNameElement.textContent = AppState.currentProject
            ? AppState.currentProject.name
            : 'No Project Selected';
    }
}

// Set current project
function setCurrentProject(project) {
    AppState.currentProject = project;
    localStorage.setItem('currentProjectId', project._id);
    updateProjectDisplay();
}

// Get current project from localStorage on app start
async function loadCurrentProject() {
    const projectId = localStorage.getItem('currentProjectId');
    if (projectId) {
        const result = await window.api.projects.getById(projectId);
        if (result.success && result.data) {
            setCurrentProject(result.data);
        }
    }
}

// Show modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

// Hide modal
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// Toast notification system
const toastIcons = {
    success: 'ph-check-circle',
    danger: 'ph-x-circle',
    warning: 'ph-warning-circle',
    info: 'ph-info'
};

function showToast(message, type = 'info', duration = 3200) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    replaceHtml(toast, `
        <div class="toast-icon"><i class="ph ${toastIcons[type] || 'ph-info'}"></i></div>
        <div class="toast-body"><div class="toast-msg">${message}</div></div>
        <div class="toast-progress"></div>`);
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('dismissing');
        setTimeout(() => toast.remove(), 350);
    }, duration);
}

// Legacy alias so existing code still works
function showAlert(message, type = 'info') { showToast(message, type === 'error' ? 'danger' : type); }

function toNumber(value, fallback = 0) {
    const num = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(num) ? num : fallback;
}

function normalizeFinancialSummary(summary = {}) {
    return {
        labourCost: toNumber(summary.labourCost),
        materialCost: toNumber(summary.materialCost),
        equipmentCost: toNumber(summary.equipmentCost),
        otherExpenses: toNumber(summary.otherExpenses),
        totalCost: toNumber(summary.totalCost)
    };
}

async function refreshCurrentProjectState(projectId = AppState.currentProject && AppState.currentProject._id) {
    if (!projectId) return null;

    const result = await window.api.projects.getById(projectId);
    if (result.success && result.data) {
        setCurrentProject(result.data);
        return result.data;
    }

    return null;
}

// Format currency
function formatCurrency(amount) {
    const val = toNumber(amount);
    if (val === 0) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(val);
}

// Format spent percentage with smart precision
// - Shows at least 2 decimal places for very small values (e.g. 0.01%)
// - 1 decimal for values < 10% (e.g. 4.3%)
// - 0 decimals for >= 10% (e.g. 14%)
function formatSpentPct(pct) {
    if (pct === 0) return '0%';
    if (pct < 0.01) return '< 0.01%';
    if (pct < 1)   return `${pct.toFixed(2)}%`;
    if (pct < 10)  return `${pct.toFixed(1)}%`;
    return `${Math.min(pct, 100).toFixed(0)}%`;
}

// Format date
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// ==========================================
// GLOBAL SEARCH
// ==========================================

function initSearchBar() {
    const searchInput = document.getElementById('globalSearch');
    if (!searchInput) return;

    // Ctrl+K shortcut
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
        }
        if (e.key === 'Escape') { hideSearchDropdown(); searchInput.blur(); }
    });

    let debounce;
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim();
        clearTimeout(debounce);
        if (query.length < 2) { hideSearchDropdown(); return; }
        debounce = setTimeout(() => performSearch(query), 300);
    });

    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length >= 2) showSearchDropdown();
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-bar') && !e.target.closest('#searchDropdown')) {
            hideSearchDropdown();
        }
    });
}

function showSearchDropdown() {
    const d = document.getElementById('searchDropdown');
    if (d) d.classList.add('active');
}

function hideSearchDropdown() {
    const d = document.getElementById('searchDropdown');
    if (d) d.classList.remove('active');
}

async function performSearch(query) {
    if (!AppState.currentProject) {
        renderSearchResults([], query, 'Select a project first to search within it.');
        return;
    }
    const projectId = AppState.currentProject._id;
    const q = query.toLowerCase();
    const results = [];

    try {
        const [labourRes, matRes, eqRes, expenseRes] = await Promise.all([
            window.api.labour.getAll(projectId),
            window.api.materials.getAll(projectId),
            window.api.equipment.getAll(projectId),
            window.api.finance.getExpenses(projectId)
        ]);

        if (labourRes.success) {
            labourRes.data
                .filter(w => w.name.toLowerCase().includes(q) || (w.category || '').toLowerCase().includes(q))
                .slice(0, 4)
                .forEach(w => results.push({
                    type: 'Labour', icon: 'ph-hard-hat', color: 'var(--brand)',
                    title: w.name,
                    sub: `${w.category || 'Worker'} — ${formatCurrency(toNumber(w.totalCost))}`,
                    view: 'labour'
                }));
        }

        if (matRes.success) {
            matRes.data
                .filter(m => m.name.toLowerCase().includes(q) || (m.category || '').toLowerCase().includes(q))
                .slice(0, 4)
                .forEach(m => results.push({
                    type: 'Material', icon: 'ph-package', color: 'var(--blue)',
                    title: m.name,
                    sub: `${m.category || 'Material'} — Qty: ${toNumber(m.quantity)} ${m.unit || ''}`.trim(),
                    view: 'materials'
                }));
        }

        if (eqRes.success) {
            eqRes.data
                .filter(e => e.name.toLowerCase().includes(q) || (e.type || '').toLowerCase().includes(q))
                .slice(0, 3)
                .forEach(e => results.push({
                    type: 'Equipment', icon: 'ph-truck', color: 'var(--purple)',
                    title: e.name,
                    sub: `${e.type || 'Equipment'} — ${formatCurrency(toNumber(e.totalCost))}`,
                    view: 'equipment'
                }));
        }

        if (expenseRes.success) {
            expenseRes.data
                .filter(expense =>
                    String(expense.title || '').toLowerCase().includes(q) ||
                    String(expense.category || '').toLowerCase().includes(q) ||
                    String(expense.vendor || '').toLowerCase().includes(q)
                )
                .slice(0, 4)
                .forEach(expense => results.push({
                    type: 'Other Expense', icon: 'ph-receipt', color: 'var(--teal)',
                    title: expense.title || 'Expense',
                    sub: `${expense.category || 'Miscellaneous'} — ${formatCurrency(toNumber(expense.amount))}`,
                    view: 'other-expenses'
                }));
        }
    } catch (err) { console.error('Search error:', err); }

    renderSearchResults(results, query);
}

function renderSearchResults(results, query, message) {
    let dropdown = document.getElementById('searchDropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'searchDropdown';
        dropdown.className = 'search-dropdown';
        document.body.appendChild(dropdown);
    }

    // Position below the search bar
    const searchBar = document.querySelector('.search-bar');
    if (searchBar) {
        const rect = searchBar.getBoundingClientRect();
        dropdown.style.top   = (rect.bottom + 6) + 'px';
        dropdown.style.left  = rect.left + 'px';
        dropdown.style.width = Math.max(rect.width, 340) + 'px';
    }

    if (message) {
        replaceHtml(dropdown, `<div class="search-dropdown-empty"><i class="ph ph-info"></i> ${message}</div>`);
        dropdown.classList.add('active');
        return;
    }

    if (results.length === 0) {
        replaceHtml(dropdown, `<div class="search-dropdown-empty"><i class="ph ph-magnifying-glass"></i> No results for "<strong>${escapeHtml(query)}</strong>"</div>`);
        dropdown.classList.add('active');
        return;
    }

    // Group by type
    const grouped = {};
    results.forEach(r => { (grouped[r.type] = grouped[r.type] || []).push(r); });

    let html = '';
    for (const [type, items] of Object.entries(grouped)) {
        html += `<div class="search-group-label">${type}</div>`;
        html += items.map(item => `
            <div class="search-result-item" onclick="navigateTo('${item.view}'); hideSearchDropdown(); document.getElementById('globalSearch').value='';">
                <div class="search-result-icon" style="background:${item.color}20; color:${item.color};">
                    <i class="ph ${item.icon}"></i>
                </div>
                <div class="search-result-text">
                    <div class="search-result-title">${escapeHtml(item.title)}</div>
                    <div class="search-result-sub">${escapeHtml(item.sub)}</div>
                </div>
                <i class="ph ph-arrow-right" style="color:var(--text-muted); font-size:.8rem; flex-shrink:0;"></i>
            </div>`).join('');
    }

    const total = results.length;
    html += `<div class="search-dropdown-footer">${total} result(s) in <strong>${escapeHtml(AppState.currentProject?.name || 'project')}</strong></div>`;
    replaceHtml(dropdown, html);
    dropdown.classList.add('active');
}

// ==========================================
// NOTIFICATION PANEL
// ==========================================

function initNotificationPanel() {
    const btn = document.getElementById('notifBtn');
    if (!btn) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNotificationPanel();
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#notifBtn') && !e.target.closest('#notifPanel')) {
            hideNotificationPanel();
        }
    });
}

function hideNotificationPanel() {
    const panel = document.getElementById('notifPanel');
    if (panel) panel.classList.remove('active');
}

function toggleNotificationPanel() {
    let panel = document.getElementById('notifPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'notifPanel';
        panel.className = 'notif-panel';
        document.body.appendChild(panel);
    }

    if (panel.classList.contains('active')) {
        panel.classList.remove('active');
        return;
    }

    // Position panel near the notification button
    const btn = document.getElementById('notifBtn');
    if (btn) {
        const rect = btn.getBoundingClientRect();
        panel.style.top   = (rect.bottom + 6) + 'px';
        panel.style.right = (window.innerWidth - rect.right) + 'px';
    }

    renderNotificationPanel();
    panel.classList.add('active');
}

function renderNotificationPanel() {
    const panel = document.getElementById('notifPanel');
    if (!panel) return;

    const notifications = window._appNotifications || [];
    const proj = AppState.currentProject;

    const typeStyles = {
        danger:  { color: 'var(--danger)',  bg: 'var(--danger-soft)',  icon: 'ph-warning-circle' },
        warning: { color: 'var(--warning)', bg: 'var(--warning-soft)', icon: 'ph-warning' },
        info:    { color: 'var(--info)',    bg: 'var(--info-soft)',    icon: 'ph-info' },
        success: { color: 'var(--success)', bg: 'var(--success-soft)', icon: 'ph-check-circle' }
    };

    const now = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

    const itemsHtml = notifications.length === 0
        ? `<div class="notif-empty"><i class="ph ph-bell-slash"></i><p>All clear! No alerts right now.</p></div>`
        : notifications.map(n => {
            const s = typeStyles[n.type] || typeStyles.info;
            return `
                <div class="notif-item" style="border-left: 3px solid ${s.color};">
                    <div class="notif-item-icon" style="color:${s.color}; background:${s.bg};">
                        <i class="ph ${n.icon || s.icon}"></i>
                    </div>
                    <div class="notif-item-body">
                        <div class="notif-item-title">${n.title}</div>
                        <div class="notif-item-msg">${n.msg}</div>
                    </div>
                </div>`;
        }).join('');

    replaceHtml(panel, `
        <div class="notif-panel-header">
            <span><i class="ph ph-bell"></i> Notifications</span>
            <span class="notif-panel-time">${now}</span>
        </div>
        ${proj ? `<div class="notif-panel-project"><i class="ph ph-briefcase"></i> ${escapeHtml(proj.name)}</div>` : ''}
        <div class="notif-panel-body">
            ${itemsHtml}
        </div>
        <div class="notif-panel-footer">
            <span>${notifications.length > 0 ? `${notifications.length} alert(s)` : 'No alerts'}</span>
            <button onclick="hideNotificationPanel(); navigateTo('dashboard');"
                    style="background:none;border:none;color:var(--brand);cursor:pointer;font-size:.8rem;font-family:var(--font-sans);">
                View Dashboard <i class="ph ph-arrow-right"></i>
            </button>
        </div>
    `);
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Application starting...');
    console.log('API check:', window.api ? 'Available' : 'Missing');

    if (!window.api) {
        showCriticalStartupError();
        return;
    }

    // Set up logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await window.api.auth.logout();
            // Reset state
            AppState.currentUser = null;
            AppState.currentProject = null;
            navigateTo('login');
        });
    }

    // Set up navigation
    // FIXED: Selector must match new sidebar buttons (.nav-item) or standard (.nav-btn)
    // In index.html I changed them to 'nav-item' but also kept 'nav-btn' in legacy...
    // Actually in index.html I used 'nav-item'.
    document.querySelectorAll('.nav-item[data-view], .nav-btn[data-view]').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            if (view) navigateTo(view);
        });
    });

    // Initialize search bar and notification panel
    initSearchBar();
    initNotificationPanel();

    try {
        // Listen for database switches
        window.api.settings.onDbSwitched((data) => {
            console.log('Database switched to:', data.path);
            AppState.currentProject = null; // Clear project context
            navigateTo('projects'); // Back to projects to see new data
        });

        // Check if user is logged in
        const user = await window.api.auth.getCurrentUser();
        if (user) {
            AppState.currentUser = user;
            await loadCurrentProject();
            // Go to dashboard if project selected, else projects
            if (AppState.currentProject) {
                navigateTo('dashboard');
            } else {
                navigateTo('projects');
            }
        } else {
            navigateTo('login');
        }

        // Initialize Theme
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);

    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize app: ' + error.message, 'danger');
    }
});

// Theme Toggle Function
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    updateThemeIcon(newTheme);
    showToast(`Switched to ${newTheme} mode`, 'success');
}

function updateThemeIcon(theme) {
    const themeBtnIcon = document.querySelector('#themeBtn i');
    if (themeBtnIcon) {
        if (theme === 'dark') {
            themeBtnIcon.className = 'ph ph-sun';
        } else {
            themeBtnIcon.className = 'ph ph-moon';
        }
    }
}

// Expose global functions
window.AppState = AppState;
window.navigateTo = navigateTo;
window.setCurrentProject = setCurrentProject;
window.showModal = showModal;
window.hideModal = hideModal;
window.showAlert = showAlert;
window.showToast = showToast;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.toNumber = toNumber;
window.normalizeFinancialSummary = normalizeFinancialSummary;
window.refreshCurrentProjectState = refreshCurrentProjectState;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.toggleTheme = toggleTheme;
window.animateCounter = animateCounter;
window.loadElectricianPaymentsView = loadElectricianPaymentsView;
window.initializeElectricianPayments = initializeElectricianPayments;
window.showAddMemberModal = showAddMemberModal;
window.saveMember = saveMember;
window.deleteMember = deleteMember;
window.showAddPaymentModal = showAddPaymentModal;
window.savePayment = savePayment;
window.deleteElectricianPayment = deleteElectricianPayment;
// Search + Notification
window.hideSearchDropdown = hideSearchDropdown;
window.hideNotificationPanel = hideNotificationPanel;
window.renderNotificationPanel = renderNotificationPanel;
