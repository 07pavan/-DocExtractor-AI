/**
 * SummaryCard — Grounded Executive Overview Card
 *
 * Renders the document summary with:
 *   - Document type badge and classification confidence
 *   - KPI strip (currency / date / status / count / text auto-rendering)
 *   - Overview narrative (factual only — no hallucinated content)
 *   - Key bullet takeaways
 *   - All metadata fields shown with source page citation badges
 *   - "⚠ Not found in document" shown for every null field
 *     (never a fabricated value)
 */

import KpiStrip from './KpiStrip';

export default function SummaryCard({ summary }) {
  if (!summary) return null;

  const {
    overview,
    key_points = [],
    metadata = {},
    doc_type = 'GENERIC',
    doc_type_display = 'Document',
    kpi_keys = [],
    classification_confidence = 0,
  } = summary;

  // Collect all non-KPI metadata fields for the detail grid
  const detailFields = Object.entries(metadata).filter(
    ([key]) => !kpi_keys.includes(key)
  );

  return (
    <div className="bg-white border border-blue-200 rounded-xl p-5 shadow-sm space-y-4">

      {/* KPI Strip — dynamic type-aware metric cards */}
      <KpiStrip summary={summary} />

      {/* Divider */}
      {(overview || detailFields.length > 0) && (
        <div className="border-t border-gray-100" />
      )}

      {/* Non-KPI Metadata Detail Grid */}
      {detailFields.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {detailFields.map(([key, field]) => {
            const isNull = field.value === null || field.value === undefined || field.value === '';
            return (
              <div
                key={key}
                className={`p-2.5 rounded-lg border text-xs ${
                  isNull
                    ? 'bg-gray-50 border-dashed border-gray-200'
                    : 'bg-slate-50 border-slate-100'
                }`}
              >
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  {field.label}
                </span>

                {isNull ? (
                  <span className="text-gray-400 italic flex items-center space-x-1">
                    <span>⚠</span>
                    <span>{field.null_label || 'Not found in document'}</span>
                  </span>
                ) : (
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="font-semibold text-slate-800 truncate" title={field.value}>
                      {field.value}
                    </span>
                    {/* Source page citation badge */}
                    {field.source_page && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded font-mono cursor-default flex-shrink-0"
                        title={field.source_text || `Found on page ${field.source_page}`}
                      >
                        📍 p.{field.source_page}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Overview Narrative — factual only */}
      {overview ? (
        <div className="bg-blue-50/60 p-3.5 rounded-lg border border-blue-100 text-xs sm:text-sm text-gray-800 leading-relaxed">
          <span className="font-bold text-blue-900 block mb-1">Executive Summary</span>
          {overview}
        </div>
      ) : (
        <div className="bg-gray-50 p-3 rounded-lg border border-dashed border-gray-200 text-xs text-gray-400 italic text-center">
          ⚠ No executive summary could be generated from the available document text.
        </div>
      )}

      {/* Key Bullet Takeaways */}
      {key_points && key_points.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Key Highlights
          </h4>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {key_points.map((point, idx) => (
              <li
                key={idx}
                className="flex items-start text-xs text-gray-700 space-x-2 bg-gray-50 p-2 rounded border border-gray-100"
              >
                <span className="text-blue-600 font-bold mt-0.5 flex-shrink-0">✓</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
