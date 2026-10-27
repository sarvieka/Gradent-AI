"""Authentication and session management service."""

from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import Tuple

import argon2
import argon2.exceptions
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User, UserSession

_hasher = argon2.PasswordHasher()


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return _hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against an Argon2id hash."""
    try:
        return _hasher.verify(hashed_password, plain_password)
    except (argon2.exceptions.VerifyMismatchError, argon2.exceptions.VerificationError, argon2.exceptions.InvalidHashError):
        return False


def hash_token(raw_token: str) -> str:
    """Hash an opaque session token using SHA-256 for secure storage."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def get_user_by_email(db: Session, email: str) -> User | None:
    """Fetch user by normalized email address."""
    return db.query(User).filter(User.email == email.strip().lower()).first()


def get_user_by_id(db: Session, user_id: str) -> User | None:
    """Fetch user by primary key ID."""
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, full_name: str, email: str, password: str) -> User:
    """Create a new user with an Argon2id-hashed password."""
    normalized_email = email.strip().lower()
    user = User(
        full_name=full_name.strip(),
        email=normalized_email,
        password_hash=hash_password(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """Authenticate user with email and password."""
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def create_user_session(db: Session, user_id: str) -> Tuple[str, UserSession]:
    """
    Create a new revocable session for a user.
    Returns (raw_session_token, UserSession).
    The raw token is returned to be sent via HttpOnly cookie; only its SHA-256 hash is persisted.
    """
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.SESSION_EXPIRE_DAYS)

    session = UserSession(
        user_id=user_id,
        session_token_hash=token_hash,
        expires_at=expires_at,
        is_revoked=False,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return raw_token, session


def get_user_by_session_token(db: Session, raw_token: str) -> User | None:
    """
    Find user associated with a valid, non-revoked, non-expired session token.
    """
    if not raw_token:
        return None

    token_hash = hash_token(raw_token)
    now = datetime.now(timezone.utc)

    session = (
        db.query(UserSession)
        .filter(
            UserSession.session_token_hash == token_hash,
            UserSession.is_revoked == False,  # noqa: E712
            UserSession.expires_at > now,
        )
        .first()
    )

    if not session:
        return None

    return session.user


def revoke_session(db: Session, raw_token: str) -> bool:
    """Revoke an active session by token."""
    if not raw_token:
        return False
    token_hash = hash_token(raw_token)
    session = db.query(UserSession).filter(UserSession.session_token_hash == token_hash).first()
    if session:
        session.is_revoked = True
        db.commit()
        return True
    return False


def revoke_all_user_sessions(db: Session, user_id: str) -> None:
    """Revoke all sessions for a user (e.g. upon password change)."""
    db.query(UserSession).filter(
        UserSession.user_id == user_id,
        UserSession.is_revoked == False,  # noqa: E712
    ).update({"is_revoked": True})
    db.commit()


def update_profile(db: Session, user: User, full_name: str) -> User:
    """Update user permitted profile fields."""
    user.full_name = full_name.strip()
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, current_password: str, new_password: str) -> bool:
    """
    Verify current password and set new password.
    Returns True if successful, False if current password mismatch.
    """
    if not verify_password(current_password, user.password_hash):
        return False

    user.password_hash = hash_password(new_password)
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    # Revoke old sessions for security
    revoke_all_user_sessions(db, user.id)
    return True
