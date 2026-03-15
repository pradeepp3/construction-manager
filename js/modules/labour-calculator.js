// Labour Cost Calculator Module

function calculateWageCost() {
    const workers = parseInt(document.getElementById('calc_workers').value) || 0;
    const wage = parseFloat(document.getElementById('calc_wage').value) || 0;
    const days = parseInt(document.getElementById('calc_days').value) || 0;

    const totalCost = workers * wage * days;
    const perWorkerCost = wage * days;

    const resultDiv = document.getElementById('wageResult');
    resultDiv.innerHTML = `
        <div class="card" style="background: var(--bg-tertiary); margin-top: 1rem;">
            <h4 style="color: var(--primary); margin-bottom: 1rem;">Calculation Results</h4>
            <div style="display: grid; gap: 0.75rem;">
                <div class="flex-between">
                    <span>Workers:</span>
                    <strong>${workers}</strong>
                </div>
                <div class="flex-between">
                    <span>Daily Wage:</span>
                    <strong>${formatCurrency(wage)}</strong>
                </div>
                <div class="flex-between">
                    <span>Number of Days:</span>
                    <strong>${days}</strong>
                </div>
                <div class="flex-between">
                    <span>Cost per Worker:</span>
                    <strong>${formatCurrency(perWorkerCost)}</strong>
                </div>
                <hr style="border-color: var(--border);">
                <div class="flex-between" style="font-size: 1.25rem;">
                    <span>Total Labour Cost:</span>
                    <strong style="color: var(--success);">${formatCurrency(totalCost)}</strong>
                </div>
            </div>
        </div>
    `;
}

function calculateSqftCost() {
    const area = parseFloat(document.getElementById('calc_area').value) || 0;
    const rate = parseFloat(document.getElementById('calc_rate').value) || 0;

    const totalCost = area * rate;

    const resultDiv = document.getElementById('sqftResult');
    resultDiv.innerHTML = `
        <div class="card" style="background: var(--bg-tertiary); margin-top: 1rem;">
            <h4 style="color: var(--primary); margin-bottom: 1rem;">Calculation Results</h4>
            <div style="display: grid; gap: 0.75rem;">
                <div class="flex-between">
                    <span>Total Area:</span>
                    <strong>${area.toLocaleString()} sq ft</strong>
                </div>
                <div class="flex-between">
                    <span>Rate per Sq Ft:</span>
                    <strong>${formatCurrency(rate)}</strong>
                </div>
                <hr style="border-color: var(--border);">
                <div class="flex-between" style="font-size: 1.25rem;">
                    <span>Total Cost:</span>
                    <strong style="color: var(--success);">${formatCurrency(totalCost)}</strong>
                </div>
            </div>
            <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(37, 99, 235, 0.1); border-radius: 0.5rem;">
                <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
                    💡 This calculation is based on area and rate. Actual labour costs may vary based on complexity, 
                    worker skill level, and project requirements.
                </p>
            </div>
        </div>
    `;
}

// Expose functions globally
window.calculateWageCost = calculateWageCost;
window.calculateSqftCost = calculateSqftCost;
