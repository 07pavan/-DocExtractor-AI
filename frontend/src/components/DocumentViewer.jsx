import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import SectionTree from './SectionTree';
import SummaryCard from './SummaryCard';
import TableView from './TableView';
import ChartsView from './ChartsView';
import PdfSideBySideViewer from './PdfSideBySideViewer';

function extractTopLevelSections(doc) {
  if (!doc) return [];
  if (Array.isArray(doc.sections)) return doc.sections;
  if (doc.sections && typeof doc.sections === 'object') {
    if (doc.sections.level === 0 && Array.isArray(doc.sections.subsections) && doc.sections.subsections.length > 0) {
      return doc.sections.subsections;
    }
    return [doc.sections];
  }
  if (doc.level === 0 && Array.isArray(doc.subsections) && doc.subsections.length > 0) {
    return doc.subsections;
  }
  if (doc.heading) return [doc];
  return [];
}

function countSectionsRecursively(sections) {
  let count = 0;
  for (const s of sections) {
    count += 1;
    if (s.subsections && Array.isArray(s.subsections)) {
      count += countSectionsRecursively(s.subsections);
    }
  }
  return count;
}

function countMatchingSectionsRecursively(sections, query) {
  let count = 0;
  const q = query.trim().toLowerCase();
  if (!q) return countSectionsRecursively(sections);

  for (const s of sections) {
    const selfMatches =
      (s.heading && s.heading.toLowerCase().includes(q)) ||
      (s.title && s.title.toLowerCase().includes(q)) ||
      (s.text && s.text.toLowerCase().includes(q)) ||
      (s.fields && (Array.isArray(s.fields) ? s.fields : Object.entries(s.fields)).some((f) => {
        const label = f.label || f[0] || '';
        const value = f.value || f[1] || '';
        return String(label).toLowerCase().includes(q) || String(value).toLowerCase().includes(q);
      }));

    if (selfMatches) count += 1;
    if (s.subsections && Array.isArray(s.subsections)) {
      count += countMatchingSectionsRecursively(s.subsections, query);
    }
  }
  return count;
}

function collectAllTables(sections) {
  let all = [];
  for (const s of sections) {
    if (s.tables && Array.isArray(s.tables)) {
      all.push(...s.tables);
    }
    if (s.subsections && Array.isArray(s.subsections)) {
      all.push(...collectAllTables(s.subsections));
    }
  }
  return all;
}

function countTotalFields(sections) {
  let total = 0;
  for (const s of sections) {
    if (s.fields) {
      total += Array.isArray(s.fields) ? s.fields.length : Object.keys(s.fields).length;
    }
    if (s.subsections && Array.isArray(s.subsections)) {
      total += countTotalFields(s.subsections);
    }
  }
  return total;
}

function cleanTableForExport(table) {
  if (!table) return { title: 'Table', headers: [], rows: [] };
  const headers = table.headers || [];
  const rows = table.rows || [];
  return { title: table.title || 'Table', headers, rows };
}

export default function DocumentViewer({ document: doc, uploadedFile = null, onBackToUpload }) {
  const [activeTab, setActiveTab] = useState('sections'); // 'sections' | 'charts' | 'tables' | 'json'
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Side-by-Side Visual Grounding State
  const [showSideBySide, setShowSideBySide] = useState(false);
  const [targetCitationPage, setTargetCitationPage] = useState(1);
  const [targetCitationQuote, setTargetCitationQuote] = useState('');

  const sections = useMemo(() => extractTopLevelSections(doc), [doc]);
  const totalCount = useMemo(() => countSectionsRecursively(sections), [sections]);
  const matchCount = useMemo(
    () => (searchQuery.trim() ? countMatchingSectionsRecursively(sections, searchQuery) : totalCount),
    [sections, searchQuery, totalCount]
  );

  const allTables = useMemo(() => {
    const list = collectAllTables(sections);
    if (doc.tables && Array.isArray(doc.tables)) {
      list.push(...doc.tables);
    }
    return list;
  }, [sections, doc]);

  const totalFields = useMemo(() => countTotalFields(sections), [sections]);

  if (!doc) return null;

  const filename = doc.filename || doc.heading || 'Document Extraction';
  const cleanBaseName = filename.replace(/\.[^/.]+$/, '');
  const summary = doc.summary || (doc.sections && typeof doc.sections === 'object' ? doc.sections.summary : null);

  const handleCitationClick = (pageNumber, quoteText = '') => {
    if (pageNumber && pageNumber > 0) {
      setTargetCitationPage(pageNumber);
      setTargetCitationQuote(quoteText);
      setShowSideBySide(true);
    }
  };

  // 1. Export JSON
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(doc, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${cleanBaseName}_extraction.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // 2. Export Excel (.xlsx) with dedicated worksheets
  const handleExportExcel = () => {
    if (allTables.length === 0) {
      alert("No structured tables found in this extraction to export to Excel.");
      return;
    }

    const workbook = XLSX.utils.book_new();

    allTables.forEach((tab, idx) => {
      const cleanTab = cleanTableForExport(tab);
      const sheetData = [];

      if (cleanTab.title) {
        sheetData.push([cleanTab.title]);
        sheetData.push([]);
      }
      if (cleanTab.headers && cleanTab.headers.length > 0) {
        sheetData.push(cleanTab.headers);
      }
      if (cleanTab.rows && cleanTab.rows.length > 0) {
        cleanTab.rows.forEach(r => {
          sheetData.push(Array.isArray(r) ? r : [r]);
        });
      }

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      let sheetName = cleanTab.title 
        ? cleanTab.title.replace(/[:\\/?*\[\]]/g, '').substring(0, 28) 
        : `Table_${idx + 1}`;
      
      if (!sheetName.trim()) sheetName = `Table_${idx + 1}`;
      if (workbook.SheetNames.includes(sheetName)) {
        sheetName = `${sheetName.substring(0, 24)}_${idx + 1}`;
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });

    XLSX.writeFile(workbook, `${cleanBaseName}_tables.xlsx`);
  };

  // 3. Export CSV
  const handleExportCSV = () => {
    if (allTables.length === 0) {
      alert("No structured tables found in this extraction to export as CSV.");
      return;
    }
    let csvContent = "";
    allTables.forEach((tab) => {
      const cleanTab = cleanTableForExport(tab);
      if (cleanTab.title) csvContent += `"${cleanTab.title}"\n`;
      if (cleanTab.headers) csvContent += cleanTab.headers.map(h => `"${String(h || '').replace(/"/g, '""')}"`).join(",") + "\n";
      if (cleanTab.rows) {
        cleanTab.rows.forEach(r => {
          csvContent += (Array.isArray(r) ? r : [r]).map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(",") + "\n";
        });
      }
      csvContent += "\n\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${cleanBaseName}_tables.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // 4. Copy JSON
  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(doc, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fadeIn text-zinc-100">
      {/* Top Navigation & Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900 p-4 rounded-xl border border-zinc-800 shadow-md">
        <button
          onClick={onBackToUpload}
          className="text-xs py-2 px-3.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition flex items-center gap-1.5"
        >
          <span>←</span>
          <span>Back to Upload & Vault</span>
        </button>

        <div className="flex items-center space-x-2 text-xs text-zinc-400 flex-wrap">
          <button
            type="button"
            onClick={() => setShowSideBySide(!showSideBySide)}
            className={`text-xs py-1.5 px-3 rounded-lg border transition flex items-center gap-1.5 ${
              showSideBySide
                ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300 font-semibold'
                : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:border-zinc-500'
            }`}
          >
            <span>📑</span>
            <span>{showSideBySide ? 'Hide Original PDF' : 'Side-by-Side PDF'}</span>
          </button>

          <span className="text-xs py-1 px-2.5 bg-zinc-800 text-zinc-300 rounded border border-zinc-700">
            ⬡ {totalCount} Sections
          </span>
          <span className="text-xs py-1 px-2.5 bg-zinc-800 text-zinc-300 rounded border border-zinc-700">
            📊 {allTables.length} Tables
          </span>
          <span className="text-xs py-1 px-2.5 bg-zinc-800 text-zinc-300 rounded border border-zinc-700">
            📋 {totalFields} Fields
          </span>
        </div>
      </div>

      {/* Split-Screen Grid or Full-Width */}
      <div className={`grid gap-6 transition-all duration-300 ${showSideBySide ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'}`}>
        
        {/* Left Column: Structured Intelligence Stream */}
        <div className={`space-y-6 ${showSideBySide ? 'lg:col-span-7' : 'w-full'}`}>
          {/* Header Card */}
          <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] py-0.5 px-2.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded font-medium">
                    Verified Extraction (pdfplumber + PyMuPDF)
                  </span>
                  {doc.document_id && (
                    <span className="text-[11px] text-zinc-500 font-mono">
                      ID: {String(doc.document_id).substring(0, 8)}...
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-zinc-100 tracking-tight truncate max-w-2xl" title={filename}>
                  {filename}
                </h2>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportExcel}
                  disabled={allTables.length === 0}
                  className="text-xs py-2 px-3.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-zinc-100 font-medium transition disabled:opacity-40 flex items-center gap-1.5"
                  title="Export tables to multi-sheet Excel (.xlsx)"
                >
                  <span>📗</span>
                  <span>Excel (.xlsx)</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  disabled={allTables.length === 0}
                  className="text-xs py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition disabled:opacity-40"
                  title="Export tables as CSV"
                >
                  CSV
                </button>

                <button
                  onClick={handleExportJSON}
                  className="text-xs py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
                  title="Download JSON structure"
                >
                  JSON
                </button>

                <button
                  onClick={handleCopyJSON}
                  className="text-xs py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
                  title="Copy JSON to clipboard"
                >
                  {copied ? '✓ Copied' : '📋 Copy'}
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center space-x-1 border-b border-zinc-800 pt-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab('sections')}
                className={`text-xs py-2 px-4 rounded-t-lg font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'sections'
                    ? 'border-indigo-500 text-indigo-400 bg-zinc-800/60'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>📑</span> Sections & Content ({matchCount})
              </button>

              <button
                onClick={() => setActiveTab('charts')}
                className={`text-xs py-2 px-4 rounded-t-lg font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'charts'
                    ? 'border-indigo-500 text-indigo-400 bg-zinc-800/60'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>📈</span> Analytics & Charts
              </button>

              <button
                onClick={() => setActiveTab('tables')}
                className={`text-xs py-2 px-4 rounded-t-lg font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'tables'
                    ? 'border-indigo-500 text-indigo-400 bg-zinc-800/60'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>📊</span> Sortable Tables ({allTables.length})
              </button>

              <button
                onClick={() => setActiveTab('json')}
                className={`text-xs py-2 px-4 rounded-t-lg font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'json'
                    ? 'border-indigo-500 text-indigo-400 bg-zinc-800/60'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>💻</span> Raw JSON
              </button>
            </div>

            {/* Live Search Input (for sections/tables) */}
            {activeTab === 'sections' && (
              <div className="relative pt-1">
                <input
                  type="text"
                  placeholder="Filter and search headings, fields, or text in this document..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-8 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-lg focus:outline-none transition text-zinc-200 placeholder-zinc-500"
                />
                <span className="absolute left-3 top-4 text-zinc-500 text-xs">🔍</span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-3.5 text-zinc-500 hover:text-zinc-200 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Executive Summary Card */}
          {summary && activeTab === 'sections' && (
            <SummaryCard
              summary={summary}
              onCitationClick={handleCitationClick}
            />
          )}

          {/* Tab 1: Sections & Hierarchical Structure */}
          {activeTab === 'sections' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  Document Sections Breakdown
                </h3>
                <span className="text-[11px] py-0.5 px-2 bg-zinc-800 text-zinc-300 rounded border border-zinc-700">
                  Showing {matchCount} of {totalCount} sections
                </span>
              </div>

              <SectionTree sections={sections} searchQuery={searchQuery} />
            </div>
          )}

          {/* Tab 2: Analytics & Recharts */}
          {activeTab === 'charts' && (
            <ChartsView extractionData={doc} />
          )}

          {/* Tab 3: Tables Tab */}
          {activeTab === 'tables' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  Extracted Tables & Schedules ({allTables.length})
                </h3>
              </div>
              {allTables.length > 0 ? (
                <TableView tables={allTables} />
              ) : (
                <div className="p-8 text-center bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400">
                  No structured tables detected on this document.
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Raw JSON Tab */}
          {activeTab === 'json' && (
            <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 overflow-x-auto max-h-[600px] overflow-y-auto">
              <pre className="text-xs font-mono text-emerald-400 leading-relaxed">
                {JSON.stringify(doc, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Right Column: Split-Screen PDF Viewer Canvas */}
        {showSideBySide && (
          <div className="lg:col-span-5 sticky top-20 h-[calc(100vh-6rem)]">
            <PdfSideBySideViewer
              file={uploadedFile}
              targetPage={targetCitationPage}
              highlightText={targetCitationQuote}
              onClose={() => setShowSideBySide(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
