"""Schemas for extracted document text blocks with PDF coordinates."""

from pydantic import BaseModel


class TextBlock(BaseModel):
    """A single block of text extracted from a PDF page with its bounding box."""
    id: str               # Stable block ID, e.g. "blk_p1_03"
    page: int             # 1-indexed page number
    text: str             # The extracted text content
    bbox: list[float]     # [x0, y0, x1, y1] in PDF points (72 DPI)


class ExtractedDocument(BaseModel):
    """Full extraction result for a single PDF document."""
    filename: str
    total_pages: int
    blocks: list[TextBlock]
    raw_text: str         # Concatenated plain text for convenience
