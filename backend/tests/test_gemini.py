"""
Tests for GeminiGrader using mocked Gemini SDK calls.

NO real API calls are made in pytest.
The google.genai client is patched at the module level to return
deterministic fake responses.
"""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.schemas.llm_output import CriterionStatus, LLMCriterionResult, LLMGradingOutput
from app.schemas.rubric import Rubric, RubricItem


# ──────────────────────────────────────────────────────────────
# Helper: build a valid LLMGradingOutput JSON string
# ──────────────────────────────────────────────────────────────
def _make_gemini_json(rubric: Rubric, *, over_max: bool = False) -> str:
    """Return a JSON string matching LLMGradingOutput for the given rubric."""
    criteria = []
    for item in rubric.items:
        criteria.append({
            "rubric_item_id": item.id,
            "status": "correct",
            "awarded_marks": item.max_marks + (5.0 if over_max else 0.0),
            "max_marks": item.max_marks,
            "evidence_block_ids": ["blk_p1_01"],
            "explanation": "Student correctly addressed the criterion.",
            "feedback": "Well done.",
            "correction": "",
            "confidence": 0.92,
        })
    return json.dumps({
        "criteria_results": criteria,
        "overall_feedback": "Excellent answer.",
        "overall_confidence": 0.92,
    })


def _mock_genai_client(response_text: str):
    """Return a patched google.genai.Client that returns response_text."""
    mock_response = MagicMock()
    mock_response.text = response_text

    mock_model = MagicMock()
    mock_model.generate_content.return_value = mock_response

    mock_client = MagicMock()
    mock_client.models = mock_model

    return mock_client


# ──────────────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────────────
@pytest.fixture
def rubric() -> Rubric:
    return Rubric(
        total_marks=10.0,
        items=[
            RubricItem(id="q1_c1", description="TCP is connection-oriented", max_marks=5.0),
            RubricItem(id="q1_c2", description="Three-way handshake", max_marks=5.0),
        ],
        model_answer="TCP uses a three-way handshake and is connection-oriented.",
        question_text="Explain TCP.",
    )


@pytest.fixture
def student_blocks():
    from app.schemas.document import TextBlock
    return [
        TextBlock(id="blk_p1_01", page=1, text="TCP is a connection-oriented protocol.", bbox=[72, 100, 450, 120]),
        TextBlock(id="blk_p1_02", page=1, text="It uses a three-way handshake.", bbox=[72, 130, 450, 150]),
    ]


# ──────────────────────────────────────────────────────────────
# Tests
# ──────────────────────────────────────────────────────────────
def test_gemini_grader_returns_valid_output(rubric, student_blocks):
    """GeminiGrader should parse the Gemini JSON response into LLMGradingOutput."""
    response_json = _make_gemini_json(rubric)

    with patch("app.services.gemini_service.genai") as mock_genai, \
         patch("app.config.settings") as mock_settings:
        mock_settings.GEMINI_API_KEY = "fake-key"
        mock_genai.Client.return_value = _mock_genai_client(response_json)

        from app.services.gemini_service import GeminiGrader
        # Patch settings inside the module too
        with patch("app.services.gemini_service.settings") as mod_settings:
            mod_settings.GEMINI_API_KEY = "fake-key"
            grader = GeminiGrader.__new__(GeminiGrader)
            grader._model = "gemini-2.0-flash"
            grader._client = _mock_genai_client(response_json)

        import asyncio
        output = asyncio.run(grader.grade(student_blocks, rubric))

    assert isinstance(output, LLMGradingOutput)
    assert len(output.criteria_results) == 2
    assert output.criteria_results[0].rubric_item_id == "q1_c1"
    assert output.criteria_results[0].status == CriterionStatus.CORRECT
    assert output.overall_confidence == 0.92


def test_gemini_grader_api_failure_raises(rubric, student_blocks):
    """GeminiGrader should raise an exception on API failure so the service handles it."""
    with patch("app.services.gemini_service.genai"):
        from app.services.gemini_service import GeminiGrader
        grader = GeminiGrader.__new__(GeminiGrader)
        grader._model = "gemini-2.0-flash"

        # Client that raises
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = RuntimeError("Network timeout")
        grader._client = mock_client

        import asyncio
        with pytest.raises(RuntimeError, match="Network timeout"):
            asyncio.run(grader.grade(student_blocks, rubric))


def test_gemini_grader_invalid_json_raises(rubric, student_blocks):
    """GeminiGrader should raise ValueError when Gemini returns non-JSON text."""
    with patch("app.services.gemini_service.genai"):
        from app.services.gemini_service import GeminiGrader
        grader = GeminiGrader.__new__(GeminiGrader)
        grader._model = "gemini-2.0-flash"
        grader._client = _mock_genai_client("This is not JSON at all.")

        import asyncio
        with pytest.raises(ValueError, match="invalid JSON"):
            asyncio.run(grader.grade(student_blocks, rubric))


def test_gemini_grader_empty_response_raises(rubric, student_blocks):
    """GeminiGrader should raise ValueError when Gemini returns empty text."""
    with patch("app.services.gemini_service.genai"):
        from app.services.gemini_service import GeminiGrader
        grader = GeminiGrader.__new__(GeminiGrader)
        grader._model = "gemini-2.0-flash"
        grader._client = _mock_genai_client("")

        import asyncio
        with pytest.raises(ValueError, match="empty response"):
            asyncio.run(grader.grade(student_blocks, rubric))


def test_gemini_over_max_scores_are_clamped_by_validator(rubric, student_blocks):
    """Scores returned over the max by Gemini must be clamped by validator.py."""
    from app.core.validator import validate_grading

    # Build a raw LLMGradingOutput where Gemini awarded too many marks
    over_scored = LLMGradingOutput(
        criteria_results=[
            LLMCriterionResult(
                rubric_item_id="q1_c1",
                status=CriterionStatus.CORRECT,
                awarded_marks=9999.0,  # Way over max of 5
                max_marks=5.0,
                evidence_block_ids=["blk_p1_01"],
                explanation="Over-awarded by Gemini.",
                confidence=0.9,
            ),
            LLMCriterionResult(
                rubric_item_id="q1_c2",
                status=CriterionStatus.CORRECT,
                awarded_marks=5.0,
                max_marks=5.0,
                evidence_block_ids=["blk_p1_02"],
                explanation="Correct.",
                confidence=0.9,
            ),
        ],
        overall_feedback="Over scored.",
        overall_confidence=0.9,
    )

    validated = validate_grading(over_scored, rubric, student_blocks, "test-id")

    # Backend must clamp q1_c1 to 5.0 and flag for review
    assert validated.criteria[0].awarded_marks == 5.0
    assert validated.total_score == 10.0   # 5 + 5
    assert validated.flagged_for_human_review is True
    assert any("clamped" in r.lower() for r in validated.review_reasons)


def test_grading_api_uses_mock_by_default(client, correct_pdf: Path, rubric_json: str):
    """The API must use MockGrader (not Gemini) when grader_type is not specified."""
    with open(correct_pdf, "rb") as f:
        response = client.post(
            "/api/grading",
            data={"rubric_json": rubric_json},          # no grader_type → defaults to "mock"
            files={"student_pdf": (correct_pdf.name, f, "application/pdf")},
        )
    assert response.status_code == 200
    data = response.json()
    assert "submission_id" in data


def test_grading_api_gemini_missing_key_returns_503(client, correct_pdf: Path, rubric_json: str):
    """If GEMINI_API_KEY is not set, requesting gemini grader should return 503."""
    with patch("app.services.gemini_service.settings") as mock_settings:
        mock_settings.GEMINI_API_KEY = ""

        with open(correct_pdf, "rb") as f:
            response = client.post(
                "/api/grading",
                data={"rubric_json": rubric_json, "grader_type": "gemini"},
                files={"student_pdf": (correct_pdf.name, f, "application/pdf")},
            )
    assert response.status_code == 503
