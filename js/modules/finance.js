// Finance Module

async function loadFinanceView() {
    if (!AppState.currentProject) {
        return `
            <div class="alert alert-warning">
                <h3>No Project Selected</h3>
                <p>Please select a project from the Projects page to view finances.</p>
                <button class="btn btn-primary" onclick="navigateTo('projects')">Go to Projects</button>
            </div>
        `;
    }

    showLoading();
    const summaryResult = await window.api.finance.getSummary(AppState.currentProject._id);
    hideLoading();

    const summary = summaryResult.success ? normalizeFinancialSummary(summaryResult.data) : {
        labourCost: 0,
        materialCost: 0,
        equipmentCost: 0,
        otherExpenses: 0,
        totalCost: 0
    };

    const budget = toNumber(AppState.currentProject.budget);
    const remaining = budget - summary.totalCost;
    const budgetPercentage = budget > 0 ? ((summary.totalCost / budget) * 100).toFixed(1) : 0;
    const totalCost = toNumber(summary.totalCost);
    const labourShare = totalCost > 0 ? (summary.labourCost / totalCost) * 100 : 0;
    const materialShare = totalCost > 0 ? (summary.materialCost / totalCost) * 100 : 0;
    const equipmentShare = totalCost > 0 ? (summary.equipmentCost / totalCost) * 100 : 0;
    const otherShare = totalCost > 0 ? (summary.otherExpenses / totalCost) * 100 : 0;

    return `
        <div class="finance-container">
            <div class="card-header">
                <h2 class="card-title"><i class="ph ph-money"></i> Finance Dashboard</h2>
                <div class="flex gap-md"> <!-- Increased gap -->
                    <button class="btn btn-secondary" onclick="showEditBudgetModal()"> <!-- Removed btn-sm -->
                        <i class="ph ph-pencil-simple"></i> Edit Budget
                    </button>
                    <button class="btn btn-primary" onclick="showFinanceCalculator()"> <!-- Removed btn-sm -->
                        <i class="ph ph-calculator"></i> Calculator
                    </button>
                </div>
            </div>

            <!-- Cost Calculator Modal -->
            <div id="financeCostCalculatorModal" class="modal">
                <div class="modal-content calculator-modal">
                    <div class="modal-header calculator-modal-header">
                        <h3 class="modal-title">Calculator</h3>
                        <button class="modal-close" onclick="hideModal('financeCostCalculatorModal')"><i class="ph ph-x"></i></button>
                    </div>
                    <div class="calc-body">
                        <div class="calc-display">
                            <div class="calc-history" id="financeCalcHistory"></div>
                            <div id="financeCalcCurrent">0</div>
                        </div>
                        <div class="calc-grid">
                            <button class="calc-btn clear" onclick="financeCalcClear()">C</button>
                            <button class="calc-btn operator" onclick="financeCalcOperation('/')"><i class="ph ph-divide"></i></button>
                            <button class="calc-btn operator" onclick="financeCalcOperation('*')"><i class="ph ph-x"></i></button>
                            <button class="calc-btn" onclick="financeCalcDelete()"><i class="ph ph-backspace"></i></button>
                            
                            <button class="calc-btn" onclick="financeCalcInput('7')">7</button>
                            <button class="calc-btn" onclick="financeCalcInput('8')">8</button>
                            <button class="calc-btn" onclick="financeCalcInput('9')">9</button>
                            <button class="calc-btn operator" onclick="financeCalcOperation('-')"><i class="ph ph-minus"></i></button>
                            
                            <button class="calc-btn" onclick="financeCalcInput('4')">4</button>
                            <button class="calc-btn" onclick="financeCalcInput('5')">5</button>
                            <button class="calc-btn" onclick="financeCalcInput('6')">6</button>
                            <button class="calc-btn operator" onclick="financeCalcOperation('+')"><i class="ph ph-plus"></i></button>
                            
                            <button class="calc-btn" onclick="financeCalcInput('1')">1</button>
                            <button class="calc-btn" onclick="financeCalcInput('2')">2</button>
                            <button class="calc-btn" onclick="financeCalcInput('3')">3</button>
                            <button class="calc-btn equals" onclick="financeCalcResult()"><i class="ph ph-equals"></i></button>
                            
                            <button class="calc-btn" style="grid-column: span 2;" onclick="financeCalcInput('0')">0</button>
                            <button class="calc-btn" onclick="financeCalcInput('.')">.</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Edit Budget Modal -->
            <div id="editBudgetModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">Edit Project Budget</h3>
                        <button class="modal-close" onclick="hideModal('editBudgetModal')"><i class="ph ph-x"></i></button>
                    </div>
                    <form id="editBudgetForm" onsubmit="event.preventDefault(); handleEditBudget();">
                        <div class="budget-edit-grid">
                            <h4 style="color: var(--text-primary); margin-bottom: 0.5rem; grid-column: 1/-1;">Update Cost Breakdown</h4>
                            
                            <div class="budget-row-inputs">
                                <label class="form-label" style="margin:0">Labour Budget</label>
                                <input type="number" id="editBudgetLabour" class="form-input" step="0.01" oninput="calculateEditTotal()">
                            </div>
                            <div class="budget-row-inputs">
                                <label class="form-label" style="margin:0">Materials Budget</label>
                                <input type="number" id="editBudgetMaterials" class="form-input" step="0.01" oninput="calculateEditTotal()">
                            </div>
                            <div class="budget-row-inputs">
                                <label class="form-label" style="margin:0">Equipment Budget</label>
                                <input type="number" id="editBudgetEquipment" class="form-input" step="0.01" oninput="calculateEditTotal()">
                            </div>
                            <div class="budget-row-inputs">
                                <label class="form-label" style="margin:0">Other Expenses</label>
                                <input type="number" id="editBudgetOther" class="form-input" step="0.01" oninput="calculateEditTotal()">
                            </div>

                            <div style="grid-column: 1/-1; padding-top: 1rem; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: var(--text-secondary);">Calculated Total:</span>
                                <span id="editCalculatedTotal" style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">₹0.00</span>
                            </div>
                        </div>

                        <div class="form-group" style="margin-top: 1.5rem;">
                            <label class="form-label">Total Project Budget (₹)</label>
                            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">Updates to breakdown will automatically update this total.</div>
                            <input type="number" id="editProjectBudget" class="form-input" step="0.01" required readonly style="background: var(--bg-hover);">
                        </div>

                        <div class="flex gap" style="justify-content: flex-end;">
                            <button type="button" class="btn btn-outline" onclick="hideModal('editBudgetModal')">Cancel</button>
                            <button type="submit" class="btn btn-primary">Save Changes</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Budget Overview -->
            <div class="card mt-2 card-gradient-1" style="padding: 1rem;"> <!-- Reduced padding -->
                <div class="card-body">
                    <h3 style="margin-bottom: 0.75rem; color: var(--text-primary); font-size: 1.1rem;">Budget Overview</h3> <!-- Reduced header size and margin -->
                    <div class="grid grid-3 gap" style="gap: 0.75rem;"> <!-- Reduced grid gap -->
                        <div>
                            <div class="stat-label" style="font-size: 0.8rem;">Total Budget</div>
                            <div class="stat-value" style="color: var(--primary); font-size: 1.5rem;">${formatCurrency(budget)}</div> <!-- Reduced font size -->
                        </div>
                        <div>
                            <div class="stat-label" style="font-size: 0.8rem;">Total Spent</div>
                            <div class="stat-value" style="color: var(--text-primary); font-size: 1.5rem;">${formatCurrency(summary.totalCost)}</div>
                        </div>
                        <div>
                            <div class="stat-label" style="font-size: 0.8rem;">Remaining</div>
                            <div class="stat-value" style="color: ${remaining >= 0 ? 'var(--success)' : 'var(--danger)'}; font-size: 1.5rem;">
                                ${formatCurrency(remaining)}
                            </div>
                        </div>
                    </div>
                    <div style="margin-top: 1rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; color: var(--text-secondary); font-size: 0.85rem;">
                            <span>Budget Utilized</span>
                            <span>${budgetPercentage}%</span>
                        </div>
                        <div style="height: 8px; background: var(--bg-hover); border-radius: 4px; overflow: hidden;"> <!-- Slightly thinner bar -->
                            <div style="height: 100%; background: ${budgetPercentage > 100 ? 'var(--danger)' : 'var(--success)'}; 
                                        width: ${Math.min(budgetPercentage, 100)}%; transition: width 0.5s;"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Cost Breakdown -->
            <div class="grid grid-4 mt-2">
                <div class="stat-card card-gradient-4">
                    <div class="stat-label">Labour Cost</div>
                    <div class="stat-value">${formatCurrency(summary.labourCost)}</div>
                    <div class="stat-label">${labourShare.toFixed(1)}% of total</div>
                </div>
                <div class="stat-card card-gradient-5">
                    <div class="stat-label">Material Cost</div>
                    <div class="stat-value">${formatCurrency(summary.materialCost)}</div>
                    <div class="stat-label">${materialShare.toFixed(1)}% of total</div>
                </div>
                <div class="stat-card card-gradient-3">
                    <div class="stat-label">Equipment Cost</div>
                    <div class="stat-value">${formatCurrency(summary.equipmentCost)}</div>
                    <div class="stat-label">${equipmentShare.toFixed(1)}% of total</div>
                </div>
                <div class="stat-card card-gradient-6">
                    <div class="stat-label">Other Expenses</div>
                    <div class="stat-value">${formatCurrency(summary.otherExpenses)}</div>
                    <div class="stat-label">${otherShare.toFixed(1)}% of total</div>
                </div>
            </div>
            
            <!-- Detailed Breakdown -->
            <div class="card mt-2">
                <div class="card-header">
                    <h3 class="card-title">Cost Breakdown by Category</h3>
                </div>
                <div class="card-body">
                    ${renderCostBreakdownChart(summary)}
                </div>
            </div>
            
            <!-- Financial Summary Table -->
            <div class="card mt-2">
                <div class="card-header">
                    <h3 class="card-title">Financial Summary</h3>
                </div>
                <div class="card-body">
                    ${renderFinancialSummaryTable(summary, budget)}
                </div>
            </div>
        </div>
    `;
}

function renderCostBreakdownChart(summary) {
    // Get planned budgets from the current project
    const breakdown = AppState.currentProject.budgetBreakdown || {};
    const budgets = {
        labour:    breakdown.labour    || 0,
        materials: breakdown.materials || 0,
        equipment: breakdown.equipment || 0,
        other:     breakdown.other     || 0
    };

    const categories = [
        { name: 'Labour',    icon: '<i class="ph ph-users-three"></i>', amount: summary.labourCost,    budget: budgets.labour,    color: 'var(--brand)' },
        { name: 'Materials', icon: '<i class="ph ph-package"></i>',     amount: summary.materialCost,  budget: budgets.materials, color: 'var(--blue)' },
        { name: 'Equipment', icon: '<i class="ph ph-truck"></i>',        amount: summary.equipmentCost, budget: budgets.equipment, color: 'var(--purple)' },
        { name: 'Other',     icon: '<i class="ph ph-receipt"></i>',      amount: summary.otherExpenses, budget: budgets.other,     color: 'var(--teal)' }
    ];

    // When no budgets are set, fall back to showing proportional cost bars
    const totalActual = summary.totalCost || 0;
    const noBudgetSet = categories.every(c => c.budget === 0);

    if (totalActual === 0 && noBudgetSet) {
        return `
            <div style="text-align:center; padding: 2.5rem 1rem; color: var(--text-muted);">
                <i class="ph ph-chart-bar" style="font-size:2.5rem; opacity:0.4; display:block; margin-bottom:0.75rem;"></i>
                <p style="margin-bottom:0.5rem;">No cost data recorded yet.</p>
                <p style="font-size:0.82rem;">Add workers, materials, or equipment to see the breakdown.</p>
            </div>`;
    }

    return `
        <div style="display: grid; gap: 1.25rem;">
            ${categories.map(cat => {
                let percentageUsed, visualWidth, rightLabel, barColor;

                if (cat.budget > 0) {
                    // Show vs. budget
                    percentageUsed = (cat.amount / cat.budget) * 100;
                    visualWidth    = Math.min(percentageUsed, 100);
                    barColor       = percentageUsed > 100 ? 'var(--danger)' : cat.color;
                    rightLabel     = `/ ${formatCurrency(cat.budget)} <span style="opacity:.7;">(${percentageUsed.toFixed(1)}% used)</span>`;
                } else if (totalActual > 0 && cat.amount > 0) {
                    // Proportional to total spend when no budget is set
                    percentageUsed = (cat.amount / totalActual) * 100;
                    visualWidth    = percentageUsed;
                    barColor       = cat.color;
                    rightLabel     = `<span style="opacity:.7;">${percentageUsed.toFixed(1)}% of spend</span>`;
                } else {
                    percentageUsed = 0;
                    visualWidth    = 0;
                    barColor       = cat.color;
                    rightLabel     = `<span style="opacity:.5;">No data</span>`;
                }

                return `
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.45rem; font-size:0.88rem;">
                        <span style="font-weight:600; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
                            <span style="color:${cat.color}; font-size:1rem;">${cat.icon}</span> ${cat.name}
                        </span>
                        <div style="text-align:right; line-height:1.3;">
                            <span style="color:${cat.color}; font-weight:700;">${formatCurrency(cat.amount)}</span>
                            <span style="font-size:0.78rem; color:var(--text-muted); margin-left:0.4rem;">${rightLabel}</span>
                        </div>
                    </div>
                    <div style="height:10px; background:var(--bg-hover); border-radius:5px; overflow:hidden;">
                        <div style="height:100%; background:${barColor}; width:${visualWidth.toFixed(1)}%;
                                    transition:width 0.6s cubic-bezier(.4,0,.2,1); border-radius:5px;"></div>
                    </div>
                </div>`;
            }).join('')}
        </div>
    `;
}

function renderFinancialSummaryTable(summary, budget) {
    // Get planned budgets
    const breakdown = AppState.currentProject.budgetBreakdown || {};
    const budgets = {
        labour: breakdown.labour || 0,
        materials: breakdown.materials || 0,
        equipment: breakdown.equipment || 0,
        other: breakdown.other || 0
    };

    const categories = [
        { name: 'Labour Cost', amount: summary.labourCost, budget: budgets.labour },
        { name: 'Material Cost', amount: summary.materialCost, budget: budgets.materials },
        { name: 'Equipment Cost', amount: summary.equipmentCost, budget: budgets.equipment },
        { name: 'Other Expenses', amount: summary.otherExpenses, budget: budgets.other }
    ];

    const rows = categories.map(cat => {
        const percentage = cat.budget > 0 ? (cat.amount / cat.budget * 100) : 0;
        const statusColor = cat.budget > 0 && percentage > 100 ? 'var(--danger)' : 'inherit';

        return `
            <tr>
                <td><strong>${cat.name}</strong></td>
                <td>${formatCurrency(cat.amount)}</td>
                <td>${cat.budget > 0 ? formatCurrency(cat.budget) : '-'}</td>
                <td style="color: ${statusColor}">
                    ${cat.budget > 0 ? `<strong>${percentage.toFixed(2)}%</strong> of budget` : '-'}
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Category</th>
                        <th>Actual Spend</th>
                        <th>Planned Budget</th>
                        <th>Utilization</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                    <tr style="background: var(--bg-hover); font-weight: 600;">
                        <td><strong>Total Project</strong></td>
                        <td><strong class="text-expense">${formatCurrency(summary.totalCost)}</strong></td>
                        <td><strong class="text-income">${formatCurrency(budget)}</strong></td>
                        <td>
                            <div class="flex gap-sm" style="align-items: center;">
                                <strong>${budget > 0 ? ((summary.totalCost / budget * 100).toFixed(2)) + '%' : '0.00%'}</strong>
                            </div>
                        </td>
                    </tr>
                    <tr style="background: var(--bg-card);">
                        <td><strong>Remaining Funds</strong></td>
                        <td colspan="3" style="text-align: right;">
                            <span class="font-mono" style="font-size: 1.1rem; color: ${budget - summary.totalCost >= 0 ? 'var(--success)' : 'var(--danger)'};">
                                ${formatCurrency(budget - summary.totalCost)}
                            </span>
                            <span class="badge ${budget - summary.totalCost >= 0 ? 'badge-success' : 'badge-danger'}" style="margin-left: 0.5rem;">
                                ${budget - summary.totalCost < 0 ? 'Over Budget' : 'Available'}
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
}

function initializeFinance() {
    // Event handlers are inline
}

// Global keyboard listener for calculator
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('financeCostCalculatorModal');
    if (modal && modal.classList.contains('active')) {
        const key = e.key;

        // Numbers and dot
        if (/[0-9.]/.test(key)) {
            financeCalcInput(key);
            e.preventDefault();
        }
        // Operators
        else if (['+', '-', '*', '/'].includes(key)) {
            financeCalcOperation(key);
            e.preventDefault();
        }
        // Enter / Equals
        else if (key === 'Enter' || key === '=') {
            financeCalcResult();
            e.preventDefault();
        }
        // Backspace
        else if (key === 'Backspace') {
            financeCalcDelete();
            e.preventDefault();
        }
        // Escape / Clear
        else if (key === 'Escape') {
            // Optional: Close modal or just clear. Standard UI is Escape closes modal, but here we might want to just clear or let generic modal handler handle close.
            // If specific clear behavior is needed:
            // calcClear();
            // Let generic modal close handler (if any) or user action handle it.
            // But user asked for keypad support. Escape usually closes modals.
            // If we want 'c' to clear:
        }
        else if (key.toLowerCase() === 'c') {
            financeCalcClear();
            e.preventDefault();
        }
    }
});

// --- Calculator Logic ---
let financeCalcVal = '0';
let financeCalcOp = null;
let financeCalcPrev = null;

function showFinanceCalculator() {
    financeCalcVal = '0';
    financeCalcOp = null;
    financeCalcPrev = null;
    updateFinanceCalcDisplay();
    showModal('financeCostCalculatorModal');
}

function updateFinanceCalcDisplay() {
    const current = document.getElementById('financeCalcCurrent');
    const history = document.getElementById('financeCalcHistory');
    if (current) current.textContent = financeCalcVal;
    if (history) history.textContent = financeCalcPrev && financeCalcOp ? `${financeCalcPrev} ${financeCalcOp}` : '';
}

function financeCalcInput(num) {
    if (financeCalcVal === '0' && num !== '.') {
        financeCalcVal = num;
    } else {
        if (num === '.' && financeCalcVal.includes('.')) return;
        financeCalcVal += num;
    }
    updateFinanceCalcDisplay();
}

function financeCalcOperation(op) {
    if (financeCalcOp !== null) financeCalcResult();
    financeCalcPrev = financeCalcVal;
    financeCalcVal = '0';
    financeCalcOp = op;
    updateFinanceCalcDisplay();
}

function financeCalcResult() {
    if (!financeCalcPrev || !financeCalcOp) return;
    const prev = parseFloat(financeCalcPrev);
    const current = parseFloat(financeCalcVal);
    let result = 0;

    switch (financeCalcOp) {
        case '+': result = prev + current; break;
        case '-': result = prev - current; break;
        case '*': result = prev * current; break;
        case '/': result = current === 0 ? 0 : prev / current; break;
    }

    // Format to avoid long decimals but keep precision
    financeCalcVal = Math.round(result * 100) / 100 + '';
    financeCalcOp = null;
    financeCalcPrev = null;
    updateFinanceCalcDisplay();
}

function financeCalcClear() {
    financeCalcVal = '0';
    financeCalcOp = null;
    financeCalcPrev = null;
    updateFinanceCalcDisplay();
}

function financeCalcDelete() {
    if (financeCalcVal.length > 1) {
        financeCalcVal = financeCalcVal.slice(0, -1);
    } else {
        financeCalcVal = '0';
    }
    updateFinanceCalcDisplay();
}

// --- Edit Budget Logic ---
function showEditBudgetModal() {
    if (!AppState.currentProject) return;

    const breakdown = AppState.currentProject.budgetBreakdown || {};
    const total = AppState.currentProject.budget || 0;

    document.getElementById('editBudgetLabour').value = toNumber(breakdown.labour);
    document.getElementById('editBudgetMaterials').value = toNumber(breakdown.materials);
    document.getElementById('editBudgetEquipment').value = toNumber(breakdown.equipment);
    document.getElementById('editBudgetOther').value = toNumber(breakdown.other);
    document.getElementById('editProjectBudget').value = toNumber(total);

    calculateEditTotal();
    showModal('editBudgetModal');
}

function calculateEditTotal() {
    const l = toNumber(document.getElementById('editBudgetLabour').value);
    const m = toNumber(document.getElementById('editBudgetMaterials').value);
    const e = toNumber(document.getElementById('editBudgetEquipment').value);
    const o = toNumber(document.getElementById('editBudgetOther').value);

    const total = l + m + e + o;
    document.getElementById('editCalculatedTotal').textContent = formatCurrency(total);
    document.getElementById('editProjectBudget').value = total;
}

async function handleEditBudget() {
    const l = toNumber(document.getElementById('editBudgetLabour').value);
    const m = toNumber(document.getElementById('editBudgetMaterials').value);
    const e = toNumber(document.getElementById('editBudgetEquipment').value);
    const o = toNumber(document.getElementById('editBudgetOther').value);
    const newTotal = toNumber(document.getElementById('editProjectBudget').value);

    if (newTotal <= 0) {
        showAlert('Total budget must be greater than 0', 'warning');
        return;
    }

    if ([l, m, e, o].some(value => value < 0)) {
        showAlert('Budget values cannot be negative', 'warning');
        return;
    }

    try {
        showLoading();

        const newBreakdown = { labour: l, materials: m, equipment: e, other: o };

        // Persist to database via the projects API
        const updateRes = await window.api.projects.update(AppState.currentProject._id, {
            budget: newTotal,
            budgetBreakdown: newBreakdown
        });

        if (!updateRes || !updateRes.success) {
            throw new Error(updateRes ? updateRes.message : 'Failed to save project budget');
        }

        const refreshedProject = await refreshCurrentProjectState(AppState.currentProject._id);
        if (!refreshedProject) {
            setCurrentProject({
                ...AppState.currentProject,
                budget: newTotal,
                budgetBreakdown: newBreakdown
            });
        }

        // Update the project in the allProjects cache too if it exists
        if (typeof allProjects !== 'undefined') {
            const idx = allProjects.findIndex(p => p._id === AppState.currentProject._id);
            if (idx !== -1) allProjects[idx] = { ...AppState.currentProject };
        }

        hideLoading();
        hideModal('editBudgetModal');
        showAlert('Budget updated successfully', 'success');

        // Refresh view
        const updatedContent = await loadFinanceView();
        document.getElementById('view-container').innerHTML = updatedContent;

    } catch (error) {
        hideLoading();
        console.error('Error updating budget:', error);
        showAlert('Failed to update budget', 'danger');
    }
}


// Expose functions globally
window.loadFinanceView = loadFinanceView;
window.initializeFinance = initializeFinance;
window.showFinanceCalculator = showFinanceCalculator;
window.financeCalcInput = financeCalcInput;
window.financeCalcOperation = financeCalcOperation;
window.financeCalcResult = financeCalcResult;
window.financeCalcClear = financeCalcClear;
window.financeCalcDelete = financeCalcDelete;
window.showEditBudgetModal = showEditBudgetModal;
window.calculateEditTotal = calculateEditTotal;
window.handleEditBudget = handleEditBudget;
