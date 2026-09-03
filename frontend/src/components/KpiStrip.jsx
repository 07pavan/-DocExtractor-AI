import React from 'react';

/**
 * KpiStrip — Dynamic Executive Metric Cards
 * Automatically adapts styling based on value type with high readability.
 */

const STATUS_COLORS = {
  approved: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/30',
  filed: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/30',
  'received and filed': 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/30',
  active: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/30',
  satisfied: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/30',
  pending: 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-400/30',
  review: 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-400/30',
  'under review': 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-400/30',
  submitted: 'bg-blue-50 text-blue-800 border-blue-300 ring-1 ring-blue-400/30',
  rejected: 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-400/30',
  denied: 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-400/30',
  withdrawn: 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-400/30',
};

function getStatusColor(value) {
  if (!value) return 'bg-slate-50 text-slate-700 border-slate-200';
  const lower = value.toLowerCase().trim();
  for (const [key, cls] of Object.entries(STATUS_COLORS)) {
    if (lower.includes(key)) return cls;
  }
  return 'bg-blue-50 text-blue-800 border-blue-200';
}

function KpiCard({ label, value, type, nullLabel, sourceEvidence }) {
  const isNull = value === null || value === undefined || value === '';

  if (isNull) {
    return (
      <div className="flex flex-col justify-between p-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 min-w-[170px] flex-1">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          {label}
        </span>
        <span className="text-xs text-slate-400 italic flex items-center space-x-1.5 mt-2">
          <span>ℹ️</span>
          <span>{nullLabel || 'Not found in document'}</span>
        </span>
      </div>
    );
  }

  // Currency rendering
  if (type === 'currency') {
    return (
      <div className="flex flex-col justify-between p-4 rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/70 to-emerald-50/20 shadow-2xs min-w-[170px] flex-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
            {label}
          </span>
          <span className="text-sm">💰</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
          <span className="text-lg font-black text-emerald-950 font-mono">{value}</span>
          {sourceEvidence?.source_page && (
            <span
              className="text-[10px] text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-md font-semibold cursor-default"
              title={sourceEvidence.source_text || `Found on page ${sourceEvidence.source_page}`}
            >
              p.{sourceEvidence.source_page}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Date rendering
  if (type === 'date') {
    return (
      <div className="flex flex-col justify-between p-4 rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50/70 to-blue-50/20 shadow-2xs min-w-[170px] flex-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
            {label}
          </span>
          <span className="text-sm">📅</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
          <span className="text-sm font-black text-blue-950 font-mono">{value}</span>
          {sourceEvidence?.source_page && (
            <span
              className="text-[10px] text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded-md font-semibold cursor-default"
              title={sourceEvidence.source_text || `Found on page ${sourceEvidence.source_page}`}
            >
              p.{sourceEvidence.source_page}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Status rendering
  if (type === 'status') {
    const colorClass = getStatusColor(value);
    return (
      <div className="flex flex-col justify-between p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs min-w-[170px] flex-1">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          {label}
        </span>
        <div className="mt-2">
          <span className={`text-xs font-black px-3 py-1 rounded-full border inline-block ${colorClass}`}>
            {value}
          </span>
        </div>
      </div>
    );
  }

  // Count rendering
  if (type === 'count') {
    return (
      <div className="flex flex-col justify-between p-4 rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50/70 to-indigo-50/20 shadow-2xs min-w-[170px] flex-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">
            {label}
          </span>
          <span className="text-sm">📊</span>
        </div>
        <div className="mt-2">
          <span className="text-xl font-black text-indigo-950">{value}</span>
        </div>
      </div>
    );
  }

  // Default text card
  return (
    <div className="flex flex-col justify-between p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs min-w-[170px] flex-1">
      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
        {label}
      </span>
      <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
        <span className="text-xs font-bold text-slate-900 truncate max-w-[180px]" title={value}>
          {value}
        </span>
        {sourceEvidence?.source_page && (
          <span
            className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md font-semibold cursor-default"
            title={sourceEvidence.source_text || `Found on page ${sourceEvidence.source_page}`}
          >
            p.{sourceEvidence.source_page}
          </span>
        )}
      </div>
    </div>
  );
}

export default function KpiStrip({ summary }) {
  if (!summary) return null;

  const { metadata = {}, kpi_keys = [], doc_type_display } = summary;

  const kpiFields = kpi_keys
    .map((key) => ({ key, ...metadata[key] }))
    .filter(Boolean);

  if (kpiFields.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Document Archetype Pill */}
      <div className="flex items-center space-x-2">
        <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
          Document Archetype
        </span>
        <span className="text-xs px-3 py-1 bg-slate-900 text-white rounded-full font-bold shadow-2xs flex items-center space-x-1.5">
          <span>📑</span>
          <span>{doc_type_display || 'Document'}</span>
        </span>
        {summary.classification_confidence > 0 && (
          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            {(summary.classification_confidence * 100).toFixed(0)}% Match
          </span>
        )}
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpiFields.map(({ key, label, value, type, null_label, source_page, source_text }) => (
          <KpiCard
            key={key}
            label={label}
            value={value}
            type={type}
            nullLabel={null_label}
            sourceEvidence={source_page ? { source_page, source_text } : null}
          />
        ))}
      </div>
    </div>
  );
}
