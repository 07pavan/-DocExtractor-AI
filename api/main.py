"""FastAPI backend application for authenticated PDF extraction and persistence.
"""

import logging
from typing import Dict, Any, List
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables from .env file
load_dotenv()

from extraction.parser import extract_document
from api.auth import get_current_user
from api.db import (
    save_extraction,
    get_user_documents,
    get_document_extraction,
    delete_user_document,
)
from api.models import DocumentSummary, DocumentDetail, ExtractionResponse

# Setup server logger
logger = logging.getLogger("api.main")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="PDF Extraction API",
    description="Authenticated HTTP API for extracting and persisting structured headings, body text, and key-value fields from PDF documents.",
    version="1.0.0",
)

# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.get("/health", tags=["Health"])
async def health_check() -> Dict[str, str]:
    """Health check endpoint to verify service availability (unauthenticated)."""
    return {"status": "ok"}


@app.post("/extract", response_model=ExtractionResponse, tags=["Extraction"])
async def extract_pdf(
    document: UploadFile = File(..., description="PDF file to extract structure from"),
    user_id: str = Depends(get_current_user),
) -> Dict[str, Any]:
    """Extracts hierarchical headings, body text, and structured key-value fields from an uploaded PDF,

    and persists the result in Supabase Postgres. Requires JWT authentication.
    """
    filename = document.filename or "uploaded_document.pdf"
    content_type = document.content_type or ""

    # Validate file extension and/or MIME content-type
    is_pdf_extension = filename.lower().endswith(".pdf")
    is_pdf_content_type = (
        content_type.lower() in [
            "application/pdf",
            "application/x-pdf",
            "application/acrobat",
            "applications/vnd.pdf",
            "text/pdf",
            "text/x-pdf",
        ]
        or "pdf" in content_type.lower()
    )

    if not is_pdf_extension and not is_pdf_content_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only PDF files are supported (expected .pdf extension or application/pdf MIME type).",
        )

    try:
        pdf_bytes = await document.read()
        if not pdf_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )

        # 1. Run core extraction logic
        extracted_data = extract_document(pdf_bytes, filename=filename)

        # 2. Persist document and extraction into Supabase Postgres
        save_result = save_extraction(
            user_id=user_id,
            filename=filename,
            sections=extracted_data,
        )

        document_id = save_result.get("document_id", "")

        # 3. Return extraction JSON augmented with the new document_id
        response_payload = dict(extracted_data)
        response_payload["document_id"] = document_id
        return response_payload

    except HTTPException:
        # Re-raise HTTPExceptions directly
        raise
    except Exception as exc:
        # Log full stack trace server-side and return a clean 500 error to the client
        logger.exception("An error occurred during PDF extraction: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing the PDF document: {str(exc)}",
        ) from exc


@app.get("/documents", response_model=List[DocumentSummary], tags=["Documents"])
async def list_documents(
    user_id: str = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Retrieves a lightweight list of all uploaded documents for the authenticated user."""
    try:
        return get_user_documents(user_id=user_id)
    except Exception as exc:
        logger.exception("Failed to retrieve user documents: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve documents.",
        ) from exc


@app.get("/documents/{document_id}", response_model=DocumentDetail, tags=["Documents"])
async def get_document(
    document_id: str,
    user_id: str = Depends(get_current_user),
) -> Dict[str, Any]:
    """Retrieves full extraction structure for a specific document belonging to the user.

    Returns 404 if not found or not owned by this user.
    """
    try:
        document_extraction = get_document_extraction(user_id=user_id, document_id=document_id)
        if not document_extraction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document '{document_id}' not found or you do not have permission to view it.",
            )
        return document_extraction
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to retrieve document extraction: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve document details.",
        ) from exc


@app.delete("/documents/{document_id}", tags=["Documents"])
async def delete_document(
    document_id: str,
    user_id: str = Depends(get_current_user),
) -> Dict[str, Any]:
    """Deletes a document and its extraction history belonging to the user.

    Returns 404 if not found or unauthorized.
    """
    try:
        success = delete_user_document(user_id=user_id, document_id=document_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document '{document_id}' not found or you do not have permission to delete it.",
            )
        return {
            "status": "success",
            "message": f"Document '{document_id}' successfully deleted.",
            "document_id": document_id,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to delete document: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document.",
        ) from exc
