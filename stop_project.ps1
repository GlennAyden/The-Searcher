Write-Host "Stopping Project Searcher Services..."

$ports = @(3000, 8000)

foreach ($port in $ports) {
    Write-Host "Checking port $port..."
    # Find process ID using NetTCPConnection
    $processIds = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    
    if ($processIds) {
        foreach ($pid_to_kill in $processIds) {
            try {
                $proc = Get-Process -Id $pid_to_kill -ErrorAction Stop
                Stop-Process -Id $pid_to_kill -Force -ErrorAction Stop
                Write-Host "  Stopped process '$($proc.ProcessName)' (PID: $pid_to_kill) on port $port"
            } catch {
                Write-Host "  Failed to stop process PID $pid_to_kill on port $port. It might already be gone."
            }
        }
    } else {
        Write-Host "  No active process found on port $port"
    }
}

Write-Host "Done."
Start-Sleep -Seconds 2
