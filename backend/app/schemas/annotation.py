"""Schemas for annotation CRUD operations."""

from pydantic import BaseModel


class AnnotationUpdate(BaseModel):
    """Payload for updating an annotation."""
    page: int | None = None
    bbox: list[float] | None = None
    annotation_type: str | None = None
    feedback_text: str | None = None


class AnnotationCreate(BaseModel):
    """Payload for creating a new teacher annotation."""
    page: int
    bbox: list[float]
    annotation_type: str = "comment"
    feedback_text: str = ""
