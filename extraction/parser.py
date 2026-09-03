"""Main entry point for extracting hierarchical heading and body structure from PDF bytes.
"""

from __future__ import annotations
from typing import Dict, Any, List
try:
    import pymupdf as fitz
except ImportError:
    import fitz  # type: ignore

from extraction.models import SectionNode, FieldItem, LineInfo
from extraction.heading_detector import (
    extract_raw_lines_from_pdf,
    detect_and_mark_boilerplate,
    classify_lines,
)
from extraction.field_parser import extract_fields_from_body_lines


def build_section_tree(lines: List[LineInfo], doc_title: str = "Document") -> SectionNode:
    """Constructs a hierarchical SectionNode tree using stack-based nesting logic:

    A heading of level N becomes a subsection of the most recent heading with level < N.
    """
    root = SectionNode(
        heading=doc_title,
        level=0,
        page=1,
        text="",
        fields=[],
        subsections=[],
    )

    # Stack holds (SectionNode, list of raw body line strings)
    # Start with root on the stack
    stack: List[tuple[SectionNode, List[str]]] = [(root, [])]

    for line in lines:
        if line.is_boilerplate:
            continue

        if line.is_heading:
            level = line.heading_level or 1

            # Pop the stack until we find a parent with level < current heading level
            while len(stack) > 1 and stack[-1][0].level >= level:
                finished_node, node_lines = stack.pop()
                fields, clean_text = extract_fields_from_body_lines(node_lines)
                finished_node.fields = fields
                finished_node.text = clean_text

            parent_node = stack[-1][0]
            new_node = SectionNode(
                heading=line.text.strip(),
                level=level,
                page=line.page_num,
                text="",
                fields=[],
                subsections=[],
            )
            parent_node.subsections.append(new_node)
            stack.append((new_node, []))
        else:
            # Body line belongs to the currently active section on top of stack
            stack[-1][1].append(line.text)

    # Finalize remaining nodes on the stack
    while stack:
        node, node_lines = stack.pop()
        fields, clean_text = extract_fields_from_body_lines(node_lines)
        node.fields = fields
        node.text = clean_text

    return root


from extraction.llm_client import llm_client
from extraction.llm_extractor import extract_with_llm


def extract_document(
    pdf_bytes: bytes,
    filename: str = "document.pdf",
    use_llm: bool = True,
) -> Dict[str, Any]:
    """Extracts hierarchical heading, body text, structured field pairs, and summaries

    from raw PDF bytes. If LLM keys are configured (Groq/OpenRouter), uses the LLM
    pipeline for enhanced borderless table extraction and executive summaries.
    """
    if not pdf_bytes:
        return SectionNode(
            heading="Document",
            level=0,
            page=1,
            text="",
            fields=[],
            subsections=[],
        ).to_dict()

    # If LLM is available and requested, run the multi-provider LLM extraction pipeline
    if use_llm and llm_client.is_available():
        try:
            return extract_with_llm(pdf_bytes, filename=filename)
        except Exception as exc:
            import logging
            logging.getLogger("extraction.parser").warning(
                "LLM extraction pipeline encountered error: %s. Falling back to PyMuPDF heuristic engine.",
                str(exc),
            )

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    try:
        if len(doc) == 0:
            return SectionNode(
                heading="Document",
                level=0,
                page=1,
                text="",
                fields=[],
                subsections=[],
            ).to_dict()

        # Step 1: Extract all text lines, spans, bounding boxes, and compute median font size
        raw_lines, median_font_size = extract_raw_lines_from_pdf(doc)

        # Step 2: Detect repeating header/footer boilerplate and exclude them
        detect_and_mark_boilerplate(raw_lines, num_pages=len(doc))

        # Step 3: Classify lines into headings (H1, H2, H3...) and body text
        processed_lines, _ = classify_lines(raw_lines, median_font_size)

        # Step 4: Build hierarchical nested section tree
        root_section = build_section_tree(processed_lines)

        # If root has exactly one top-level subsection and no loose text/fields of its own,
        # promote that subsection as the root of the tree
        if (
            len(root_section.subsections) == 1
            and not root_section.text.strip()
            and not root_section.fields
        ):
            return root_section.subsections[0].to_dict()

        return root_section.to_dict()

    finally:
        doc.close()
