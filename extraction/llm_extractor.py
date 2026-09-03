"""LLM-Powered Document Extraction Pipeline — Grounded, Zero-Hallucination & Ultra-Fast.

Architecture (Two-Pass):
  Pass 1 (Pre-pass / FREE — no LLM cost):
      document_classifier.py scans the first 5 pages using regex signal patterns
      and returns doc_type + confidence WITHOUT calling any LLM.

  Pass 2 (Grounded Extraction — LLM):
      Sends the verbatim text of key and summary-relevant pages in a compact,
      token-efficient digest (staying comfortably under Groq's token limits).
      Always falls back gracefully to deterministic heuristic extraction if LLM
      provider is unreachable.
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
from extraction.heading_detector import (
    extract_raw_lines_from_pdf,
    detect_and_mark_boilerplate,
    classify_lines,
)
from extraction.field_parser import extract_fields_from_body_lines

logger = logging.getLogger("extraction.llm_extractor")


# ─────────────────────────────────────────────────────────────────────────────
# PARALLEL PAGE EXTRACTION WORKERS
# ─────────────────────────────────────────────────────────────────────────────

def process_page_chunk(pdf_bytes: bytes, page_indices: List[int]) -> Dict[str, Any]:
    """Thread-safe worker: opens a LOCAL PyMuPDF document stream (never shared
    across threads) and extracts raw text + vector tables for the given pages.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    chunk_texts: Dict[int, str] = {}
    chunk_tables: List[Dict[str, Any]] = []

    try:
        for p_idx in page_indices:
            if p_idx >= len(doc):
                continue
            page = doc[p_idx]
            page_num = p_idx + 1

            # 1. Extract text
            text = page.get_text("text") or ""
            chunk_texts[page_num] = text

            # 2. Extract vector tables using table_detector (returns list of dicts)
            tables = detect_tables(page, page_num=page_num)
            for t in tables:
                chunk_tables.append(t)
    finally:
        doc.close()

    return {
        "texts": chunk_texts,
        "tables": chunk_tables,
    }


def parallel_extract_all_pages(
    pdf_bytes: bytes,
    total_pages: int,
    max_workers: int = 8,
) -> Tuple[Dict[int, str], List[Dict[str, Any]]]:
    """Extracts raw text and vector tables from ALL pages concurrently."""
    if total_pages <= 0:
        return {}, []

    # Partition page indices into chunks for workers
    chunk_size = max(1, (total_pages + max_workers - 1) // max_workers)
    chunks = [
        list(range(i, min(i + chunk_size, total_pages)))
        for i in range(0, total_pages, chunk_size)
    ]

    page_texts: Dict[int, str] = {}
    detected_tables: List[Dict[str, Any]] = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [
            executor.submit(process_page_chunk, pdf_bytes, chunk)
            for chunk in chunks
        ]
        for f in concurrent.futures.as_completed(futures):
            try:
                res = f.result()
                page_texts.update(res["texts"])
                detected_tables.extend(res["tables"])
            except Exception as e:
                logger.warning("Error processing page chunk: %s", str(e))

    # Sort tables by page number
    detected_tables.sort(key=lambda t: t.get("page", 0))
    return page_texts, detected_tables


# ─────────────────────────────────────────────────────────────────────────────
# TOKEN-EFFICIENT DIGEST BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def build_compact_page_digest(
    page_texts: Dict[int, str],
    total_pages: int,
    max_total_chars: int = 8000,
) -> str:
    """Builds a compact digest prioritizing front matter, summary, and closing pages."""
    priority_pages = [1, 2, 3]
    if total_pages > 5:
        priority_pages.extend([4, 5])
    if total_pages > 6:
        priority_pages.append(total_pages)

    unique_pages = sorted(list(set(p for p in priority_pages if p in page_texts)))
    chars_per_page = max(500, max_total_chars // len(unique_pages)) if unique_pages else 1000

    digest_parts: List[str] = []
    total_chars = 0

    for p in unique_pages:
        raw_text = page_texts.get(p, "").strip()
        if not raw_text:
            continue

        cleaned = "\n".join(
            line.strip()
            for line in raw_text.splitlines()
            if line.strip() and not line.strip().isdigit()
        )
        clipped = cleaned[:chars_per_page]

        part = f"--- [PAGE {p}] ---\n{clipped}"
        if total_chars + len(part) > max_total_chars:
            break
        digest_parts.append(part)
        total_chars += len(part)

    return "\n\n".join(digest_parts)


# ─────────────────────────────────────────────────────────────────────────────
# GROUNDED LLM PROMPT BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def _build_grounded_system_prompt(doc_type: str, schema: Dict[str, Any]) -> str:
    fields_desc = []
    for f in schema.get("fields", []):
        fields_desc.append(
            f'  - "{f["key"]}": ({f["label"]}) [{f["type"]}] -> If not explicitly found, MUST be null (anti-hallucination)'
        )
    fields_text = "\n".join(fields_desc)

    return f"""You are a high-speed, zero-hallucination document intelligence engine.
Analyze the provided document text for document archetype: {doc_type} ({schema.get('display_name')}).

CRITICAL ZERO-HALLUCINATION RULES:
1. Extract verbatim data from the text. NEVER fabricate or invent tracking numbers, dates, or values.
2. If a field is not explicitly present in the text, set its value to null.
3. For every non-null field, you MUST provide source evidence:
   "source_evidence": {{
     "<field_key>": {{"source_page": <int>, "source_text": "<exact verbatim quote up to 60 chars>"}}
   }}

Return STRICT JSON matching this exact structure:
{{
  "overview": "<2-3 sentence factual executive summary of the filing/contract>",
  "key_points": ["<Key factual point 1>", "<Key factual point 2>", "<Key factual point 3>"],
  "metadata": {{
    {fields_text}
  }},
  "source_evidence": {{
    "<field_key>": {{"source_page": 1, "source_text": "quote"}}
  }},
  "sections": [
    {{
      "heading": "<Section title>",
      "level": 1,
      "page": <page number>,
      "text": "<verbatim section text summary>",
      "fields": [{{"label": "<Field Name>", "value": "<Verbatim Value>"}}],
      "tables": []
    }}
  ]
}}"""


def grounded_llm_extraction(
    doc_type: str,
    schema: Dict[str, Any],
    compact_digest: str,
    tables_text: str,
    doc_title: str,
    total_pages: int,
) -> Dict[str, Any]:
    """Calls the LLM with token-efficient digest for sub-2-second inference on Groq."""
    system_prompt = _build_grounded_system_prompt(doc_type, schema)

    user_prompt = (
        f"Document: {doc_title} ({total_pages} pages)\n\n"
        f"VERBATIM TEXT DIGEST:\n{compact_digest}\n\n"
        f"DETECTED TABLES SUMMARY:\n{tables_text if tables_text else 'None'}"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    try:
        response_text = llm_client.generate_chat_completion(
            messages, json_mode=True, max_tokens=3000
        )
    except Exception as e:
        logger.warning("generate_chat_completion error: %s", str(e))
        return {}

    if not response_text:
        return {}

    # Attempt to parse JSON
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
# HEURISTIC FALLBACK TREE BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def _build_heuristic_section_tree(pdf_bytes: bytes, doc_title: str) -> List[Dict[str, Any]]:
    """Deterministic heuristic fallback when LLM is unavailable."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        raw_lines, median_font_size = extract_raw_lines_from_pdf(doc)
        detect_and_mark_boilerplate(raw_lines, num_pages=len(doc))
        processed_lines, _ = classify_lines(raw_lines, median_font_size)

        sections: List[Dict[str, Any]] = []
        current_node = {"heading": "Document Content", "level": 1, "page": 1, "text": "", "fields": [], "tables": []}
        body_lines: List[str] = []

        for line in processed_lines:
            if line.is_boilerplate:
                continue
            if line.is_heading:
                if body_lines:
                    fields, clean_text = extract_fields_from_body_lines(body_lines)
                    current_node["fields"] = [f.to_dict() for f in fields]
                    current_node["text"] = clean_text
                    sections.append(current_node)
                    body_lines = []
                current_node = {
                    "heading": line.text.strip(),
                    "level": line.heading_level or 1,
                    "page": line.page_num,
                    "text": "",
                    "fields": [],
                    "tables": [],
                }
            else:
                body_lines.append(line.text)

        if body_lines or current_node:
            fields, clean_text = extract_fields_from_body_lines(body_lines)
            current_node["fields"] = [f.to_dict() for f in fields]
            current_node["text"] = clean_text
            sections.append(current_node)

        return sections
    finally:
        doc.close()


# ─────────────────────────────────────────────────────────────────────────────
# MAIN MULTI-PASS EXTRACTION ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def extract_with_llm(pdf_bytes: bytes, filename: str = "document.pdf") -> Dict[str, Any]:
    """Full extraction pipeline with parallel page extraction, schema binding,
    consolidated schedule tables, and guaranteed fallback.
    """
    doc_meta = fitz.open(stream=pdf_bytes, filetype="pdf")
    total_pages = len(doc_meta)
    doc_meta.close()

    # ── Step 1: Parallel extraction of text & vector tables across all pages ──
    page_texts, detected_tables = parallel_extract_all_pages(
        pdf_bytes, total_pages=total_pages, max_workers=8
    )

    # ── Step 2: Zero-cost archetype classification ───────────────────────────
    # Format page_texts as list of dicts for classify_document
    page_items = [{"page": p, "text": t} for p, t in page_texts.items()]
    classification = classify_document(page_items)
    doc_type = classification["doc_type"]
    schema = get_schema(doc_type)

    # ── Step 3: Build compact token-efficient page digest ─────────────────────
    compact_digest = build_compact_page_digest(page_texts, total_pages=total_pages, max_total_chars=8000)

    tables_lines: List[str] = []
    for idx, t in enumerate(detected_tables[:5], start=1):
        preview = t.get("rows", [])[:2]
        tables_lines.append(
            f"Table #{idx} (Page {t.get('page', 1)}, {len(t.get('rows', []))} rows): {json.dumps(preview)}"
        )
    tables_text = "\n".join(tables_lines)

    # ── Step 4: Grounded LLM extraction ──────────────────────────────────────
    llm_result = {}
    try:
        llm_result = grounded_llm_extraction(
            doc_type=doc_type,
            schema=schema,
            compact_digest=compact_digest,
            tables_text=tables_text,
            doc_title=filename,
            total_pages=total_pages,
        )
    except Exception as exc:
        logger.warning("LLM extraction failed (%s). Using heuristic fallback.", str(exc))

    if not isinstance(llm_result, dict):
        llm_result = {}

    # ── Step 5: Consolidate multi-page / landscape schedule tables ────────────
    consolidated_tables = consolidate_schedule_tables(detected_tables)

    # ── Step 6: Assemble final document structure ─────────────────────────────
    metadata_raw = llm_result.get("metadata") or {}
    source_evidence = llm_result.get("source_evidence") or {}
    sections_data: List[Dict[str, Any]] = llm_result.get("sections") or []

    # If LLM didn't return sections, generate from PyMuPDF layout heuristics
    if not sections_data:
        sections_data = _build_heuristic_section_tree(pdf_bytes, filename)

    # Enrich metadata fields with type info from schema + source evidence
    enriched_metadata: Dict[str, Any] = {}
    for field_def in schema.get("fields", []):
        key = field_def["key"]
        raw_value = metadata_raw.get(key)
        evidence = source_evidence.get(key) or {}
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
        "classification_confidence": classification.get("confidence", 1.0),
        "overview": llm_result.get("overview") or f"Document extracted: {filename} ({total_pages} pages).",
        "key_points": llm_result.get("key_points") or [],
        "metadata": enriched_metadata,
        "kpi_keys": schema.get("kpi_keys") or [],
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
