"""Document Type Classifier — Zero-Hallucination Pre-Pass.

Detects the document archetype from the opening pages of the PDF before any
full extraction is attempted. This ensures the correct schema and rendering
layout is selected, preventing the LLM from forcing insurance-filing fields
onto non-filing documents (which is a primary hallucination source).

Supported archetypes:
    SERFF_FILING        — SERFF regulatory insurance filing submission
    POLICY_CONTRACT     — Insurance policy or group contract / certificate
    ACTUARIAL_REPORT    — Actuarial study, mortality table, rate filing support
    FINANCIAL_STATEMENT — Balance sheets, income statements, ledgers
    LEGAL_MEMORANDUM    — Regulatory correspondence, legal opinion letters
    GENERIC             — Any other document (no domain-specific schema forced)
"""

from __future__ import annotations
import re
import logging
from typing import Dict, Any, List, Tuple

logger = logging.getLogger("extraction.document_classifier")


# ──────────────────────────────────────────────────────────────────────────────
# Signal dictionaries: (regex_pattern, weight) pairs per archetype.
# Higher weight = stronger evidence of that archetype.
# ──────────────────────────────────────────────────────────────────────────────

_SIGNALS: Dict[str, List[Tuple[str, float]]] = {
    "SERFF_FILING": [
        (r"SERFF\s+Tracking\s+(Number|#|No)", 5.0),
        (r"Filing\s+at\s+a\s+Glance", 4.5),
        (r"Form\s+Schedule", 4.0),
        (r"Supporting\s+Document\s+Schedule", 4.0),
        (r"State\s+Tracking\s+Number", 3.5),
        (r"Type\s+of\s+Insurance", 3.0),
        (r"Filing\s+Fee", 3.0),
        (r"Correspondence\s*/\s*Disposition", 3.0),
        (r"Bypass|Bypassed", 2.5),
        (r"Readability\s+Score", 2.5),
        (r"TOI\s*:", 2.0),
        (r"Sub-TOI", 2.0),
        (r"NAIC\s+Code", 2.0),
    ],
    "POLICY_CONTRACT": [
        (r"Group\s+Policy|Group\s+Certificate|Master\s+Policy", 4.5),
        (r"Insured|Named\s+Insured|Policyholder", 3.5),
        (r"Coverage\s+Amount|Face\s+Amount", 3.5),
        (r"Premium\s+Schedule|Annual\s+Premium|Monthly\s+Premium", 3.0),
        (r"Exclusion[s]?\b|Excluded\s+Condition", 3.0),
        (r"Beneficiary|Beneficiaries", 3.0),
        (r"Grace\s+Period|Lapse|Reinstatement", 2.5),
        (r"Riders?|Amendment|Endorsement", 2.0),
        (r"Surrender\s+Value|Cash\s+Value", 2.0),
        (r"Incontestability", 2.0),
    ],
    "ACTUARIAL_REPORT": [
        (r"Actuarial\s+(Memorandum|Opinion|Report|Study)", 5.0),
        (r"Mortality\s+Table|Lapse\s+Rate|Morbidity", 4.0),
        (r"Reserve\s+(Assumptions|Basis|Method)", 4.0),
        (r"Valuation\s+(Actuary|Date|Standard)", 3.5),
        (r"A/E\s+Ratio|Experience\s+Study", 3.0),
        (r"Credibility|Expected\s+Claims", 3.0),
        (r"Interest\s+Rate\s+Assumption", 2.5),
        (r"NAIC\s+Model\s+Regulation", 2.5),
    ],
    "FINANCIAL_STATEMENT": [
        (r"Balance\s+Sheet|Statement\s+of\s+Financial\s+Position", 5.0),
        (r"Income\s+Statement|Profit\s+and\s+Loss|P\s*&\s*L", 4.5),
        (r"Cash\s+Flow\s+Statement", 4.0),
        (r"Total\s+Assets|Total\s+Liabilities|Shareholders?\s+Equity", 4.0),
        (r"Revenue|Net\s+Income|Gross\s+Profit", 3.0),
        (r"Accounts\s+Receivable|Accounts\s+Payable", 3.0),
        (r"GAAP|IFRS|Statutory\s+Accounting", 3.0),
        (r"Audit(ed|or)|Auditor[']?s\s+Report", 3.0),
        (r"Fiscal\s+Year|Quarter(ly)?", 2.0),
    ],
    "LEGAL_MEMORANDUM": [
        (r"Memorandum\s+of\s+Law|Legal\s+Memorandum", 5.0),
        (r"Whereas|Hereinafter|Hereto\s+attached", 4.0),
        (r"Jurisdiction|Governing\s+Law|Venue", 3.5),
        (r"Plaintiff|Defendant|Petitioner|Respondent", 3.5),
        (r"In\s+re\s*:|Matter\s+of\s*:", 3.0),
        (r"Statute\s+of\s+Limitations|Precedent", 2.5),
        (r"Counsel|Esquire|Esq\.", 2.0),
    ],
}

# Minimum score needed to classify as a specific archetype (not GENERIC)
_CLASSIFICATION_THRESHOLD = 6.0


def classify_document(page_texts: List[Dict[str, Any]], max_pages: int = 5) -> Dict[str, Any]:
    """Classifies the document archetype by scanning the first N pages for
    domain-specific signal patterns.

    Args:
        page_texts: List of {"page": int, "text": str} dicts from the extractor.
        max_pages:  Maximum number of pages to scan (default: first 5 pages).

    Returns:
        Dict with keys:
            doc_type   (str)   — Detected archetype (e.g. "SERFF_FILING")
            confidence (float) — Normalised confidence score 0.0–1.0
            detected_signals (List[str]) — Human-readable signals that triggered classification
            scores (Dict[str, float]) — Raw scores per archetype for debugging
    """
    # Build a single text corpus from the first `max_pages` pages
    corpus_parts: List[str] = []
    for p in sorted(page_texts, key=lambda x: x["page"]):
        if p["page"] > max_pages:
            break
        corpus_parts.append(p.get("text", ""))
    corpus = "\n".join(corpus_parts)

    if not corpus.strip():
        return _make_result("GENERIC", 0.0, [], {})

    # Score each archetype by counting weighted signal matches
    archetype_scores: Dict[str, float] = {}
    triggered_signals: Dict[str, List[str]] = {}

    for archetype, signal_list in _SIGNALS.items():
        total_score = 0.0
        hits: List[str] = []
        for pattern, weight in signal_list:
            if re.search(pattern, corpus, re.IGNORECASE):
                total_score += weight
                hits.append(pattern)
        archetype_scores[archetype] = round(total_score, 2)
        triggered_signals[archetype] = hits

    # Pick winner: highest scoring archetype above threshold
    best_archetype = max(archetype_scores, key=archetype_scores.get)
    best_score = archetype_scores[best_archetype]

    if best_score < _CLASSIFICATION_THRESHOLD:
        # Not enough evidence — fall back to GENERIC
        logger.info(
            "Document classification: scores=%s — below threshold, using GENERIC",
            archetype_scores,
        )
        return _make_result("GENERIC", 0.0, [], archetype_scores)

    # Compute a normalised confidence: best_score / (best_score + sum_of_others)
    others_sum = sum(v for k, v in archetype_scores.items() if k != best_archetype)
    total = best_score + others_sum
    confidence = round(best_score / total, 3) if total > 0 else 1.0

    logger.info(
        "Document classified as %s (confidence=%.2f, score=%.1f)",
        best_archetype,
        confidence,
        best_score,
    )

    return _make_result(
        best_archetype,
        confidence,
        triggered_signals.get(best_archetype, []),
        archetype_scores,
    )


def _make_result(
    doc_type: str,
    confidence: float,
    detected_signals: List[str],
    scores: Dict[str, float],
) -> Dict[str, Any]:
    """Helper to build a consistent classification result dict."""
    return {
        "doc_type": doc_type,
        "confidence": confidence,
        "detected_signals": detected_signals,
        "scores": scores,
    }
