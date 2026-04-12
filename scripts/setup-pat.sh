#!/bin/bash
# Creates a short-lived ADO PAT with minimum scopes (Work Items Read)
# and stores it in a .env file for docker-compose.
#
# Prerequisites: az cli logged in
#
# Usage: ./scripts/setup-pat.sh [PAT_ORG] [ADO_ORG] [ADO_PROJECT]

set -euo pipefail

PAT_ORG="${1:-IdentityDivision}"
ADO_ORG="${2:-IdentityDivision}"
ADO_PROJECT="${3:-Engineering}"
PAT_NAME="flowstate-$(date +%Y%m%d%H%M%S)"
EXPIRY_DATE=$(date -u -d "+6 days" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v+6d +%Y-%m-%dT%H:%M:%SZ)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

echo "==> Getting Azure AD token for ADO..."
BEARER_TOKEN=$(az account get-access-token \
  --resource "499b84ac-1321-427f-aa17-267ca6975798" \
  --query accessToken -o tsv)

if [ -z "$BEARER_TOKEN" ]; then
  echo "ERROR: Failed to get Azure AD token. Run 'az login' first."
  exit 1
fi

echo "==> Creating PAT '${PAT_NAME}' in org '${PAT_ORG}' (expires: ${EXPIRY_DATE})..."
CREATE_RESPONSE=$(curl -s -X POST \
  "https://vssps.dev.azure.com/${PAT_ORG}/_apis/tokens/pats?api-version=7.1-preview.1" \
  -H "Authorization: Bearer ${BEARER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"displayName\": \"${PAT_NAME}\",
    \"scope\": \"vso.work\",
    \"validTo\": \"${EXPIRY_DATE}\",
    \"allOrgs\": false
  }")

PAT_TOKEN=$(echo "$CREATE_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['patToken']['token'])" 2>/dev/null)
AUTH_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['patToken']['authorizationId'])" 2>/dev/null)

if [ -z "$PAT_TOKEN" ] || [ "$PAT_TOKEN" = "None" ]; then
  echo "ERROR: Failed to create PAT. Response:"
  echo "$CREATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESPONSE"
  exit 1
fi

echo "==> Writing .env file..."
cat > "$ENV_FILE" <<EOF
ADO_ORG=${ADO_ORG}
ADO_PROJECT=${ADO_PROJECT}
ADO_PAT=${PAT_TOKEN}
ADO_PAT_AUTH_ID=${AUTH_ID}
ADO_PAT_NAME=${PAT_NAME}
ADO_PAT_ORG=${PAT_ORG}
EOF

echo ""
echo "✅ PAT '${PAT_NAME}' created and saved to .env"
echo "   Scopes:  vso.work (Work Items Read)"
echo "   Expires: ${EXPIRY_DATE}"
