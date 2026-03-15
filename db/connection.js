const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

let client = null;
let db = null;

// Default database configuration
const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data');
const DB_NAME = 'construction_manager';

async function initDatabase(connectionUrl = null) {
    try {
        // NOTE: Directory creation is now handled by main.js before spawning mongod

        // MongoDB connection URL
        // If provided, use it (from main.js spawning on custom port)
        // If not, default to standard localhost:27017 (dev fallback)
        const url = connectionUrl || 'mongodb://localhost:27017';

        console.log(`Connecting to MongoDB at ${url}...`);

        client = new MongoClient(url);

        await client.connect();
        db = client.db(DB_NAME);

        console.log('Connected to MongoDB successfully');

        // Initialize collections if they don't exist
        await initializeCollections();

        // Create default admin user if no users exist
        await createDefaultUser();

        return db;
    } catch (error) {
        console.error('MongoDB connection error:', error);

        // Fallback to in-memory storage for development
        console.log('Using in-memory storage as fallback');
        db = createInMemoryDB();

        return db;
    }
}

async function initializeCollections() {
    const collections = [
        'users',
        'projects',
        'workers',
        'materials',
        'equipment',
        'expenses',
        'config',
        'electrician_members',
        'electrician_payments',
        'masonry_teams',
        'masonry_entries',
        'centring_teams',
        'centring_entries',
        'concrete_entries',
        'ep_entries',
        'tiles_entries',
        'painting_teams',
        'painting_entries'
    ];

    const existingCollections = await db.listCollections().toArray();
    const existingNames = existingCollections.map(c => c.name);

    for (const collectionName of collections) {
        if (!existingNames.includes(collectionName)) {
            await db.createCollection(collectionName);
            console.log(`Created collection: ${collectionName}`);
        }
    }
}

async function createDefaultUser() {
    const users = db.collection('users');
    const userCount = await users.countDocuments();

    if (userCount === 0) {
        const initialPassword = process.env.DEFAULT_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
        const hashedPassword = await bcrypt.hash(initialPassword, 10);
        await users.insertOne({
            username: 'admin',
            password: hashedPassword,
            role: 'admin',
            createdAt: new Date()
        });
        console.log(`Default admin user created (username: admin, password: ${initialPassword})`);
    }
}

function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase first.');
    }
    return db;
}

async function closeDatabase() {
    if (client) {
        try {
            await client.close();
            console.log('Database connection closed');
        } catch (error) {
            console.error('Error closing database:', error);
        }
        client = null;
        db = null;
    }
}

// Fallback in-memory database for development
function createInMemoryDB() {
    const storage = {
        users: [],
        projects: [],
        workers: [],
        materials: [],
        equipment: [],
        expenses: [],
        config: [],
        electrician_members: [],
        electrician_payments: [],
        masonry_teams: [],
        masonry_entries: [],
        centring_teams: [],
        centring_entries: [],
        concrete_entries: [],
        ep_entries: [],
        tiles_entries: [],
        painting_teams: [],
        painting_entries: []
    };

    function normalizeValue(value) {
        if (value && typeof value === 'object' && typeof value.toString === 'function') {
            return value.toString();
        }
        return value;
    }

    function matchesQuery(item, query = {}) {
        return Object.keys(query).every(key => normalizeValue(item[key]) === normalizeValue(query[key]));
    }

    function sortItems(items, sortSpec = {}) {
        const [sortKey, sortDirection] = Object.entries(sortSpec)[0] || [];
        if (!sortKey) return [...items];

        return [...items].sort((left, right) => {
            const a = normalizeValue(left[sortKey]);
            const b = normalizeValue(right[sortKey]);

            if (a === b) return 0;
            if (a == null) return 1;
            if (b == null) return -1;

            const result = a > b ? 1 : -1;
            return sortDirection === -1 ? result * -1 : result;
        });
    }

    function ensureCollection(name) {
        if (!storage[name]) {
            storage[name] = [];
        }
        return storage[name];
    }

    return {
        listCollections: () => ({
            toArray: async () => Object.keys(storage).map(name => ({ name }))
        }),
        createCollection: async (name) => {
            ensureCollection(name);
            return { collectionName: name };
        },
        collection: (name) => ({
            find: (query = {}) => {
                const filtered = ensureCollection(name).filter(item => matchesQuery(item, query));
                return {
                    sort: (sortSpec = {}) => ({
                        toArray: async () => sortItems(filtered, sortSpec)
                    }),
                    toArray: async () => [...filtered]
                };
            },
            findOne: async (query) => {
                const items = ensureCollection(name);
                return items.find(item => matchesQuery(item, query));
            },
            insertOne: async (doc) => {
                const id = Date.now().toString();
                const newDoc = { ...doc, _id: id };
                ensureCollection(name).push(newDoc);
                return { insertedId: id, ops: [newDoc] };
            },
            updateOne: async (query, update, options = {}) => {
                const items = ensureCollection(name);
                const index = items.findIndex(item => matchesQuery(item, query));
                if (index !== -1) {
                    if (update.$set) {
                        storage[name][index] = { ...items[index], ...update.$set };
                    }
                    return { modifiedCount: 1 };
                }
                if (options.upsert) {
                    const baseDoc = { ...query, ...(update.$set || {}), _id: Date.now().toString() };
                    items.push(baseDoc);
                    return { modifiedCount: 0, upsertedCount: 1 };
                }
                return { modifiedCount: 0 };
            },
            deleteOne: async (query) => {
                const items = ensureCollection(name);
                const index = items.findIndex(item => matchesQuery(item, query));
                if (index !== -1) {
                    items.splice(index, 1);
                    return { deletedCount: 1 };
                }
                return { deletedCount: 0 };
            },
            deleteMany: async (query) => {
                const items = ensureCollection(name);
                const remaining = items.filter(item => !matchesQuery(item, query));
                const deletedCount = items.length - remaining.length;
                storage[name] = remaining;
                return { deletedCount };
            },
            countDocuments: async () => {
                return ensureCollection(name).length;
            }
        })
    };
}

module.exports = {
    initDatabase,
    getDatabase,
    closeDatabase
};
