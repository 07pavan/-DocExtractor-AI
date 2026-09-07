"""Table detection and extraction engine combining pdfplumber and PyMuPDF (fitz).
- pdfplumber: Superior for line-bordered grids, text-aligned tables, and cell content parsing.
- PyMuPDF: High-speed vector rectangle detection and bounding box coordinate mapping.
"""

from __future__ import annotations
import io
import logging
import re
from typing import List, Dict, Any, Optional

try:
    import pdfplumber
except ImportError:
    pdfplumber = None  # type: ignore

try:
    import pymupdf as fitz
except ImportError:
    import fitz  # type: ignore

logger = logging.getLogger("extraction.table_detector")


def clean_cell_text(val: Any) -> str:
    """Cleans and standardizes raw text from table cells."""
    if val is None:
        return ""
    text = str(val).strip()
    # Normalize multiple whitespace within lines
    text = re.sub(r"[ \t]+", " ", text)
    # Filter empty lines
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    return "\n".join(lines)


def detect_tables_from_bytes(pdf_bytes: bytes, page_num: int = 1) -> List[Dict[str, Any]]:
    """Extracts tables from specific page using pdfplumber with PyMuPDF fallback."""
    tables: List[Dict[str, Any]] = []

    # 1. Primary path: pdfplumber table extraction
    if pdfplumber is not None:
        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                if 0 <= page_num - 1 < len(pdf.pages):
                    page = pdf.pages[page_num - 1]
                    is_landscape = (page.width > page.height) if (page.width and page.height) else False

                    # Try line-based strategy first
                    found_tables = page.extract_tables({
                        "vertical_strategy": "lines",
                        "horizontal_strategy": "lines",
                        "snap_tolerance": 3,
                        "join_tolerance": 3,
                    })

                    # If no tables found via lines, fallback to default text-alignment strategy
                    if not found_tables:
                        found_tables = page.extract_tables()

                    for idx, raw_table in enumerate(found_tables, start=1):
                        cleaned_rows: List[List[str]] = []
                        for row in raw_table:
                            cleaned_row = [clean_cell_text(cell) for cell in row]
                            if any(cleaned_row):
                                cleaned_rows.append(cleaned_row)

                        if len(cleaned_rows) >= 2:
                            headers = cleaned_rows[0]
                            data_rows = cleaned_rows[1:]
                            tables.append({
                                "title": f"Table {idx} (Page {page_num})",
                                "headers": headers,
                                "rows": data_rows,
                                "bbox": [0.0, 0.0, float(page.width or 0), float(page.height or 0)],
                                "page": page_num,
                                "is_landscape": is_landscape,
                                "extraction_method": "pdfplumber",
                            })
        except Exception as err:
            logger.warning("pdfplumber table extraction error on page %s: %s", page_num, err)

    return tables


def detect_tables(page: fitz.Page, page_num: Optional[int] = None, pdf_bytes: Optional[bytes] = None) -> List[Dict[str, Any]]:
    """Detects tabular structures on a given page using pdfplumber or PyMuPDF.

    Args:
        page: PyMuPDF Page instance.
        page_num: Optional 1-indexed page number.
        pdf_bytes: Optional raw PDF bytes for pdfplumber extraction.

    Returns:
        List of detected tables with headers, rows, bounding box, and metadata.
    """
    if page_num is None:
        page_num = getattr(page, "number", 0) + 1

    rect = getattr(page, "rect", None)
    is_landscape = False
    if rect:
        is_landscape = rect.width > rect.height or getattr(page, "rotation", 0) in (90, 270)

    # 1. If pdf_bytes provided, attempt pdfplumber extraction first
    if pdf_bytes:
        plumber_tables = detect_tables_from_bytes(pdf_bytes, page_num=page_num)
        if plumber_tables:
            return plumber_tables

    # 2. PyMuPDF vector table parsing
    tables: List[Dict[str, Any]] = []
    if hasattr(page, "find_tables"):
        try:
            detected = page.find_tables()
            for idx, tab in enumerate(detected, start=1):
                raw_rows = tab.extract()
                if not raw_rows:
                    continue

                cleaned_rows: List[List[str]] = []
                for row in raw_rows:
                    cleaned_row = [clean_cell_text(cell) for cell in row]
                    if any(cleaned_row):
                        cleaned_rows.append(cleaned_row)

                if not cleaned_rows:
                    continue

                bbox = list(float(coord) for coord in tab.bbox)
                headers = cleaned_rows[0] if cleaned_rows else []
                data_rows = cleaned_rows[1:] if len(cleaned_rows) > 1 else cleaned_rows

                tables.append({
                    "title": f"Table {idx} (Page {page_num})",
                    "headers": headers,
                    "rows": data_rows,
                    "bbox": bbox,
                    "page": page_num,
                    "is_landscape": is_landscape,
                    "extraction_method": "pymupdf_vector",
                })
        except Exception as err:
            logger.warning("Error finding PyMuPDF vector tables on page %s: %s", page_num, err)

    return tables
