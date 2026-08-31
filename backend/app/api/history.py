"""History API endpoint: list past submissions."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.submission import Submission
from app.schemas.grading import SubmissionSummary

router = APIRouter(prefix="/history", tags=["History"])


@router.get("", response_model=list[SubmissionSummary])
def get_history(db: Session = Depends(get_db)):
    """List all past grading submissions, newest first."""
    submissions = db.query(Submission).order_by(Submission.created_at.desc()).all()
    return [
        SubmissionSummary(
            submission_id=s.id,
            student_pdf_filename=s.student_pdf_filename,
            total_score=s.total_score,
            max_score=s.max_score,
            status=s.status,
            flagged_for_human_review=s.flagged_for_human_review,
            created_at=str(s.created_at) if s.created_at else "",
        )
        for s in submissions
    ]
