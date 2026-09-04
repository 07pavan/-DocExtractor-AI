"""LLM-Powered Document Extraction Pipeline with Dynamic Section Schemas.

Architecture:
  - Dynamic Variable-Length Section Nodes:
      Each section extracted by the LLM is emitted as:
      {
        "section_type": "<e.g. metadata | schedule | general | legal | fee>",
        "title": "<Section Title>",
        "fields": { "<field_key>": "<verbatim value>" },
        "confidence": <float 0.0 - 1.0>,
        "page": <int>,
        "text": "<verbatim body summary>",
        "tables": []
      }
"""

from __future__ import annotations

import json
import logging
import concurrent.futures
from typing import Dict, Any, List, Optional, Tuple, Union

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
                # Automatic OCR fallback for scanned pages / flattened images
                if len(text) < 25:
                    from extraction.ocr_fallback import extract_page_ocr_text
                    ocr_result = extract_page_ocr_text(page)
                    if ocr_result:
                        text = ocr_result

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
    max_total_chars: int = 7500,
) -> str:
    """Builds a token-efficient digest of the critical document sections."""
    total = len(page_texts)
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
# DYNAMIC GROUNDED SYSTEM PROMPT BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def _build_dynamic_system_prompt(
    doc_type: str,
    schema: Dict[str, Any],
) -> str:
    """Constructs the dynamic system prompt requiring variable-length sections array."""
    fields_desc = []
    for f in schema.get("fields", []):
        fields_desc.append(
            f'  - "{f["key"]}": ({f["label"]}) [{f["type"]}] -> If not explicitly found in text, MUST be null'
        )
    fields_text = "\n".join(fields_desc)

    return f"""You are a professional document analysis engine extracting structured data into a dynamic, variable-length section hierarchy.
Document Type: {doc_type} ({schema.get('display_name')})

CRITICAL GROUNDING RULES:
1. Extract values VERBATIM from the document text. Never invent, extrapolate, or guess values.
2. If a field is not found in the text, you MUST output null for that field.
3. Every non-null field value in 'metadata' MUST cite its source:
   - source_page: integer page number where the value appears
   - source_text: exact substring quote (up to 50 chars) from that page
4. For 'sections', return a dynamic, variable-length list of sections representing every distinct topic or part found in the text.
   Each section object MUST strictly match:
   {{
     "section_type": "<e.g. metadata | general | filing_fees | correspondence | legal | schedule>",
     "title": "<Section Title>",
     "confidence": <float between 0.0 and 1.0>,
     "page": <integer page number>,
     "text": "<verbatim section text or summary>",
     "fields": {{ "<Field Name>": "<Verbatim Value>" }},
     "tables": []
   }}
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
      "section_type": "metadata",
      "title": "Filing at a Glance",
      "confidence": 0.98,
      "page": 1,
      "text": "Verbatim summary of filing parameters...",
      "fields": {{
        "Company": "New York Life Insurance Company",
        "State": "Montana",
        "Tracking Number": "NYLM-134614243"
      }},
      "tables": []
    }}
  ]
}}

RESPOND WITH ONLY THE JSON OBJECT. NO PREAMBLE. NO EXPLANATION."""


def dynamic_grounded_llm_extraction(
    doc_type: str,
    schema: Dict[str, Any],
    full_digest: str,
    tables_text: str,
    doc_title: str,
    total_pages: int,
) -> Dict[str, Any]:
    """Calls the LLM with dynamic variable-length section schema."""
    system_prompt = _build_dynamic_system_prompt(doc_type, schema)

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
    """Two-pass grounded extraction pipeline producing dynamic variable-length section hierarchy."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    total_pages = len(doc)
    doc.close()

    if total_pages == 0:
        return SectionNode(heading="Document", level=0, page=1).to_dict()

    # ── Step 1: Parallel extraction of 100% of pages + tables ─────────────────
    page_texts, detected_tables = parallel_extract_full_text_and_tables(
        pdf_bytes=pdf_bytes,
        batch_size=15,
        max_workers=6,
    )

    # ── Step 2: Document classification (NO LLM — pure regex signal matching) ─
    classification = classify_document(page_texts, max_pages=5)
    doc_type = classification["doc_type"]
    schema = get_schema(doc_type)

    # ── Step 3: Build page digest ─────────────────────────────────────────────
    full_digest = build_full_page_digest(page_texts, max_total_chars=7500)

    tables_lines: List[str] = []
    for idx, t in enumerate(detected_tables[:10], start=1):
        preview = t.get("rows", [])[:2]
        tables_lines.append(
            f"Table #{idx} (Page {t.get('page', 1)}, {len(t.get('rows', []))} rows): {json.dumps(preview)}"
        )
    tables_text = "\n".join(tables_lines)

    # ── Step 4: Grounded Dynamic LLM extraction ──────────────────────────────
    llm_result = {}
    try:
        llm_result = dynamic_grounded_llm_extraction(
            doc_type=doc_type,
            schema=schema,
            full_digest=full_digest,
            tables_text=tables_text,
            doc_title=filename,
            total_pages=total_pages,
        )
    except Exception as exc:
        logger.error("Dynamic LLM extraction failed: %s", str(exc))
        llm_result = {}

    if not isinstance(llm_result, dict):
        llm_result = {}

    # ── Step 5: Consolidate multi-page / landscape schedule tables ────────────
    consolidated_tables = consolidate_schedule_tables(detected_tables)

    # ── Step 6: Assemble final dynamic document structure ────────────────────
    metadata_raw = llm_result.get("metadata", {})
    source_evidence = llm_result.get("source_evidence", {})
    raw_sections: List[Dict[str, Any]] = llm_result.get("sections", [])

    # Format dynamic sections with backward and forward compatibility
    normalized_sections: List[Dict[str, Any]] = []
    for sec in raw_sections:
        title = sec.get("title") or sec.get("heading") or "Section"
        section_type = sec.get("section_type") or "general"
        confidence = float(sec.get("confidence", 0.95))
        page = int(sec.get("page", 1))
        text = sec.get("text") or ""
        raw_fields = sec.get("fields", {})

        # Normalize fields to list of {label, value} objects for UI compatibility
        fields_list: List[Dict[str, str]] = []
        if isinstance(raw_fields, dict):
            for k, v in raw_fields.items():
                fields_list.append({"label": str(k), "value": str(v) if v is not None else ""})
        elif isinstance(raw_fields, list):
            fields_list = raw_fields

        normalized_sections.append({
            "section_type": section_type,
            "title": title,
            "heading": title,
            "confidence": confidence,
            "level": sec.get("level", 1),
            "page": page,
            "text": text,
            "fields": fields_list,
            "raw_fields_dict": raw_fields if isinstance(raw_fields, dict) else {},
            "tables": sec.get("tables", []),
            "subsections": sec.get("subsections", []),
        })

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
            "section_type": "schedule",
            "title": "Master Form & Document Schedules (All Pages)",
            "heading": "Master Form & Document Schedules (All Pages)",
            "confidence": 1.0,
            "level": 1,
            "page": 1,
            "text": "Consolidated structured schedule items extracted across all document pages.",
            "fields": [],
            "tables": consolidated_tables,
            "subsections": [],
        }
        insert_pos = 1 if len(normalized_sections) > 1 else 0
        normalized_sections.insert(insert_pos, schedule_section)

    # Root document node
    root = {
        "heading": filename.replace(".pdf", ""),
        "level": 0,
        "page": 1,
        "text": "",
        "fields": [],
        "sections": normalized_sections,
        "subsections": normalized_sections,
        "summary": summary_block,
    }

    return root
