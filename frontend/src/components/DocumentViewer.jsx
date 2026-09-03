import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import SectionTree from './SectionTree';
import SummaryCard from './SummaryCard';
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

/**
 * Strips out 'Page Location' or 'Page' column headers and their corresponding cells for clean exports.
 */
function cleanTableForExport(table) {
  const headers = table.headers || [];
  const rows = table.rows || [];

  // Find index of page columns
  const pageColIndices = [];
  headers.forEach((h, idx) => {
    const hLow = String(h || '').toLowerCase().trim();
    if (hLow.includes('page location') || hLow === 'page' || hLow === 'page #') {
      pageColIndices.push(idx);
    }
  });

  if (pageColIndices.length === 0) {
    return { title: table.title, headers, rows };
  }

  // Filter headers
  const cleanHeaders = headers.filter((_, idx) => !pageColIndices.includes(idx));

  // Filter rows
  const cleanRows = rows.map((r) => {
    if (Array.isArray(r)) {
      return r.filter((_, idx) => !pageColIndices.includes(idx));
    }
    return r;
  });

  return { title: table.title, headers: cleanHeaders, rows: cleanRows };
}

export default function DocumentViewer({ document: doc, onBackToUpload }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

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
        sheetData.push([]); // blank row
      }

      // Add Headers
      if (cleanTab.headers && cleanTab.headers.length > 0) {
        sheetData.push(cleanTab.headers);
      }

      // Add Data Rows
      if (cleanTab.rows && cleanTab.rows.length > 0) {
        cleanTab.rows.forEach((r) => {
          sheetData.push(Array.isArray(r) ? r : [r]);
        });
      }

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

      // Sanitize sheet name (Excel limits sheet names to 31 chars and no special chars)
      let sheetName = (cleanTab.title || `Table_${idx + 1}`)
        .replace(/[:\\/?*\[\]]/g, '')
        .substring(0, 30)
        .trim();
      if (!sheetName) sheetName = `Table_${idx + 1}`;

      // Avoid duplicate sheet names
      if (workbook.SheetNames.includes(sheetName)) {
        sheetName = `${sheetName.substring(0, 26)}_${idx + 1}`;
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });

    // Generate Excel file and trigger browser download
    XLSX.writeFile(workbook, `${cleanBaseName}_tables.xlsx`);
  };

  // 3. Export CSV (Clean, without page numbers)
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
    <div className="space-y-5 animate-fadeIn">
      {/* Top Breadcrumb & Navigation Back Bar */}
      <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
        <button
          onClick={onBackToUpload}
          className="flex items-center space-x-2 text-xs font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition cursor-pointer"
        >
          <span>←</span>
          <span>Back to Upload / Document Vault</span>
        </button>

        <div className="flex items-center space-x-3 text-xs text-gray-500">
          <span className="flex items-center space-x-1 bg-slate-100 px-2 py-1 rounded-md">
            <span>📑</span>
            <span className="font-semibold text-slate-800">{totalCount} Sections</span>
          </span>
          <span className="flex items-center space-x-1 bg-slate-100 px-2 py-1 rounded-md">
            <span>📊</span>
            <span className="font-semibold text-slate-800">{allTables.length} Tables</span>
          </span>
          <span className="flex items-center space-x-1 bg-slate-100 px-2 py-1 rounded-md">
            <span>📋</span>
            <span className="font-semibold text-slate-800">{totalFields} Fields</span>
          </span>
        </div>
      </div>

      {/* Document Header & Action Hub */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="text-2xl">📄</span>
            <h2 className="text-lg sm:text-xl font-black text-gray-900 truncate max-w-xl" title={filename}>
              {filename}
            </h2>
          </div>
          {doc.uploaded_at && (
            <p className="text-xs text-gray-500 mt-1 ml-9">
              Extracted and saved on <span className="font-semibold text-gray-700">{new Date(doc.uploaded_at).toLocaleString()}</span>
            </p>
          )}
        </div>

        {/* Quick Action Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Excel Export Button */}
          {allTables.length > 0 && (
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition flex items-center space-x-1.5 shadow-sm cursor-pointer"
              title="Download all tables as formatted Excel workbook (.xlsx)"
            >
              <span>📗</span>
              <span>Export to Excel (.xlsx)</span>
            </button>
          )}

          {/* CSV Export Button */}
          {allTables.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-300 transition flex items-center space-x-1 shadow-2xs cursor-pointer"
              title="Download all tables as clean CSV"
            >
              <span>📊</span>
              <span>Export CSV</span>
            </button>
          )}

          {/* JSON Export Button */}
          <button
            onClick={handleExportJSON}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg border border-gray-300 transition flex items-center space-x-1 shadow-2xs cursor-pointer"
            title="Download full JSON extraction"
          >
            <span>📥</span>
            <span>JSON</span>
          </button>

          {/* Copy JSON */}
          <button
            onClick={handleCopyJSON}
            className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 transition flex items-center space-x-1 shadow-2xs cursor-pointer"
            title="Copy JSON to clipboard"
          >
            <span>{copied ? '✓ Copied' : '📋 Copy JSON'}</span>
          </button>
        </div>
      </div>

      {/* Grounded Summary Card (KPI Strip, Overview & Evidence badges) */}
      {summary && (
        <SummaryCard summary={summary} />
      )}

      {/* Live Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
        <div className="relative flex-1 max-w-lg">
          <input
            type="text"
            placeholder="Search headings, table data, or extracted values..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          />
          <span className="absolute left-3 top-2.5 text-gray-400 text-xs">🔍</span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
            {searchQuery ? `Showing ${matchCount} of ${totalCount} sections` : `${totalCount} total sections`}
          </span>
        </div>
      </div>

      {/* Unified Hierarchical Tree (All Headings, Fields, Schedules, and Tables) */}
      <SectionTree sections={sections} searchQuery={searchQuery} />
    </div>
  );
}
