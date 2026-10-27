"""API router: aggregates all endpoint routers."""

from fastapi import APIRouter

from app.api.annotations import router as annotations_router
from app.api.auth import router as auth_router
from app.api.export import router as export_router
from app.api.grading import router as grading_router
from app.api.history import router as history_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(grading_router)
api_router.include_router(annotations_router)
api_router.include_router(export_router)
api_router.include_router(history_router)

