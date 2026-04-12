#!/bin/bash
# Checks ADO PAT status and shows lifecycle info.
# Outputs expiry, days remaining, and a link to manage tokens.
#
# Exit codes:
#   0 - PAT is valid (>2 days remaining)
#   1 - PAT needs attention (expiring soon, expired, or missing)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

# --- Check .env exists ---
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ No .env file found. No PAT configured."
  echo ""
  echo "   Create one: bash deploy.sh"
  exit 1
fi

PAT_ORG=$(grep '^ADO_PAT_ORG=' "$ENV_FILE" | cut -d= -f2- || echo "")
AUTH_ID=$(grep '^ADO_PAT_AUTH_ID=' "$ENV_FILE" | cut -d= -f2- || echo "")
PAT_NAME=$(grep '^ADO_PAT_NAME=' "$ENV_FILE" | cut -d= -f2- || echo "")

if [ -z "$AUTH_ID" ] || [ -z "$PAT_ORG" ]; then
  echo "❌ Missing PAT info in .env."
  echo ""
  echo "   Create a new PAT: bash deploy.sh"
  exit 1
fi

# --- Get Azure AD token ---
BEARER_TOKEN=$(az account get-access-token \
  --resource "499b84ac-1321-427f-aa17-267ca6975798" \
  --query accessToken -o tsv 2>/dev/null || true)

if [ -z "$BEARER_TOKEN" ]; then
  echo "❌ Not logged in to Azure. Run 'az login' first."
  exit 1
fi

# --- Look up PAT ---
PAT_RESPONSE=$(curl -s \
  "https://vssps.dev.azure.com/${PAT_ORG}/_apis/tokens/pats?api-version=7.1-preview.1" \
  -H "Authorization: Bearer ${BEARER_TOKEN}")

PAT_STATUS=$(echo "$PAT_RESPONSE" | python3 -c "
import sys, json
from datetime import datetime, timezone, timedelta

data = json.load(sys.stdin)
auth_id = '${AUTH_ID}'
pat = None
for p in data.get('patTokens', []):
    if p.get('authorizationId') == auth_id:
        pat = p
        break

if not pat:
    print('STATUS: not_found')
    print('NAME: ${PAT_NAME}')
    print('EXPIRES: unknown (not found)')
    print('DAYS_LEFT: 0')
    sys.exit()

valid_to = datetime.fromisoformat(pat['validTo'].replace('Z', '+00:00'))
now = datetime.now(timezone.utc)
remaining = valid_to - now
days = remaining.total_seconds() / 86400

print(f'NAME: {pat[\"displayName\"]}')
print(f'SCOPE: {pat.get(\"scope\", \"unknown\")}')
print(f'EXPIRES: {valid_to.strftime(\"%Y-%m-%d %H:%M UTC\")}')
print(f'DAYS_LEFT: {days:.1f}')

if days <= 0:
    print('STATUS: expired')
elif days <= 2:
    print('STATUS: expiring_soon')
else:
    print('STATUS: healthy')
" 2>/dev/null)

# --- Parse and display ---
STATUS=$(echo "$PAT_STATUS" | grep '^STATUS:' | cut -d' ' -f2)
NAME=$(echo "$PAT_STATUS" | grep '^NAME:' | cut -d' ' -f2-)
SCOPE=$(echo "$PAT_STATUS" | grep '^SCOPE:' | cut -d' ' -f2-)
EXPIRES=$(echo "$PAT_STATUS" | grep '^EXPIRES:' | cut -d' ' -f2-)
DAYS_LEFT=$(echo "$PAT_STATUS" | grep '^DAYS_LEFT:' | cut -d' ' -f2)

TOKEN_URL="https://dev.azure.com/${PAT_ORG}/_usersSettings/tokens"

echo "╔══════════════════════════════════════╗"
echo "║         ADO PAT Status               ║"
echo "╠══════════════════════════════════════╣"
echo "║  Name:    $NAME"
echo "║  Scope:   ${SCOPE:-vso.work}"
echo "║  Expires: $EXPIRES"
echo "║  Days:    $DAYS_LEFT remaining"
echo "║"

case "$STATUS" in
  healthy)
    echo "║  ✅ PAT is healthy"
    echo "╚══════════════════════════════════════╝"
    exit 0
    ;;
  expiring_soon)
    echo "║  ⚠️  PAT expires within 2 days!"
    echo "║"
    echo "║  Rotate it here:"
    echo "║  $TOKEN_URL"
    echo "║"
    echo "║  Then update .env with the new token:"
    echo "║    ADO_PAT=<new-token>"
    echo "║  And restart: docker compose up -d"
    echo "╚══════════════════════════════════════╝"
    exit 1
    ;;
  expired)
    echo "║  ❌ PAT has expired!"
    echo "║"
    echo "║  Create a new one here:"
    echo "║  $TOKEN_URL"
    echo "║"
    echo "║  Then update .env and restart:"
    echo "║    docker compose up -d"
    echo "╚══════════════════════════════════════╝"
    exit 1
    ;;
  not_found)
    echo "║  ❌ PAT not found (revoked or expired)"
    echo "║"
    echo "║  Create a new one here:"
    echo "║  $TOKEN_URL"
    echo "╚══════════════════════════════════════╝"
    exit 1
    ;;
esac
