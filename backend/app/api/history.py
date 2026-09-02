import re
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.submission import Submission
from app.schemas.grading import SubmissionSummary

router = APIRouter(prefix="/history", tags=["History"])


def format_user_filename(filename: str | None) -> str:
    """Format student PDF filename for user-facing display, replacing temporary filenames."""
    if not filename or not filename.strip():
        return "Student Answer"
    fname = filename.strip()
    if re.search(r'(^|[/\_])tmp[a-z0-9\_]+\.pdf$', fname, re.IGNORECASE) or fname.lower().startswith('tmp'):
        return "Student Answer"
    return fname


@router.get("", response_model=list[SubmissionSummary])
def get_history(db: Session = Depends(get_db)):
    """List all past grading submissions, newest first."""
    submissions = db.query(Submission).order_by(Submission.created_at.desc()).all()
    return [
        SubmissionSummary(
            submission_id=s.id,
            student_pdf_filename=format_user_filename(s.student_pdf_filename),
            total_score=s.total_score,
            max_score=s.max_score,
            status=s.status,
            flagged_for_human_review=s.flagged_for_human_review,
            created_at=s.created_at.strftime("%Y-%m-%d %H:%M") if s.created_at else "",
            confidence=s.overall_confidence,
        )
        for s in submissions
    ]
