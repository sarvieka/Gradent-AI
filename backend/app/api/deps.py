"""FastAPI dependencies for authentication."""

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.services.auth import get_user_by_session_token


def extract_token_from_request(request: Request) -> str | None:
    """Extract raw session token from cookie or Authorization Bearer header."""
    # 1. Cookie (Primary)
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if token:
        return token

    # 2. Authorization header fallback
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:].strip()

    return None


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """Dependency that ensures the request is authenticated and returns the User."""
    token = extract_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    user = get_user_by_session_token(db, token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )

    return user


def get_optional_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User | None:
    """Dependency that returns User if authenticated, or None if anonymous."""
    token = extract_token_from_request(request)
    if not token:
        return None
    return get_user_by_session_token(db, token)
