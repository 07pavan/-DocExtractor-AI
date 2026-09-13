import os
import time
import uuid
import asyncio
from datetime import datetime
from typing import Dict, Optional
from api.models import JobStatusResponse, DocumentTree
from extraction.converter import PDFConverter
from extraction.tree_builder import TreeBuilder


class JobManager:
    """
    Manages asynchronous PDF processing jobs for large documents.
    """

    def __init__(self):
        self._jobs: Dict[str, JobStatusResponse] = {}

    def create_job(self) -> str:
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        now = datetime.utcnow().isoformat() + "Z"
        self._jobs[job_id] = JobStatusResponse(
            job_id=job_id,
            status="pending",
            progress=0.0,
            message="Job queued for processing",
            created_at=now
        )
        return job_id

    def get_job(self, job_id: str) -> Optional[JobStatusResponse]:
        return self._jobs.get(job_id)

    def update_job(
        self,
        job_id: str,
        status: str,
        progress: float,
        message: str = "",
        result: Optional[DocumentTree] = None,
        error: Optional[str] = None
    ):
        if job_id in self._jobs:
            job = self._jobs[job_id]
            job.status = status
            job.progress = progress
            job.message = message
            if result is not None:
                job.result = result
            if error is not None:
                job.error = error
            if status in ("completed", "failed"):
                job.completed_at = datetime.utcnow().isoformat() + "Z"

    async def run_async_extraction(self, job_id: str, temp_pdf_path: str, filename: str):
        """Executes PDF conversion and tree building in background thread."""
        start_time = time.time()
        try:
            self.update_job(job_id, status="processing", progress=10.0, message="Inspecting PDF document...")
            await asyncio.sleep(0.05)

            # Inspect metadata
            meta = await asyncio.to_thread(PDFConverter.inspect_pdf, temp_pdf_path)
            total_pages = meta.get("page_count", 1)

            self.update_job(
                job_id,
                status="processing",
                progress=30.0,
                message=f"Converting {total_pages} pages to Markdown with pymupdf4llm..."
            )

            # Convert with pymupdf4llm in background thread
            page_chunks, full_md = await asyncio.to_thread(
                PDFConverter.convert_to_markdown_chunks,
                temp_pdf_path
            )

            self.update_job(
                job_id,
                status="processing",
                progress=75.0,
                message="Parsing heading hierarchy and detecting tables..."
            )

            # Build tree
            duration = time.time() - start_time
            tree = await asyncio.to_thread(
                TreeBuilder.build_tree_from_page_chunks,
                page_chunks=page_chunks,
                filename=filename,
                full_markdown=full_md,
                processing_time=duration
            )

            self.update_job(
                job_id,
                status="completed",
                progress=100.0,
                message=f"Successfully extracted {tree.total_sections} sections & {tree.total_tables} tables in {tree.processing_time_sec}s",
                result=tree
            )

        except Exception as e:
            self.update_job(
                job_id,
                status="failed",
                progress=100.0,
                message=f"Extraction failed: {str(e)}",
                error=str(e)
            )
        finally:
            # Clean up temp file safely
            if os.path.exists(temp_pdf_path):
                try:
                    os.remove(temp_pdf_path)
                except Exception:
                    pass


# Singleton instance
job_manager = JobManager()
