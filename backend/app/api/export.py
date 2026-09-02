"""Export API endpoint: generate annotated PDF copies and serve original student PDF pages."""

import io
from pathlib import Path

import fitz  # PyMuPDF
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.config import EXPORTS_DIR
from app.core.pdf_exporter import export_annotated_pdf
from app.database import get_db
from app.models.annotation import Annotation
from app.models.submission import Submission

router = APIRouter(prefix="/grading", tags=["Export"])


@router.get("/{submission_id}/pdf")
def get_original_pdf(submission_id: str, db: Session = Depends(get_db)):
    """Serve the original uploaded student PDF for rendering or downloading."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    original_path = Path(submission.original_pdf_path)
    if not original_path.exists():
        raise HTTPException(status_code=404, detail="Original PDF file not found on disk")

    return FileResponse(
        path=str(original_path),
        media_type="application/pdf",
        filename=submission.student_pdf_filename,
    )


@router.get("/{submission_id}/page/{page_num}")
def get_pdf_page_image(submission_id: str, page_num: int, db: Session = Depends(get_db)):
    """
    Render a single page of the original student PDF as a PNG image with page dimension headers.
    page_num is 1-indexed.
    """
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    original_path = Path(submission.original_pdf_path)
    if not original_path.exists():
        raise HTTPException(status_code=404, detail="Original PDF file not found on disk")

    try:
        doc = fitz.open(str(original_path))
        total_pages = len(doc)
        if page_num < 1 or page_num > total_pages:
            doc.close()
            raise HTTPException(status_code=404, detail=f"Page {page_num} out of bounds (1..{total_pages})")

        page = doc[page_num - 1]
        width = page.rect.width
        height = page.rect.height

        # Render page to PNG at 150 DPI
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("png")
        doc.close()

        return Response(
            content=img_bytes,
            media_type="image/png",
            headers={
                "X-Total-Pages": str(total_pages),
                "X-Page-Width": str(width),
                "X-Page-Height": str(height),
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render page image: {e}")


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
        export_annotated_pdf(original_path, annotations, output_path, submission=submission)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF export failed: {e}")

    return FileResponse(
        path=str(output_path),
        media_type="application/pdf",
        filename=output_filename,
    )
