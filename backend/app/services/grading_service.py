"""
Grading service: orchestrates the complete grading pipeline.

PDF upload → extraction → grading → validation → evidence resolution → persistence.
"""

import json
import shutil
import uuid
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.config import UPLOADS_DIR
from app.core.evidence_resolver import resolve_evidence
from app.core.extractor import extract_text_blocks, is_blank_submission
from app.core.validator import validate_grading
from app.models.annotation import Annotation
from app.models.submission import Submission
from app.schemas.document import TextBlock
from app.schemas.grading import ValidatedGradingResult, ValidationIssue
from app.schemas.llm_output import CriterionStatus, LLMCriterionResult, LLMGradingOutput
from app.schemas.rubric import Rubric
from app.services.llm_base import BaseGrader


class GradingError(Exception):
    """Raised when the grading pipeline fails in a non-recoverable way."""
    pass


async def run_grading_pipeline(
    student_pdf_path: Path,
    question_pdf_path: Path | None,
    rubric: Rubric,
    grader: BaseGrader,
    db: Session,
) -> ValidatedGradingResult:
    """
    Execute the full grading pipeline:

    1. Copy uploaded PDF to storage (preserve original)
    2. Extract text blocks with bounding boxes
    3. Detect blank submissions
    4. Call the grader (mock or LLM)
    5. Validate and enforce business rules
    6. Resolve evidence → annotations
    7. Persist everything to the database

    Returns:
        ValidatedGradingResult with all grading data.
    """
    submission_id = str(uuid.uuid4())

    # --- Step 1: Copy student PDF to storage ---
    stored_pdf_path = UPLOADS_DIR / f"{submission_id}_{student_pdf_path.name}"
    shutil.copy2(str(student_pdf_path), str(stored_pdf_path))

    # --- Step 2: Extract text blocks ---
    try:
        extracted = extract_text_blocks(stored_pdf_path)
    except Exception as e:
        raise GradingError(f"PDF extraction failed: {e}")

    student_blocks = extracted.blocks

    # --- Step 3: Detect blank submissions ---
    if is_blank_submission(extracted):
        result = _create_blank_result(submission_id, rubric)
        _persist_result(db, submission_id, stored_pdf_path, student_pdf_path.name,
                        question_pdf_path, rubric, student_blocks, result, [])
        return result

    # --- Step 4: Call the grader ---
    try:
        llm_output = await grader.grade(student_blocks, rubric)
    except Exception as e:
        # API/model failure: create a failed result
        result = _create_failed_result(submission_id, rubric, str(e))
        _persist_result(db, submission_id, stored_pdf_path, student_pdf_path.name,
                        question_pdf_path, rubric, student_blocks, result, [])
        return result

    # --- Step 5: Validate LLM output ---
    try:
        result = validate_grading(llm_output, rubric, student_blocks, submission_id)
    except ValidationError as e:
        # Pydantic validation failure on LLM output structure
        result = _create_failed_result(
            submission_id, rubric,
            f"LLM output validation failed: {e}"
        )
        _persist_result(db, submission_id, stored_pdf_path, student_pdf_path.name,
                        question_pdf_path, rubric, student_blocks, result, [])
        return result

    # Check for extraction-level confidence flags (e.g., low OCR confidence or unreadable handwriting)
    if extracted.low_confidence_flag:
        result.flagged_for_human_review = True
        ocr_reason = f"Low extraction confidence ({extracted.overall_confidence:.2f}) or unreadable handwriting detected ({extracted.extraction_method})"
        if ocr_reason not in result.review_reasons:
            result.review_reasons.append(ocr_reason)
        result.status = "flagged"

    # --- Step 6: Resolve evidence → annotations ---
    annotation_data_list = resolve_evidence(result.criteria, student_blocks)

    # --- Step 7: Persist to database ---
    db_annotations = _persist_result(
        db, submission_id, stored_pdf_path, student_pdf_path.name,
        question_pdf_path, rubric, student_blocks, result, annotation_data_list,
    )

    return result


def _create_blank_result(submission_id: str, rubric: Rubric) -> ValidatedGradingResult:
    """Create a grading result for a blank submission."""
    from app.schemas.grading import ValidatedCriterionResult

    criteria = []
    for item in rubric.items:
        criteria.append(ValidatedCriterionResult(
            rubric_item_id=item.id,
            criterion_description=item.description,
            status=CriterionStatus.MISSING,
            awarded_marks=0.0,
            max_marks=item.max_marks,
            explanation="No answer content detected in the student's submission.",
            feedback="The student did not provide an answer for this criterion.",
            confidence=1.0,
        ))

    return ValidatedGradingResult(
        submission_id=submission_id,
        total_score=0.0,
        max_score=rubric.total_marks,
        criteria=criteria,
        overall_feedback="No answer content was detected. The submission appears to be blank.",
        overall_confidence=1.0,
        flagged_for_human_review=False,
        review_reasons=[],
        validation_issues=[],
        status="completed",
    )


def _create_failed_result(
    submission_id: str, rubric: Rubric, error_message: str
) -> ValidatedGradingResult:
    """Create a grading result when the grading pipeline fails."""
    return ValidatedGradingResult(
        submission_id=submission_id,
        total_score=0.0,
        max_score=rubric.total_marks,
        criteria=[],
        overall_feedback=f"Grading failed: {error_message}",
        overall_confidence=0.0,
        flagged_for_human_review=True,
        review_reasons=[f"Grading pipeline error: {error_message}"],
        validation_issues=[ValidationIssue(
            field="grading_pipeline",
            issue=error_message,
        )],
        status="failed",
    )


def _persist_result(
    db: Session,
    submission_id: str,
    stored_pdf_path: Path,
    original_filename: str,
    question_pdf_path: Path | None,
    rubric: Rubric,
    text_blocks: list[TextBlock],
    result: ValidatedGradingResult,
    annotation_data_list: list,
) -> list[Annotation]:
    """Persist the grading result and annotations to the database."""

    # Create submission record
    submission = Submission(
        id=submission_id,
        student_pdf_filename=original_filename,
        question_pdf_filename=question_pdf_path.name if question_pdf_path else "",
        original_pdf_path=str(stored_pdf_path),
        rubric_json=rubric.model_dump_json(),
        text_blocks_json=json.dumps([b.model_dump() for b in text_blocks]),
        total_score=result.total_score,
        max_score=result.max_score,
        overall_feedback=result.overall_feedback,
        overall_confidence=result.overall_confidence,
        flagged_for_human_review=result.flagged_for_human_review,
        review_reasons_json=json.dumps(result.review_reasons),
        validation_issues_json=json.dumps([v.model_dump() for v in result.validation_issues]),
        criteria_json=json.dumps([c.model_dump() for c in result.criteria]),
        status=result.status,
    )
    db.add(submission)

    # Create annotation records
    db_annotations = []
    for ann_data in annotation_data_list:
        annotation = Annotation(
            submission_id=submission_id,
            page=ann_data.page,
            bbox_x0=ann_data.bbox[0],
            bbox_y0=ann_data.bbox[1],
            bbox_x1=ann_data.bbox[2],
            bbox_y1=ann_data.bbox[3],
            annotation_type=ann_data.annotation_type,
            feedback_text=ann_data.feedback_text,
        )
        db.add(annotation)
        db_annotations.append(annotation)

    db.commit()
    db.refresh(submission)
    for ann in db_annotations:
        db.refresh(ann)

    return db_annotations
