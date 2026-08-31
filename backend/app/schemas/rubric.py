"""Schemas for rubric definitions."""

from pydantic import BaseModel


class RubricItem(BaseModel):
    """A single criterion in the marking rubric."""
    id: str               # e.g. "q1_criterion_1"
    description: str      # What is being assessed
    max_marks: float      # Maximum marks awardable for this criterion


class Rubric(BaseModel):
    """The full marking rubric for a question/assignment."""
    total_marks: float                  # Sum of all max_marks
    items: list[RubricItem]
    model_answer: str = ""              # The ideal/model answer text
    question_text: str = ""             # The question text
