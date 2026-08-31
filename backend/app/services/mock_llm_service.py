"""
Deterministic Mock LLM grader for testing.

Provides predictable grading results based on configurable scenarios,
without requiring any LLM API calls.
"""

from app.schemas.document import TextBlock
from app.schemas.llm_output import CriterionStatus, LLMCriterionResult, LLMGradingOutput
from app.schemas.rubric import Rubric
from app.services.llm_base import BaseGrader


class MockGraderError(Exception):
    """Simulated API/model failure for testing."""
    pass


class MockGrader(BaseGrader):
    """
    Deterministic mock grader that returns predictable results.

    Modes:
    - "fully_correct": Awards full marks for all criteria.
    - "partial": Awards approximately half marks with mixed statuses.
    - "incorrect": Awards zero marks for all criteria.
    - "blank": Returns a blank-answer result (should be pre-empted by service).
    - "malformed": Returns output with invalid/broken fields.
    - "incomplete": Returns output missing some rubric criteria.
    - "over_max": Returns scores exceeding the maximum (to test clamping).
    - "api_failure": Raises an exception to simulate API failure.
    - "auto": Analyzes student text blocks to determine realistic grading.
    """

    def __init__(self, mode: str = "auto"):
        self.mode = mode

    async def grade(
        self,
        student_blocks: list[TextBlock],
        rubric: Rubric,
    ) -> LLMGradingOutput:
        if self.mode == "api_failure":
            raise MockGraderError("Simulated API failure: service unavailable")

        if self.mode == "malformed":
            return self._malformed_output(rubric)

        if self.mode == "incomplete":
            return self._incomplete_output(rubric, student_blocks)

        if self.mode == "over_max":
            return self._over_max_output(rubric, student_blocks)

        if self.mode == "fully_correct":
            return self._fully_correct_output(rubric, student_blocks)

        if self.mode == "incorrect":
            return self._incorrect_output(rubric, student_blocks)

        if self.mode == "partial":
            return self._partial_output(rubric, student_blocks)

        if self.mode == "blank":
            return self._blank_output(rubric)

        # "auto" mode: analyze student text to determine grading
        return self._auto_grade(rubric, student_blocks)

    def _fully_correct_output(
        self, rubric: Rubric, blocks: list[TextBlock]
    ) -> LLMGradingOutput:
        criteria = []
        for i, item in enumerate(rubric.items):
            evidence = [blocks[i % len(blocks)].id] if blocks else []
            criteria.append(LLMCriterionResult(
                rubric_item_id=item.id,
                status=CriterionStatus.CORRECT,
                awarded_marks=item.max_marks,
                max_marks=item.max_marks,
                evidence_block_ids=evidence,
                explanation=f"The student correctly addressed: {item.description}",
                feedback="Excellent answer. All key points covered.",
                correction="",
                confidence=0.95,
            ))
        return LLMGradingOutput(
            criteria_results=criteria,
            overall_feedback="Excellent work. All criteria fully addressed.",
            overall_confidence=0.95,
        )

    def _partial_output(
        self, rubric: Rubric, blocks: list[TextBlock]
    ) -> LLMGradingOutput:
        criteria = []
        for i, item in enumerate(rubric.items):
            evidence = [blocks[i % len(blocks)].id] if blocks else []
            if i % 3 == 0:
                # Full marks
                criteria.append(LLMCriterionResult(
                    rubric_item_id=item.id,
                    status=CriterionStatus.CORRECT,
                    awarded_marks=item.max_marks,
                    max_marks=item.max_marks,
                    evidence_block_ids=evidence,
                    explanation=f"Correctly addressed: {item.description}",
                    feedback="Good answer.",
                    confidence=0.90,
                ))
            elif i % 3 == 1:
                # Half marks
                half = round(item.max_marks / 2, 1)
                criteria.append(LLMCriterionResult(
                    rubric_item_id=item.id,
                    status=CriterionStatus.PARTIAL,
                    awarded_marks=half,
                    max_marks=item.max_marks,
                    evidence_block_ids=evidence,
                    explanation=f"Partially addressed: {item.description}",
                    feedback="Answer is incomplete. Key details missing.",
                    correction=f"Should also mention the full scope of: {item.description}",
                    confidence=0.80,
                ))
            else:
                # Zero marks
                criteria.append(LLMCriterionResult(
                    rubric_item_id=item.id,
                    status=CriterionStatus.INCORRECT,
                    awarded_marks=0.0,
                    max_marks=item.max_marks,
                    evidence_block_ids=evidence,
                    explanation=f"Incorrect answer for: {item.description}",
                    feedback="The answer does not address this criterion.",
                    correction=f"The correct answer should cover: {item.description}",
                    confidence=0.85,
                ))
        return LLMGradingOutput(
            criteria_results=criteria,
            overall_feedback="Partial credit. Some criteria addressed correctly, others need improvement.",
            overall_confidence=0.85,
        )

    def _incorrect_output(
        self, rubric: Rubric, blocks: list[TextBlock]
    ) -> LLMGradingOutput:
        criteria = []
        for i, item in enumerate(rubric.items):
            evidence = [blocks[i % len(blocks)].id] if blocks else []
            criteria.append(LLMCriterionResult(
                rubric_item_id=item.id,
                status=CriterionStatus.INCORRECT,
                awarded_marks=0.0,
                max_marks=item.max_marks,
                evidence_block_ids=evidence,
                explanation=f"The student's answer does not address: {item.description}",
                feedback="Incorrect. The answer does not match the expected content.",
                correction=f"Expected: {item.description}",
                confidence=0.90,
            ))
        return LLMGradingOutput(
            criteria_results=criteria,
            overall_feedback="The answer does not meet any of the rubric criteria.",
            overall_confidence=0.90,
        )

    def _blank_output(self, rubric: Rubric) -> LLMGradingOutput:
        criteria = []
        for item in rubric.items:
            criteria.append(LLMCriterionResult(
                rubric_item_id=item.id,
                status=CriterionStatus.MISSING,
                awarded_marks=0.0,
                max_marks=item.max_marks,
                evidence_block_ids=[],
                explanation="No answer content detected.",
                feedback="The student did not provide an answer for this criterion.",
                confidence=1.0,
            ))
        return LLMGradingOutput(
            criteria_results=criteria,
            overall_feedback="No answer content was detected in the submission.",
            overall_confidence=1.0,
        )

    def _malformed_output(self, rubric: Rubric) -> LLMGradingOutput:
        """Return output with invalid fields to test Pydantic/validator handling."""
        criteria = [
            LLMCriterionResult(
                rubric_item_id=rubric.items[0].id if rubric.items else "unknown_id",
                status=CriterionStatus.CORRECT,
                awarded_marks=-5.0,           # Invalid: negative marks
                max_marks=rubric.items[0].max_marks if rubric.items else 10,
                evidence_block_ids=["nonexistent_block_999"],  # Invalid block ID
                explanation="Malformed test output",
                confidence=2.5,               # Invalid: > 1.0
            ),
        ]
        return LLMGradingOutput(
            criteria_results=criteria,
            overall_feedback="Malformed test",
            overall_confidence=-0.5,  # Invalid: negative
        )

    def _incomplete_output(
        self, rubric: Rubric, blocks: list[TextBlock]
    ) -> LLMGradingOutput:
        """Return output missing some rubric criteria to test gap detection."""
        criteria = []
        # Only grade the first half of rubric items
        for i, item in enumerate(rubric.items[:max(1, len(rubric.items) // 2)]):
            evidence = [blocks[i % len(blocks)].id] if blocks else []
            criteria.append(LLMCriterionResult(
                rubric_item_id=item.id,
                status=CriterionStatus.CORRECT,
                awarded_marks=item.max_marks,
                max_marks=item.max_marks,
                evidence_block_ids=evidence,
                explanation=f"Correct: {item.description}",
                feedback="Good.",
                confidence=0.90,
            ))
        return LLMGradingOutput(
            criteria_results=criteria,
            overall_feedback="Incomplete grading — some criteria were not evaluated.",
            overall_confidence=0.75,
        )

    def _over_max_output(
        self, rubric: Rubric, blocks: list[TextBlock]
    ) -> LLMGradingOutput:
        """Return scores that exceed the maximum to test clamping."""
        criteria = []
        for i, item in enumerate(rubric.items):
            evidence = [blocks[i % len(blocks)].id] if blocks else []
            criteria.append(LLMCriterionResult(
                rubric_item_id=item.id,
                status=CriterionStatus.CORRECT,
                awarded_marks=item.max_marks + 5.0,  # Exceeds maximum
                max_marks=item.max_marks,
                evidence_block_ids=evidence,
                explanation=f"Over-awarded for: {item.description}",
                feedback="Excellent.",
                confidence=0.95,
            ))
        return LLMGradingOutput(
            criteria_results=criteria,
            overall_feedback="Scores exceed maximum.",
            overall_confidence=0.95,
        )

    def _auto_grade(
        self, rubric: Rubric, blocks: list[TextBlock]
    ) -> LLMGradingOutput:
        """
        Simple automatic grading based on text content heuristics.
        Checks if rubric criterion keywords appear in student text.
        """
        student_text = " ".join(b.text.lower() for b in blocks)
        criteria = []

        for i, item in enumerate(rubric.items):
            keywords = item.description.lower().split()
            # Count how many keywords from the criterion appear in the student text
            matches = sum(1 for kw in keywords if len(kw) > 3 and kw in student_text)
            match_ratio = matches / max(len([k for k in keywords if len(k) > 3]), 1)

            evidence = [blocks[i % len(blocks)].id] if blocks else []

            if match_ratio > 0.6:
                status = CriterionStatus.CORRECT
                awarded = item.max_marks
                feedback = "Answer addresses this criterion well."
            elif match_ratio > 0.3:
                status = CriterionStatus.PARTIAL
                awarded = round(item.max_marks * match_ratio, 1)
                feedback = "Answer partially addresses this criterion."
            else:
                status = CriterionStatus.INCORRECT
                awarded = 0.0
                feedback = "Answer does not adequately address this criterion."

            criteria.append(LLMCriterionResult(
                rubric_item_id=item.id,
                status=status,
                awarded_marks=awarded,
                max_marks=item.max_marks,
                evidence_block_ids=evidence,
                explanation=f"Keyword match ratio: {match_ratio:.2f} for '{item.description}'",
                feedback=feedback,
                correction="" if status == CriterionStatus.CORRECT else f"Review: {item.description}",
                confidence=0.75 + (match_ratio * 0.2),
            ))

        return LLMGradingOutput(
            criteria_results=criteria,
            overall_feedback="Auto-graded based on keyword matching.",
            overall_confidence=0.80,
        )
