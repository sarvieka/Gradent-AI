"""
Gemini Vision Handwriting / Scanned PDF Extractor.

Renders PDF pages to images via PyMuPDF and uses Gemini Vision
to transcribe handwritten text into normalized TextBlocks with bounding boxes.

Coordinate System:
- Gemini Vision returns normalized box coordinates (0 to 1000 scale).
- Output is converted to PDF-native points (72 DPI, origin top-left).
- Output bbox format: [x0, y0, x1, y1] — identical to PyMuPDF output.
"""

import json
import logging
from pathlib import Path

import fitz  # PyMuPDF
from google import genai
from google.genai import types
from pydantic import BaseModel, Field, ValidationError

from app.config import settings
from app.schemas.document import ExtractedDocument, TextBlock

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Pydantic validation schemas for raw Gemini OCR
# ──────────────────────────────────────────────
class VisionBBox(BaseModel):
    ymin: float = Field(..., description="Top coordinate (0..1000)")
    xmin: float = Field(..., description="Left coordinate (0..1000)")
    ymax: float = Field(..., description="Bottom coordinate (0..1000)")
    xmax: float = Field(..., description="Right coordinate (0..1000)")


class VisionOCRBlock(BaseModel):
    block_id: str
    page_number: int = 1
    text: str
    bbox: VisionBBox
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    unreadable: bool = False


class VisionOCRResponse(BaseModel):
    blocks: list[VisionOCRBlock]
    overall_confidence: float = Field(default=1.0, ge=0.0, le=1.0)


# System prompt enforcing structured JSON output for OCR
VISION_OCR_PROMPT = """You are an expert OCR system specializing in transcribing handwritten student exam answers.

Analyze the image of this student answer paper page and extract all text blocks.

CRITICAL INSTRUCTIONS:
1. Transcribe the student's handwriting as accurately as possible. Preserve their exact wording.
2. Group contiguous lines into logical text blocks.
3. For each block, provide bounding box coordinates in normalized scale 0 to 1000:
   - ymin: top edge (0 to 1000)
   - xmin: left edge (0 to 1000)
   - ymax: bottom edge (0 to 1000)
   - xmax: right edge (0 to 1000)
4. Assign a block_id using pattern "blk_p{page_num}_{index:02d}" (e.g. blk_p1_01).
5. Provide a confidence score between 0.0 and 1.0 for each block.
6. Set unreadable to true if handwriting is illegible or severely ambiguous.

Return ONLY valid JSON matching this schema — no markdown code fences:
{
  "blocks": [
    {
      "block_id": "blk_p1_01",
      "page_number": 1,
      "text": "transcribed text here",
      "bbox": { "ymin": 100, "xmin": 120, "ymax": 250, "xmax": 850 },
      "confidence": 0.95,
      "unreadable": false
    }
  ],
  "overall_confidence": 0.90
}
"""


def convert_bbox_to_pdf_points(
    bbox: VisionBBox, page_width: float, page_height: float
) -> list[float]:
    """
    Convert normalized OCR bounding box (0..1000 scale or 0..1 scale)
    to PDF-native point coordinates [x0, y0, x1, y1] (72 DPI).
    """
    # Detect if scale is 0..1 or 0..1000
    max_val = max(bbox.ymin, bbox.xmin, bbox.ymax, bbox.xmax)
    scale = 1.0 if max_val <= 1.0 else 1000.0

    x0 = round((bbox.xmin / scale) * page_width, 2)
    y0 = round((bbox.ymin / scale) * page_height, 2)
    x1 = round((bbox.xmax / scale) * page_width, 2)
    y1 = round((bbox.ymax / scale) * page_height, 2)

    # Ensure x0 < x1 and y0 < y1
    if x0 >= x1:
        x1 = min(x0 + 50.0, page_width)
    if y0 >= y1:
        y1 = min(y0 + 20.0, page_height)

    return [x0, y0, x1, y1]


def extract_handwritten_blocks(
    pdf_path: str | Path, model: str = "gemini-3.6-flash"
) -> ExtractedDocument:
    """
    Extract handwritten or scanned text from a PDF file using Gemini Vision.

    Steps:
    1. Render each page to an image.
    2. Call Gemini Vision with structured OCR prompt.
    3. Parse structured JSON response.
    4. Convert normalized bounding boxes to PDF points.
    5. Return normalized ExtractedDocument.

    Falls back to a safe error document on failure without raising unhandled exceptions.
    """
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set. Cannot run Gemini Vision extraction.")
        return ExtractedDocument(
            filename=pdf_path.name,
            total_pages=0,
            blocks=[],
            raw_text="Extraction failed: GEMINI_API_KEY not configured.",
            extraction_method="failed",
            overall_confidence=0.0,
            low_confidence_flag=True,
        )

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    doc = fitz.open(str(pdf_path))
    total_pages = len(doc)
    all_blocks: list[TextBlock] = []
    all_text_parts: list[str] = []
    page_confidences: list[float] = []
    has_unreadable = False

    try:
        for page_idx in range(total_pages):
            page = doc[page_idx]
            page_num = page_idx + 1
            page_width = page.rect.width
            page_height = page.rect.height

            # Render page to PNG bytes (150 DPI for good OCR clarity)
            pix = page.get_pixmap(dpi=150)
            img_bytes = pix.tobytes("png")

            image_part = types.Part.from_bytes(data=img_bytes, mime_type="image/png")
            prompt = f"Page {page_num} of {total_pages}.\n{VISION_OCR_PROMPT}"

            logger.info("Sending page %d image to Gemini Vision OCR...", page_num)

            response = client.models.generate_content(
                model=model,
                contents=[image_part, prompt],
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    response_mime_type="application/json",
                ),
            )

            raw_text = response.text
            if not raw_text or not raw_text.strip():
                logger.warning("Gemini Vision returned empty text for page %d", page_num)
                continue

            # Parse and validate JSON
            parsed_json = json.loads(raw_text)
            vision_data = VisionOCRResponse.model_validate(parsed_json)

            page_confidences.append(vision_data.overall_confidence)

            for b in vision_data.blocks:
                if b.unreadable or b.confidence < 0.5:
                    has_unreadable = True

                pdf_bbox = convert_bbox_to_pdf_points(b.bbox, page_width, page_height)
                
                # Ensure unique block ID format
                block_id = b.block_id if b.block_id.startswith(f"blk_p{page_num}_") else f"blk_p{page_num}_{len(all_blocks)+1:02d}"

                text_block = TextBlock(
                    id=block_id,
                    page=page_num,
                    text=b.text.strip(),
                    bbox=pdf_bbox,
                    confidence=b.confidence,
                )
                all_blocks.append(text_block)
                if b.text.strip():
                    all_text_parts.append(b.text.strip())

        doc.close()

        overall_conf = (
            sum(page_confidences) / len(page_confidences)
            if page_confidences
            else (0.0 if not all_blocks else 0.8)
        )
        low_confidence = overall_conf < 0.7 or has_unreadable or len(all_blocks) == 0

        return ExtractedDocument(
            filename=pdf_path.name,
            total_pages=total_pages,
            blocks=all_blocks,
            raw_text="\n".join(all_text_parts),
            extraction_method="gemini_vision",
            overall_confidence=round(overall_conf, 2),
            low_confidence_flag=low_confidence,
        )

    except Exception as e:
        logger.error("Handwritten Vision extraction failed: %s", e, exc_info=True)
        if hasattr(doc, "close"):
            doc.close()
        return ExtractedDocument(
            filename=pdf_path.name,
            total_pages=total_pages if 'total_pages' in locals() else 0,
            blocks=[],
            raw_text=f"Handwriting extraction failed: {e}",
            extraction_method="failed",
            overall_confidence=0.0,
            low_confidence_flag=True,
        )
