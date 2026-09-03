import { useState } from 'react';

export default function FieldTable({ fields }) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  if (!fields || fields.length === 0) return null;

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <div className="overflow-x-auto my-3 border border-gray-200 rounded-xl bg-white shadow-2xs">
      <table className="w-full text-left text-xs sm:text-sm">
        <thead className="bg-slate-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
          <tr>
            <th className="py-2.5 px-3.5 w-1/3">Extracted Field</th>
            <th className="py-2.5 px-3.5 w-2/3">Value</th>
            <th className="py-2.5 px-2 w-12 text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {fields.map((f, idx) => {
            const valStr = f.value !== null && f.value !== undefined ? String(f.value) : '';
            return (
              <tr key={idx} className="hover:bg-blue-50/30 transition group">
                <td className="py-2.5 px-3.5 font-semibold text-gray-700 bg-slate-50/40 align-top">
                  {f.label}
                </td>
                <td className="py-2.5 px-3.5 text-gray-900 break-words align-top leading-relaxed font-mono text-xs">
                  {valStr || <span className="text-gray-300 font-sans italic">—</span>}
                </td>
                <td className="py-2.5 px-2 text-center align-top">
                  {valStr && (
                    <button
                      type="button"
                      onClick={() => handleCopy(valStr, idx)}
                      className="text-[11px] text-gray-400 hover:text-blue-600 px-1.5 py-0.5 rounded hover:bg-blue-50 transition opacity-80 group-hover:opacity-100"
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
