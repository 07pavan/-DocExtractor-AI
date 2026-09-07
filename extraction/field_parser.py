"""Field parser for extracting structured 'Label: Value' pairs from raw PDF lines.
Supports single-line ('Company: New York Life') and adjacent multi-line ('Company:\nNew York Life') layouts.
"""

from __future__ import annotations
import re
from typing import List, Tuple, Optional
from extraction.models import FieldItem

# Regex pattern for single line "Label: Value"
LABEL_VALUE_REGEX = re.compile(
    r"^(?P<label>[A-Za-z0-9\s\/\-#\.\(\)&_]{1,60}?)\s*:\s*(?P<value>.+)$"
)

# Regex pattern for a label ending with colon alone on its line e.g. "Company:"
LABEL_ONLY_REGEX = re.compile(
    r"^(?P<label>[A-Za-z0-9\s\/\-#\.\(\)&_]{1,60}?)\s*:$"
)

NARRATIVE_PREFIXES = {
    "note", "warning", "tip", "caution", "important", "example",
    "http", "https", "see", "refer to", "please note"
}


def parse_field_line(line: str) -> Optional[FieldItem]:
    """Attempts to parse a single line into a FieldItem (label, value)."""
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

    if label.lower() in NARRATIVE_PREFIXES and len(value.split()) > 10:
        return None

    if label.count(",") > 1 or label.endswith("."):
        return None

    return FieldItem(label=label, value=value)


def extract_fields_from_body_lines(lines: List[str]) -> Tuple[List[FieldItem], str]:
    """Given a list of body text lines:
    1. Extracts 'Label: Value' on the same line.
    2. Extracts adjacent lines where line i is 'Label:' and line i+1 is 'Value'.
    3. Preserves remaining non-field narrative as clean body text.
    """
    fields: List[FieldItem] = []
    body_lines: List[str] = []

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        # Case 1: "Label: Value" on the same line
        field_item = parse_field_line(line)
        if field_item:
            fields.append(field_item)
            i += 1
            continue

        # Case 2: "Label:" on line i and value on line i+1
        label_match = LABEL_ONLY_REGEX.match(line)
        if label_match and (i + 1) < len(lines):
            next_line = lines[i + 1].strip()
            # If next line is not another label or section header
            if next_line and not LABEL_ONLY_REGEX.match(next_line) and not next_line.endswith(":"):
                label = label_match.group("label").strip()
                if label.lower() not in NARRATIVE_PREFIXES:
                    fields.append(FieldItem(label=label, value=next_line))
                    i += 2
                    continue
            elif not next_line:
                # Value is empty
                label = label_match.group("label").strip()
                fields.append(FieldItem(label=label, value=""))
                i += 2
                continue

        # Otherwise it's narrative body text
        body_lines.append(line)
        i += 1

    body_text = "\n".join(body_lines)
    return fields, body_text
