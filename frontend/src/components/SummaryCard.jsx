import KpiStrip from './KpiStrip';

export default function SummaryCard({ summary }) {
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
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
      {/* 1. Top KPI Metrics */}
      <KpiStrip summary={summary} />

      {/* 2. Executive Overview Callout */}
      {overview ? (
        <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-slate-50 border border-blue-100 rounded-2xl p-5 space-y-2">
          <div className="flex items-center space-x-2 text-blue-900 font-extrabold text-xs uppercase tracking-wider">
            <span>✨</span>
            <span>Executive Overview</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-normal">
            {overview}
          </p>
        </div>
      ) : null}

      {/* 3. Non-KPI Metadata Properties Grid */}
      {detailFields.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
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
                      ? 'bg-slate-50/50 border-dashed border-slate-200'
                      : 'bg-slate-50/80 border-slate-200/80 hover:bg-white hover:border-blue-200 shadow-2xs'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    {field.label}
                  </span>

                  {isNull ? (
                    <span className="text-slate-400 italic text-[11px]">
                      {field.null_label || 'Not found in document'}
                    </span>
                  ) : (
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="font-bold text-slate-900 truncate" title={field.value}>
                        {field.value}
                      </span>
                      {field.source_page && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold flex-shrink-0"
                          title={field.source_text || `Found on page ${field.source_page}`}
                        >
                          p.{field.source_page}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Key Takeaways Checklist */}
      {key_points && key_points.length > 0 && (
        <div className="space-y-3 pt-1 border-t border-slate-100">
          <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
            Key Verified Highlights
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {key_points.map((point, idx) => (
              <div
                key={idx}
                className="flex items-start space-x-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed"
              >
                <span className="text-emerald-600 font-black text-sm flex-shrink-0">✓</span>
                <span className="font-medium">{point}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
