"""
Deterministic business-rule validation for grading results.

This module enforces correctness AFTER the LLM/mock grader returns its output.
The LLM is never trusted for score calculation, bounds, or evidence validity.
"""

from app.schemas.document import TextBlock
from app.schemas.grading import ValidatedCriterionResult, ValidatedGradingResult, ValidationIssue
from app.schemas.llm_output import LLMGradingOutput
from app.schemas.rubric import Rubric

# Confidence below this threshold triggers human review
CONFIDENCE_THRESHOLD = 0.7


def validate_grading(
    llm_output: LLMGradingOutput,
    rubric: Rubric,
    text_blocks: list[TextBlock],
    submission_id: str,
) -> ValidatedGradingResult:
    """
    Apply deterministic validation rules to raw LLM grading output.

    Enforces:
    - marks >= 0
    - marks <= criterion max_marks
    - rubric item IDs must exist in rubric
    - evidence block IDs must exist in extracted blocks
    - confidence between 0 and 1
    - total score = sum of criterion scores (never trust LLM total)
    - total score <= rubric total_marks
    - flags for human review when uncertain
    """
    rubric_id_map = {item.id: item for item in rubric.items}
    block_id_set = {block.id for block in text_blocks}

    validated_criteria: list[ValidatedCriterionResult] = []
    validation_issues: list[ValidationIssue] = []
    review_reasons: list[str] = []
    needs_review = False

    for cr in llm_output.criteria_results:
        # --- Rubric ID validation ---
        rubric_item = rubric_id_map.get(cr.rubric_item_id)
        if rubric_item is None:
            validation_issues.append(ValidationIssue(
                field=f"criteria[{cr.rubric_item_id}].rubric_item_id",
                issue=f"Unknown rubric item ID: {cr.rubric_item_id}",
                original_value=cr.rubric_item_id,
            ))
            needs_review = True
            review_reasons.append(f"Unknown rubric item ID: {cr.rubric_item_id}")
            continue  # Skip unknown criteria entirely

        # --- Max marks consistency ---
        effective_max = rubric_item.max_marks
        if cr.max_marks != effective_max:
            validation_issues.append(ValidationIssue(
                field=f"criteria[{cr.rubric_item_id}].max_marks",
                issue="LLM max_marks does not match rubric",
                original_value=str(cr.max_marks),
                corrected_value=str(effective_max),
            ))

        # --- Clamp awarded marks ---
        original_marks = cr.awarded_marks
        clamped_marks = max(0.0, min(cr.awarded_marks, effective_max))
        if clamped_marks != original_marks:
            validation_issues.append(ValidationIssue(
                field=f"criteria[{cr.rubric_item_id}].awarded_marks",
                issue=f"Score clamped from {original_marks} to [{0}, {effective_max}]",
                original_value=str(original_marks),
                corrected_value=str(clamped_marks),
            ))
            needs_review = True
            review_reasons.append(
                f"Score for '{cr.rubric_item_id}' was clamped: {original_marks} → {clamped_marks}"
            )

        # --- Evidence block ID validation ---
        valid_evidence = []
        for eid in cr.evidence_block_ids:
            if eid in block_id_set:
                valid_evidence.append(eid)
            else:
                validation_issues.append(ValidationIssue(
                    field=f"criteria[{cr.rubric_item_id}].evidence_block_ids",
                    issue=f"Evidence block ID not found: {eid}",
                    original_value=eid,
                ))
                needs_review = True
                review_reasons.append(f"Evidence block '{eid}' not found in extracted text")

        # --- Confidence validation ---
        confidence = max(0.0, min(1.0, cr.confidence))
        if confidence < CONFIDENCE_THRESHOLD:
            needs_review = True
            review_reasons.append(
                f"Low confidence ({confidence:.2f}) for criterion '{cr.rubric_item_id}'"
            )

        validated_criteria.append(ValidatedCriterionResult(
            rubric_item_id=cr.rubric_item_id,
            criterion_description=rubric_item.description,
            status=cr.status,
            awarded_marks=clamped_marks,
            max_marks=effective_max,
            evidence_block_ids=valid_evidence,
            explanation=cr.explanation,
            feedback=cr.feedback,
            correction=cr.correction,
            confidence=confidence,
        ))

    # --- Check for missing rubric items ---
    graded_ids = {c.rubric_item_id for c in validated_criteria}
    for item in rubric.items:
        if item.id not in graded_ids:
            validation_issues.append(ValidationIssue(
                field=f"criteria[{item.id}]",
                issue=f"Rubric item '{item.id}' was not graded by the LLM",
            ))
            needs_review = True
            review_reasons.append(f"Rubric item '{item.id}' was not graded")
            # Add a zero-score placeholder
            validated_criteria.append(ValidatedCriterionResult(
                rubric_item_id=item.id,
                criterion_description=item.description,
                status="missing",
                awarded_marks=0.0,
                max_marks=item.max_marks,
                explanation="This criterion was not evaluated by the AI grader.",
                confidence=0.0,
            ))

    # --- Deterministic score calculation ---
    total_score = sum(c.awarded_marks for c in validated_criteria)
    max_score = rubric.total_marks

    # Final clamp (should never be needed if per-criterion clamping works)
    if total_score > max_score:
        validation_issues.append(ValidationIssue(
            field="total_score",
            issue=f"Total score {total_score} exceeds max {max_score}",
            original_value=str(total_score),
            corrected_value=str(max_score),
        ))
        total_score = max_score
        needs_review = True
        review_reasons.append(f"Total score exceeded maximum; clamped to {max_score}")

    # --- Overall confidence ---
    if validated_criteria:
        overall_confidence = min(
            llm_output.overall_confidence,
            min(c.confidence for c in validated_criteria),
        )
    else:
        overall_confidence = 0.0

    if overall_confidence < CONFIDENCE_THRESHOLD:
        needs_review = True
        if f"Low overall confidence" not in " ".join(review_reasons):
            review_reasons.append(f"Low overall confidence: {overall_confidence:.2f}")

    # Determine status
    if needs_review:
        status = "flagged"
    else:
        status = "completed"

    return ValidatedGradingResult(
        submission_id=submission_id,
        total_score=total_score,
        max_score=max_score,
        criteria=validated_criteria,
        overall_feedback=llm_output.overall_feedback,
        overall_confidence=overall_confidence,
        flagged_for_human_review=needs_review,
        review_reasons=review_reasons,
        validation_issues=validation_issues,
        status=status,
    )
