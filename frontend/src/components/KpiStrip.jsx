import React from 'react';

/**
 * KpiStrip — Dynamic KPI Metric Cards
 *
 * Renders a horizontal strip of key performance indicator cards
 * whose appearance adapts based on the inferred value type:
 *
 *   currency  → green chip with $ icon
 *   date      → blue chip with calendar icon
 *   status    → colour-coded pill (green / amber / red) based on text
 *   count     → indigo chip with count badge
 *   text      → neutral grey chip
 *
 * Fields with null values are rendered as "⚠ Not Found" instead of
 * fabricated data, implementing the anti-hallucination contract.
 */

const STATUS_COLORS = {
  // Positive / approved states
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  filed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'received and filed': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  active: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  satisfied: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  // Pending / in-progress states
  pending: 'bg-amber-100 text-amber-800 border-amber-300',
  review: 'bg-amber-100 text-amber-800 border-amber-300',
  'under review': 'bg-amber-100 text-amber-800 border-amber-300',
  submitted: 'bg-blue-100 text-blue-800 border-blue-300',
  // Negative / rejected states
  rejected: 'bg-red-100 text-red-800 border-red-300',
  denied: 'bg-red-100 text-red-800 border-red-300',
  withdrawn: 'bg-red-100 text-red-800 border-red-300',
  lapsed: 'bg-red-100 text-red-800 border-red-300',
};

const TYPE_ICONS = {
  currency: '💰',
  date: '📅',
  status: '🔵',
  count: '🔢',
  text: '📋',
};

function getStatusColor(value) {
  if (!value) return 'bg-gray-100 text-gray-600 border-gray-300';
  const lower = value.toLowerCase().trim();
  for (const [key, cls] of Object.entries(STATUS_COLORS)) {
    if (lower.includes(key)) return cls;
  }
  return 'bg-blue-100 text-blue-800 border-blue-300';
}

function KpiCard({ label, value, type, nullLabel, sourceEvidence }) {
  const isNull = value === null || value === undefined || value === '';

  // Render null fields with clear "not found" indicator
  if (isNull) {
    return (
      <div className="flex flex-col p-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/60 min-w-[140px] flex-1">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
          {label}
        </span>
        <span className="text-xs text-gray-400 italic flex items-center space-x-1">
          <span>⚠</span>
          <span>{nullLabel || 'Not found in document'}</span>
        </span>
      </div>
    );
  }

  // Currency rendering
  if (type === 'currency') {
    return (
      <div className="flex flex-col p-3 rounded-xl border border-emerald-200 bg-emerald-50/60 min-w-[140px] flex-1">
        <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">
          {label}
        </span>
        <div className="flex items-center space-x-1">
          <span className="text-base font-black text-emerald-800">{value}</span>
          {sourceEvidence?.source_page && (
            <span className="text-[9px] text-emerald-600 bg-emerald-100 px-1 py-0.5 rounded ml-1">
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
      <div className="flex flex-col p-3 rounded-xl border border-blue-200 bg-blue-50/50 min-w-[140px] flex-1">
        <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider mb-1">
          {label}
        </span>
        <div className="flex items-center space-x-1">
          <span className="text-xs font-bold text-blue-800">📅 {value}</span>
          {sourceEvidence?.source_page && (
            <span className="text-[9px] text-blue-500 bg-blue-100 px-1 py-0.5 rounded">
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
      <div className="flex flex-col p-3 rounded-xl border border-gray-200 bg-white min-w-[140px] flex-1">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
          {label}
        </span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border self-start ${colorClass}`}>
          {value}
        </span>
      </div>
    );
  }

  // Count rendering
  if (type === 'count') {
    return (
      <div className="flex flex-col p-3 rounded-xl border border-indigo-200 bg-indigo-50/50 min-w-[140px] flex-1">
        <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider mb-1">
          {label}
        </span>
        <span className="text-lg font-black text-indigo-800">{value}</span>
      </div>
    );
  }

  // Default / text rendering
  return (
    <div className="flex flex-col p-3 rounded-xl border border-gray-200 bg-white min-w-[140px] flex-1">
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </span>
      <div className="flex items-center space-x-1 flex-wrap">
        <span className="text-xs font-semibold text-gray-800 truncate max-w-[160px]" title={value}>
          {value}
        </span>
        {sourceEvidence?.source_page && (
          <span className="text-[9px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded">
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

  // Filter to only fields marked as KPI and in the kpi_keys list
  const kpiFields = kpi_keys
    .map((key) => ({ key, ...metadata[key] }))
    .filter(Boolean);

  if (kpiFields.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Document Type Badge */}
      <div className="flex items-center space-x-2">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          Document Type
        </span>
        <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 rounded-full font-semibold">
          {doc_type_display || 'Document'}
        </span>
        {summary.classification_confidence > 0 && (
          <span className="text-[9px] text-gray-400">
            ({(summary.classification_confidence * 100).toFixed(0)}% confident)
          </span>
        )}
      </div>

      {/* KPI Cards Row */}
      <div className="flex flex-wrap gap-2">
        {kpiFields.map(({ key, label, value, type, null_label, kpi, source_page, source_text }) => (
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
