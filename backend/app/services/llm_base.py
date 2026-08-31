"""Abstract base class for grading providers (LLM or Mock)."""

from abc import ABC, abstractmethod

from app.schemas.document import TextBlock
from app.schemas.llm_output import LLMGradingOutput
from app.schemas.rubric import Rubric


class BaseGrader(ABC):
    """
    Interface that all grading providers must implement.

    The grading service depends on this abstraction, not on
    any specific LLM provider. This allows:
    - Deterministic testing via MockGrader
    - Easy swapping of LLM providers
    - Testable API failure scenarios
    """

    @abstractmethod
    async def grade(
        self,
        student_blocks: list[TextBlock],
        rubric: Rubric,
    ) -> LLMGradingOutput:
        """
        Evaluate the student's answer against the rubric.

        Args:
            student_blocks: Extracted text blocks from the student's PDF.
            rubric: The marking rubric with model answer.

        Returns:
            Raw LLM grading output (before backend validation).

        Raises:
            Exception: On API failure, timeout, or other errors.
        """
        ...
