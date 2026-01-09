$root = Get-Location
Write-Host "Starting Project Searcher from $root"

# Start Backend (Port 8000)
# Navigates to backend, activates venv, runs python main.py
$backendCommand = "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process; cd '$root\backend'; . '..\venv\Scripts\Activate.ps1'; python server.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& { $backendCommand }" -WindowStyle Normal

# Start Frontend (Port 3000)
# Navigates to frontend, runs npm run dev
$frontendCommand = "cd '$root\frontend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& { $frontendCommand }" -WindowStyle Normal

Write-Host "Services are launching..."
