/**
 * FieldTable / PropertyGrid — Clean Key-Value Card Representation (Non-Table Layout)
 * Renders document properties as sleek, responsive metadata cards with 1-click copy.
 */

import { useState } from 'react';

export default function FieldTable({ fields }) {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);

  if (!fields || fields.length === 0) return null;

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleCopyAll = () => {
    const textData = fields
      .map((f) => `${f.label}: ${f.value !== null && f.value !== undefined ? f.value : '—'}`)
      .join('\n');
    navigator.clipboard.writeText(textData);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="space-y-2.5 my-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <span>🏷️</span>
          <span>Properties & Fields ({fields.length})</span>
        </span>
        <button
          type="button"
          onClick={handleCopyAll}
          className="text-xs py-1 px-2.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 transition flex items-center gap-1"
          title="Copy all field key-values"
        >
          {copiedAll ? '✓ Copied All' : '📋 Copy All'}
        </button>
      </div>

      {/* Modern Responsive Key-Value Cards Grid (NOT an HTML table) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {fields.map((f, idx) => {
          const valStr = f.value !== null && f.value !== undefined ? String(f.value).trim() : '';
          const isCurrency = valStr.startsWith('$') || (/^\d+(\.\d+)?$/.test(valStr) && f.label.toLowerCase().includes('amount'));

          return (
            <div
              key={idx}
              className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700 transition flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between gap-1 text-[11px] font-medium text-zinc-400">
                <span className="truncate" title={f.label}>{f.label}</span>
                {valStr && (
                  <button
                    type="button"
                    onClick={() => handleCopy(valStr, idx)}
                    className={`text-[10px] px-1.5 py-0.5 rounded transition cursor-pointer flex-shrink-0 ${
                      copiedIndex === idx
                        ? 'bg-emerald-950 text-emerald-400 font-bold border border-emerald-800'
                        : 'text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-indigo-400 hover:bg-zinc-800'
                    }`}
                    title="Copy value"
                  >
                    {copiedIndex === idx ? '✓' : '📋'}
                  </button>
                )}
              </div>

              <div
                onClick={() => valStr && handleCopy(valStr, idx)}
                className={`mt-1.5 text-xs font-semibold leading-relaxed break-words ${
                  valStr
                    ? isCurrency
                      ? 'text-emerald-400 font-mono font-bold cursor-pointer'
                      : 'text-zinc-100 cursor-pointer hover:text-indigo-300'
                    : 'text-zinc-600 font-sans italic'
                }`}
                title={valStr ? 'Click to copy' : ''}
              >
                {valStr || '—'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
