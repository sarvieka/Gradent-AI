"""
GeminiGrader: a BaseGrader implementation using the google-genai SDK.

Design principles:
- The API key is read only from config.settings.GEMINI_API_KEY (loaded from .env).
- Gemini is asked to return structured JSON matching LLMGradingOutput.
- Gemini references evidence ONLY by text block IDs. It never generates coordinates.
- All score calculation and clamping is done downstream in validator.py.
- API failures are raised as exceptions so grading_service.py can catch them
  and create a graceful "failed / flagged" result.
"""

import json
import logging

from google import genai
from google.genai import types

from app.config import settings
from app.schemas.document import TextBlock
from app.schemas.llm_output import LLMGradingOutput
from app.schemas.rubric import Rubric
from app.services.llm_base import BaseGrader

logger = logging.getLogger(__name__)

# The JSON schema we expect Gemini to fill in.
# We embed this in the system prompt so the model understands the contract.
RESPONSE_SCHEMA_DESCRIPTION = """
{
  "criteria_results": [
    {
      "rubric_item_id": "<string — must be one of the IDs from the rubric>",
      "status": "<one of: correct | partial | incorrect | missing | unclear>",
      "awarded_marks": <number — your suggested mark, the backend will enforce limits>,
      "max_marks": <number — copy from the rubric item>,
      "evidence_block_ids": ["<block ID from the student text>"],
      "explanation": "<why this mark was awarded or not>",
      "feedback": "<feedback for the student>",
      "correction": "<what the correct answer should include, or empty string>",
      "confidence": <number between 0.0 and 1.0>
    }
  ],
  "overall_feedback": "<summary feedback for the whole answer>",
  "overall_confidence": <number between 0.0 and 1.0>
}
"""


def _build_prompt(student_blocks: list[TextBlock], rubric: Rubric) -> str:
    """Construct the full grading prompt with text blocks and rubric."""

    # Format text blocks with their IDs so the model can reference them
    blocks_section = "\n".join(
        f"[Block {b.id} | Page {b.page}]: {b.text}"
        for b in student_blocks
    )

    # Format rubric items
    rubric_section = "\n".join(
        f"- ID: {item.id} | Max marks: {item.max_marks} | Criterion: {item.description}"
        for item in rubric.items
    )

    return f"""You are an expert AI teaching assistant that grades student exam answers.

## Question
{rubric.question_text or "See rubric below."}

## Model Answer
{rubric.model_answer or "Not provided."}

## Marking Rubric
Total available marks: {rubric.total_marks}

{rubric_section}

## Student's Answer (extracted text blocks with IDs)
{blocks_section if blocks_section else "No text was extracted. The answer appears to be blank."}

## Your Task
Grade the student's answer criterion by criterion against the rubric.

CRITICAL RULES:
1. For evidence_block_ids, use ONLY the block IDs listed above (e.g. "blk_p1_01").
   DO NOT invent block IDs. DO NOT provide coordinates or page numbers.
2. awarded_marks must be between 0 and max_marks for each criterion.
3. Grade every criterion in the rubric. If you cannot find evidence, use status "missing".
4. Be honest about your confidence. Use a value < 0.7 if you are uncertain.
5. Provide specific, actionable feedback that helps the student understand what was wrong.

Return ONLY valid JSON matching this schema — no markdown fences, no extra text:
{RESPONSE_SCHEMA_DESCRIPTION}
"""


class GeminiGrader(BaseGrader):
    """
    Grades student answers using Google's Gemini API.

    Reads GEMINI_API_KEY from app.config.settings (loaded from .env).
    Never hardcodes or exposes the key.
    """

    def __init__(self, model: str = "gemini-3.6-flash"):
        if not settings.GEMINI_API_KEY:
            raise ValueError(
                "GEMINI_API_KEY is not set. "
                "Add it to backend/.env before using GeminiGrader."
            )
        self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self._model = model

    async def grade(
        self,
        student_blocks: list[TextBlock],
        rubric: Rubric,
    ) -> LLMGradingOutput:
        """
        Send the student's extracted text blocks and rubric to Gemini,
        parse the structured JSON response, and return an LLMGradingOutput.

        Raises:
            Exception: If the Gemini API call fails or returns unparseable JSON.
                       grading_service.py catches this and creates a graceful failure.
        """
        prompt = _build_prompt(student_blocks, rubric)

        logger.info("Calling Gemini model '%s' for grading...", self._model)

        # Call the API (synchronous SDK — run in thread if needed for high-load use)
        response = self._client.models.generate_content(
            model=self._model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,           # Low temperature for consistent grading
                max_output_tokens=8192,
                response_mime_type="application/json",
            ),
        )

        raw_text = response.text
        if not raw_text or not raw_text.strip():
            raise ValueError("Gemini returned an empty response.")

        logger.info("Gemini response received. Parsing JSON...")

        # Parse the JSON
        try:
            parsed = json.loads(raw_text)
        except json.JSONDecodeError as e:
            raise ValueError(f"Gemini returned invalid JSON: {e}\nRaw: {raw_text[:500]}")

        # Validate the structure with Pydantic
        # This will raise ValidationError if fields are missing/wrong type,
        # which grading_service.py will catch and convert to a flagged result.
        llm_output = LLMGradingOutput.model_validate(parsed)

        logger.info(
            "Gemini grading complete. %d criteria returned, overall confidence=%.2f",
            len(llm_output.criteria_results),
            llm_output.overall_confidence,
        )

        return llm_output
