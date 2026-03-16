// Equipment Module
// Ownership types: Owned | Purchased | Rented
// - Owned:     no cost field
// - Purchased: Purchase Cost (₹)
// - Rented:    Daily Rental Cost (₹) + Rented Date
//              totalCost = dailyRate × days (until returnedDate if returned, else today)

let allEquipment = [];
const equipmentTypes = ['Excavator', 'Crane', 'Concrete Mixer', 'Bulldozer', 'Generator',
                        'Scaffolding', 'Compressor', 'Pump', 'Forklift', 'Other'];

// ── Helper: calendar days between two ISO date strings ───────
function calcDays(fromDate, toDate) {
    const from = new Date(fromDate);
    const to   = new Date(toDate);
    if (isNaN(from) || isNaN(to)) return 0;
    return Math.max(0, Math.floor((to - from) / (1000 * 60 * 60 * 24)));
}

// ── Helper: compute effective total cost for any equipment ───
function computeEquipmentCost(eq) {
    if (eq.ownership === 'Rented') {
        const rate    = parseFloat(eq.dailyRentalCost) || 0;
        const endDate = eq.returnedDate || new Date().toISOString().split('T')[0];
        return rate * calcDays(eq.rentedDate, endDate);
    }
    if (eq.ownership === 'Purchased') {
        return parseFloat(eq.purchaseCost) || 0;
    }
    return 0; // Owned — no cost
}

// ── Called by Ownership dropdown onchange ────────────────────
function updateEquipmentCostFields() {
    const ownership     = document.getElementById('equipmentOwnership').value;
    const purchaseGroup = document.getElementById('purchaseCostGroup');
    const rentalGroup   = document.getElementById('rentalCostGroup');
    const rentedGroup   = document.getElementById('rentedDateGroup');
    if (purchaseGroup) purchaseGroup.style.display = ownership === 'Purchased' ? 'block' : 'none';
    if (rentalGroup)   rentalGroup.style.display   = ownership === 'Rented'    ? 'block' : 'none';
    if (rentedGroup)   rentedGroup.style.display   = ownership === 'Rented'    ? 'block' : 'none';
}

// ════════════════════════════════════════════════════════════
// MAIN VIEW
// ════════════════════════════════════════════════════════════
async function loadEquipmentView() {
    if (!AppState.currentProject) {
        return `
            <div class="alert alert-warning">
                <h3>No Project Selected</h3>
                <p>Please select a project from the Projects page to manage equipment.</p>
                <button class="btn btn-primary" onclick="navigateTo('projects')">Go to Projects</button>
            </div>`;
    }

    const result = await window.api.equipment.getAll(AppState.currentProject._id);
    allEquipment = result.success ? result.data : [];

    // Recompute live totalCost on every load
    allEquipment = allEquipment.map(eq => ({ ...eq, totalCost: computeEquipmentCost(eq) }));

    const totalCost   = allEquipment.reduce((s, e) => s + e.totalCost, 0);
    const rentedCount = allEquipment.filter(e => e.ownership === 'Rented' && !e.returnedDate).length;

    return `
        <div class="equipment-container">
            <div class="card-header">
                <h2 class="card-title"><i class="ph ph-truck"></i> Equipment Management</h2>
                <button class="btn btn-primary" onclick="showAddEquipmentModal()">
                    <i class="ph ph-plus"></i> Add Equipment
                </button>
            </div>

            <!-- Summary Cards -->
            <div class="grid grid-3 mt-2">
                <div class="stat-card card-gradient-1">
                    <div class="stat-label">Total Equipment</div>
                    <div class="stat-value">${allEquipment.length}</div>
                </div>
                <div class="stat-card card-gradient-3">
                    <div class="stat-label">Total Cost</div>
                    <div class="stat-value">${formatCurrency(totalCost)}</div>
                </div>
                <div class="stat-card card-gradient-4">
                    <div class="stat-label">Active Rentals</div>
                    <div class="stat-value">${rentedCount}</div>
                </div>
            </div>

            <!-- Equipment Table -->
            <div class="card mt-2">
                <div class="card-body">
                    ${renderEquipmentTable()}
                </div>
            </div>
        </div>

        <!-- Add / Edit Modal -->
        <div id="equipmentModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title" id="equipmentModalTitle">Add Equipment</h3>
                    <button class="modal-close" onclick="hideModal('equipmentModal')">
                        <i class="ph ph-x"></i>
                    </button>
                </div>
                <form id="equipmentForm" onsubmit="event.preventDefault(); handleSaveEquipment();">
                    <input type="hidden" id="equipmentId" />

                    <div class="grid grid-2 gap">
                        <div class="form-group">
                            <label class="form-label">Equipment Name</label>
                            <input type="text" id="equipmentName" class="form-input" required />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Type</label>
                            <select id="equipmentType" class="form-select" required>
                                ${equipmentTypes.map(t => `<option value="${t}">${t}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Ownership</label>
                        <select id="equipmentOwnership" class="form-select" required
                                onchange="updateEquipmentCostFields()">
                            <option value="Owned">Owned</option>
                            <option value="Purchased">Purchased</option>
                            <option value="Rented">Rented</option>
                        </select>
                    </div>

                    <!-- Purchase Cost — shown only when Purchased -->
                    <div class="form-group" id="purchaseCostGroup" style="display:none;">
                        <label class="form-label">Purchase Cost (₹)</label>
                        <input type="number" id="equipmentPurchaseCost" class="form-input"
                               step="0.01" min="0" placeholder="Enter purchase cost" />
                    </div>

                    <!-- Daily Rental Cost — shown only when Rented -->
                    <div class="form-group" id="rentalCostGroup" style="display:none;">
                        <label class="form-label">Daily Rental Cost (₹)</label>
                        <input type="number" id="equipmentDailyRentalCost" class="form-input"
                               step="0.01" min="0" placeholder="Cost per day" />
                    </div>

                    <!-- Rented Date — shown only when Rented -->
                    <div class="form-group" id="rentedDateGroup" style="display:none;">
                        <label class="form-label">Rented Date</label>
                        <input type="date" id="equipmentRentedDate" class="form-input" />
                    </div>

                    <div class="form-group">
                        <label class="form-label">Supplier / Vendor</label>
                        <input type="text" id="equipmentSupplier" class="form-input"
                               placeholder="Supplier name (optional)" />
                    </div>

                    <div class="form-group">
                        <label class="form-label">Notes</label>
                        <textarea id="equipmentNotes" class="form-textarea"
                                  placeholder="Any remarks..."></textarea>
                    </div>

                    <div class="flex gap">
                        <button type="button" class="btn btn-outline"
                                onclick="hideModal('equipmentModal')">Cancel</button>
                        <button type="submit" class="btn btn-primary">Save Equipment</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

// ════════════════════════════════════════════════════════════
// TABLE RENDER
// ════════════════════════════════════════════════════════════
function renderEquipmentTable() {
    if (allEquipment.length === 0) {
        return `
            <div style="text-align:center;padding:2rem;color:var(--text-muted);">
                <p>No equipment added yet</p>
                <button class="btn btn-primary mt-1" onclick="showAddEquipmentModal()">Add Equipment</button>
            </div>`;
    }

    const today = new Date().toISOString().split('T')[0];

    return `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Equipment</th>
                        <th>Type</th>
                        <th>Ownership</th>
                        <th>Cost Details</th>
                        <th>Total Cost</th>
                        <th>Supplier</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${allEquipment.map(eq => {
                        const isActiveRental = eq.ownership === 'Rented' && !eq.returnedDate;
                        const isReturned     = eq.ownership === 'Rented' && !!eq.returnedDate;

                        // Cost detail cell
                        let costDetail = '—';
                        if (eq.ownership === 'Purchased') {
                            costDetail = `Purchase: ${formatCurrency(eq.purchaseCost || 0)}`;
                        } else if (eq.ownership === 'Rented') {
                            const rate  = parseFloat(eq.dailyRentalCost) || 0;
                            const endD  = eq.returnedDate || today;
                            const days  = calcDays(eq.rentedDate, endD);
                            const since = eq.rentedDate
                                ? new Date(eq.rentedDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
                                : '—';
                            costDetail = isReturned
                                ? `₹${rate}/day · Returned (${days} days)`
                                : `₹${rate}/day since ${since} (${days} days)`;
                        }

                        // Ownership badge colour
                        const ownershipStyle = {
                            Owned:     'background:rgba(16,185,129,.15);color:#10b981;',
                            Purchased: 'background:rgba(59,130,246,.15);color:#3b82f6;',
                            Rented:    isReturned
                                        ? 'background:rgba(107,114,128,.15);color:#9ca3af;'
                                        : 'background:rgba(245,158,11,.15);color:#f59e0b;',
                        }[eq.ownership] || '';

                        const ownershipLabel = isReturned ? 'Returned' : eq.ownership;

                        return `
                        <tr>
                            <td>
                                <div style="font-weight:600;color:var(--text-primary);">
                                    ${escapeHtml(eq.name)}
                                </div>
                            </td>
                            <td>
                                <span class="badge badge-secondary"
                                      style="background:var(--bg-hover);color:var(--text-secondary);">
                                    ${escapeHtml(eq.type || '—')}
                                </span>
                            </td>
                            <td>
                                <span class="badge"
                                      style="${ownershipStyle}border-radius:6px;padding:.2rem .6rem;font-size:.78rem;font-weight:600;">
                                    ${ownershipLabel}
                                </span>
                            </td>
                            <td style="font-size:.82rem;color:var(--text-secondary);">
                                ${costDetail}
                            </td>
                            <td>
                                <strong class="text-expense">${formatCurrency(eq.totalCost)}</strong>
                            </td>
                            <td>
                                <div style="display:flex;align-items:center;gap:.5rem;font-size:.85rem;">
                                    <i class="ph ph-storefront" style="color:var(--text-muted);"></i>
                                    ${escapeHtml(eq.supplier || 'Unknown')}
                                </div>
                            </td>
                            <td>
                                <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
                                    ${isActiveRental ? `
                                    <button class="btn btn-sm"
                                            style="background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3);"
                                            onclick="returnEquipment('${eq._id}')"
                                            title="Mark as returned — locks final rent total">
                                        <i class="ph ph-check-circle"></i> Returned
                                    </button>` : ''}
                                    <button class="btn btn-sm btn-secondary"
                                            onclick="editEquipment('${eq._id}')">
                                        <i class="ph ph-pencil-simple"></i>
                                    </button>
                                    <button class="btn btn-sm btn-danger"
                                            onclick="deleteEquipment('${eq._id}')">
                                        <i class="ph ph-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`;
}

// ════════════════════════════════════════════════════════════
// INITIALIZE
// ════════════════════════════════════════════════════════════
function initializeEquipment() { /* inline handlers */ }

// ════════════════════════════════════════════════════════════
// MODAL OPEN
// ════════════════════════════════════════════════════════════
function showAddEquipmentModal() {
    document.getElementById('equipmentModalTitle').textContent = 'Add Equipment';
    document.getElementById('equipmentForm').reset();
    document.getElementById('equipmentId').value = '';
    updateEquipmentCostFields(); // default Owned → hide cost fields
    showModal('equipmentModal');
}

async function editEquipment(equipmentId) {
    const eq = allEquipment.find(e => e._id === equipmentId);
    if (!eq) return;

    document.getElementById('equipmentModalTitle').textContent     = 'Edit Equipment';
    document.getElementById('equipmentId').value                   = eq._id;
    document.getElementById('equipmentName').value                 = eq.name         || '';
    document.getElementById('equipmentType').value                 = eq.type         || equipmentTypes[0];
    document.getElementById('equipmentOwnership').value            = eq.ownership    || 'Owned';
    document.getElementById('equipmentPurchaseCost').value         = eq.purchaseCost    || '';
    document.getElementById('equipmentDailyRentalCost').value      = eq.dailyRentalCost || '';
    document.getElementById('equipmentRentedDate').value           = eq.rentedDate   || '';
    document.getElementById('equipmentSupplier').value             = eq.supplier     || '';
    document.getElementById('equipmentNotes').value                = eq.notes        || '';

    updateEquipmentCostFields();
    showModal('equipmentModal');
}

// ════════════════════════════════════════════════════════════
// SAVE
// ════════════════════════════════════════════════════════════
async function handleSaveEquipment() {
    try {
        const equipmentId = document.getElementById('equipmentId').value;
        const name        = document.getElementById('equipmentName').value.trim();
        const type        = document.getElementById('equipmentType').value;
        const ownership   = document.getElementById('equipmentOwnership').value;
        const supplier    = document.getElementById('equipmentSupplier').value.trim();
        const notes       = document.getElementById('equipmentNotes').value.trim();

        if (!name) {
            showAlert('Please enter equipment name', 'warning');
            document.getElementById('equipmentName').focus();
            return;
        }

        let purchaseCost    = 0;
        let dailyRentalCost = 0;
        let rentedDate      = '';

        if (ownership === 'Purchased') {
            purchaseCost = parseFloat(document.getElementById('equipmentPurchaseCost').value) || 0;
        } else if (ownership === 'Rented') {
            dailyRentalCost = parseFloat(document.getElementById('equipmentDailyRentalCost').value) || 0;
            rentedDate      = document.getElementById('equipmentRentedDate').value;
            if (!rentedDate) {
                showAlert('Please select the rented date', 'warning');
                document.getElementById('equipmentRentedDate').focus();
                return;
            }
        }

        // Compute totalCost at save time
        let totalCost = 0;
        if (ownership === 'Purchased') {
            totalCost = purchaseCost;
        } else if (ownership === 'Rented') {
            const today = new Date().toISOString().split('T')[0];
            totalCost   = dailyRentalCost * calcDays(rentedDate, today);
        }

        const equipmentData = {
            projectId: AppState.currentProject._id,
            name, type, ownership,
            purchaseCost, dailyRentalCost, rentedDate,
            totalCost, supplier, notes,
        };

        showLoading();
        const result = equipmentId
            ? await window.api.equipment.update(equipmentId, equipmentData)
            : await window.api.equipment.create(equipmentData);
        hideLoading();

        if (result && result.success) {
            showAlert(equipmentId ? 'Equipment updated' : 'Equipment added', 'success');
            hideModal('equipmentModal');
            const updated = await loadEquipmentView();
            document.getElementById('view-container').innerHTML = updated;
        } else {
            throw new Error(result ? result.message : 'Unknown error');
        }
    } catch (err) {
        hideLoading();
        console.error('Error saving equipment:', err);
        showAlert('Failed to save: ' + err.message, 'danger');
    }
}

// ════════════════════════════════════════════════════════════
// RETURN RENTED EQUIPMENT
// ════════════════════════════════════════════════════════════
async function returnEquipment(equipmentId) {
    const eq = allEquipment.find(e => e._id === equipmentId);
    if (!eq) return;

    const returnDate = new Date().toISOString().split('T')[0];
    const days       = calcDays(eq.rentedDate, returnDate);
    const finalCost  = (parseFloat(eq.dailyRentalCost) || 0) * days;

    if (!confirm(
        `Mark "${eq.name}" as returned?\n\n` +
        `Rented on: ${eq.rentedDate || '—'}\n` +
        `Return date: ${returnDate}\n` +
        `Total days used: ${days}\n` +
        `Final total rent: ${formatCurrency(finalCost)}\n\n` +
        `Rent will stop accumulating after this.`
    )) return;

    showLoading();
    const result = await window.api.equipment.update(equipmentId, {
        returnedDate: returnDate,
        totalCost:    finalCost,
    });
    hideLoading();

    if (result && result.success) {
        showAlert(`${eq.name} returned. Final rent: ${formatCurrency(finalCost)}`, 'success');
        const updated = await loadEquipmentView();
        document.getElementById('view-container').innerHTML = updated;
    } else {
        showAlert('Failed to update equipment', 'danger');
    }
}

// ════════════════════════════════════════════════════════════
// DELETE
// ════════════════════════════════════════════════════════════
async function deleteEquipment(equipmentId) {
    if (!confirm('Are you sure you want to delete this equipment?')) return;
    showLoading();
    const result = await window.api.equipment.delete(equipmentId);
    hideLoading();
    if (result.success) {
        showAlert('Equipment deleted', 'success');
        navigateTo('equipment');
    } else {
        showAlert('Failed to delete equipment', 'danger');
    }
}

// ── Global exports ───────────────────────────────────────────
window.loadEquipmentView         = loadEquipmentView;
window.initializeEquipment       = initializeEquipment;
window.showAddEquipmentModal     = showAddEquipmentModal;
window.editEquipment             = editEquipment;
window.handleSaveEquipment       = handleSaveEquipment;
window.deleteEquipment           = deleteEquipment;
window.returnEquipment           = returnEquipment;
window.updateEquipmentCostFields = updateEquipmentCostFields;