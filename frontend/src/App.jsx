import { useState, useRef } from 'react';
import AuthGate, { useAuth } from './components/AuthGate';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import DocumentViewer from './components/DocumentViewer';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

function ExtractorApp() {
  const { session } = useAuth();
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [extractionPhase, setExtractionPhase] = useState('');
  const [error, setError] = useState('');
  const [activeDocument, setActiveDocument] = useState(null);
  const uploadSectionRef = useRef(null);
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

      // Construct target URL using fallback logic (supports both direct API URL and dev proxy /api)
      const targetUrl = API_BASE_URL ? `${API_BASE_URL.replace(/\/$/, '')}/extract` : '/api/extract';

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      clearTimeout(phaseTimer1);
      setExtractionPhase('3. Saving to Supabase Postgres...');

      if (!response.ok) {
        let errorMessage = `Server error (${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.detail) {
            errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
          }
        } catch {}
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const enrichedDoc = {
        ...data,
        filename: file.name,
      };

      // Transition to Document Viewer View
      setActiveDocument(enrichedDoc);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Extraction error:', err);
      setError(
        err.message === 'Failed to fetch'
          ? 'Backend server is not reachable. Ensure the backend is running at port 8000 or check your network connection.'
          : (err.message || 'An unexpected error occurred during document extraction.')
      );
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

  const scrollToUpload = () => {
    uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar onNewUpload={() => setActiveDocument(null)} />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-8">
        {/* VIEW 1: ACTIVE DOCUMENT EXTRACTION PAGE (when extraction is complete or selected) */}
        {activeDocument ? (
          <DocumentViewer
            document={activeDocument}
            onBackToUpload={() => {
              setActiveDocument(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : (
          /* VIEW 2: WELCOME / LANDING & UPLOAD EXPERIENCE */
          <div className="space-y-8 animate-fadeIn">
            {/* Welcoming Interactive Hero Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl relative overflow-hidden">
              <div className="relative z-10 max-w-2xl space-y-4">
                <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-500/20 text-blue-200 border border-blue-400/30 rounded-full text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
                  <span>Zero-Hallucination Grounded AI Engine</span>
                </div>

                <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
                  Transform Complex Documents into Structured Intelligence.
                </h2>

                <p className="text-sm sm:text-base text-blue-100/90 leading-relaxed">
                  Extract multi-page SERFF insurance filings, policy contracts, and financial statements. Grounded citations, type-aware metrics, and consolidated form schedule variations.
                </p>

                {/* Quick Feature Pillars */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10">
                    <span className="text-lg block mb-1">🎯</span>
                    <span className="text-xs font-bold block">100% Grounded</span>
                    <span className="text-[10px] text-blue-200">Zero-hallucination citations</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10">
                    <span className="text-lg block mb-1">⚡</span>
                    <span className="text-xs font-bold block">Parallel Chunking</span>
                    <span className="text-[10px] text-blue-200">500+ pages in seconds</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10">
                    <span className="text-lg block mb-1">📊</span>
                    <span className="text-xs font-bold block">Master Schedules</span>
                    <span className="text-[10px] text-blue-200">Diff & variation matrices</span>
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    onClick={scrollToUpload}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-extrabold text-xs sm:text-sm rounded-xl transition shadow-lg flex items-center space-x-2"
                  >
                    <span>Upload Your Document Below</span>
                    <span>↓</span>
                  </button>
                </div>
              </div>

              {/* Decorative background glow */}
              <div className="absolute -right-20 -top-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute right-40 -bottom-20 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
            </div>

            {/* Document Vault (Past Extractions) */}
            <Dashboard
              onSelectDocument={(docDetail) => {
                setActiveDocument(docDetail);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              activeDocumentId={activeDocument?.document_id || activeDocument?.id}
              onDeleteActiveDocument={() => setActiveDocument(null)}
            />

            {/* Upload Area (Reached naturally or via scroll) */}
            <div ref={uploadSectionRef} className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
                <div>
                  <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">
                    Upload & Extract New Document
                  </h3>
                  <p className="text-xs text-gray-500">
                    Upload any insurance filing, policy schedule, or legal document for instant parallel extraction.
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-700 font-semibold rounded-md self-start sm:self-auto">
                  PDF Formats (.pdf)
                </span>
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !loading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3.5 ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/60 scale-[1.005]'
                    : file
                    ? 'border-emerald-400 bg-emerald-50/40'
                    : 'border-gray-300 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/20'
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

                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl transition shadow-xs ${
                  file ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {file ? '📄' : '☁️'}
                </div>

                {file ? (
                  <div className="space-y-1.5">
                    <p className="text-sm font-bold text-gray-900 truncate max-w-md">{file.name}</p>
                    <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">Ready to Extract</span>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="text-red-600 hover:underline font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-gray-700">
                      <span className="text-blue-600">Click to browse</span> or drag and drop your document here
                    </p>
                    <p className="text-xs text-gray-400">Supports multi-page landscape and portrait filings</p>
                  </div>
                )}
              </div>

              {/* Error Banner */}
              {error && (
                <div className="p-3.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center space-x-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Action Button & Loading Progress */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExtract}
                  disabled={!file || loading}
                  className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs sm:text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Processing & Extracting Document...</span>
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      <span>Extract & View Document Intelligence</span>
                    </>
                  )}
                </button>

                {loading && extractionPhase && (
                  <div className="flex items-center space-x-2 text-xs text-blue-700 bg-blue-50 px-4 py-2 rounded-xl border border-blue-200 animate-pulse">
                    <span>⏳</span>
                    <span className="font-semibold">{extractionPhase}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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
