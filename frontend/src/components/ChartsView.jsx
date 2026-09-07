/**
 * ChartsView — Interactive Analytics and Visualizations using Recharts
 * Auto-detects financial numbers, fee distributions, premium metrics, and table aggregations.
 */

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#14b8a6', '#f97316'];

function extractNumericValue(str) {
  if (!str) return null;
  const s = String(str).trim();
  // Strip currency symbols, commas, percent
  const match = s.match(/[\$€£]?\s*([\d,]+(\.\d+)?)/);
  if (match) {
    const num = parseFloat(match[1].replace(/,/g, ''));
    return isNaN(num) ? null : num;
  }
  return null;
}

export default function ChartsView({ extractionData }) {
  // 1. Gather all fields across all sections and root
  const allFields = useMemo(() => {
    const fields = [];
    if (!extractionData) return fields;

    // From root fields
    if (Array.isArray(extractionData.fields)) {
      fields.push(...extractionData.fields);
    } else if (extractionData.fields && typeof extractionData.fields === 'object') {
      Object.entries(extractionData.fields).forEach(([label, value]) => {
        fields.push({ label, value });
      });
    }

    // Traverse sections/subsections
    const traverse = (node) => {
      if (!node) return;
      if (Array.isArray(node.fields)) {
        fields.push(...node.fields);
      } else if (node.fields && typeof node.fields === 'object') {
        Object.entries(node.fields).forEach(([label, value]) => {
          fields.push({ label, value });
        });
      }
      const children = node.sections || node.subsections || [];
      children.forEach(traverse);
    };

    const sections = extractionData.sections || extractionData.subsections || [];
    sections.forEach(traverse);

    return fields;
  }, [extractionData]);

  // 2. Filter numerical / financial metric fields
  const financialMetrics = useMemo(() => {
    const list = [];
    const seen = new Set();

    allFields.forEach(({ label, value }) => {
      if (!label || !value || seen.has(label.toLowerCase())) return;
      const num = extractNumericValue(value);
      if (num !== null && num > 0) {
        seen.add(label.toLowerCase());
        list.push({
          name: label.length > 25 ? label.substring(0, 22) + '...' : label,
          fullName: label,
          value: num,
          displayValue: String(value),
        });
      }
    });

    return list.slice(0, 10); // Top 10 metrics
  }, [allFields]);

  // 3. Extract table-based series if tables exist
  const tableMetrics = useMemo(() => {
    if (!extractionData) return [];
    const tables = [];

    const traverse = (node) => {
      if (!node) return;
      if (Array.isArray(node.tables)) {
        tables.push(...node.tables);
      }
      const children = node.sections || node.subsections || [];
      children.forEach(traverse);
    };

    if (Array.isArray(extractionData.tables)) tables.push(...extractionData.tables);
    const sections = extractionData.sections || extractionData.subsections || [];
    sections.forEach(traverse);

    // Look for first table with numerical column
    for (const tab of tables) {
      const headers = tab.headers || [];
      const rows = tab.rows || [];
      if (rows.length < 2) continue;

      // Find column indices that are numeric
      const colValues = [];
      headers.forEach((h, colIdx) => {
        const nums = rows.map((r) => extractNumericValue(Array.isArray(r) ? r[colIdx] : null)).filter((n) => n !== null);
        if (nums.length >= Math.min(rows.length * 0.6, 2)) {
          colValues.push({ colIdx, header: h });
        }
      });

      if (colValues.length > 0) {
        const labelColIdx = 0; // First column as label
        const targetCol = colValues[0];
        const data = rows
          .map((r) => {
            const rowArr = Array.isArray(r) ? r : [r];
            const name = String(rowArr[labelColIdx] || `Row`).trim();
            const val = extractNumericValue(rowArr[targetCol.colIdx]);
            return val !== null ? { name: name.length > 18 ? name.substring(0, 15) + '...' : name, value: val } : null;
          })
          .filter(Boolean);

        if (data.length >= 2) {
          return {
            title: tab.title || 'Table Breakdown',
            metricName: targetCol.header || 'Value',
            data: data.slice(0, 12),
          };
        }
      }
    }

    return null;
  }, [extractionData]);

  // 4. Section distribution breakdown by page
  const sectionDistribution = useMemo(() => {
    const pageCounts = {};
    const traverse = (node) => {
      if (!node) return;
      const p = node.page || 1;
      pageCounts[p] = (pageCounts[p] || 0) + 1;
      const children = node.sections || node.subsections || [];
      children.forEach(traverse);
    };

    const sections = extractionData?.sections || extractionData?.subsections || [];
    sections.forEach(traverse);

    return Object.entries(pageCounts).map(([page, count]) => ({
      page: `Page ${page}`,
      sections: count,
    }));
  }, [extractionData]);

  if (!extractionData) return null;

  return (
    <div className="space-y-6">
      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Total Fields Extracted</p>
            <p className="text-2xl font-bold text-zinc-100 mt-1">{allFields.length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-950/60 border border-indigo-800/50 flex items-center justify-center text-indigo-400 font-bold text-lg">
            📋
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Numerical Values Detected</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{financialMetrics.length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400 font-bold text-lg">
            💰
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Document Sections</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">
              {(extractionData.sections || extractionData.subsections || []).length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400 font-bold text-lg">
            📑
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Financial & Premium Metrics Bar Chart */}
        {financialMetrics.length > 0 && (
          <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-md">
            <h3 className="text-sm font-semibold text-zinc-200 mb-1 flex items-center gap-2">
              <span>📊</span> Financial & Rate Breakdown
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Detected numerical field values and financial amounts across the document
            </p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialMetrics} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={11} angle={-25} textAnchor="end" />
                  <YAxis stroke="#71717a" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '8px', color: '#f4f4f5' }}
                    formatter={(val, name, item) => [`${val.toLocaleString()}`, item.payload.fullName]}
                  />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]}>
                    {financialMetrics.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Chart 2: Table Breakdown Chart or Donut Distribution */}
        {tableMetrics ? (
          <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-md">
            <h3 className="text-sm font-semibold text-zinc-200 mb-1 flex items-center gap-2">
              <span>📈</span> {tableMetrics.title} ({tableMetrics.metricName})
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Extracted schedule metrics and series distribution
            </p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tableMetrics.data} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={11} angle={-20} textAnchor="end" />
                  <YAxis stroke="#71717a" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '8px', color: '#f4f4f5' }}
                  />
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : financialMetrics.length >= 3 ? (
          <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-md">
            <h3 className="text-sm font-semibold text-zinc-200 mb-1 flex items-center gap-2">
              <span>🍩</span> Financial Metrics Share
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Relative proportion of extracted quantitative values
            </p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={financialMetrics}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={45}
                    paddingAngle={3}
                  >
                    {financialMetrics.map((entry, index) => (
                      <Cell key={`pie-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '8px', color: '#f4f4f5' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        {/* Chart 3: Section Distribution by Page */}
        {sectionDistribution.length > 1 && (
          <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-md lg:col-span-2">
            <h3 className="text-sm font-semibold text-zinc-200 mb-1 flex items-center gap-2">
              <span>📑</span> Section Density by Page
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Distribution of document headings and sections across pages
            </p>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectionDistribution} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="page" stroke="#71717a" fontSize={11} />
                  <YAxis stroke="#71717a" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '8px', color: '#f4f4f5' }}
                  />
                  <Bar dataKey="sections" name="Sections Found" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
