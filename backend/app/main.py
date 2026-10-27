"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.api.router import api_router
from app.config import settings
from app.database import create_tables



# app instaniation 
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-powered grading and annotation tool for student answer papers.",
    version="1.0.0",
)

# CORS configuration supporting credentialed cookies
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Create database tables on startup
@app.on_event("startup")
def on_startup():
    create_tables()

# Health check (preserved from original)
@app.get("/health")
def health_check():
    return {"status": "ok"}

# Mount all API routes
app.include_router(api_router, prefix="/api")
