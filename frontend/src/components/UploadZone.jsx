import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  Zap,
  Clock,
  Layers
} from 'lucide-react';

export default function UploadZone({ onExtractionComplete }) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState(null);
  const [samples, setSamples] = useState([]);
  const [useAsync, setUseAsync] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch sample PDFs on mount
  useEffect(() => {
    fetch('/api/samples')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setSamples(data);
      })
      .catch(err => console.error("Could not fetch samples:", err));
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      validateAndProcessFile(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files.length > 0) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const validateAndProcessFile = (selectedFile) => {
    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError("Please select a valid PDF file (.pdf)");
      return;
    }
    setError(null);
    setFile(selectedFile);
    startExtraction(selectedFile);
  };

  const pollJobStatus = async (jobId) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error("Failed to get job status");
        const data = await res.json();
        
        setProgress(data.progress || 50);
        setStatusMessage(data.message || "Processing PDF pages...");

        if (data.status === 'completed' && data.result) {
          clearInterval(interval);
          setLoading(false);
          onExtractionComplete(data.result);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setLoading(false);
          setError(data.error || "Async extraction failed");
        }
      } catch (err) {
        clearInterval(interval);
        setLoading(false);
        setError(err.message || "Error polling job status");
      }
    }, 1000);
  };

  const startExtraction = async (pdfFile) => {
    setLoading(true);
    setError(null);
    setProgress(15);
    setStatusMessage("Uploading PDF and analyzing layout...");

    const formData = new FormData();
    formData.append('file', pdfFile);

    try {
      if (useAsync) {
        // Asynchronous Job Flow (for 100+ pages)
        const res = await fetch('/api/extract/async', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || "Failed to start async extraction");
        }

        const jobData = await res.json();
        setStatusMessage("Extraction queued in background...");
        setProgress(25);
        pollJobStatus(jobData.job_id);

      } else {
        // Direct Fast Synchronous Extraction
        setProgress(45);
        setStatusMessage("Converting PDF with pymupdf4llm & parsing heading tree...");
        
        const res = await fetch('/api/extract', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || "Extraction failed");
        }

        setProgress(95);
        setStatusMessage("Finalizing hierarchy & table structures...");
        const data = await res.json();
        
        setTimeout(() => {
          setLoading(false);
          onExtractionComplete(data);
        }, 300);
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || "An error occurred during extraction.");
    }
  };

  const handleSampleClick = async (sampleName) => {
    setLoading(true);
    setError(null);
    setProgress(30);
    setStatusMessage(`Extracting sample document: ${sampleName}...`);

    try {
      const res = await fetch(`/api/extract/sample/${encodeURIComponent(sampleName)}`, {
        method: 'POST'
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to extract sample");
      }

      setProgress(90);
      setStatusMessage("Parsing tree structure...");
      const data = await res.json();
      
      setTimeout(() => {
        setLoading(false);
        onExtractionComplete(data);
      }, 300);
    } catch (err) {
      setLoading(false);
      setError(err.message || "Error loading sample PDF");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      
      {/* Hero Header */}
      <div className="text-center mb-10 space-y-3">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Next-Gen Heading & Table Intelligence</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
          Extract <span className="bg-gradient-to-r from-brand-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">Navigable Heading Trees</span> & Tables
        </h1>
        <p className="text-slate-400 text-base max-w-2xl mx-auto">
          Powered by <span className="text-slate-200 font-semibold">pymupdf4llm</span>. Automatically parses complex multi-page PDFs, rotated orientations, and borderless tables into an interactive hierarchical document tree.
        </p>
      </div>

      {/* Main Upload Card */}
      <div className="glass-panel rounded-3xl p-8 border border-slate-800 relative overflow-hidden shadow-2xl">
        
        {/* Background ambient glow */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Mode Toggle */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-brand-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Extraction Pipeline
            </span>
          </div>

          <div className="flex items-center space-x-3 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setUseAsync(false)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                !useAsync 
                  ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/25' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Standard (Fast)</span>
            </button>
            <button
              type="button"
              onClick={() => setUseAsync(true)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                useAsync 
                  ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/25' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Async Queue (100+ pgs)</span>
            </button>
          </div>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !loading && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-brand-400 bg-brand-500/10 scale-[1.01]'
              : 'border-slate-700/80 hover:border-slate-500 bg-slate-900/40 hover:bg-slate-900/60'
          } ${loading ? 'pointer-events-none opacity-90' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileInputChange}
          />

          {loading ? (
            <div className="py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-brand-500/20 border border-brand-500/40 flex items-center justify-center mx-auto animate-pulse">
                <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Processing Document</h3>
                <p className="text-sm text-slate-400">{statusMessage}</p>
              </div>
              {/* Progress bar */}
              <div className="w-full max-w-md mx-auto bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5">
                <div 
                  className="bg-gradient-to-r from-brand-500 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-sm shadow-brand-400/50"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform shadow-inner">
                <UploadCloud className="w-8 h-8 text-brand-400" />
              </div>
              <div>
                <p className="text-base font-semibold text-white">
                  Drop your PDF here, or <span className="text-brand-400 underline underline-offset-4">browse files</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports multi-page PDFs, borderless schedules, financial disclosures, and mixed orientations
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Error notification */}
        {error && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center space-x-3 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Sample Document Quick Launch */}
        {samples.length > 0 && !loading && (
          <div className="mt-8 pt-6 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Or test with bundled sample documents:
              </span>
              <span className="text-[11px] text-slate-500">1-click instant extraction</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {samples.slice(0, 4).map((sample) => (
                <button
                  key={sample.filename}
                  onClick={() => handleSampleClick(sample.filename)}
                  className="text-left p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-brand-500/40 transition-all flex items-start justify-between group"
                >
                  <div className="flex items-start space-x-2.5 truncate mr-2">
                    <FileText className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                    <div className="truncate">
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-brand-300 truncate">
                        {sample.filename}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {sample.description} • {(sample.size_bytes / 1024).toFixed(0)} KB
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-brand-400 shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
