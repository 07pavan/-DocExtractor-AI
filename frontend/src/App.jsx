import { useState, useRef } from 'react';
import AuthGate, { useAuth } from './components/AuthGate';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import DocumentViewer from './components/DocumentViewer';

const ENV_API_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : '';

async function fetchWithFallback(endpoint, options) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const candidateBases = [];
  if (ENV_API_URL) {
    candidateBases.push(ENV_API_URL);
  }
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    candidateBases.push('http://localhost:8000');
    candidateBases.push('http://127.0.0.1:8000');
  }
  candidateBases.push('/api');

  const uniqueBases = Array.from(new Set(candidateBases.filter(Boolean)));
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

function MainApp() {
  const { session } = useAuth();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeDocument, setActiveDocument] = useState(null);
  const [extractionPhase, setExtractionPhase] = useState('');
  const uploadSectionRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
        setError('Please select a valid PDF file.');
        setFile(null);
        return;
      }
      setFile(selected);
      setError(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      if (dropped.type !== 'application/pdf' && !dropped.name.toLowerCase().endsWith('.pdf')) {
        setError('Please drop a valid PDF file.');
        return;
      }
      setFile(dropped);
      setError(null);
    }
  };

  const handleExtract = async () => {
    if (!file) {
      setError('Please choose a PDF document to extract.');
      return;
    }

    setLoading(true);
    setError(null);
    setExtractionPhase('Transmitting document to parallel pipeline...');

    const formData = new FormData();
    formData.append('document', file);

    try {
      setExtractionPhase('Extracting layout hierarchy, vector schedules & metadata...');

      const response = await fetchWithFallback('/extract', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: formData,
      });

      if (!response.ok) {
        let errMessage = `Extraction failed with status ${response.status}`;
        try {
          const errData = await response.json();
          if (errData && errData.detail) {
            errMessage = errData.detail;
          }
        } catch {
          // Keep default message
        }
        throw new Error(errMessage);
      }

      setExtractionPhase('Structuring data tree...');
      const data = await response.json();

      setActiveDocument(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(
        err.message || 'An error occurred during document extraction. Please check your backend connection.'
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
    <div className="min-h-screen bg-cloud flex flex-col">
      <Navbar onNewUpload={() => setActiveDocument(null)} />

      <main className="flex-1 max-w-[1200px] w-full mx-auto p-4 sm:p-8 space-y-12">
        {/* VIEW 1: ACTIVE DOCUMENT EXTRACTION PAGE */}
        {activeDocument ? (
          <DocumentViewer
            document={activeDocument}
            uploadedFile={file}
            onBackToUpload={() => {
              setActiveDocument(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : (
          /* VIEW 2: WELCOME / LANDING & UPLOAD EXPERIENCE */
          <div className="space-y-12 animate-fadeIn">
            {/* Dark Hero Section matching Specify Style */}
            <div className="bg-obsidian rounded-card p-8 sm:p-14 text-pure-white shadow-lg-elevated relative overflow-hidden">
              <div className="relative z-10 max-w-3xl space-y-6">
                <div className="pill-badge !bg-obsidian !border-white/10 !text-pure-white !text-xs !py-1 !px-3.5">
                  <span className="w-2 h-2 rounded-full bg-iris animate-pulse"></span>
                  <span>Zero-Hallucination Grounded Intelligence</span>
                </div>

                <h2 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.13]">
                  Your Document Intelligence <span className="gradient-headline">Engine.</span>
                </h2>

                <p className="text-sm sm:text-base text-graphite leading-relaxed max-w-2xl font-normal">
                  Specify-driven architecture for complex insurance filings, policy contracts, and master schedule tables. Verbatim citations, type-aware metrics, and multi-sheet Excel exports.
                </p>

                {/* Feature Trio in Carousel Wash Tokens */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="bg-white/5 border border-white/10 p-4 rounded-card">
                    <span className="text-iris font-bold text-base block mb-1">⬡ 100% Grounded</span>
                    <span className="text-xs text-graphite leading-relaxed">
                      Zero-hallucination citations with exact page numbers & quotes.
                    </span>
                  </div>

                  <div className="bg-white/5 border border-white/10 p-4 rounded-card">
                    <span className="text-soft-iris font-bold text-base block mb-1">⚡ Parallel Chunking</span>
                    <span className="text-xs text-graphite leading-relaxed">
                      Sub-2s inference across multi-page files with PyMuPDF & Groq.
                    </span>
                  </div>

                  <div className="bg-white/5 border border-white/10 p-4 rounded-card">
                    <span className="text-cobalt-pop font-bold text-base block mb-1">📊 Master Schedules</span>
                    <span className="text-xs text-graphite leading-relaxed">
                      Multi-sheet clean Excel (.xlsx) and CSV table exports.
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={scrollToUpload}
                    className="btn-pill-white-outline"
                  >
                    <span>Upload Document Below</span>
                    <span>↓</span>
                  </button>
                </div>
              </div>

              {/* Decorative Subtle Iris Glow in Background */}
              <div className="absolute -right-20 -top-20 w-96 h-96 bg-iris/15 rounded-full blur-3xl pointer-events-none"></div>
            </div>

            {/* Document Vault */}
            <Dashboard
              onSelectDocument={(docDetail) => {
                setActiveDocument(docDetail);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              activeDocumentId={activeDocument?.document_id || activeDocument?.id}
              onDeleteActiveDocument={() => setActiveDocument(null)}
            />

            {/* Upload Area */}
            <div ref={uploadSectionRef} className="card-specify space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-mist">
                <div>
                  <h3 className="text-base font-bold text-studio-slate">
                    Upload & Extract New Document
                  </h3>
                  <p className="text-xs text-iron mt-0.5">
                    Upload any insurance filing, policy schedule, or legal document for parallel extraction.
                  </p>
                </div>
                <span className="pill-badge !text-xs !bg-cloud !text-iron">PDF Formats (.pdf)</span>
              </div>

              {/* Drag & Drop Box */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-card p-8 sm:p-12 text-center transition cursor-pointer select-none ${
                  file
                    ? 'border-iris bg-lilac-wash/60'
                    : 'border-mist bg-cloud hover:border-iris hover:bg-pure-white'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,application/pdf"
                  className="hidden"
                />

                {file ? (
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-control bg-iris text-white flex items-center justify-center text-xl mx-auto shadow-subtle">
                      📑
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-studio-slate">{file.name}</h4>
                      <p className="text-xs text-iron mt-1">
                        {formatFileSize(file.size)} • <span className="text-fern-pop font-semibold">Ready to Extract</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="text-xs text-iron hover:text-red-600 font-semibold underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-control bg-pure-white text-iris flex items-center justify-center text-xl mx-auto border border-mist shadow-subtle-2">
                      ⬡
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-studio-slate">
                        Click to upload or drag & drop PDF
                      </h4>
                      <p className="text-xs text-iron mt-1">
                        Maximum file size 50MB • High-speed grounded processing
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 text-red-700 text-xs rounded-card border border-red-200 flex items-center space-x-2">
                  <span>⚠️</span>
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {/* Action Button & Progress */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <button
                  type="button"
                  disabled={!file || loading}
                  onClick={handleExtract}
                  className="w-full sm:w-auto btn-pill-dark disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Processing Extraction...</span>
                    </>
                  ) : (
                    <>
                      <span>Extract & View Document Intelligence</span>
                      <span>→</span>
                    </>
                  )}
                </button>

                {loading && (
                  <div className="text-xs text-iris font-semibold animate-pulse flex items-center space-x-2">
                    <span>⚡</span>
                    <span>{extractionPhase}</span>
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
      <MainApp />
    </AuthGate>
  );
}
