#!/bin/bash
# Revokes the ADO PAT that was created by setup-pat.sh
# and removes the .env file.
#
# Prerequisites: az cli logged in

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "No .env file found. Nothing to revoke."
  exit 0
fi

echo "==> Reading PAT info from .env..."
AUTH_ID=$(grep '^ADO_PAT_AUTH_ID=' "$ENV_FILE" | cut -d= -f2- || true)
PAT_NAME=$(grep '^ADO_PAT_NAME=' "$ENV_FILE" | cut -d= -f2- || true)
PAT_ORG=$(grep '^ADO_PAT_ORG=' "$ENV_FILE" | cut -d= -f2- || echo "IdentityDivision")

if [ -z "$AUTH_ID" ]; then
  echo "WARN: No PAT authorization ID found in .env. Removing file only."
  rm -f "$ENV_FILE"
  echo "✅ .env removed."
  exit 0
fi

echo "==> Getting Azure AD token for ADO..."
BEARER_TOKEN=$(az account get-access-token \
  --resource "499b84ac-1321-427f-aa17-267ca6975798" \
  --query accessToken -o tsv)

if [ -z "$BEARER_TOKEN" ]; then
  echo "ERROR: Failed to get Azure AD token. Run 'az login' first."
  exit 1
fi

echo "==> Revoking PAT '${PAT_NAME}' from org '${PAT_ORG}' (authorizationId: ${AUTH_ID})..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
  "https://vssps.dev.azure.com/${PAT_ORG}/_apis/tokens/pats?authorizationId=${AUTH_ID}&api-version=7.1-preview.1" \
  -H "Authorization: Bearer ${BEARER_TOKEN}")

if [ "$HTTP_STATUS" = "204" ] || [ "$HTTP_STATUS" = "200" ]; then
  echo "==> PAT revoked successfully."
elif [ "$HTTP_STATUS" = "404" ]; then
  echo "==> PAT already expired or revoked (404)."
else
  echo "WARN: Unexpected response (HTTP ${HTTP_STATUS}). PAT may still be active."
fi

echo "==> Removing .env file..."
rm -f "$ENV_FILE"

echo ""
echo "✅ PAT '${PAT_NAME}' revoked and .env removed."
