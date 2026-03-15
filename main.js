const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const { initDatabase, closeDatabase } = require('./db/connection');
const dbOperations = require('./db/operations');
const { loadBootstrapConfig, saveBootstrapConfig } = require('./db/file-config');
const https = require('https');


ipcMain.handle('ai:query', async (event, { systemPrompt, userPrompt }) => {
  const groqApiKey = process.env.GROQ_API_KEY?.trim();
  if (!groqApiKey) {
    return {
      success: false,
      message: 'Set GROQ_API_KEY in the environment to enable AI Insights.'
    };
  }

  const body = JSON.stringify({
    model: 'llama-3.1-8b-instant',
    max_tokens: 1024,
    temperature: 0.2,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   }
    ]
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.groq.com',
      path:     '/openai/v1/chat/completions',
      method:   'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            resolve({ success: false, message: json.error.message || 'Groq API error' });
          } else {
            const text = json.choices?.[0]?.message?.content || '';
            resolve({ success: true, data: text });
          }
        } catch (e) {
          resolve({ success: false, message: 'Failed to parse Groq response' });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ success: false, message: e.message });
    });

    req.write(body);
    req.end();
  });
});


let mainWindow;
let currentUser = null;
let mongodProcess = null;

// Determine DB Configuration
const bootstrapConfig = loadBootstrapConfig();
const DB_PORT = 27018; // Use non-default port to avoid conflict with manual instances
const DB_HOST = 'localhost';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    },
    icon: path.join(__dirname, 'assets/icons/icon.png'),
    show: false
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startMongoDB() {
  return new Promise((resolve, reject) => {
    const dbPath = bootstrapConfig.dbPath;

    // Ensure directory exists
    if (!fs.existsSync(dbPath)) {
      try {
        fs.mkdirSync(dbPath, { recursive: true });
      } catch (err) {
        reject(new Error(`Failed to create database directory at ${dbPath}: ${err.message}`));
        return;
      }
    }

    console.log(`Starting MongoDB at ${dbPath} on port ${DB_PORT}...`);

    mongodProcess = spawn('mongod', [
      '--dbpath', dbPath,
      '--port', DB_PORT.toString(),
      '--bind_ip', '127.0.0.1'
    ]);

    let started = false;

    mongodProcess.stdout.on('data', (data) => {
      const output = data.toString();
      // console.log(`[mongod]: ${output}`);
      if (!started && output.includes('Waiting for connections')) {
        started = true;
        resolve();
      }
    });

    mongodProcess.stderr.on('data', (data) => {
      console.error(`[mongod error]: ${data}`);
    });

    mongodProcess.on('error', (err) => {
      reject(new Error(`Failed to start mongod: ${err.message}`));
    });

    // Timeout fallback if "Waiting for connections" isn't detected quickly
    setTimeout(() => {
      if (!started) {
        // It might have started silently or already be running? 
        // Just resolve to try connection
        resolve();
      }
    }, 5000);
  });
}

async function switchDatabase(newPath) {
  try {
    console.log(`Switching database to: ${newPath}`);

    // 1. Close current DB connection
    await closeDatabase();

    // 2. Kill current mongod process
    if (mongodProcess) {
      return new Promise((resolve, reject) => {
        mongodProcess.once('exit', async () => {
          console.log('Old mongod process exited');
          mongodProcess = null;

          // 3. Start new mongod process
          bootstrapConfig.dbPath = newPath;
          try {
            await startMongoDB();
            // 4. Re-initialize DB connection
            await initDatabase(`mongodb://${DB_HOST}:${DB_PORT}`);
            console.log('Database switched and re-initialized successfully');
            resolve({ success: true });
          } catch (error) {
            reject(error);
          }
        });

        mongodProcess.kill();
      });
    } else {
      // If no process was running, just start a new one
      bootstrapConfig.dbPath = newPath;
      await startMongoDB();
      await initDatabase(`mongodb://${DB_HOST}:${DB_PORT}`);
      return { success: true };
    }
  } catch (error) {
    console.error('Error switching database:', error);
    throw error;
  }
}

// Initialize app
app.whenReady().then(async () => {
  try {
    // Start local MongoDB instance
    await startMongoDB();
    console.log('MongoDB process started');

    // Initialize database connection
    await initDatabase(`mongodb://${DB_HOST}:${DB_PORT}`);
    console.log('Database initialized successfully');

    createWindow();
  } catch (error) {
    console.error('Failed to initialize application:', error);
    dialog.showErrorBox('Initialization Error', `Failed to start database or application.\nDetails: ${error.message}`);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (mongodProcess) {
    console.log('Stopping MongoDB process...');
    mongodProcess.kill();
  }
});

// Authentication handlers
ipcMain.handle('auth:login', async (event, credentials) => {
  try {
    const user = await dbOperations.authenticateUser(credentials);
    if (user) {
      currentUser = user;
      return { success: true, user: { username: user.username, id: user._id } };
    }
    return { success: false, message: 'Invalid credentials' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('auth:logout', async () => {
  currentUser = null;
  return { success: true };
});

ipcMain.handle('auth:getCurrentUser', async () => {
  return currentUser ? { username: currentUser.username, id: currentUser._id } : null;
});

// Project management handlers
ipcMain.handle('projects:getAll', async () => {
  try {
    const projects = await dbOperations.getAllProjects();
    return { success: true, data: projects };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('projects:create', async (event, projectData) => {
  try {
    const project = await dbOperations.createProject(projectData);
    return { success: true, data: project };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('projects:getById', async (event, projectId) => {
  try {
    const project = await dbOperations.getProjectById(projectId);
    return { success: true, data: project };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('projects:update', async (event, projectId, updates) => {
  try {
    const project = await dbOperations.updateProject(projectId, updates);
    return { success: true, data: project };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('projects:delete', async (event, projectId) => {
  try {
    await dbOperations.deleteProject(projectId);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Labour module handlers
ipcMain.handle('labour:getAll', async (event, projectId) => {
  try {
    const workers = await dbOperations.getAllWorkers(projectId);
    return { success: true, data: workers };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('labour:create', async (event, workerData) => {
  try {
    const worker = await dbOperations.createWorker(workerData);
    return { success: true, data: worker };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('labour:update', async (event, workerId, updates) => {
  try {
    const worker = await dbOperations.updateWorker(workerId, updates);
    return { success: true, data: worker };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('labour:delete', async (event, workerId) => {
  try {
    await dbOperations.deleteWorker(workerId);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Materials module handlers
ipcMain.handle('materials:getAll', async (event, projectId) => {
  try {
    const materials = await dbOperations.getAllMaterials(projectId);
    return { success: true, data: materials };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('materials:create', async (event, materialData) => {
  try {
    const material = await dbOperations.createMaterial(materialData);
    return { success: true, data: material };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('materials:update', async (event, materialId, updates) => {
  try {
    const material = await dbOperations.updateMaterial(materialId, updates);
    return { success: true, data: material };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('materials:delete', async (event, materialId) => {
  try {
    await dbOperations.deleteMaterial(materialId);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Equipment module handlers
ipcMain.handle('equipment:getAll', async (event, projectId) => {
  try {
    const equipment = await dbOperations.getAllEquipment(projectId);
    return { success: true, data: equipment };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('equipment:create', async (event, equipmentData) => {
  try {
    const equipment = await dbOperations.createEquipment(equipmentData);
    return { success: true, data: equipment };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('equipment:update', async (event, equipmentId, updates) => {
  try {
    const equipment = await dbOperations.updateEquipment(equipmentId, updates);
    return { success: true, data: equipment };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('equipment:delete', async (event, equipmentId) => {
  try {
    await dbOperations.deleteEquipment(equipmentId);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Finance module handlers
ipcMain.handle('finance:getSummary', async (event, projectId) => {
  try {
    const summary = await dbOperations.getFinancialSummary(projectId);
    return { success: true, data: summary };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('finance:getExpenses', async (event, projectId) => {
  try {
    const expenses = await dbOperations.getAllExpenses(projectId);
    return { success: true, data: expenses };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('finance:createExpense', async (event, expenseData) => {
  try {
    const expense = await dbOperations.createExpense(expenseData);
    return { success: true, data: expense };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('finance:updateExpense', async (event, expenseId, updates) => {
  try {
    const expense = await dbOperations.updateExpense(expenseId, updates);
    return { success: true, data: expense };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('finance:deleteExpense', async (event, expenseId) => {
  try {
    await dbOperations.deleteExpense(expenseId);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Electrician Payment handlers
// Electrician Member handlers
ipcMain.handle('electrician:getMembers', async (event, workerId) => {
  try {
    const members = await dbOperations.getElectricianMembers(workerId);
    return { success: true, data: members };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('electrician:addMember', async (event, memberData) => {
  try {
    const member = await dbOperations.addElectricianMember(memberData);
    return { success: true, data: member };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('electrician:deleteMember', async (event, memberId) => {
  try {
    await dbOperations.deleteElectricianMember(memberId);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Electrician Payment handlers
ipcMain.handle('electrician:getPayments', async (event, memberId) => {
  try {
    const payments = await dbOperations.getElectricianPayments(memberId);
    return { success: true, data: payments };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('electrician:addPayment', async (event, paymentData) => {
  try {
    const payment = await dbOperations.addElectricianPayment(paymentData);
    return { success: true, data: payment };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('electrician:deletePayment', async (event, paymentId) => {
  try {
    await dbOperations.deleteElectricianPayment(paymentId);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// ============================================================
// LABOUR IPC HANDLERS - Add this block to main.js
// Paste after the existing finance handlers, before app.on('window-all-closed')
// ============================================================

// -- Masonry -------------------------------------------------
ipcMain.handle('labour:masonry:getTeams', async (event, projectId) => {
  try { return { success: true, data: await dbOperations.getMasonryTeams(projectId) }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:masonry:createTeam', async (event, data) => {
  try { return { success: true, data: await dbOperations.createMasonryTeam(data) }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:masonry:deleteTeam', async (event, teamId) => {
  try { await dbOperations.deleteMasonryTeam(teamId); return { success: true }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:masonry:addEntry', async (event, data) => {
  try { return { success: true, data: await dbOperations.addMasonryEntry(data) }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:masonry:deleteEntry', async (event, id) => {
  try { await dbOperations.deleteMasonryEntry(id); return { success: true }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:masonry:getEntries', async (event, teamId) => {
  try { return { success: true, data: await dbOperations.getMasonryEntries(teamId) }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:masonry:getAllEntries', async (event, projectId) => {
  try { return { success: true, data: await dbOperations.getAllMasonryEntries(projectId) }; }
  catch (e) { return { success: false, message: e.message }; }
});

// -- Centring ------------------------------------------------
ipcMain.handle('labour:centring:getTeams', async (event, projectId) => {
  try { return { success: true, data: await dbOperations.getCentringTeams(projectId) }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:centring:createTeam', async (event, data) => {
  try { return { success: true, data: await dbOperations.createCentringTeam(data) }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:centring:deleteTeam', async (event, id) => {
  try { await dbOperations.deleteCentringTeam(id); return { success: true }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:centring:addEntry', async (event, data) => {
  try { return { success: true, data: await dbOperations.addCentringEntry(data) }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:centring:deleteEntry', async (event, id) => {
  try { await dbOperations.deleteCentringEntry(id); return { success: true }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:centring:getEntries', async (event, teamId) => {
  try { return { success: true, data: await dbOperations.getCentringEntries(teamId) }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:centring:getAllEntries', async (event, projectId) => {
  try { return { success: true, data: await dbOperations.getAllCentringEntries(projectId) }; }
  catch (e) { return { success: false, message: e.message }; }
});

// -- Concrete ------------------------------------------------
ipcMain.handle('labour:concrete:getAll', async (event, projectId) => {
  try { return { success: true, data: await dbOperations.getAllConcreteEntries(projectId) }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:concrete:add', async (event, data) => {
  try { return { success: true, data: await dbOperations.addConcreteEntry(data) }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:concrete:delete', async (event, id) => {
  try { await dbOperations.deleteConcreteEntry(id); return { success: true }; }
  catch (e) { return { success: false, message: e.message }; }
});

// -- Electrical & Plumbing ------------------------------------
ipcMain.handle('labour:ep:getAll', async (event, projectId) => {
  try { return { success: true, data: await dbOperations.getAllEPEntries(projectId) }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:ep:add', async (event, data) => {
  try { return { success: true, data: await dbOperations.addEPEntry(data) }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:ep:delete', async (event, id) => {
  try { await dbOperations.deleteEPEntry(id); return { success: true }; }
  catch (e) { return { success: false, message: e.message }; }
});

// -- Tiles ----------------------------------------------------
ipcMain.handle('labour:tiles:getAll', async (event, projectId) => {
  try { return { success: true, data: await dbOperations.getAllTilesEntries(projectId) }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:tiles:add', async (event, data) => {
  try { return { success: true, data: await dbOperations.addTilesEntry(data) }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:tiles:delete', async (event, id) => {
  try { await dbOperations.deleteTilesEntry(id); return { success: true }; }
  catch (e) { return { success: false, message: e.message }; }
});

// -- Painting -------------------------------------------------
ipcMain.handle('labour:painting:getTeams', async (event, projectId) => {
  try { return { success: true, data: await dbOperations.getPaintingTeams(projectId) }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:painting:createTeam', async (event, data) => {
  try { return { success: true, data: await dbOperations.createPaintingTeam(data) }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:painting:deleteTeam', async (event, id) => {
  try { await dbOperations.deletePaintingTeam(id); return { success: true }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:painting:addEntry', async (event, data) => {
  try { return { success: true, data: await dbOperations.addPaintingEntry(data) }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:painting:deleteEntry', async (event, id) => {
  try { await dbOperations.deletePaintingEntry(id); return { success: true }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:painting:getEntries', async (event, teamId) => {
  try { return { success: true, data: await dbOperations.getPaintingEntries(teamId) }; }
  catch (e) { return { success: false, message: e.message }; }
});
ipcMain.handle('labour:painting:getAllEntries', async (event, projectId) => {
  try { return { success: true, data: await dbOperations.getAllPaintingEntries(projectId) }; }
  catch (e) { return { success: false, message: e.message }; }
});

// Settings handlers
ipcMain.handle('settings:getConfig', async () => {
  try {
    // Return the bootstrap config (actual persistent path) mapped to what frontend expects
    const config = await dbOperations.getConfiguration();
    // Override dbPath with the actual bootstrap one
    config.dbPath = bootstrapConfig.dbPath;
    return { success: true, data: config };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('settings:updateConfig', async (event, updates) => {
  try {
    const oldPath = bootstrapConfig.dbPath;

    // Save to DB (if possible - if switch fails, this might fail too)
    const config = await dbOperations.updateConfiguration(updates);

    // Save DbPath to bootstrap file if changed
    if (updates.dbPath && updates.dbPath !== oldPath) {
      await switchDatabase(updates.dbPath);
      saveBootstrapConfig(bootstrapConfig);

      // Notify renderer that DB has switched so it can refresh UI
      if (mainWindow) {
        mainWindow.webContents.send('db:switched', { path: updates.dbPath });
      }
    }

    return { success: true, data: config };
  } catch (error) {
    console.error('Settings update error:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('settings:selectDbPath', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});
