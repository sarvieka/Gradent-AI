"""Export API endpoint: generate annotated PDF copies."""

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import EXPORTS_DIR
from app.core.pdf_exporter import export_annotated_pdf
from app.database import get_db
from app.models.annotation import Annotation
from app.models.submission import Submission

router = APIRouter(prefix="/grading", tags=["Export"])


@router.post("/{submission_id}/export")
def export_grading_pdf(submission_id: str, db: Session = Depends(get_db)):
    """
    Generate an annotated PDF copy for a submission.

    The original student PDF is never modified.
    Returns the annotated PDF as a file download.
    """
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    original_path = Path(submission.original_pdf_path)
    if not original_path.exists():
        raise HTTPException(status_code=500, detail="Original PDF file not found on disk")

    annotations = db.query(Annotation).filter(
        Annotation.submission_id == submission_id
    ).all()

    if not annotations:
        raise HTTPException(
            status_code=400,
            detail="No annotations to export for this submission",
        )

    output_filename = f"annotated_{submission.student_pdf_filename}"
    output_path = EXPORTS_DIR / output_filename

    try:
        export_annotated_pdf(original_path, annotations, output_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF export failed: {e}")

    return FileResponse(
        path=str(output_path),
        media_type="application/pdf",
        filename=output_filename,
    )
