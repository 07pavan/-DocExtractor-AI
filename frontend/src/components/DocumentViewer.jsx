import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import SectionTree from './SectionTree';
import SummaryCard from './SummaryCard';
import PdfSideBySideViewer from './PdfSideBySideViewer';
import { sectionMatchesSearch } from './SectionNode';

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
      (s.text && s.text.toLowerCase().includes(q)) ||
      (s.fields && s.fields.some((f) =>
        (f.label && f.label.toLowerCase().includes(q)) ||
        (f.value && f.value.toLowerCase().includes(q))
      ));

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
    if (s.fields && Array.isArray(s.fields)) {
      total += s.fields.length;
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

  const pageColIndices = new Set();
  headers.forEach((h, idx) => {
    const hStr = String(h || '').toLowerCase().trim();
    if (hStr === 'page location' || hStr === 'page' || hStr === 'page #' || hStr === 'page no') {
      pageColIndices.add(idx);
    }
  });

  const cleanHeaders = headers.filter((_, idx) => !pageColIndices.has(idx));
  const cleanRows = rows.map((r) => {
    if (Array.isArray(r)) {
      return r.filter((_, idx) => !pageColIndices.has(idx));
    }
    return r;
  });

  return { title: table.title, headers: cleanHeaders, rows: cleanRows };
}

export default function DocumentViewer({ document: doc, uploadedFile = null, onBackToUpload }) {
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

  const allTables = useMemo(() => collectAllTables(sections), [sections]);
  const totalFields = useMemo(() => countTotalFields(sections), [sections]);

  if (!doc) return null;

  const filename = doc.filename || doc.heading || 'Document Extraction';
  const cleanBaseName = filename.replace(/\.[^/.]+$/, '');
  const summary = doc.summary || (doc.sections && typeof doc.sections === 'object' ? doc.sections.summary : null);

  // Citation click handler -> opens side-by-side split screen and jumps to cited page
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

  // 2. Export Excel (.xlsx) with dedicated clean worksheets
  const handleExportExcel = () => {
    if (allTables.length === 0) {
      alert("No structured tables found in this extraction to export to Excel.");
      return;
    }

    const workbook = XLSX.utils.book_new();

    allTables.forEach((tab, idx) => {
      const cleanTab = cleanTableForExport(tab);
      const sheetData = [];

      // Add Table Title
      if (cleanTab.title) {
        sheetData.push([cleanTab.title]);
        sheetData.push([]);
      }

      // Add Headers
      if (cleanTab.headers && cleanTab.headers.length > 0) {
        sheetData.push(cleanTab.headers);
      }

      // Add Data Rows
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
        sheetName = `${sheetName.substring(0, 25)}_${idx + 1}`;
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
    <div className="space-y-6 animate-fadeIn">
      {/* Top Breadcrumb & Navigation Back Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-pure-white p-4 rounded-card border border-mist shadow-subtle-2">
        <button
          onClick={onBackToUpload}
          className="btn-pill-ghost !text-xs !py-1.5 !px-3.5"
        >
          <span>←</span>
          <span>Back to Upload / Document Vault</span>
        </button>

        <div className="flex items-center space-x-2 text-xs text-iron flex-wrap">
          {/* Split-Screen PDF Canvas Toggle */}
          <button
            type="button"
            onClick={() => setShowSideBySide(!showSideBySide)}
            className={`btn-pill-ghost !text-xs !py-1 !px-3 border ${
              showSideBySide
                ? 'bg-lilac-wash border-iris text-iris font-bold'
                : 'hover:border-iris hover:text-iris'
            }`}
            title="Toggle Split-Screen PDF Viewer"
          >
            <span>📑</span>
            <span>{showSideBySide ? 'Hide Original PDF' : 'View Original PDF Side-by-Side'}</span>
          </button>

          <span className="pill-badge !text-xs !py-1 !px-2.5 !bg-cloud">
            <span className="text-iris font-bold">⬡</span>
            <span>{totalCount} Sections</span>
          </span>
          <span className="pill-badge !text-xs !py-1 !px-2.5 !bg-cloud">
            <span>📊</span>
            <span>{allTables.length} Tables</span>
          </span>
          <span className="pill-badge !text-xs !py-1 !px-2.5 !bg-cloud">
            <span>📋</span>
            <span>{totalFields} Fields</span>
          </span>
        </div>
      </div>

      {/* Main Container: Full Width or Split-Screen Grid */}
      <div className={`grid gap-6 transition-all duration-300 ${showSideBySide ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'}`}>
        
        {/* Left Column: Structured Intelligence Stream */}
        <div className={`space-y-6 ${showSideBySide ? 'lg:col-span-7' : 'w-full'}`}>
          {/* Main Document Title & Multi-Format Export Action Bar */}
          <div className="card-specify space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="pill-badge !text-[11px] !py-0.5 !px-2.5 !bg-mint-wash !text-fern-pop !border-fern-pop/20">
                    Verified Extraction
                  </span>
                  {doc.document_id && (
                    <span className="text-[11px] text-graphite font-mono">
                      ID: {String(doc.document_id).substring(0, 8)}...
                    </span>
                  )}
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-studio-slate tracking-tight truncate max-w-2xl" title={filename}>
                  {filename}
                </h2>
              </div>

              {/* Export Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportExcel}
                  disabled={allTables.length === 0}
                  className="btn-pill-dark !py-2 !px-3.5 !text-xs disabled:opacity-40"
                  title="Export all tables to multi-sheet Excel spreadsheet"
                >
                  <span>📗</span>
                  <span>Export to Excel (.xlsx)</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  disabled={allTables.length === 0}
                  className="btn-pill-ghost !py-2 !px-3.5 !text-xs disabled:opacity-40"
                  title="Export all tables to CSV"
                >
                  <span>📊</span>
                  <span>CSV</span>
                </button>

                <button
                  onClick={handleExportJSON}
                  className="btn-pill-ghost !py-2 !px-3.5 !text-xs"
                  title="Download entire hierarchical tree as JSON"
                >
                  <span>💾</span>
                  <span>JSON</span>
                </button>

                <button
                  onClick={handleCopyJSON}
                  className="btn-pill-ghost !py-2 !px-3 !text-xs"
                  title="Copy complete JSON tree to clipboard"
                >
                  <span>{copied ? '✓ Copied' : '📋'}</span>
                </button>
              </div>
            </div>

            {/* Live Search and Filter Bar */}
            <div className="relative pt-2">
              <input
                type="text"
                placeholder="Search headings, fields, or text in this document..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-8 py-2.5 bg-cloud border border-mist focus:border-iris rounded-control focus:outline-none transition shadow-subtle-2 text-studio-slate"
              />
              <span className="absolute left-3 top-5 text-graphite text-xs">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-5 text-graphite hover:text-studio-slate text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Executive Summary Card with Clickable Citations */}
          {summary && (
            <SummaryCard
              summary={summary}
              onCitationClick={handleCitationClick}
            />
          )}

          {/* Hierarchical Document Section Tree */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-widest text-graphite">
                Document Structure & Section Breakdown
              </h3>
              <span className="pill-badge !text-[11px] !py-0.5 !px-2.5 !bg-cloud">
                Showing {matchCount} of {totalCount} sections
              </span>
            </div>

            <SectionTree sections={sections} searchQuery={searchQuery} />
          </div>
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
