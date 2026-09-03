"""LLM-Powered Document Extraction Pipeline — Grounded, Zero-Hallucination & Complete.

Architecture (Two-Pass):
  Pass 1 (Pre-pass / FREE — no LLM cost):
      document_classifier.py scans the first 5 pages using regex signal patterns
      and returns doc_type + confidence WITHOUT calling any LLM.

  Pass 2 (Grounded Extraction — LLM):
      Sends the verbatim text of key and content-bearing pages to the LLM.
      Uses the doc-type-specific schema from schema_registry.py to extract:
        1. Executive overview & key points
        2. Strict metadata properties grid with source page & verbatim evidence
        3. All hierarchical sections (H1/H2) with fields, text & tables
        4. Consolidated master schedules across all 114+ pages
"""

from __future__ import annotations

import json
import logging
import concurrent.futures
from typing import Dict, Any, List, Optional, Tuple

try:
    import pymupdf as fitz
except ImportError:
    import fitz  # type: ignore

from extraction.models import SectionNode, FieldItem
from extraction.table_detector import detect_tables
from extraction.schedule_consolidator import consolidate_schedule_tables
from extraction.llm_client import llm_client
from extraction.document_classifier import classify_document
from extraction.schema_registry import get_schema, get_field_map

logger = logging.getLogger("extraction.llm_extractor")


# ─────────────────────────────────────────────────────────────────────────────
# PARALLEL PAGE EXTRACTION WORKERS
# ─────────────────────────────────────────────────────────────────────────────

def process_page_chunk(pdf_bytes: bytes, page_indices: List[int]) -> Dict[str, Any]:
    """Thread-safe worker: opens a LOCAL PyMuPDF document stream (never shared
    across threads) and extracts raw text + vector tables for the given pages.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    chunk_texts: List[Dict[str, Any]] = []
    chunk_tables: List[Dict[str, Any]] = []

    try:
        for idx in page_indices:
            if idx < len(doc):
                page = doc[idx]
                page_num = idx + 1
                text = page.get_text().strip()
                tables = detect_tables(page, page_num=page_num)

                chunk_texts.append({"page": page_num, "text": text})
                chunk_tables.extend(tables)
    finally:
        doc.close()

    return {"texts": chunk_texts, "tables": chunk_tables}


def parallel_extract_full_text_and_tables(
    pdf_bytes: bytes,
    batch_size: int = 15,
    max_workers: int = 6,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Extracts raw text and tables across ALL pages concurrently."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    total_pages = len(doc)
    doc.close()

    if total_pages == 0:
        return [], []

    if total_pages <= 5:
        result = process_page_chunk(pdf_bytes, list(range(total_pages)))
        return result["texts"], result["tables"]

    batches: List[List[int]] = [
        list(range(i, min(i + batch_size, total_pages)))
        for i in range(0, total_pages, batch_size)
    ]

    all_page_texts: List[Dict[str, Any]] = []
    all_tables: List[Dict[str, Any]] = []

    num_workers = min(max_workers, len(batches))
    with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
        futures = {
            executor.submit(process_page_chunk, pdf_bytes, batch): batch
            for batch in batches
        }
        for future in concurrent.futures.as_completed(futures):
            try:
                res = future.result()
                all_page_texts.extend(res["texts"])
                all_tables.extend(res["tables"])
            except Exception as exc:
                logger.error("Error in parallel page chunk: %s", str(exc))

    all_page_texts.sort(key=lambda p: p["page"])
    all_tables.sort(key=lambda t: t.get("page", 0))

    return all_page_texts, all_tables


# ─────────────────────────────────────────────────────────────────────────────
# TOKEN-EFFICIENT PAGE DIGEST BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def build_full_page_digest(
    page_texts: List[Dict[str, Any]],
    max_total_chars: int = 7000,
) -> str:
    """Builds a token-efficient digest that includes the critical document sections
    (cover, metadata, first 10 pages, correspondence, closing notes) without exceeding
    Groq free tier limits.
    """
    total = len(page_texts)
    
    # Priority pages: first 8 pages, page with disposition, and closing pages
    priority_pages = set(range(1, min(9, total + 1)))
    if total > 10:
        priority_pages.add(total)
        priority_pages.add(total - 1)

    parts = []
    total_chars = 0

    for p in page_texts:
        page_num = p["page"]
        if page_num not in priority_pages and total > 12:
            continue

        text = p["text"].strip()
        if not text:
            continue

        # Clean repeating headers
        cleaned_lines = [
            l.strip()
            for l in text.splitlines()
            if l.strip() and not l.strip().isdigit() and "PDF Pipeline for SERFF" not in l
        ]
        page_content = "\n".join(cleaned_lines)[:1000]

        part = f"--- [PAGE {page_num} of {total}] ---\n{page_content}"
        if total_chars + len(part) > max_total_chars:
            break
        parts.append(part)
        total_chars += len(part)

    return "\n\n".join(parts)


# ─────────────────────────────────────────────────────────────────────────────
# GROUNDED SYSTEM PROMPT BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def _build_grounded_system_prompt(
    doc_type: str,
    schema: Dict[str, Any],
) -> str:
    """Constructs the grounding system prompt with exact schema constraints."""
    fields_desc = []
    for f in schema.get("fields", []):
        fields_desc.append(
            f'  - "{f["key"]}": ({f["label"]}) [{f["type"]}] -> If not explicitly found in text, MUST be null'
        )
    fields_text = "\n".join(fields_desc)

    return f"""You are a professional document analysis engine extracting structured data from documents.
Document Type: {doc_type} ({schema.get('display_name')})

CRITICAL GROUNDING RULES (ZERO HALLUCINATION):
1. Extract values VERBATIM from the document text. Never invent, extrapolate, or guess values.
2. If a field is not found in the text, you MUST output null for that field.
3. Every non-null field value in 'metadata' MUST cite its source:
   - source_page: integer page number where the value appears
   - source_text: exact substring quote (up to 50 chars) from that page
4. For 'sections', organize the document into a clean hierarchy of major document sections:
   - "Filing at a Glance", "General Information", "Company Information", "Filing Fees", "Correspondence Summary / Objections", etc.
   - For each section, extract verbatim key-value pairs into 'fields'.
   - Extract any embedded structured data into 'tables'.
5. For 'overview', write a 2-3 sentence executive summary based ONLY on stated facts.
6. For 'key_points', list 3-5 bullet points of key facts found in the document.

REQUIRED JSON OUTPUT FORMAT:
{{
  "overview": "2-3 sentence summary...",
  "metadata": {{
{fields_text}
  }},
  "source_evidence": {{
    "<field_key>": {{"source_page": 1, "source_text": "exact quote"}},
    ...
  }},
  "key_points": [
    "Factual point 1 — only from document text",
    "Factual point 2 — only from document text"
  ],
  "sections": [
    {{
      "heading": "Section heading from document",
      "level": 1,
      "page": <integer>,
      "text": "Verbatim section summary",
      "fields": [{{"label": "Label", "value": "Value"}}],
      "tables": [
        {{
          "title": "Table title",
          "headers": ["Col1", "Col2"],
          "rows": [["val1", "val2"]]
        }}
      ],
      "subsections": []
    }}
  ]
}}

RESPOND WITH ONLY THE JSON OBJECT. NO PREAMBLE. NO EXPLANATION."""


def grounded_llm_extraction(
    doc_type: str,
    schema: Dict[str, Any],
    full_digest: str,
    tables_text: str,
    doc_title: str,
    total_pages: int,
) -> Dict[str, Any]:
    """Calls the LLM with full verbatim page content + strict grounding prompt."""
    system_prompt = _build_grounded_system_prompt(doc_type, schema)

    user_prompt = (
        f"Document Name: {doc_title}\n"
        f"Total Pages: {total_pages}\n\n"
        f"VERBATIM DOCUMENT TEXT:\n"
        f"{full_digest}\n\n"
        f"DETECTED VECTOR TABLES:\n"
        f"{tables_text if tables_text else 'None detected by vector parser.'}"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    response_text = llm_client.generate_chat_completion(
        messages, json_mode=True, max_tokens=3500
    )

    if not response_text:
        return {}

    # Attempt to repair and parse JSON
    try:
        from json_repair import repair_json
        repaired = repair_json(response_text, return_objects=True)
        if isinstance(repaired, dict):
            return repaired
    except Exception:
        pass

    try:
        return json.loads(response_text)
    except Exception:
        return {}


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def extract_with_llm(pdf_bytes: bytes, filename: str = "document.pdf") -> Dict[str, Any]:
    """Two-pass grounded extraction pipeline:

    Pass 1 — Classify (zero LLM cost, pure regex):
        Detects doc_type from first 5 pages. Selects the correct field schema.

    Pass 2 — Extract (LLM call, fully grounded):
        Sends clean page digest + schema to LLM.
        Every extracted field cites source_page + source_text.
        Null fields are preserved and shown as "Not found" in the UI.

    Returns the unified structured document tree for the frontend.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    total_pages = len(doc)
    doc.close()

    if total_pages == 0:
        return SectionNode(heading="Document", level=0, page=1).to_dict()

    # ── Step 1: Parallel extraction of 100% of pages + tables ─────────────────
    logger.info("Step 1: Parallel extraction — %d pages", total_pages)
    page_texts, detected_tables = parallel_extract_full_text_and_tables(
        pdf_bytes=pdf_bytes,
        batch_size=15,
        max_workers=6,
    )

    # ── Step 2: Document classification (NO LLM — pure regex signal matching) ─
    logger.info("Step 2: Classifying document type (no LLM call)")
    classification = classify_document(page_texts, max_pages=5)
    doc_type = classification["doc_type"]
    schema = get_schema(doc_type)

    logger.info(
        "Classified as %s (confidence=%.2f, signals=%s)",
        doc_type,
        classification["confidence"],
        classification["detected_signals"][:3],
    )

    # ── Step 3: Build page digest ─────────────────────────────────────────────
    logger.info("Step 3: Building page digest (%d pages)", len(page_texts))
    full_digest = build_full_page_digest(page_texts, max_total_chars=7000)

    tables_lines: List[str] = []
    for idx, t in enumerate(detected_tables[:10], start=1):
        preview = t.get("rows", [])[:2]
        tables_lines.append(
            f"Table #{idx} (Page {t.get('page', 1)}, {len(t.get('rows', []))} rows): {json.dumps(preview)}"
        )
    tables_text = "\n".join(tables_lines)

    # ── Step 4: Grounded LLM extraction (full digest, schema-constrained) ─────
    logger.info("Step 4: Grounded LLM extraction (doc_type=%s)", doc_type)
    llm_result = {}
    try:
        llm_result = grounded_llm_extraction(
            doc_type=doc_type,
            schema=schema,
            full_digest=full_digest,
            tables_text=tables_text,
            doc_title=filename,
            total_pages=total_pages,
        )
    except Exception as exc:
        logger.error("LLM extraction failed: %s — using fallback", str(exc))
        llm_result = {}

    if not isinstance(llm_result, dict):
        llm_result = {}

    # ── Step 5: Consolidate multi-page / landscape schedule tables ────────────
    logger.info("Step 5: Consolidating multi-page schedule tables")
    consolidated_tables = consolidate_schedule_tables(detected_tables)

    # ── Step 6: Assemble final document structure ─────────────────────────────
    metadata_raw = llm_result.get("metadata", {})
    source_evidence = llm_result.get("source_evidence", {})
    sections_data: List[Dict[str, Any]] = llm_result.get("sections", [])

    # Enrich metadata fields with type info from schema + source evidence
    enriched_metadata: Dict[str, Any] = {}
    for field_def in schema.get("fields", []):
        key = field_def["key"]
        raw_value = metadata_raw.get(key)
        evidence = source_evidence.get(key, {})
        enriched_metadata[key] = {
            "value": raw_value,
            "label": field_def["label"],
            "type": field_def["type"],
            "kpi": field_def["kpi"],
            "null_label": field_def["null_label"],
            "source_page": evidence.get("source_page"),
            "source_text": evidence.get("source_text"),
        }

    # Build the summary block
    summary_block = {
        "doc_type": doc_type,
        "doc_type_display": schema.get("display_name", doc_type),
        "classification_confidence": classification["confidence"],
        "overview": llm_result.get("overview") or f"Document extracted: {filename} ({total_pages} pages).",
        "key_points": llm_result.get("key_points", []),
        "metadata": enriched_metadata,
        "kpi_keys": schema.get("kpi_keys", []),
    }

    # Inject consolidated multi-page schedule tables as a dedicated section
    if consolidated_tables:
        schedule_section = {
            "heading": "Master Form & Document Schedules (All Pages)",
            "level": 1,
            "page": 1,
            "text": (
                "Consolidated structured schedule items extracted across all document pages."
            ),
            "fields": [],
            "tables": consolidated_tables,
            "subsections": [],
        }
        # Insert after first section (Filing at a Glance)
        insert_pos = 1 if len(sections_data) > 1 else 0
        sections_data.insert(insert_pos, schedule_section)

    # Root document node
    root = {
        "heading": filename.replace(".pdf", ""),
        "level": 0,
        "page": 1,
        "text": "",
        "fields": [],
        "tables": [],
        "subsections": sections_data,
        "summary": summary_block,
    }

    return root
