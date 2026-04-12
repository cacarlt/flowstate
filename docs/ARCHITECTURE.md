# FlowState — Architecture

## Overview

Personal task management web app with integrations for Azure DevOps (work) and GitHub (personal). Runs as a single Docker container, configured via environment variables. Same image deploys to a work laptop or a homelab — only the `.env` differs.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS (Vite) |
| Backend | Express + TypeScript |
| Database | SQLite via sql.js (pure JS, no native deps) |
| Icons | Lucide React |
| Containerization | Docker + Docker Compose |
| Observability | Prometheus + Grafana |

## How It Works

### Request Flow

```
Browser (:5173 dev / :3001 prod)
  → Vite proxy (dev) or Express static (prod)
  → Express API routes (/api/*)
  → sql.js in-memory DB ←→ data/todos.db on disk
```

### Data Model

```
projects ──< todos ──< todo_ado_links >── ado_items
                   ──< todo_copilot_sessions >── copilot_sessions
```

- **Projects** group tasks. Totals (hours, progress) are derived via SQL aggregation — never stored.
- **Todos** have title, estimate_hours, due_date, status (todo → in_progress → done).
- **ADO items** are read-only references pulled from Azure DevOps. Linked to todos via junction table.
- **Copilot sessions** log terminal session context with notes, URL, repo, branch.
- **GitHub items** (when `INTEGRATIONS=github`) store issues/PRs from GitHub.

### Database Layer

sql.js runs SQLite in-memory and persists to disk after every write via the `run()` helper in `server/src/db/index.ts`. The `save()` function writes the full DB to `data/todos.db`. For tests, `DB_PATH=:memory:` skips file I/O entirely.

### Profile System

The app adapts to its environment via three env vars:

| Var | Purpose | Example |
|-----|---------|---------|
| `PROFILE_NAME` | Shown in header badge | `Work` / `Personal` |
| `PROFILE_COLOR` | Badge accent color | `#3b82f6` (blue) / `#10b981` (green) |
| `INTEGRATIONS` | Comma-separated list of enabled integrations | `ado` / `github` / `ado,github` |

The `GET /api/config` endpoint returns these values. The UI dynamically shows/hides tabs based on enabled integrations.

### ADO Integration

- **Sync** (`POST /api/ado/sync`): Queries ADO via WIQL for PBIs and Features assigned to the user. Stores results locally in `ado_items` table. Read-only pull — never pushes changes.
- **PAT Status** (`GET /api/ado/pat-status`): Checks the PAT lifecycle via the ADO PAT Lifecycle API. Returns name, scopes, expiry, days remaining, and a link to the manage tokens page.
- **Auth**: PAT stored in `.env` as `ADO_PAT`. Server-side only — never sent to the browser.

### GitHub Integration

- **Sync** (`POST /api/github/sync`): Fetches open issues/PRs assigned to the user via GitHub API. Stores in `github_items` table.
- **Auth**: Personal access token in `GITHUB_TOKEN` env var.

### Observability

- **Prometheus metrics** exposed at `GET /metrics` — request count, latency histogram, error rate, active connections, DB size.
- **Grafana dashboard** JSON at `grafana/dashboard.json` — import into your existing Grafana.
- See `docs/OBSERVABILITY.md` for Prometheus scrape config (Docker, Kubernetes, cross-network).

## Deployment

### Work Laptop

```bash
cp .env.work.example .env    # Configure ADO creds
docker compose up -d --build  # Start app on :3001
```

### Homelab

```bash
cp .env.personal.example .env  # Configure GitHub token
docker compose up -d --build   # Start app on :3001
```

Access from phone via VPN. Same image, same port, different `.env`.

### With Monitoring

Point your existing Prometheus at `<host>:3001/metrics` and import `grafana/dashboard.json`.
See [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md) for scrape config examples.

## Security

- `.env` files are gitignored and never committed
- PATs are stored only in `.env` and injected via Docker Compose environment
- A pre-commit hook scans for secrets and blocks commits containing PATs or tokens
- ADO PAT scoped to minimum permissions (`vso.work` — Work Items Read)
- `scripts/check-pat.sh` reports PAT lifecycle status without auto-rotating

## Testing

| Layer | Framework | What |
|-------|-----------|------|
| Unit | Vitest | DB helpers, schema |
| Integration | Vitest + Supertest | API routes, CRUD, aggregation |
| Component | Vitest + RTL | React components with mocked fetch |
| E2E | Playwright | Full browser flows |

```bash
npm test          # Unit + integration (server + client)
npm run test:e2e  # Browser E2E
```

A pre-push git hook runs all tests and blocks pushes if any fail.
