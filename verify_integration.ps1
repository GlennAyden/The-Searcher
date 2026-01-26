# verify_integration.ps1
# Automated Integration Check for Project Searcher

$ErrorActionPreference = "Stop"

function Print-Header {
    param([string]$Title)
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " $Title" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

function Print-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Print-Error {
    param([string]$Message)
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

$backendDir = Join-Path $PSScriptRoot "backend"
$frontendDir = Join-Path $PSScriptRoot "frontend"

# 1. Environment Check
Print-Header "1. Environment Check"
try {
    $pythonVersion = python --version 2>&1
    Print-Success "Python found: $pythonVersion"
} catch {
    Print-Error "Python not found or error checking version."
    exit 1
}

try {
    $nodeVersion = node --version 2>&1
    Print-Success "Node.js found: $nodeVersion"
} catch {
    Print-Error "Node.js not found."
    exit 1
}

# 2. Backend Verification
Print-Header "2. Backend Verification"

if (Test-Path $backendDir) {
    Push-Location $backendDir
    
    # Check Env Script
    if (Test-Path "scripts/check_env.py") {
        Write-Host "Running environment check script..."
        try {
            python scripts/check_env.py
            Print-Success "Backend environment check passed."
        } catch {
            Print-Error "Backend environment check failed."
        }
    } else {
        Write-Host "scripts/check_env.py not found, skipping." -ForegroundColor Yellow
    }

    # Run Tests
    Write-Host "Running pytest..."
    try {
        pytest tests/
        if ($LASTEXITCODE -eq 0) {
            Print-Success "Backend tests passed."
        } else {
            Print-Error "Backend tests failed."
        }
    } catch {
        Print-Error "Failed to execute pytest. Ensure it is installed."
    }

    Pop-Location
} else {
    Print-Error "Backend directory not found!"
}

# 3. Frontend Verification
Print-Header "3. Frontend Verification"

if (Test-Path $frontendDir) {
    Push-Location $frontendDir

    # Lint
    Write-Host "Running Frontend Lint..."
    try {
        # using cmd /c to ensure npm runs correctly in ps1
        cmd /c "npm run lint"
        if ($LASTEXITCODE -eq 0) {
            Print-Success "Frontend Lint passed."
        } else {
            Print-Error "Frontend Lint failed."
        }
    } catch {
        Print-Error "Failed to run lint."
    }

    # Build
    Write-Host "Running Frontend Build..."
    try {
        cmd /c "npm run build"
        if ($LASTEXITCODE -eq 0) {
            Print-Success "Frontend Build passed."
        } else {
            Print-Error "Frontend Build failed."
        }
    } catch {
        Print-Error "Failed to run build."
    }

    Pop-Location
} else {
    Print-Error "Frontend directory not found!"
}

Print-Header "Verification Complete"
