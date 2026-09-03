"""Schedule Consolidator for Multi-Page & Landscape Tables.
Aggregates repeating schedule tables across all pages into clean master tables.
"""

from __future__ import annotations
import re
from typing import List, Dict, Any, Optional, Tuple


def clean_str(val: Any) -> str:
    if val is None:
        return ""
    text = str(val).strip()
    return re.sub(r"[ \t\n]+", " ", text).strip()


def consolidate_schedule_tables(detected_tables: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Scans all tables across all pages, identifies repeating multi-page schedules,
    and consolidates them into clean master tables without artificial variation columns.
    """
    form_schedule_rows: List[List[str]] = []
    supp_doc_rows: List[List[str]] = []

    seen_signatures = set()

    for tab in detected_tables:
        page_num = tab["page"]
        rows = tab["rows"]
        if not rows:
            continue

        # Check if table is a Form Schedule Item table
        first_row_str = " ".join(rows[0]).lower() if rows else ""
        second_row_str = " ".join(rows[1]).lower() if len(rows) > 1 else ""
        combined_header = first_row_str + " " + second_row_str

        if any(k in combined_header for k in ["form schedule", "form name", "form number", "lead form number"]):
            for r in rows:
                if not r or not any(r):
                    continue
                # Extract clean fields
                item_no = clean_str(r[0]) if len(r) > 0 else ""
                form_name = clean_str(r[1]) if len(r) > 1 else ""
                form_number = clean_str(r[2]) if len(r) > 2 else ""
                form_type = clean_str(r[3]) if len(r) > 3 else ""
                form_action = clean_str(r[4]) if len(r) > 4 else ""
                readability = clean_str(r[6]) if len(r) > 6 else (clean_str(r[5]) if len(r) > 5 else "")
                attachment = clean_str(r[7]) if len(r) > 7 else (clean_str(r[6]) if len(r) > 6 else "")
                submitted = clean_str(r[8]) if len(r) > 8 else (clean_str(r[-1]) if len(r) > 7 else "")

                # Skip header rows
                if item_no.lower() in ("item", "item no", "item no.", "item\nno.", "form schedule item changes", "") and form_name.lower() in ("form name", "form", ""):
                    continue
                if "item no" in item_no.lower() or "form schedule" in item_no.lower():
                    continue

                # If this is a valid data row
                if item_no.isdigit() or form_number or len(form_name) > 10:
                    short_form_name = form_name[:120]

                    # Deduplicate exact duplicate items
                    sig = (item_no, form_name, form_number, attachment, submitted)
                    if sig not in seen_signatures:
                        seen_signatures.add(sig)

                        form_schedule_rows.append([
                            item_no if item_no else "1",
                            short_form_name,
                            form_number,
                            form_type or "Form",
                            form_action or "Filing",
                            readability,
                            attachment,
                            submitted,
                        ])

        elif any(k in combined_header for k in ["supporting document", "bypassed", "satisfied", "attachment(s)"]):
            for r in rows:
                if len(r) >= 2 and any(r):
                    label = clean_str(r[0])
                    val = clean_str(r[1]) if len(r) > 1 else ""
                    if label and val and "supporting document" not in label.lower():
                        sig = (label, val)
                        if sig not in seen_signatures:
                            seen_signatures.add(sig)
                            supp_doc_rows.append([
                                label,
                                val,
                                "Supporting Document Schedule",
                            ])

    consolidated: List[Dict[str, Any]] = []

    # 1. Master Form Schedule Table
    if form_schedule_rows:
        consolidated.append({
            "title": f"Consolidated Form Schedule ({len(form_schedule_rows)} Items)",
            "headers": [
                "Item #",
                "Form Name",
                "Form Number",
                "Type",
                "Action",
                "Readability",
                "Attachment",
                "Submitted Details",
            ],
            "rows": form_schedule_rows,
        })

    # 2. Master Supporting Document Schedule
    if supp_doc_rows:
        consolidated.append({
            "title": f"Supporting Document Schedules ({len(supp_doc_rows)} Items)",
            "headers": ["Schedule Item / Status", "Document Name / Details", "Category"],
            "rows": supp_doc_rows[:50],
        })

    return consolidated
