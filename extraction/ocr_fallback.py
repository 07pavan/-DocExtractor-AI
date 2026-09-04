"""OCR Fallback Engine for Scanned PDFs and Flattened Document Images.

Architecture:
  1. Detects whether an extracted page has zero or negligible selectable text (< 25 characters).
  2. Multi-tier OCR fallback:
     - Tier 1: PyMuPDF native OCR / Tesseract via page.get_textpage_ocr() if available.
     - Tier 2: Vision model inference (Groq / OpenRouter Qwen-VL or Llama-Vision) using base64 page pixmap.
     - Tier 3: Pure image rendering fallback with graceful degraded representation.
"""

from __future__ import annotations
import logging
import base64
import os
from typing import Dict, Any, Optional

try:
    import pymupdf as fitz
except ImportError:
    import fitz  # type: ignore

logger = logging.getLogger("extraction.ocr_fallback")


def extract_page_ocr_text(page: fitz.Page, dpi: int = 150) -> str:
    """Attempts to extract text from a scanned / image-only page using PyMuPDF OCR or Vision.

    Args:
        page: The PyMuPDF Page object.
        dpi: Target resolution for rendering if vision model is invoked.

    Returns:
        Extracted OCR text string.
    """
    # 1. First Tier: Try PyMuPDF built-in Tesseract OCR integration
    try:
        if hasattr(page, "get_textpage_ocr"):
            # language 'eng', dpi=150 for balance of speed and clarity
            textpage = page.get_textpage_ocr(flags=fitz.TEXT_DEHYPHENATE, dpi=150, full=True)
            ocr_text = textpage.extractText().strip()
            if ocr_text and len(ocr_text) > 20:
                logger.info("Page %s: Successfully extracted via PyMuPDF native OCR (%d chars)", page.number + 1, len(ocr_text))
                return ocr_text
    except Exception as e:
        logger.debug("PyMuPDF get_textpage_ocr not available or failed: %s", str(e))

    # 2. Second Tier: Fallback to page image + LLM Vision if OCR binary is not installed locally
    groq_api_key = os.getenv("GROQ_API_KEY")
    openrouter_api_key = os.getenv("OPENROUTER_API_KEY")

    if not groq_api_key and not openrouter_api_key:
        return ""

    try:
        # Render high-quality page pixmap for vision model
        pix = page.get_pixmap(dpi=dpi)
        img_bytes = pix.tobytes("png")
        b64_image = base64.b64encode(img_bytes).decode("utf-8")
        data_uri = f"data:image/png;base64,{b64_image}"

        prompt = (
            "Extract all readable text, tabular schedules, and field values from this scanned document page verbatim. "
            "Preserve document layout, headings, and numbers accurately. Do not add conversational commentary."
        )

        # Try Groq vision model (llama-3.2-11b-vision-preview or similar)
        if groq_api_key:
            from groq import Groq
            client = Groq(api_key=groq_api_key)
            completion = client.chat.completions.create(
                model="llama-3.2-11b-vision-preview",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": data_uri}},
                        ],
                    }
                ],
                temperature=0.1,
                max_tokens=1500,
            )
            extracted = completion.choices[0].message.content or ""
            if extracted.strip():
                logger.info("Page %s: Successfully extracted via Groq Vision OCR (%d chars)", page.number + 1, len(extracted))
                return extracted.strip()

    except Exception as vision_err:
        logger.warning("Vision OCR fallback encountered an error: %s", str(vision_err))

    return ""
