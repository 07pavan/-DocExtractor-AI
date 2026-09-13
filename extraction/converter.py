import os
import fitz  # PyMuPDF
import pymupdf4llm
from typing import List, Dict, Any, Tuple


class PDFConverter:
    """
    Converts PDF documents to structured Markdown using pymupdf4llm.
    Supports multi-page documents, borderless tables, and mixed orientations.
    """

    @staticmethod
    def inspect_pdf(pdf_path: str) -> Dict[str, Any]:
        """Returns high-level metadata about the PDF."""
        doc = fitz.open(pdf_path)
        page_count = len(doc)
        metadata = doc.metadata or {}
        doc.close()
        return {
            "page_count": page_count,
            "title": metadata.get("title", ""),
            "author": metadata.get("author", ""),
            "subject": metadata.get("subject", ""),
            "keywords": metadata.get("keywords", ""),
        }

    @staticmethod
    def convert_to_markdown_chunks(pdf_path: str) -> Tuple[List[Dict[str, Any]], str]:
        """
        Converts PDF to page chunks with metadata and markdown text.
        
        Returns:
            page_chunks: List of dicts with keys ['metadata', 'toc_items', 'page_boxes', 'text']
            full_markdown: Consolidated Markdown text of entire document
        """
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF file not found at: {pdf_path}")

        # Extract per-page markdown chunks
        chunks = pymupdf4llm.to_markdown(
            pdf_path,
            page_chunks=True,
            write_images=False,
            extract_words=False
        )

        full_markdown_parts = []
        for idx, chunk in enumerate(chunks):
            page_num = idx + 1
            # Ensure page number is tagged in chunk metadata if not present
            if "metadata" not in chunk or not chunk["metadata"]:
                chunk["metadata"] = {"page": page_num}
            else:
                chunk["metadata"]["page"] = page_num
            
            text = chunk.get("text", "")
            full_markdown_parts.append(text)

        full_markdown = "\n\n".join(full_markdown_parts)
        return chunks, full_markdown
