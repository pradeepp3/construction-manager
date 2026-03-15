let allOtherExpenses = [];
const expenseCategories = ['Permits', 'Transport', 'Utilities', 'Site Office', 'Food', 'Miscellaneous'];

async function loadOtherExpensesView() {
    if (!AppState.currentProject) {
        return `
            <div class="alert alert-warning">
                <h3>No Project Selected</h3>
                <p>Please select a project from the Projects page to manage other expenses.</p>
                <button class="btn btn-primary" onclick="navigateTo('projects')">Go to Projects</button>
            </div>
        `;
    }

    showLoading();
    const result = await window.api.finance.getExpenses(AppState.currentProject._id);
    hideLoading();

    allOtherExpenses = result.success ? result.data : [];

    const totalAmount = allOtherExpenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);
    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const currentMonthAmount = allOtherExpenses.reduce((sum, expense) => {
        const expenseDate = expense.expenseDate || expense.createdAt;
        const monthKey = expenseDate ? new Date(expenseDate).toISOString().slice(0, 7) : '';
        return sum + (monthKey === currentMonthKey ? toNumber(expense.amount) : 0);
    }, 0);
    const categoriesCount = new Set(allOtherExpenses.map(expense => expense.category || 'Miscellaneous')).size;

    return `
        <div class="other-expenses-page animate-fade-in">
            <div class="card-header">
                <div>
                    <h2 class="card-title"><i class="ph ph-receipt"></i> Other Expenses</h2>
                    <div class="text-sm text-muted" style="margin-top:.2rem;">Track permits, transport, utilities, food, and every additional site spend.</div>
                </div>
                <button class="btn btn-primary" onclick="showExpenseModal()">
                    <i class="ph ph-plus"></i> Add Expense
                </button>
            </div>

            <div class="grid grid-4 mt-2">
                <div class="stat-card card-gradient-4">
                    <div class="stat-label">Entries</div>
                    <div class="stat-value">${allOtherExpenses.length}</div>
                    <div class="stat-label">Recorded expense items</div>
                </div>
                <div class="stat-card card-gradient-6">
                    <div class="stat-label">Total Spend</div>
                    <div class="stat-value">${formatCurrency(totalAmount)}</div>
                    <div class="stat-label">Added to finance totals</div>
                </div>
                <div class="stat-card card-gradient-3">
                    <div class="stat-label">This Month</div>
                    <div class="stat-value">${formatCurrency(currentMonthAmount)}</div>
                    <div class="stat-label">Current month spend</div>
                </div>
                <div class="stat-card card-gradient-2">
                    <div class="stat-label">Categories</div>
                    <div class="stat-value">${categoriesCount}</div>
                    <div class="stat-label">Expense groups used</div>
                </div>
            </div>

            <div class="card mt-2">
                <div class="card-body">
                    ${renderOtherExpensesTable()}
                </div>
            </div>
        </div>

        <div id="expenseModal" class="modal">
            <div class="modal-content" style="max-width: 520px;">
                <div class="modal-header">
                    <h3 class="modal-title" id="expenseModalTitle"><i class="ph ph-receipt"></i> Add Expense</h3>
                    <button class="modal-close" onclick="hideModal('expenseModal')"><i class="ph ph-x"></i></button>
                </div>
                <form id="expenseForm" onsubmit="event.preventDefault(); handleSaveExpense();">
                    <input type="hidden" id="expenseId" />

                    <div class="grid grid-2 gap">
                        <div class="form-group">
                            <label class="form-label">Expense Title</label>
                            <input type="text" id="expenseTitle" class="form-input" placeholder="Site generator fuel" required />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Category</label>
                            <select id="expenseCategory" class="form-select" required>
                                ${expenseCategories.map(category => `<option value="${category}">${category}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-2 gap">
                        <div class="form-group">
                            <label class="form-label">Amount (₹)</label>
                            <input type="number" id="expenseAmount" class="form-input" step="0.01" min="0.01" required />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Expense Date</label>
                            <input type="date" id="expenseDate" class="form-input" required />
                        </div>
                    </div>

                    <div class="grid grid-2 gap">
                        <div class="form-group">
                            <label class="form-label">Vendor / Paid To</label>
                            <input type="text" id="expenseVendor" class="form-input" placeholder="Vendor or payee" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Reference</label>
                            <input type="text" id="expenseReference" class="form-input" placeholder="Bill no, voucher, UPI ref" />
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Notes</label>
                        <textarea id="expenseNotes" class="form-textarea" placeholder="Additional context for this expense"></textarea>
                    </div>

                    <div class="flex gap" style="justify-content:flex-end;">
                        <button type="button" class="btn btn-outline" onclick="hideModal('expenseModal')">Cancel</button>
                        <button type="submit" class="btn btn-primary">Save Expense</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function renderOtherExpensesTable() {
    if (allOtherExpenses.length === 0) {
        return `
            <div class="empty-state-panel">
                <i class="ph ph-receipt"></i>
                <h3>No other expenses yet</h3>
                <p>Add transport, utility, food, permit, or miscellaneous site costs here.</p>
                <button class="btn btn-primary" onclick="showExpenseModal()"><i class="ph ph-plus"></i> Add First Expense</button>
            </div>
        `;
    }

    const rows = [...allOtherExpenses].sort((a, b) => {
        const dateA = new Date(a.expenseDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.expenseDate || b.createdAt || 0).getTime();
        return dateB - dateA;
    });

    return `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Expense</th>
                        <th>Category</th>
                        <th>Date</th>
                        <th>Reference</th>
                        <th>Amount</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(expense => `
                        <tr>
                            <td>
                                <div style="font-weight:600;color:var(--text-primary);">${escapeHtml(expense.title || expense.name || 'Expense')}</div>
                                <div style="font-size:.8rem;color:var(--text-muted);margin-top:.2rem;">${escapeHtml(expense.vendor || expense.notes || 'No additional notes')}</div>
                            </td>
                            <td><span class="badge badge-secondary" style="background:var(--bg-hover);color:var(--text-secondary);">${escapeHtml(expense.category || 'Miscellaneous')}</span></td>
                            <td>${formatDate(expense.expenseDate || expense.createdAt)}</td>
                            <td style="color:var(--text-secondary);">${escapeHtml(expense.reference || '—')}</td>
                            <td><strong class="text-expense">${formatCurrency(expense.amount)}</strong></td>
                            <td>
                                <button class="btn btn-sm btn-secondary" onclick="editExpense('${expense._id}')"><i class="ph ph-pencil-simple"></i></button>
                                <button class="btn btn-sm btn-danger" onclick="deleteExpenseEntry('${expense._id}')"><i class="ph ph-trash"></i></button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function initializeOtherExpenses() {
    // Inline handlers only
}

function showExpenseModal() {
    const form = document.getElementById('expenseForm');
    if (form) form.reset();
    document.getElementById('expenseModalTitle').innerHTML = '<i class="ph ph-receipt"></i> Add Expense';
    document.getElementById('expenseId').value = '';
    const expenseDate = document.getElementById('expenseDate');
    if (expenseDate) expenseDate.value = new Date().toISOString().split('T')[0];
    showModal('expenseModal');
}

function editExpense(expenseId) {
    const expense = allOtherExpenses.find(item => item._id === expenseId);
    if (!expense) return;

    document.getElementById('expenseModalTitle').innerHTML = '<i class="ph ph-pencil-simple"></i> Edit Expense';
    document.getElementById('expenseId').value = expense._id;
    document.getElementById('expenseTitle').value = expense.title || expense.name || '';
    document.getElementById('expenseCategory').value = expense.category || 'Miscellaneous';
    document.getElementById('expenseAmount').value = toNumber(expense.amount);
    document.getElementById('expenseDate').value = expense.expenseDate ? new Date(expense.expenseDate).toISOString().split('T')[0] : new Date(expense.createdAt || Date.now()).toISOString().split('T')[0];
    document.getElementById('expenseVendor').value = expense.vendor || '';
    document.getElementById('expenseReference').value = expense.reference || '';
    document.getElementById('expenseNotes').value = expense.notes || '';
    showModal('expenseModal');
}

async function handleSaveExpense() {
    const expenseId = document.getElementById('expenseId').value;
    const title = document.getElementById('expenseTitle').value.trim();
    const category = document.getElementById('expenseCategory').value;
    const amount = toNumber(document.getElementById('expenseAmount').value);
    const expenseDate = document.getElementById('expenseDate').value;

    if (!title) {
        showAlert('Please enter an expense title', 'warning');
        return;
    }

    if (amount <= 0) {
        showAlert('Please enter a valid amount', 'warning');
        return;
    }

    if (!expenseDate) {
        showAlert('Please choose an expense date', 'warning');
        return;
    }

    const expenseData = {
        projectId: AppState.currentProject._id,
        title,
        category,
        amount,
        expenseDate,
        vendor: document.getElementById('expenseVendor').value.trim(),
        reference: document.getElementById('expenseReference').value.trim(),
        notes: document.getElementById('expenseNotes').value.trim()
    };

    showLoading();
    const result = expenseId
        ? await window.api.finance.updateExpense(expenseId, expenseData)
        : await window.api.finance.createExpense(expenseData);
    hideLoading();

    if (!result || !result.success) {
        showAlert(`Failed to save expense${result && result.message ? ': ' + result.message : ''}`, 'danger');
        return;
    }

    await refreshCurrentProjectState();
    hideModal('expenseModal');
    showAlert(expenseId ? 'Expense updated successfully' : 'Expense added successfully', 'success');
    const content = await loadOtherExpensesView();
    document.getElementById('view-container').innerHTML = content;
    initializeOtherExpenses();
}

async function deleteExpenseEntry(expenseId) {
    if (!confirm('Delete this expense entry?')) return;

    showLoading();
    const result = await window.api.finance.deleteExpense(expenseId);
    hideLoading();

    if (!result || !result.success) {
        showAlert('Failed to delete expense', 'danger');
        return;
    }

    await refreshCurrentProjectState();
    showAlert('Expense deleted', 'success');
    const content = await loadOtherExpensesView();
    document.getElementById('view-container').innerHTML = content;
    initializeOtherExpenses();
}

window.loadOtherExpensesView = loadOtherExpensesView;
window.initializeOtherExpenses = initializeOtherExpenses;
window.showExpenseModal = showExpenseModal;
window.editExpense = editExpense;
window.handleSaveExpense = handleSaveExpense;
window.deleteExpenseEntry = deleteExpenseEntry;