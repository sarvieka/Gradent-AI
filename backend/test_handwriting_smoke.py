"""
Manual smoke test script for Gemini Vision handwritten / scanned PDF extraction.

Usage:
  python test_handwriting_smoke.py <path_to_handwritten_pdf>

Example:
  python test_handwriting_smoke.py test_blank.pdf
"""

import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.config import settings
from app.services.vision_extractor import extract_handwritten_blocks


def main():
    if len(sys.argv) < 2:
        print("Usage: python test_handwriting_smoke.py <path_to_pdf>")
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    if not pdf_path.exists():
        print(f"Error: File not found: {pdf_path}")
        sys.exit(1)

    if not settings.GEMINI_API_KEY:
        print("Error: GEMINI_API_KEY is not set in backend/.env")
        sys.exit(1)

    print(f"Extracting handwritten / scanned text from: {pdf_path.name}")
    print("API Key loaded: YES")

    extracted = extract_handwritten_blocks(pdf_path)

    print("\n" + "=" * 60)
    print("EXTRACTION RESULT SUMMARY")
    print("=" * 60)
    print(f"Filename:            {extracted.filename}")
    print(f"Total Pages:         {extracted.total_pages}")
    print(f"Extraction Method:   {extracted.extraction_method}")
    print(f"Overall Confidence:  {extracted.overall_confidence:.2f}")
    print(f"Low Confidence Flag: {extracted.low_confidence_flag}")
    print(f"Total Text Blocks:   {len(extracted.blocks)}")
    print("=" * 60)

    if extracted.blocks:
        print("\nEXTRACTED TEXT BLOCKS:")
        for idx, b in enumerate(extracted.blocks, 1):
            print(f"\n[{idx}] ID: {b.id} | Page: {b.page} | Confidence: {b.confidence:.2f}")
            print(f"    BBox (x0, y0, x1, y1): {b.bbox}")
            print(f"    Text: {b.text}")
    else:
        print("\nNo text blocks extracted or extraction failed.")
        print(f"Raw Text Output: {extracted.raw_text}")

    print("\n" + "=" * 60)
    print("SMOKE TEST COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
