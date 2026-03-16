const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    auth: {
        login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
        logout: () => ipcRenderer.invoke('auth:logout'),
        getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser')
    },
    projects: {
        getAll: () => ipcRenderer.invoke('projects:getAll'),
        create: (projectData) => ipcRenderer.invoke('projects:create', projectData),
        getById: (projectId) => ipcRenderer.invoke('projects:getById', projectId),
        update: (projectId, updates) => ipcRenderer.invoke('projects:update', projectId, updates),
        delete: (projectId) => ipcRenderer.invoke('projects:delete', projectId)
    },
    labour: {
        getAll: (projectId) => ipcRenderer.invoke('labour:getAll', projectId),
        create: (workerData) => ipcRenderer.invoke('labour:create', workerData),
        update: (workerId, updates) => ipcRenderer.invoke('labour:update', workerId, updates),
        delete: (workerId) => ipcRenderer.invoke('labour:delete', workerId),
        getSettings: (projectId) => ipcRenderer.invoke('labour:getSettings', projectId),
        updateSettings: (projectId, data) => ipcRenderer.invoke('labour:updateSettings', projectId, data),
        masonry: {
            getTeams: (projectId) => ipcRenderer.invoke('labour:masonry:getTeams', projectId),
            createTeam: (data) => ipcRenderer.invoke('labour:masonry:createTeam', data),
            deleteTeam: (id) => ipcRenderer.invoke('labour:masonry:deleteTeam', id),
            addEntry: (data) => ipcRenderer.invoke('labour:masonry:addEntry', data),
            deleteEntry: (id) => ipcRenderer.invoke('labour:masonry:deleteEntry', id),
            getEntries: (teamId) => ipcRenderer.invoke('labour:masonry:getEntries', teamId),
            getAllEntries: (projectId) => ipcRenderer.invoke('labour:masonry:getAllEntries', projectId),
            updateTeam: (id, data) => ipcRenderer.invoke('labour:masonry:updateTeam', id, data),
        },
        centring: {
            getTeams: (projectId) => ipcRenderer.invoke('labour:centring:getTeams', projectId),
            createTeam: (data) => ipcRenderer.invoke('labour:centring:createTeam', data),
            deleteTeam: (id) => ipcRenderer.invoke('labour:centring:deleteTeam', id),
            addEntry: (data) => ipcRenderer.invoke('labour:centring:addEntry', data),
            deleteEntry: (id) => ipcRenderer.invoke('labour:centring:deleteEntry', id),
            getEntries: (teamId) => ipcRenderer.invoke('labour:centring:getEntries', teamId),
            getAllEntries: (projectId) => ipcRenderer.invoke('labour:centring:getAllEntries', projectId),
            updateTeam: (id, data) => ipcRenderer.invoke('labour:centring:updateTeam', id, data),
        },
        concrete: {
            getTeams: (projectId) => ipcRenderer.invoke('labour:concrete:getTeams', projectId),
            createTeam: (data) => ipcRenderer.invoke('labour:concrete:createTeam', data),
            deleteTeam: (id) => ipcRenderer.invoke('labour:concrete:deleteTeam', id),
            updateTeam: (id, data) => ipcRenderer.invoke('labour:concrete:updateTeam', id, data),
            getEntries: (teamId) => ipcRenderer.invoke('labour:concrete:getEntries', teamId),
            addEntry: (data) => ipcRenderer.invoke('labour:concrete:addEntry', data),
            deleteEntry: (id) => ipcRenderer.invoke('labour:concrete:deleteEntry', id),
            getAll: (projectId) => ipcRenderer.invoke('labour:concrete:getAll', projectId),
        },
        ep: {
            getAll: (projectId) => ipcRenderer.invoke('labour:ep:getAll', projectId),
            add: (data) => ipcRenderer.invoke('labour:ep:add', data),
            delete: (id) => ipcRenderer.invoke('labour:ep:delete', id),
        },
        tiles: {
            getAll: (projectId) => ipcRenderer.invoke('labour:tiles:getAll', projectId),
            add: (data) => ipcRenderer.invoke('labour:tiles:add', data),
            delete: (id) => ipcRenderer.invoke('labour:tiles:delete', id),
        },
        painting: {
            getTeams: (projectId) => ipcRenderer.invoke('labour:painting:getTeams', projectId),
            createTeam: (data) => ipcRenderer.invoke('labour:painting:createTeam', data),
            deleteTeam: (id) => ipcRenderer.invoke('labour:painting:deleteTeam', id),
            addEntry: (data) => ipcRenderer.invoke('labour:painting:addEntry', data),
            deleteEntry: (id) => ipcRenderer.invoke('labour:painting:deleteEntry', id),
            getEntries: (teamId) => ipcRenderer.invoke('labour:painting:getEntries', teamId),
            getAllEntries: (projectId) => ipcRenderer.invoke('labour:painting:getAllEntries', projectId),
        },
    },
    materials: {
        getAll: (projectId) => ipcRenderer.invoke('materials:getAll', projectId),
        create: (materialData) => ipcRenderer.invoke('materials:create', materialData),
        update: (materialId, updates) => ipcRenderer.invoke('materials:update', materialId, updates),
        delete: (materialId) => ipcRenderer.invoke('materials:delete', materialId)
    },
    equipment: {
        getAll: (projectId) => ipcRenderer.invoke('equipment:getAll', projectId),
        create: (equipmentData) => ipcRenderer.invoke('equipment:create', equipmentData),
        update: (equipmentId, updates) => ipcRenderer.invoke('equipment:update', equipmentId, updates),
        delete: (equipmentId) => ipcRenderer.invoke('equipment:delete', equipmentId)
    },
    finance: {
        getSummary: (projectId) => ipcRenderer.invoke('finance:getSummary', projectId),
        getExpenses: (projectId) => ipcRenderer.invoke('finance:getExpenses', projectId),
        createExpense: (expenseData) => ipcRenderer.invoke('finance:createExpense', expenseData),
        updateExpense: (expenseId, updates) => ipcRenderer.invoke('finance:updateExpense', expenseId, updates),
        deleteExpense: (expenseId) => ipcRenderer.invoke('finance:deleteExpense', expenseId)
    },
    electrician: {
        getMembers: (workerId) => ipcRenderer.invoke('electrician:getMembers', workerId),
        addMember: (memberData) => ipcRenderer.invoke('electrician:addMember', memberData),
        deleteMember: (memberId) => ipcRenderer.invoke('electrician:deleteMember', memberId),
        getPayments: (memberId) => ipcRenderer.invoke('electrician:getPayments', memberId),
        addPayment: (paymentData) => ipcRenderer.invoke('electrician:addPayment', paymentData),
        deletePayment: (paymentId) => ipcRenderer.invoke('electrician:deletePayment', paymentId)
    },
    settings: {
        getConfig: () => ipcRenderer.invoke('settings:getConfig'),
        updateConfig: (updates) => ipcRenderer.invoke('settings:updateConfig', updates),
        selectDbPath: () => ipcRenderer.invoke('settings:selectDbPath'),
        onDbSwitched: (callback) => ipcRenderer.on('db:switched', (event, data) => callback(data))
    },
    ai: {
        query: (payload) => ipcRenderer.invoke('ai:query', payload)
    }
});