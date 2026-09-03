import { useState, useRef } from 'react';
import AuthGate, { useAuth } from './components/AuthGate';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import DocumentViewer from './components/DocumentViewer';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function ExtractorApp() {
  const { session } = useAuth();
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [extractionPhase, setExtractionPhase] = useState('');
  const [error, setError] = useState('');
  const [activeDocument, setActiveDocument] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.toLowerCase().endsWith('.pdf') || droppedFile.type === 'application/pdf') {
        setFile(droppedFile);
        setError('');
      } else {
        setError('Only PDF files (.pdf) are supported.');
      }
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files && e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  const handleExtract = async () => {
    if (!file || !session?.access_token) return;

    setLoading(true);
    setError('');
    setExtractionPhase('1. Parallel extracting multi-page layout and tables...');

    const formData = new FormData();
    formData.append('document', file);

    try {
      const phaseTimer1 = setTimeout(() => {
        setExtractionPhase('2. Analyzing with Qwen AI & consolidating schedules...');
      }, 1500);

      const response = await fetch(`${API_BASE_URL}/extract`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      clearTimeout(phaseTimer1);
      setExtractionPhase('3. Saving to Supabase Postgres...');

      if (!response.ok) {
        let errorMessage = `Server responded with status ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch {}
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const enrichedDoc = {
        ...data,
        filename: file.name,
      };

      setActiveDocument(enrichedDoc);
      // Reset upload file
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err.message || 'An unexpected error occurred during document extraction.');
    } finally {
      setLoading(false);
      setExtractionPhase('');
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Hero Banner */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10 max-w-2xl space-y-2">
            <span className="px-3 py-1 bg-blue-500/30 text-blue-200 border border-blue-400/30 rounded-full text-xs font-semibold uppercase tracking-wider inline-block">
              ✨ AI Insurance & Legal Document Engine
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Intelligent Document & Schedule Extraction
            </h2>
            <p className="text-xs sm:text-sm text-blue-100/80 leading-relaxed">
              Upload multi-page insurance filings, policies, and contracts. Automatically extract executive summaries, structured form schedules with difference columns, and searchable section hierarchies.
            </p>
          </div>
          {/* Subtle Background Shape */}
          <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        </div>

        {/* Upload & Drag-and-Drop Area */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Upload Document</h3>
            <span className="text-xs text-gray-500">Supports Portrait & Landscape PDFs up to 500+ pages</span>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !loading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50 scale-[1.005]'
                : file
                ? 'border-emerald-400 bg-emerald-50/30'
                : 'border-gray-300 hover:border-blue-400 bg-gray-50/50 hover:bg-blue-50/20'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              disabled={loading}
              className="hidden"
            />

            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl transition ${
              file ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {file ? '📄' : '☁️'}
            </div>

            {file ? (
              <div className="space-y-1">
                <p className="text-sm font-bold text-gray-900 truncate max-w-md">{file.name}</p>
                <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
                  <span>{formatFileSize(file.size)}</span>
                  <span>•</span>
                  <span className="text-emerald-700 font-semibold">Ready to Extract</span>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-red-600 hover:underline font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-700">
                  <span className="text-blue-600 font-bold">Click to browse</span> or drag and drop your PDF here
                </p>
                <p className="text-xs text-gray-400">PDF documents (.pdf)</p>
              </div>
            )}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              {error}
            </div>
          )}

          {/* Action Button & Loading Progress */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={handleExtract}
              disabled={!file || loading}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Processing Document...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Extract & Save Document</span>
                </>
              )}
            </button>

            {loading && extractionPhase && (
              <div className="flex items-center space-x-2 text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 animate-pulse">
                <span>⏳</span>
                <span>{extractionPhase}</span>
              </div>
            )}
          </div>
        </div>

        {/* Active Document Viewer (Tabbed Overview, Schedules & Section Tree) */}
        {activeDocument && (
          <DocumentViewer document={activeDocument} />
        )}

        {/* User Document History Dashboard */}
        <Dashboard
          onSelectDocument={(docDetail) => {
            setActiveDocument(docDetail);
            window.scrollTo({ top: 380, behavior: 'smooth' });
          }}
          activeDocumentId={activeDocument?.document_id || activeDocument?.id}
          onDeleteActiveDocument={() => setActiveDocument(null)}
        />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      <ExtractorApp />
    </AuthGate>
  );
}
