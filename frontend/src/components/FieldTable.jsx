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
    <div className="overflow-x-auto my-2 border border-zinc-800 rounded-xl bg-zinc-950 shadow-md">
      <div className="bg-zinc-900 px-3.5 py-2 border-b border-zinc-800 flex items-center justify-between">
        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
          Extracted Properties ({fields.length})
        </span>
        <button
          type="button"
          onClick={handleCopyAll}
          className="text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition"
          title="Copy all field key-values"
        >
          {copiedAll ? '✓ Copied All' : '📋 Copy All'}
        </button>
      </div>

      <table className="w-full text-left text-xs sm:text-sm">
        <thead className="bg-zinc-900/60 border-b border-zinc-800 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
          <tr>
            <th className="py-2.5 px-3.5 w-1/3">Field Name</th>
            <th className="py-2.5 px-3.5 w-2/3">Value</th>
            <th className="py-2.5 px-2 w-14 text-center">Copy</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60 font-mono text-xs">
          {fields.map((f, idx) => {
            const valStr = f.value !== null && f.value !== undefined ? String(f.value) : '';
            return (
              <tr key={idx} className="hover:bg-zinc-900/50 transition">
                <td className="py-2.5 px-3.5 font-semibold text-zinc-200 bg-zinc-900/30 align-top">
                  {f.label}
                </td>
                <td
                  onClick={() => valStr && handleCopy(valStr, idx)}
                  className={`py-2.5 px-3.5 break-words align-top leading-relaxed ${
                    valStr ? 'cursor-pointer text-zinc-300 hover:text-indigo-400' : 'text-zinc-600'
                  }`}
                  title={valStr ? 'Click to copy value' : ''}
                >
                  {valStr || <span className="text-zinc-600 font-sans italic">—</span>}
                </td>
                <td className="py-2.5 px-2 text-center align-top font-sans">
                  {valStr && (
                    <button
                      type="button"
                      onClick={() => handleCopy(valStr, idx)}
                      className={`text-xs px-2 py-1 rounded transition cursor-pointer ${
                        copiedIndex === idx
                          ? 'bg-emerald-950 text-emerald-400 font-bold border border-emerald-800'
                          : 'text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800'
                      }`}
                      title="Copy field value"
                    >
                      {copiedIndex === idx ? '✓' : '📋'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
