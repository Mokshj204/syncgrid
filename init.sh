#!/usr/bin/env bash
# ==============================================================================
# Project Initialization Script (Bash / POSIX)
# Real-Time Google Sheets <-> Web Sync Engine
# ==============================================================================

set -eo pipefail

# Determine repository root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Text Styling
COLOR_RESET="\033[0m"
COLOR_BOLD="\033[1m"
COLOR_GREEN="\033[32m"
COLOR_YELLOW="\033[33m"
COLOR_RED="\033[31m"
COLOR_CYAN="\033[36m"
COLOR_MAGENTA="\033[35m"

print_header() {
    echo -e "\n${COLOR_MAGENTA}${COLOR_BOLD}======================================================================${COLOR_RESET}"
    echo -e "${COLOR_MAGENTA}${COLOR_BOLD}   Google Sheets Web Sync Engine - Project Initialization             ${COLOR_RESET}"
    echo -e "${COLOR_MAGENTA}${COLOR_BOLD}======================================================================${COLOR_RESET}\n"
}

log_ok() {
    echo -e " ${COLOR_GREEN}[OK]${COLOR_RESET} $1"
}

log_info() {
    echo -e " ${COLOR_CYAN}[INFO]${COLOR_RESET} $1"
}

log_warn() {
    echo -e " ${COLOR_YELLOW}[WARN]${COLOR_RESET} $1"
}

log_error() {
    echo -e " ${COLOR_RED}[ERROR]${COLOR_RESET} $1"
}

log_step() {
    echo -e "\n${COLOR_BOLD}==> $1${COLOR_RESET}"
}

show_help() {
    echo "Usage: ./init.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --pip            Use pip for Python dependencies (default)"
    echo "  --uv             Use uv for Python dependencies (if installed)"
    echo "  --skip-install   Run environment and dependency checks only without installing"
    echo "  -h, --help       Show this help message"
    echo ""
    exit 0
}

# Parse Command Line Arguments
PACKAGE_MANAGER="pip"
SKIP_INSTALL=false

for arg in "$@"; do
    case "$arg" in
        --pip)
            PACKAGE_MANAGER="pip"
            ;;
        --uv)
            PACKAGE_MANAGER="uv"
            ;;
        --skip-install)
            SKIP_INSTALL=true
            ;;
        -h|--help)
            show_help
            ;;
        *)
            echo "Unknown argument: $arg"
            show_help
            ;;
    esac
done

print_header

# ==============================================================================
# 1. Dependency Checks
# ==============================================================================
log_step "Checking System Dependencies..."

HAS_ERRORS=false

# 1.1 Check Node.js
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node -v)
    log_ok "Node.js detected: ${COLOR_BOLD}${NODE_VERSION}${COLOR_RESET} ($(which node))"
    
    # Extract major version number
    NODE_MAJOR=$(node -v | sed -E 's/v([0-9]+).*/\1/')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        log_warn "Node.js version is ${NODE_VERSION}. Recommended version is v18.0.0 or higher."
    fi
else
    log_error "Node.js is not found! Please install Node.js (v18+) from https://nodejs.org or via nvm."
    HAS_ERRORS=true
fi

# 1.2 Check npm
if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm -v)
    log_ok "npm detected: ${COLOR_BOLD}v${NPM_VERSION}${COLOR_RESET}"
else
    log_error "npm is not found! Please ensure npm is installed with Node.js."
    HAS_ERRORS=true
fi

# 1.3 Check nvm (Node Version Manager)
# nvm may be a shell function (Unix/macOS) or nvm.exe (Windows nvm-windows)
NVM_FOUND=false
NVM_VERSION=""

if command -v nvm.exe >/dev/null 2>&1; then
    NVM_FOUND=true
    NVM_VERSION=$(cmd.exe /c "nvm version" 2>/dev/null | tr -d '\r')
    if [ -z "$NVM_VERSION" ]; then
        NVM_VERSION="detected"
    fi
elif command -v nvm >/dev/null 2>&1; then
    NVM_FOUND=true
    NVM_VERSION=$(nvm --version 2>/dev/null || echo "detected")
elif [ -n "$NVM_DIR" ] && [ -s "$NVM_DIR/nvm.sh" ]; then
    NVM_FOUND=true
    NVM_VERSION="detected in $NVM_DIR"
elif [ -s "$HOME/.nvm/nvm.sh" ]; then
    NVM_FOUND=true
    NVM_VERSION="detected in ~/.nvm"
fi

if [ "$NVM_FOUND" = true ]; then
    log_ok "nvm detected (${NVM_VERSION})"
else
    log_info "nvm (Node Version Manager) not detected in current shell (optional, Node.js is already present)"
fi

# 1.4 Check Python
PYTHON_BIN=""
if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
elif command -v py >/dev/null 2>&1; then
    PYTHON_BIN="py -3"
fi

if [ -n "$PYTHON_BIN" ]; then
    PYTHON_VER_RAW=$($PYTHON_BIN -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')" 2>/dev/null || echo "")
    if [ -n "$PYTHON_VER_RAW" ]; then
        log_ok "Python detected: ${COLOR_BOLD}Python ${PYTHON_VER_RAW}${COLOR_RESET} (using $PYTHON_BIN)"
        
        # Check Python >= 3.10
        PY_VALID=$($PYTHON_BIN -c "import sys; print(1 if sys.version_info >= (3, 10) else 0)" 2>/dev/null || echo "0")
        if [ "$PY_VALID" != "1" ]; then
            log_error "Python version ${PYTHON_VER_RAW} is below the required 3.10+. Please upgrade Python."
            HAS_ERRORS=true
        fi
    else
        log_error "Failed to retrieve Python version from $PYTHON_BIN."
        HAS_ERRORS=true
    fi
else
    log_error "Python 3 is not found! Please install Python 3.10+ from https://www.python.org"
    HAS_ERRORS=true
fi

# 1.5 Check pip
PIP_AVAILABLE=false
if [ -n "$PYTHON_BIN" ]; then
    if $PYTHON_BIN -m pip --version >/dev/null 2>&1; then
        PIP_VER=$($PYTHON_BIN -m pip --version | awk '{print $2}')
        log_ok "pip detected: ${COLOR_BOLD}v${PIP_VER}${COLOR_RESET} (default package manager)"
        PIP_AVAILABLE=true
    else
        log_warn "pip was not found via '$PYTHON_BIN -m pip'."
    fi
fi

# 1.6 Check uv
UV_AVAILABLE=false
if command -v uv >/dev/null 2>&1; then
    UV_VER=$(uv --version 2>/dev/null || echo "detected")
    log_ok "uv detected: ${COLOR_BOLD}${UV_VER}${COLOR_RESET} (alternative package manager)"
    UV_AVAILABLE=true
else
    log_info "uv not detected (optional, pip will be used)"
fi

# 1.7 Check Git
if command -v git >/dev/null 2>&1; then
    log_ok "Git detected: $(git --version)"
fi

# Stop if critical dependencies are missing
if [ "$HAS_ERRORS" = true ]; then
    echo ""
    log_error "Missing required dependencies. Please fix the errors above and rerun ./init.sh"
    exit 1
fi

# Fallback package manager decision
if [ "$PACKAGE_MANAGER" = "uv" ] && [ "$UV_AVAILABLE" = false ]; then
    log_warn "uv was selected via flag but is not installed. Falling back to default: pip."
    PACKAGE_MANAGER="pip"
fi

if [ "$PACKAGE_MANAGER" = "pip" ] && [ "$PIP_AVAILABLE" = false ]; then
    if [ "$UV_AVAILABLE" = true ]; then
        log_warn "pip is unavailable, but uv is installed. Automatically switching to uv."
        PACKAGE_MANAGER="uv"
    else
        log_error "Neither pip nor uv is ready to install Python dependencies. Please install pip or uv."
        exit 1
    fi
fi

log_info "Python package manager selected: ${COLOR_BOLD}${PACKAGE_MANAGER}${COLOR_RESET}"

if [ "$SKIP_INSTALL" = true ]; then
    echo ""
    log_ok "Dependency checks completed successfully. (--skip-install was requested)"
    exit 0
fi

# ==============================================================================
# 2. Environment Configuration (.env)
# ==============================================================================
log_step "Configuring Environment (.env)..."

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_ok "Created .env from .env.example"
        log_warn "Remember to update .env with your PostgreSQL DATABASE_URL and Google Sheets credentials."
    else
        log_warn ".env.example was not found. Please ensure .env is manually configured."
    fi
else
    log_ok ".env file already exists."
fi

# ==============================================================================
# 3. Node.js Dependencies Installation
# ==============================================================================
log_step "Installing Node.js dependencies (Frontend & Backend Gateway)..."

npm install
log_ok "Node.js dependencies installed successfully."

# ==============================================================================
# 4. Python Virtual Environment & Dependencies
# ==============================================================================
log_step "Setting up Python Virtual Environment in backend-python..."

VENV_DIR="backend-python/.venv"
REQ_FILE="backend-python/requirements.txt"

# Ensure requirements.txt exists
if [ ! -f "$REQ_FILE" ]; then
    log_error "Could not find $REQ_FILE! Cannot install Python dependencies."
    exit 1
fi

if [ "$PACKAGE_MANAGER" = "uv" ]; then
    log_info "Using uv to manage virtual environment and dependencies..."
    if [ ! -d "$VENV_DIR" ]; then
        uv venv "$VENV_DIR"
        log_ok "Created virtual environment at $VENV_DIR using uv"
    else
        log_ok "Virtual environment already exists at $VENV_DIR"
    fi
    uv pip install --python "$VENV_DIR" -r "$REQ_FILE"
    log_ok "Python dependencies installed via uv."
else
    log_info "Using pip to manage virtual environment and dependencies..."
    if [ ! -d "$VENV_DIR" ]; then
        $PYTHON_BIN -m venv "$VENV_DIR"
        log_ok "Created virtual environment at $VENV_DIR using python -m venv"
    else
        log_ok "Virtual environment already exists at $VENV_DIR"
    fi

    # Locate virtualenv python and pip (support POSIX bin/ and Windows Git Bash Scripts/)
    VENV_PYTHON=""
    VENV_PIP=""
    if [ -f "$VENV_DIR/bin/python" ]; then
        VENV_PYTHON="$VENV_DIR/bin/python"
        VENV_PIP="$VENV_DIR/bin/pip"
    elif [ -f "$VENV_DIR/Scripts/python.exe" ] || [ -f "$VENV_DIR/Scripts/python" ]; then
        VENV_PYTHON="$VENV_DIR/Scripts/python"
        VENV_PIP="$VENV_DIR/Scripts/pip"
    else
        log_error "Could not find python executable inside $VENV_DIR!"
        exit 1
    fi

    # Ensure pip is present inside virtualenv (e.g. if created by uv without pip)
    if ! "$VENV_PYTHON" -m pip --version >/dev/null 2>&1; then
        log_info "Bootstrapping pip inside virtual environment..."
        "$VENV_PYTHON" -m ensurepip --upgrade || true
    fi

    log_info "Upgrading pip inside virtualenv..."
    "$VENV_PYTHON" -m pip install --upgrade pip --quiet 2>/dev/null || log_warn "Pip upgrade skipped or failed, continuing with package install..."

    log_info "Installing packages from $REQ_FILE..."
    "$VENV_PYTHON" -m pip install -r "$REQ_FILE"
    log_ok "Python dependencies installed successfully via pip."
fi

# ==============================================================================
# 5. Initialization Complete Summary
# ==============================================================================
echo -e "\n${COLOR_GREEN}${COLOR_BOLD}======================================================================${COLOR_RESET}"
echo -e "${COLOR_GREEN}${COLOR_BOLD}   Project Initialized Successfully!                                  ${COLOR_RESET}"
echo -e "${COLOR_GREEN}${COLOR_BOLD}======================================================================${COLOR_RESET}\n"

echo -e "Next steps to run the application:"
echo -e "  1. ${COLOR_BOLD}Database Setup:${COLOR_RESET}"
echo -e "     Ensure PostgreSQL is running and DATABASE_URL is configured in .env"
echo -e "     Seed tables:  ${COLOR_CYAN}npm run db:seed${COLOR_RESET}\n"

echo -e "  2. ${COLOR_BOLD}Start Python Sync Engine:${COLOR_RESET}"
if [ -f "backend-python/.venv/Scripts/python" ] || [ -f "backend-python/.venv/Scripts/python.exe" ]; then
    echo -e "     ${COLOR_CYAN}backend-python/.venv/Scripts/python -m app.main${COLOR_RESET}"
else
    echo -e "     ${COLOR_CYAN}backend-python/.venv/bin/python -m app.main${COLOR_RESET}"
fi
echo -e "     (Runs FastAPI server on port 8000)\n"

echo -e "  3. ${COLOR_BOLD}Start Node.js Gateway & React Frontend:${COLOR_RESET}"
echo -e "     ${COLOR_CYAN}npm run dev${COLOR_RESET}"
echo -e "     (Runs Node Gateway on :5000 and Vite React UI on :5173)\n"

echo -e "  4. ${COLOR_BOLD}Open Web Interface:${COLOR_RESET}"
echo -e "     ${COLOR_CYAN}http://localhost:5173${COLOR_RESET}\n"
