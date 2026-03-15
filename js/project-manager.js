// Project Management Module

let allProjects = [];

async function loadProjectsView() {
    const result = await window.api.projects.getAll();
    if (result.success) { allProjects = result.data; } else { allProjects = []; }

    const financialSummaries = {};
    if (allProjects.length > 0) {
        const summaryResults = await Promise.allSettled(
            allProjects.map(project => window.api.finance.getSummary(project._id))
        );

        summaryResults.forEach((entry, index) => {
            const projectId = allProjects[index]._id;
            if (entry.status === 'fulfilled' && entry.value && entry.value.success) {
                financialSummaries[projectId] = normalizeFinancialSummary(entry.value.data);
            } else {
                financialSummaries[projectId] = normalizeFinancialSummary();
            }
        });
    }

    return `
        <div class="projects-container animate-fade-in">
            <div class="card-header" style="margin-bottom:1.5rem;">
                <div>
                    <h2 class="card-title" style="font-size:1.35rem;">
                        <i class="ph ph-buildings"></i> My Projects
                    </h2>
                    <div style="font-size:.8rem;color:var(--text-muted);margin-top:.2rem;">Manage and switch between your construction projects</div>
                </div>
                <button class="btn btn-primary" onclick="showAddProjectModal()">
                    <i class="ph ph-plus"></i> New Project
                </button>
            </div>
            <div class="grid grid-3" id="projectsGrid">
                ${renderProjectCards(financialSummaries)}
            </div>
        </div>

        <!-- Add Project Modal -->
        <div id="addProjectModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title"><i class="ph ph-plus-circle"></i> Create New Project</h3>
                    <button class="modal-close" onclick="hideModal('addProjectModal')"><i class="ph ph-x"></i></button>
                </div>
                <form id="addProjectForm" onsubmit="event.preventDefault(); handleAddProject();">
                    <div class="form-group">
                        <label class="form-label">Project Name</label>
                        <input type="text" id="projectName" class="form-input" placeholder="e.g., Chennai Residential Phase 2" required />
                    </div>
                    <div class="grid grid-2 gap">
                        <div class="form-group">
                            <label class="form-label">Location</label>
                            <input type="text" id="projectLocation" class="form-input" placeholder="City, District" required />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Start Date</label>
                            <input type="date" id="projectStartDate" class="form-input" required />
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Cover Image URL <span style="color:var(--text-muted);font-weight:400;text-transform:none;">(optional)</span></label>
                        <input type="url" id="projectImage" class="form-input" placeholder="https://example.com/site.jpg" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <textarea id="projectDescription" class="form-textarea" placeholder="Brief project overview..."></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Total Budget (₹)</label>
                        <input type="number" id="projectBudget" class="form-input" step="0.01" placeholder="Enter total budget" required onchange="updateRemainingBudget()" />
                    </div>
                    <div style="background:var(--bg-card-2);border:1px solid var(--border);border-radius:var(--r-lg);padding:1rem;margin-bottom:1rem;">
                        <div style="font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.75rem;">Budget Breakdown</div>
                        <div class="grid grid-2 gap" style="gap:.75rem;">
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="form-label">Labour</label>
                                <input type="number" id="budgetLabour" class="form-input" step="0.01" value="0" onchange="updateRemainingBudget()" />
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="form-label">Materials</label>
                                <input type="number" id="budgetMaterials" class="form-input" step="0.01" value="0" onchange="updateRemainingBudget()" />
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="form-label">Equipment</label>
                                <input type="number" id="budgetEquipment" class="form-input" step="0.01" value="0" onchange="updateRemainingBudget()" />
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="form-label">Other</label>
                                <input type="number" id="budgetOther" class="form-input" step="0.01" value="0" onchange="updateRemainingBudget()" />
                            </div>
                        </div>
                        <div style="margin-top:.75rem;display:flex;justify-content:space-between;font-size:.82rem;color:var(--text-muted);">
                            <span>Remaining: <strong id="remainingBudgetDisplay" style="color:var(--text-primary);">₹0.00</strong></span>
                            <span id="allocationStatus"></span>
                        </div>
                    </div>
                    <div class="flex gap">
                        <button type="button" class="btn btn-outline" onclick="hideModal('addProjectModal')">Cancel</button>
                        <button type="submit" class="btn btn-primary"><i class="ph ph-check"></i> Create Project</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function renderProjectCards(financialSummaries = {}) {
    if (allProjects.length === 0) {
        return `
            <div style="grid-column:1/-1;text-align:center;padding:4rem 2rem;">
                <div style="width:80px;height:80px;border-radius:var(--r-xl);background:var(--bg-hover);display:inline-flex;align-items:center;justify-content:center;margin-bottom:1.25rem;">
                    <i class="ph ph-buildings" style="font-size:2.5rem;color:var(--text-muted);"></i>
                </div>
                <h3 style="color:var(--text-secondary);font-size:1.1rem;margin-bottom:.5rem;">No projects yet</h3>
                <p style="color:var(--text-muted);font-size:.875rem;margin-bottom:1.5rem;">Create your first project to get started</p>
                <button class="btn btn-primary" onclick="showAddProjectModal()">
                    <i class="ph ph-plus"></i> Create First Project
                </button>
            </div>`;
    }

    const projectColors = [
        'linear-gradient(135deg,#F59E0B,#D97706)',
        'linear-gradient(135deg,#3B82F6,#1D4ED8)',
        'linear-gradient(135deg,#10B981,#047857)',
        'linear-gradient(135deg,#8B5CF6,#6D28D9)',
        'linear-gradient(135deg,#F43F5E,#BE123C)',
        'linear-gradient(135deg,#06B6D4,#0891B2)',
    ];

    return allProjects.map((project, idx) => {
        const isSelected = AppState.currentProject && AppState.currentProject._id === project._id;
        const fallbackGrad = projectColors[idx % projectColors.length];
        const hasImage = project.image && project.image.trim().length > 0;
        const budget = toNumber(project.budget);
        const summary = financialSummaries[project._id] || normalizeFinancialSummary();
        const spent = toNumber(summary.totalCost);
        const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

        const imgSection = hasImage
            ? `<div style="height:160px;overflow:hidden;border-radius:var(--r-lg) var(--r-lg) 0 0;position:relative;">
                 <img src="${escapeHtml(project.image)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                 <div style="display:none;height:160px;width:100%;background:${fallbackGrad};align-items:center;justify-content:center;position:absolute;top:0;">
                     <i class="ph ph-buildings" style="font-size:3.5rem;color:rgba(0,0,0,0.4);"></i>
                 </div>
                 <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 30%,rgba(6,6,10,.75) 100%);border-radius:var(--r-lg) var(--r-lg) 0 0;"></div>
               </div>`
            : `<div style="height:160px;background:${fallbackGrad};border-radius:var(--r-lg) var(--r-lg) 0 0;display:flex;align-items:center;justify-content:center;position:relative;">
                 <i class="ph ph-buildings" style="font-size:4rem;color:rgba(0,0,0,0.25);"></i>
                 <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 30%,rgba(6,6,10,.4) 100%);border-radius:var(--r-lg) var(--r-lg) 0 0;"></div>
               </div>`;

        return `
        <div style="cursor:pointer;border-radius:var(--r-lg);background:var(--bg-card);border:2px solid ${isSelected ? 'var(--brand)' : 'var(--border)'};overflow:hidden;transition:all .22s var(--ease);box-shadow:${isSelected ? 'var(--shadow-glow)' : 'var(--shadow-card)'};position:relative;"
             onclick="selectProject('${project._id}')"
             onmouseenter="this.style.transform='translateY(-4px)';this.style.boxShadow='${isSelected ? 'var(--shadow-glow)' : '0 12px 32px rgba(0,0,0,.5)'}';"
             onmouseleave="this.style.transform='';this.style.boxShadow='${isSelected ? 'var(--shadow-glow)' : 'var(--shadow-card)'}'">
            ${imgSection}
            ${isSelected ? `<div style="position:absolute;top:12px;right:12px;background:var(--brand);color:#000;font-size:.65rem;font-weight:800;padding:.25rem .65rem;border-radius:var(--r-full);letter-spacing:.06em;text-transform:uppercase;">Active</div>` : ''}
            <div style="padding:1rem;">
                <h3 style="font-size:1rem;font-weight:700;color:var(--text-primary);margin-bottom:.5rem;letter-spacing:-.01em;">${escapeHtml(project.name)}</h3>
                <div style="display:flex;flex-direction:column;gap:.4rem;">
                    <div style="display:flex;align-items:center;gap:.5rem;font-size:.83rem;color:var(--text-secondary);">
                        <i class="ph ph-map-pin" style="color:var(--brand);"></i>
                        <span>${escapeHtml(project.location)}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:.5rem;font-size:.83rem;color:var(--text-secondary);">
                        <i class="ph ph-currency-inr" style="color:var(--success);"></i>
                        <span style="font-family:var(--font-mono);font-weight:600;color:var(--success);">${formatCurrency(budget)}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:.5rem;font-size:.83rem;color:var(--text-muted);">
                        <i class="ph ph-calendar-blank" style="color:var(--info);"></i>
                        <span>${formatDate(project.startDate)}</span>
                    </div>
                </div>
                <div style="margin-top:.75rem;">
                    <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-muted);margin-bottom:.3rem;">
                        <span>Budget Used</span><span>${pct.toFixed(0)}%</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text-secondary);margin-bottom:.35rem;">
                        <span>Spent: ${formatCurrency(spent)}</span>
                        <span>${budget > 0 ? `of ${formatCurrency(budget)}` : 'No budget set'}</span>
                    </div>
                    <div style="height:4px;background:var(--bg-hover);border-radius:var(--r-full);overflow:hidden;">
                        <div style="height:100%;width:${pct}%;background:${pct > 90 ? 'var(--danger)' : pct > 70 ? 'var(--warning)' : 'var(--brand)'};border-radius:var(--r-full);"></div>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function initializeProjects() {
    // Event handlers are set up via inline onclick
}

function showAddProjectModal() {
    showModal('addProjectModal');
}

async function handleAddProject() {
    try {
        const name = document.getElementById('projectName').value.trim();
        const location = document.getElementById('projectLocation').value.trim();
        const budget = parseFloat(document.getElementById('projectBudget').value);
        const budgetLabour = parseFloat(document.getElementById('budgetLabour').value) || 0;
        const budgetMaterials = parseFloat(document.getElementById('budgetMaterials').value) || 0;
        const budgetEquipment = parseFloat(document.getElementById('budgetEquipment').value) || 0;
        const budgetOther = parseFloat(document.getElementById('budgetOther').value) || 0;

        const startDate = document.getElementById('projectStartDate').value;

        // Validation
        if (!name) {
            showAlert('Please enter project name', 'warning');
            document.getElementById('projectName').focus();
            return;
        }

        if (!location) {
            showAlert('Please enter project location', 'warning');
            document.getElementById('projectLocation').focus();
            return;
        }

        if (isNaN(budget) || budget <= 0) {
            showAlert('Please enter a valid total budget amount', 'warning');
            document.getElementById('projectBudget').focus();
            return;
        }

        const totalAllocated = budgetLabour + budgetMaterials + budgetEquipment + budgetOther;
        if (Math.abs(budget - totalAllocated) > 1) { // Allow 1 rupee floating point difference
            if (!confirm(`Total allocated budget (${formatCurrency(totalAllocated)}) does not match Total Budget (${formatCurrency(budget)}). Do you want to proceed anyway?`)) {
                return;
            }
        }

        if (!startDate) {
            showAlert('Please select a start date', 'warning');
            document.getElementById('projectStartDate').focus();
            return;
        }

        const startYear = new Date(startDate).getFullYear();
        if (isNaN(startYear) || startYear < 1900 || startYear > 2100) {
            showAlert('Please enter a valid year between 1900 and 2100', 'warning');
            document.getElementById('projectStartDate').focus();
            return;
        }

        const projectData = {
            name: name,
            location: location,
            description: document.getElementById('projectDescription').value.trim(),
            budget: budget,
            image: document.getElementById('projectImage').value.trim(),
            budgetBreakdown: {
                labour: budgetLabour,
                materials: budgetMaterials,
                equipment: budgetEquipment,
                other: budgetOther
            },
            startDate: startDate,
            createdAt: new Date()
        };

        showLoading();
        const result = await window.api.projects.create(projectData);
        hideLoading();

        if (result && result.success) {
            showAlert('Project created successfully!', 'success');
            hideModal('addProjectModal');
            document.getElementById('addProjectForm').reset();
            // Reload view to show new project
            const updatedContent = await loadProjectsView();
            document.getElementById('view-container').innerHTML = updatedContent;
        } else {
            throw new Error(result ? result.message : 'Unknown error occurred');
        }
    } catch (error) {
        hideLoading();
        console.error('Error creating project:', error);
        showAlert('Failed to create project: ' + error.message, 'danger');
    }
}

async function selectProject(projectId) {
    console.log('Selecting project:', projectId);
    showLoading();
    const result = await window.api.projects.getById(projectId);
    console.log('Selection result:', result);
    hideLoading();

    if (result.success && result.data) {
        setCurrentProject(result.data);
        // Show success alert
        showAlert('Project selected: ' + result.data.name, 'success');

        // Navigate to the new Dashboard view
        navigateTo('dashboard');
    } else {
        console.error('Project selection failed:', result);
        showAlert('Failed to select project: ' + (result.message || 'Project not found'), 'danger');
    }
}

function updateRemainingBudget() {
    const total = parseFloat(document.getElementById('projectBudget').value) || 0;
    const l = parseFloat(document.getElementById('budgetLabour').value) || 0;
    const m = parseFloat(document.getElementById('budgetMaterials').value) || 0;
    const e = parseFloat(document.getElementById('budgetEquipment').value) || 0;
    const o = parseFloat(document.getElementById('budgetOther').value) || 0;

    const allocated = l + m + e + o;
    const remaining = total - allocated;

    const display = document.getElementById('remainingBudgetDisplay');
    const status = document.getElementById('allocationStatus');

    if (display) display.textContent = formatCurrency(remaining);

    if (status) {
        if (remaining === 0) {
            status.textContent = '✓ Fully Allocated';
            status.style.color = 'var(--success)';
        } else if (remaining > 0) {
            status.textContent = 'Unallocated';
            status.style.color = 'var(--warning)';
        } else {
            status.textContent = '⚠ Over Budget';
            status.style.color = 'var(--danger)';
        }
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Expose functions globally
window.loadProjectsView = loadProjectsView;
window.initializeProjects = initializeProjects;
window.showAddProjectModal = showAddProjectModal;
window.handleAddProject = handleAddProject;
window.selectProject = selectProject;
window.updateRemainingBudget = updateRemainingBudget;
window.escapeHtml = escapeHtml;
