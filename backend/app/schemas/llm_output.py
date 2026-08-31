"""Schemas for raw LLM/grader output — before backend validation."""

from enum import Enum

from pydantic import BaseModel


class CriterionStatus(str, Enum):
    CORRECT = "correct"
    PARTIAL = "partial"
    INCORRECT = "incorrect"
    MISSING = "missing"
    UNCLEAR = "unclear"


class LLMCriterionResult(BaseModel):
    """The LLM's evaluation for a single rubric criterion."""
    rubric_item_id: str
    status: CriterionStatus
    awarded_marks: float
    max_marks: float
    evidence_block_ids: list[str] = []
    explanation: str = ""
    feedback: str = ""
    correction: str = ""
    confidence: float = 1.0


class LLMGradingOutput(BaseModel):
    """The complete raw output from the LLM/grader."""
    criteria_results: list[LLMCriterionResult]
    overall_feedback: str = ""
    overall_confidence: float = 1.0
