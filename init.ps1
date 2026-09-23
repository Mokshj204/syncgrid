<#
.SYNOPSIS
    Project Initialization Script (PowerShell)
    Real-Time Google Sheets <-> Web Sync Engine

.DESCRIPTION
    Checks all prerequisites (Node.js, npm, nvm, Python, pip, uv, git),
    creates .env from .env.example, installs Node.js workspace dependencies,
    and provisions the Python virtual environment and dependencies using pip (or uv).

.PARAMETER UseUv
    Use uv instead of pip for Python environment management.

.PARAMETER SkipInstall
    Run environment and dependency checks only without installing packages.

.EXAMPLE
    .\init.ps1
    .\init.ps1 -UseUv
    .\init.ps1 -SkipInstall
#>

[CmdletBinding()]
param(
    [switch]$UseUv = $false,
    [switch]$SkipInstall = $false,
    [switch]$Help = $false
)

if ($Help) {
    Get-Help $MyInvocation.MyCommand.Path
    exit 0
}

# Set script location to repo root
$RepoRoot = $PSScriptRoot
Set-Location $RepoRoot

function Write-Ok([string]$Message) {
    Write-Host " [OK] " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Info([string]$Message) {
    Write-Host " [INFO] " -ForegroundColor Cyan -NoNewline
    Write-Host $Message
}

function Write-WarnMsg([string]$Message) {
    Write-Host " [WARN] " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

function Write-ErrMsg([string]$Message) {
    Write-Host " [ERROR] " -ForegroundColor Red -NoNewline
    Write-Host $Message
}

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Magenta
}

Write-Host "`n======================================================================" -ForegroundColor Magenta
Write-Host "   Google Sheets Web Sync Engine - Project Initialization (PowerShell) " -ForegroundColor Magenta
Write-Host "======================================================================`n" -ForegroundColor Magenta

# ==============================================================================
# 1. Dependency Checks
# ==============================================================================
Write-Step "Checking System Dependencies..."

$hasErrors = $false

# 1.1 Check Node.js
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    $nodeVersion = & node -v
    Write-Ok "Node.js detected: $nodeVersion ($($nodeCmd.Source))"
    
    # Check version >= 18
    if ($nodeVersion -match "v(\d+)") {
        $major = [int]$matches[1]
        if ($major -lt 18) {
            Write-WarnMsg "Node.js version is $nodeVersion. Recommended version is v18.0.0 or higher."
        }
    }
} else {
    Write-ErrMsg "Node.js is not found! Please install Node.js (v18+) from https://nodejs.org or via nvm."
    $hasErrors = $true
}

# 1.2 Check npm
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if ($npmCmd) {
    $npmVersion = & npm -v
    Write-Ok "npm detected: v$npmVersion"
} else {
    Write-ErrMsg "npm is not found! Please ensure npm is installed with Node.js."
    $hasErrors = $true
}

# 1.3 Check nvm (Node Version Manager)
$nvmCmd = Get-Command nvm -ErrorAction SilentlyContinue
if ($nvmCmd) {
    try {
        $nvmVersion = & nvm version 2>$null
        Write-Ok "nvm detected: $nvmVersion"
    } catch {
        Write-Ok "nvm detected ($($nvmCmd.Source))"
    }
} else {
    # Check if NVM_HOME exists (common on Windows)
    if ($env:NVM_HOME -and (Test-Path $env:NVM_HOME)) {
        Write-Ok "nvm detected in environment: $env:NVM_HOME"
    } else {
        Write-Info "nvm (Node Version Manager) not detected in current session (optional, Node.js is already present)"
    }
}

# 1.4 Check Python
$pythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonCmd = "py"
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    $pythonCmd = "python3"
}

if ($pythonCmd) {
    try {
        $pyVerRaw = & $pythonCmd -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')"
        Write-Ok "Python detected: Python $pyVerRaw (using $pythonCmd)"

        $pyValid = & $pythonCmd -c "import sys; print(1 if sys.version_info >= (3, 10) else 0)"
        if ($pyValid.Trim() -ne "1") {
            Write-ErrMsg "Python version $pyVerRaw is below the required 3.10+. Please upgrade Python."
            $hasErrors = $true
        }
    } catch {
        Write-ErrMsg "Failed to execute $($pythonCmd): $_"
        $hasErrors = $true
    }
} else {
    Write-ErrMsg "Python 3 is not found! Please install Python 3.10+ from https://www.python.org"
    $hasErrors = $true
}

# 1.5 Check pip
$pipAvailable = $false
if ($pythonCmd) {
    try {
        $pipVer = & $pythonCmd -m pip --version 2>$null
        if ($LASTEXITCODE -eq 0 -and $pipVer) {
            Write-Ok "pip detected: $pipVer (default package manager)"
            $pipAvailable = $true
        } else {
            Write-WarnMsg "pip was not found via '$pythonCmd -m pip'."
        }
    } catch {
        Write-WarnMsg "Error querying pip."
    }
}

# 1.6 Check uv
$uvCmd = Get-Command uv -ErrorAction SilentlyContinue
$uvAvailable = [bool]$uvCmd
if ($uvAvailable) {
    $uvVer = & uv --version
    Write-Ok "uv detected: $uvVer (alternative package manager)"
} else {
    Write-Info "uv not detected (optional, pip will be used)"
}

# 1.7 Check Git
$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if ($gitCmd) {
    $gitVer = & git --version
    Write-Ok "Git detected: $gitVer"
}

# Abort if critical requirements missing
if ($hasErrors) {
    Write-Host "`n"
    Write-ErrMsg "Missing required dependencies. Please resolve the above issues and rerun .\init.ps1"
    exit 1
}

# Determine package manager
$pkgManager = "pip"
if ($UseUv) {
    if ($uvAvailable) {
        $pkgManager = "uv"
    } else {
        Write-WarnMsg "Switch -UseUv specified but uv is not installed. Falling back to default: pip."
    }
}

if ($pkgManager -eq "pip" -and -not $pipAvailable) {
    if ($uvAvailable) {
        Write-WarnMsg "pip is unavailable, but uv is installed. Automatically switching to uv."
        $pkgManager = "uv"
    } else {
        Write-ErrMsg "Neither pip nor uv is ready to install Python dependencies. Please install pip or uv."
        exit 1
    }
}

Write-Info "Python package manager selected: $pkgManager"

if ($SkipInstall) {
    Write-Host "`n"
    Write-Ok "Dependency checks completed successfully. (-SkipInstall requested)"
    exit 0
}

# ==============================================================================
# 2. Environment Configuration (.env)
# ==============================================================================
Write-Step "Configuring Environment (.env)..."

$envPath = Join-Path $RepoRoot ".env"
$envExamplePath = Join-Path $RepoRoot ".env.example"

if (-not (Test-Path $envPath)) {
    if (Test-Path $envExamplePath) {
        Copy-Item -Path $envExamplePath -Destination $envPath
        Write-Ok "Created .env from .env.example"
        Write-WarnMsg "Remember to update .env with your PostgreSQL DATABASE_URL and Google Sheets credentials."
    } else {
        Write-WarnMsg ".env.example was not found. Please ensure .env is manually configured."
    }
} else {
    Write-Ok ".env file already exists."
}

# ==============================================================================
# 3. Node.js Dependencies Installation
# ==============================================================================
Write-Step "Installing Node.js dependencies (Frontend & Backend Gateway)..."

& npm install
if ($LASTEXITCODE -ne 0) {
    Write-ErrMsg "npm install encountered errors."
    exit $LASTEXITCODE
}
Write-Ok "Node.js dependencies installed successfully."

# ==============================================================================
# 4. Python Virtual Environment & Dependencies
# ==============================================================================
Write-Step "Setting up Python Virtual Environment in backend-python..."

$venvDir = Join-Path $RepoRoot "backend-python\.venv"
$reqFile = Join-Path $RepoRoot "backend-python\requirements.txt"

if (-not (Test-Path $reqFile)) {
    Write-ErrMsg "Could not find requirements.txt at $reqFile!"
    exit 1
}

if ($pkgManager -eq "uv") {
    Write-Info "Using uv to manage virtual environment and dependencies..."
    if (-not (Test-Path $venvDir)) {
        & uv venv "$venvDir"
        Write-Ok "Created virtual environment at $venvDir using uv"
    } else {
        Write-Ok "Virtual environment already exists at $venvDir"
    }
    
    & uv pip install --project "$RepoRoot\backend-python" -r "$reqFile"
    if ($LASTEXITCODE -ne 0) {
        Write-ErrMsg "Failed to install Python dependencies via uv."
        exit $LASTEXITCODE
    }
    Write-Ok "Python dependencies installed via uv."
} else {
    Write-Info "Using pip to manage virtual environment and dependencies..."
    if (-not (Test-Path $venvDir)) {
        & $pythonCmd -m venv "$venvDir"
        Write-Ok "Created virtual environment at $venvDir using python -m venv"
    } else {
        Write-Ok "Virtual environment already exists at $venvDir"
    }

    $venvPython = Join-Path $venvDir "Scripts\python.exe"
    if (-not (Test-Path $venvPython)) {
        $venvPython = Join-Path $venvDir "bin\python.exe"
        if (-not (Test-Path $venvPython)) {
            $venvPython = Join-Path $venvDir "bin\python"
        }
    }

    if (-not (Test-Path $venvPython)) {
        Write-ErrMsg "Could not find python executable inside virtual environment at $venvPython!"
        exit 1
    }

    # Ensure pip is present in virtualenv (e.g. if venv was created by uv without pip)
    $hasVenvPip = $false
    try {
        $null = & $venvPython -m pip --version 2>$null
        if ($LASTEXITCODE -eq 0) { $hasVenvPip = $true }
    } catch { }

    if (-not $hasVenvPip) {
        Write-Info "Bootstrapping pip inside virtual environment..."
        & $venvPython -m ensurepip --upgrade
    }

    Write-Info "Upgrading pip inside virtualenv..."
    & $venvPython -m pip install --upgrade pip --quiet 2>$null

    Write-Info "Installing packages from $reqFile..."
    & $venvPython -m pip install -r "$reqFile"
    if ($LASTEXITCODE -ne 0) {
        Write-ErrMsg "Failed to install Python dependencies via pip."
        exit $LASTEXITCODE
    }
    Write-Ok "Python dependencies installed successfully via pip."
}

# ==============================================================================
# 5. Initialization Complete Summary
# ==============================================================================
Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host "   Project Initialized Successfully!                                  " -ForegroundColor Green
Write-Host "======================================================================`n" -ForegroundColor Green

Write-Host "Next steps to run the application:"
Write-Host "  1. " -NoNewline; Write-Host "Database Setup:" -ForegroundColor Yellow
Write-Host "     Ensure PostgreSQL is running and DATABASE_URL is configured in .env"
Write-Host "     Seed database:  " -NoNewline; Write-Host "npm run db:seed" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. " -NoNewline; Write-Host "Start Python Sync Engine:" -ForegroundColor Yellow
Write-Host "     " -NoNewline; Write-Host "backend-python\.venv\Scripts\python -m app.main" -ForegroundColor Cyan
Write-Host "     (Runs FastAPI server on port 8000)"
Write-Host ""
Write-Host "  3. " -NoNewline; Write-Host "Start Node.js Gateway & React Frontend:" -ForegroundColor Yellow
Write-Host "     " -NoNewline; Write-Host "npm run dev" -ForegroundColor Cyan
Write-Host "     (Runs Node Gateway on :5000 and Vite React UI on :5173)"
Write-Host ""
Write-Host "  4. " -NoNewline; Write-Host "Open Web Interface:" -ForegroundColor Yellow
Write-Host "     " -NoNewline; Write-Host "http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
