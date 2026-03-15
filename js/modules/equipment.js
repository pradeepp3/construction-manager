// Equipment Module

let allEquipment = [];
const equipmentCategories = ['Machinery', 'Tools', 'Vehicles', 'Safety Equipment', 'Other'];
const equipmentStatus = ['Available', 'In Use', 'Under Maintenance', 'Retired'];

async function loadEquipmentView() {
    if (!AppState.currentProject) {
        return `
            <div class="alert alert-warning">
                <h3>No Project Selected</h3>
                <p>Please select a project from the Projects page to manage equipment.</p>
                <button class="btn btn-primary" onclick="navigateTo('projects')">Go to Projects</button>
            </div>
        `;
    }

    const result = await window.api.equipment.getAll(AppState.currentProject._id);
    if (result.success) {
        allEquipment = result.data;
    } else {
        allEquipment = [];
    }

    const totalCost = allEquipment.reduce((sum, e) => sum + toNumber(e.totalCost), 0);
    const availableCount = allEquipment.filter(e => e.status === 'Available').length;
    const inUseCount = allEquipment.filter(e => e.status === 'In Use').length;

    return `
        <div class="equipment-container">
            <div class="card-header">
                <h2 class="card-title"><i class="ph ph-wrench"></i> Equipment Management</h2>
                <button class="btn btn-primary" onclick="showAddEquipmentModal()">
                    <i class="ph ph-plus"></i> Add Equipment
                </button>
            </div>
            
            <!-- Summary Cards -->
            <div class="grid grid-4 mt-2">
                <div class="stat-card card-gradient-1">
                    <div class="stat-label">Total Equipment</div>
                    <div class="stat-value">${allEquipment.length}</div>
                </div>
                <div class="stat-card card-gradient-2">
                    <div class="stat-label">Available</div>
                    <div class="stat-value">${availableCount}</div>
                </div>
                <div class="stat-card card-gradient-3">
                    <div class="stat-label">In Use</div>
                    <div class="stat-value">${inUseCount}</div>
                </div>
                <div class="stat-card card-gradient-4">
                    <div class="stat-label">Total Cost</div>
                    <div class="stat-value">${formatCurrency(totalCost)}</div>
                </div>
            </div>
            
            <!-- Equipment Table -->
            <div class="card mt-2">
                <div class="card-body">
                    ${renderEquipmentTable()}
                </div>
            </div>
        </div>
        
        <!-- Add/Edit Equipment Modal -->
        <div id="equipmentModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title" id="equipmentModalTitle">Add Equipment</h3>
                    <button class="modal-close" onclick="hideModal('equipmentModal')"><i class="ph ph-x"></i></button>
                </div>
                <form id="equipmentForm" onsubmit="event.preventDefault(); handleSaveEquipment();">
                    <input type="hidden" id="equipmentId" />
                    
                    <div class="grid grid-2 gap">
                        <div class="form-group">
                            <label class="form-label">Equipment Name</label>
                            <input type="text" id="equipmentName" class="form-input" required />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Category</label>
                            <select id="equipmentCategory" class="form-select" required>
                                ${equipmentCategories.map(cat => `
                                    <option value="${cat}">${cat}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div class="grid grid-2 gap">
                        <div class="form-group">
                            <label class="form-label">Status</label>
                            <select id="equipmentStatus" class="form-select" required>
                                ${equipmentStatus.map(status => `
                                    <option value="${status}">${status}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ownership</label>
                            <select id="equipmentOwnership" class="form-select" required>
                                <option value="Owned">Owned</option>
                                <option value="Rented">Rented</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="grid grid-2 gap">
                        <div class="form-group">
                            <label class="form-label">Purchase/Rental Cost (₹)</label>
                            <input type="number" id="equipmentCost" class="form-input" step="0.01" required />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Daily Rental Rate (₹) (if rented)</label>
                            <input type="number" id="equipmentRentalRate" class="form-input" step="0.01" value="0" />
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Supplier/Vendor</label>
                        <input type="text" id="equipmentSupplier" class="form-input" />
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Notes</label>
                        <textarea id="equipmentNotes" class="form-textarea"></textarea>
                    </div>
                    
                    <div class="flex gap">
                        <button type="button" class="btn btn-outline" onclick="hideModal('equipmentModal')">
                            Cancel
                        </button>
                        <button type="submit" class="btn btn-primary">
                            Save Equipment
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function renderEquipmentTable() {
    if (allEquipment.length === 0) {
        return `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <p>No equipment added yet</p>
                <button class="btn btn-primary mt-1" onclick="showAddEquipmentModal()">
                    Add Equipment
                </button>
            </div>
        `;
    }

    return `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Equipment Name</th>
                        <th>Category</th>
                        <th>Status</th>
                        <th>Ownership</th>
                        <th>Cost Details</th>
                        <th>Supplier</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${allEquipment.map(equipment => {
        let statusBadge = 'badge-info';
        let statusColor = 'var(--info)';
        if (equipment.status === 'Available') { statusBadge = 'badge-success'; statusColor = 'var(--success)'; }
        if (equipment.status === 'In Use') { statusBadge = 'badge-warning'; statusColor = 'var(--warning)'; }
        if (equipment.status === 'Under Maintenance') { statusBadge = 'badge-danger'; statusColor = 'var(--danger)'; }

        return `
            <tr>
                <td>
                    <div style="font-weight: 600; color: var(--text-primary);">${escapeHtml(equipment.name)}</div>
                </td>
                <td><span style="color: var(--text-secondary); font-size: 0.85rem;">${equipment.category}</span></td>
                <td><span class="badge ${statusBadge}">${equipment.status}</span></td>
                <td>
                    ${equipment.ownership === 'Owned'
                ? '<span style="color: var(--primary); font-weight: 500;"><i class="ph ph-check-circle"></i> Owned</span>'
                : '<span style="color: var(--text-muted);"><i class="ph ph-clock"></i> Rented</span>'}
                </td>
                <td>
                    <div class="font-mono" style="font-size: 0.9rem;">
                        ${equipment.ownership === 'Rented'
                ? `<span style="color: var(--text-muted);">Rate:</span> <span class="text-expense">${formatCurrency(equipment.rentalRate)}/day</span>`
                : `<span style="color: var(--text-muted);">Cost:</span> <span class="text-expense">${formatCurrency(equipment.totalCost)}</span>`}
                    </div>
                </td>
                <td>
                     <div style="font-size: 0.85rem; color: var(--text-secondary);">
                        ${equipment.supplier ? `<i class="ph ph-storefront"></i> ${escapeHtml(equipment.supplier)}` : '-'}
                     </div>
                </td>
                <td>
                    <button class="btn btn-sm btn-secondary" 
                            onclick="editEquipment('${equipment._id}')">
                        <i class="ph ph-pencil-simple"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" 
                            onclick="deleteEquipment('${equipment._id}')">
                        <i class="ph ph-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function initializeEquipment() {
    // Event handlers are inline
}

function showAddEquipmentModal() {
    document.getElementById('equipmentModalTitle').textContent = 'Add Equipment';
    document.getElementById('equipmentForm').reset();
    document.getElementById('equipmentId').value = '';
    showModal('equipmentModal');
}

async function editEquipment(equipmentId) {
    const equipment = allEquipment.find(e => e._id === equipmentId);
    if (!equipment) return;

    document.getElementById('equipmentModalTitle').textContent = 'Edit Equipment';
    document.getElementById('equipmentId').value = equipment._id;
    document.getElementById('equipmentName').value = equipment.name;
    document.getElementById('equipmentCategory').value = equipment.category;
    document.getElementById('equipmentStatus').value = equipment.status;
    document.getElementById('equipmentOwnership').value = equipment.ownership;
    document.getElementById('equipmentCost').value = toNumber(equipment.totalCost);
    document.getElementById('equipmentRentalRate').value = toNumber(equipment.rentalRate);
    document.getElementById('equipmentSupplier').value = equipment.supplier || '';
    document.getElementById('equipmentNotes').value = equipment.notes || '';

    showModal('equipmentModal');
}

async function handleSaveEquipment() {
    try {
        const equipmentId = document.getElementById('equipmentId').value;
        const name = document.getElementById('equipmentName').value.trim();
        const cost = parseFloat(document.getElementById('equipmentCost').value);
        const ownership = document.getElementById('equipmentOwnership').value;
        const rentalRate = parseFloat(document.getElementById('equipmentRentalRate').value);

        // Professional Validation
        if (!name) {
            showAlert('Please enter equipment name', 'warning');
            document.getElementById('equipmentName').focus();
            return;
        }

        if (isNaN(cost) || cost < 0) {
            showAlert('Please enter a valid cost', 'warning');
            document.getElementById('equipmentCost').focus();
            return;
        }

        if (ownership === 'Rented' && (isNaN(rentalRate) || rentalRate <= 0)) {
            showAlert('Please enter a valid daily rental rate for rented equipment', 'warning');
            document.getElementById('equipmentRentalRate').focus();
            return;
        }

        const equipmentData = {
            projectId: AppState.currentProject._id,
            name: name,
            category: document.getElementById('equipmentCategory').value,
            status: document.getElementById('equipmentStatus').value,
            ownership: ownership,
            totalCost: cost,
            rentalRate: isNaN(rentalRate) ? 0 : rentalRate,
            supplier: document.getElementById('equipmentSupplier').value.trim(),
            notes: document.getElementById('equipmentNotes').value.trim()
        };

        showLoading();
        let result;
        if (equipmentId) {
            result = await window.api.equipment.update(equipmentId, equipmentData);
        } else {
            result = await window.api.equipment.create(equipmentData);
        }
        hideLoading();

        if (result && result.success) {
            showAlert(equipmentId ? 'Equipment updated successfully' : 'Equipment added successfully', 'success');
            hideModal('equipmentModal');
            // Refresh view
            const updatedContent = await loadEquipmentView();
            document.getElementById('view-container').innerHTML = updatedContent;
            // Also need to re-render the summary stats if visible, loadEquipmentView handles this
        } else {
            throw new Error(result ? result.message : 'Unknown error occurred');
        }
    } catch (error) {
        hideLoading();
        console.error('Error saving equipment:', error);
        showAlert('Failed to save equipment: ' + error.message, 'danger');
    }
}

async function deleteEquipment(equipmentId) {
    if (!confirm('Are you sure you want to delete this equipment?')) return;

    showLoading();
    const result = await window.api.equipment.delete(equipmentId);
    hideLoading();

    if (result.success) {
        showAlert('Equipment deleted', 'success');
        navigateTo('equipment'); // Reload
    } else {
        showAlert('Failed to delete equipment', 'danger');
    }
}

// Expose functions globally
window.loadEquipmentView = loadEquipmentView;
window.initializeEquipment = initializeEquipment;
window.showAddEquipmentModal = showAddEquipmentModal;
window.editEquipment = editEquipment;
window.handleSaveEquipment = handleSaveEquipment;
window.deleteEquipment = deleteEquipment;
