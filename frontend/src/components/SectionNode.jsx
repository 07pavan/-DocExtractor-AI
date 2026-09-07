import { useState, useEffect } from 'react';
import FieldTable from './FieldTable';
import TableView from './TableView';

export function sectionMatchesSearch(section, query) {
  if (!query) return true;
  const q = query.toLowerCase();

  const title = section.title || section.heading || '';
  if (title.toLowerCase().includes(q)) return true;
  if (section.text && section.text.toLowerCase().includes(q)) return true;

  if (section.fields) {
    if (Array.isArray(section.fields)) {
      if (section.fields.some((f) => 
        (f.label && f.label.toLowerCase().includes(q)) || 
        (f.value && f.value.toLowerCase().includes(q))
      )) return true;
    } else if (typeof section.fields === 'object') {
      if (Object.entries(section.fields).some(([k, v]) => 
        k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q)
      )) return true;
    }
  }

  if (section.subsections && section.subsections.some((sub) => sectionMatchesSearch(sub, query))) {
    return true;
  }
  return false;
}

export default function SectionNode({ section, searchQuery = '', forceExpanded = null, depth = 0 }) {
  const level = section.level || 1;
  const isTopLevel = level <= 1 || depth === 0;

  const [expanded, setExpanded] = useState(isTopLevel);

  useEffect(() => {
    if (forceExpanded !== null) {
      setExpanded(forceExpanded);
    } else if (searchQuery.trim()) {
      if (sectionMatchesSearch(section, searchQuery.trim())) {
        setExpanded(true);
      }
    }
  }, [forceExpanded, searchQuery]);

  if (!section) return null;

  if (searchQuery.trim() && !sectionMatchesSearch(section, searchQuery.trim())) {
    return null;
  }

  const title = section.title || section.heading || 'Untitled Section';
  const confidence = section.confidence !== undefined ? section.confidence : null;
  const sectionType = section.section_type || null;

  // Normalize fields into array of { label, value }
  const normalizedFields = Array.isArray(section.fields)
    ? section.fields
    : typeof section.fields === 'object' && section.fields !== null
    ? Object.entries(section.fields).map(([label, value]) => ({ label, value: String(value ?? '') }))
    : [];

  const hasContent = 
    normalizedFields.length > 0 || 
    (section.tables && section.tables.length > 0) ||
    (section.text && section.text.trim().length > 0) || 
    (section.subsections && section.subsections.length > 0);

  const toggleExpand = () => {
    if (hasContent) {
      setExpanded((prev) => !prev);
    }
  };

  return (
    <div className={`rounded-xl transition-all ${
      depth > 0 
        ? 'mt-3 ml-3 sm:ml-5 pl-3 sm:pl-4 border-l border-zinc-800 bg-zinc-950/40' 
        : 'mt-3 bg-zinc-900 border border-zinc-800 overflow-hidden shadow-md'
    }`}>
      {/* Clickable Section Header */}
      <div
        onClick={toggleExpand}
        className={`flex items-center justify-between p-3 select-none transition ${
          hasContent ? 'cursor-pointer hover:bg-zinc-800/60' : ''
        }`}
      >
        <div className="flex items-center space-x-2.5 min-w-0 pr-2 flex-wrap">
          {/* Chevron */}
          {hasContent ? (
            <div className={`w-5 h-5 rounded flex items-center justify-center transition-transform duration-200 ${
              expanded ? 'rotate-90 text-indigo-400 bg-indigo-950/60' : 'text-zinc-500'
            }`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          ) : (
            <div className="w-5 h-5" />
          )}

          {/* Section Type Tag */}
          {sectionType && (
            <span className="text-[10px] py-0.5 px-2 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded uppercase font-bold tracking-wider">
              {sectionType}
            </span>
          )}

          {/* Section Heading Title */}
          <h3 className={`font-bold truncate text-zinc-100 ${
            level === 1 ? 'text-sm sm:text-base' : 
            level === 2 ? 'text-xs sm:text-sm' : 
            'text-xs'
          }`}>
            {title}
          </h3>

          {/* Field Count Badge */}
          {normalizedFields.length > 0 && (
            <span className="text-[10px] py-0.5 px-1.5 bg-zinc-800 text-zinc-400 rounded">
              {normalizedFields.length} field{normalizedFields.length !== 1 ? 's' : ''}
            </span>
          )}

          {/* Table Count Badge */}
          {section.tables && section.tables.length > 0 && (
            <span className="text-[10px] py-0.5 px-1.5 bg-indigo-950 text-indigo-300 border border-indigo-800/40 rounded">
              {section.tables.length} table{section.tables.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Page Tag */}
        {section.page && (
          <span className="text-[11px] py-0.5 px-2 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded font-mono flex-shrink-0">
            Page {section.page}
          </span>
        )}
      </div>

      {/* Expanded Section Body */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-zinc-800/50">
          {/* Body Text */}
          {section.text && section.text.trim().length > 0 && (
            <div className="p-3 bg-zinc-950 rounded-lg text-xs sm:text-sm text-zinc-300 leading-relaxed whitespace-pre-line border border-zinc-800/80 font-sans">
              {section.text}
            </div>
          )}

          {/* Structured Key-Value Fields */}
          {normalizedFields.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block">
                Extracted Fields ({normalizedFields.length})
              </span>
              <FieldTable fields={normalizedFields} />
            </div>
          )}

          {/* Tables & Schedules */}
          {section.tables && section.tables.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block">
                Extracted Tables ({section.tables.length})
              </span>
              <TableView tables={section.tables} />
            </div>
          )}

          {/* Recursive Subsections */}
          {section.subsections && section.subsections.length > 0 && (
            <div className="space-y-1 pt-2">
              {section.subsections.map((sub, idx) => (
                <SectionNode
                  key={idx}
                  section={sub}
                  searchQuery={searchQuery}
                  forceExpanded={forceExpanded}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
