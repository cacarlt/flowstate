# Agents

## Repo Rules (enforced)

### No secrets in the repo
- `.env` files are gitignored. Never commit PATs, tokens, or credentials.
- A pre-commit hook in `.githooks/pre-commit` scans staged files and blocks commits containing secrets.
- Setup: `npm run setup:hooks`

### All changes require passing tests
- A pre-push hook in `.githooks/pre-push` runs unit, integration, and E2E tests. Push is blocked if any fail.
- Before submitting any change, run: `npm test && npm run test:e2e`

### One doc for how the app works
- `docs/ARCHITECTURE.md` is the single source of truth for how the app works.
- Update it when architecture changes (new routes, new tables, new integrations).

---

## PAT Status Check

**Trigger**: Run proactively when the user mentions PAT, token, ADO auth, or sync issues — or at the start of any session working in this repo.

**What it does**: Checks the ADO PAT expiry and shows a status summary. If the PAT needs attention, it provides a direct link to the ADO token management page. It does **not** auto-rotate — the user handles that manually.

**How to run**:
```bash
bash scripts/check-pat.sh
```

**Prerequisites**: `az login` must be active.

**Output**: A status box showing PAT name, scope, expiry date, days remaining, and a link to `https://dev.azure.com/{org}/_usersSettings/tokens` if action is needed.

**Exit codes**: 0 = healthy, 1 = needs attention (expiring, expired, or missing).

**When to run this**:
- User mentions ADO sync failing or token errors
- Start of a work session (proactive health check)
- User asks about PAT status or expiry

## Session Launcher

**What it does**: Runs on the host machine alongside the Docker app. Polls for Copilot sessions with status "logged" and auto-launches them in new PowerShell windows via `agency copilot`.

**How to run**:
```powershell
pwsh scripts/session-launcher.ps1
```

**How it works**:
1. Polls `GET /api/sessions` every 5 seconds
2. Finds sessions with `status: logged`
3. Calls `POST /api/sessions/:id/launch` to mark as launched
4. Opens a new `pwsh` window running `agency copilot --prompt '...'` in the session's repo directory

**Requirements**: Must run on the host (not in Docker) so it can open terminal windows. Needs `agency` CLI installed.
