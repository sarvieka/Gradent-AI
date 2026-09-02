"""
PDF text extraction with PyMuPDF (typed PDFs) and Gemini Vision (scanned/handwritten PDFs).

Operates at PAGE level:
- Native PyMuPDF text is extracted per page.
- If a page has meaningful native text, native blocks are kept.
- If a page lacks meaningful native text, it routes to Gemini Vision for OCR.
- Native and Vision blocks are merged into one ExtractedDocument preserving page numbers,
  bounding boxes, stable block IDs, confidence scores, and raw text.
"""

import logging
from pathlib import Path

import fitz  # PyMuPDF

from app.config import settings
from app.schemas.document import ExtractedDocument, TextBlock

logger = logging.getLogger(__name__)


def extract_native_page_blocks(page: fitz.Page, page_num: int) -> list[TextBlock]:
    """
    Extract native text blocks from a single PyMuPDF page.

    Each block gets a stable ID like 'blk_p1_03' and its exact bounding box
    in PDF-native coordinates (72 DPI points).
    """
    page_dict = page.get_text("dict")
    blocks: list[TextBlock] = []
    block_counter = 0

    for block in page_dict.get("blocks", []):
        if block.get("type") != 0:  # Only text blocks (type 0)
            continue

        block_text_parts: list[str] = []
        for line in block.get("lines", []):
            line_text = "".join(span.get("text", "") for span in line.get("spans", []))
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

    return blocks


def page_has_meaningful_native_text(blocks: list[TextBlock], min_chars: int = 10) -> bool:
    """Determine whether a single page has meaningful native text."""
    total_text = "".join(b.text.strip() for b in blocks)
    return len(total_text) >= min_chars


def extract_native_pdf_blocks(pdf_path: str | Path) -> ExtractedDocument:
    """
    Extract native text blocks from a typed PDF using PyMuPDF across all pages.
    """
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    doc = fitz.open(str(pdf_path))
    blocks: list[TextBlock] = []
    all_text_parts: list[str] = []

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        page_num = page_idx + 1
        page_blocks = extract_native_page_blocks(page, page_num)
        blocks.extend(page_blocks)
        for b in page_blocks:
            all_text_parts.append(b.text)

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
    Page-level extraction routing strategy:

    1. Process every PDF page individually.
    2. Extract native PyMuPDF text for the page.
    3. If meaningful native text exists on the page, keep native blocks.
    4. If insufficient/no native text exists on the page, render and run Gemini Vision OCR.
    5. Merge native and Vision blocks into a single ExtractedDocument.
    """
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    doc = fitz.open(str(pdf_path))
    total_pages = len(doc)

    # 1. Fast path: check if document native extraction yields valid text for ALL pages
    native_result = extract_native_pdf_blocks(pdf_path)
    all_pages_have_native = True
    for p_num in range(1, total_pages + 1):
        p_blocks = [b for b in native_result.blocks if b.page == p_num]
        if not page_has_meaningful_native_text(p_blocks):
            all_pages_have_native = False
            break

    # If fully typed PDF or vision disallowed, return native result directly
    if all_pages_have_native or not allow_vision:
        doc.close()
        return native_result

    # 2. If entire document is native-blank (scanned/handwritten PDF), attempt document-level vision
    if is_blank_submission(native_result):
        doc.close()
        from app.services.vision_extractor import extract_handwritten_blocks
        return extract_handwritten_blocks(pdf_path)

    # 3. Mixed PDF: process page by page
    all_blocks: list[TextBlock] = []
    all_text_parts: list[str] = []
    page_confidences: list[float] = []
    used_vision = False
    has_unreadable = False

    from app.services.vision_extractor import extract_handwritten_page_blocks
    from google import genai
    client = genai.Client(api_key=settings.GEMINI_API_KEY) if settings.GEMINI_API_KEY else None

    for page_idx in range(total_pages):
        page_num = page_idx + 1
        page = doc[page_idx]

        page_blocks = extract_native_page_blocks(page, page_num)

        if page_has_meaningful_native_text(page_blocks):
            all_blocks.extend(page_blocks)
            page_confidences.append(1.0)
            for b in page_blocks:
                all_text_parts.append(b.text)
        elif client is not None:
            v_blocks, conf, unreadable = extract_handwritten_page_blocks(
                page, page_num, total_pages, client=client
            )
            if v_blocks:
                used_vision = True
                all_blocks.extend(v_blocks)
                page_confidences.append(conf)
                if unreadable:
                    has_unreadable = True
                for b in v_blocks:
                    all_text_parts.append(b.text)
            else:
                # Visually blank or diagram without text
                all_blocks.extend(page_blocks)
                page_confidences.append(1.0)
        else:
            all_blocks.extend(page_blocks)
            page_confidences.append(1.0)
            for b in page_blocks:
                all_text_parts.append(b.text)

    doc.close()

    overall_conf = (
        round(sum(page_confidences) / len(page_confidences), 2)
        if page_confidences
        else 1.0
    )
    low_confidence = (overall_conf < 0.7) or has_unreadable

    return ExtractedDocument(
        filename=pdf_path.name,
        total_pages=total_pages,
        blocks=all_blocks,
        raw_text="\n".join(all_text_parts),
        extraction_method="gemini_vision" if used_vision else "pymupdf",
        overall_confidence=overall_conf,
        low_confidence_flag=low_confidence,
    )


def is_blank_submission(extracted: ExtractedDocument, min_chars: int = 10) -> bool:
    """Check if a student submission is effectively blank."""
    total_text = extracted.raw_text.strip()
    return len(total_text) < min_chars
