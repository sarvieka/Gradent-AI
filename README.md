# Gradent AI

**AI-powered grading and annotation tool for student answer papers**

[![Frontend](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Build Tool](https://img.shields.io/badge/Build-Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Backend](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Language](https://img.shields.io/badge/Language-Python-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Database](https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![AI](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![PDF](https://img.shields.io/badge/PDF-PyMuPDF-000000)](https://pymupdf.readthedocs.io/)

Gradent AI is an end-to-end AI-assisted grading and annotation tool for student answer papers. A teacher can upload a question paper, student answer paper, and marking rubric. The system extracts the student's answers, evaluates them criterion-by-criterion using Google Gemini, validates the result using deterministic backend rules, links grading decisions back to the student's answer, and generates editable annotations.

The system supports both **digitally generated** and **scanned/handwritten** answer papers.

---

## Live Demo

**Frontend:** https://gradent-ai.vercel.app/

**Backend:** https://gradent-ai-backend.onrender.com

**API Docs:** https://gradent-ai-backend.onrender.com/docs

---

## What it does

A teacher can upload:

- Question paper
- Student answer paper
- Model answer / marking rubric

Gradent AI then:

1. Validates and stores the uploaded files
2. Extracts the student's answer page-by-page
3. Handles both typed and handwritten/scanned pages
4. Evaluates the answer against the marking rubric using Google Gemini
5. Validates the model output using deterministic backend rules
6. Maps grading decisions to evidence in the student's answer
7. Generates editable annotations
8. Persists the grading session and review state
9. Exports a separate annotated PDF

---

## Key Features

### AI-Assisted Grading

The student answer is evaluated against the teacher's marking rubric rather than a fixed answer template.

Each criterion can contain:

- Marks awarded
- Maximum marks
- Status
- Explanation
- Feedback
- Correction where applicable
- Confidence
- Evidence references

### Typed and Handwritten Support

The extraction pipeline operates page-by-page.

For digitally generated PDFs, **PyMuPDF** extracts the native text and its position on the page.

If a page does not contain enough meaningful machine-readable text, it is routed to **Gemini Vision** for visual understanding of handwritten or scanned content.

Both extraction paths are converted into the same `TextBlock` representation, allowing the downstream grading pipeline to remain consistent.

### Explainable Grading

Every grading decision can be connected back to evidence from the student's answer.

The system uses evidence references to connect:

```text
AI grading decision
        ↓
Evidence block
        ↓
Page + bounding box
        ↓
Annotation on answer sheet

```

### Deterministic Validation

The LLM is not trusted for the final score.

The backend validates:

Rubric criterion IDs
Maximum marks
Awarded marks
Evidence references
Confidence scores
Missing criteria

The final score is calculated by the backend from the validated criterion scores.

### Human Review 

The system can flag evaluations when there is genuine uncertainty, such as:

Low confidence
Invalid evidence references
Missing rubric criteria
Invalid score ranges
Extraction uncertainty
Model or API failures

This provides a clear path for teacher review instead of silently accepting uncertain results.

### Editable Annotations

Teachers can:

Review annotations
Add annotations
Edit feedback
Move annotations
Delete annotations

Annotation changes do not require re-running the AI grading step.

### Persistent History

Grading sessions are stored in SQLite, including:

Submission information
Extracted text blocks
Criterion-level results
Score
Confidence
Review status
Annotations

Previous grading sessions can be reopened after a refresh or backend restart.

### Separate PDF Export

The original student answer paper is never modified.

Instead, the system creates a separate annotated copy:

```text
Original Student PDF
        +
Current Annotation State
        ↓
Annotated PDF
```

---

## Authentication & Security

Gradent AI features a secure, full-stack authentication system:

- **Password Security**: Passwords are hashed using **Argon2id** (`argon2-cffi`) with secure salt and memory-hard computational parameters. Plaintext passwords are never logged or stored.
- **Session Management**: Authenticated sessions use cryptographically random opaque tokens (`secrets.token_urlsafe(32)`).
  - Stored safely as **SHA-256 hashes** in the database (`user_sessions` table).
  - Transmitted via **`HttpOnly`** cookies (`gradent_session`) with `SameSite=lax` (and `Secure=True` in production), mitigating XSS token theft.
  - Revocable on logout or upon password change.
  - Automatic expiration handling (default 7 days).
- **CORS & Credentials**: Configured with explicit trusted origins (`http://localhost:5173`, `http://127.0.0.1:5173`, etc.) to support secure credentialed cookie transactions.
- **Frontend State & Guards**: Centrally managed via `AuthContext` with automatic session validation on page refresh and client-side route protection (`<ProtectedRoute>`).
- **Profile Management**: Evaluators can view account details, update permitted profile fields (full name), and securely update passwords with current password verification.
- **Distinction Between Authentication & Authorisation**:
  - *Authentication* identifies the evaluator and secures account access.
  - *Authorisation* (associating specific student grading sessions and exports with user IDs) is structured for subsequent multi-tenant isolation without breaking existing grading pipelines.


---


## Architecture

Gradent AI is organized into an API layer, service layer, core processing layer, persistence layer, and frontend.

```text

                         GRADENT AI
                              |
                              v
                    React + Vite Frontend
                              |
                         HTTP Request
                              |
                              v
                       FastAPI API Layer
                              |
             +----------------+----------------+
             |                |                |
             v                v                v
        grading.py       history.py      annotations.py
             |
             v
      grading_service.py
             |
             v
        extractor.py
             |
        +----+-------------------+
        |                        |
        v                        v
     PyMuPDF            vision_extractor.py
                                 |
                           Gemini Vision
        |                        |
        +------------+-----------+
                     |
                     v
                 TextBlocks
                     |
                     v
             grader.grade(...)
                     |
              +------+------+
              |             |
              v             v
         MockGrader    GeminiGrader
                             |
                             v
                    gemini_service.py
                             |
                             v
                        Gemini API
                             |
                             v
                    LLMGradingOutput
                             |
                             v
                        validator.py
                             |
                             v
                  ValidatedGradingResult
                             |
                             v
                   evidence_resolver.py
                             |
                             v
                        Annotations
                             |
                             v
                       SQLite Database
                             |
                +------------+------------+
                |                         |
                v                         v
             History                 Teacher Review
                                          |
                                          v
                                      export.py
                                          |
                                          v
                                  pdf_exporter.py
                                          |
                                          v
                                   Annotated PDF

```

---

## Data Flow

A simplified view of how data moves through the backend:

```text
Student PDF
     ↓
extractor.py
     ↓
ExtractedDocument
     ↓
TextBlocks
     ↓
grading_service.py
     ↓
GeminiGrader
     ↓
LLMGradingOutput
     ↓
validator.py
     ↓
ValidatedGradingResult
     ↓
evidence_resolver.py
     ↓
Annotations
     ↓
SQLite

```
--- 

## System Stack

| Layer | Technology |
| --- | --- |
| Frontend | React + Vite + TypeScript |
| Backend | Python + FastAPI |
| AI | Google Gemini API |
| Vision | Gemini Vision |
| PDF Processing | PyMuPDF |
| Validation | Pydantic + deterministic backend rules |
| ORM | SQLAlchemy |
| Database | SQLite |
| API Style | REST-style HTTP APIs |
| Deployment | Vercel + Render |

--- 

## Reliability

Gradent AI is designed so that AI output is not treated as the final source of truth.

```text
LLM
 ↓
Structured Output
 ↓
Deterministic Validation
 ↓
Score Calculation
 ↓
Evidence Verification
 ↓
Human Review when necessary
```

The system flags cases such as:

Invalid rubric references
Missing criteria
Invalid evidence references
Scores outside allowed bounds
Low-confidence evaluations
Extraction uncertainty
API or model failures

The backend independently calculates the final score from validated criterion-level scores.

---

## Testing 

The backend includes tests covering:

Fully correct answers
Partially correct answers
Incorrect answers
Blank submissions
OCR-like spelling errors
Malformed model output
Incomplete model output
API and model failures
Invalid or excessive scores
Evidence resolution
Annotation persistence
PDF export
Typed PDF extraction
Handwritten/scanned extraction
Mixed typed and handwritten pages

The mock grader is used for deterministic tests where a controlled model response is required.

This allows the validation and application logic to be tested without depending on live LLM responses

--- 

## Design Principles

### AI for Semantic and Visual Understanding

Gemini handles tasks that require understanding student answers, handwritten content, and rubric-based evaluation.

### Deterministic Logic for Reliability

Score validation, score calculation, evidence verification, persistence, annotation handling, and export remain under backend control.

### Common Representation

Typed and handwritten pages are converted into the same `TextBlock` representation so the rest of the grading pipeline does not need separate logic.

### Separation of Concerns

* **API layer** — Handles HTTP
* **Services** — Handles workflows and external integrations
* **Core modules** — Handles processing and validation
* **Schemas** — Defines data contracts
* **Models** — Handles database persistence

### Original Files Remain Untouched

The original student answer paper is preserved, while annotations and exported results are handled separately.

---
## Setup & Installation

### Prerequisites

Make sure the following are installed:

- Python 3.10+
- Node.js 18+
- npm
- Git

### Clone the Repository

```bash
git clone https://github.com/sarvika/Gradent-AI.git
cd Gradent-AI
```

### Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Create and activate a virtual environment:

```bash
python -m venv venv
source venv/bin/activate
```

Install the Python dependencies:

```bash
pip install -r requirements.txt
```

Copy the environment variable template:

```cp .env.example .env
```

Update .env with the required configuration, including your Gemini API key.


Start the FastAPI server from the `backend/` directory:

```bash
uvicorn app.main:app --reload
```

The backend will be available at:

```text
http://127.0.0.1:8000
```

Swagger API documentation:

```text
http://127.0.0.1:8000/docs
```

Health check:

```text
http://127.0.0.1:8000/health
```

### Frontend Setup

Open a new terminal and navigate to the frontend:

```bash
cd frontend
```

Install the dependencies:

```bash
npm install
```

Create a `.env` file inside `frontend/`:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Start the development server:

```bash
npm run dev
```

The frontend will be available at:

```text
http://localhost:5173
```

### Running the Project

Both the backend and frontend need to be running:

```text
Frontend
http://localhost:5173
        ↓
FastAPI Backend
http://127.0.0.1:8000
        ↓
SQLite Database
app.db
```

The Gemini API key should only be configured on the backend and should never be exposed in the frontend.

---

## Future Improvements

Possible future improvements include:

* PostgreSQL for larger-scale deployments
* Object storage for uploaded PDFs
* Background processing for large grading batches
* Teacher score overrides and audit trails
* More robust OCR confidence handling
* Individual criterion regrading
* Multi-question and multi-student batch grading
* Better handling of visually complex answer sheets

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
