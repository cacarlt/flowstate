# FlowState

Personal task management app with ADO integration and Copilot session tracking.

## Quick Start

```bash
npm install
cd server && npm install
cd ../client && npm install
cd ..
npm run dev
```

This starts both the Express server (port 3001) and Vite dev server (port 5173).

## ADO Integration (optional)

Copy `.env.example` to `server/.env` and set your ADO credentials:

```bash
ADO_ORG=your-org
ADO_PROJECT=your-project
ADO_PAT=your-personal-access-token
```

Then use the "Sync from ADO" button in the ADO Items tab.

## Architecture

- **`client/`** — React + TypeScript + Tailwind (Vite)
- **`server/`** — Express + TypeScript + sql.js (SQLite)
- **`data/`** — SQLite database file (auto-created)

Data model: Projects → Todos, with optional links to ADO items and Copilot sessions via junction tables.
