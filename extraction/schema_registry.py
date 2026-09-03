"""Schema Registry — Document-Type-Specific Extraction Schemas.

Each document archetype (classified by document_classifier.py) maps to a
precise extraction schema. The schema tells the LLM exactly which fields to
look for, what to call them, and what to output when a field is NOT found.

Anti-Hallucination Contract
────────────────────────────
Every field definition has a `null_label` property. If the LLM cannot locate
the field verbatim in the provided text it MUST emit null, and the frontend
renders `null_label` instead of a fabricated value.
"""

from __future__ import annotations
from typing import Dict, Any


# ─────────────────────────────────────────────────────────────────────────────
# Field descriptor shape
# ─────────────────────────────────────────────────────────────────────────────
# {
#   "key":        str   — JSON key used in the LLM output and frontend
#   "label":      str   — Human-readable display label
#   "type":       str   — "text"|"currency"|"date"|"status"|"count"|"url"
#   "null_label": str   — Shown when value is null (never fabricate)
#   "kpi":        bool  — Whether to surface this field in the top KPI strip
# }

_FIELD = lambda key, label, ftype="text", null_label="Not found in document", kpi=False: {
    "key": key,
    "label": label,
    "type": ftype,
    "null_label": null_label,
    "kpi": kpi,
}


# ─────────────────────────────────────────────────────────────────────────────
# Per-archetype schemas
# ─────────────────────────────────────────────────────────────────────────────

SCHEMAS: Dict[str, Dict[str, Any]] = {

    # ── SERFF Insurance Regulatory Filing ────────────────────────────────────
    "SERFF_FILING": {
        "display_name": "SERFF Insurance Filing",
        "kpi_keys": ["company_name", "status", "filing_fee", "form_count"],
        "fields": [
            _FIELD("company_name",          "Company Name",                kpi=True),
            _FIELD("state",                 "State / Jurisdiction"),
            _FIELD("serff_tracking_number", "SERFF Tracking #"),
            _FIELD("state_tracking_number", "State Tracking #"),
            _FIELD("product_name",          "Product Name"),
            _FIELD("type_of_insurance",     "Type of Insurance (TOI)"),
            _FIELD("sub_toi",               "Sub-TOI"),
            _FIELD("status",                "Filing Status",   ftype="status", kpi=True),
            _FIELD("effective_date",        "Effective Date",  ftype="date"),
            _FIELD("filing_fee",            "Filing Fee",      ftype="currency", kpi=True),
            _FIELD("form_count",            "Total Forms",     ftype="count",    kpi=True),
            _FIELD("disposition_date",      "Disposition Date", ftype="date"),
            _FIELD("submitted_by",          "Submitted By"),
        ],
        "section_headings": [
            "Filing at a Glance",
            "General Information",
            "Form & Document Schedules",
            "Supporting Documents",
            "Correspondence & Dispositions",
            "Filing Fees",
        ],
        "llm_instructions": (
            "Extract all fields exactly as they appear in the document. "
            "For the Form Schedule, create a table with columns: "
            "Item #, Form Name, Form Number, Type, Action, Readability Score, "
            "Attachment, Submitted Details. "
            "If any field cannot be found verbatim in the provided text, "
            "output null — do NOT infer or guess."
        ),
    },

    # ── Insurance Policy / Group Contract / Certificate ───────────────────────
    "POLICY_CONTRACT": {
        "display_name": "Insurance Policy / Contract",
        "kpi_keys": ["policy_number", "coverage_type", "face_amount", "effective_date"],
        "fields": [
            _FIELD("policy_number",     "Policy Number",           kpi=True),
            _FIELD("insured_name",      "Insured / Group Name"),
            _FIELD("coverage_type",     "Coverage Type",           kpi=True),
            _FIELD("face_amount",       "Face Amount / Limit",     ftype="currency", kpi=True),
            _FIELD("premium",           "Premium",                 ftype="currency"),
            _FIELD("effective_date",    "Effective Date",          ftype="date",     kpi=True),
            _FIELD("expiry_date",       "Expiry / Renewal Date",   ftype="date"),
            _FIELD("grace_period",      "Grace Period"),
            _FIELD("beneficiary",       "Beneficiary"),
            _FIELD("state",             "State / Jurisdiction"),
            _FIELD("exclusions_count",  "# Exclusions",            ftype="count"),
            _FIELD("riders",            "Riders / Endorsements"),
        ],
        "section_headings": [
            "Policy Summary",
            "Coverage & Benefits",
            "Exclusions & Limitations",
            "Premium Schedule",
            "Definitions",
            "Riders & Amendments",
        ],
        "llm_instructions": (
            "Extract all policy fields exactly as stated. "
            "Create a Benefits table (Benefit Name, Coverage Amount, Conditions) "
            "and an Exclusions table (Exclusion, Description). "
            "If any field is absent from the provided text, output null."
        ),
    },

    # ── Actuarial Report ──────────────────────────────────────────────────────
    "ACTUARIAL_REPORT": {
        "display_name": "Actuarial Report",
        "kpi_keys": ["actuary_name", "valuation_date", "product_name", "reserve_basis"],
        "fields": [
            _FIELD("actuary_name",      "Appointed Actuary",         kpi=True),
            _FIELD("company_name",      "Company"),
            _FIELD("product_name",      "Product",                   kpi=True),
            _FIELD("valuation_date",    "Valuation Date",            ftype="date", kpi=True),
            _FIELD("reserve_basis",     "Reserve Basis",             kpi=True),
            _FIELD("mortality_table",   "Mortality Table"),
            _FIELD("interest_rate",     "Interest Rate Assumption"),
            _FIELD("lapse_rate",        "Lapse Rate Assumption"),
            _FIELD("regulatory_std",    "Regulatory Standard"),
        ],
        "section_headings": [
            "Actuarial Opinion",
            "Product Description",
            "Assumptions",
            "Reserve Methodology",
            "Experience Study Results",
            "Conclusions",
        ],
        "llm_instructions": (
            "Extract actuarial fields and assumption tables verbatim. "
            "Create an Assumptions table (Assumption, Value, Source). "
            "Output null for any field not explicitly stated."
        ),
    },

    # ── Financial Statement ───────────────────────────────────────────────────
    "FINANCIAL_STATEMENT": {
        "display_name": "Financial Statement",
        "kpi_keys": ["entity_name", "period", "total_revenue", "net_income"],
        "fields": [
            _FIELD("entity_name",       "Entity / Company",   kpi=True),
            _FIELD("period",            "Reporting Period",    ftype="text",     kpi=True),
            _FIELD("total_revenue",     "Total Revenue",       ftype="currency", kpi=True),
            _FIELD("net_income",        "Net Income / Loss",   ftype="currency", kpi=True),
            _FIELD("total_assets",      "Total Assets",        ftype="currency"),
            _FIELD("total_liabilities", "Total Liabilities",   ftype="currency"),
            _FIELD("equity",            "Shareholders Equity", ftype="currency"),
            _FIELD("accounting_std",    "Accounting Standard"),
            _FIELD("auditor",           "Auditor"),
            _FIELD("audit_opinion",     "Audit Opinion",       ftype="status"),
        ],
        "section_headings": [
            "Summary",
            "Income Statement",
            "Balance Sheet",
            "Cash Flow Statement",
            "Notes to Financial Statements",
            "Auditor's Report",
        ],
        "llm_instructions": (
            "Extract all financial figures exactly as stated (do not round or convert). "
            "Create structured tables for the Income Statement, Balance Sheet, and Cash Flow. "
            "Output null for any line item not explicitly present in the provided text."
        ),
    },

    # ── Legal Memorandum ─────────────────────────────────────────────────────
    "LEGAL_MEMORANDUM": {
        "display_name": "Legal Memorandum",
        "kpi_keys": ["matter_name", "date", "counsel", "jurisdiction"],
        "fields": [
            _FIELD("matter_name",   "Matter / Case Name",  kpi=True),
            _FIELD("date",          "Memorandum Date",     ftype="date",  kpi=True),
            _FIELD("counsel",       "Counsel / Author",    kpi=True),
            _FIELD("jurisdiction",  "Jurisdiction",        kpi=True),
            _FIELD("subject",       "Subject"),
            _FIELD("parties",       "Parties"),
            _FIELD("statutes",      "Statutes Referenced"),
        ],
        "section_headings": [
            "Issue Presented",
            "Short Answer",
            "Statement of Facts",
            "Discussion",
            "Analysis",
            "Conclusion",
        ],
        "llm_instructions": (
            "Extract all header fields and structure the memo by its legal sections. "
            "Output null for any field not found in the text."
        ),
    },

    # ── Generic Fallback ──────────────────────────────────────────────────────
    "GENERIC": {
        "display_name": "Document",
        "kpi_keys": ["title", "date", "author"],
        "fields": [
            _FIELD("title",   "Title",          kpi=True),
            _FIELD("author",  "Author / Source", kpi=True),
            _FIELD("date",    "Date",            ftype="date", kpi=True),
            _FIELD("subject", "Subject"),
        ],
        "section_headings": [],
        "llm_instructions": (
            "Extract whatever structured information is present: headings, tables, "
            "key-value fields. Output null for any field not found verbatim."
        ),
    },
}


def get_schema(doc_type: str) -> Dict[str, Any]:
    """Returns the extraction schema for the given document archetype.
    Falls back to GENERIC if the archetype is unknown.
    """
    return SCHEMAS.get(doc_type, SCHEMAS["GENERIC"])


def get_field_map(doc_type: str) -> Dict[str, Dict[str, Any]]:
    """Returns a flat {key: field_descriptor} map for easy frontend lookup."""
    schema = get_schema(doc_type)
    return {f["key"]: f for f in schema.get("fields", [])}
