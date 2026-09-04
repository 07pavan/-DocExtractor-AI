"""Table detection and extraction module using PyMuPDF (fitz) find_tables(),
with coordinate-based positional word clustering fallback.
Supports portrait, landscape, and rotated pages.
"""

from __future__ import annotations
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
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
    text = re.sub(r"[ \t]+", " ", text)
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    return "\n".join(lines)


def detect_tables_positional_fallback(page: fitz.Page, page_num: int, is_landscape: bool) -> List[Dict[str, Any]]:
    """Positional fallback when page.find_tables() returns zero tables.
    
    1. Extracts word coordinates via page.get_text("words") -> (x0, y0, x1, y1, word, block_no, line_no, word_no).
    2. Clusters words into rows by y-coordinate proximity (within ~3px).
    3. Analyzes inter-word gaps across rows to determine consistent column boundaries.
    4. Groups words into columns for each row to form tabular structures.
    5. Returns candidate tables tagged with "extraction_method": "positional_fallback".
    """
    try:
        words = page.get_text("words")  # List of tuples: (x0, y0, x1, y1, word, ...)
    except Exception:
        return []

    if not words or len(words) < 6:
        return []

    # 1. Cluster words into rows by y-coordinate proximity (y0 / y1 center within ~3.0px)
    sorted_words = sorted(words, key=lambda w: (w[1], w[0]))
    
    row_clusters: List[List[Tuple]] = []
    for w in sorted_words:
        w_y0, w_y1 = w[1], w[3]
        w_mid_y = (w_y0 + w_y1) / 2.0

        placed = False
        for cluster in row_clusters:
            # Check proximity with the first word or average y in cluster
            c_y_mids = [(cw[1] + cw[3]) / 2.0 for cw in cluster]
            avg_mid = sum(c_y_mids) / len(c_y_mids)
            if abs(w_mid_y - avg_mid) <= 3.5:
                cluster.append(w)
                placed = True
                break

        if not placed:
            row_clusters.append([w])

    # Filter rows that have at least 2 distinct horizontal word clusters (columns)
    multi_col_rows: List[List[Tuple]] = []
    for r in row_clusters:
        r.sort(key=lambda w: w[0])  # sort left-to-right
        if len(r) >= 2:
            multi_col_rows.append(r)

    # Need at least 2 rows with multiple columns to form a table
    if len(multi_col_rows) < 2:
        return []

    # 2. Detect column boundaries from consistent x-positions across rows
    # Collect all start x0 coordinates
    x_starts = [w[0] for r in multi_col_rows for w in r]
    if not x_starts:
        return []

    # Cluster x_starts into distinct column left-alignments (within ~12px)
    x_starts.sort()
    col_anchors: List[float] = []
    for x in x_starts:
        if not col_anchors or (x - col_anchors[-1]) > 14.0:
            col_anchors.append(x)

    # If fewer than 2 distinct column anchors, not a table
    if len(col_anchors) < 2:
        return []

    # 3. Assemble rows into grid based on column anchors
    table_rows: List[List[str]] = []
    all_x0, all_y0, all_x1, all_y1 = float("inf"), float("inf"), 0.0, 0.0

    for r in multi_col_rows:
        col_cells = defaultdict(list)
        for w in r:
            x0, y0, x1, y1, word_text = w[0], w[1], w[2], w[3], w[4]
            all_x0 = min(all_x0, x0)
            all_y0 = min(all_y0, y0)
            all_x1 = max(all_x1, x1)
            all_y1 = max(all_y1, y1)

            # Assign word to the closest preceding or matching column anchor
            best_col_idx = 0
            for idx, c_x in enumerate(col_anchors):
                if x0 >= (c_x - 6.0):
                    best_col_idx = idx
                else:
                    break
            col_cells[best_col_idx].append(word_text)

        # Build row list with empty strings for missing columns
        num_cols = len(col_anchors)
        row_values = []
        for c_idx in range(num_cols):
            cell_words = col_cells.get(c_idx, [])
            row_values.append(clean_cell_text(" ".join(cell_words)))

        # Only include row if at least 2 columns have data
        non_empty = sum(1 for c in row_values if c.strip())
        if non_empty >= 2:
            table_rows.append(row_values)

    if len(table_rows) < 2:
        return []

    # Clean up empty columns across the entire table
    active_cols = [
        c_idx for c_idx in range(len(col_anchors))
        if any(r[c_idx].strip() for r in table_rows)
    ]
    if len(active_cols) < 2:
        return []

    cleaned_table_rows = [
        [r[c_idx] for c_idx in active_cols]
        for r in table_rows
    ]

    bbox = [
        round(all_x0, 2),
        round(all_y0, 2),
        round(all_x1, 2),
        round(all_y1, 2),
    ]

    return [{
        "title": f"Positional Schedule Table (Page {page_num})",
        "headers": cleaned_table_rows[0] if cleaned_table_rows else [],
        "rows": cleaned_table_rows[1:] if len(cleaned_table_rows) > 1 else cleaned_table_rows,
        "bbox": bbox,
        "page": page_num,
        "is_landscape": is_landscape,
        "extraction_method": "positional_fallback",
    }]


def detect_tables(page: fitz.Page, page_num: Optional[int] = None) -> List[Dict[str, Any]]:
    """Detects and extracts tabular structures on a PyMuPDF page (portrait or landscape).
    
    1. First tries PyMuPDF's vector table parser find_tables().
    2. If zero tables are found, runs detect_tables_positional_fallback() using word coordinates.
    """
    if page_num is None:
        page_num = getattr(page, "number", 0) + 1

    rect = getattr(page, "rect", None)
    is_landscape = False
    if rect:
        is_landscape = rect.width > rect.height or getattr(page, "rotation", 0) in (90, 270)

    results: List[Dict[str, Any]] = []

    # 1. Primary path: find_tables()
    if hasattr(page, "find_tables"):
        try:
            tables_obj = page.find_tables()
            for tab in tables_obj:
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

                results.append({
                    "title": f"Table (Page {page_num})",
                    "headers": cleaned_rows[0] if cleaned_rows else [],
                    "rows": cleaned_rows[1:] if len(cleaned_rows) > 1 else cleaned_rows,
                    "bbox": bbox,
                    "page": page_num,
                    "is_landscape": is_landscape,
                    "extraction_method": "find_tables",
                })
        except Exception:
            pass

    # 2. Positional Fallback path if find_tables() returned 0 tables
    if not results:
        results = detect_tables_positional_fallback(page, page_num=page_num, is_landscape=is_landscape)

    return results
