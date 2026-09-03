import { useState, useEffect } from 'react';
import { useAuth } from './AuthGate';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

async function fetchWithFallback(endpoint, options) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const candidateBases = [
    API_BASE_URL,
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    '/api',
  ].filter(Boolean);

  const uniqueBases = Array.from(new Set(candidateBases));
  let lastResponse = null;
  let lastError = null;

  for (const base of uniqueBases) {
    const url = `${base.replace(/\/$/, '')}${cleanEndpoint}`;
    try {
      const res = await fetch(url, options);
      if (res.status !== 404) {
        return res;
      }
      lastResponse = res;
    } catch (err) {
      lastError = err;
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error('Backend server is not reachable.');
}

export default function Dashboard({ onSelectDocument, activeDocumentId, onDeleteActiveDocument }) {
  const { session } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchDocuments = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetchWithFallback('/documents', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load documents (${res.status})`);
      }

      const data = await res.json();
      setDocuments(data || []);
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [session]);

  const handleDocumentClick = async (docId) => {
    if (!session?.access_token) return;
    try {
      const res = await fetchWithFallback(`/documents/${docId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load document details (${res.status})`);
      }

      const docDetail = await res.json();
      onSelectDocument(docDetail);
    } catch (err) {
      alert(`Error loading document: ${err.message}`);
    }
  };

  const handleDeleteDocument = async (e, docId) => {
    e.stopPropagation();
    if (!session?.access_token) return;

    setDeletingId(docId);
    try {
      const res = await fetchWithFallback(`/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to delete document (${res.status})`);
      }

      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setDeleteConfirmId(null);

      if (activeDocumentId === docId && onDeleteActiveDocument) {
        onDeleteActiveDocument();
      }
    } catch (err) {
      alert(`Error deleting document: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredDocs = documents.filter((doc) => {
    if (!searchQuery.trim()) return true;
    return doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="card-specify space-y-4">
      {/* Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-mist">
        <div>
          <div className="flex items-center space-x-2.5">
            <h3 className="text-base font-bold text-studio-slate">Document Vault</h3>
            <span className="pill-badge !text-xs !py-0.5 !px-2.5 !bg-cloud !text-studio-slate">
              {documents.length}
            </span>
          </div>
          <p className="text-xs text-iron mt-0.5">
            Access and revisit past extractions anytime with zero LLM re-computation.
          </p>
        </div>

        <button
          onClick={fetchDocuments}
          disabled={loading}
          className="btn-pill-ghost !text-xs !py-1.5 !px-3.5"
        >
          <span>↻</span>
          <span>{loading ? 'Refreshing...' : 'Refresh List'}</span>
        </button>
      </div>

      {/* Search Filter */}
      {documents.length > 3 && (
        <div className="relative">
          <input
            type="text"
            placeholder="Search saved documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-2 bg-cloud border border-mist focus:border-iris rounded-control focus:outline-none transition shadow-subtle-2 text-studio-slate"
          />
          <span className="absolute left-2.5 top-2.5 text-graphite text-xs">🔍</span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-graphite hover:text-studio-slate text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-control border border-red-200">
          {error}
        </div>
      )}

      {/* Document List Cards */}
      {loading && documents.length === 0 ? (
        <div className="py-8 text-center text-xs text-graphite animate-pulse">
          Loading saved documents...
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="py-8 text-center text-xs text-iron bg-cloud rounded-card border border-dashed border-mist">
          {searchQuery ? 'No documents match your search.' : 'No documents saved yet. Upload a PDF below to extract and save it.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
          {filteredDocs.map((doc) => {
            const isActive = activeDocumentId === doc.id;
            const isConfirmingDelete = deleteConfirmId === doc.id;
            const isDeleting = deletingId === doc.id;

            return (
              <div
                key={doc.id}
                onClick={() => handleDocumentClick(doc.id)}
                className={`p-3.5 rounded-card border transition text-left cursor-pointer flex flex-col justify-between relative group ${
                  isActive
                    ? 'border-iris bg-lilac-wash shadow-subtle'
                    : 'border-mist bg-pure-white hover:border-iris/50 hover:bg-cloud shadow-subtle-2'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className="text-iris font-bold text-base">⬡</span>
                      <h4 className="text-xs font-bold text-studio-slate truncate" title={doc.filename}>
                        {doc.filename}
                      </h4>
                    </div>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(isConfirmingDelete ? null : doc.id);
                      }}
                      className="text-graphite hover:text-red-600 hover:bg-red-50 p-1 rounded-control transition flex-shrink-0"
                      title="Delete document"
                    >
                      🗑️
                    </button>
                  </div>

                  {doc.uploaded_at && (
                    <p className="text-[11px] text-iron mt-1.5 ml-6">
                      {new Date(doc.uploaded_at).toLocaleDateString()} at {new Date(doc.uploaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>

                {/* Inline Delete Confirmation */}
                {isConfirmingDelete && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-control text-xs space-y-2 animate-fadeIn"
                  >
                    <p className="text-red-800 font-semibold text-[11px]">Delete this document permanently?</p>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={(e) => handleDeleteDocument(e, doc.id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-pill font-semibold text-[11px] transition cursor-pointer"
                      >
                        {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(null);
                        }}
                        className="px-3 py-1 bg-pure-white border border-mist text-iron rounded-pill font-semibold text-[11px] transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
