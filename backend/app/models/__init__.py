"""Export all models so SQLAlchemy Base knows about them."""

from app.models.annotation import Annotation
from app.models.submission import Submission
from app.models.user import User, UserSession

__all__ = ["Annotation", "Submission", "User", "UserSession"]
