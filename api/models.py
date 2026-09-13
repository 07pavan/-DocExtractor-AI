from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class TableData(BaseModel):
    id: str = Field(..., description="Unique ID for the table")
    section_id: str = Field(..., description="ID of the containing section")
    headers: List[str] = Field(default_factory=list, description="Table column headers")
    rows: List[List[str]] = Field(default_factory=list, description="Table rows data")
    raw_markdown: str = Field(..., description="Raw GFM markdown table representation")
    row_count: int = 0
    col_count: int = 0
    page: int = 1


class SectionNode(BaseModel):
    id: str = Field(..., description="Unique identifier for the section")
    title: str = Field(..., description="Heading title or section name")
    level: int = Field(..., description="Heading level (1=H1, 2=H2, 3=H3, ..., 0=Preamble/Root)")
    page_start: int = Field(1, description="First page where this section appears")
    page_end: int = Field(1, description="Last page where this section or its content extends")
    content: str = Field("", description="Markdown content within this section excluding nested sub-sections")
    raw_markdown: str = Field("", description="Full markdown snippet including heading tag")
    word_count: int = 0
    table_count: int = 0
    tables: List[TableData] = Field(default_factory=list)
    children: List["SectionNode"] = Field(default_factory=list, description="Sub-sections nested under this heading")


# Resolve recursive self-referencing model for Pydantic v2
SectionNode.model_rebuild()


class DocumentTree(BaseModel):
    filename: str
    total_pages: int
    total_sections: int
    total_tables: int
    total_words: int
    toc: List[SectionNode] = Field(default_factory=list, description="Hierarchical tree of headings")
    flat_sections: Dict[str, Any] = Field(default_factory=dict, description="Flattened section map by ID for instant O(1) lookup")
    raw_markdown: str = Field("", description="Combined full document markdown")
    processing_time_sec: float = 0.0


class JobStatusResponse(BaseModel):
    job_id: str
    status: str = Field(..., description="pending, processing, completed, or failed")
    progress: float = Field(0.0, description="Progress percentage 0 to 100")
    message: str = ""
    result: Optional[DocumentTree] = None
    error: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None


class SampleInfo(BaseModel):
    filename: str
    size_bytes: int
    description: str
