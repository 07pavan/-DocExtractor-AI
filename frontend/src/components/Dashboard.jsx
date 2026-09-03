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
      // Suppress noisy banner if it was just initial connection handshake
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

      // Remove from local list
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setDeleteConfirmId(null);

      // If this document was open in viewer, clear it
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
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
      {/* Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-bold text-gray-900">Your Document Vault</h3>
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 font-semibold rounded-full">
              {documents.length}
            </span>
          </div>
          <p className="text-xs text-gray-500">Access and revisit past extractions anytime without re-uploading.</p>
        </div>

        <button
          onClick={fetchDocuments}
          disabled={loading}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 transition flex items-center space-x-1 self-start sm:self-auto cursor-pointer"
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
            className="w-full text-xs pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute left-2.5 top-2 text-gray-400 text-xs">🔍</span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {/* Document List Cards */}
      {loading && documents.length === 0 ? (
        <div className="py-8 text-center text-xs text-gray-400 animate-pulse">
          Loading saved documents...
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="py-8 text-center text-xs text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          {searchQuery ? 'No documents match your search.' : 'No documents saved yet. Upload a PDF above to extract and save it.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
          {filteredDocs.map((doc) => {
            const isActive = activeDocumentId === doc.id;
            const isConfirmingDelete = deleteConfirmId === doc.id;
            const isDeleting = deletingId === doc.id;

            return (
              <div
                key={doc.id}
                onClick={() => handleDocumentClick(doc.id)}
                className={`p-3 rounded-lg border transition text-left cursor-pointer flex flex-col justify-between relative group ${
                  isActive
                    ? 'border-blue-500 bg-blue-50/60 shadow-xs'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50/70'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="text-base">📄</span>
                      <h4 className="text-xs font-bold text-gray-800 truncate" title={doc.filename}>
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
                      className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition flex-shrink-0"
                      title="Delete document"
                    >
                      🗑️
                    </button>
                  </div>

                  {doc.uploaded_at && (
                    <p className="text-[10px] text-gray-400 mt-1 ml-6">
                      {new Date(doc.uploaded_at).toLocaleDateString()} at {new Date(doc.uploaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>

                {/* Inline Delete Confirmation Popover */}
                {isConfirmingDelete && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2.5 p-2 bg-red-50 border border-red-200 rounded-lg text-xs space-y-1.5 animate-fadeIn"
                  >
                    <p className="text-red-800 font-medium text-[11px]">Delete this document permanently?</p>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={(e) => handleDeleteDocument(e, doc.id)}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-medium text-[11px] transition"
                      >
                        {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(null);
                        }}
                        className="px-2.5 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded font-medium text-[11px] transition"
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
