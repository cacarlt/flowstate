#!/bin/bash
# Creates an ADO PAT and writes .env for docker-compose.
# Run this before `docker compose up`.
set -e

echo "==> Setting up ADO PAT..."
bash scripts/setup-pat.sh "$@"

echo ""
echo "✅ Ready. Run: docker compose up -d --build"
