"""Tests for authentication, session management, and profile operations."""

from datetime import datetime, timedelta, timezone

from app.models.user import User, UserSession
from app.services.auth import create_user, create_user_session, hash_token, verify_password


def test_successful_signup(client, db_session):
    """Test user registration returns 201 and sets session cookie."""
    response = client.post(
        "/api/auth/signup",
        json={
            "full_name": "Professor Alan Turing",
            "email": "alan.turing@university.edu",
            "password": "SecurePassword123!",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "user" in data
    assert data["user"]["email"] == "alan.turing@university.edu"
    assert data["user"]["full_name"] == "Professor Alan Turing"
    assert "password" not in data["user"]
    assert "password_hash" not in data["user"]

    # Cookie is set
    assert "gradent_session" in response.cookies

    # Verify database persistence
    user = db_session.query(User).filter_by(email="alan.turing@university.edu").first()
    assert user is not None
    assert user.full_name == "Professor Alan Turing"


def test_password_stored_as_hash(client, db_session):
    """Ensure plaintext passwords are NEVER stored in the database."""
    plain = "SuperSecret999!"
    response = client.post(
        "/api/auth/signup",
        json={
            "full_name": "Grace Hopper",
            "email": "grace@navy.mil",
            "password": plain,
        },
    )
    assert response.status_code == 201

    user = db_session.query(User).filter_by(email="grace@navy.mil").first()
    assert user is not None
    assert user.password_hash != plain
    assert user.password_hash.startswith("$argon2")
    assert verify_password(plain, user.password_hash) is True


def test_duplicate_email_rejected(client):
    """Reject duplicate registration attempts with a 400 error."""
    payload = {
        "full_name": "Ada Lovelace",
        "email": "ada@analytical.engine",
        "password": "Password123!",
    }
    first_res = client.post("/api/auth/signup", json=payload)
    assert first_res.status_code == 201

    # Attempt duplicate registration
    dup_res = client.post("/api/auth/signup", json=payload)
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"].lower()


def test_successful_login(client, db_session):
    """Test login with valid credentials sets cookie and returns user profile."""
    create_user(db_session, "Claude Shannon", "claude@bell.labs", "InformationTheory42!")

    response = client.post(
        "/api/auth/login",
        json={
            "email": "claude@bell.labs",
            "password": "InformationTheory42!",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["email"] == "claude@bell.labs"
    assert data["user"]["full_name"] == "Claude Shannon"
    assert "gradent_session" in response.cookies


def test_incorrect_credentials_rejected(client, db_session):
    """Reject login with invalid email or password generically."""
    create_user(db_session, "Katherine Johnson", "katherine@nasa.gov", "OrbitCalc123!")

    # Wrong password
    bad_pass = client.post(
        "/api/auth/login",
        json={"email": "katherine@nasa.gov", "password": "WrongPassword!"},
    )
    assert bad_pass.status_code == 401
    assert "Invalid email or password" in bad_pass.json()["detail"]

    # Non-existent user
    bad_user = client.post(
        "/api/auth/login",
        json={"email": "nonexistent@nasa.gov", "password": "OrbitCalc123!"},
    )
    assert bad_user.status_code == 401
    assert "Invalid email or password" in bad_user.json()["detail"]


def test_auth_me_unauthenticated_rejected(client):
    """Ensure /auth/me rejects requests without credentials."""
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_auth_me_returns_profile(client, db_session):
    """Ensure /auth/me returns the authenticated user's data."""
    user = create_user(db_session, "Tim Berners-Lee", "tim@cern.ch", "WorldWideWeb1!")
    raw_token, _ = create_user_session(db_session, user.id)

    client.cookies.set("gradent_session", raw_token)
    response = client.get("/api/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == user.id
    assert data["email"] == "tim@cern.ch"
    assert data["full_name"] == "Tim Berners-Lee"


def test_profile_update_validation(client, db_session):
    """Test updating permitted profile fields and rejecting invalid updates."""
    user = create_user(db_session, "Margaret Hamilton", "margaret@mit.edu", "Apollo11Guide!")
    raw_token, _ = create_user_session(db_session, user.id)
    client.cookies.set("gradent_session", raw_token)

    # Valid name update
    update_res = client.patch("/api/auth/me", json={"full_name": "Dr. Margaret Hamilton"})
    assert update_res.status_code == 200
    assert update_res.json()["full_name"] == "Dr. Margaret Hamilton"

    # Reject empty name
    bad_update = client.patch("/api/auth/me", json={"full_name": " "})
    assert bad_update.status_code == 422


def test_change_password(client, db_session):
    """Test changing password requires current password and allows subsequent login."""
    user = create_user(db_session, "Donald Knuth", "knuth@stanford.edu", "OldAlgorithm1!")
    raw_token, _ = create_user_session(db_session, user.id)
    client.cookies.set("gradent_session", raw_token)

    # Wrong current password
    fail_res = client.post(
        "/api/auth/change-password",
        json={"current_password": "WrongPassword1!", "new_password": "NewAlgorithm2!"},
    )
    assert fail_res.status_code == 400
    assert "Current password is incorrect" in fail_res.json()["detail"]

    # Correct password change
    succ_res = client.post(
        "/api/auth/change-password",
        json={"current_password": "OldAlgorithm1!", "new_password": "NewAlgorithm2!"},
    )
    assert succ_res.status_code == 200

    # New login works
    login_res = client.post(
        "/api/auth/login",
        json={"email": "knuth@stanford.edu", "password": "NewAlgorithm2!"},
    )
    assert login_res.status_code == 200


def test_logout_invalidates_session(client, db_session):
    """Test that logout revokes session and subsequent /me requests fail."""
    user = create_user(db_session, "Barbara Liskov", "barbara@mit.edu", "SubstitutionPrinciple1!")
    raw_token, session_obj = create_user_session(db_session, user.id)
    client.cookies.set("gradent_session", raw_token)

    # Profile works before logout
    assert client.get("/api/auth/me").status_code == 200

    # Perform logout
    logout_res = client.post("/api/auth/logout")
    assert logout_res.status_code == 200

    # Database session is revoked
    db_session.refresh(session_obj)
    assert session_obj.is_revoked is True

    # Subsequent request fails
    assert client.get("/api/auth/me").status_code == 401


def test_expired_or_invalid_session_rejected(client, db_session):
    """Test that expired sessions are rejected."""
    user = create_user(db_session, "John McCarthy", "mccarthy@stanford.edu", "LispLambda1958!")
    raw_token, session_obj = create_user_session(db_session, user.id)

    # Force expiration in past
    session_obj.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    db_session.commit()

    client.cookies.set("gradent_session", raw_token)
    response = client.get("/api/auth/me")
    assert response.status_code == 401
