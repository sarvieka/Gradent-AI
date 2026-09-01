"""Schemas for validated grading results — after backend enforcement."""

from pydantic import BaseModel

from app.schemas.document import TextBlock
from app.schemas.llm_output import CriterionStatus


class ValidatedCriterionResult(BaseModel):
    """A single rubric criterion after backend validation and score clamping."""
    rubric_item_id: str
    criterion_description: str
    status: CriterionStatus
    awarded_marks: float
    max_marks: float
    evidence_block_ids: list[str] = []
    explanation: str = ""
    feedback: str = ""
    correction: str = ""
    confidence: float = 1.0


class ValidationIssue(BaseModel):
    """A problem detected during business-rule validation."""
    field: str
    issue: str
    original_value: str = ""
    corrected_value: str = ""


class ValidatedGradingResult(BaseModel):
    """The complete grading result after deterministic validation."""
    submission_id: str
    total_score: float
    max_score: float
    criteria: list[ValidatedCriterionResult]
    overall_feedback: str = ""
    overall_confidence: float = 1.0
    flagged_for_human_review: bool = False
    review_reasons: list[str] = []
    validation_issues: list[ValidationIssue] = []
    status: str = "completed"  # completed | flagged | failed


class GradingResponse(BaseModel):
    """API response for a grading submission."""
    submission_id: str
    total_score: float
    max_score: float
    criteria: list[ValidatedCriterionResult]
    overall_feedback: str
    overall_confidence: float
    flagged_for_human_review: bool
    review_reasons: list[str]
    validation_issues: list[ValidationIssue]
    status: str
    annotations: list["AnnotationOut"] = []
    text_blocks: list[TextBlock] = []
    created_at: str = ""


# Avoid circular import; annotation schema is defined here for the response
class AnnotationOut(BaseModel):
    id: str
    submission_id: str
    page: int
    bbox: list[float]
    annotation_type: str
    feedback_text: str
    is_user_edited: bool = False


# Rebuild model to resolve forward reference
GradingResponse.model_rebuild()


class SubmissionSummary(BaseModel):
    """Lightweight submission info for history listing."""
    submission_id: str
    student_pdf_filename: str
    total_score: float
    max_score: float
    status: str
    flagged_for_human_review: bool
    created_at: str
