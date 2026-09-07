import { useState } from 'react';
import SectionNode from './SectionNode';

export default function SectionTree({ sections = [], searchQuery = '' }) {
  const [expandAllState, setExpandAllState] = useState(null); // true = all expanded, false = all collapsed, null = default

  if (!sections || sections.length === 0) {
    return (
      <div className="p-8 text-center bg-zinc-900 border border-zinc-800 rounded-xl">
        <p className="text-zinc-500 text-sm">
          No sections or headings were detected in this document.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick Controls Bar */}
      <div className="flex items-center justify-between pb-1 text-xs">
        <span className="text-zinc-400">
          Showing {sections.length} top-level document section{sections.length !== 1 ? 's' : ''}
        </span>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setExpandAllState(true)}
            className="text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={() => setExpandAllState(false)}
            className="text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Sections List */}
      <div className="space-y-3">
        {sections.map((section, idx) => (
          <SectionNode
            key={idx}
            section={section}
            searchQuery={searchQuery}
            forceExpanded={expandAllState}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
}
