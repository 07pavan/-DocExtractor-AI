"""CLI Debug tool for inspecting detected tables in a PDF.

Usage:
    python -m extraction.debug_tables tests/sample_pdfs/AMGN-135003565.pdf
"""

import sys
from pathlib import Path
try:
    import pymupdf as fitz
except ImportError:
    import fitz  # type: ignore

from extraction.table_detector import detect_tables


def debug_pdf_tables(pdf_path: str | Path) -> None:
    path = Path(pdf_path)
    if not path.exists():
        print(f"Error: File not found at '{path}'")
        sys.exit(1)

    print("=" * 80)
    print(f"DEBUGGING TABLES FOR: {path.name}")
    print(f"Full Path: {path.resolve()}")
    print("=" * 80)

    doc = fitz.open(str(path))
    total_tables = 0

    try:
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            page_num = page_idx + 1
            tables = detect_tables(page, page_num=page_num)

            if not tables:
                continue

            for t_idx, tab_info in enumerate(tables, start=1):
                total_tables += 1
                rows = tab_info["rows"]
                bbox = tab_info["bbox"]
                num_rows = len(rows)
                num_cols = len(rows[0]) if num_rows > 0 else 0

                print(f"\n[Table #{total_tables}] Page {page_num} (Page Table #{t_idx})")
                print(f"  Bounding Box: [x0={bbox[0]:.1f}, y0={bbox[1]:.1f}, x1={bbox[2]:.1f}, y1={bbox[3]:.1f}]")
                print(f"  Dimensions:   {num_rows} rows × {num_cols} columns")
                print("  Preview (First up to 3 rows):")

                preview_rows = rows[:3]
                for r_idx, row in enumerate(preview_rows, start=1):
                    # Format cells cleanly
                    formatted_cells = [f'"{cell}"' if cell else '""' for cell in row]
                    # Truncate long cell values for preview readability
                    truncated_cells = []
                    for c in formatted_cells:
                        if len(c) > 35:
                            truncated_cells.append(c[:32] + '..."')
                        else:
                            truncated_cells.append(c)
                    print(f"    Row {r_idx}: [ {', '.join(truncated_cells)} ]")

                if num_rows > 3:
                    print(f"    ... ({num_rows - 3} more row(s))")

        print("\n" + "=" * 80)
        print(f"SUMMARY: Found {total_tables} table(s) across {len(doc)} page(s).")
        print("=" * 80)

    finally:
        doc.close()


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m extraction.debug_tables <path_to_pdf>")
        print("Example: python -m extraction.debug_tables tests/sample_pdfs/AMGN-135003565.pdf")
        sys.exit(1)

    pdf_file = sys.argv[1]
    debug_pdf_tables(pdf_file)


if __name__ == "__main__":
    main()
