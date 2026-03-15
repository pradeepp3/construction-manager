const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const CONFIG_FILE_NAME = 'bootstrap-config.json';
const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, CONFIG_FILE_NAME);

// Default DB Path: Inside userData/data
const DEFAULT_DB_PATH = path.join(userDataPath, 'data');

function loadBootstrapConfig() {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading bootstrap config:', error);
    }
    return { dbPath: DEFAULT_DB_PATH };
}

function saveBootstrapConfig(config) {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving bootstrap config:', error);
        return false;
    }
}

module.exports = {
    loadBootstrapConfig,
    saveBootstrapConfig,
    DEFAULT_DB_PATH
};
