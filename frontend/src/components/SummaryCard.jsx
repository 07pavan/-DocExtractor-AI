import KpiStrip from './KpiStrip';

export default function SummaryCard({ summary, onCitationClick }) {
  if (!summary) return null;

  const {
    overview,
    key_points = [],
    metadata = {},
    kpi_keys = [],
  } = summary;

  const detailFields = Object.entries(metadata).filter(
    ([key]) => !kpi_keys.includes(key)
  );

  return (
    <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-md space-y-5">
      {/* 1. Top KPI Metrics */}
      <KpiStrip summary={summary} onCitationClick={onCitationClick} />

      {/* 2. Executive Overview Callout */}
      {overview ? (
        <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-xl p-4 space-y-1.5">
          <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
            <span>⬡</span>
            <span>Executive Overview</span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed">
            {overview}
          </p>
        </div>
      ) : null}

      {/* 3. Non-KPI Metadata Properties Grid */}
      {detailFields.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            Document Metadata & Parameters
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {detailFields.map(([key, field]) => {
              const isNull = field.value === null || field.value === undefined || field.value === '';
              return (
                <div
                  key={key}
                  className={`p-3 rounded-xl border text-xs transition ${
                    isNull
                      ? 'bg-zinc-950/40 border-dashed border-zinc-800'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
                    {field.label || key}
                  </span>

                  {isNull ? (
                    <span className="text-zinc-600 italic text-[11px]">
                      {field.null_label || 'Not found in document'}
                    </span>
                  ) : (
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="font-semibold text-zinc-200 truncate" title={field.value}>
                        {field.value}
                      </span>
                      {field.source_page && (
                        <button
                          type="button"
                          onClick={() => onCitationClick && onCitationClick(field.source_page, field.source_text || field.value)}
                          className="text-[9px] px-1.5 py-0.5 bg-indigo-950 hover:bg-indigo-600 hover:text-white text-indigo-300 rounded font-semibold flex-shrink-0 transition cursor-pointer border border-indigo-800/40"
                          title={field.source_text ? `Jump to Page ${field.source_page}: "${field.source_text}"` : `Jump to Page ${field.source_page}`}
                        >
                          p.{field.source_page} ↗
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Key Highlights */}
      {key_points && key_points.length > 0 && (
        <div className="space-y-3 pt-3 border-t border-zinc-800">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            Key Highlights
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {key_points.map((point, idx) => (
              <div
                key={idx}
                className="flex items-start space-x-2.5 bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-xs text-zinc-300 leading-relaxed"
              >
                <span className="text-indigo-400 font-bold text-sm flex-shrink-0">✓</span>
                <span className="font-medium">{point}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
