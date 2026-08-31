"""Generate minimal test PDF files for the grading pipeline tests."""

import fitz  # PyMuPDF


def create_test_pdf(path: str, lines: list[str]):
    """Create a simple PDF with the given text lines."""
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)  # A4

    y = 72  # Start 1 inch from top
    for line in lines:
        page.insert_text(
            fitz.Point(72, y),
            line,
            fontsize=12,
            fontname="helv",
        )
        y += 20

    doc.save(path)
    doc.close()


def create_blank_pdf(path: str):
    """Create a PDF with no text content."""
    doc = fitz.open()
    doc.new_page(width=595, height=842)
    doc.save(path)
    doc.close()


if __name__ == "__main__":
    # Fully correct student answer
    create_test_pdf("test_correct.pdf", [
        "Question 1 Answer:",
        "TCP is a connection-oriented protocol that provides reliable data delivery.",
        "It uses a three-way handshake to establish connections.",
        "TCP provides flow control using sliding window mechanism.",
        "It ensures ordered delivery of data packets.",
    ])

    # Partially correct answer
    create_test_pdf("test_partial.pdf", [
        "Question 1 Answer:",
        "TCP is a protocol used for sending data.",
        "It connects two computers together.",
    ])

    # Incorrect answer
    create_test_pdf("test_incorrect.pdf", [
        "Question 1 Answer:",
        "UDP is a connectionless protocol.",
        "It does not guarantee delivery of packets.",
    ])

    # Blank answer
    create_blank_pdf("test_blank.pdf")

    # OCR-like spelling errors
    create_test_pdf("test_ocr_errors.pdf", [
        "Question 1 Ansver:",
        "TCP iz a connecton-orientd protocl that provids reliabl data delivry.",
        "It uzez a three-way handshak to estblish connectons.",
    ])

    print("Test PDFs created successfully.")
