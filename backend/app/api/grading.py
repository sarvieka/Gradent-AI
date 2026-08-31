"""Grading API endpoints: upload & submit, retrieve results."""

import json
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.annotation import Annotation
from app.models.submission import Submission
from app.schemas.grading import AnnotationOut, GradingResponse, ValidatedCriterionResult, ValidationIssue
from app.schemas.rubric import Rubric
from app.services.grading_service import GradingError, run_grading_pipeline
from app.services.mock_llm_service import MockGrader

router = APIRouter(prefix="/grading", tags=["Grading"])


@router.post("", response_model=GradingResponse)
async def submit_grading(
    student_pdf: UploadFile = File(..., description="Student's answer paper (PDF)"),
    rubric_json: str = Form(..., description="Rubric JSON string"),
    question_pdf: UploadFile | None = File(None, description="Question paper (PDF, optional)"),
    mock_mode: str = Form("auto", description="Mock grader mode (auto, fully_correct, partial, etc.)"),
    db: Session = Depends(get_db),
):
    """
    Upload a student's answer PDF and rubric, then grade it.

    The rubric_json should be a JSON string matching the Rubric schema:
    {
        "total_marks": 10,
        "items": [
            {"id": "q1_c1", "description": "...", "max_marks": 5},
            {"id": "q1_c2", "description": "...", "max_marks": 5}
        ],
        "model_answer": "...",
        "question_text": "..."
    }
    """
    # Validate rubric JSON
    try:
        rubric = Rubric.model_validate_json(rubric_json)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid rubric JSON: {e}")

    # Validate PDF upload
    if not student_pdf.filename or not student_pdf.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="Student file must be a PDF")

    # Save uploaded PDF to temp file
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            content = await student_pdf.read()
            tmp.write(content)
            student_pdf_path = Path(tmp.name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {e}")

    # Save question PDF if provided
    question_pdf_path = None
    if question_pdf and question_pdf.filename:
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                content = await question_pdf.read()
                tmp.write(content)
                question_pdf_path = Path(tmp.name)
        except Exception:
            pass  # Question PDF is optional

    # Create grader
    grader = MockGrader(mode=mock_mode)

    # Run the grading pipeline
    try:
        result = await run_grading_pipeline(
            student_pdf_path=student_pdf_path,
            question_pdf_path=question_pdf_path,
            rubric=rubric,
            grader=grader,
            db=db,
        )
    except GradingError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Fetch annotations for the response
    annotations = db.query(Annotation).filter(
        Annotation.submission_id == result.submission_id
    ).all()

    return GradingResponse(
        submission_id=result.submission_id,
        total_score=result.total_score,
        max_score=result.max_score,
        criteria=result.criteria,
        overall_feedback=result.overall_feedback,
        overall_confidence=result.overall_confidence,
        flagged_for_human_review=result.flagged_for_human_review,
        review_reasons=result.review_reasons,
        validation_issues=result.validation_issues,
        status=result.status,
        annotations=[
            AnnotationOut(
                id=a.id,
                submission_id=a.submission_id,
                page=a.page,
                bbox=a.bbox,
                annotation_type=a.annotation_type,
                feedback_text=a.feedback_text,
                is_user_edited=a.is_user_edited,
            )
            for a in annotations
        ],
    )


@router.get("/{submission_id}", response_model=GradingResponse)
def get_grading_result(submission_id: str, db: Session = Depends(get_db)):
    """Retrieve a previously saved grading result."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    annotations = db.query(Annotation).filter(
        Annotation.submission_id == submission_id
    ).all()

    # Reconstruct criteria from JSON
    criteria_data = submission.get_criteria()
    criteria = [ValidatedCriterionResult(**c) for c in criteria_data]

    # Reconstruct validation issues
    issues_data = submission.get_validation_issues()
    issues = [ValidationIssue(**v) for v in issues_data]

    return GradingResponse(
        submission_id=submission.id,
        total_score=submission.total_score,
        max_score=submission.max_score,
        criteria=criteria,
        overall_feedback=submission.overall_feedback,
        overall_confidence=submission.overall_confidence,
        flagged_for_human_review=submission.flagged_for_human_review,
        review_reasons=submission.get_review_reasons(),
        validation_issues=issues,
        status=submission.status,
        annotations=[
            AnnotationOut(
                id=a.id,
                submission_id=a.submission_id,
                page=a.page,
                bbox=a.bbox,
                annotation_type=a.annotation_type,
                feedback_text=a.feedback_text,
                is_user_edited=a.is_user_edited,
            )
            for a in annotations
        ],
        created_at=str(submission.created_at) if submission.created_at else "",
    )
