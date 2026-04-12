#!/bin/bash
# Full teardown: revoke PAT + stop containers
set -e

echo "==> Stopping containers..."
docker compose down

echo "==> Revoking ADO PAT..."
bash scripts/teardown-pat.sh

echo ""
echo "✅ Fully torn down. Containers stopped, PAT revoked."
echo "   Data preserved at C:\\Users\\cacarlt\\docker\\appdata\\flowstate\\"
