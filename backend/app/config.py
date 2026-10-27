import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


# Resolve paths relative to the backend/ directory
BACKEND_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BACKEND_DIR / "storage"
UPLOADS_DIR = STORAGE_DIR / "uploads"
EXPORTS_DIR = STORAGE_DIR / "exports"


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Grading & Annotation Tool"
    DATABASE_URL: str = f"sqlite:///{BACKEND_DIR / 'app.db'}"
    GEMINI_API_KEY: str = ""
    USE_MOCK_GRADER: bool = True  # Use MockGrader by default; switch to False for Gemini
    
    # Auth & Sessions
    SESSION_COOKIE_NAME: str = "gradent_session"
    SESSION_COOKIE_SECURE: bool = False
    SESSION_COOKIE_SAMESITE: str = "lax"
    SESSION_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")


settings = Settings()

# Ensure storage directories exist
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
