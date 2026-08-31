"""
Annotated PDF export: draws annotations onto a COPY of the original student PDF.

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


def export_annotated_pdf(
    original_pdf_path: str | Path,
    annotations: list[Annotation],
    output_path: str | Path,
) -> Path:
    """
    Create an annotated copy of the student's PDF.

    Draws translucent highlight rectangles and feedback text callouts
    at each annotation's bounding box location.

    Args:
        original_pdf_path: Path to the pristine student PDF.
        annotations: List of Annotation model objects.
        output_path: Where to save the annotated PDF copy.

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

    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(output_path))
    doc.close()

    return output_path
