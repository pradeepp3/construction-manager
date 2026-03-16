const { getDatabase } = require('./connection');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

function toNumber(value, fallback = 0) {
    const num = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(num) ? num : fallback;
}

function sanitizeProjectPayload(data = {}) {
    const payload = { ...data };

    if ('budget' in payload) payload.budget = toNumber(payload.budget);

    if ('budgetBreakdown' in payload) {
        const breakdown = payload.budgetBreakdown || {};
        payload.budgetBreakdown = {
            labour: toNumber(breakdown.labour),
            materials: toNumber(breakdown.materials),
            equipment: toNumber(breakdown.equipment),
            other: toNumber(breakdown.other)
        };
    }

    return payload;
}

function sanitizeWorkerPayload(data = {}) {
    const payload = { ...data };
    if ('dailyWage' in payload) payload.dailyWage = toNumber(payload.dailyWage);
    if ('daysWorked' in payload) payload.daysWorked = toNumber(payload.daysWorked);
    if ('sqftRate' in payload) payload.sqftRate = toNumber(payload.sqftRate);
    if ('sqftArea' in payload) payload.sqftArea = toNumber(payload.sqftArea);
    if ('totalCost' in payload) payload.totalCost = toNumber(payload.totalCost);
    if ('totalCapital' in payload) payload.totalCapital = toNumber(payload.totalCapital);
    return payload;
}

function sanitizeMaterialPayload(data = {}) {
    const payload = { ...data };
    if ('quantity' in payload) payload.quantity = toNumber(payload.quantity);
    if ('unitPrice' in payload) payload.unitPrice = toNumber(payload.unitPrice);
    if ('totalCost' in payload) payload.totalCost = toNumber(payload.totalCost);
    return payload;
}

function sanitizeEquipmentPayload(data = {}) {
    const payload = { ...data };
    if ('totalCost' in payload) payload.totalCost = toNumber(payload.totalCost);
    if ('rentalRate' in payload) payload.rentalRate = toNumber(payload.rentalRate);
    return payload;
}

function normalizeProject(project) {
    if (!project) return null;
    const breakdown = project.budgetBreakdown || {};
    return {
        ...project,
        _id: project._id.toString(),
        budget: toNumber(project.budget),
        budgetBreakdown: {
            labour: toNumber(breakdown.labour),
            materials: toNumber(breakdown.materials),
            equipment: toNumber(breakdown.equipment),
            other: toNumber(breakdown.other)
        }
    };
}

function normalizeWorker(worker) {
    if (!worker) return null;
    return {
        ...worker,
        _id: worker._id.toString(),
        dailyWage: toNumber(worker.dailyWage),
        daysWorked: toNumber(worker.daysWorked),
        sqftRate: toNumber(worker.sqftRate),
        sqftArea: toNumber(worker.sqftArea),
        totalCost: toNumber(worker.totalCost),
        totalCapital: toNumber(worker.totalCapital)
    };
}

function normalizeMaterial(material) {
    if (!material) return null;
    return {
        ...material,
        _id: material._id.toString(),
        quantity: toNumber(material.quantity),
        unitPrice: toNumber(material.unitPrice),
        totalCost: toNumber(material.totalCost)
    };
}

function normalizeEquipment(item) {
    if (!item) return null;
    return {
        ...item,
        _id: item._id.toString(),
        totalCost: toNumber(item.totalCost),
        rentalRate: toNumber(item.rentalRate)
    };
}

function normalizeExpense(expense) {
    if (!expense) return null;
    return {
        ...expense,
        _id: expense._id.toString(),
        amount: toNumber(expense.amount)
    };
}

// ==================== AUTHENTICATION ====================

async function authenticateUser(credentials) {
    const db = getDatabase();
    const users = db.collection('users');

    console.log('Authenticating user:', credentials.username);
    console.log('Password provided:', credentials.password);

    const user = await users.findOne({ username: credentials.username });

    if (!user) {
        console.log('User not found');
        return null;
    }

    if (user.password === credentials.password) {
        console.log('In-memory database detected. Password matched directly.');
        return user;
    }

    const isMatch = await bcrypt.compare(credentials.password, user.password);
    console.log('Password match result:', isMatch);
    return isMatch ? user : null;
}

// ==================== PROJECTS ====================

async function getAllProjects() {
    const db = getDatabase();
    const projects = db.collection('projects');
    const results = await projects.find({}).toArray();
    return results.map(normalizeProject);
}

async function createProject(projectData) {
    const db = getDatabase();
    const projects = db.collection('projects');

    const newProject = {
        ...sanitizeProjectPayload(projectData),
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await projects.insertOne(newProject);
    return normalizeProject({ ...newProject, _id: result.insertedId });
}

async function getProjectById(projectId) {
    const db = getDatabase();
    const projects = db.collection('projects');

    try {
        const id = typeof projectId === 'string' ? new ObjectId(projectId) : projectId;
        const project = await projects.findOne({ _id: id });
        return normalizeProject(project);
    } catch (error) {
        const project = await projects.findOne({ _id: projectId });
        return normalizeProject(project);
    }
}

async function updateProject(projectId, updates) {
    const db = getDatabase();
    const projects = db.collection('projects');

    try {
        const id = typeof projectId === 'string' ? new ObjectId(projectId) : projectId;
        const sanitizedUpdates = sanitizeProjectPayload(updates);
        await projects.updateOne(
            { _id: id },
            { $set: { ...sanitizedUpdates, updatedAt: new Date() } }
        );
        return await getProjectById(projectId);
    } catch (error) {
        const sanitizedUpdates = sanitizeProjectPayload(updates);
        await projects.updateOne(
            { _id: projectId },
            { $set: { ...sanitizedUpdates, updatedAt: new Date() } }
        );
        return await getProjectById(projectId);
    }
}

async function deleteProject(projectId) {
    const db = getDatabase();
    const projects = db.collection('projects');

    try {
        const id = typeof projectId === 'string' ? new ObjectId(projectId) : projectId;
        await projects.deleteOne({ _id: id });
    } catch (error) {
        await projects.deleteOne({ _id: projectId });
    }
}

// ==================== LABOUR/WORKERS ====================

async function getAllWorkers(projectId) {
    const db = getDatabase();
    const workers = db.collection('workers');
    const results = await workers.find({ projectId }).toArray();
    return results.map(normalizeWorker);
}

async function createWorker(workerData) {
    const db = getDatabase();
    const workers = db.collection('workers');

    const newWorker = {
        ...sanitizeWorkerPayload(workerData),
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await workers.insertOne(newWorker);
    return normalizeWorker({ ...newWorker, _id: result.insertedId });
}

async function updateWorker(workerId, updates) {
    const db = getDatabase();
    const workers = db.collection('workers');

    try {
        const id = typeof workerId === 'string' ? new ObjectId(workerId) : workerId;
        const sanitizedUpdates = sanitizeWorkerPayload(updates);
        await workers.updateOne(
            { _id: id },
            { $set: { ...sanitizedUpdates, updatedAt: new Date() } }
        );
        const updated = await workers.findOne({ _id: id });
        return normalizeWorker(updated);
    } catch (error) {
        const sanitizedUpdates = sanitizeWorkerPayload(updates);
        await workers.updateOne(
            { _id: workerId },
            { $set: { ...sanitizedUpdates, updatedAt: new Date() } }
        );
        const updated = await workers.findOne({ _id: workerId });
        return normalizeWorker(updated);
    }
}

async function deleteWorker(workerId) {
    const db = getDatabase();
    const workers = db.collection('workers');

    try {
        const id = typeof workerId === 'string' ? new ObjectId(workerId) : workerId;
        await workers.deleteOne({ _id: id });
    } catch (error) {
        await workers.deleteOne({ _id: workerId });
    }
}

// ==================== MATERIALS ====================

async function getAllMaterials(projectId) {
    const db = getDatabase();
    const materials = db.collection('materials');
    const results = await materials.find({ projectId }).toArray();
    return results.map(normalizeMaterial);
}

async function createMaterial(materialData) {
    const db = getDatabase();
    const materials = db.collection('materials');

    const newMaterial = {
        ...sanitizeMaterialPayload(materialData),
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await materials.insertOne(newMaterial);
    return normalizeMaterial({ ...newMaterial, _id: result.insertedId });
}

async function updateMaterial(materialId, updates) {
    const db = getDatabase();
    const materials = db.collection('materials');

    try {
        const id = typeof materialId === 'string' ? new ObjectId(materialId) : materialId;
        const sanitizedUpdates = sanitizeMaterialPayload(updates);
        await materials.updateOne(
            { _id: id },
            { $set: { ...sanitizedUpdates, updatedAt: new Date() } }
        );
        const updated = await materials.findOne({ _id: id });
        return normalizeMaterial(updated);
    } catch (error) {
        const sanitizedUpdates = sanitizeMaterialPayload(updates);
        await materials.updateOne(
            { _id: materialId },
            { $set: { ...sanitizedUpdates, updatedAt: new Date() } }
        );
        const updated = await materials.findOne({ _id: materialId });
        return normalizeMaterial(updated);
    }
}

async function deleteMaterial(materialId) {
    const db = getDatabase();
    const materials = db.collection('materials');

    try {
        const id = typeof materialId === 'string' ? new ObjectId(materialId) : materialId;
        await materials.deleteOne({ _id: id });
    } catch (error) {
        await materials.deleteOne({ _id: materialId });
    }
}

// ==================== EQUIPMENT ====================

async function getAllEquipment(projectId) {
    const db = getDatabase();
    const equipment = db.collection('equipment');
    const results = await equipment.find({ projectId }).toArray();
    return results.map(normalizeEquipment);
}

async function createEquipment(equipmentData) {
    const db = getDatabase();
    const equipment = db.collection('equipment');

    const newEquipment = {
        ...sanitizeEquipmentPayload(equipmentData),
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await equipment.insertOne(newEquipment);
    return normalizeEquipment({ ...newEquipment, _id: result.insertedId });
}

async function updateEquipment(equipmentId, updates) {
    const db = getDatabase();
    const equipment = db.collection('equipment');

    try {
        const id = typeof equipmentId === 'string' ? new ObjectId(equipmentId) : equipmentId;
        const sanitizedUpdates = sanitizeEquipmentPayload(updates);
        await equipment.updateOne(
            { _id: id },
            { $set: { ...sanitizedUpdates, updatedAt: new Date() } }
        );
        const updated = await equipment.findOne({ _id: id });
        return normalizeEquipment(updated);
    } catch (error) {
        const sanitizedUpdates = sanitizeEquipmentPayload(updates);
        await equipment.updateOne(
            { _id: equipmentId },
            { $set: { ...sanitizedUpdates, updatedAt: new Date() } }
        );
        const updated = await equipment.findOne({ _id: equipmentId });
        return normalizeEquipment(updated);
    }
}

async function deleteEquipment(equipmentId) {
    const db = getDatabase();
    const equipment = db.collection('equipment');

    try {
        const id = typeof equipmentId === 'string' ? new ObjectId(equipmentId) : equipmentId;
        await equipment.deleteOne({ _id: id });
    } catch (error) {
        await equipment.deleteOne({ _id: equipmentId });
    }
}

// ==================== FINANCE ====================

async function getAllExpenses(projectId) {
    const db = getDatabase();
    const expenses = db.collection('expenses');
    const results = await expenses.find({ projectId }).toArray();
    return results.map(normalizeExpense);
}

async function createExpense(expenseData) {
    const db = getDatabase();
    const expenses = db.collection('expenses');

    const newExpense = {
        ...expenseData,
        amount: toNumber(expenseData.amount),
        createdAt: new Date()
    };

    const result = await expenses.insertOne(newExpense);
    return normalizeExpense({ ...newExpense, _id: result.insertedId });
}

async function updateExpense(expenseId, updates) {
    const db = getDatabase();
    const expenses = db.collection('expenses');
    const sanitizedUpdates = {
        ...updates,
        amount: 'amount' in updates ? toNumber(updates.amount) : updates.amount,
        updatedAt: new Date()
    };

    try {
        const id = typeof expenseId === 'string' ? new ObjectId(expenseId) : expenseId;
        await expenses.updateOne({ _id: id }, { $set: sanitizedUpdates });
        const updated = await expenses.findOne({ _id: id });
        return normalizeExpense(updated);
    } catch (error) {
        await expenses.updateOne({ _id: expenseId }, { $set: sanitizedUpdates });
        const updated = await expenses.findOne({ _id: expenseId });
        return normalizeExpense(updated);
    }
}

async function deleteExpense(expenseId) {
    const db = getDatabase();
    const expenses = db.collection('expenses');

    try {
        const id = typeof expenseId === 'string' ? new ObjectId(expenseId) : expenseId;
        await expenses.deleteOne({ _id: id });
    } catch (error) {
        await expenses.deleteOne({ _id: expenseId });
    }
}

async function getFinancialSummary(projectId) {
    const db = getDatabase();

    // ── Legacy workers collection (old labour module) ──────────
    const workers = await db.collection('workers').find({ projectId }).toArray();
    const legacyLabour = workers.reduce((sum, w) => {
        const cost = w.wageType === 'sqft'
            ? toNumber(w.sqftRate) * toNumber(w.sqftArea)
            : toNumber(w.dailyWage) * toNumber(w.daysWorked);
        return sum + (parseFloat(cost) || 0);
    }, 0);

    // ── New labour module collections ──────────────────────────
    const [masonryEntries, centringEntries, concreteEntries,
        epEntries, tilesEntries, paintingEntries] = await Promise.all([
            db.collection('masonry_entries').find({ projectId }).toArray(),
            db.collection('centring_entries').find({ projectId }).toArray(),
            db.collection('concrete_entries').find({ projectId }).toArray(),
            db.collection('ep_entries').find({ projectId }).toArray(),
            db.collection('tiles_entries').find({ projectId }).toArray(),
            db.collection('painting_entries').find({ projectId }).toArray(),
        ]);

    const masonryCost = masonryEntries.reduce((s, e) => s + toNumber(e.wageAmount), 0);
    const centringCost = centringEntries.reduce((s, e) => s + toNumber(e.wageAmount), 0);
    const concreteCost = concreteEntries.reduce((s, e) => s + toNumber(e.amount), 0);
    const epCost = epEntries.reduce((s, e) => s + toNumber(e.amount), 0);
    const tilesCost = tilesEntries.reduce((s, e) => s + toNumber(e.wageAmount), 0);
    const paintingCost = paintingEntries.reduce((s, e) => s + toNumber(e.wageAmount), 0);

    const newLabourCost = masonryCost + centringCost + concreteCost + epCost + tilesCost + paintingCost;
    const labourCost = legacyLabour + newLabourCost;

    // ── Materials ──────────────────────────────────────────────
    const materials = await db.collection('materials').find({ projectId }).toArray();
    const materialCost = materials.reduce((sum, m) => sum + (parseFloat(m.totalCost) || 0), 0);

    // ── Equipment ──────────────────────────────────────────────
    const equipment = await db.collection('equipment').find({ projectId }).toArray();
    const equipmentCost = equipment.reduce((sum, e) => sum + (parseFloat(e.totalCost) || 0), 0);

    // ── Other expenses ─────────────────────────────────────────
    const expenses = await db.collection('expenses').find({ projectId }).toArray();
    const otherExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    return {
        labourCost,
        materialCost,
        equipmentCost,
        otherExpenses,
        totalCost: labourCost + materialCost + equipmentCost + otherExpenses,
        // Breakdown for debugging
        _labourBreakdown: { legacyLabour, masonryCost, centringCost, concreteCost, epCost, tilesCost, paintingCost }
    };
}

// ==================== CONFIGURATION ====================

async function getConfiguration() {
    const db = getDatabase();
    const config = db.collection('config');

    let cfg = await config.findOne({ type: 'app-config' });

    if (!cfg) {
        cfg = {
            type: 'app-config',
            dbPath: '',
            theme: 'dark',
            createdAt: new Date()
        };
        await config.insertOne(cfg);
    }

    return cfg;
}

async function updateConfiguration(updates) {
    const db = getDatabase();
    const config = db.collection('config');

    await config.updateOne(
        { type: 'app-config' },
        { $set: { ...updates, updatedAt: new Date() } },
        { upsert: true }
    );

    return await getConfiguration();
}

// ==================== ELECTRICIAN MEMBERS ====================

async function getElectricianMembers(workerId) {
    const db = getDatabase();
    const members = db.collection('electrician_members');
    const results = await members.find({ workerId }).sort({ createdAt: 1 }).toArray();
    return results.map(m => ({
        ...m,
        _id: m._id.toString()
    }));
}

async function addElectricianMember(memberData) {
    const db = getDatabase();
    const members = db.collection('electrician_members');
    const newMember = { ...memberData, createdAt: new Date() };
    const result = await members.insertOne(newMember);
    return { ...newMember, _id: result.insertedId.toString() };
}

async function deleteElectricianMember(memberId) {
    const db = getDatabase();
    const members = db.collection('electrician_members');
    const payments = db.collection('electrician_payments');
    try {
        const id = typeof memberId === 'string' ? new ObjectId(memberId) : memberId;
        // Cascade delete all payments for this member
        await payments.deleteMany({ memberId: memberId });
        await members.deleteOne({ _id: id });
    } catch (error) {
        await payments.deleteMany({ memberId: memberId });
        await members.deleteOne({ _id: memberId });
    }
}

// ==================== ELECTRICIAN WEEKLY PAYMENTS ====================

async function getElectricianPayments(memberId) {
    const db = getDatabase();
    const payments = db.collection('electrician_payments');
    const results = await payments.find({ memberId }).sort({ createdAt: 1 }).toArray();
    return results.map(p => ({
        ...p,
        _id: p._id.toString()
    }));
}

async function addElectricianPayment(paymentData) {
    const db = getDatabase();
    const payments = db.collection('electrician_payments');
    const newPayment = { ...paymentData, createdAt: new Date() };
    const result = await payments.insertOne(newPayment);
    return { ...newPayment, _id: result.insertedId.toString() };
}

async function deleteElectricianPayment(paymentId) {
    const db = getDatabase();
    const payments = db.collection('electrician_payments');
    try {
        const id = typeof paymentId === 'string' ? new ObjectId(paymentId) : paymentId;
        await payments.deleteOne({ _id: id });
    } catch (error) {
        await payments.deleteOne({ _id: paymentId });
    }
}

// ============================================================
// LABOUR OPERATIONS - Add this to db/operations.js
// ============================================================
// Paste these functions into your existing operations.js file,
// before the module.exports at the bottom.
// Also add all function names to the module.exports object.
// ============================================================

// -- MASONRY -------------------------------------------------

async function getMasonryTeams(projectId) {
    const db = getDatabase();
    const teams = await db.collection('masonry_teams').find({ projectId }).sort({ createdAt: 1 }).toArray();
    const entries = await db.collection('masonry_entries').find({ projectId }).sort({ date: 1 }).toArray();
    return teams.map(t => ({
        ...t,
        _id: t._id.toString(),
        entries: entries.filter(e => e.teamId === t._id.toString()).map(e => ({ ...e, _id: e._id.toString() }))
    }));
}

async function createMasonryTeam(data) {
    const db = getDatabase();
    const doc = { ...data, members: [], createdAt: new Date() };
    const r = await db.collection('masonry_teams').insertOne(doc);
    return { ...doc, _id: r.insertedId.toString() };
}

async function updateMasonryTeam(teamId, updates) {
    const db = getDatabase();
    await db.collection('masonry_teams').updateOne(
        { _id: new ObjectId(teamId) },
        { $set: updates }
    );
    const updated = await db.collection('masonry_teams').findOne({ _id: new ObjectId(teamId) });
    return { ...updated, _id: updated._id.toString() };
}

async function deleteMasonryTeam(teamId) {
    const db = getDatabase();
    const id = new ObjectId(teamId);
    await db.collection('masonry_entries').deleteMany({ teamId: teamId });
    await db.collection('masonry_teams').deleteOne({ _id: id });
}

async function addMasonryEntry(data) {
    const db = getDatabase();
    const doc = { ...data, shiftCount: toNumber(data.shiftCount), wageAmount: toNumber(data.wageAmount), createdAt: new Date() };
    const r = await db.collection('masonry_entries').insertOne(doc);
    return { ...doc, _id: r.insertedId.toString() };
}

async function deleteMasonryEntry(entryId) {
    const db = getDatabase();
    await db.collection('masonry_entries').deleteOne({ _id: new ObjectId(entryId) });
}

async function getMasonryEntries(teamId) {
    const db = getDatabase();
    const entries = await db.collection('masonry_entries').find({ teamId }).sort({ date: 1 }).toArray();
    return entries.map(e => ({ ...e, _id: e._id.toString() }));
}

async function getAllMasonryEntries(projectId) {
    const db = getDatabase();
    const entries = await db.collection('masonry_entries').find({ projectId }).sort({ date: 1 }).toArray();
    return entries.map(e => ({ ...e, _id: e._id.toString() }));
}

// -- CENTRING -------------------------------------------------

async function getCentringTeams(projectId) {
    const db = getDatabase();
    const teams = await db.collection('centring_teams').find({ projectId }).sort({ createdAt: 1 }).toArray();
    const entries = await db.collection('centring_entries').find({ projectId }).sort({ date: 1 }).toArray();
    return teams.map(t => ({
        ...t,
        _id: t._id.toString(),
        entries: entries.filter(e => e.teamId === t._id.toString()).map(e => ({ ...e, _id: e._id.toString() }))
    }));
}

async function createCentringTeam(data) {
    const db = getDatabase();
    const doc = { ...data, members: [], createdAt: new Date() };
    const r = await db.collection('centring_teams').insertOne(doc);
    return { ...doc, _id: r.insertedId.toString() };
}

async function updateCentringTeam(teamId, updates) {
    const db = getDatabase();
    await db.collection('centring_teams').updateOne(
        { _id: new ObjectId(teamId) },
        { $set: updates }
    );
    const updated = await db.collection('centring_teams').findOne({ _id: new ObjectId(teamId) });
    return { ...updated, _id: updated._id.toString() };
}

async function deleteCentringTeam(teamId) {
    const db = getDatabase();
    await db.collection('centring_entries').deleteMany({ teamId });
    await db.collection('centring_teams').deleteOne({ _id: new ObjectId(teamId) });
}

async function addCentringEntry(data) {
    const db = getDatabase();
    const doc = { ...data, shiftCount: toNumber(data.shiftCount), wageAmount: toNumber(data.wageAmount), sqftCompleted: toNumber(data.sqftCompleted), createdAt: new Date() };
    const r = await db.collection('centring_entries').insertOne(doc);
    return { ...doc, _id: r.insertedId.toString() };
}

async function deleteCentringEntry(entryId) {
    const db = getDatabase();
    await db.collection('centring_entries').deleteOne({ _id: new ObjectId(entryId) });
}

async function getCentringEntries(teamId) {
    const db = getDatabase();
    const entries = await db.collection('centring_entries').find({ teamId }).sort({ date: 1 }).toArray();
    return entries.map(e => ({ ...e, _id: e._id.toString() }));
}

async function getAllCentringEntries(projectId) {
    const db = getDatabase();
    const entries = await db.collection('centring_entries').find({ projectId }).sort({ date: 1 }).toArray();
    return entries.map(e => ({ ...e, _id: e._id.toString() }));
}

// -- CONCRETE -------------------------------------------------

async function getConcreteTeams(projectId) {
    const db = getDatabase();
    const teams = await db.collection('concrete_teams').find({ projectId }).sort({ createdAt: 1 }).toArray();
    const entries = await db.collection('concrete_entries').find({ projectId }).sort({ date: 1 }).toArray();
    return teams.map(t => ({
        ...t,
        _id: t._id.toString(),
        entries: entries.filter(e => e.teamId === t._id.toString()).map(e => ({ ...e, _id: e._id.toString() }))
    }));
}

async function createConcreteTeam(data) {
    const db = getDatabase();
    const doc = { ...data, members: [], createdAt: new Date() };
    const r = await db.collection('concrete_teams').insertOne(doc);
    return { ...doc, _id: r.insertedId.toString() };
}

async function updateConcreteTeam(teamId, updates) {
    const db = getDatabase();
    await db.collection('concrete_teams').updateOne(
        { _id: new ObjectId(teamId) },
        { $set: updates }
    );
    const updated = await db.collection('concrete_teams').findOne({ _id: new ObjectId(teamId) });
    return { ...updated, _id: updated._id.toString() };
}

async function deleteConcreteTeam(teamId) {
    const db = getDatabase();
    await db.collection('concrete_entries').deleteMany({ teamId });
    await db.collection('concrete_teams').deleteOne({ _id: new ObjectId(teamId) });
}

async function getAllConcreteEntries(projectId) {
    const db = getDatabase();
    const entries = await db.collection('concrete_entries').find({ projectId }).sort({ date: 1 }).toArray();
    return entries.map(e => ({ ...e, _id: e._id.toString(), shiftCount: toNumber(e.shiftCount), amount: toNumber(e.amount), menCount: toNumber(e.menCount), womenCount: toNumber(e.womenCount) }));
}

async function addConcreteEntry(data) {
    const db = getDatabase();
    const doc = { ...data, shiftCount: toNumber(data.shiftCount), amount: toNumber(data.amount), menCount: toNumber(data.menCount), womenCount: toNumber(data.womenCount), createdAt: new Date() };
    const r = await db.collection('concrete_entries').insertOne(doc);
    return { ...doc, _id: r.insertedId.toString() };
}

async function deleteConcreteEntry(entryId) {
    const db = getDatabase();
    await db.collection('concrete_entries').deleteOne({ _id: new ObjectId(entryId) });
}

async function getConcreteEntries(teamId) {
    const db = getDatabase();
    const entries = await db.collection('concrete_entries').find({ teamId }).sort({ date: 1 }).toArray();
    return entries.map(e => ({ ...e, _id: e._id.toString() }));
}

// -- ELECTRICAL & PLUMBING ------------------------------------

async function getAllEPEntries(projectId) {
    const db = getDatabase();
    const entries = await db.collection('ep_entries').find({ projectId }).sort({ date: 1 }).toArray();
    return entries.map(e => ({ ...e, _id: e._id.toString(), amount: toNumber(e.amount) }));
}

async function addEPEntry(data) {
    const db = getDatabase();
    const doc = { ...data, amount: toNumber(data.amount), createdAt: new Date() };
    const r = await db.collection('ep_entries').insertOne(doc);
    return { ...doc, _id: r.insertedId.toString() };
}

async function deleteEPEntry(entryId) {
    const db = getDatabase();
    await db.collection('ep_entries').deleteOne({ _id: new ObjectId(entryId) });
}

// -- TILES ----------------------------------------------------

async function getAllTilesEntries(projectId) {
    const db = getDatabase();
    const entries = await db.collection('tiles_entries').find({ projectId }).sort({ date: 1 }).toArray();
    return entries.map(e => ({ ...e, _id: e._id.toString(), wageAmount: toNumber(e.wageAmount), sqftCompleted: toNumber(e.sqftCompleted) }));
}

async function addTilesEntry(data) {
    const db = getDatabase();
    const doc = { ...data, wageAmount: toNumber(data.wageAmount), sqftCompleted: toNumber(data.sqftCompleted), createdAt: new Date() };
    const r = await db.collection('tiles_entries').insertOne(doc);
    return { ...doc, _id: r.insertedId.toString() };
}

async function deleteTilesEntry(entryId) {
    const db = getDatabase();
    await db.collection('tiles_entries').deleteOne({ _id: new ObjectId(entryId) });
}

// -- PAINTING -------------------------------------------------

async function getPaintingTeams(projectId) {
    const db = getDatabase();
    const teams = await db.collection('painting_teams').find({ projectId }).sort({ createdAt: 1 }).toArray();
    const entries = await db.collection('painting_entries').find({ projectId }).sort({ date: 1 }).toArray();
    return teams.map(t => ({
        ...t,
        _id: t._id.toString(),
        entries: entries.filter(e => e.teamId === t._id.toString()).map(e => ({ ...e, _id: e._id.toString() }))
    }));
}

async function createPaintingTeam(data) {
    const db = getDatabase();
    const doc = { ...data, createdAt: new Date() };
    const r = await db.collection('painting_teams').insertOne(doc);
    return { ...doc, _id: r.insertedId.toString() };
}

async function deletePaintingTeam(teamId) {
    const db = getDatabase();
    await db.collection('painting_entries').deleteMany({ teamId });
    await db.collection('painting_teams').deleteOne({ _id: new ObjectId(teamId) });
}

async function addPaintingEntry(data) {
    const db = getDatabase();
    const doc = { ...data, shiftCount: toNumber(data.shiftCount), wageAmount: toNumber(data.wageAmount), sqftCompleted: toNumber(data.sqftCompleted), createdAt: new Date() };
    const r = await db.collection('painting_entries').insertOne(doc);
    return { ...doc, _id: r.insertedId.toString() };
}

async function deletePaintingEntry(entryId) {
    const db = getDatabase();
    await db.collection('painting_entries').deleteOne({ _id: new ObjectId(entryId) });
}

async function getPaintingEntries(teamId) {
    const db = getDatabase();
    const entries = await db.collection('painting_entries').find({ teamId }).sort({ date: 1 }).toArray();
    return entries.map(e => ({ ...e, _id: e._id.toString() }));
}

async function getAllPaintingEntries(projectId) {
    const db = getDatabase();
    const entries = await db.collection('painting_entries').find({ projectId }).sort({ date: 1 }).toArray();
}

async function getLabourSettings(projectId) {
    const db = getDatabase();
    const settings = await db.collection('labour_settings').findOne({ projectId });
    const defaults = {
        projectId,
        masonWage: 800,
        menHelperWage: 700,
        womenHelperWage: 600
    };
    if (!settings) return defaults;
    return { ...defaults, ...settings, _id: settings._id.toString() };
}

async function updateLabourSettings(projectId, data) {
    const db = getDatabase();
    const payload = {
        projectId,
        masonWage: toNumber(data.masonWage, 800),
        menHelperWage: toNumber(data.menHelperWage, 700),
        womenHelperWage: toNumber(data.womenHelperWage, 600),
        updatedAt: new Date()
    };
    await db.collection('labour_settings').updateOne(
        { projectId },
        { $set: payload },
        { upsert: true }
    );
    return payload;
}

module.exports = {
    authenticateUser,
    getAllProjects,
    createProject,
    getProjectById,
    updateProject,
    deleteProject,
    getAllWorkers,
    createWorker,
    updateWorker,
    deleteWorker,
    getAllMaterials,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    getAllEquipment,
    createEquipment,
    updateEquipment,
    deleteEquipment,
    getAllExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    getFinancialSummary,
    getConfiguration,
    updateConfiguration,
    getElectricianMembers,
    addElectricianMember,
    deleteElectricianMember,
    getElectricianPayments,
    addElectricianPayment,
    deleteElectricianPayment,
    getMasonryTeams,
    createMasonryTeam,
    updateMasonryTeam,
    deleteMasonryTeam,
    addMasonryEntry,
    deleteMasonryEntry,
    getMasonryEntries,
    getAllMasonryEntries,
    getCentringTeams,
    createCentringTeam,
    updateCentringTeam,
    deleteCentringTeam,
    addCentringEntry,
    deleteCentringEntry,
    getCentringEntries,
    getAllCentringEntries,
    getConcreteTeams,
    createConcreteTeam,
    updateConcreteTeam,
    deleteConcreteTeam,
    getConcreteEntries,
    getAllConcreteEntries,
    addConcreteEntry,
    deleteConcreteEntry,
    getAllEPEntries,
    addEPEntry,
    deleteEPEntry,
    getAllTilesEntries,
    addTilesEntry,
    deleteTilesEntry,
    getPaintingTeams,
    createPaintingTeam,
    deletePaintingTeam,
    addPaintingEntry,
    deletePaintingEntry,
    getPaintingEntries,
    getAllPaintingEntries,
    getLabourSettings,
    updateLabourSettings
};
