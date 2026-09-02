"""Comprehensive tests for the grading pipeline."""

import json
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.evidence_resolver import resolve_evidence
from app.core.extractor import extract_text_blocks, is_blank_submission
from app.core.validator import validate_grading
from app.main import app
from app.models.submission import Submission
from app.schemas.grading import ValidatedGradingResult
from app.schemas.rubric import Rubric
from app.services.grading_service import run_grading_pipeline
from app.services.mock_llm_service import MockGrader


# ──────────────────────────────────────────────
# 1. Extraction Tests
# ──────────────────────────────────────────────
def test_pdf_extraction(correct_pdf: Path):
    """Test text and bbox extraction from a PDF."""
    extracted = extract_text_blocks(correct_pdf)
    assert extracted.total_pages == 1
    assert len(extracted.blocks) > 0

    first_block = extracted.blocks[0]
    assert first_block.id.startswith("blk_p1_")
    assert first_block.page == 1
    assert "TCP is a connection-oriented protocol" in first_block.text
    assert len(first_block.bbox) == 4

    assert not is_blank_submission(extracted)


def test_blank_pdf_extraction(blank_pdf: Path):
    """Test extraction of a blank PDF."""
    extracted = extract_text_blocks(blank_pdf)
    assert len(extracted.blocks) == 0
    assert is_blank_submission(extracted)


# ──────────────────────────────────────────────
# 2. Validation & Score Logic Tests
# ──────────────────────────────────────────────
def test_validator_clamps_scores(sample_rubric: Rubric):
    """Test that the validator clamps over-awarded scores."""
    grader = MockGrader(mode="over_max")
    # Simulate the async call using asyncio run or just mock the output
    import asyncio
    
    async def get_output():
        return await grader.grade([], sample_rubric)
    
    llm_output = asyncio.run(get_output())
    
    # Run validator
    validated = validate_grading(llm_output, sample_rubric, [], "test_sub_id")
    
    assert validated.total_score == sample_rubric.total_marks
    assert validated.flagged_for_human_review is True
    assert "clamped" in " ".join(validated.review_reasons).lower()
    
    for crit in validated.criteria:
        assert crit.awarded_marks == crit.max_marks


def test_validator_handles_malformed_output(sample_rubric: Rubric):
    """Test that the validator handles invalid rubric IDs and clamps negative scores."""
    grader = MockGrader(mode="malformed")
    import asyncio
    llm_output = asyncio.run(grader.grade([], sample_rubric))
    
    validated = validate_grading(llm_output, sample_rubric, [], "test_sub_id")
    
    assert validated.flagged_for_human_review is True
    # The malformed mock returns an unknown ID or invalid score
    # In MockGrader it returns rubric.items[0].id with -5.0 marks
    assert validated.criteria[0].awarded_marks == 0.0 # Clamped from -5.0


def test_evidence_resolution(sample_rubric: Rubric, correct_pdf: Path):
    """Test that block IDs are resolved to PDF coordinates."""
    extracted = extract_text_blocks(correct_pdf)
    
    grader = MockGrader(mode="fully_correct")
    import asyncio
    llm_output = asyncio.run(grader.grade(extracted.blocks, sample_rubric))
    
    validated = validate_grading(llm_output, sample_rubric, extracted.blocks, "test_sub_id")
    
    annotations = resolve_evidence(validated.criteria, extracted.blocks)
    
    assert len(annotations) > 0
    assert annotations[0].page == 1
    assert len(annotations[0].bbox) == 4
    assert annotations[0].annotation_type == "correct"


# ──────────────────────────────────────────────
# 3. API & Pipeline Tests
# ──────────────────────────────────────────────
@pytest.mark.asyncio
async def test_grading_api_correct(client, correct_pdf: Path, rubric_json: str):
    """End-to-end test of the grading API for a fully correct answer."""
    with open(correct_pdf, "rb") as f:
        response = client.post(
            "/api/grading",
            data={"rubric_json": rubric_json, "mock_mode": "fully_correct"},
            files={"student_pdf": (correct_pdf.name, f, "application/pdf")},
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["total_score"] == 10.0
    assert data["flagged_for_human_review"] is False
    assert data["status"] == "completed"
    assert len(data["annotations"]) > 0


@pytest.mark.asyncio
async def test_grading_api_partial(client, partial_pdf: Path, rubric_json: str):
    """End-to-end test for partial grading."""
    with open(partial_pdf, "rb") as f:
        response = client.post(
            "/api/grading",
            data={"rubric_json": rubric_json, "mock_mode": "partial"},
            files={"student_pdf": (partial_pdf.name, f, "application/pdf")},
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["total_score"] < 10.0
    assert data["total_score"] > 0.0
    assert data["status"] == "completed"


@pytest.mark.asyncio
async def test_grading_api_incorrect(client, incorrect_pdf: Path, rubric_json: str):
    """End-to-end test for incorrect grading."""
    with open(incorrect_pdf, "rb") as f:
        response = client.post(
            "/api/grading",
            data={"rubric_json": rubric_json, "mock_mode": "incorrect"},
            files={"student_pdf": (incorrect_pdf.name, f, "application/pdf")},
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["total_score"] == 0.0


@pytest.mark.asyncio
async def test_grading_api_blank(client, blank_pdf: Path, rubric_json: str):
    """End-to-end test for a blank PDF."""
    with open(blank_pdf, "rb") as f:
        response = client.post(
            "/api/grading",
            data={"rubric_json": rubric_json, "mock_mode": "auto"},
            files={"student_pdf": (blank_pdf.name, f, "application/pdf")},
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["total_score"] == 0.0
    assert "blank" in data["overall_feedback"].lower()


@pytest.mark.asyncio
async def test_grading_api_incomplete_output(client, correct_pdf: Path, rubric_json: str):
    """Test behavior when the LLM misses some rubric criteria."""
    with open(correct_pdf, "rb") as f:
        response = client.post(
            "/api/grading",
            data={"rubric_json": rubric_json, "mock_mode": "incomplete"},
            files={"student_pdf": (correct_pdf.name, f, "application/pdf")},
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["flagged_for_human_review"] is True
    
    # Missing criteria should have been added with score 0
    missing_c = [c for c in data["criteria"] if c["status"] == "missing"]
    assert len(missing_c) > 0


@pytest.mark.asyncio
async def test_result_retrieval(client, correct_pdf: Path, rubric_json: str):
    """Test retrieving a saved grading result."""
    # 1. Create it
    with open(correct_pdf, "rb") as f:
        create_res = client.post(
            "/api/grading",
            data={"rubric_json": rubric_json, "mock_mode": "fully_correct"},
            files={"student_pdf": (correct_pdf.name, f, "application/pdf")},
        )
    
    sub_id = create_res.json()["submission_id"]
    
    # 2. Retrieve it
    get_res = client.get(f"/api/grading/{sub_id}")
    assert get_res.status_code == 200
    assert get_res.json()["submission_id"] == sub_id
    assert get_res.json()["total_score"] == 10.0


@pytest.mark.asyncio
async def test_history_listing(client, correct_pdf: Path, rubric_json: str):
    """Test the history endpoint."""
    with open(correct_pdf, "rb") as f:
        client.post(
            "/api/grading",
            data={"rubric_json": rubric_json, "mock_mode": "fully_correct"},
            files={"student_pdf": (correct_pdf.name, f, "application/pdf")},
        )
        
    res = client.get("/api/history")
    assert res.status_code == 200
    assert len(res.json()) >= 1
    assert "total_score" in res.json()[0]


@pytest.mark.asyncio
async def test_annotation_export(client, correct_pdf: Path, rubric_json: str):
    """Test that we can export an annotated PDF."""
    with open(correct_pdf, "rb") as f:
        create_res = client.post(
            "/api/grading",
            data={"rubric_json": rubric_json, "mock_mode": "fully_correct"},
            files={"student_pdf": (correct_pdf.name, f, "application/pdf")},
        )
    
    sub_id = create_res.json()["submission_id"]
    
    # Export PDF
    export_res = client.post(f"/api/grading/{sub_id}/export")
    assert export_res.status_code == 200
    assert export_res.headers["content-type"] == "application/pdf"
    assert len(export_res.content) > 0


@pytest.mark.asyncio
async def test_complete_review_endpoint(client, correct_pdf: Path, rubric_json: str):
    """Test that complete review endpoint finalizes status and idempotently updates database."""
    with open(correct_pdf, "rb") as f:
        create_res = client.post(
            "/api/grading",
            data={"rubric_json": rubric_json, "mock_mode": "fully_correct"},
            files={"student_pdf": (correct_pdf.name, f, "application/pdf")},
        )
    sub_id = create_res.json()["submission_id"]

    # Mark complete
    complete_res = client.post(f"/api/grading/{sub_id}/complete")
    assert complete_res.status_code == 200
    assert complete_res.json()["status"] == "completed"
    assert complete_res.json()["flagged_for_human_review"] is False

    # Duplicate completion (idempotency check)
    complete_res_2 = client.post(f"/api/grading/{sub_id}/complete")
    assert complete_res_2.status_code == 200
    assert complete_res_2.json()["status"] == "completed"
