#!/usr/bin/env pwsh
# start.ps1 — Cold boot startup for FlowState
# Run this to bring up the full environment from scratch.
#
# Usage: .\start.ps1

$ErrorActionPreference = "Continue"
$root = $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FlowState — Starting Up" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Wait for Docker to be ready (polls in background-friendly way)
Write-Host "[1/5] Waiting for Docker..." -ForegroundColor Yellow
$maxWait = 300  # 5 minutes max
$elapsed = 0
$interval = 10
$docker = $null
while ($elapsed -lt $maxWait) {
    $docker = docker info 2>&1 | Select-String "Server Version"
    if ($docker) { break }
    if ($elapsed -eq 0) {
        # First check failed — try launching Docker Desktop
        $dd = Get-Command "Docker Desktop.exe" -ErrorAction SilentlyContinue
        if (-not $dd) {
            $dd = Get-Command "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
        }
        if ($dd) {
            Write-Host "  Docker not ready — launching Docker Desktop..." -ForegroundColor Yellow
            Start-Process $dd.Source
        } else {
            Write-Host "  Docker not ready — waiting for it to start..." -ForegroundColor Yellow
        }
    }
    Start-Sleep $interval
    $elapsed += $interval
    Write-Host "  Still waiting for Docker... ($elapsed s / $maxWait s)" -ForegroundColor DarkGray
}
if ($docker) {
    Write-Host "  Docker OK: $($docker.Line.Trim())" -ForegroundColor Green
} else {
    Write-Host "  Docker did not start within $maxWait seconds — giving up." -ForegroundColor Red
    exit 1
}

# 2. Ensure shared Traefik proxy is running
Write-Host "[2/5] Starting shared Traefik proxy..." -ForegroundColor Yellow
$traefikDir = Join-Path (Split-Path $root -Parent) "traefik"
if (Test-Path "$traefikDir\docker-compose.yml") {
    $traefikRunning = docker ps --filter "name=^traefik$" --format "{{.Names}}" 2>$null
    if ($traefikRunning -ne "traefik") {
        Push-Location $traefikDir
        docker-compose up -d 2>&1 | Out-Null
        Pop-Location
        Write-Host "  Traefik started (http://*.localhost)" -ForegroundColor Green
    } else {
        Write-Host "  Traefik already running" -ForegroundColor Green
    }
} else {
    Write-Host "  Traefik not found at $traefikDir — skipping (direct port access still works)" -ForegroundColor Yellow
}

# 3. Build and start the app container
Write-Host "[3/5] Starting FlowState container (port 31060)..." -ForegroundColor Yellow
Push-Location $root
docker-compose up -d --build 2>&1 | Out-Null
Pop-Location
Start-Sleep 5

# 4. Verify app is responding
Write-Host "[4/5] Checking app health..." -ForegroundColor Yellow
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:31060" -TimeoutSec 10 -UseBasicParsing
    if ($resp.StatusCode -eq 200) {
        Write-Host "  FlowState OK (HTTP 200)" -ForegroundColor Green
    } else {
        Write-Host "  FlowState responded with HTTP $($resp.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  FlowState not responding — check: docker logs flowstate" -ForegroundColor Red
}

# 5. Start session launcher (host-side, polls for Copilot sessions)
Write-Host "[5/5] Starting session launcher..." -ForegroundColor Yellow
$launcher = Join-Path $root "scripts\session-launcher.ps1"
if (Test-Path $launcher) {
    # Kill any existing session launcher
    Get-Process -Name pwsh -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*session-launcher*" } |
        ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
    Start-Process -FilePath pwsh -ArgumentList "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcher`"" -WindowStyle Hidden
    Write-Host "  Session launcher started" -ForegroundColor Green
} else {
    Write-Host "  Session launcher not found — skipping" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Dashboard: http://flowstate.localhost" -ForegroundColor Cyan
Write-Host "       also: http://localhost:31060" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop: .\stop.ps1" -ForegroundColor DarkGray

# Desktop notification
try {
    $xml = @"
<toast activationType="protocol" launch="http://flowstate.localhost">
  <visual>
    <binding template="ToastGeneric">
      <text>FlowState is ready</text>
      <text>http://flowstate.localhost</text>
    </binding>
  </visual>
</toast>
"@
    $toastXml = [Windows.Data.Xml.Dom.XmlDocument]::new()
    $toastXml.LoadXml($xml)
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("FlowState").Show(
        [Windows.UI.Notifications.ToastNotification]::new($toastXml)
    )
} catch {
    # Notifications not available (e.g., headless session) — ignore
}
