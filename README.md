# PDF Heading & Body Extraction Engine

A standalone, framework-free Python module for extracting hierarchical document structure (Headings, Subsections, Body Text, and Key-Value Fields) directly from raw PDF bytes using PyMuPDF (`fitz`).

---

## 🚀 Features

- **Framework-Free & In-Memory**: Takes raw `bytes` input (`pdf_bytes: bytes`) and has zero web or database dependencies.
- **Dynamic Font Heuristics**: Computes document-wide median font size across all spans before scoring.
- **Multi-Factor Heading Scoring**: Classifies lines based on relative font size, font weight (bold), line length, surrounding whitespace margins, and numbering/casing cues.
- **Boilerplate Filtering**: Automatically detects repeating headers, footers, and page numbers across pages and excludes them from output.
- **Structured Field Extraction**: Extracts `"Label: Value"` pairs (e.g. `Company: Acme Insurance`) into separate structured dictionaries while preserving body paragraphs.
- **Hierarchical Nesting**: Uses a stack-based algorithm where any heading of level $N$ nests under the most recent heading of level $< N$.

---

## 📁 Project Structure

```
.
├── extraction/
│   ├── __init__.py           # Package exports
│   ├── parser.py             # Public extract_document() entrypoint and tree builder
│   ├── heading_detector.py   # PyMuPDF line extraction, scoring heuristics, and level clustering
│   ├── field_parser.py       # "Label: Value" field extraction
│   └── models.py             # SectionNode, FieldItem, and internal line representations
├── tests/
│   ├── test_parser.py        # Pytest test suite with indented visual tree logger
│   └── sample_pdfs/          # Directory to drop sample PDF files for testing
├── requirements.txt          # Pinned dependencies (pymupdf, pytest)
└── README.md                 # Documentation
```

---

## 📦 Output Shape

`extract_document(pdf_bytes: bytes) -> dict` returns a nested dictionary with the following schema:

```json
{
  "heading": "CUSTOMER ACCOUNT STATEMENT",
  "level": 1,
  "page": 1,
  "text": "This statement summarizes all account activities for the fiscal quarter.",
  "fields": [],
  "subsections": [
    {
      "heading": "1. Policyholder Information",
      "level": 2,
      "page": 1,
      "text": "",
      "fields": [
        { "label": "Company", "value": "American General Life Insurance Company" },
        { "label": "Policy Number", "value": "POL-9982341" },
        { "label": "Primary Insured", "value": "Johnathan Doe" },
        { "label": "Effective Date", "value": "2024-01-15" }
      ],
      "subsections": [
        {
          "heading": "Coverage Details",
          "level": 3,
          "page": 1,
          "text": "Standard benefits apply according to schedule B of the master agreement.",
          "fields": [
            { "label": "Plan Type", "value": "Comprehensive Term Life" },
            { "label": "Coverage Amount", "value": "$1,000,000" }
          ],
          "subsections": []
        }
      ]
    }
  ]
}
```

---

## 🧠 How the Heading Scoring Heuristic Works

The heading detector evaluates every non-repeating line in the PDF and calculates a composite **Heading Score** based on five key visual and layout signals:

### 1. Relative Font Size ($\frac{\text{Line Font Size}}{\text{Document Median Font Size}}$)
- First, the engine scans all text spans across the entire document and calculates the global **median font size** (typically 9pt–11pt for standard body text).
- Lines significantly larger than median receive substantial positive weight:
  - $\ge 1.5\times$ median: `+5.5` points
  - $\ge 1.3\times$ median: `+4.0` points
  - $\ge 1.15\times$ median: `+2.5` points
  - $\ge 1.05\times$ median: `+1.0` point
  - $< 0.90\times$ median (small footnotes, legalese): `-3.0` points penalty.

### 2. Bold Font Weight
- Bold spans (detected via MuPDF font flags and font family name containing `bold`, `black`, `heavy`, etc.) add `+2.5` points. This allows section titles at body font size to be identified.

### 3. Line Length & Density
- Headings are typically concise titles.
  - $\le 35$ characters: `+2.5` points
  - $\le 65$ characters: `+1.5` points
  - $> 95$ characters: `-1.5` points
  - $\ge 130$ characters (wrapped body sentences): `-3.5` points penalty.

### 4. Standalone Whitespace & Vertical Margins
- The engine calculates the vertical gap above ($\text{margin\_top}$) and below ($\text{margin\_bottom}$) relative to the line's bounding box height.
- Significant vertical breathing room (e.g. above $\ge 0.8\times$ line height, below $\ge 0.6\times$ line height) adds `+1.5` and `+1.0` points.

### 5. Syntactic and Capitalization Cues
- Numbered patterns (e.g. `1.`, `1.1`, `Section 2`, `Part A`): `+2.0` points.
- All-Caps / Title-Case text: `+1.2` / `+0.8` points.
- Sentence-ending periods on multi-word lines: `-2.5` points penalty.

### Boilerplate & Header/Footer Exclusion
- Any line whose normalized text and rounded bounding-box position repeats identically across multiple pages (or matches standard standalone page numbers) is flagged as boilerplate and excluded entirely from heading and body classification.

### Level Clustering (H1, H2, H3...)
- Detected headings are grouped by their visual weights (font size + weight boost) and clustered into discrete level buckets ($H1=1, H2=2, H3=3\dots$).

---

## 🛠️ Installation & Running Tests

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run Tests
To test heading detection and view the visual indented tree for all PDFs in `tests/sample_pdfs/`:

```bash
pytest -v -s
```

### 3. Adding Your Own PDFs
Simply drop your `.pdf` files into `tests/sample_pdfs/` and run `pytest -v -s`. The test runner will automatically discover each PDF and print the extracted hierarchy.

---

## 🌐 FastAPI HTTP Backend (with Supabase Auth & Persistence)

An authenticated HTTP API layer wraps the extraction engine and persists documents and extractions to Supabase Postgres.

### 1. Environment Configuration
Copy `.env.example` to `.env` in the project root:
```bash
cp .env.example .env
```
Fill in your Supabase credentials:
- `SUPABASE_URL`: Your Supabase Project URL (e.g. `https://xyz.supabase.co`)
- `SUPABASE_SERVICE_KEY`: Service role secret key (backend-only, used for database writes)
- `SUPABASE_JWT_SECRET`: Supabase JWT secret (used to verify Bearer tokens issued by Supabase Auth)

> [!NOTE]
> **Authentication Flow**: The FastAPI backend verifies JWTs but never issues them. User authentication (login/signup) occurs client-side via Supabase Auth in the frontend, which sends the resulting JWT token in the `Authorization: Bearer <token>` header.

### 2. Install API Dependencies
```bash
pip install -r api/requirements.txt
```

### 3. Run API Server Locally
```bash
uvicorn api.main:app --reload
```
The server will start on `http://127.0.0.1:8000`.

### 4. Interactive Documentation (Swagger UI)
Open **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)** in your browser for interactive endpoint testing, bearer token authorization, and OpenAPI schema.

### 5. API Endpoints Overview

| Method | Endpoint | Auth Required | Description |
|---|---|:---:|---|
| `GET` | `/health` | No | Liveness probe returning `{"status": "ok"}` |
| `POST` | `/extract` | **Yes** | Extracts headings/body/fields and saves to Postgres, returning extraction JSON + `document_id` |
| `GET` | `/documents` | **Yes** | Returns user's document list (`id`, `filename`, `uploaded_at`), most recent first |
| `GET` | `/documents/{id}` | **Yes** | Returns full extraction hierarchy for a document owned by the user (or 404) |

### 6. Test Endpoints via `curl`

#### Unauthenticated Health Check
```bash
curl http://127.0.0.1:8000/health
```

#### Authenticated Extract & Persist
```bash
curl -X POST "http://127.0.0.1:8000/extract" \
  -H "Authorization: Bearer <YOUR_SUPABASE_JWT>" \
  -F "document=@tests/sample_pdfs/sample_policy_statement.pdf"
```

#### Authenticated List User Documents
```bash
curl http://127.0.0.1:8000/documents \
  -H "Authorization: Bearer <YOUR_SUPABASE_JWT>"
```

#### Authenticated Get Document Details
```bash
curl http://127.0.0.1:8000/documents/<DOCUMENT_ID> \
  -H "Authorization: Bearer <YOUR_SUPABASE_JWT>"
```

---

## 💻 Frontend (Vite + React + Tailwind CSS + Supabase Auth)

A single-page React frontend protected with Supabase Authentication for uploading PDFs, saving extractions, and viewing uploaded document history.

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment Variables
Copy `frontend/.env.example` to `frontend/.env`:
```bash
cp frontend/.env.example frontend/.env
```
Fill in the following variables:
- `VITE_API_URL`: URL of the running FastAPI backend (defaults to `http://localhost:8000`).
- `VITE_SUPABASE_URL`: Your Supabase Project URL (`https://xyz.supabase.co`).
- `VITE_SUPABASE_ANON_KEY`: Your Supabase `anon` public key (used for client-side authentication).

> [!NOTE]
> **Email Confirmation**: Email confirmation is disabled for this Supabase project, so newly registered users can log in immediately after signup without verifying their email address.

### 3. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.
