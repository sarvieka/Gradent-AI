"""Pytest fixtures and shared test configuration."""

import os
import sys
from pathlib import Path

import pytest

# Add the backend directory to the Python path so 'app' is importable
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import fitz  # PyMuPDF
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.schemas.rubric import Rubric, RubricItem


# ──────────────────────────────────────────────
# Test database
# ──────────────────────────────────────────────
TEST_DB_URL = "sqlite:///./test.db"


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh in-memory database for each test."""
    from sqlalchemy.pool import StaticPool
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    from app.models.submission import Submission
    from app.models.annotation import Annotation
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """FastAPI test client with overridden database dependency."""
    from fastapi.testclient import TestClient

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ──────────────────────────────────────────────
# Test PDF generators
# ──────────────────────────────────────────────
@pytest.fixture
def test_data_dir(tmp_path):
    """Return a temporary directory for test data."""
    return tmp_path


def _create_pdf(path: Path, lines: list[str]) -> Path:
    """Helper: create a PDF with text lines."""
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    y = 72
    for line in lines:
        page.insert_text(fitz.Point(72, y), line, fontsize=12, fontname="helv")
        y += 20
    doc.save(str(path))
    doc.close()
    return path


@pytest.fixture
def correct_pdf(test_data_dir) -> Path:
    return _create_pdf(test_data_dir / "correct.pdf", [
        "TCP is a connection-oriented protocol that provides reliable data delivery.",
        "It uses a three-way handshake to establish connections.",
        "TCP provides flow control using a sliding window mechanism.",
        "It ensures ordered delivery of data packets.",
    ])


@pytest.fixture
def partial_pdf(test_data_dir) -> Path:
    return _create_pdf(test_data_dir / "partial.pdf", [
        "TCP is a protocol used for sending data.",
        "It connects two computers together.",
    ])


@pytest.fixture
def incorrect_pdf(test_data_dir) -> Path:
    return _create_pdf(test_data_dir / "incorrect.pdf", [
        "UDP is a connectionless protocol.",
        "It does not guarantee delivery of packets.",
    ])


@pytest.fixture
def blank_pdf(test_data_dir) -> Path:
    doc = fitz.open()
    doc.new_page(width=595, height=842)
    path = test_data_dir / "blank.pdf"
    doc.save(str(path))
    doc.close()
    return path


@pytest.fixture
def ocr_errors_pdf(test_data_dir) -> Path:
    return _create_pdf(test_data_dir / "ocr_errors.pdf", [
        "TCP iz a connecton-orientd protocl that provids reliabl data delivry.",
        "It uzez a three-way handshak to estblish connectons.",
    ])


# ──────────────────────────────────────────────
# Shared rubric fixture
# ──────────────────────────────────────────────
@pytest.fixture
def sample_rubric() -> Rubric:
    return Rubric(
        total_marks=10.0,
        items=[
            RubricItem(id="q1_c1", description="TCP is connection-oriented", max_marks=3.0),
            RubricItem(id="q1_c2", description="Three-way handshake for connection establishment", max_marks=3.0),
            RubricItem(id="q1_c3", description="Flow control using sliding window", max_marks=2.0),
            RubricItem(id="q1_c4", description="Ordered delivery of data", max_marks=2.0),
        ],
        model_answer="TCP is a connection-oriented transport-layer protocol. It uses a three-way handshake (SYN, SYN-ACK, ACK) to establish reliable connections. TCP provides flow control through a sliding window mechanism and ensures ordered delivery of data packets.",
        question_text="Explain the key features of TCP.",
    )


@pytest.fixture
def rubric_json(sample_rubric) -> str:
    return sample_rubric.model_dump_json()
