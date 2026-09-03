"""Heading detector and scoring heuristics for PDF lines.
"""

from __future__ import annotations
import re
import statistics
from collections import Counter, defaultdict
from typing import List, Dict, Tuple, Set, Optional
try:
    import pymupdf as fitz
except ImportError:
    import fitz  # type: ignore

from extraction.models import SpanInfo, LineInfo


# Common patterns for headers/footers (page numbers, etc.)
PAGE_NUMBER_REGEX = re.compile(
    r"^(page\s+\d+(\s+of\s+\d+)?|\d+\s*/\s*\d+|\d+)$", re.IGNORECASE
)

# Numbered section prefixes (e.g. "1.", "1.1", "Section 1", "Part A", "Chapter 3")
NUMBERED_HEADING_REGEX = re.compile(
    r"^(\d+(\.\d+)*\.?|[A-Z]\.|\b(section|chapter|part|appendix)\s+([0-9]+|[A-Z]+))\b",
    re.IGNORECASE,
)

# Key-Value pattern indicator
KEY_VALUE_REGEX = re.compile(r"^[A-Za-z0-9\s\/\-#\.\(\)&]{1,50}\s*:\s*.+$")


def is_span_bold(span: dict) -> bool:
    """Determine if a PyMuPDF text span is bold based on flags and font name."""
    flags = span.get("flags", 0)
    font_name = str(span.get("font", "")).lower()

    # In PyMuPDF / MuPDF font flags:
    # bit 4 (value 16) is bold; check name as well
    if (flags & 16) != 0 or ((flags & 2) != 0 and "italic" not in font_name):
        return True

    bold_keywords = ("bold", "black", "heavy", "demibold", "semibold", "bolder", "hebo")
    return any(keyword in font_name for keyword in bold_keywords)


def extract_raw_lines_from_pdf(doc: fitz.Document) -> Tuple[List[LineInfo], float]:
    """Extracts all text lines and spans from a PyMuPDF document, and computes

    the document-wide median font size across all text spans.
    """
    all_font_sizes: List[float] = []
    extracted_lines: List[LineInfo] = []

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        page_dict = page.get_text("dict")
        blocks = page_dict.get("blocks", [])

        page_lines: List[LineInfo] = []

        for block in blocks:
            # Only process text blocks (type 0)
            if block.get("type", 0) != 0:
                continue

            for line in block.get("lines", []):
                spans_data = line.get("spans", [])
                if not spans_data:
                    continue

                line_spans: List[SpanInfo] = []
                line_text_parts: List[str] = []
                span_font_sizes: List[float] = []
                is_bold_line = False

                for span in spans_data:
                    text = span.get("text", "")
                    if not text:
                        continue

                    f_size = round(float(span.get("size", 10.0)), 2)
                    f_name = str(span.get("font", ""))
                    bold = is_span_bold(span)
                    bbox = tuple(float(coord) for coord in span.get("bbox", (0, 0, 0, 0)))

                    if bold:
                        is_bold_line = True

                    span_info = SpanInfo(
                        text=text,
                        font_size=f_size,
                        font_name=f_name,
                        is_bold=bold,
                        bbox=bbox,  # type: ignore
                        page_num=page_idx + 1,
                    )
                    line_spans.append(span_info)
                    line_text_parts.append(text)
                    span_font_sizes.append(f_size)
                    all_font_sizes.append(f_size)

                full_line_text = "".join(line_text_parts).strip()
                if not full_line_text:
                    continue

                line_bbox = tuple(float(coord) for coord in line.get("bbox", (0, 0, 0, 0)))
                primary_size = statistics.mean(span_font_sizes) if span_font_sizes else 10.0

                line_info = LineInfo(
                    text=full_line_text,
                    spans=line_spans,
                    bbox=line_bbox,  # type: ignore
                    page_num=page_idx + 1,
                    primary_font_size=primary_size,
                    is_bold=is_bold_line,
                )
                page_lines.append(line_info)

        # Sort lines on the page by top-to-bottom y0, then left-to-right x0
        page_lines.sort(key=lambda l: (l.bbox[1], l.bbox[0]))

        # Calculate vertical margins (whitespace above/below lines)
        for i, l in enumerate(page_lines):
            line_height = max(1.0, l.bbox[3] - l.bbox[1])
            if i > 0:
                l.margin_top = max(0.0, l.bbox[1] - page_lines[i - 1].bbox[3])
            else:
                l.margin_top = line_height * 2.0  # Top of page

            if i < len(page_lines) - 1:
                l.margin_bottom = max(0.0, page_lines[i + 1].bbox[1] - l.bbox[3])
            else:
                l.margin_bottom = line_height * 2.0  # Bottom of page

        extracted_lines.extend(page_lines)

    median_font_size = statistics.median(all_font_sizes) if all_font_sizes else 10.0
    return extracted_lines, median_font_size


def detect_and_mark_boilerplate(lines: List[LineInfo], num_pages: int) -> None:
    """Identifies repeating headers, footers, and page numbers across pages,

    and marks them as boilerplate (to be excluded from output).
    """
    if num_pages <= 1:
        # Check standalone page numbers even for 1-page documents
        for line in lines:
            cleaned = line.text.strip().lower()
            if PAGE_NUMBER_REGEX.match(cleaned):
                line.is_boilerplate = True
        return

    # Count how many distinct pages a (rounded bbox y, normalized text) appears on
    position_text_page_map = defaultdict(set)

    for line in lines:
        cleaned = " ".join(line.text.lower().split())
        # Round y coordinates to nearest 4 points to account for slight rendering shifts
        rounded_y0 = round(line.bbox[1] / 4.0) * 4
        position_key = (rounded_y0, cleaned)
        position_text_page_map[position_key].add(line.page_num)

    boilerplate_keys = {
        pos_key
        for pos_key, pages in position_text_page_map.items()
        if len(pages) >= 2 or (len(pages) >= max(2, int(num_pages * 0.4)))
    }

    for line in lines:
        cleaned = " ".join(line.text.lower().split())
        rounded_y0 = round(line.bbox[1] / 4.0) * 4
        position_key = (rounded_y0, cleaned)

        # Mark as boilerplate if repeating at same position across pages or matching page number pattern
        if position_key in boilerplate_keys:
            line.is_boilerplate = True
        elif PAGE_NUMBER_REGEX.match(line.text.strip()):
            line.is_boilerplate = True


def calculate_heading_score(line: LineInfo, median_font_size: float) -> float:
    """Calculates a heuristic score for whether a line is a heading candidate.

    Scores >= 4.0 are considered headings.
    """
    text = line.text.strip()
    line_len = len(text)
    font_size = line.primary_font_size
    line_height = max(1.0, line.bbox[3] - line.bbox[1])
    size_ratio = font_size / max(1.0, median_font_size)

    # Fast check: If line matches "Label: Value" and is standard font size (< 1.2x median) and not numbered
    if KEY_VALUE_REGEX.match(text) and size_ratio < 1.25 and not NUMBERED_HEADING_REGEX.match(text):
        return 0.0

    # If font size is at or below median and line is not bold and has no numbered prefix, it's body text
    if size_ratio <= 1.05 and not line.is_bold and not NUMBERED_HEADING_REGEX.match(text):
        return 0.0

    score = 0.0

    # 1. Font size relative to document median font size
    if size_ratio >= 1.6:
        score += 6.0
    elif size_ratio >= 1.35:
        score += 4.5
    elif size_ratio >= 1.15:
        score += 3.0
    elif size_ratio >= 1.05:
        score += 1.0
    elif size_ratio < 0.90:
        score -= 4.0  # Likely footnotes, small captions, annotations

    # 2. Bold flag
    if line.is_bold:
        score += 3.0

    # 3. Line length (short lines score higher; full-width sentences score lower)
    if line_len <= 35:
        score += 2.0
    elif line_len <= 65:
        score += 1.0
    elif line_len <= 95:
        score += 0.0
    elif line_len <= 130:
        score -= 2.0
    else:
        score -= 4.5  # Long paragraphs

    # 4. Standalone whitespace (whitespace above and below vs wrapped body)
    if line.margin_top >= line_height * 0.7:
        score += 1.5
    if line.margin_bottom >= line_height * 0.5:
        score += 1.0

    # 5. Punctuation & Capitalization cues
    # Check for numbered section headers e.g. "1.1 Overview"
    if NUMBERED_HEADING_REGEX.match(text):
        score += 2.5

    # If it ends with a period (and is not an abbreviation or section number), penalize
    if text.endswith(".") and not NUMBERED_HEADING_REGEX.match(text) and line_len > 25:
        score -= 3.0

    # Check for uppercase or title case
    if text.isupper() and line_len >= 4:
        score += 1.5
    elif text.istitle() and line_len <= 60:
        score += 1.0

    return score


def cluster_heading_levels(heading_lines: List[LineInfo], median_font_size: float) -> None:
    """Clusters detected heading lines into discrete levels (H1=1, H2=2, H3=3, etc.)

    based on font size and visual prominence buckets.
    """
    if not heading_lines:
        return

    # Compute visual weight for each heading line
    def compute_visual_weight(l: LineInfo) -> float:
        w = l.primary_font_size
        if l.is_bold:
            w += 0.5
        if l.text.isupper() and len(l.text) > 3:
            w += 0.3
        return round(w, 1)

    weights = [compute_visual_weight(l) for l in heading_lines]
    unique_weights = sorted(list(set(weights)), reverse=True)

    # Cluster weights within 1.0 pt into the same bucket
    buckets: List[float] = []
    for w in unique_weights:
        if not buckets:
            buckets.append(w)
        else:
            # If difference between current weight and the last bucket is >= 1.0 pt, create new bucket
            if (buckets[-1] - w) >= 1.0:
                buckets.append(w)

    def get_level(w: float) -> int:
        for idx, bucket_w in enumerate(buckets):
            if abs(bucket_w - w) < 1.0 or w >= bucket_w:
                return idx + 1
        return len(buckets)

    for line in heading_lines:
        w = compute_visual_weight(line)
        line.heading_level = get_level(w)


def classify_lines(
    lines: List[LineInfo],
    median_font_size: float,
    score_threshold: float = 4.0,
) -> Tuple[List[LineInfo], List[LineInfo]]:
    """Scores all non-boilerplate lines, classifies headings vs body text,

    and assigns discrete heading levels (1, 2, 3, ...).
    
    Returns:
        tuple of (all_processed_lines, heading_lines)
    """
    heading_candidates: List[LineInfo] = []

    for line in lines:
        if line.is_boilerplate:
            continue

        score = calculate_heading_score(line, median_font_size)
        line.heading_score = score

        if score >= score_threshold:
            line.is_heading = True
            heading_candidates.append(line)
        else:
            line.is_heading = False

    cluster_heading_levels(heading_candidates, median_font_size)

    return lines, heading_candidates
