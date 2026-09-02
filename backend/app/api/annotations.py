"""Annotation CRUD API endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.annotation import Annotation
from app.models.submission import Submission
from app.schemas.annotation import AnnotationCreate, AnnotationUpdate
from app.schemas.grading import AnnotationOut

router = APIRouter(prefix="/annotations", tags=["Annotations"])


@router.post("/{submission_id}", response_model=AnnotationOut, status_code=201)
def create_annotation(
    submission_id: str,
    payload: AnnotationCreate,
    db: Session = Depends(get_db),
):
    """Create a new teacher annotation on a submission."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if len(payload.bbox) != 4:
        raise HTTPException(status_code=422, detail="bbox must have exactly 4 values")

    annotation = Annotation(
        id=str(uuid.uuid4()),
        submission_id=submission_id,
        page=payload.page,
        bbox_x0=payload.bbox[0],
        bbox_y0=payload.bbox[1],
        bbox_x1=payload.bbox[2],
        bbox_y1=payload.bbox[3],
        annotation_type=payload.annotation_type,
        feedback_text=payload.feedback_text,
        is_user_edited=True,
    )
    db.add(annotation)
    db.commit()
    db.refresh(annotation)

    return AnnotationOut(
        id=annotation.id,
        submission_id=annotation.submission_id,
        page=annotation.page,
        bbox=annotation.bbox,
        annotation_type=annotation.annotation_type,
        feedback_text=annotation.feedback_text,
        is_user_edited=annotation.is_user_edited,
    )


@router.patch("/{annotation_id}", response_model=AnnotationOut)
def update_annotation(
    annotation_id: str,
    update: AnnotationUpdate,
    db: Session = Depends(get_db),
):
    """Update an annotation's position, type, or feedback text."""
    annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    if update.page is not None:
        annotation.page = update.page
    if update.bbox is not None:
        if len(update.bbox) != 4:
            raise HTTPException(status_code=422, detail="bbox must have exactly 4 values")
        annotation.bbox = update.bbox
    if update.annotation_type is not None:
        annotation.annotation_type = update.annotation_type
    if update.feedback_text is not None:
        annotation.feedback_text = update.feedback_text

    annotation.is_user_edited = True
    db.commit()
    db.refresh(annotation)

    return AnnotationOut(
        id=annotation.id,
        submission_id=annotation.submission_id,
        page=annotation.page,
        bbox=annotation.bbox,
        annotation_type=annotation.annotation_type,
        feedback_text=annotation.feedback_text,
        is_user_edited=annotation.is_user_edited,
    )


@router.delete("/{annotation_id}")
def delete_annotation(
    annotation_id: str,
    db: Session = Depends(get_db),
):
    """Delete an annotation."""
    annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    db.delete(annotation)
    db.commit()
    return {"detail": "Annotation deleted", "id": annotation_id}
