"""
Annotated PDF export: draws annotations onto a COPY of the original student PDF
and appends a professional "Grading Summary" report page at the end.

The original PDF is NEVER modified.
"""

from pathlib import Path

import fitz  # PyMuPDF

from app.models.annotation import Annotation


# Color map for annotation types (R, G, B) in 0-1 range
ANNOTATION_COLORS = {
    "correct": (0.2, 0.7, 0.3),     # Green
    "partial": (1.0, 0.7, 0.0),     # Orange
    "incorrect": (0.9, 0.2, 0.2),   # Red
    "missing": (0.6, 0.6, 0.6),     # Gray
    "unclear": (0.5, 0.5, 0.9),     # Blue-ish
    "comment": (0.3, 0.5, 0.9),     # Blue
}

# Summary page colors
_CLR_HEADING = (0.06, 0.09, 0.16)
_CLR_SUBTITLE = (0.39, 0.45, 0.55)
_CLR_ACCENT = (0.15, 0.39, 0.92)
_CLR_BODY = (0.20, 0.25, 0.33)
_CLR_CELL = (0.12, 0.16, 0.23)
_CLR_RULE = (0.89, 0.91, 0.94)
_CLR_HEADER_FILL = (0.97, 0.98, 0.99)
_CLR_SCORE_FILL = (0.94, 0.96, 1.0)
_CLR_SCORE_BORDER = (0.75, 0.86, 0.99)
_CLR_TOTAL_BORDER = (0.75, 0.78, 0.84)


def _group_criteria_for_summary(criteria: list[dict]) -> list[dict]:
    """Group flat criteria list into question-level summaries."""
    groups: dict[str, dict] = {}

    for c in criteria:
        r_id = str(c.get("rubric_item_id", ""))
        desc = str(c.get("criterion_description", "")).lower()

        if r_id.startswith("q2") or "english" in desc or "technology" in desc:
            q_id, q_title, subject = "Q2", "Question 2", "English"
        elif r_id.startswith("q3") or "economics" in desc or "demand" in desc:
            q_id, q_title, subject = "Q3", "Question 3", "Economics"
        else:
            q_id, q_title, subject = "Q1", "Question 1", "Science"

        if q_id not in groups:
            groups[q_id] = {
                "q_id": q_id,
                "q_title": q_title,
                "subject": subject,
                "awarded": 0.0,
                "max": 0.0,
                "criteria": [],
            }

        groups[q_id]["criteria"].append(c)
        groups[q_id]["awarded"] += float(c.get("awarded_marks", 0))
        groups[q_id]["max"] += float(c.get("max_marks", 0))

    return list(groups.values())


def _draw_summary_page(doc: fitz.Document, submission, annotations: list[Annotation] | None):
    """Append a professional Grading Summary page to the document."""
    page = doc.new_page(width=595.28, height=841.89)

    # ── Retrieve data from submission ──
    total_score = float(submission.total_score) if submission else 0.0
    max_score = float(submission.max_score) if submission else 0.0
    criteria = submission.get_criteria() if submission else []
    groups = _group_criteria_for_summary(criteria)
    filename = submission.student_pdf_filename if submission else "Student Answer"

    # ─── 1. PAGE HEADER ───
    page.insert_text(fitz.Point(40, 50), "Grading Summary", fontsize=22, fontname="hebo", color=_CLR_HEADING)
    page.insert_text(fitz.Point(40, 68), f"Student Submission: {filename}", fontsize=9, fontname="helv", color=_CLR_SUBTITLE)
    page.draw_line(fitz.Point(40, 78), fitz.Point(555, 78), color=_CLR_RULE, width=1.0)

    # ─── 2. FINAL SCORE BANNER ───
    score_rect = fitz.Rect(40, 90, 555, 148)
    page.draw_rect(score_rect, color=_CLR_SCORE_BORDER, fill=_CLR_SCORE_FILL, width=1.0)
    page.insert_text(fitz.Point(56, 112), "FINAL SCORE", fontsize=9, fontname="hebo", color=_CLR_ACCENT)
    score_str = f"{total_score:g} / {max_score:g} Marks"
    page.insert_text(fitz.Point(56, 138), score_str, fontsize=22, fontname="hebo", color=_CLR_HEADING)

    # ─── 3. QUESTION BREAKDOWN TABLE ───
    page.insert_text(fitz.Point(40, 174), "Question Breakdown", fontsize=14, fontname="hebo", color=_CLR_HEADING)

    tbl_top = 188
    col_q = 52       # Question column
    col_subj = 150   # Subject column
    col_award = 320  # Marks Awarded column
    col_max = 450    # Maximum Marks column
    row_h = 24

    # Table header row
    hdr_rect = fitz.Rect(40, tbl_top, 555, tbl_top + row_h)
    page.draw_rect(hdr_rect, color=_CLR_RULE, fill=_CLR_HEADER_FILL, width=1.0)
    page.insert_text(fitz.Point(col_q, tbl_top + 16), "Question", fontsize=9, fontname="hebo", color=_CLR_SUBTITLE)
    page.insert_text(fitz.Point(col_subj, tbl_top + 16), "Subject", fontsize=9, fontname="hebo", color=_CLR_SUBTITLE)
    page.insert_text(fitz.Point(col_award, tbl_top + 16), "Marks Awarded", fontsize=9, fontname="hebo", color=_CLR_SUBTITLE)
    page.insert_text(fitz.Point(col_max, tbl_top + 16), "Maximum Marks", fontsize=9, fontname="hebo", color=_CLR_SUBTITLE)

    y = tbl_top + row_h
    sum_awarded = 0.0
    sum_max = 0.0

    for g in groups:
        row_rect = fitz.Rect(40, y, 555, y + row_h)
        page.draw_rect(row_rect, color=_CLR_RULE, width=0.5)
        page.insert_text(fitz.Point(col_q, y + 16), g["q_id"], fontsize=10, fontname="hebo", color=_CLR_CELL)
        page.insert_text(fitz.Point(col_subj, y + 16), g["subject"], fontsize=10, fontname="helv", color=_CLR_CELL)
        page.insert_text(fitz.Point(col_award, y + 16), f"{g['awarded']:g}", fontsize=10, fontname="helv", color=_CLR_CELL)
        page.insert_text(fitz.Point(col_max, y + 16), f"{g['max']:g}", fontsize=10, fontname="helv", color=_CLR_CELL)
        sum_awarded += g["awarded"]
        sum_max += g["max"]
        y += row_h

    # Total row
    tot_rect = fitz.Rect(40, y, 555, y + row_h + 2)
    page.draw_rect(tot_rect, color=_CLR_TOTAL_BORDER, fill=_CLR_HEADER_FILL, width=1.0)
    page.insert_text(fitz.Point(col_q, y + 17), "Total", fontsize=10, fontname="hebo", color=_CLR_HEADING)
    page.insert_text(fitz.Point(col_award, y + 17), f"{total_score:g}", fontsize=10, fontname="hebo", color=_CLR_HEADING)
    page.insert_text(fitz.Point(col_max, y + 17), f"{max_score:g}", fontsize=10, fontname="hebo", color=_CLR_HEADING)

    y += row_h + 20

    # ─── 4. PERFORMANCE OVERVIEW ───
    page.insert_text(fitz.Point(40, y), "Performance Overview", fontsize=14, fontname="hebo", color=_CLR_HEADING)
    y += 20

    for g in groups:
        # Question heading
        heading = f"{g['subject']} — {g['awarded']:g} / {g['max']:g}"
        page.insert_text(fitz.Point(40, y), heading, fontsize=11, fontname="hebo", color=_CLR_ACCENT)
        y += 16

        # Collect non-empty feedback from each criterion
        feedback_parts: list[str] = []
        for c in g["criteria"]:
            exp = c.get("explanation") or c.get("feedback") or ""
            corr = c.get("correction") or ""
            if exp:
                part = exp.strip()
                if corr:
                    part += f" Correction: {corr.strip()}"
                feedback_parts.append(part)

        if feedback_parts:
            combined = " ".join(feedback_parts)
        else:
            combined = "Good performance across all criteria."

        # Render the combined feedback into a textbox to handle wrapping
        tb_rect = fitz.Rect(40, y, 555, y + 80)
        used_height = page.insert_textbox(
            tb_rect,
            combined,
            fontsize=9,
            fontname="helv",
            color=_CLR_BODY,
            align=0,  # left
        )
        # Estimate how much vertical space was used
        line_count = max(1, combined.count(" ") // 12 + 1)
        estimated_h = min(80, max(16, line_count * 13))
        y += estimated_h + 10

        # Guard against running off the page
        if y > 770:
            break

    # ─── 5. REVIEW STATUS FOOTER ───
    footer_y = 810
    page.draw_line(fitz.Point(40, footer_y - 14), fitz.Point(555, footer_y - 14), color=_CLR_RULE, width=1.0)

    has_teacher_edits = False
    if annotations:
        has_teacher_edits = any(getattr(a, "is_user_edited", False) for a in annotations)

    if submission and (has_teacher_edits or submission.status == "completed"):
        status_text = "AI-assisted grading — Teacher review completed"
    else:
        status_text = "AI-assisted grading — Review pending"

    page.insert_text(fitz.Point(40, footer_y), status_text, fontsize=9, fontname="heit", color=_CLR_SUBTITLE)


def export_annotated_pdf(
    original_pdf_path: str | Path,
    annotations: list[Annotation],
    output_path: str | Path,
    submission=None,
) -> Path:
    """
    Create an annotated copy of the student's PDF with a Grading Summary page appended.

    Draws translucent highlight rectangles and feedback text callouts
    at each annotation's bounding box location, then appends a
    professional summary page with scores, question breakdown, and
    per-question performance feedback.

    Args:
        original_pdf_path: Path to the pristine student PDF.
        annotations: List of Annotation model objects.
        output_path: Where to save the annotated PDF copy.
        submission: Optional Submission DB object for score/criteria data.

    Returns:
        Path to the generated annotated PDF.
    """
    original_pdf_path = Path(original_pdf_path)
    output_path = Path(output_path)

    if not original_pdf_path.exists():
        raise FileNotFoundError(f"Original PDF not found: {original_pdf_path}")

    doc = fitz.open(str(original_pdf_path))

    for ann in annotations:
        page_idx = ann.page - 1  # Convert to 0-indexed
        if page_idx < 0 or page_idx >= len(doc):
            continue

        page = doc[page_idx]
        rect = fitz.Rect(ann.bbox_x0, ann.bbox_y0, ann.bbox_x1, ann.bbox_y1)
        color = ANNOTATION_COLORS.get(ann.annotation_type, (0.5, 0.5, 0.5))

        # Draw a translucent highlight rectangle
        highlight = page.add_rect_annot(rect)
        highlight.set_colors(stroke=color)
        highlight.set_border(width=1.5)
        highlight.set_opacity(0.3)
        highlight.update()

        # Add feedback text as a text annotation (sticky note) near the highlight
        if ann.feedback_text:
            note_point = fitz.Point(rect.x1 + 5, rect.y0)
            text_annot = page.add_text_annot(note_point, ann.feedback_text)
            text_annot.set_colors(stroke=color)
            text_annot.update()

    # Append the Grading Summary page if submission data is available
    if submission:
        _draw_summary_page(doc, submission, annotations)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(output_path))
    doc.close()

    return output_path
