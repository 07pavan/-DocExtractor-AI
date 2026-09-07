import React from 'react';

const STATUS_COLORS = {
  approved: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40',
  filed: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40',
  active: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40',
  satisfied: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40',
  pending: 'bg-amber-950/60 text-amber-400 border-amber-800/40',
  review: 'bg-amber-950/60 text-amber-400 border-amber-800/40',
  submitted: 'bg-indigo-950/60 text-indigo-300 border-indigo-800/40',
  rejected: 'bg-rose-950/60 text-rose-400 border-rose-800/40',
  denied: 'bg-rose-950/60 text-rose-400 border-rose-800/40',
};

function getStatusColor(value) {
  if (!value) return 'bg-zinc-800 text-zinc-300 border-zinc-700';
  const lower = value.toLowerCase().trim();
  for (const [key, cls] of Object.entries(STATUS_COLORS)) {
    if (lower.includes(key)) return cls;
  }
  return 'bg-indigo-950/60 text-indigo-300 border-indigo-800/40';
}

function KpiCard({ label, value, type, nullLabel, sourceEvidence, onCitationClick }) {
  const isNull = value === null || value === undefined || value === '';

  if (isNull) {
    return (
      <div className="flex flex-col justify-between p-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 min-w-[150px] flex-1">
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          {label}
        </span>
        <span className="text-xs text-zinc-600 italic flex items-center space-x-1 mt-2">
          <span>ℹ️</span>
          <span>{nullLabel || 'Not found'}</span>
        </span>
      </div>
    );
  }

  // Currency rendering
  if (type === 'currency' || (typeof value === 'string' && value.includes('$'))) {
    return (
      <div className="flex flex-col justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-950 shadow-md min-w-[150px] flex-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            {label}
          </span>
          <span className="text-[10px] text-emerald-400 font-bold font-mono">USD</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
          <span className="text-lg font-bold text-emerald-400 font-mono">{value}</span>
          {sourceEvidence?.source_page && (
            <button
              type="button"
              onClick={() => onCitationClick && onCitationClick(sourceEvidence.source_page, sourceEvidence.source_text || value)}
              className="text-[10px] text-indigo-300 bg-indigo-950 hover:bg-indigo-700 hover:text-white px-1.5 py-0.5 rounded font-semibold cursor-pointer transition border border-indigo-800/40"
            >
              p.{sourceEvidence.source_page} ↗
            </button>
          )}
        </div>
      </div>
    );
  }

  // Status rendering
  if (type === 'status') {
    const colorClass = getStatusColor(value);
    return (
      <div className="flex flex-col justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-950 shadow-md min-w-[150px] flex-1">
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          {label}
        </span>
        <div className="mt-2">
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded border inline-block ${colorClass}`}>
            {value}
          </span>
        </div>
      </div>
    );
  }

  // Default text card
  return (
    <div className="flex flex-col justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-950 shadow-md min-w-[150px] flex-1">
      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
        {label}
      </span>
      <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
        <span className="text-xs font-bold text-zinc-200 truncate max-w-[180px]" title={value}>
          {value}
        </span>
        {sourceEvidence?.source_page && (
          <button
            type="button"
            onClick={() => onCitationClick && onCitationClick(sourceEvidence.source_page, sourceEvidence.source_text || value)}
            className="text-[10px] text-indigo-300 bg-indigo-950 hover:bg-indigo-700 hover:text-white px-1.5 py-0.5 rounded font-semibold cursor-pointer transition border border-indigo-800/40"
          >
            p.{sourceEvidence.source_page} ↗
          </button>
        )}
      </div>
    </div>
  );
}

export default function KpiStrip({ summary, onCitationClick }) {
  if (!summary) return null;

  const { metadata = {}, kpi_keys = [], doc_type_display } = summary;

  const kpiFields = kpi_keys
    .map((key) => ({ key, ...metadata[key] }))
    .filter(Boolean);

  if (kpiFields.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Category / Document badge */}
      <div className="flex items-center space-x-2">
        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
          Document Type:
        </span>
        <span className="text-xs py-0.5 px-2 bg-indigo-950 text-indigo-300 rounded border border-indigo-800/50 font-medium">
          {doc_type_display || 'Document'}
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpiFields.map(({ key, label, value, type, null_label, source_page, source_text }) => (
          <KpiCard
            key={key}
            label={label}
            value={value}
            type={type}
            nullLabel={null_label}
            sourceEvidence={source_page ? { source_page, source_text } : null}
            onCitationClick={onCitationClick}
          />
        ))}
      </div>
    </div>
  );
}
