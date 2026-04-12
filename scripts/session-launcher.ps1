# Copilot Session Launcher
# Polls the FlowState app for sessions with status 'logged' and auto-launches them.
# Captures agency copilot output and streams it back to the web UI.
#
# Usage: pwsh scripts/session-launcher.ps1
# Stop:  Ctrl+C

param(
    [string]$AppUrl = "http://localhost:31060",
    [string]$WorkspacePath = "$HOME\agent-workspace",
    [int]$PollSeconds = 5
)

Write-Host "🚀 Session Launcher watching $AppUrl (poll every ${PollSeconds}s)"
Write-Host "   Workspace: $WorkspacePath"
Write-Host "   Press Ctrl+C to stop"
Write-Host ""

function Send-Logs($sessionId, [string[]]$lines) {
    if ($lines.Count -eq 0) { return }
    try {
        $body = @{ lines = $lines } | ConvertTo-Json -Compress
        Invoke-RestMethod -Uri "$AppUrl/api/sessions/$sessionId/logs" -Method POST `
            -ContentType 'application/json' -Body $body -ErrorAction Stop | Out-Null
    } catch {}
}

while ($true) {
    try {
        $sessions = Invoke-RestMethod -Uri "$AppUrl/api/sessions" -ErrorAction Stop

        foreach ($session in $sessions) {
            if ($session.status -ne "logged") { continue }
            if (-not $session.task_prompt -and -not $session.notes) { continue }

            $prompt = if ($session.task_prompt) { $session.task_prompt } else { $session.notes }
            $repo = if ($session.repo) { $session.repo } else { "." }

            # Resolve repo path
            if ($repo -ne "." -and -not [System.IO.Path]::IsPathRooted($repo)) {
                $repo = Join-Path $WorkspacePath $repo
            }

            if (-not (Test-Path $repo)) {
                Write-Host "⚠️  Skipping session $($session.id): repo path '$repo' not found"
                continue
            }

            Write-Host "🤖 Launching session $($session.id): $($session.notes)"

            # Mark as launched
            try {
                Invoke-RestMethod -Uri "$AppUrl/api/sessions/$($session.id)/launch" -Method POST -ErrorAction Stop | Out-Null
            } catch {}

            # Launch agency copilot as a background job, capturing output
            $sid = $session.id
            $escapedPrompt = $prompt -replace "'", "''"
            $scriptBlock = {
                param($repoPath, $promptText)
                Set-Location $repoPath
                & agency copilot --prompt $promptText 2>&1
            }

            $job = Start-Job -ScriptBlock $scriptBlock -ArgumentList $repo, $prompt

            # Start a background monitor that streams output to the app
            $monitorBlock = {
                param($jobToWatch, $appBaseUrl, $sessionId)
                $buffer = @()
                while ($jobToWatch.State -eq 'Running' -or $jobToWatch.HasMoreData) {
                    $output = Receive-Job -Job $jobToWatch -ErrorAction SilentlyContinue
                    if ($output) {
                        $lines = @($output | ForEach-Object { $_.ToString() })
                        if ($lines.Count -gt 0) {
                            try {
                                $body = @{ lines = $lines } | ConvertTo-Json -Compress
                                Invoke-RestMethod -Uri "$appBaseUrl/api/sessions/$sessionId/logs" -Method POST `
                                    -ContentType 'application/json' -Body $body -ErrorAction Stop | Out-Null
                            } catch {}
                            foreach ($l in $lines) { Write-Host "  [$sessionId] $l" }
                        }
                    }
                    Start-Sleep -Milliseconds 500
                }
                # Mark completed
                try {
                    Invoke-RestMethod -Uri "$appBaseUrl/api/sessions/$sessionId" -Method PUT `
                        -ContentType 'application/json' -Body '{"status":"completed"}' -ErrorAction Stop | Out-Null
                } catch {}
            }

            Start-Job -ScriptBlock $monitorBlock -ArgumentList $job, $AppUrl, $sid | Out-Null

            Write-Host "✅ Launched session $sid (background job $($job.Id))"
            Write-Host ""
        }
    } catch {
        # App might be temporarily unavailable
    }

    Start-Sleep -Seconds $PollSeconds
}
