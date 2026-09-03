"""Unit tests for the table detector module.
"""

from pathlib import Path
import pytest
try:
    import pymupdf as fitz
except ImportError:
    import fitz  # type: ignore

from extraction.table_detector import detect_tables


def create_table_test_pdf(output_path: Path) -> None:
    """Creates a synthetic PDF containing a structured table with drawn borders."""
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)

    # Heading
    page.insert_text((50, 50), "Financial Summary Table", fontsize=16, fontname="helv")

    # Draw a table with rectangles and lines
    table_rect = fitz.Rect(50, 80, 500, 200)
    page.draw_rect(table_rect, color=(0, 0, 0), width=1)

    # Horizontal lines
    page.draw_line(fitz.Point(50, 110), fitz.Point(500, 110), color=(0, 0, 0), width=1)
    page.draw_line(fitz.Point(50, 140), fitz.Point(500, 140), color=(0, 0, 0), width=1)
    page.draw_line(fitz.Point(50, 170), fitz.Point(500, 170), color=(0, 0, 0), width=1)

    # Vertical line
    page.draw_line(fitz.Point(200, 80), fitz.Point(200, 200), color=(0, 0, 0), width=1)
    page.draw_line(fitz.Point(350, 80), fitz.Point(350, 200), color=(0, 0, 0), width=1)

    # Table Text
    page.insert_text((60, 100), "Quarter", fontsize=10, fontname="helv")
    page.insert_text((210, 100), "Revenue", fontsize=10, fontname="helv")
    page.insert_text((360, 100), "Net Profit", fontsize=10, fontname="helv")

    page.insert_text((60, 130), "Q1 2024", fontsize=10, fontname="helv")
    page.insert_text((210, 130), "$1,250,000", fontsize=10, fontname="helv")
    page.insert_text((360, 130), "$320,000", fontsize=10, fontname="helv")

    page.insert_text((60, 160), "Q2 2024", fontsize=10, fontname="helv")
    page.insert_text((210, 160), "$1,480,000", fontsize=10, fontname="helv")
    page.insert_text((360, 160), "$410,000", fontsize=10, fontname="helv")

    page.insert_text((60, 190), "Q3 2024", fontsize=10, fontname="helv")
    page.insert_text((210, 190), "$1,620,000", fontsize=10, fontname="helv")
    page.insert_text((360, 190), "$490,000", fontsize=10, fontname="helv")

    doc.save(str(output_path))
    doc.close()


def test_detect_tables_on_page(tmp_path):
    """Verify detect_tables extracts rows and bounding box from a page."""
    test_pdf = tmp_path / "test_table.pdf"
    create_table_test_pdf(test_pdf)

    doc = fitz.open(str(test_pdf))
    try:
        tables = detect_tables(doc[0], page_num=1)
        assert len(tables) >= 1
        tab = tables[0]
        assert "rows" in tab
        assert "bbox" in tab
        assert tab["page"] == 1
        assert len(tab["rows"]) >= 4
        assert len(tab["bbox"]) == 4
    finally:
        doc.close()
