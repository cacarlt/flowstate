#!/usr/bin/env pwsh
# install-startup.ps1 — Register FlowState to auto-start at Windows login
#
# Usage: .\install-startup.ps1        (register)
#        .\install-startup.ps1 -Remove (unregister)

param(
    [switch]$Remove
)

$TaskName = "FlowState-Startup"

if ($Remove) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Removed scheduled task '$TaskName'." -ForegroundColor Green
    } else {
        Write-Host "Task '$TaskName' not found — nothing to remove." -ForegroundColor Yellow
    }
    return
}

$startScript = Join-Path $PSScriptRoot "start.ps1"
if (-not (Test-Path $startScript)) {
    Write-Host "Cannot find start.ps1 at $startScript" -ForegroundColor Red
    exit 1
}

# Remove existing task if present (idempotent re-registration)
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$action = New-ScheduledTaskAction `
    -Execute "pwsh.exe" `
    -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startScript`"" `
    -WorkingDirectory $PSScriptRoot

# Delay 30s after logon to let Windows settle before polling Docker
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$trigger.Delay = "PT30S"

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Auto-start FlowState (app + session launcher) at login" `
    -RunLevel Limited | Out-Null

Write-Host "Registered '$TaskName' — FlowState will auto-start when you log in." -ForegroundColor Green
Write-Host "To remove: .\install-startup.ps1 -Remove" -ForegroundColor DarkGray
