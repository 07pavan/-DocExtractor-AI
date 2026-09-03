"""Field parser for detecting and extracting 'Label: Value' structured pairs from body text.
"""

from __future__ import annotations
import re
from typing import List, Tuple, Optional
from extraction.models import FieldItem

# Regex pattern to match "Label: Value" patterns
# Label: 1 to 60 characters, typically words/numbers/dashes/spaces, ending with a colon
# Avoid matching full conversational sentences containing colons (e.g., "The following items were found: first, second...")
LABEL_VALUE_REGEX = re.compile(
    r"^(?P<label>[A-Za-z0-9\s\/\-#\.\(\)&]{1,60}?)\s*:\s*(?P<value>.+)$"
)

# Common words that might start a narrative sentence with a colon rather than a key-value field
NARRATIVE_PREFIXES = {
    "note", "warning", "tip", "caution", "important", "example",
    "http", "https", "see", "refer to", "please note"
}


def parse_field_line(line: str) -> Optional[FieldItem]:
    """Attempts to parse a single line into a FieldItem (label, value).
    Returns None if the line is not a valid field line.
    """
    cleaned = line.strip()
    if not cleaned or ":" not in cleaned:
        return None

    match = LABEL_VALUE_REGEX.match(cleaned)
    if not match:
        return None

    label = match.group("label").strip()
    value = match.group("value").strip()

    if not label or not value:
        return None

    # Check if label is a common narrative prefix with long prose
    if label.lower() in NARRATIVE_PREFIXES and len(value.split()) > 10:
        return None

    # Labels usually don't have multiple commas or sentence-ending periods in the middle
    if label.count(",") > 1 or label.endswith("."):
        return None

    return FieldItem(label=label, value=value)


def extract_fields_from_body_lines(lines: List[str]) -> Tuple[List[FieldItem], str]:
    """Given a list of body text lines:
    1. Extracts all 'Label: Value' structured pairs as FieldItems.
    2. Collects the non-field or full body text as clean raw text.
    
    Returns:
        tuple of (fields, body_text)
    """
    fields: List[FieldItem] = []
    body_lines: List[str] = []

    for line in lines:
        cleaned = line.strip()
        if not cleaned:
            continue

        field_item = parse_field_line(cleaned)
        if field_item:
            fields.append(field_item)
        else:
            body_lines.append(cleaned)

    body_text = "\n".join(body_lines)
    return fields, body_text
