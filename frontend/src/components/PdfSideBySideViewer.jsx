import { useState, useEffect } from 'react';

/**
 * PdfSideBySideViewer: Clean interactive split-screen PDF document canvas.
 * - Displays the original PDF file side-by-side with extracted intelligence.
 * - Supports targeted jump-to-page when citations (p.X) are clicked.
 * - Provides zoom in/out, page jump navigation, and fullscreen toggle.
 */

export default function PdfSideBySideViewer({ file, fileUrl, targetPage = 1, onClose, highlightText = '' }) {
  const [currentPage, setCurrentPage] = useState(targetPage);
  const [blobUrl, setBlobUrl] = useState(fileUrl || '');
  const [zoomLevel, setZoomLevel] = useState(100);

  useEffect(() => {
    if (file && !fileUrl) {
      const url = URL.createObjectURL(file);
      setBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (fileUrl) {
      setBlobUrl(fileUrl);
    }
  }, [file, fileUrl]);

  useEffect(() => {
    if (targetPage && targetPage > 0) {
      setCurrentPage(targetPage);
    }
  }, [targetPage]);

  // Construct iframe embed src with target page anchor (#page=X)
  const embedSrc = blobUrl ? `${blobUrl}#page=${currentPage}&zoom=${zoomLevel}` : '';

  return (
    <div className="flex flex-col h-full bg-pure-white border-l border-mist rounded-r-card shadow-lg overflow-hidden animate-fadeIn">
      {/* Viewer Header / Toolbar */}
      <div className="bg-obsidian text-pure-white px-4 py-3 flex items-center justify-between gap-2 select-none border-b border-white/10">
        <div className="flex items-center space-x-2 min-w-0">
          <span className="text-iris font-bold text-sm">⬡</span>
          <span className="text-xs font-bold truncate max-w-[180px]">
            {file?.name || 'Document Canvas'}
          </span>
          <span className="pill-badge !text-[10px] !py-0.5 !px-2 !bg-white/10 !text-white !border-white/10">
            Page {currentPage}
          </span>
        </div>

        {/* Page Nav & Controls */}
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="w-7 h-7 rounded-control bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs disabled:opacity-30 transition cursor-pointer"
            title="Previous Page"
          >
            ←
          </button>
          
          <input
            type="number"
            min={1}
            value={currentPage}
            onChange={(e) => setCurrentPage(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-12 text-center text-xs py-1 bg-white/10 text-white rounded-control border border-white/20 focus:outline-none focus:border-iris font-mono"
          />

          <button
            type="button"
            onClick={() => setCurrentPage((p) => p + 1)}
            className="w-7 h-7 rounded-control bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs transition cursor-pointer"
            title="Next Page"
          >
            →
          </button>

          <div className="h-4 w-px bg-white/20 mx-1"></div>

          {/* Zoom controls */}
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
            className="w-7 h-7 rounded-control bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-bold transition cursor-pointer"
            title="Zoom Out"
          >
            -
          </button>
          <span className="text-[10px] text-graphite font-mono w-8 text-center">{zoomLevel}%</span>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(200, z + 15))}
            className="w-7 h-7 rounded-control bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-bold transition cursor-pointer"
            title="Zoom In"
          >
            +
          </button>

          <button
            type="button"
            onClick={onClose}
            className="ml-2 w-7 h-7 rounded-control bg-red-500/20 hover:bg-red-500 text-red-200 hover:text-white flex items-center justify-center text-xs transition cursor-pointer"
            title="Close Side-by-Side View"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Citation Banner if citation clicked */}
      {highlightText && (
        <div className="bg-lilac-wash px-3.5 py-2 border-b border-iris/20 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center space-x-1.5 min-w-0">
            <span className="text-iris font-bold">🎯 Cited Evidence:</span>
            <span className="italic text-studio-slate truncate font-medium">"{highlightText}"</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 bg-iris text-white rounded-control font-semibold flex-shrink-0">
            Page {currentPage}
          </span>
        </div>
      )}

      {/* PDF View Container */}
      <div className="flex-1 w-full bg-cloud relative overflow-hidden">
        {blobUrl ? (
          <iframe
            key={`${blobUrl}_${currentPage}_${zoomLevel}`}
            src={embedSrc}
            title="PDF Document Viewer"
            className="w-full h-full border-none"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center text-graphite space-y-2">
            <span className="text-3xl">📑</span>
            <span className="text-xs font-semibold">Loading PDF original stream...</span>
          </div>
        )}
      </div>
    </div>
  );
}
