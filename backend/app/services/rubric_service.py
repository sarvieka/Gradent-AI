"""Service for creating and parsing structured Rubric objects from JSON or uploaded PDFs."""

import json
import logging
from pathlib import Path

from google import genai

from app.config import settings
from app.core.extractor import extract_text_blocks
from app.schemas.rubric import Rubric, RubricItem

logger = logging.getLogger(__name__)


def build_rubric_from_files(
    rubric_pdf_path: Path | None = None,
    question_pdf_path: Path | None = None,
    rubric_json_str: str | None = None,
    use_gemini: bool = True,
) -> Rubric:
    """
    Construct a Rubric object.
    1. If rubric_json_str is valid JSON matching Rubric, parse it.
    2. If rubric_pdf_path exists, extract text and parse into Rubric model (via Gemini Vision/LLM or text fallback).
    """
    if rubric_json_str and rubric_json_str.strip():
        try:
            return Rubric.model_validate_json(rubric_json_str)
        except Exception:
            logger.info("rubric_json_str is not raw Rubric JSON. Extracting from rubric_pdf...")

    if not rubric_pdf_path or not rubric_pdf_path.exists():
        raise ValueError("Neither valid rubric_json nor rubric_pdf file was provided.")

    # Extract text from uploaded rubric PDF
    rubric_doc = extract_text_blocks(rubric_pdf_path)
    rubric_text = rubric_doc.raw_text

    question_text = ""
    if question_pdf_path and question_pdf_path.exists():
        question_doc = extract_text_blocks(question_pdf_path)
        question_text = question_doc.raw_text

    # Use Gemini to parse the extracted rubric & question text into structured Rubric model
    if use_gemini and settings.GEMINI_API_KEY:
        try:
            logger.info("Parsing uploaded rubric PDF using Gemini LLM...")
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            prompt = f"""You are a teaching assistant. Convert the following marking rubric and model answer text into a structured JSON Rubric object.

Question Paper Text:
{question_text[:3000]}

Model Answer & Marking Rubric Text:
{rubric_text[:8000]}

CRITICAL INSTRUCTIONS:
1. Extract every evaluation criterion, its maximum marks, and a descriptive title.
2. Calculate total_marks as the sum of all max_marks.
3. Include the full question text and model answer text.

Return ONLY valid JSON matching this schema — no markdown code fences:
{{
  "total_marks": 15.0,
  "items": [
    {{
      "id": "q1_c1",
      "description": "Science - Correctly represents the main circuit...",
      "max_marks": 1.0
    }}
  ],
  "model_answer": "<full text of model answers>",
  "question_text": "<full text of questions>"
}}
"""
            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=prompt,
                config={"temperature": 0.1, "response_mime_type": "application/json"},
            )
            if response.text and response.text.strip():
                rubric = Rubric.model_validate_json(response.text)
                logger.info("Successfully parsed rubric with %d items, total_marks=%.1f", len(rubric.items), rubric.total_marks)
                return rubric
        except Exception as e:
            logger.warning("Gemini rubric parsing failed (%s). Falling back to text extraction...", e)

    # Offline / Mock Fallback parser
    lines = [line.strip() for line in rubric_text.splitlines() if line.strip()]
    items: list[RubricItem] = []
    total = 0.0

    for idx, line in enumerate(lines, 1):
        if len(line) > 15 and not line.lower().startswith(("page", "grade", "total")):
            items.append(RubricItem(
                id=f"item_{idx}",
                description=line[:120],
                max_marks=2.0,
            ))
            total += 2.0
        if len(items) >= 5:
            break

    if not items:
        items = [RubricItem(id="item_1", description="General submission criteria", max_marks=10.0)]
        total = 10.0

    return Rubric(
        total_marks=total,
        items=items,
        model_answer=rubric_text[:3000],
        question_text=question_text[:3000],
    )
