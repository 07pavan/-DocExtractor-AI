import os
import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["library"] == "pymupdf4llm"


def test_samples_endpoint():
    response = client.get("/api/samples")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert any("AMGN" in s["filename"] for s in data)


def test_extract_sample_pdf_endpoint():
    response = client.post("/api/extract/sample/AMGN-135003565.pdf")
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "AMGN-135003565.pdf"
    assert data["total_pages"] > 0
    assert data["total_sections"] > 0
    assert len(data["toc"]) > 0
    assert "flat_sections" in data
