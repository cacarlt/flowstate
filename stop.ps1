#!/usr/bin/env pwsh
# stop.ps1 — Shut down the FlowState environment
#
# Usage: .\stop.ps1

$root = $PSScriptRoot

Write-Host "Stopping FlowState..." -ForegroundColor Yellow

# Stop the container
Push-Location $root
docker-compose down 2>&1 | Out-Null
Pop-Location
Write-Host "  Container stopped" -ForegroundColor Green

# Stop the session launcher
Get-Process -Name pwsh -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*session-launcher*" } |
    ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
Write-Host "  Session launcher stopped" -ForegroundColor Green

Write-Host "Done. Data persists in the data/ directory." -ForegroundColor DarkGray
