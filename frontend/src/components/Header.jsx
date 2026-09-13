import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  Search, 
  UploadCloud, 
  Table, 
  FileSpreadsheet, 
  Code, 
  Layers, 
  ChevronDown,
  Sparkles,
  RefreshCw
} from 'lucide-react';

export default function Header({ 
  documentTree, 
  onReset, 
  onOpenSearch, 
  onOpenTableViewer,
  activeView,
  setActiveView 
}) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const downloadFile = (content, fileName, contentType) => {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
    setShowExportMenu(false);
  };

  const handleExportJSON = () => {
    if (!documentTree) return;
    const jsonStr = JSON.stringify(documentTree, null, 2);
    downloadFile(jsonStr, `${documentTree.filename.replace(/\.pdf$/i, '')}_extracted_tree.json`, 'application/json');
  };

  const handleExportMarkdown = () => {
    if (!documentTree) return;
    downloadFile(documentTree.raw_markdown, `${documentTree.filename.replace(/\.pdf$/i, '')}_extracted.md`, 'text/markdown');
  };

  const handleExportAllTablesCSV = () => {
    if (!documentTree) return;
    // Collect all tables across the document
    const allTables = [];
    const extractTables = (nodes) => {
      for (const node of nodes) {
        if (node.tables && node.tables.length > 0) {
          allTables.push(...node.tables);
        }
        if (node.children && node.children.length > 0) {
          extractTables(node.children);
        }
      }
    };
    extractTables(documentTree.toc || []);

    if (allTables.length === 0) {
      alert("No tables found in this document.");
      return;
    }

    let csvContent = "";
    allTables.forEach((tbl, idx) => {
      csvContent += `--- TABLE ${idx + 1} (Page ${tbl.page}) ---\n`;
      if (tbl.headers && tbl.headers.length > 0) {
        csvContent += tbl.headers.map(h => `"${(h || '').replace(/"/g, '""')}"`).join(",") + "\n";
      }
      if (tbl.rows) {
        tbl.rows.forEach(row => {
          csvContent += row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(",") + "\n";
        });
      }
      csvContent += "\n\n";
    });

    downloadFile(csvContent, `${documentTree.filename.replace(/\.pdf$/i, '')}_all_tables.csv`, 'text/csv');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={onReset}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-brand-500/20 ring-1 ring-white/20">
              <Layers className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  DocExtractor<span className="text-brand-400 font-black">AI</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Hierarchical PDF Structure & Table Engine
              </p>
            </div>
          </div>

          {/* Center: Document info badge if loaded */}
          {documentTree && (
            <div className="hidden md:flex items-center space-x-3 bg-slate-900/90 border border-slate-800 px-3.5 py-1.5 rounded-full shadow-inner">
              <FileText className="w-4 h-4 text-brand-400 shrink-0" />
              <span className="text-xs font-medium text-slate-200 truncate max-w-[200px]" title={documentTree.filename}>
                {documentTree.filename}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-[11px] text-slate-400 font-mono">
                {documentTree.total_pages} {documentTree.total_pages === 1 ? 'page' : 'pages'}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-[11px] text-brand-400 font-mono font-semibold">
                {documentTree.total_sections} sections
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-[11px] text-emerald-400 font-mono">
                {documentTree.total_tables} tables
              </span>
            </div>
          )}

          {/* Right Action buttons */}
          <div className="flex items-center space-x-2">
            {documentTree ? (
              <>
                {/* Search Button */}
                <button
                  onClick={onOpenSearch}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-colors shadow-sm"
                  title="Search full document (Ctrl+K)"
                >
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Search</span>
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 rounded border border-slate-700">
                    ⌘K
                  </kbd>
                </button>

                {/* All Tables Modal Trigger */}
                <button
                  onClick={onOpenTableViewer}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-colors"
                >
                  <Table className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Tables</span>
                  <span className="px-1.5 py-0.2 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 rounded-full">
                    {documentTree.total_tables}
                  </span>
                </button>

                {/* Export Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-brand-400 hover:bg-brand-300 transition-all shadow-md shadow-brand-500/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export</span>
                    <ChevronDown className="w-3 h-3 ml-0.5" />
                  </button>

                  {showExportMenu && (
                    <div 
                      className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                      onMouseLeave={() => setShowExportMenu(false)}
                    >
                      <button
                        onClick={handleExportJSON}
                        className="w-full text-left flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
                      >
                        <Code className="w-4 h-4 text-brand-400" />
                        <div>
                          <div>Hierarchical Tree (JSON)</div>
                          <div className="text-[10px] text-slate-400">Full nested AST structure</div>
                        </div>
                      </button>
                      <button
                        onClick={handleExportMarkdown}
                        className="w-full text-left flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
                      >
                        <FileText className="w-4 h-4 text-sky-400" />
                        <div>
                          <div>Markdown Document (.md)</div>
                          <div className="text-[10px] text-slate-400">Layout-clean markdown text</div>
                        </div>
                      </button>
                      <button
                        onClick={handleExportAllTablesCSV}
                        className="w-full text-left flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        <div>
                          <div>All Tables (.csv)</div>
                          <div className="text-[10px] text-slate-400">Export detected tabular datasets</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* Upload New Document */}
                <button
                  onClick={onReset}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
                  title="Upload another document"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  <Sparkles className="w-3 h-3 mr-1" />
                  pymupdf4llm engine ready
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
