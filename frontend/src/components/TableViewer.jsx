import React, { useState, useMemo } from 'react';
import { 
  X, 
  Table, 
  Search, 
  Download, 
  Copy, 
  Check, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight,
  FileSpreadsheet
} from 'lucide-react';

export default function TableViewer({ 
  tables = [], 
  initialTable = null, 
  onClose 
}) {
  const [selectedTableIndex, setSelectedTableIndex] = useState(() => {
    if (initialTable) {
      const idx = tables.findIndex(t => t.id === initialTable.id);
      return idx !== -1 ? idx : 0;
    }
    return 0;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumnIndex, setSortColumnIndex] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'
  const [copied, setCopied] = useState(false);

  const activeTable = tables[selectedTableIndex] || tables[0] || initialTable;

  const handleSort = (colIdx) => {
    if (sortColumnIndex === colIdx) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else {
        setSortColumnIndex(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumnIndex(colIdx);
      setSortDirection('asc');
    }
  };

  const filteredRows = useMemo(() => {
    if (!activeTable || !activeTable.rows) return [];
    let rows = [...activeTable.rows];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(row => 
        row.some(cell => String(cell || '').toLowerCase().includes(q))
      );
    }

    // Sort
    if (sortColumnIndex !== null) {
      rows.sort((a, b) => {
        const valA = String(a[sortColumnIndex] || '').trim();
        const valB = String(b[sortColumnIndex] || '').trim();

        // Check if numeric
        const numA = parseFloat(valA.replace(/[$,%]/g, ''));
        const numB = parseFloat(valB.replace(/[$,%]/g, ''));

        if (!isNaN(numA) && !isNaN(numB)) {
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }

        return sortDirection === 'asc' 
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      });
    }

    return rows;
  }, [activeTable, searchQuery, sortColumnIndex, sortDirection]);

  const handleCopyMarkdown = () => {
    if (!activeTable) return;
    navigator.clipboard.writeText(activeTable.raw_markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCSV = () => {
    if (!activeTable) return;
    let csv = "";
    if (activeTable.headers && activeTable.headers.length > 0) {
      csv += activeTable.headers.map(h => `"${(h || '').replace(/"/g, '""')}"`).join(",") + "\n";
    }
    if (filteredRows) {
      filteredRows.forEach(row => {
        csv += row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(",") + "\n";
      });
    }
    const a = document.createElement("a");
    const file = new Blob([csv], { type: 'text/csv' });
    a.href = URL.createObjectURL(file);
    a.download = `table_page_${activeTable.page}_export.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!activeTable) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Table className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Document Table Inspector</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                  Page {activeTable.page}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {tables.length} total table{tables.length > 1 ? 's' : ''} detected in document
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Table pagination/selector */}
            {tables.length > 1 && (
              <div className="flex items-center space-x-1.5 mr-2 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-xs">
                <button
                  disabled={selectedTableIndex === 0}
                  onClick={() => setSelectedTableIndex(prev => Math.max(0, prev - 1))}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-slate-300 font-mono text-[11px]">
                  Table {selectedTableIndex + 1} of {tables.length}
                </span>
                <button
                  disabled={selectedTableIndex === tables.length - 1}
                  onClick={() => setSelectedTableIndex(prev => Math.min(tables.length - 1, prev + 1))}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              onClick={handleCopyMarkdown}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors flex items-center space-x-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleDownloadCSV}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors flex items-center space-x-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Stats Bar */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="relative w-72">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search table rows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
            />
          </div>

          <div className="text-slate-400 font-mono text-[11px]">
            Showing {filteredRows.length} of {activeTable.rows?.length || 0} rows • {activeTable.headers?.length || activeTable.col_count} columns
          </div>
        </div>

        {/* Scrollable Table View */}
        <div className="flex-1 overflow-auto p-4">
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80 shadow-inner">
            <table className="w-full text-left text-xs border-collapse">
              {activeTable.headers && activeTable.headers.length > 0 && (
                <thead className="sticky top-0 bg-slate-900 z-10">
                  <tr className="border-b border-slate-700">
                    <th className="px-3 py-2.5 text-slate-500 font-mono text-[10px] w-12 border-r border-slate-800">
                      #
                    </th>
                    {activeTable.headers.map((header, idx) => (
                      <th 
                        key={idx} 
                        onClick={() => handleSort(idx)}
                        className="px-4 py-2.5 font-semibold text-slate-200 border-r border-slate-800 last:border-r-0 cursor-pointer hover:bg-slate-800/80 transition-colors select-none"
                      >
                        <div className="flex items-center justify-between space-x-1">
                          <span>{header}</span>
                          <ArrowUpDown className={`w-3 h-3 ${sortColumnIndex === idx ? 'text-brand-400' : 'text-slate-600'}`} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
              )}

              <tbody>
                {filteredRows.length > 0 ? (
                  filteredRows.map((row, rIdx) => (
                    <tr 
                      key={rIdx} 
                      className="border-b border-slate-800/60 hover:bg-slate-900/50 transition-colors"
                    >
                      <td className="px-3 py-2 font-mono text-[10px] text-slate-600 border-r border-slate-800/60">
                        {rIdx + 1}
                      </td>
                      {row.map((cell, cIdx) => (
                        <td 
                          key={cIdx} 
                          className="px-4 py-2 text-slate-300 border-r border-slate-800/60 last:border-r-0 whitespace-pre-wrap leading-relaxed"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={(activeTable.headers?.length || 1) + 1} className="py-12 text-center text-slate-500 text-xs">
                      No matching records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
