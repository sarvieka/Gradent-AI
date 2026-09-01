# AI-Powered Grading and Annotation Tool

An end-to-end AI-assisted grading and PDF annotation backend for student exam papers, powered by FastAPI, PyMuPDF, SQLite, and Google Gemini API.

---

## 🏗️ Extraction Architecture & Dual Strategy

Student answer submissions arrive as PDF documents in two distinct formats:
1. **Digitally Typed PDFs** (generated directly from text editors or word processors).
2. **Scanned / Handwritten Answer Papers** (image-based PDFs or scanned physical papers).

To handle both formats seamlessly, the system uses a **Dual Extraction Strategy**:

```
                  Student Answer PDF
                          │
                          ▼
            PyMuPDF Native Text Extraction
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
[Sufficient Text Found]    [Little / No Native Text]
 (Digitally Typed PDF)     (Scanned / Handwritten PDF)
            │                           │
            │                           ▼
            │               PyMuPDF Render Pages to PNG
            │                           │
            │                           ▼
            │               Gemini Vision OCR API
            │               (Structured BBox JSON)
            │                           │
            └─────────────┬─────────────┘
                          │
                          ▼
             Normalized TextBlock Schema
             (block_id, page, text, bbox [x0,y0,x1,y1], confidence)
                          │
                          ▼
         Downstream Pipeline (Grader → Validator → Annotation Exporter)
```

---

### 1. Typed PDF Extraction (`PyMuPDF`)
- **Mechanism**: Extracts embedded text characters and font bounding boxes directly from the PDF dictionary structure using PyMuPDF (`fitz`).
- **Performance**: High speed, zero API cost, 100% deterministic text accuracy.
- **Output**: Returns `TextBlock` objects with native PDF coordinates `[x0, y0, x1, y1]` in 72 DPI points.

### 2. Handwritten / Scanned Extraction (`Gemini Vision`)
- **Mechanism**: Triggered automatically when PyMuPDF detects fewer than 10 text characters in a document.
- **Process**:
  1. Renders PDF pages to 150 DPI PNG images using `page.get_pixmap()`.
  2. Sends page images to Google Gemini Vision (`gemini-3.6-flash`).
  3. Prompts Gemini Vision to transcribe handwriting, identify distinct text blocks, and return structured JSON matching `VisionOCRResponse`.
  4. Converts normalized 0–1000 bounding box coordinates into PDF-native points `[x0, y0, x1, y1]`.

---

### 📏 Bounding Box & Coordinate System

Both extraction strategies normalize bounding boxes to the exact same coordinate system so that downstream modules (`evidence_resolver.py`, `pdf_exporter.py`, and frontend viewers) require zero format-specific branching:

- **Origin**: Top-left corner of the PDF page `(0.0, 0.0)`.
- **Units**: PDF Points (72 points per inch, standard PDF DPI).
- **Format**: `[x0, y0, x1, y1]` where `(x0, y0)` is the top-left coordinate and `(x1, y1)` is the bottom-right coordinate.
- **Conversion Equation**:
  $$x_0 = \frac{\text{xmin}}{\text{scale}} \times W_{\text{pdf}}, \quad y_0 = \frac{\text{ymin}}{\text{scale}} \times H_{\text{pdf}}$$
  $$x_1 = \frac{\text{xmax}}{\text{scale}} \times W_{\text{pdf}}, \quad y_1 = \frac{\text{ymax}}{\text{scale}} \times H_{\text{pdf}}$$
  *(where $\text{scale} = 1000.0$ for Gemini Vision normalized output)*

---

### 🛡️ Confidence & Human Review Handling

Handwriting recognition is inherently probabilistic:
- **Confidence Tracking**: Each `TextBlock` carries an OCR confidence score ($0.0 \le c \le 1.0$).
- **Human Review Flag**: If overall extraction confidence falls below $0.70$ or unreadable blocks are detected, the document is flagged (`low_confidence_flag = True`).
- **Pipeline Integration**: The `GradingService` preserves extraction uncertainty and marks the grading result with `flagged_for_human_review = True`, prompting teacher review in the UI.
- **Graceful Fallback**: If Gemini Vision fails or returns malformed output, the system creates a controlled failure result instead of crashing the API. Fabricated OCR output is never generated.

---

### ⚠️ Limitations of Handwriting Recognition

1. **Illegible Scribbles**: Unclear handwriting may yield low confidence scores or missing criteria.
2. **Overlapping Annotations**: Marginalia or diagrams drawn over handwritten text can distort bounding box estimations.
3. **Multi-Column Layouts**: Complex non-standard handwriting columns require multi-page rendering for accurate block ordering.

---

## 🧪 Testing

Run the full backend test suite (29 automated unit & integration tests):

```bash
cd backend
venv/bin/pytest tests/ -v
```

Run manual handwriting smoke test against a real PDF:

```bash
cd backend
venv/bin/python test_handwriting_smoke.py <path_to_pdf>
```
