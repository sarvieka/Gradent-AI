"""PDF text extraction with PyMuPDF (typed PDFs) and Gemini Vision (scanned/handwritten PDFs)."""

import logging
from pathlib import Path

import fitz  # PyMuPDF

from app.schemas.document import ExtractedDocument, TextBlock

logger = logging.getLogger(__name__)


def extract_native_pdf_blocks(pdf_path: str | Path) -> ExtractedDocument:
    """
    Extract native text blocks from a typed PDF using PyMuPDF.

    Each block gets a stable ID like 'blk_p1_03' and its exact bounding box
    in PDF-native coordinates (72 DPI points).
    """
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    doc = fitz.open(str(pdf_path))
    blocks: list[TextBlock] = []
    all_text_parts: list[str] = []

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        page_num = page_idx + 1  # 1-indexed

        # get_text("dict") returns structured text with position info
        page_dict = page.get_text("dict")

        block_counter = 0
        for block in page_dict.get("blocks", []):
            # Skip image blocks (type 1); only process text blocks (type 0)
            if block.get("type") != 0:
                continue

            # Extract text from all lines and spans within this block
            block_text_parts: list[str] = []
            for line in block.get("lines", []):
                line_text = ""
                for span in line.get("spans", []):
                    line_text += span.get("text", "")
                if line_text.strip():
                    block_text_parts.append(line_text.strip())

            block_text = " ".join(block_text_parts)
            if not block_text.strip():
                continue

            block_counter += 1
            block_id = f"blk_p{page_num}_{block_counter:02d}"
            bbox = list(block["bbox"])  # [x0, y0, x1, y1]

            blocks.append(TextBlock(
                id=block_id,
                page=page_num,
                text=block_text,
                bbox=bbox,
                confidence=1.0,
            ))
            all_text_parts.append(block_text)

    total_pages = len(doc)
    doc.close()

    return ExtractedDocument(
        filename=pdf_path.name,
        total_pages=total_pages,
        blocks=blocks,
        raw_text="\n".join(all_text_parts),
        extraction_method="pymupdf",
        overall_confidence=1.0,
        low_confidence_flag=False,
    )


def extract_text_blocks(pdf_path: str | Path, allow_vision: bool = True) -> ExtractedDocument:
    """
    Main extraction routing strategy:

    1. Attempt native PyMuPDF text extraction.
    2. If sufficient text is found, return native result.
    3. If little/no text is found (scanned or handwritten PDF), route to Gemini Vision OCR.
    """
    native_result = extract_native_pdf_blocks(pdf_path)

    # If PyMuPDF found sufficient text (not a blank/scanned page), return it immediately
    if not is_blank_submission(native_result):
        return native_result

    if not allow_vision:
        return native_result

    # Scanned or handwritten PDF detected — attempt Gemini Vision OCR
    logger.info("Little or no native text found in '%s'. Routing to Gemini Vision OCR...", Path(pdf_path).name)
    
    from app.services.vision_extractor import extract_handwritten_blocks
    vision_result = extract_handwritten_blocks(pdf_path)

    # If Vision found text blocks, return vision_result
    if len(vision_result.blocks) > 0:
        return vision_result

    # Otherwise return native_result (will be handled as blank/unreadable submission)
    return native_result


def is_blank_submission(extracted: ExtractedDocument, min_chars: int = 10) -> bool:
    """Check if a student submission is effectively blank."""
    total_text = extracted.raw_text.strip()
    return len(total_text) < min_chars
