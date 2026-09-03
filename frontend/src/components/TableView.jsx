/**
 * TableView — Type-Aware Dynamic Table Renderer
 *
 * Per-cell type detection:
 *   Currency  ($xxx)   → green chip
 *   Date      (MM/DD/YYYY or similar) → blue badge
 *   Status    (Filed / Approved / Pending / Bypassed / Satisfied) → colour pill
 *   Page ref  (Page N) → slate badge
 *   Null / empty       → em dash placeholder (never fabricated text)
 *
 * Row grouping:
 *   When > 15 rows are present, the table renders in pages of 50 with
 *   Prev / Next navigation to prevent cognitive overload.
 */

import { useState, useMemo } from 'react';

// ─── Value-type detection ────────────────────────────────────────────────────

const CURRENCY_RE = /^\$[\d,]+(\.\d{1,2})?$/;
const DATE_RE = /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$|^\d{4}-\d{2}-\d{2}$/;
const STATUS_WORDS = {
  approved:   'bg-emerald-100 text-emerald-800',
  filed:      'bg-emerald-100 text-emerald-800',
  satisfied:  'bg-emerald-100 text-emerald-800',
  active:     'bg-emerald-100 text-emerald-800',
  pending:    'bg-amber-100 text-amber-800',
  review:     'bg-amber-100 text-amber-800',
  submitted:  'bg-blue-100 text-blue-800',
  bypassed:   'bg-purple-100 text-purple-800',
  bypass:     'bg-purple-100 text-purple-800',
  initial:    'bg-blue-100 text-blue-800',
  rejected:   'bg-red-100 text-red-800',
  denied:     'bg-red-100 text-red-800',
  withdrawn:  'bg-red-100 text-red-800',
};

function detectCellType(value, header) {
  if (!value) return 'empty';
  const s = String(value).trim();
  const h = (header || '').toLowerCase();

  if (h.includes('page') || /^page\s+\d+/i.test(s)) return 'page';
  if (CURRENCY_RE.test(s)) return 'currency';
  if (DATE_RE.test(s)) return 'date';

  const lower = s.toLowerCase();
  for (const word of Object.keys(STATUS_WORDS)) {
    if (lower === word || lower.startsWith(word + ' ')) return 'status';
  }

  return 'text';
}

function renderCell(value, header) {
  const s = value !== null && value !== undefined ? String(value).trim() : '';

  if (!s) {
    return <span className="text-gray-300">—</span>;
  }

  const type = detectCellType(s, header);

  if (type === 'page') {
    return (
      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded text-[11px] whitespace-nowrap">
        {s}
      </span>
    );
  }

  if (type === 'currency') {
    return (
      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 font-bold rounded text-[11px] whitespace-nowrap">
        {s}
      </span>
    );
  }

  if (type === 'date') {
    return (
      <span className="px-1.5 py-0.5 bg-blue-50 text-blue-800 font-semibold rounded text-[11px] whitespace-nowrap">
        📅 {s}
      </span>
    );
  }

  if (type === 'status') {
    const lower = s.toLowerCase();
    let colorCls = 'bg-gray-100 text-gray-700';
    for (const [word, cls] of Object.entries(STATUS_WORDS)) {
      if (lower.startsWith(word)) { colorCls = cls; break; }
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${colorCls}`}>
        {s}
      </span>
    );
  }

  // Default plain text
  return <span className="whitespace-pre-line leading-relaxed">{s}</span>;
}

// ─── Single Table ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

function SingleTable({ table }) {
  const { title, headers = [], rows = [] } = table;
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);

  const filteredRows = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    return rows.filter((row) => {
      if (Array.isArray(row)) return row.some((c) => c && String(c).toLowerCase().includes(q));
      return String(row).toLowerCase().includes(q);
    });
  }, [rows, filter]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const pagedRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset to page 0 when filter changes
  const handleFilter = (e) => {
    setFilter(e.target.value);
    setPage(0);
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Header row */}
      <div className="bg-slate-50 px-3.5 py-2.5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2 flex-wrap">
          <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">
            📊 {title || 'Structured Table'}
          </span>
          <span className="text-[11px] px-2 py-0.5 bg-blue-100 text-blue-800 font-semibold rounded-full">
            {rows.length} row{rows.length !== 1 ? 's' : ''}
          </span>
          {filter && (
            <span className="text-[11px] px-2 py-0.5 bg-amber-100 text-amber-800 font-semibold rounded-full">
              {filteredRows.length} match{filteredRows.length !== 1 ? 'es' : ''}
            </span>
          )}
        </div>

        {rows.length > 3 && (
          <div className="relative">
            <input
              type="text"
              placeholder="Filter rows..."
              value={filter}
              onChange={handleFilter}
              className="text-xs pl-7 pr-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
            />
            <span className="absolute left-2 top-1.5 text-gray-400 text-xs">🔍</span>
          </div>
        )}
      </div>

      {/* Table body */}
      <div className="overflow-x-auto max-h-[520px]">
        <table className="w-full text-left text-xs">
          {headers.length > 0 && (
            <thead className="sticky top-0 bg-gray-100 border-b border-gray-200 text-gray-700 font-semibold shadow-xs z-10">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="py-2.5 px-3 whitespace-nowrap bg-gray-100">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-gray-100">
            {pagedRows.length > 0 ? (
              pagedRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-blue-50/30 transition">
                  {Array.isArray(row) ? (
                    row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-2 px-3 text-gray-800 break-words align-top">
                        {renderCell(cell, headers[cIdx])}
                      </td>
                    ))
                  ) : (
                    <td colSpan={headers.length || 1} className="py-2 px-3 text-gray-800">
                      {String(row)}
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length || 1} className="py-6 text-center text-gray-400 italic text-xs">
                  No matching rows found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls (only when > PAGE_SIZE rows) */}
      {totalPages > 1 && (
        <div className="px-3.5 py-2 border-t border-gray-100 bg-slate-50 flex items-center justify-between text-xs text-gray-600">
          <span>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredRows.length)} of {filteredRows.length} rows
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2.5 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 transition font-medium cursor-pointer"
            >
              ← Prev
            </button>
            <span className="font-semibold">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2.5 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 transition font-medium cursor-pointer"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Multi-Table Container ────────────────────────────────────────────────────

export default function TableView({ tables }) {
  if (!tables || tables.length === 0) return null;

  return (
    <div className="space-y-4 my-3">
      {tables.map((table, tIdx) => (
        <SingleTable key={tIdx} table={table} />
      ))}
    </div>
  );
}
