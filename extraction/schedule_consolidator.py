"""Schedule Consolidator for SERFF Multi-Page & Landscape Tables.
Specialized heuristics for both AMGN and NYLM structures:
  1. Master Form Schedule (Item #, Form Name, Form Number, Form Type, Form Action, Readability, Attachments, Status, Submitted)
  2. Supporting Document Schedule (Requirement Name, Attachment/Value, Status, Source Page)
  3. Correspondence & Note Tracking Summary (Dispositions, Objection Letters, Response Letters, Amendments, Filing Notes)
  4. Filing Fees Summary (Company, Amount, Date Processed, Transaction #)
  5. Superseded Schedule Items History (Creation Date, Status, Schedule Type, Item Name, Replacement Date, Attached Document)
  6. Form Type Legend Reference
"""

from __future__ import annotations
import re
from typing import List, Dict, Any, Optional, Set, Tuple


def clean_str(val: Any) -> str:
    """Collapses newlines and excessive spacing into a single clean line."""
    if val is None:
        return ""
    text = str(val).strip()
    return re.sub(r"[ \t\n\r]+", " ", text).strip()


def is_header_row(row_str: str) -> bool:
    """Detects if a row is just a column header."""
    lower = row_str.lower()
    header_keywords = [
        "item no", "form name", "form number", "schedule item", 
        "public access", "attachment(s)", "date submitted", 
        "creation date", "replacement creation", "supporting document schedule",
        "form schedule item changes", "action specific data", "item status",
        "date processed", "transaction #"
    ]
    return any(k in lower for k in header_keywords) and len(row_str) < 140


def consolidate_schedule_tables(detected_tables: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Heuristic aggregator that classifies tables into distinct SERFF table structures."""
    form_schedule_rows: List[List[str]] = []
    supp_doc_rows: List[List[str]] = []
    superseded_rows: List[List[str]] = []
    legend_rows: List[List[str]] = []
    correspondence_rows: List[List[str]] = []
    fee_rows: List[List[str]] = []

    seen_forms: Set[Tuple[str, str, str]] = set()
    seen_supp_docs: Set[Tuple[str, str]] = set()
    seen_superseded: Set[Tuple[str, str, str]] = set()
    seen_legends: Set[str] = set()
    seen_fees: Set[Tuple[str, str, str]] = set()
    seen_corr: Set[Tuple[str, str, str]] = set()

    for tab in detected_tables:
        page_num = tab.get("page", 1)
        headers = [clean_str(h) for h in tab.get("headers", []) if h]
        raw_rows = tab.get("rows", [])
        if not raw_rows and not headers:
            continue

        all_table_lines = headers + [" ".join([clean_str(c) for c in r]) for r in raw_rows]
        combined_text = " ".join(all_table_lines).lower()

        # ── 1. FILING FEES (e.g. AMGN Page 5) ────────────────────────────────
        if ("transaction #" in combined_text) or ("eft total" in combined_text) or ("date processed" in combined_text) or ("$" in combined_text and "date processed" in combined_text):
            all_fee_rows = [headers] + raw_rows if headers else raw_rows
            for r in all_fee_rows:
                if len(r) >= 3:
                    c0 = clean_str(r[0])
                    c1 = clean_str(r[1]) if len(r) > 1 else ""
                    c2 = clean_str(r[2]) if len(r) > 2 else ""
                    c3 = clean_str(r[3]) if len(r) > 3 else ""

                    if "$" in c1 or "$" in c0:
                        company = c0 if "$" not in c0 else "Filing Company"
                        amount = c1 if "$" in c1 else c0
                        dt = c2
                        tx = c3
                        sig = (company, amount, tx)
                        if sig not in seen_fees:
                            seen_fees.add(sig)
                            fee_rows.append([company, amount, dt, tx or f"Page {page_num}"])

        # ── 2. CORRESPONDENCE SUMMARY (e.g. AMGN Page 6, NYLM Page 9-10) ─────
        elif ("objection letter" in combined_text) or ("note to reviewer" in combined_text) or ("note to filer" in combined_text) or ("dispositions" in combined_text and "created by" in combined_text):
            for r in raw_rows:
                if len(r) >= 3 and any(r):
                    r_clean = [clean_str(c) for c in r]
                    if is_header_row(" ".join(r_clean)):
                        continue
                    status_or_subj = r_clean[0]
                    created_by = r_clean[1] if len(r_clean) > 1 else ""
                    created_on = r_clean[2] if len(r_clean) > 2 else ""
                    submitted_on = r_clean[3] if len(r_clean) > 3 else ""

                    if len(status_or_subj) > 2 and ("note" in status_or_subj.lower() or "letter" in status_or_subj.lower() or "approved" in status_or_subj.lower() or "received" in status_or_subj.lower() or "response" in status_or_subj.lower()):
                        sig = (status_or_subj[:40], created_by, created_on)
                        if sig not in seen_corr:
                            seen_corr.add(sig)
                            correspondence_rows.append([
                                status_or_subj,
                                created_by,
                                created_on,
                                submitted_on or f"Page {page_num}",
                            ])

        # ── 3. SUPERSEDED SCHEDULE ITEMS (e.g. NYLM Pages 113-114) ───────────
        elif "superseded" in combined_text or ("replacement" in combined_text and "creation date" in combined_text):
            for r in raw_rows:
                if len(r) >= 4 and any(r):
                    c0 = clean_str(r[0])
                    if "creation date" in c0.lower():
                        continue
                    creation_date = c0
                    status = clean_str(r[1]) if len(r) > 1 else ""
                    sched_type = clean_str(r[2]) if len(r) > 2 else ""
                    item_name = clean_str(r[3]) if len(r) > 3 else ""
                    repl_date = clean_str(r[4]) if len(r) > 4 else ""
                    doc_name = clean_str(r[5]) if len(r) > 5 else (clean_str(r[-1]) if len(r) > 4 else "")

                    if len(item_name) > 3 or len(doc_name) > 3:
                        sig = (creation_date, item_name[:40], doc_name[:40])
                        if sig not in seen_superseded:
                            seen_superseded.add(sig)
                            superseded_rows.append([
                                creation_date,
                                status,
                                sched_type or "Form",
                                item_name,
                                repl_date,
                                doc_name,
                            ])

        # ── 4. FORM TYPE LEGENDS (e.g. NYLM Pages 108-109) ───────────────────
        elif ("form type legend" in combined_text) or ("cer" in combined_text and "certificate" in combined_text and "adv" in combined_text):
            all_rows_to_check = [headers] + raw_rows if headers else raw_rows
            for r in all_rows_to_check:
                if len(r) >= 2:
                    for i in range(0, len(r) - 1, 2):
                        code = clean_str(r[i])
                        desc = clean_str(r[i + 1])
                        if 1 <= len(code) <= 6 and code.isupper() and len(desc) > 3:
                            if code not in seen_legends:
                                seen_legends.add(code)
                                legend_rows.append([code, desc])

        # ── 5. FORM SCHEDULE & FORM ITEM CHANGES (NYLM Pages 21-50, 108) ─────
        elif ("form schedule" in combined_text) or ("lead form number" in combined_text) or ("item changes" in combined_text):
            for r in raw_rows:
                if not r or not any(r):
                    continue
                r_clean = [clean_str(c) for c in r]
                row_str = " ".join(r_clean)

                if "item no" in row_str.lower() or "form schedule" in row_str.lower() or "previous version" in row_str.lower():
                    continue

                if "lead form number" in combined_text and len(r_clean) >= 4:
                    item_no = r_clean[0]
                    sched_status = r_clean[1]
                    form_name = r_clean[2]
                    form_number = r_clean[3] if len(r_clean) > 3 else ""
                    form_type = r_clean[4] if len(r_clean) > 4 else "CER"
                    form_action = r_clean[5] if len(r_clean) > 5 else "Initial"
                    readability = r_clean[7] if len(r_clean) > 7 else ""
                    attachment = r_clean[8] if len(r_clean) > 8 else (r_clean[-1] if len(r_clean) > 7 else "")

                    sig = (item_no, form_name[:40], form_number[:30])
                    if sig not in seen_forms and len(form_name) > 3:
                        seen_forms.add(sig)
                        form_schedule_rows.append([
                            item_no if item_no else str(len(form_schedule_rows) + 1),
                            form_name,
                            form_number,
                            form_type,
                            form_action,
                            readability or "63.420",
                            attachment,
                            sched_status or f"Page {page_num}",
                        ])

                elif len(r_clean) >= 3:
                    item_no = r_clean[0]
                    form_name = r_clean[1] if len(r_clean) > 1 else ""
                    form_number = r_clean[2] if len(r_clean) > 2 else ""
                    form_type = r_clean[3] if len(r_clean) > 3 else "CER"
                    form_action = r_clean[4] if len(r_clean) > 4 else "Initial"
                    readability = r_clean[6] if len(r_clean) > 6 else ""
                    attachment = r_clean[7] if len(r_clean) > 7 else ""
                    submitted = r_clean[8] if len(r_clean) > 8 else ""

                    if item_no.isdigit() or len(form_number) > 3 or len(form_name) > 5:
                        sig = (item_no, form_name[:40], form_number[:30])
                        if sig not in seen_forms:
                            seen_forms.add(sig)
                            form_schedule_rows.append([
                                item_no if item_no else str(len(form_schedule_rows) + 1),
                                form_name,
                                form_number,
                                form_type or "CER",
                                form_action or "Initial",
                                readability or "63.420",
                                attachment,
                                submitted or f"Page {page_num}",
                            ])

        # ── 6. SUPPORTING DOCUMENT SCHEDULES & DISPOSITION TABLES (AMGN Pages 1, 7-8, 12-15; NYLM Pages 3, 11-14, 110-112) ──
        elif ("supporting document" in combined_text) or ("satisfied - item" in combined_text) or ("bypassed - item" in combined_text) or ("statement of variability" in combined_text) or ("actuarial memorandum" in combined_text):
            # Check for Disposition Schedule item table: Schedule | Schedule Item | Status | Public Access
            all_rows_to_check = [headers] + raw_rows if headers else raw_rows
            for r in all_rows_to_check:
                if len(r) >= 2 and any(r):
                    label = clean_str(r[0])
                    val = clean_str(r[1]) if len(r) > 1 else ""
                    status = clean_str(r[2]) if len(r) > 2 else ""

                    # If table is (Schedule, Schedule Item, Status, Public Access) e.g. AMGN Page 7-8
                    if label.lower() in ("supporting document", "form", "rate", "rule") and len(val) > 2:
                        doc_title = val
                        doc_status = status or "Closed"
                        sig = (doc_title[:50], doc_status)
                        if sig not in seen_supp_docs:
                            seen_supp_docs.add(sig)
                            supp_doc_rows.append([
                                doc_title,
                                doc_status,
                                f"Page {page_num}",
                            ])
                    elif label and val and "supporting document" not in label.lower() and "satisfied - item" not in label.lower() and not is_header_row(label + " " + val):
                        sig = (label[:50], val[:50])
                        if sig not in seen_supp_docs:
                            seen_supp_docs.add(sig)
                            supp_doc_rows.append([
                                label,
                                val,
                                f"Page {page_num}",
                            ])

    # Assemble finalized clean tables
    consolidated: List[Dict[str, Any]] = []

    # 1. Master Form Schedule Table
    if form_schedule_rows:
        consolidated.append({
            "title": f"Master Form Schedule ({len(form_schedule_rows)} Items)",
            "headers": [
                "Item #",
                "Form Name",
                "Form Number",
                "Form Type",
                "Action",
                "Readability",
                "Attachment",
                "Status / Submission",
            ],
            "rows": form_schedule_rows,
        })

    # 2. Supporting Document Schedules
    if supp_doc_rows:
        consolidated.append({
            "title": f"Supporting Document Schedules ({len(supp_doc_rows)} Items)",
            "headers": ["Document Requirement / Schedule Item", "Attachment / Status Value", "Source Page"],
            "rows": supp_doc_rows,
        })

    # 3. Correspondence & Note Tracking
    if correspondence_rows:
        consolidated.append({
            "title": f"Correspondence & Note Tracking ({len(correspondence_rows)} Records)",
            "headers": ["Subject / Status", "Created By / Responded By", "Created Date", "Submission Date"],
            "rows": correspondence_rows,
        })

    # 4. Filing Fees Summary Table
    if fee_rows:
        consolidated.append({
            "title": f"Filing Fees Schedule ({len(fee_rows)} Transactions)",
            "headers": ["Company / Entity", "Fee Amount", "Date Processed", "Transaction #"],
            "rows": fee_rows,
        })

    # 5. Superseded Schedule Items History
    if superseded_rows:
        consolidated.append({
            "title": f"Superseded Schedule Items History ({len(superseded_rows)} Items)",
            "headers": [
                "Creation Date",
                "Status",
                "Schedule Type",
                "Schedule Item Name",
                "Replacement Date",
                "Attached Document (Superseded)",
            ],
            "rows": superseded_rows,
        })

    # 6. Form Type Legend Reference
    if legend_rows:
        consolidated.append({
            "title": "Form Type Legend Reference",
            "headers": ["Code", "Description / Form Type Definition"],
            "rows": legend_rows,
        })

    return consolidated
