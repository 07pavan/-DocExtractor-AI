"""Unit tests for the authenticated FastAPI extraction backend endpoints.
"""

import os
import time
from pathlib import Path
from unittest.mock import patch, MagicMock
import pytest
import jwt
from fastapi.testclient import TestClient

# Set test JWT secret
TEST_JWT_SECRET = "test-supabase-jwt-secret-for-unit-tests-123456"
os.environ["SUPABASE_JWT_SECRET"] = TEST_JWT_SECRET
os.environ["SUPABASE_URL"] = "https://mock-supabase.supabase.co"
os.environ["SUPABASE_SERVICE_KEY"] = "mock-service-key"

from api.main import app
from tests.test_parser import SAMPLE_PDFS_DIR, create_mock_sample_pdf

client = TestClient(app)


def create_test_token(user_id: str = "user-123", expired: bool = False) -> str:
    """Helper to generate signed Supabase JWTs for testing."""
    exp = time.time() + (-3600 if expired else 3600)
    payload = {
        "sub": user_id,
        "aud": "authenticated",
        "role": "authenticated",
        "exp": exp,
    }
    return jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")


def test_health_endpoint_unauthenticated():
    """Verify GET /health remains accessible without authentication."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_extract_missing_auth():
    """Verify POST /extract returns 401 when Authorization header is omitted."""
    response = client.post(
        "/extract",
        files={"document": ("test.pdf", b"%PDF-1.4 Mock", "application/pdf")},
    )
    assert response.status_code == 401
    assert "Missing Authorization header" in response.json()["detail"]


def test_extract_expired_token():
    """Verify POST /extract returns 401 when token has expired."""
    token = create_test_token(expired=True)
    response = client.post(
        "/extract",
        headers={"Authorization": f"Bearer {token}"},
        files={"document": ("test.pdf", b"%PDF-1.4 Mock", "application/pdf")},
    )
    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()


def test_extract_invalid_file_type():
    """Verify POST /extract returns 400 when authenticated user uploads non-PDF file."""
    token = create_test_token()
    response = client.post(
        "/extract",
        headers={"Authorization": f"Bearer {token}"},
        files={"document": ("test.txt", b"Hello world", "text/plain")},
    )
    assert response.status_code == 400
    assert "Invalid file format" in response.json()["detail"]


@patch("api.main.save_extraction")
def test_extract_valid_pdf_authenticated(mock_save_extraction):
    """Verify POST /extract processes PDF, persists result, and returns extraction + document_id."""
    mock_save_extraction.return_value = {
        "document_id": "doc-uuid-9999",
        "extraction_id": "ext-uuid-8888",
    }

    sample_pdf = SAMPLE_PDFS_DIR / "sample_policy_statement.pdf"
    if not sample_pdf.exists():
        create_mock_sample_pdf(sample_pdf)

    token = create_test_token(user_id="user-xyz")

    with open(sample_pdf, "rb") as f:
        response = client.post(
            "/extract",
            headers={"Authorization": f"Bearer {token}"},
            files={"document": ("sample_policy_statement.pdf", f, "application/pdf")},
        )

    assert response.status_code == 200
    data = response.json()

    # Validate document_id attached
    assert data["document_id"] == "doc-uuid-9999"
    assert "heading" in data
    assert "level" in data
    assert "fields" in data
    assert "subsections" in data

    # Verify db save was called with user_id and filename
    mock_save_extraction.assert_called_once()
    call_args = mock_save_extraction.call_args[1]
    assert call_args["user_id"] == "user-xyz"
    assert call_args["filename"] == "sample_policy_statement.pdf"


def test_get_documents_missing_auth():
    """Verify GET /documents returns 401 without auth."""
    response = client.get("/documents")
    assert response.status_code == 401


@patch("api.main.get_user_documents")
def test_get_documents_authenticated(mock_get_docs):
    """Verify GET /documents returns list of documents for authenticated user."""
    mock_get_docs.return_value = [
        {
            "id": "doc-1",
            "filename": "policy1.pdf",
            "uploaded_at": "2024-01-01T00:00:00Z",
        },
        {
            "id": "doc-2",
            "filename": "policy2.pdf",
            "uploaded_at": "2024-01-02T00:00:00Z",
        },
    ]

    token = create_test_token(user_id="user-abc")
    response = client.get("/documents", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["filename"] == "policy1.pdf"
    mock_get_docs.assert_called_once_with(user_id="user-abc")


@patch("api.main.get_document_extraction")
def test_get_document_by_id(mock_get_doc_ext):
    """Verify GET /documents/{id} returns extraction details."""
    mock_get_doc_ext.return_value = {
        "document_id": "doc-1",
        "filename": "policy1.pdf",
        "uploaded_at": "2024-01-01T00:00:00Z",
        "sections": {"heading": "Policy", "level": 1, "page": 1, "text": "", "fields": [], "subsections": []},
    }

    token = create_test_token(user_id="user-abc")
    response = client.get("/documents/doc-1", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    data = response.json()
    assert data["document_id"] == "doc-1"
    assert data["sections"]["heading"] == "Policy"


@patch("api.main.get_document_extraction")
def test_get_document_by_id_not_found(mock_get_doc_ext):
    """Verify GET /documents/{id} returns 404 if document does not exist or belongs to another user."""
    mock_get_doc_ext.return_value = None

    token = create_test_token(user_id="user-abc")
    response = client.get("/documents/doc-missing", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@patch("api.main.delete_user_document")
def test_delete_document_authenticated(mock_delete):
    """Verify DELETE /documents/{id} deletes document successfully."""
    mock_delete.return_value = True

    token = create_test_token(user_id="user-abc")
    response = client.delete("/documents/doc-123", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["status"] == "success"
    mock_delete.assert_called_once_with(user_id="user-abc", document_id="doc-123")


@patch("api.main.delete_user_document")
def test_delete_document_not_found(mock_delete):
    """Verify DELETE /documents/{id} returns 404 if document not found."""
    mock_delete.return_value = False

    token = create_test_token(user_id="user-abc")
    response = client.delete("/documents/doc-missing", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
