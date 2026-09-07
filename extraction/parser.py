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


from extraction.direct_section_extractor import extract_direct_sections_from_pdf


def extract_document(
    pdf_bytes: bytes,
    filename: str = "document.pdf",
    use_llm: bool = False,
) -> Dict[str, Any]:
    """Extracts hierarchical headings, structured key-value fields, paragraphs, and tables
    section-by-section directly from the PDF layout for verbatim fidelity.
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

    return extract_direct_sections_from_pdf(pdf_bytes, filename=filename)
