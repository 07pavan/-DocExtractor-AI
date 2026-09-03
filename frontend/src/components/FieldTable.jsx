export default function FieldTable({ fields }) {
  if (!fields || fields.length === 0) return null;

  return (
    <div className="overflow-x-auto my-3 border border-gray-200 rounded-md bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <tr>
            <th className="py-2 px-3 w-1/3">Field</th>
            <th className="py-2 px-3 w-2/3">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {fields.map((f, idx) => (
            <tr key={idx} className="hover:bg-gray-50/70 transition">
              <td className="py-2 px-3 font-medium text-gray-600 bg-gray-50/30 align-top">
                {f.label}
              </td>
              <td className="py-2 px-3 text-gray-900 break-words align-top">
                {f.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
