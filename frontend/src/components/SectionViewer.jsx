import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  FileText, 
  Table, 
  Copy, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  ArrowRight,
  Layers, 
  FileSpreadsheet, 
  ExternalLink,
  BookOpen
} from 'lucide-react';

const LEVEL_COLORS = {
  1: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Heading 1' },
  2: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30', label: 'Heading 2' },
  3: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Heading 3' },
  4: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', label: 'Heading 4' },
  5: { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30', label: 'Heading 5' },
  6: { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30', label: 'Heading 6' },
  0: { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30', label: 'Document Root' }
};

export default function SectionViewer({ 
  section, 
  documentTree, 
  onSelectSection, 
  onOpenTableModal 
}) {
  const [copiedId, setCopiedId] = useState(null);

  if (!section) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
        <div>
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-600" />
          <p className="text-sm font-medium">Select a section from the Table of Contents to view content.</p>
        </div>
      </div>
    );
  }

  const levelInfo = LEVEL_COLORS[section.level] || LEVEL_COLORS[1];

  // Build Breadcrumbs by traversing parent hierarchy from flat_sections or recursive search
  const getBreadcrumbs = () => {
    const crumbs = [];
    const findPath = (nodes, targetId, path) => {
      for (const node of nodes) {
        if (node.id === targetId) {
          crumbs.push(...path, node);
          return true;
        }
        if (node.children && node.children.length > 0) {
          if (findPath(node.children, targetId, [...path, node])) return true;
        }
      }
      return false;
    };
    findPath(documentTree?.toc || [], section.id, []);
    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(section.raw_markdown || section.content);
    setCopiedId('section_raw');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyTable = (table) => {
    navigator.clipboard.writeText(table.raw_markdown);
    setCopiedId(table.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadTableCSV = (table) => {
    let csv = "";
    if (table.headers && table.headers.length > 0) {
      csv += table.headers.map(h => `"${(h || '').replace(/"/g, '""')}"`).join(",") + "\n";
    }
    if (table.rows) {
      table.rows.forEach(row => {
        csv += row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(",") + "\n";
      });
    }
    const a = document.createElement("a");
    const file = new Blob([csv], { type: 'text/csv' });
    a.href = URL.createObjectURL(file);
    a.download = `table_page_${table.page}_${table.id}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Find prev/next flat section for quick linear navigation
  const flatKeys = Object.keys(documentTree?.flat_sections || {});
  const currentIndex = flatKeys.indexOf(section.id);
  const prevId = currentIndex > 0 ? flatKeys[currentIndex - 1] : null;
  const nextId = currentIndex >= 0 && currentIndex < flatKeys.length - 1 ? flatKeys[currentIndex + 1] : null;

  const findSectionById = (nodes, id) => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findSectionById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl">
      
      {/* Header Bar */}
      <div className="p-5 border-b border-slate-800 bg-slate-900/90 space-y-3">
        
        {/* Breadcrumb Trail */}
        {breadcrumbs.length > 1 && (
          <div className="flex items-center space-x-1.5 text-xs text-slate-400 overflow-x-auto pb-1 scrollbar-none">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.id}>
                <button
                  type="button"
                  onClick={() => onSelectSection(crumb)}
                  className={`hover:text-brand-300 transition-colors truncate max-w-[150px] ${
                    idx === breadcrumbs.length - 1 ? 'text-slate-200 font-semibold' : ''
                  }`}
                >
                  {crumb.title}
                </button>
                {idx < breadcrumbs.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Section Title & Tag */}
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border ${levelInfo.bg} ${levelInfo.text} ${levelInfo.border}`}>
                {levelInfo.label}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-mono border border-slate-700">
                Page {section.page_start}{section.page_end > section.page_start ? ` - ${section.page_end}` : ''}
              </span>
              <span className="text-xs text-slate-400">
                • {section.word_count} words
              </span>
            </div>
            
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {section.title}
            </h1>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleCopyMarkdown}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 transition-colors"
              title="Copy raw markdown of this section"
            >
              {copiedId === 'section_raw' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Markdown</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Rendered Markdown Body */}
        {section.content ? (
          <div className="markdown-body max-w-none text-slate-300 text-sm leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {section.content}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-xs italic text-slate-500">
            This section serves as a heading container for its child subsections below.
          </p>
        )}

        {/* Dedicated Extracted Tables Preview */}
        {section.tables && section.tables.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Table className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                  Detected Tables ({section.tables.length})
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                Parsed from vector layout via pymupdf4llm
              </span>
            </div>

            <div className="space-y-4">
              {section.tables.map((table, idx) => (
                <div 
                  key={table.id || idx} 
                  className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden shadow-md"
                >
                  {/* Table Card Header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-200">Table {idx + 1}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({table.row_count} rows × {table.col_count} cols • Page {table.page})
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleCopyTable(table)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center space-x-1 transition-colors"
                        title="Copy Markdown Table"
                      >
                        {copiedId === table.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>Copy</span>
                      </button>

                      <button
                        onClick={() => handleDownloadTableCSV(table)}
                        className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] flex items-center space-x-1 transition-colors"
                        title="Download CSV"
                      >
                        <FileSpreadsheet className="w-3 h-3" />
                        <span>CSV</span>
                      </button>

                      {onOpenTableModal && (
                        <button
                          onClick={() => onOpenTableModal(table)}
                          className="px-2 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[11px] flex items-center space-x-1 transition-colors"
                          title="Open Fullscreen Viewer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>View</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Rendered Table preview */}
                  <div className="overflow-x-auto p-3">
                    <table className="w-full text-left text-xs border-collapse">
                      {table.headers && table.headers.length > 0 && (
                        <thead>
                          <tr className="border-b border-slate-700 bg-slate-900/50">
                            {table.headers.map((h, i) => (
                              <th key={i} className="px-3 py-2 font-semibold text-slate-200">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                      )}
                      <tbody>
                        {table.rows && table.rows.slice(0, 10).map((row, rIdx) => (
                          <tr key={rIdx} className="border-b border-slate-800/60 hover:bg-slate-900/30">
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="px-3 py-1.5 text-slate-300 whitespace-pre-wrap">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {table.rows && table.rows.length > 10 && (
                      <div className="text-center py-2 text-[11px] text-slate-500 border-t border-slate-800/60">
                        Showing first 10 of {table.rows.length} rows. Click &quot;View&quot; for complete data.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Child Subsections Navigation Cards */}
        {section.children && section.children.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-brand-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Sub-Sections ({section.children.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {section.children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => onSelectSection(child)}
                  className="text-left p-3.5 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/90 hover:border-brand-500/40 transition-all flex items-start justify-between group"
                >
                  <div className="space-y-1 truncate mr-2">
                    <div className="text-xs font-bold text-slate-200 group-hover:text-brand-300 truncate">
                      {child.title}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center space-x-2">
                      <span>Page {child.page_start}</span>
                      <span>•</span>
                      <span>{child.word_count} words</span>
                      {child.table_count > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-400">{child.table_count} tables</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-brand-400 shrink-0 mt-1 transition-transform group-hover:translate-x-1" />
                </button>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Footer Navigation (Prev / Next section) */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs">
        {prevId ? (
          <button
            onClick={() => {
              const prevNode = findSectionById(documentTree?.toc || [], prevId);
              if (prevNode) onSelectSection(prevNode);
            }}
            className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous Section</span>
          </button>
        ) : <div />}

        {nextId ? (
          <button
            onClick={() => {
              const nextNode = findSectionById(documentTree?.toc || [], nextId);
              if (nextNode) onSelectSection(nextNode);
            }}
            className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 transition-colors"
          >
            <span>Next Section</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : <div />}
      </div>
    </div>
  );
}
