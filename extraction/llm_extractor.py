"""LLM-Powered Document Extraction Pipeline.
Generic, prompt-driven extraction with dynamic sections and zero hardcoded schemas.
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
from extraction.llm_client import llm_client

logger = logging.getLogger("extraction.llm_extractor")


def process_page_chunk(pdf_bytes: bytes, page_indices: List[int]) -> Dict[str, Any]:
    """Thread-safe worker: extracts raw text + vector tables for the given pages."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    chunk_texts: List[Dict[str, Any]] = []
    chunk_tables: List[Dict[str, Any]] = []

    try:
        for idx in page_indices:
            if idx < len(doc):
                page = doc[idx]
                page_num = idx + 1
                text = page.get_text().strip()

                if len(text) < 25:
                    from extraction.ocr_fallback import extract_page_ocr_text
                    ocr_result = extract_page_ocr_text(page)
                    if ocr_result:
                        text = ocr_result

                tables = detect_tables(page, page_num=page_num, pdf_bytes=pdf_bytes)
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
    """Extracts raw text and tables across all pages concurrently."""
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


def build_full_page_digest(
    page_texts: List[Dict[str, Any]],
    max_total_chars: int = 7500,
) -> str:
    """Builds a token-efficient digest of document pages for LLM context."""
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
            line.strip()
            for line in text.splitlines()
            if line.strip() and not line.strip().isdigit()
        ]
        page_content = "\n".join(cleaned_lines)[:1000]

        part = f"--- [PAGE {page_num} of {total}] ---\n{page_content}"
        if total_chars + len(part) > max_total_chars:
            break
        parts.append(part)
        total_chars += len(part)

    return "\n\n".join(parts)


SYSTEM_PROMPT_TEMPLATE = """You are an intelligent document extraction engine.
Analyze the provided document text and extract structured information dynamically without assuming any rigid schema.

CRITICAL INSTRUCTIONS:
1. Extract verbatim data directly from the text. Never hallucinate or invent values.
2. Produce a dynamic list of sections covering the topics and content in the document.
3. Extract key metadata properties as a flat dictionary under 'metadata'.
4. Provide a 2-3 sentence overview summary of the document.

REQUIRED JSON FORMAT:
{
  "doc_type": "<inferred document type or category>",
  "overview": "<2-3 sentence factual summary>",
  "metadata": {
    "<Key Name>": "<Verbatim Value>"
  },
  "key_points": [
    "<Key takeaway 1>",
    "<Key takeaway 2>"
  ],
  "sections": [
    {
      "section_type": "general",
      "title": "<Section Title>",
      "page": 1,
      "text": "<Verbatim content or summary>",
      "fields": {
        "<Field Label>": "<Field Value>"
      },
      "tables": []
    }
  ]
}

RESPOND WITH ONLY VALID JSON."""


def extract_with_llm(pdf_bytes: bytes, filename: str = "document.pdf") -> Dict[str, Any]:
    """Dynamic LLM extraction pipeline producing structured sections and metadata."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    total_pages = len(doc)
    doc.close()

    if total_pages == 0:
        return SectionNode(heading="Document", level=0, page=1).to_dict()

    page_texts, detected_tables = parallel_extract_full_text_and_tables(
        pdf_bytes=pdf_bytes,
        batch_size=15,
        max_workers=6,
    )

    full_digest = build_full_page_digest(page_texts, max_total_chars=7500)

    tables_preview = []
    for idx, t in enumerate(detected_tables[:10], start=1):
        tables_preview.append(
            f"Table #{idx} (Page {t.get('page', 1)}, {len(t.get('rows', []))} rows): {json.dumps(t.get('rows', [])[:2])}"
        )
    tables_text = "\n".join(tables_preview)

    user_prompt = (
        f"Document Name: {filename}\n"
        f"Total Pages: {total_pages}\n\n"
        f"DOCUMENT TEXT:\n"
        f"{full_digest}\n\n"
        f"DETECTED TABLES:\n"
        f"{tables_text if tables_text else 'None'}"
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT_TEMPLATE},
        {"role": "user", "content": user_prompt},
    ]

    llm_result: Dict[str, Any] = {}
    if llm_client.is_available():
        try:
            response_text = llm_client.generate_chat_completion(
                messages, json_mode=True, max_tokens=3500
            )
            if response_text:
                try:
                    from json_repair import repair_json
                    repaired = repair_json(response_text, return_objects=True)
                    if isinstance(repaired, dict):
                        llm_result = repaired
                except Exception:
                    llm_result = json.loads(response_text)
        except Exception as exc:
            logger.warning("LLM extraction call failed: %s", exc)

    raw_sections: List[Dict[str, Any]] = llm_result.get("sections", [])
    normalized_sections: List[Dict[str, Any]] = []

    for sec in raw_sections:
        title = sec.get("title") or sec.get("heading") or "Section"
        section_type = sec.get("section_type") or "general"
        page = int(sec.get("page", 1))
        text = sec.get("text") or ""
        raw_fields = sec.get("fields", {})

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
            "level": sec.get("level", 1),
            "page": page,
            "text": text,
            "fields": fields_list,
            "tables": sec.get("tables", []),
            "subsections": sec.get("subsections", []),
        })

    summary_block = {
        "doc_type": llm_result.get("doc_type", "General Document"),
        "overview": llm_result.get("overview") or f"Document extracted: {filename} ({total_pages} pages).",
        "key_points": llm_result.get("key_points", []),
        "metadata": llm_result.get("metadata", {}),
    }

    return {
        "heading": filename.replace(".pdf", ""),
        "level": 0,
        "page": 1,
        "text": "",
        "fields": [],
        "sections": normalized_sections,
        "subsections": normalized_sections,
        "tables": detected_tables,
        "summary": summary_block,
    }
