/**
 * TableView — Interactive Sortable & Filterable Table with Type Detection and Excel/TSV Export
 */

import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';

// ─── Value-type detection & parsing ──────────────────────────────────────────

const CURRENCY_RE = /^\$?[\d,]+(\.\d{1,2})?%?$/;
const DATE_RE = /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$|^\d{4}-\d{2}-\d{2}$/;

function parseSortValue(val) {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  // Strip $ and commas to test if it's a numeric value
  const numClean = s.replace(/[\$,]/g, '').replace(/%$/, '');
  if (!isNaN(Number(numClean)) && numClean !== '') {
    return Number(numClean);
  }
  return s.toLowerCase();
}

const STATUS_WORDS = {
  approved:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  filed:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  satisfied:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  active:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  pending:    'bg-amber-500/10 text-amber-300 border-amber-500/30',
  review:     'bg-amber-500/10 text-amber-300 border-amber-500/30',
  submitted:  'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
  bypassed:   'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
  rejected:   'bg-rose-500/10 text-rose-300 border-rose-500/30',
  denied:     'bg-rose-500/10 text-rose-300 border-rose-500/30',
};

function detectCellType(value, header) {
  if (!value) return 'empty';
  const s = String(value).trim();
  const h = (header || '').toLowerCase();

  if (h.includes('page') || /^page\s+\d+/i.test(s)) return 'page';
  if (CURRENCY_RE.test(s) && (s.startsWith('$') || h.includes('premium') || h.includes('amount') || h.includes('fee') || h.includes('price'))) return 'currency';
  if (DATE_RE.test(s)) return 'date';

  const lower = s.toLowerCase();
  for (const word of Object.keys(STATUS_WORDS)) {
    if (lower === word || lower.startsWith(word + ' ')) return 'status';
  }

  return 'text';
}

function renderCell(value, header, onCopyCell) {
  const s = value !== null && value !== undefined ? String(value).trim() : '';

  if (!s) {
    return <span className="text-zinc-600 font-sans italic">—</span>;
  }

  const type = detectCellType(s, header);

  if (type === 'page') {
    return (
      <span className="text-[11px] py-0.5 px-2 bg-zinc-800 text-zinc-300 rounded border border-zinc-700 font-mono">
        {s}
      </span>
    );
  }

  if (type === 'currency') {
    return (
      <span className="text-xs py-0.5 px-2 bg-emerald-950/40 text-emerald-400 rounded border border-emerald-800/40 font-mono font-bold">
        {s}
      </span>
    );
  }

  if (type === 'date') {
    return (
      <span className="text-xs py-0.5 px-2 bg-zinc-800 text-zinc-200 rounded border border-zinc-700 font-mono">
        {s}
      </span>
    );
  }

  if (type === 'status') {
    const colorCls = STATUS_WORDS[s.toLowerCase()] || 'bg-zinc-800 text-zinc-300 border-zinc-700';
    return (
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded border inline-block ${colorCls}`}>
        {s}
      </span>
    );
  }

  return (
    <span
      onClick={() => onCopyCell && onCopyCell(s)}
      className="whitespace-pre-line leading-relaxed hover:text-indigo-400 cursor-pointer transition-colors"
      title="Click to copy cell text"
    >
      {s}
    </span>
  );
}

// ─── Single Interactive Table Component ───────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function SingleTable({ table }) {
  const { title, headers = [], rows = [] } = table;
  const [filter, setFilter] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc'); // 'asc' or 'desc'
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [copiedTable, setCopiedTable] = useState(false);
  const [cellCopiedMsg, setCellCopiedMsg] = useState('');

  // Handle column header click for sorting
  const handleSort = (colIdx) => {
    if (sortCol === colIdx) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortCol(null);
        setSortDir('asc');
      }
    } else {
      setSortCol(colIdx);
      setSortDir('asc');
    }
  };

  // Filtered and sorted rows
  const processedRows = useMemo(() => {
    let result = [...rows];

    // Filter
    if (filter.trim()) {
      const q = filter.toLowerCase();
      result = result.filter((row) => {
        if (Array.isArray(row)) {
          return row.some((c) => c && String(c).toLowerCase().includes(q));
        }
        return String(row).toLowerCase().includes(q);
      });
    }

    // Sort
    if (sortCol !== null) {
      result.sort((a, b) => {
        const valA = parseSortValue(Array.isArray(a) ? a[sortCol] : a);
        const valB = parseSortValue(Array.isArray(b) ? b[sortCol] : b);

        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rows, filter, sortCol, sortDir]);

  const totalPages = Math.ceil(processedRows.length / pageSize) || 1;
  const pagedRows = processedRows.slice(page * pageSize, (page + 1) * pageSize);

  const handleCopyCell = (text) => {
    navigator.clipboard.writeText(text);
    setCellCopiedMsg(`Copied: "${text.substring(0, 18)}${text.length > 18 ? '...' : ''}"`);
    setTimeout(() => setCellCopiedMsg(''), 1800);
  };

  const handleCopyTableTSV = () => {
    let tsv = '';
    if (headers && headers.length > 0) {
      tsv += headers.join('\t') + '\n';
    }
    rows.forEach((r) => {
      tsv += (Array.isArray(r) ? r : [r]).map((c) => String(c || '').replace(/\t|\n/g, ' ')).join('\t') + '\n';
    });

    navigator.clipboard.writeText(tsv);
    setCopiedTable(true);
    setTimeout(() => setCopiedTable(false), 2000);
  };

  const handleDownloadSingleExcel = () => {
    const workbook = XLSX.utils.book_new();
    const sheetData = [];
    if (title) {
      sheetData.push([title]);
      sheetData.push([]);
    }
    if (headers.length > 0) sheetData.push(headers);
    rows.forEach((r) => sheetData.push(Array.isArray(r) ? r : [r]));

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    const cleanTitle = (title || 'Table').replace(/[:\\/?*\[\]]/g, '').substring(0, 28);
    XLSX.utils.book_append_sheet(workbook, worksheet, cleanTitle);
    XLSX.writeFile(workbook, `${cleanTitle}.xlsx`);
  };

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900 shadow-lg">
      {/* Header bar */}
      <div className="bg-zinc-950/80 px-4 py-3 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5 flex-wrap">
          <span className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
            📊 <span>{title || 'Extracted Table'}</span>
          </span>
          <span className="text-[11px] py-0.5 px-2 bg-zinc-800 text-zinc-300 rounded border border-zinc-700">
            {rows.length} row{rows.length !== 1 ? 's' : ''}
          </span>
          {table.extraction_method && (
            <span className="text-[10px] py-0.5 px-2 bg-indigo-950/60 text-indigo-300 rounded border border-indigo-800/40">
              {table.extraction_method}
            </span>
          )}
          {cellCopiedMsg && (
            <span className="text-[10px] py-0.5 px-2 bg-emerald-950 text-emerald-400 rounded border border-emerald-800 animate-pulse font-medium">
              ✓ {cellCopiedMsg}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 flex-wrap">
          <button
            type="button"
            onClick={handleCopyTableTSV}
            className="text-xs py-1.5 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition flex items-center gap-1"
            title="Copy table to clipboard as TSV for Sheets/Excel"
          >
            {copiedTable ? '✓ Copied' : '📋 Copy TSV'}
          </button>

          <button
            type="button"
            onClick={handleDownloadSingleExcel}
            className="text-xs py-1.5 px-3 rounded-lg bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-700/40 transition flex items-center gap-1"
            title="Download table as Excel spreadsheet"
          >
            📗 Excel
          </button>

          {rows.length > 3 && (
            <div className="relative">
              <input
                type="text"
                placeholder="Search rows..."
                value={filter}
                onChange={(e) => { setFilter(e.target.value); setPage(0); }}
                className="text-xs pl-7 pr-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:border-indigo-500 w-36 sm:w-44 text-zinc-200 placeholder-zinc-500"
              />
              <span className="absolute left-2.5 top-2 text-zinc-500 text-xs">🔍</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          {headers && headers.length > 0 && (
            <thead className="bg-zinc-950 text-[11px] font-bold text-zinc-300 uppercase tracking-wider sticky top-0 z-10 border-b border-zinc-800">
              <tr>
                {headers.map((h, idx) => (
                  <th
                    key={idx}
                    onClick={() => handleSort(idx)}
                    className="py-3 px-3.5 whitespace-nowrap cursor-pointer select-none hover:bg-zinc-800/80 transition-colors"
                    title={`Click to sort by ${h}`}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{h}</span>
                      <span className="text-zinc-500 text-[10px]">
                        {sortCol === idx ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
          )}

          <tbody className="divide-y divide-zinc-800/60 text-zinc-300 font-mono text-xs">
            {pagedRows.map((row, rIdx) => {
              const rowArr = Array.isArray(row) ? row : [row];
              return (
                <tr key={rIdx} className="hover:bg-zinc-800/40 transition">
                  {rowArr.map((cell, cIdx) => (
                    <td key={cIdx} className="py-2.5 px-3.5 align-top">
                      {renderCell(cell, headers[cIdx], handleCopyCell)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="bg-zinc-950/80 px-4 py-2.5 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center space-x-3">
          <span>
            Showing {processedRows.length === 0 ? 0 : page * pageSize + 1} - {Math.min((page + 1) * pageSize, processedRows.length)} of {processedRows.length} rows
          </span>
          {processedRows.length > 10 && (
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
              className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded px-2 py-0.5 text-xs focus:outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size} / page</option>
              ))}
            </select>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 transition"
            >
              ← Prev
            </button>
            <span className="text-zinc-400 text-xs px-1">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 transition"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TableView({ tables }) {
  if (!tables || tables.length === 0) return null;

  return (
    <div className="space-y-6 my-4">
      {tables.map((table, idx) => (
        <SingleTable key={idx} table={table} />
      ))}
    </div>
  );
}
