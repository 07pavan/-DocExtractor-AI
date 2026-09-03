"""Unit tests for the multi-threaded parallel PDF extractor.
"""

from pathlib import Path
import pytest
from extraction.llm_extractor import parallel_extract_full_text_and_tables


def test_parallel_extraction_preserves_page_order(tmp_path):
    """Verify that multi-threaded batching reassembles all pages in exact sequential order."""
    sample_pdf_path = Path("tests/sample_pdfs/AMGN-135003565.pdf")
    if not sample_pdf_path.exists():
        pytest.skip("Sample PDF AMGN-135003565.pdf not found.")

    with open(sample_pdf_path, "rb") as f:
        pdf_bytes = f.read()

    page_texts, tables = parallel_extract_full_text_and_tables(
        pdf_bytes=pdf_bytes,
        batch_size=4,
        max_workers=4,
    )

    assert len(page_texts) == 15
    # Verify strict 1-indexed ascending order
    page_numbers = [p["page"] for p in page_texts]
    assert page_numbers == list(range(1, 16))

    # Verify tables were found
    assert len(tables) > 0


def test_parallel_extraction_on_large_document():
    """Verify multi-threaded extraction on 114-page document."""
    sample_pdf_path = Path("tests/sample_pdfs/NYLM-134614243.pdf")
    if not sample_pdf_path.exists():
        pytest.skip("Sample PDF NYLM-134614243.pdf not found.")

    with open(sample_pdf_path, "rb") as f:
        pdf_bytes = f.read()

    page_texts, tables = parallel_extract_full_text_and_tables(
        pdf_bytes=pdf_bytes,
        batch_size=15,
        max_workers=6,
    )

    assert len(page_texts) == 114
    page_numbers = [p["page"] for p in page_texts]
    assert page_numbers == list(range(1, 115))
    assert len(tables) >= 50
