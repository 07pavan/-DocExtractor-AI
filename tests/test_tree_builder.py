import os
import pytest
from extraction.tree_builder import TreeBuilder
from extraction.converter import PDFConverter


def test_clean_heading_title():
    assert TreeBuilder.clean_heading_title("# **Executive Summary**") == "Executive Summary"
    assert TreeBuilder.clean_heading_title("### _Financial Highlights_") == "Financial Highlights"
    assert TreeBuilder.clean_heading_title("## [Section Link](http://test.com)") == "Section Link"


def test_parse_table_block():
    table_lines = [
        "| Name | Role | Location |",
        "|---|---|---|",
        "| Alice | Lead Engineer | New York |",
        "| Bob | Data Scientist | San Francisco |",
    ]
    tbl = TreeBuilder.parse_table_block(table_lines, "sec_1", 1)
    assert tbl is not None
    assert tbl.headers == ["Name", "Role", "Location"]
    assert len(tbl.rows) == 2
    assert tbl.rows[0] == ["Alice", "Lead Engineer", "New York"]
    assert tbl.row_count == 2
    assert tbl.col_count == 3


def test_build_tree_hierarchy():
    page_chunks = [
        {
            "metadata": {"page": 1},
            "text": """# Document Title\nIntroductory text here.\n\n## Section 1\nSection 1 content.\n\n### Subsection 1.1\nSubsection 1.1 details.\n\n| Metric | Value |\n|---|---|\n| Accuracy | 98% |\n"""
        },
        {
            "metadata": {"page": 2},
            "text": """## Section 2\nSection 2 content across page 2.\n\n### Subsection 2.1\nMore details on page 2."""
        }
    ]

    tree = TreeBuilder.build_tree_from_page_chunks(page_chunks, filename="test.pdf")
    assert tree.total_pages == 2
    assert tree.total_sections >= 4
    assert tree.total_tables == 1

    # Check top-level H1
    h1 = tree.toc[0]
    assert h1.title == "Document Title"
    assert len(h1.children) == 2  # Section 1 and Section 2

    # Check Section 1 children
    sec1 = h1.children[0]
    assert sec1.title == "Section 1"
    assert len(sec1.children) == 1
    assert sec1.children[0].title == "Subsection 1.1"
    assert sec1.children[0].table_count == 1
    assert len(sec1.children[0].tables) == 1
    assert sec1.children[0].tables[0].headers == ["Metric", "Value"]


def test_converter_on_sample_pdf():
    sample_pdf = os.path.join("tests", "sample_pdfs", "AMGN-135003565.pdf")
    if os.path.exists(sample_pdf):
        chunks, full_md = PDFConverter.convert_to_markdown_chunks(sample_pdf)
        assert len(chunks) > 0
        tree = TreeBuilder.build_tree_from_page_chunks(chunks, filename="AMGN-135003565.pdf", full_markdown=full_md)
        assert tree.total_pages > 0
        assert tree.total_sections > 0
        assert tree.total_tables > 0
        assert len(tree.toc) > 0
