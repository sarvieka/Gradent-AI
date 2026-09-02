"""
Unit & integration tests for Gemini Vision handwritten / scanned PDF extraction.

No real Gemini API calls are made in pytest — calls are mocked using unittest.mock.
"""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.core.extractor import extract_text_blocks, is_blank_submission
from app.schemas.document import ExtractedDocument, TextBlock
from app.services.vision_extractor import (
    VisionBBox,
    convert_bbox_to_pdf_points,
    extract_handwritten_blocks,
)


def _make_mock_vision_response(
    blocks_data: list[dict], overall_confidence: float = 0.90
) -> MagicMock:
    """Helper: create a mock Gemini response returning valid Vision JSON."""
    mock_resp = MagicMock()
    mock_resp.text = json.dumps({
        "blocks": blocks_data,
        "overall_confidence": overall_confidence,
    })
    return mock_resp


# ──────────────────────────────────────────────
# 1. Coordinate Conversion Tests
# ──────────────────────────────────────────────
def test_convert_bbox_to_pdf_points_scale_1000():
    """Convert 0..1000 scale bbox to PDF points (A4 size: 595 x 842)."""
    bbox = VisionBBox(ymin=100, xmin=100, ymax=200, xmax=500)
    pdf_bbox = convert_bbox_to_pdf_points(bbox, page_width=595.0, page_height=842.0)

    # 100/1000 * 595 = 59.5
    # 100/1000 * 842 = 84.2
    # 500/1000 * 595 = 297.5
    # 200/1000 * 842 = 168.4
    assert pdf_bbox == [59.5, 84.2, 297.5, 168.4]


def test_convert_bbox_to_pdf_points_scale_1():
    """Convert 0..1 scale bbox to PDF points."""
    bbox = VisionBBox(ymin=0.1, xmin=0.1, ymax=0.2, xmax=0.5)
    pdf_bbox = convert_bbox_to_pdf_points(bbox, page_width=595.0, page_height=842.0)

    assert pdf_bbox == [59.5, 84.2, 297.5, 168.4]


# ──────────────────────────────────────────────
# 2. Vision OCR Parsing Tests
# ──────────────────────────────────────────────
def test_extract_handwritten_blocks_valid_response(blank_pdf: Path):
    """Test parsing of valid handwritten blocks from Gemini Vision."""
    mock_response = _make_mock_vision_response([
        {
            "block_id": "blk_p1_01",
            "page_number": 1,
            "text": "Handwritten answer for Question 1: TCP is connection oriented.",
            "bbox": {"ymin": 100, "xmin": 100, "ymax": 200, "xmax": 800},
            "confidence": 0.95,
            "unreadable": False,
        },
        {
            "block_id": "blk_p1_02",
            "page_number": 1,
            "text": "Three way handshake is used to establish connections.",
            "bbox": {"ymin": 220, "xmin": 100, "ymax": 300, "xmax": 800},
            "confidence": 0.90,
            "unreadable": False,
        },
    ])

    with patch("app.services.vision_extractor.genai.Client") as mock_client_cls, \
         patch("app.services.vision_extractor.settings") as mock_settings:
        mock_settings.GEMINI_API_KEY = "fake-key"
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        mock_client_cls.return_value = mock_client

        extracted = extract_handwritten_blocks(blank_pdf)

    assert isinstance(extracted, ExtractedDocument)
    assert extracted.extraction_method == "gemini_vision"
    assert len(extracted.blocks) == 2
    assert extracted.blocks[0].id == "blk_p1_01"
    assert "TCP is connection oriented" in extracted.blocks[0].text
    assert len(extracted.blocks[0].bbox) == 4
    assert extracted.overall_confidence == 0.90
    assert extracted.low_confidence_flag is False


def test_extract_handwritten_blocks_low_confidence_flag(blank_pdf: Path):
    """Low OCR confidence should set low_confidence_flag = True."""
    mock_response = _make_mock_vision_response([
        {
            "block_id": "blk_p1_01",
            "page_number": 1,
            "text": "Illegible scribbled text",
            "bbox": {"ymin": 100, "xmin": 100, "ymax": 200, "xmax": 500},
            "confidence": 0.40,
            "unreadable": True,
        }
    ], overall_confidence=0.50)

    with patch("app.services.vision_extractor.genai.Client") as mock_client_cls, \
         patch("app.services.vision_extractor.settings") as mock_settings:
        mock_settings.GEMINI_API_KEY = "fake-key"
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        mock_client_cls.return_value = mock_client

        extracted = extract_handwritten_blocks(blank_pdf)

    assert extracted.low_confidence_flag is True
    assert extracted.overall_confidence == 0.50


def test_extract_handwritten_blocks_api_failure_handled(blank_pdf: Path):
    """API failure should return a controlled failed document, not raise an unhandled exception."""
    with patch("app.services.vision_extractor.genai.Client") as mock_client_cls, \
         patch("app.services.vision_extractor.settings") as mock_settings:
        mock_settings.GEMINI_API_KEY = "fake-key"
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = RuntimeError("Vision API quota exceeded")
        mock_client_cls.return_value = mock_client

        extracted = extract_handwritten_blocks(blank_pdf)

    assert extracted.extraction_method == "failed"
    assert extracted.overall_confidence == 0.0
    assert extracted.low_confidence_flag is True
    assert len(extracted.blocks) == 0


def test_extract_handwritten_blocks_malformed_json(blank_pdf: Path):
    """Invalid JSON response should be handled safely as a controlled failure."""
    mock_response = MagicMock()
    mock_response.text = "NOT_JSON_AT_ALL"

    with patch("app.services.vision_extractor.genai.Client") as mock_client_cls, \
         patch("app.services.vision_extractor.settings") as mock_settings:
        mock_settings.GEMINI_API_KEY = "fake-key"
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        mock_client_cls.return_value = mock_client

        extracted = extract_handwritten_blocks(blank_pdf)

    assert extracted.extraction_method == "failed"
    assert extracted.low_confidence_flag is True


# ──────────────────────────────────────────────
# 3. Strategy Router Tests
# ──────────────────────────────────────────────
def test_typed_pdf_uses_pymupdf(correct_pdf: Path):
    """Typed PDFs should use PyMuPDF directly without calling Gemini Vision."""
    with patch("app.services.vision_extractor.extract_handwritten_blocks") as mock_vision:
        extracted = extract_text_blocks(correct_pdf)
        mock_vision.assert_not_called()

    assert extracted.extraction_method == "pymupdf"
    assert len(extracted.blocks) > 0


def test_scanned_pdf_routes_to_gemini_vision(blank_pdf: Path):
    """PDFs with no native text should route to Gemini Vision."""
    mock_vision_doc = ExtractedDocument(
        filename=blank_pdf.name,
        total_pages=1,
        blocks=[
            TextBlock(
                id="blk_p1_01",
                page=1,
                text="Handwritten TCP answer",
                bbox=[72, 100, 450, 150],
                confidence=0.92,
            )
        ],
        raw_text="Handwritten TCP answer",
        extraction_method="gemini_vision",
        overall_confidence=0.92,
        low_confidence_flag=False,
    )

    with patch("app.services.vision_extractor.extract_handwritten_blocks", return_value=mock_vision_doc) as mock_vision:
        extracted = extract_text_blocks(blank_pdf)
        mock_vision.assert_called_once_with(blank_pdf)

    assert extracted.extraction_method == "gemini_vision"
    assert len(extracted.blocks) == 1
    assert extracted.blocks[0].text == "Handwritten TCP answer"


def test_mixed_pdf_extraction(tmp_path: Path):
    """Mixed PDF (typed page 1 + handwritten page 2) should extract native for p1 and vision for p2."""
    import fitz
    pdf_path = tmp_path / "mixed_test.pdf"
    doc = fitz.open()

    # Page 1: Typed text
    p1 = doc.new_page(width=595, height=842)
    p1.insert_text((50, 100), "Question 1: Explain electric circuit principles in detail.")

    # Page 2: Blank (simulating handwritten scanned page)
    doc.new_page(width=595, height=842)
    doc.save(str(pdf_path))
    doc.close()

    mock_vision_p2 = ([
        TextBlock(
            id="blk_p2_01",
            page=2,
            text="Student handwritten answer for Q1: A closed circuit allows current flow.",
            bbox=[50.0, 120.0, 500.0, 180.0],
            confidence=0.94,
        )
    ], 0.94, False)

    with patch("app.services.vision_extractor.extract_handwritten_page_blocks", return_value=mock_vision_p2) as mock_vision_page, \
         patch("app.core.extractor.settings") as mock_settings:
        mock_settings.GEMINI_API_KEY = "fake-key"
        extracted = extract_text_blocks(pdf_path)

    assert extracted.total_pages == 2
    assert extracted.extraction_method == "gemini_vision"
    assert len(extracted.blocks) == 2
    assert extracted.blocks[0].page == 1
    assert extracted.blocks[0].text.startswith("Question 1")
    assert extracted.blocks[1].page == 2
    assert extracted.blocks[1].text.startswith("Student handwritten answer")


def test_blank_scanned_pdf(blank_pdf: Path):
    """Visually blank scanned PDF should be identified as blank submission."""
    mock_vision_empty = ExtractedDocument(
        filename=blank_pdf.name,
        total_pages=1,
        blocks=[],
        raw_text="",
        extraction_method="gemini_vision",
        overall_confidence=1.0,
        low_confidence_flag=False,
    )

    with patch("app.services.vision_extractor.extract_handwritten_blocks", return_value=mock_vision_empty):
        extracted = extract_text_blocks(blank_pdf)

    assert is_blank_submission(extracted)
    assert len(extracted.blocks) == 0


def test_handwritten_page_with_diagram(blank_pdf: Path):
    """Handwritten page containing diagram labels should extract vision text blocks."""
    mock_vision_diagram = ExtractedDocument(
        filename=blank_pdf.name,
        total_pages=1,
        blocks=[
            TextBlock(
                id="blk_p1_01",
                page=1,
                text="Diagram: Battery | Switch | Resistor | Ammeter | Voltmeter",
                bbox=[100, 200, 400, 500],
                confidence=0.88,
            )
        ],
        raw_text="Diagram: Battery | Switch | Resistor | Ammeter | Voltmeter",
        extraction_method="gemini_vision",
        overall_confidence=0.88,
        low_confidence_flag=False,
    )

    with patch("app.services.vision_extractor.extract_handwritten_blocks", return_value=mock_vision_diagram):
        extracted = extract_text_blocks(blank_pdf)

    assert not is_blank_submission(extracted)
    assert len(extracted.blocks) == 1
    assert "Ammeter" in extracted.blocks[0].text
