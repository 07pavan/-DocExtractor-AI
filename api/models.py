"""Pydantic data models for FastAPI requests and responses.
"""

from __future__ import annotations
from typing import List, Dict, Any, Optional, Union
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


class DynamicSectionModel(BaseModel):
    """Dynamic section model: variable-length section node with confidence score."""
    section_type: str = "general"
    title: str = ""
    heading: Optional[str] = None
    level: int = 1
    page: int = 1
    confidence: float = 1.0
    text: str = ""
    fields: Union[Dict[str, Any], List[Dict[str, Any]]] = Field(default_factory=dict)
    tables: List[Dict[str, Any]] = Field(default_factory=list)
    subsections: List[Dict[str, Any]] = Field(default_factory=list)


class ExtractionResponse(BaseModel):
    """Response returned by POST /extract endpoint with dynamic variable-length sections."""
    document_id: str
    heading: str
    level: int = 0
    page: int = 1
    text: str = ""
    fields: Union[Dict[str, Any], List[Dict[str, Any]]] = Field(default_factory=list)
    sections: List[Dict[str, Any]] = Field(default_factory=list)
    subsections: List[Dict[str, Any]] = Field(default_factory=list)
    summary: Optional[Dict[str, Any]] = None
