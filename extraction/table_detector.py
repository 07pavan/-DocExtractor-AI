"""Table detection and extraction module using PyMuPDF (fitz) find_tables().
Supports portrait, landscape, and rotated pages.
"""

from __future__ import annotations
from typing import List, Dict, Any, Optional
import re
try:
    import pymupdf as fitz
except ImportError:
    import fitz  # type: ignore


def clean_cell_text(val: Any) -> str:
    """Cleans raw table cell strings, collapsing multiple whitespace and formatting newlines."""
    if val is None:
        return ""
    text = str(val).strip()
    # Normalize excessive internal newlines while keeping readable words
    text = re.sub(r"[ \t]+", " ", text)
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    return "\n".join(lines)


def detect_tables(page: fitz.Page, page_num: Optional[int] = None) -> List[Dict[str, Any]]:
    """Detects and extracts tabular structures on a PyMuPDF page (portrait or landscape).

    Args:
        page: The PyMuPDF Page object.
        page_num: Optional 1-indexed page number (defaults to page.number + 1).

    Returns:
        List of dictionaries with the shape:
        [
            {
                "rows": [["Cell A1", "Cell B1"], ["Cell A2", "Cell B2"], ...],
                "bbox": [x0, y0, x1, y1],
                "page": int,
                "is_landscape": bool
            }
        ]
    """
    if page_num is None:
        page_num = getattr(page, "number", 0) + 1

    if not hasattr(page, "find_tables"):
        return []

    rect = getattr(page, "rect", None)
    is_landscape = False
    if rect:
        is_landscape = rect.width > rect.height or getattr(page, "rotation", 0) in (90, 270)

    try:
        tables_obj = page.find_tables()
    except Exception:
        return []

    results: List[Dict[str, Any]] = []

    for tab in tables_obj:
        raw_rows = tab.extract()
        if not raw_rows:
            continue

        cleaned_rows: List[List[str]] = []
        for row in raw_rows:
            cleaned_row = [clean_cell_text(cell) for cell in row]
            # Exclude completely empty rows
            if any(cleaned_row):
                cleaned_rows.append(cleaned_row)

        if not cleaned_rows:
            continue

        bbox = list(float(coord) for coord in tab.bbox)

        results.append({
            "rows": cleaned_rows,
            "bbox": bbox,
            "page": page_num,
            "is_landscape": is_landscape,
        })

    return results
