"""Pydantic data models for FastAPI requests and responses.
"""

from __future__ import annotations
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class DocumentSummary(BaseModel):
    """Lightweight document representation for listing user documents."""
    id: str
    filename: str
    uploaded_at: str


class DocumentDetail(BaseModel):
    """Full document detail with associated extraction data."""
    document_id: str
    filename: str
    uploaded_at: str
    sections: Dict[str, Any]


class ExtractionResponse(BaseModel):
    """Response returned by POST /extract endpoint including document ID and extraction tree."""
    document_id: str
    heading: str
    level: int
    page: int
    text: str = ""
    fields: List[Dict[str, str]] = Field(default_factory=list)
    subsections: List[Dict[str, Any]] = Field(default_factory=list)
