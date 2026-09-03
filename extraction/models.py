"""Data models for extracted PDF document structure.
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional


@dataclass
class FieldItem:
    """Represents a 'Label: Value' structured pair."""
    label: str
    value: str

    def to_dict(self) -> Dict[str, str]:
        return {
            "label": self.label,
            "value": self.value,
        }


@dataclass
class SectionNode:
    """Represents a hierarchical section containing heading, body text,

    key-value fields, structured tables, and nested subsections.
    """
    heading: str
    level: int
    page: int
    text: str = ""
    fields: List[FieldItem] = field(default_factory=list)
    tables: List[Dict[str, Any]] = field(default_factory=list)
    subsections: List[SectionNode] = field(default_factory=list)
    summary: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert SectionNode recursively to the required dictionary shape."""
        data: Dict[str, Any] = {
            "heading": self.heading,
            "level": self.level,
            "page": self.page,
            "text": self.text,
            "fields": [f.to_dict() if isinstance(f, FieldItem) else f for f in self.fields],
            "subsections": [s.to_dict() for s in self.subsections],
        }
        if self.tables:
            data["tables"] = self.tables
        if self.summary:
            data["summary"] = self.summary
        return data


@dataclass
class SpanInfo:
    """Internal model for an extracted text span from PyMuPDF."""
    text: str
    font_size: float
    font_name: str
    is_bold: bool
    bbox: tuple[float, float, float, float]  # (x0, y0, x1, y1)
    page_num: int


@dataclass
class LineInfo:
    """Internal model for a unified text line composed of spans."""
    text: str
    spans: List[SpanInfo]
    bbox: tuple[float, float, float, float]  # (x0, y0, x1, y1)
    page_num: int
    primary_font_size: float
    is_bold: bool
    is_boilerplate: bool = False
    is_heading: bool = False
    heading_score: float = 0.0
    heading_level: Optional[int] = None
    margin_top: float = 0.0
    margin_bottom: float = 0.0
