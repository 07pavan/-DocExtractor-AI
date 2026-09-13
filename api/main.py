import os
import time
import tempfile
import asyncio
from typing import List, Dict, Any
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.models import DocumentTree, JobStatusResponse, SampleInfo
from api.job_manager import job_manager
from extraction.converter import PDFConverter
from extraction.tree_builder import TreeBuilder

app = FastAPI(
    title="DocExtractor AI - PDF Heading Hierarchy & Table Extraction API",
    description="High-performance hierarchical PDF structure extraction using pymupdf4llm and FastAPI",
    version="2.0.0"
)

# Enable CORS for frontend local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for flexible local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SAMPLE_PDF_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "tests", "sample_pdfs")


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "DocExtractor AI Engine",
        "library": "pymupdf4llm",
        "version": "2.0.0"
    }


@app.get("/api/samples", response_model=List[SampleInfo])
def list_sample_pdfs():
    """Lists available sample PDFs in the workspace for instant demo testing."""
    samples = []
    if os.path.exists(SAMPLE_PDF_DIR):
        for f in os.listdir(SAMPLE_PDF_DIR):
            if f.lower().endswith(".pdf"):
                path = os.path.join(SAMPLE_PDF_DIR, f)
                size = os.path.getsize(path)
                desc = "Sample document"
                if "AMGN" in f or "NYLM" in f or "UNAM" in f:
                    desc = "Multi-page insurance filing with borderless tables"
                elif "Resume" in f:
                    desc = "Single-page structured resume with sections"
                elif "complaint" in f:
                    desc = "Legal complaint document"

                samples.append(SampleInfo(
                    filename=f,
                    size_bytes=size,
                    description=desc
                ))
    return samples


@app.post("/api/extract", response_model=DocumentTree)
async def extract_pdf_sync(file: UploadFile = File(...)):
    """
    Synchronously extracts heading hierarchy and tables from uploaded PDF.
    Recommended for PDFs under 30 pages.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files (.pdf) are supported.")

    start_time = time.time()
    
    # Save to temp file
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Convert PDF
        page_chunks, full_md = await asyncio.to_thread(
            PDFConverter.convert_to_markdown_chunks,
            tmp_path
        )
        duration = time.time() - start_time

        # Build hierarchical tree
        tree = await asyncio.to_thread(
            TreeBuilder.build_tree_from_page_chunks,
            page_chunks=page_chunks,
            filename=file.filename,
            full_markdown=full_md,
            processing_time=duration
        )
        return tree
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF extraction error: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass


@app.post("/api/extract/async")
async def extract_pdf_async(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    Asynchronously queues a PDF for extraction. Ideal for large (100+ pages) documents.
    Returns a job_id immediately which can be polled via GET /api/jobs/{job_id}.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files (.pdf) are supported.")

    # Save to temp file
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    job_id = job_manager.create_job()
    background_tasks.add_task(
        job_manager.run_async_extraction,
        job_id=job_id,
        temp_pdf_path=tmp_path,
        filename=file.filename
    )

    return {
        "job_id": job_id,
        "filename": file.filename,
        "message": "Job queued successfully. Poll /api/jobs/{job_id} for progress and results."
    }


@app.get("/api/jobs/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: str):
    """Polls extraction status and retrieves the result document tree once completed."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")
    return job


@app.post("/api/extract/sample/{sample_name}", response_model=DocumentTree)
async def extract_sample_pdf(sample_name: str):
    """Extracts a bundled sample PDF directly without re-uploading."""
    sample_path = os.path.join(SAMPLE_PDF_DIR, sample_name)
    if not os.path.exists(sample_path):
        raise HTTPException(status_code=404, detail=f"Sample PDF '{sample_name}' not found.")

    start_time = time.time()
    try:
        page_chunks, full_md = await asyncio.to_thread(
            PDFConverter.convert_to_markdown_chunks,
            sample_path
        )
        duration = time.time() - start_time

        tree = await asyncio.to_thread(
            TreeBuilder.build_tree_from_page_chunks,
            page_chunks=page_chunks,
            filename=sample_name,
            full_markdown=full_md,
            processing_time=duration
        )
        return tree
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sample PDF extraction error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="127.0.0.1", port=8000, reload=True)
