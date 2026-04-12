# Copilot Instructions

## What This Repo Is

Personal task management app (FlowState) with ADO (work) and GitHub (personal) integrations, Copilot session tracking with live log streaming, and Prometheus observability. Same Docker image deploys to work laptop or homelab — only `.env` differs.

## Build & Run

```bash
# Install all deps (root + server + client)
npm install && cd server && npm install && cd ../client && npm install && cd ..

# Dev mode (both server + client with hot reload)
npm run dev

# Docker (production)
docker compose up -d --build    # App on :31060

# Session launcher (runs on host, auto-launches Copilot sessions)
pwsh scripts/session-launcher.ps1
```

## Testing

**Every change must have tests. Pre-push hook blocks pushes if tests fail.**

```bash
# All unit + integration tests (server + client)
npm test

# Server only (vitest — unit + integration)
npm run test:server
cd server && npm run test:unit          # Unit tests only
cd server && npm run test:integration   # Integration tests only

# Client only (vitest + RTL + jsdom)
npm run test:client

# E2E (Playwright — starts both servers automatically)
npm run test:e2e
cd e2e && npx playwright test --headed  # Watch in browser

# Single test file
cd server && npx vitest run src/__tests__/unit/db.test.ts
cd client && npx vitest run src/__tests__/TasksView.test.tsx
cd e2e && npx playwright test tests/app.spec.ts -g "create a project"
```

### Test structure
- `server/src/__tests__/unit/` — DB helpers, schema validation
- `server/src/__tests__/integration/` — API routes: projects, todos, sessions (with logs, linking, status), ADO, GitHub, config, metrics
- `client/src/__tests__/` — React components via Testing Library (mocked fetch)
- `e2e/tests/` — Playwright browser tests against running app

### Test expectations for new features
- New API routes → add integration tests in `server/src/__tests__/integration/`
- New React components → add component tests in `client/src/__tests__/`
- New user flows → add E2E tests in `e2e/tests/`
- DB schema changes → test in unit tests and ensure migration works

## Architecture

Monorepo with `client/` (Vite React) and `server/` (Express). SQLite via `sql.js` (pure JS, no native deps).

- **Server entry**: `server/src/index.ts` — async startup, initializes DB then mounts routes
- **App factory**: `server/src/app.ts` — `createApp()` returns Express app without starting listener (used by tests)
- **DB layer**: `server/src/db/index.ts` — wraps sql.js with `all()`, `get()`, `run()` helpers; auto-saves to disk. Includes `runMigrations()` for schema evolution.
- **Routes**: `server/src/routes/{projects,todos,ado,github,sessions,config}.ts`
- **Metrics**: `server/src/metrics.ts` — Prometheus via prom-client, exposed at `GET /metrics`
- **Client entry**: `client/src/main.tsx` → `App.tsx` with profile-aware dynamic tabs
- **API client**: `client/src/api/index.ts` — typed fetch wrapper for all endpoints
- **Components**: `client/src/components/{TasksView,AdoView,GithubView,SessionsView}.tsx`

## Data Model

Tables: `projects`, `todos`, `ado_items`, `todo_ado_links`, `copilot_sessions` (with `project_id`, `todo_id`, `task_prompt`, `status`), `todo_copilot_sessions`, `github_items`, `session_logs`.

- Project totals are **derived** via SQL aggregation, not stored
- Copilot sessions link directly to tasks via `todo_id` FK
- Session logs stored in `session_logs` table, streamed live via SSE at `GET /api/sessions/:id/logs/stream`

## Key Conventions

- **DB writes always call `save()`** — sql.js is in-memory; the `run()` helper auto-persists to disk
- **DB migrations** in `runMigrations()` — ALTER TABLE for existing DBs, CREATE TABLE IF NOT EXISTS for new
- **ADO integration is read-only pull** — never pushes changes back
- **Profile system** — `PROFILE_NAME`, `PROFILE_COLOR`, `INTEGRATIONS` env vars; `GET /api/config` returns them; UI adapts dynamically
- **Session launcher** — `scripts/session-launcher.ps1` runs on host, polls for `logged` sessions, launches `agency copilot`, streams logs back via `POST /api/sessions/:id/logs`
- **Tailwind + Lucide icons** for all styling; dark mode via `class` strategy
- **No auth** — single-user local app

## Enforced Rules

1. **Never commit secrets** — `.env` files are gitignored. Pre-commit hook blocks PATs/tokens. Run `npm run setup:hooks` after cloning.
2. **All changes need tests** — Unit + integration + E2E tests must pass. Pre-push hook enforces this. Add tests for any new endpoint, component, or user flow.
3. **One architecture doc** — `docs/ARCHITECTURE.md` is the single source of truth. Update it when the architecture changes.
