"""Tests for the PDF heading/body extraction engine.
"""

import os
import json
from pathlib import Path
import pytest
try:
    import pymupdf as fitz
except ImportError:
    import fitz  # type: ignore

from extraction.parser import extract_document
from extraction.models import SectionNode


SAMPLE_PDFS_DIR = Path(__file__).parent / "sample_pdfs"


def create_mock_sample_pdf(output_path: Path) -> None:
    """Generates a multi-page sample PDF containing H1, H2, H3 headings,

    repeating header/footer boilerplate, body paragraphs, and Label: Value fields.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = fitz.open()

    # Page 1
    page1 = doc.new_page(width=595, height=842)

    # Repeating Header (Boilerplate)
    page1.insert_text((50, 30), "CONFIDENTIAL - ACME FINANCIAL SERVICES", fontsize=9, fontname="helv")

    # Document Title / H1
    page1.insert_text((50, 80), "CUSTOMER ACCOUNT STATEMENT", fontsize=22, fontname="hebo")

    # Body Intro
    page1.insert_text((50, 115), "This statement summarizes all account activities for the fiscal quarter.", fontsize=10, fontname="helv")

    # Section 1 / H2
    page1.insert_text((50, 155), "1. Policyholder Information", fontsize=15, fontname="hebo")

    # Fields
    page1.insert_text((50, 185), "Company: American General Life Insurance Company", fontsize=10, fontname="helv")
    page1.insert_text((50, 205), "Policy Number: POL-9982341", fontsize=10, fontname="helv")
    page1.insert_text((50, 225), "Primary Insured: Johnathan Doe", fontsize=10, fontname="helv")
    page1.insert_text((50, 245), "Effective Date: 2024-01-15", fontsize=10, fontname="helv")

    # Subsection / H3
    page1.insert_text((50, 285), "Coverage Details", fontsize=12, fontname="hebo")
    page1.insert_text((50, 310), "Plan Type: Comprehensive Term Life", fontsize=10, fontname="helv")
    page1.insert_text((50, 330), "Coverage Amount: $1,000,000", fontsize=10, fontname="helv")
    page1.insert_text((50, 355), "Standard benefits apply according to schedule B of the master agreement.", fontsize=10, fontname="helv")

    # Section 2 / H2
    page1.insert_text((50, 400), "2. Premium Billing Breakdown", fontsize=15, fontname="hebo")
    page1.insert_text((50, 425), "Annual Premium: $1,240.00", fontsize=10, fontname="helv")
    page1.insert_text((50, 445), "Billing Mode: Semi-Annual Automated Clearing House", fontsize=10, fontname="helv")
    page1.insert_text((50, 470), "Payments are processed on the first business day of the billing month.", fontsize=10, fontname="helv")

    # Repeating Footer (Boilerplate)
    page1.insert_text((50, 810), "Page 1 of 2", fontsize=9, fontname="helv")
    page1.insert_text((350, 810), "Form Ref: ACME-2024-V3", fontsize=9, fontname="helv")

    # Page 2
    page2 = doc.new_page(width=595, height=842)

    # Repeating Header (Boilerplate)
    page2.insert_text((50, 30), "CONFIDENTIAL - ACME FINANCIAL SERVICES", fontsize=9, fontname="helv")

    # Section 3 / H2
    page2.insert_text((50, 80), "3. Beneficiary Designations", fontsize=15, fontname="hebo")
    page2.insert_text((50, 105), "Primary Beneficiary: Jane Doe (100%)", fontsize=10, fontname="helv")
    page2.insert_text((50, 125), "Contingent Beneficiary: Acme Trust Ltd", fontsize=10, fontname="helv")

    # Subsection / H3
    page2.insert_text((50, 165), "Special Instructions", fontsize=12, fontname="hebo")
    page2.insert_text((50, 190), "Disbursements upon settlement are subject to verification of identity.", fontsize=10, fontname="helv")

    # Section 4 / H2
    page2.insert_text((50, 240), "4. Terms and Conditions", fontsize=15, fontname="hebo")
    page2.insert_text((50, 265), "Please contact customer care for disputes within 30 days of issuance.", fontsize=10, fontname="helv")

    # Repeating Footer (Boilerplate)
    page2.insert_text((50, 810), "Page 2 of 2", fontsize=9, fontname="helv")
    page2.insert_text((350, 810), "Form Ref: ACME-2024-V3", fontsize=9, fontname="helv")

    doc.save(str(output_path))
    doc.close()


def print_heading_tree(node: dict, indent: int = 0) -> None:
    """Pretty prints the extracted heading tree hierarchy for eyeball inspection."""
    prefix = "  " * indent
    bullet = "+--" if indent > 0 else "#"
    heading = node.get("heading", "Untitled")
    level = node.get("level", 0)
    page = node.get("page", 1)
    fields = node.get("fields", [])
    text = node.get("text", "")
    subsections = node.get("subsections", [])

    print(f"{prefix}{bullet} [H{level}|Page {page}] {heading}")

    if fields:
        for f in fields:
            print(f"{prefix}    | [Field] {f['label']}: {f['value']}")

    if text:
        snippet = text.replace("\n", " ")
        if len(snippet) > 80:
            snippet = snippet[:77] + "..."
        print(f"{prefix}    | [Text]  {snippet}")

    for sub in subsections:
        print_heading_tree(sub, indent + 1)


def test_extract_document_structure():
    """Extracts and prints the heading/body tree for all PDFs in tests/sample_pdfs/."""
    SAMPLE_PDFS_DIR.mkdir(parents=True, exist_ok=True)

    # Recreate mock sample PDF if it was the generated one to ensure clean state
    mock_sample_file = SAMPLE_PDFS_DIR / "sample_policy_statement.pdf"
    if mock_sample_file.exists():
        mock_sample_file.unlink()

    pdf_files = list(SAMPLE_PDFS_DIR.glob("*.pdf"))

    # If no sample PDFs exist yet, generate one for testing
    if not pdf_files:
        create_mock_sample_pdf(mock_sample_file)
        pdf_files = [mock_sample_file]

    print(f"\nFound {len(pdf_files)} PDF file(s) in {SAMPLE_PDFS_DIR}:\n")

    for pdf_path in pdf_files:
        print("=" * 80)
        print(f"FILE: {pdf_path.name}")
        print("=" * 80)

        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

        result = extract_document(pdf_bytes)

        # Output readable formatted tree
        print("\n--- EXTRACTED HEADING TREE ---")
        print_heading_tree(result)

        print("\n--- JSON SHAPE (COMPACT) ---")
        print(json.dumps(result, indent=2))
        print("=" * 80 + "\n")

        # Basic shape validation
        assert isinstance(result, dict)
        assert "heading" in result
        assert "level" in result
        assert "page" in result
        assert "text" in result
        assert "fields" in result
        assert "subsections" in result
        assert isinstance(result["fields"], list)
        assert isinstance(result["subsections"], list)


if __name__ == "__main__":
    pytest.main(["-v", "-s", __file__])
