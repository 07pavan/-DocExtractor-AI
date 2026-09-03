/**
 * TableView — Type-Aware Dynamic Table Renderer with Specify Theme & Quick Copy Actions
 */

import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';

// ─── Value-type detection ────────────────────────────────────────────────────

const CURRENCY_RE = /^\$[\d,]+(\.\d{1,2})?$/;
const DATE_RE = /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$|^\d{4}-\d{2}-\d{2}$/;
const STATUS_WORDS = {
  approved:   'bg-mint-wash text-fern-pop border-fern-pop/30',
  filed:      'bg-mint-wash text-fern-pop border-fern-pop/30',
  satisfied:  'bg-mint-wash text-fern-pop border-fern-pop/30',
  active:     'bg-mint-wash text-fern-pop border-fern-pop/30',
  pending:    'bg-apricot-wash text-amber-800 border-amber-300',
  review:     'bg-apricot-wash text-amber-800 border-amber-300',
  submitted:  'bg-lilac-wash text-iris border-iris/30',
  bypassed:   'bg-lilac-wash text-iris border-iris/30',
  bypass:     'bg-lilac-wash text-iris border-iris/30',
  initial:    'bg-lilac-wash text-iris border-iris/30',
  rejected:   'bg-rose-50 text-rose-800 border-rose-300',
  denied:     'bg-rose-50 text-rose-800 border-rose-300',
  withdrawn:  'bg-rose-50 text-rose-800 border-rose-300',
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

function renderCell(value, header, onCopyCell) {
  const s = value !== null && value !== undefined ? String(value).trim() : '';

  if (!s) {
    return <span className="text-graphite font-sans italic">—</span>;
  }

  const type = detectCellType(s, header);

  if (type === 'page') {
    return (
      <span className="pill-badge !text-[11px] !py-0.5 !px-2 !bg-cloud !text-iron">
        {s}
      </span>
    );
  }

  if (type === 'currency') {
    return (
      <span className="pill-badge !text-xs !py-0.5 !px-2.5 !bg-mint-wash !text-fern-pop font-mono font-bold">
        {s}
      </span>
    );
  }

  if (type === 'date') {
    return (
      <span className="pill-badge !text-xs !py-0.5 !px-2.5 !bg-pure-white !text-studio-slate border border-mist font-mono font-semibold">
        {s}
      </span>
    );
  }

  if (type === 'status') {
    const colorCls = STATUS_WORDS[s.toLowerCase()] || 'bg-cloud text-studio-slate border-mist';
    return (
      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-pill border inline-block ${colorCls}`}>
        {s}
      </span>
    );
  }

  // Default text with click-to-copy
  return (
    <span
      onClick={() => onCopyCell && onCopyCell(s)}
      className="whitespace-pre-line leading-relaxed hover:text-iris cursor-pointer"
      title="Click to copy cell text"
    >
      {s}
    </span>
  );
}

// ─── Single Table ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

function SingleTable({ table }) {
  const { title, headers = [], rows = [] } = table;
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [copiedTable, setCopiedTable] = useState(false);
  const [cellCopiedMsg, setCellCopiedMsg] = useState('');

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

  const handleFilter = (e) => {
    setFilter(e.target.value);
    setPage(0);
  };

  const handleCopyCell = (text) => {
    navigator.clipboard.writeText(text);
    setCellCopiedMsg(`Copied: "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`);
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
    <div className="border border-mist rounded-card overflow-hidden bg-pure-white shadow-subtle-2">
      {/* Header row */}
      <div className="bg-cloud px-4 py-3 border-b border-mist flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center space-x-2.5 flex-wrap">
          <span className="text-xs font-bold text-studio-slate">
            📊 {title || 'Structured Table'}
          </span>
          <span className="pill-badge !text-[11px] !py-0.5 !px-2.5 !bg-pure-white !text-studio-slate">
            {rows.length} row{rows.length !== 1 ? 's' : ''}
          </span>
          {cellCopiedMsg && (
            <span className="pill-badge !text-[10px] !py-0.5 !px-2 !bg-mint-wash !text-fern-pop animate-fadeIn font-semibold">
              ✓ {cellCopiedMsg}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Quick Copy & Single Excel Export */}
          <button
            type="button"
            onClick={handleCopyTableTSV}
            className="btn-pill-ghost !text-[11px] !py-1 !px-2.5"
            title="Copy entire table to paste directly into Excel or Google Sheets"
          >
            <span>{copiedTable ? '✓ Copied' : '📋 Copy Table'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadSingleExcel}
            className="btn-pill-ghost !text-[11px] !py-1 !px-2.5 hover:!border-iris hover:!text-iris"
            title="Download this table as .xlsx"
          >
            <span>📗 .xlsx</span>
          </button>

          {rows.length > 3 && (
            <div className="relative">
              <input
                type="text"
                placeholder="Filter rows..."
                value={filter}
                onChange={handleFilter}
                className="text-xs pl-7 pr-3 py-1 bg-pure-white border border-mist focus:border-iris rounded-control focus:outline-none w-36 text-studio-slate"
              />
              <span className="absolute left-2 top-1.5 text-graphite text-xs">🔍</span>
            </div>
          )}
        </div>
      </div>

      {/* Table grid */}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          {headers && headers.length > 0 && (
            <thead className="bg-cloud/80 text-[11px] font-bold text-iron uppercase tracking-wider sticky top-0 z-10 border-b border-mist">
              <tr>
                {headers.map((h, idx) => (
                  <th key={idx} className="py-2.5 px-3.5 whitespace-nowrap bg-cloud">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          )}

          <tbody className="divide-y divide-mist text-studio-slate font-mono text-xs">
            {pagedRows.map((row, rIdx) => {
              const rowArr = Array.isArray(row) ? row : [row];
              return (
                <tr key={rIdx} className="hover:bg-lilac-wash/20 transition">
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

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="bg-cloud px-4 py-2 border-t border-mist flex items-center justify-between text-xs text-iron">
          <span>
            Page {page + 1} of {totalPages} ({filteredRows.length} total rows)
          </span>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-pill-ghost !text-xs !py-1 !px-2.5 disabled:opacity-30 cursor-pointer"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="btn-pill-ghost !text-xs !py-1 !px-2.5 disabled:opacity-30 cursor-pointer"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TableView({ tables }) {
  if (!tables || tables.length === 0) return null;

  return (
    <div className="space-y-4 my-2">
      {tables.map((table, idx) => (
        <SingleTable key={idx} table={table} />
      ))}
    </div>
  );
}
