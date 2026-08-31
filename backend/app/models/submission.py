"""SQLAlchemy model for grading submissions."""

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, String, Text

from app.database import Base


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Uploaded file info
    student_pdf_filename = Column(String(255), nullable=False)
    question_pdf_filename = Column(String(255), default="")
    original_pdf_path = Column(String(512), nullable=False)

    # Rubric (stored as JSON)
    rubric_json = Column(Text, nullable=False)

    # Extracted text blocks (stored as JSON)
    text_blocks_json = Column(Text, default="[]")

    # Grading result
    total_score = Column(Float, default=0.0)
    max_score = Column(Float, default=0.0)
    overall_feedback = Column(Text, default="")
    overall_confidence = Column(Float, default=0.0)
    flagged_for_human_review = Column(Boolean, default=False)
    review_reasons_json = Column(Text, default="[]")
    validation_issues_json = Column(Text, default="[]")

    # Criteria results (stored as JSON list)
    criteria_json = Column(Text, default="[]")

    # Status: pending | completed | flagged | failed
    status = Column(String(50), default="pending")

    def get_rubric(self) -> dict:
        return json.loads(self.rubric_json) if self.rubric_json else {}

    def get_text_blocks(self) -> list:
        return json.loads(self.text_blocks_json) if self.text_blocks_json else []

    def get_criteria(self) -> list:
        return json.loads(self.criteria_json) if self.criteria_json else []

    def get_review_reasons(self) -> list:
        return json.loads(self.review_reasons_json) if self.review_reasons_json else []

    def get_validation_issues(self) -> list:
        return json.loads(self.validation_issues_json) if self.validation_issues_json else []
