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
    <div className="card-specify space-y-6">
      {/* 1. Top KPI Metrics */}
      <KpiStrip summary={summary} />

      {/* 2. Executive Overview Callout */}
      {overview ? (
        <div className="bg-lilac-wash/70 border border-iris/20 rounded-card p-5 space-y-2">
          <div className="flex items-center space-x-2 text-iris font-bold text-xs uppercase tracking-wider">
            <span>⬡</span>
            <span>Executive Overview</span>
          </div>
          <p className="text-xs sm:text-sm text-studio-slate leading-relaxed font-normal">
            {overview}
          </p>
        </div>
      ) : null}

      {/* 3. Non-KPI Metadata Properties Grid */}
      {detailFields.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-graphite">
            Document Metadata & Parameters
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {detailFields.map(([key, field]) => {
              const isNull = field.value === null || field.value === undefined || field.value === '';
              return (
                <div
                  key={key}
                  className={`p-3 rounded-card border text-xs transition ${
                    isNull
                      ? 'bg-cloud/50 border-dashed border-mist'
                      : 'bg-pure-white border-mist hover:border-iris/40 shadow-subtle-2'
                  }`}
                >
                  <span className="text-[10px] uppercase font-semibold text-graphite block mb-1">
                    {field.label}
                  </span>

                  {isNull ? (
                    <span className="text-graphite italic text-[11px]">
                      {field.null_label || 'Not found in document'}
                    </span>
                  ) : (
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="font-semibold text-studio-slate truncate" title={field.value}>
                        {field.value}
                      </span>
                      {field.source_page && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 bg-lilac-wash text-iris rounded-control font-semibold flex-shrink-0"
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
        <div className="space-y-3 pt-4 border-t border-mist">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-graphite">
            Key Verified Highlights
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {key_points.map((point, idx) => (
              <div
                key={idx}
                className="flex items-start space-x-2.5 bg-cloud p-3 rounded-card border border-mist text-xs text-studio-slate leading-relaxed"
              >
                <span className="text-iris font-bold text-sm flex-shrink-0">✓</span>
                <span className="font-medium">{point}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
