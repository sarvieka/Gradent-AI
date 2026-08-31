"""Schemas for annotation CRUD operations."""

from pydantic import BaseModel


class AnnotationUpdate(BaseModel):
    """Payload for updating an annotation."""
    page: int | None = None
    bbox: list[float] | None = None
    annotation_type: str | None = None
    feedback_text: str | None = None
