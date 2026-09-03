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
    <div className="overflow-x-auto my-3 border border-mist rounded-card bg-pure-white shadow-subtle-2">
      <div className="bg-cloud px-3.5 py-2 border-b border-mist flex items-center justify-between">
        <span className="text-[11px] font-bold text-graphite uppercase tracking-wider">
          Properties & Extracted Values
        </span>
        <button
          type="button"
          onClick={handleCopyAll}
          className="btn-pill-ghost !text-[11px] !py-1 !px-2.5 hover:!border-iris hover:!text-iris"
          title="Copy all field key-values"
        >
          <span>{copiedAll ? '✓ Copied All' : '📋 Copy All Fields'}</span>
        </button>
      </div>

      <table className="w-full text-left text-xs sm:text-sm">
        <thead className="bg-cloud/60 border-b border-mist text-[11px] font-bold text-iron uppercase tracking-wider">
          <tr>
            <th className="py-2.5 px-3.5 w-1/3">Extracted Field</th>
            <th className="py-2.5 px-3.5 w-2/3">Value</th>
            <th className="py-2.5 px-2 w-14 text-center">Copy</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-mist">
          {fields.map((f, idx) => {
            const valStr = f.value !== null && f.value !== undefined ? String(f.value) : '';
            return (
              <tr key={idx} className="hover:bg-lilac-wash/30 transition group">
                <td className="py-2.5 px-3.5 font-semibold text-studio-slate bg-cloud/20 align-top">
                  {f.label}
                </td>
                <td
                  onClick={() => valStr && handleCopy(valStr, idx)}
                  className={`py-2.5 px-3.5 break-words align-top leading-relaxed font-mono text-xs ${
                    valStr ? 'cursor-pointer text-studio-slate hover:text-iris' : 'text-graphite'
                  }`}
                  title={valStr ? 'Click to copy value' : ''}
                >
                  {valStr || <span className="text-graphite font-sans italic">—</span>}
                </td>
                <td className="py-2.5 px-2 text-center align-top">
                  {valStr && (
                    <button
                      type="button"
                      onClick={() => handleCopy(valStr, idx)}
                      className={`text-xs px-2 py-1 rounded-control transition cursor-pointer ${
                        copiedIndex === idx
                          ? 'bg-mint-wash text-fern-pop font-bold'
                          : 'text-graphite hover:text-iris hover:bg-lilac-wash'
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
