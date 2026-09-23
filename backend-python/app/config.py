from app.env_loader import env_config

class Settings:
    PORT: int = env_config["PORT"]
    HOST: str = env_config["HOST"]
    
    # Google Sheets Configuration
    SPREADSHEET_ID: str = env_config["SPREADSHEET_ID"]
    SHEET_NAME: str = env_config["SHEET_NAME"]
    CREDENTIALS_FILE: str = env_config["CREDENTIALS_FILE"]
    SERVICE_ACCOUNT_JSON_RAW: str = env_config["SERVICE_ACCOUNT_JSON_RAW"]
    
    # Polling & Synchronization
    POLL_INTERVAL_SECONDS: float = env_config["POLL_INTERVAL_SECONDS"]
    ENABLE_POLLING: bool = env_config["ENABLE_POLLING"]
    
    # Node.js Internal Communication Gateway
    NODE_INTERNAL_URL: str = env_config["NODE_INTERNAL_URL"]

settings = Settings()
