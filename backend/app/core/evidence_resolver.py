"""
Evidence resolver: maps block IDs from grading results to concrete
PDF annotation objects with page numbers and bounding boxes.
"""

from app.schemas.document import TextBlock
from app.schemas.grading import ValidatedCriterionResult


class AnnotationData:
    """Simple data class representing a resolved annotation."""

    def __init__(
        self,
        page: int,
        bbox: list[float],
        annotation_type: str,
        feedback_text: str,
    ):
        self.page = page
        self.bbox = bbox
        self.annotation_type = annotation_type
        self.feedback_text = feedback_text


def resolve_evidence(
    criteria: list[ValidatedCriterionResult],
    text_blocks: list[TextBlock],
) -> list[AnnotationData]:
    """
    Convert validated criterion results with evidence_block_ids into
    concrete annotation objects with PDF coordinates.

    For each criterion that has evidence_block_ids, look up the corresponding
    TextBlock and create an AnnotationData with the block's page and bbox.
    """
    block_map = {block.id: block for block in text_blocks}
    annotations: list[AnnotationData] = []

    for criterion in criteria:
        for block_id in criterion.evidence_block_ids:
            block = block_map.get(block_id)
            if block is None:
                continue  # Already validated; skip unresolvable

            feedback = ""
            if criterion.feedback:
                feedback = criterion.feedback
            elif criterion.explanation:
                feedback = criterion.explanation

            if criterion.correction:
                feedback += f"\n\nCorrection: {criterion.correction}"

            annotations.append(AnnotationData(
                page=block.page,
                bbox=block.bbox,
                annotation_type=criterion.status.value if hasattr(criterion.status, 'value') else str(criterion.status),
                feedback_text=feedback.strip(),
            ))

    return annotations
