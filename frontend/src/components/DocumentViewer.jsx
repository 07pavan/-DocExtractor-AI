import { useState, useMemo } from 'react';
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

export default function DocumentViewer({ document: doc }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const sections = useMemo(() => extractTopLevelSections(doc), [doc]);
  const totalCount = useMemo(() => countSectionsRecursively(sections), [sections]);
  const matchCount = useMemo(
    () => (searchQuery.trim() ? countMatchingSectionsRecursively(sections, searchQuery) : totalCount),
    [sections, searchQuery, totalCount]
  );

  const allTables = useMemo(() => collectAllTables(sections), [sections]);

  if (!doc) return null;

  const filename = doc.filename || doc.heading || 'Document Extraction';
  const summary = doc.summary || (doc.sections && typeof doc.sections === 'object' ? doc.sections.summary : null);

  // Export handlers
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(doc, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${filename.replace(/\.[^/.]+$/, "")}_extraction.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = () => {
    if (allTables.length === 0) {
      alert("No structured tables found in this extraction to export as CSV.");
      return;
    }
    let csvContent = "";
    allTables.forEach((tab) => {
      if (tab.title) csvContent += `"${tab.title}"\n`;
      if (tab.headers) csvContent += tab.headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";
      if (tab.rows) {
        tab.rows.forEach(r => {
          csvContent += (Array.isArray(r) ? r : [r]).map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(",") + "\n";
        });
      }
      csvContent += "\n\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename.replace(/\.[^/.]+$/, "")}_tables.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(doc, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pt-4 border-t space-y-4 animate-fadeIn">
      {/* Document Header & Action Hub */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xl">📄</span>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate max-w-md" title={filename}>
              {filename}
            </h2>
          </div>
          {doc.uploaded_at && (
            <p className="text-xs text-gray-500 mt-0.5 ml-7">
              Processed on {new Date(doc.uploaded_at).toLocaleString()}
            </p>
          )}
        </div>

        {/* Quick Action Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportJSON}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg border border-gray-300 transition flex items-center space-x-1"
          >
            <span>📥</span>
            <span>Download JSON</span>
          </button>

          {allTables.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-300 transition flex items-center space-x-1"
            >
              <span>📊</span>
              <span>Export Tables (CSV)</span>
            </button>
          )}

          <button
            onClick={handleCopyJSON}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 transition flex items-center space-x-1"
          >
            <span>{copied ? '✓ Copied' : '📋 Copy JSON'}</span>
          </button>
        </div>
      </div>

      {/* Executive Summary Card (if generated by LLM) */}
      {summary && (
        <SummaryCard summary={summary} />
      )}

      {/* Search Input Bar & Match Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search headings, text, or fields..."
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

        <span className="text-xs font-medium px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full self-start sm:self-auto">
          {searchQuery ? `Showing ${matchCount} of ${totalCount} sections` : `${totalCount} total sections`}
        </span>
      </div>

      {/* Unified Hierarchical Accordion Tree (Containing all Headings, Fields, and Tables) */}
      <SectionTree sections={sections} searchQuery={searchQuery} />
    </div>
  );
}
