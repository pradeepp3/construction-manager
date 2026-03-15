# Construction Operations Management System

A comprehensive desktop application for managing construction projects, built with Electron.js and MongoDB.

## Features

- **Project Management**: Create and manage multiple construction projects
- **Labour Module**: Track workers across categories (Mason, Helper, Electrician, Carpenter)
  - Worker details and wages management
  - Tools assignment tracking
  - Multiple cost calculation methods (wage-based and square-feet based)
- **Materials Module**: Inventory management for construction materials
  - Track quantity, unit price, and suppliers
  - Categorized material management
- **Equipment Module**: Manage tools, machinery, and vehicles
  - Track ownership (owned/rented)
  - Status monitoring (available, in use, under maintenance)
- **Finance Dashboard**: Comprehensive financial overview
  - Budget tracking and utilization
  - Cost breakdown by category
  - Visual analytics and reports
- **Offline Operation**: Works completely offline with local MongoDB database
- **Configurable Storage**: Choose where to store your database (internal or external drives)

## Architecture

- **Frontend**: HTML5, CSS3, JavaScript
- **Framework**: Electron.js
- **Backend**: Node.js
- **Database**: MongoDB (local, offline)
- **Design**: Modern dark theme with responsive layouts

## Installation

### Prerequisites

1. **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
2. **MongoDB** (v6 or higher) - [Download](https://www.mongodb.com/try/download/community)

### Setup Instructions

1. **Clone or download this project**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start MongoDB** (if not running as a service)
   ```bash
   # Windows
   mongod --dbpath="C:\data\db"
   
   # macOS/Linux
   mongod --dbpath="/data/db"
   ```

4. **Run the application**
   ```bash
   npm start
   ```

### AI Insights Setup

AI Insights requires a Groq API key at runtime. Set it in your shell before starting the app:

```powershell
$env:GROQ_API_KEY="your_groq_api_key"
npm start
```

If `GROQ_API_KEY` is not set, the rest of the desktop app still works, but AI Insights requests will return a configuration error.

## Usage

### First Time Login

On first startup, the application creates an `admin` user automatically.

- **Username**: admin
- **Password**: value from the `DEFAULT_ADMIN_PASSWORD` environment variable, if set
- If `DEFAULT_ADMIN_PASSWORD` is not set, a secure temporary password is generated and printed to the application console during startup

### Creating a Project

1. Click on "Projects" in the navigation
2. Click "+ Add New Project"
3. Fill in project details (name, location, budget, etc.)
4. Click "Create Project"

### Managing Labour

1. Select a project first
2. Navigate to "Labour" module
3. Choose a worker category (Mason, Helper, Electrician, Carpenter)
4. Add workers with their details, wages, and assigned tools
5. Track days worked and calculate costs

### Cost Calculation

The Labour module includes two calculation methods:

1. **Wage-Based**: Calculate total cost based on number of workers, daily wages, and days worked
2. **Square-Feet Based**: Calculate cost based on area and rate per square foot

### Finance Dashboard

The Finance module provides:
- Budget overview and utilization percentage
- Cost breakdown across all categories
- Visual charts and detailed reports
- Real-time budget tracking

## Database Configuration

The application stores data in MongoDB. You can configure the storage location:

1. Go to Settings
2. Click "Browse" next to Database Storage Path
3. Select your preferred location (e.g., external drive)
4. Restart the application

**Default database path**: `./data` (in project directory)

## Development

### Run in development mode (with DevTools)
```bash
npm run dev
```

### Build for production

**Windows:**
```bash
npm run build:win
```

**macOS:**
```bash
npm run build:mac
```

**Linux:**
```bash
npm run build:linux
```

Built applications will be in the `dist` folder.

## Project Structure

```
Consulting-project/
├── main.js                 # Electron main process
├── preload.js              # IPC security bridge
├── package.json            # Dependencies
├── index.html              # Application entry point
│
├── css/
│   └── styles.css         # Global styles
│
├── js/
│   ├── app.js             # Main app controller
│   ├── auth.js            # Authentication module
│   ├── project-manager.js # Project management
│   └── modules/
│       ├── labour.js      # Labour module
│       ├── labour-calculator.js
│       ├── materials.js   # Materials module
│       ├── equipment.js   # Equipment module
│       └── finance.js     # Finance module
│
├── db/
│   ├── connection.js      # MongoDB connection
│   └── operations.js      # CRUD operations
│
└── views/
    └── settings.html      # Settings view
```

## Troubleshooting

### MongoDB Connection Issues

If you see "Database Error" on startup:

1. **Check if MongoDB is running**
   ```bash
   # Windows
   sc query MongoDB
   
   # macOS/Linux
   ps aux | grep mongod
   ```

2. **Start MongoDB manually**
   ```bash
   mongod --dbpath="path/to/data/directory"
   ```

3. **Use fallback in-memory database**
   - The application automatically falls back to an in-memory database if MongoDB is not available
   - Data will not persist between sessions in this mode

### Application Won't Start

1. Delete `node_modules` and reinstall
   ```bash
   rm -rf node_modules
   npm install
   ```

2. Clear Electron cache
   ```bash
   rm -rf %APPDATA%/construction-operations-manager
   ```

## Features Roadmap

- [ ] Data export to Excel/PDF
- [ ] User authentication with multiple users
- [ ] Backup and restore functionality
- [ ] Advanced reporting with charts
- [ ] Mobile companion app
- [ ] Cloud sync (optional)

## License

MIT License - Free to use and modify

## Support

For issues or questions:
- Check the documentation above
- Review MongoDB connection setup
- Ensure all dependencies are installed

---

**Built with ❤️ for Construction Management**
