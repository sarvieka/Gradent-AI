"""Authentication API router."""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import extract_token_from_request, get_current_user
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    PasswordChange,
    ProfileUpdate,
    UserCreate,
    UserLogin,
    UserOut,
)
from app.services.auth import (
    authenticate_user,
    change_password,
    create_user,
    create_user_session,
    get_user_by_email,
    revoke_session,
    update_profile,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _set_auth_cookie(response: Response, raw_token: str) -> None:
    """Helper to set secure HttpOnly authentication cookie."""
    max_age = settings.SESSION_EXPIRE_DAYS * 24 * 3600
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=raw_token,
        max_age=max_age,
        expires=max_age,
        path="/",
        httponly=True,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite=settings.SESSION_COOKIE_SAMESITE,
    )


def _clear_auth_cookie(response: Response) -> None:
    """Helper to delete authentication cookie."""
    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite=settings.SESSION_COOKIE_SAMESITE,
    )


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(
    payload: UserCreate,
    response: Response,
    db: Session = Depends(get_db),
):
    """Register a new user account and establish a session."""
    existing_user = get_user_by_email(db, payload.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    user = create_user(
        db=db,
        full_name=payload.full_name,
        email=payload.email,
        password=payload.password,
    )

    # Establish session
    raw_token, _ = create_user_session(db, user.id)
    _set_auth_cookie(response, raw_token)

    return AuthResponse(
        user=UserOut.model_validate(user),
        message="Account created successfully",
    )


@router.post("/login", response_model=AuthResponse)
def login(
    payload: UserLogin,
    response: Response,
    db: Session = Depends(get_db),
):
    """Authenticate with email and password and establish a session."""
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    raw_token, _ = create_user_session(db, user.id)
    _set_auth_cookie(response, raw_token)

    return AuthResponse(
        user=UserOut.model_validate(user),
        message="Login successful",
    )


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Revoke session and clear authentication cookie."""
    token = extract_token_from_request(request)
    if token:
        revoke_session(db, token)

    _clear_auth_cookie(response)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Retrieve the profile of the currently authenticated user."""
    return current_user


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update profile fields for the authenticated user."""
    updated = update_profile(db, current_user, full_name=payload.full_name)
    return updated


@router.post("/change-password")
def update_password(
    payload: PasswordChange,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change password for authenticated user and refresh active session."""
    success = change_password(
        db=db,
        user=current_user,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # Issue new session for current user after password change
    raw_token, _ = create_user_session(db, current_user.id)
    _set_auth_cookie(response, raw_token)

    return {"message": "Password changed successfully"}
