import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Search paths for .env
BASE_DIR = Path(__file__).resolve().parent.parent
SEARCH_PATHS = [
    BASE_DIR / ".env",
    BASE_DIR.parent / ".env",
]

loaded_env_path = None
for p in SEARCH_PATHS:
    if p.exists():
        load_dotenv(p)
        loaded_env_path = p
        break

# Schema of required environment variables for Python backend
REQUIRED_PYTHON_VARS = [
    {
        "key": "PYTHON_PORT",
        "description": "Port for FastAPI service",
        "example": "8000",
        "validator": lambda val: (
            None if val.isdigit() and 1 <= int(val) <= 65535 
            else "Must be a valid TCP port number between 1 and 65535."
        ),
    },
    {
        "key": "PYTHON_HOST",
        "description": "Bind address for FastAPI service",
        "example": "0.0.0.0",
        "validator": lambda val: None if val.strip() else "Value cannot be empty.",
    },
    {
        "key": "POLL_INTERVAL_SECONDS",
        "description": "Interval in seconds between Google Sheets change detection checks",
        "example": "3.0",
        "validator": lambda val: (
            None if _is_positive_float(val) 
            else "Must be a positive number greater than 0 (e.g., 3.0)."
        ),
    },
    {
        "key": "ENABLE_POLLING",
        "description": "Enable or disable automated background polling",
        "example": "true",
        "validator": lambda val: (
            None if val.lower() in ("true", "false", "1", "0", "yes", "no") 
            else "Must be a boolean value ('true', 'false', '1', or '0')."
        ),
    },
    {
        "key": "NODE_INTERNAL_URL",
        "description": "Internal communication endpoint to notify Node.js gateway",
        "example": "http://localhost:5000/internal/sync-event",
        "validator": lambda val: (
            None if val.startswith("http://") or val.startswith("https://") 
            else "Must be a valid HTTP or HTTPS URL (e.g., http://localhost:5000/internal/sync-event)."
        ),
    },
]

def _is_positive_float(val: str) -> bool:
    try:
        f = float(val)
        return f > 0
    except ValueError:
        return False

def validate_python_env():
    """
    Validates that all required environment variables are present in the .env file.
    Exits with code 1 if any required variable is missing or invalid.
    """
    if not loaded_env_path:
        print("\n" + "=" * 61, file=sys.stderr)
        print("[ERROR] [EnvLoader] STARTUP ABORTED: Missing .env File", file=sys.stderr)
        print("=" * 61, file=sys.stderr)
        print("Could not find a .env file in:", file=sys.stderr)
        for p in SEARCH_PATHS:
            print(f"  - {p}", file=sys.stderr)
        print("\nPlease copy .env.example to .env and configure the required variables.\n", file=sys.stderr)
        sys.exit(1)

    missing_or_invalid = []

    for item in REQUIRED_PYTHON_VARS:
        key = item["key"]
        raw_val = os.getenv(key)

        if raw_val is None or raw_val.strip() == "":
            missing_or_invalid.append({
                "key": key,
                "reason": "Missing or empty variable in .env",
                "description": item["description"],
                "example": item["example"],
            })
            continue

        error_msg = item["validator"](raw_val.strip())
        if error_msg:
            missing_or_invalid.append({
                "key": key,
                "reason": error_msg,
                "description": item["description"],
                "example": item["example"],
            })

    if missing_or_invalid:
        print("\n" + "=" * 61, file=sys.stderr)
        print("[ERROR] [EnvLoader] Python Sheets Service Startup Aborted", file=sys.stderr)
        print("=" * 61, file=sys.stderr)
        print(f"Source: {loaded_env_path}", file=sys.stderr)
        print("The following required environment variables are missing or invalid in .env:\n", file=sys.stderr)

        for idx, err in enumerate(missing_or_invalid, start=1):
            print(f"  {idx}. [{err['key']}]", file=sys.stderr)
            print(f"     Error:       {err['reason']}", file=sys.stderr)
            print(f"     Description: {err['description']}", file=sys.stderr)
            print(f"     Example:     {err['key']}={err['example']}\n", file=sys.stderr)

        print("Please update your .env file before starting the Python service.", file=sys.stderr)
        print("=" * 61 + "\n", file=sys.stderr)
        sys.exit(1)

    print(f"[EnvLoader] [OK] Python environment variables verified from {loaded_env_path.name}")
    return {
        "PORT": int(os.getenv("PYTHON_PORT", "8000")),
        "HOST": os.getenv("PYTHON_HOST", "0.0.0.0"),
        "POLL_INTERVAL_SECONDS": float(os.getenv("POLL_INTERVAL_SECONDS", "3.0")),
        "ENABLE_POLLING": os.getenv("ENABLE_POLLING", "true").lower() in ("true", "1", "yes"),
        "NODE_INTERNAL_URL": os.getenv("NODE_INTERNAL_URL", "http://localhost:5000/internal/sync-event"),
        "CREDENTIALS_FILE": os.getenv("GOOGLE_APPLICATION_CREDENTIALS", str(BASE_DIR / "credentials.json")),
        "SERVICE_ACCOUNT_JSON_RAW": os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip(),
        "SPREADSHEET_ID": os.getenv("SPREADSHEET_ID", "").strip(),
        "SHEET_NAME": os.getenv("SHEET_NAME", "Sheet1").strip(),
    }

# Execute validation on import
env_config = validate_python_env()
