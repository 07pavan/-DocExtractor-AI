import React from 'react';

/**
 * KpiStrip — Specify Metric Cards
 * Inter SemiBold, clean pill badges, and dual-layer subtle elevation.
 */

const STATUS_COLORS = {
  approved: 'bg-mint-wash text-fern-pop border-fern-pop/30',
  filed: 'bg-mint-wash text-fern-pop border-fern-pop/30',
  'received and filed': 'bg-mint-wash text-fern-pop border-fern-pop/30',
  active: 'bg-mint-wash text-fern-pop border-fern-pop/30',
  satisfied: 'bg-mint-wash text-fern-pop border-fern-pop/30',
  pending: 'bg-apricot-wash text-amber-800 border-amber-300',
  review: 'bg-apricot-wash text-amber-800 border-amber-300',
  'under review': 'bg-apricot-wash text-amber-800 border-amber-300',
  submitted: 'bg-lilac-wash text-iris border-iris/30',
  rejected: 'bg-rose-50 text-rose-800 border-rose-300',
  denied: 'bg-rose-50 text-rose-800 border-rose-300',
  withdrawn: 'bg-rose-50 text-rose-800 border-rose-300',
};

function getStatusColor(value) {
  if (!value) return 'bg-cloud text-iron border-mist';
  const lower = value.toLowerCase().trim();
  for (const [key, cls] of Object.entries(STATUS_COLORS)) {
    if (lower.includes(key)) return cls;
  }
  return 'bg-lilac-wash text-iris border-iris/20';
}

function KpiCard({ label, value, type, nullLabel, sourceEvidence }) {
  const isNull = value === null || value === undefined || value === '';

  if (isNull) {
    return (
      <div className="flex flex-col justify-between p-4 rounded-card border border-dashed border-mist bg-cloud/50 min-w-[170px] flex-1">
        <span className="text-[11px] font-semibold text-graphite uppercase tracking-wider">
          {label}
        </span>
        <span className="text-xs text-graphite italic flex items-center space-x-1.5 mt-2">
          <span>ℹ️</span>
          <span>{nullLabel || 'Not found in document'}</span>
        </span>
      </div>
    );
  }

  // Currency rendering
  if (type === 'currency') {
    return (
      <div className="flex flex-col justify-between p-4 rounded-card border border-mist bg-pure-white shadow-subtle-2 min-w-[170px] flex-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-iron uppercase tracking-wider">
            {label}
          </span>
          <span className="text-xs text-fern-pop font-bold">USD</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
          <span className="text-lg font-bold text-studio-slate font-mono">{value}</span>
          {sourceEvidence?.source_page && (
            <span
              className="text-[10px] text-iris bg-lilac-wash px-1.5 py-0.5 rounded-control font-semibold cursor-default"
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
      <div className="flex flex-col justify-between p-4 rounded-card border border-mist bg-pure-white shadow-subtle-2 min-w-[170px] flex-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-iron uppercase tracking-wider">
            {label}
          </span>
          <span className="text-xs text-cobalt-pop font-bold">Date</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
          <span className="text-sm font-bold text-studio-slate font-mono">{value}</span>
          {sourceEvidence?.source_page && (
            <span
              className="text-[10px] text-iris bg-lilac-wash px-1.5 py-0.5 rounded-control font-semibold cursor-default"
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
      <div className="flex flex-col justify-between p-4 rounded-card border border-mist bg-pure-white shadow-subtle-2 min-w-[170px] flex-1">
        <span className="text-[11px] font-semibold text-iron uppercase tracking-wider">
          {label}
        </span>
        <div className="mt-2">
          <span className={`text-xs font-bold px-3 py-1 rounded-pill border inline-block ${colorClass}`}>
            {value}
          </span>
        </div>
      </div>
    );
  }

  // Default text card
  return (
    <div className="flex flex-col justify-between p-4 rounded-card border border-mist bg-pure-white shadow-subtle-2 min-w-[170px] flex-1">
      <span className="text-[11px] font-semibold text-iron uppercase tracking-wider">
        {label}
      </span>
      <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
        <span className="text-xs font-bold text-studio-slate truncate max-w-[180px]" title={value}>
          {value}
        </span>
        {sourceEvidence?.source_page && (
          <span
            className="text-[10px] text-iron bg-cloud px-1.5 py-0.5 rounded-control font-semibold cursor-default"
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
    <div className="space-y-4">
      {/* Document Archetype Pill Badge */}
      <div className="flex items-center space-x-2.5">
        <span className="text-[11px] font-bold text-graphite uppercase tracking-widest">
          Document Archetype
        </span>
        <span className="pill-badge !bg-studio-slate !text-pure-white !border-studio-slate">
          <span className="text-iris">⬡</span>
          <span>{doc_type_display || 'Document'}</span>
        </span>
        {summary.classification_confidence > 0 && (
          <span className="pill-badge !bg-mint-wash !text-fern-pop !border-fern-pop/20 !text-[11px]">
            {(summary.classification_confidence * 100).toFixed(0)}% Match
          </span>
        )}
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
          />
        ))}
      </div>
    </div>
  );
}
