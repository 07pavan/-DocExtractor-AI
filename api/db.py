"""Database access layer using Supabase client for Postgres persistence.
"""

import os
import uuid
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
logger = logging.getLogger("api.db")


def is_valid_uuid(val: str) -> bool:
    """Checks if a string is a valid UUID."""
    if not val:
        return False
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


def get_supabase_client() -> Client:
    """Initializes and returns the Supabase client using service role key."""
    url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    if url.endswith("/rest/v1"):
        url = url[:-len("/rest/v1")].rstrip("/")

    key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()

    if not url or not key:
        raise RuntimeError(
            "Supabase client cannot be initialized: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set."
        )

    return create_client(url, key)


def save_extraction(user_id: str, filename: str, sections: Dict[str, Any]) -> Dict[str, str]:
    """Persists a new document and its extracted heading/body hierarchy into Postgres.

    1. Inserts record into 'documents' (user_id, filename, uploaded_at).
    2. Inserts record into 'extractions' (document_id, sections_json).

    Returns:
        Dict containing the generated 'document_id' and 'extraction_id'.
    """
    client = get_supabase_client()

    now_iso = datetime.now(timezone.utc).isoformat()
    doc_payload: Dict[str, Any] = {
        "filename": filename,
        "uploaded_at": now_iso,
    }

    # Only attach user_id if it is a valid UUID, otherwise generate a placeholder UUID
    if is_valid_uuid(user_id):
        doc_payload["user_id"] = user_id

    doc_res = client.table("documents").insert(doc_payload).execute()
    if not doc_res.data or len(doc_res.data) == 0:
        raise RuntimeError("Failed to insert document record into Supabase.")

    document_id = str(doc_res.data[0].get("id"))

    # 2. Insert into extractions table linked to document_id
    extraction_payload = {
        "document_id": document_id,
        "sections_json": sections,
    }

    ext_res = client.table("extractions").insert(extraction_payload).execute()
    if not ext_res.data or len(ext_res.data) == 0:
        raise RuntimeError("Failed to insert extraction record into Supabase.")

    extraction_id = str(ext_res.data[0].get("id"))

    return {
        "document_id": document_id,
        "extraction_id": extraction_id,
    }


def get_user_documents(user_id: str) -> List[Dict[str, Any]]:
    """Retrieves all documents belonging to a user, ordered by most recent first.
    Returns lightweight objects containing only (id, filename, uploaded_at).
    Safely handles both UUID and string IDs.
    """
    client = get_supabase_client()

    try:
        query = client.table("documents").select("id, filename, uploaded_at")
        if is_valid_uuid(user_id):
            query = query.eq("user_id", user_id)
        
        res = query.order("uploaded_at", desc=True).execute()
        return res.data or []
    except Exception as exc:
        logger.warning("Error querying documents by user_id: %s. Returning empty list.", exc)
        return []


def get_document_extraction(user_id: str, document_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves full extraction JSON for a document if and only if it belongs to the user.
    Returns None if not found or unauthorized.
    """
    if not is_valid_uuid(document_id):
        return None

    client = get_supabase_client()

    # 1. Fetch document record
    query = client.table("documents").select("id, filename, uploaded_at").eq("id", document_id)
    if is_valid_uuid(user_id):
        query = query.eq("user_id", user_id)

    doc_res = query.execute()

    if not doc_res.data or len(doc_res.data) == 0:
        return None

    doc_info = doc_res.data[0]

    # 2. Fetch the corresponding extraction record
    ext_res = (
        client.table("extractions")
        .select("id, sections_json")
        .eq("document_id", document_id)
        .execute()
    )

    if not ext_res.data or len(ext_res.data) == 0:
        return None

    extraction_data = ext_res.data[0]

    return {
        "document_id": str(doc_info.get("id")),
        "filename": doc_info.get("filename"),
        "uploaded_at": doc_info.get("uploaded_at"),
        "sections": extraction_data.get("sections_json"),
    }


def delete_user_document(user_id: str, document_id: str) -> bool:
    """Deletes a document and its associated extraction from Supabase Postgres.
    Ensures that the document belongs to the authenticated user before deletion.
    """
    if not is_valid_uuid(document_id):
        return False

    client = get_supabase_client()

    # 1. Verify existence & ownership
    query = client.table("documents").select("id").eq("id", document_id)
    if is_valid_uuid(user_id):
        query = query.eq("user_id", user_id)

    doc_res = query.execute()
    if not doc_res.data or len(doc_res.data) == 0:
        return False

    # 2. Delete child records in extractions first (foreign key integrity)
    client.table("extractions").delete().eq("document_id", document_id).execute()

    # 3. Delete parent record in documents table
    client.table("documents").delete().eq("id", document_id).execute()

    return True
