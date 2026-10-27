"""Schemas for authentication and user management."""

from datetime import datetime
import re
from pydantic import BaseModel, ConfigDict, field_validator


EMAIL_REGEX = re.compile(r"^[\w\.\+\-]+@[a-zA-Z0-9\.\-]+\.[a-zA-Z]{2,}$")


class UserCreate(BaseModel):
    full_name: str
    email: str
    password: str

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        val = v.strip()
        if len(val) < 2:
            raise ValueError("Full name must be at least 2 characters long")
        if len(val) > 100:
            raise ValueError("Full name cannot exceed 100 characters")
        return val

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        val = v.strip().lower()
        if not EMAIL_REGEX.match(val):
            raise ValueError("Please provide a valid email address")
        return val

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if len(v) > 128:
            raise ValueError("Password cannot exceed 128 characters")
        if not any(char.isdigit() for char in v) and not any(not char.isalnum() for char in v):
            raise ValueError("Password must contain at least one number or special character")
        return v


class UserLogin(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return v.strip().lower()


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    created_at: datetime
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdate(BaseModel):
    full_name: str

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        val = v.strip()
        if len(val) < 2:
            raise ValueError("Full name must be at least 2 characters long")
        if len(val) > 100:
            raise ValueError("Full name cannot exceed 100 characters")
        return val


class PasswordChange(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("New password must be at least 8 characters long")
        if len(v) > 128:
            raise ValueError("New password cannot exceed 128 characters")
        if not any(char.isdigit() for char in v) and not any(not char.isalnum() for char in v):
            raise ValueError("Password must contain at least one number or special character")
        return v


class AuthResponse(BaseModel):
    user: UserOut
    message: str | None = None
