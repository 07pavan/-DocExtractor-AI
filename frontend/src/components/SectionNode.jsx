import { useState, useEffect } from 'react';
import FieldTable from './FieldTable';
import TableView from './TableView';

export function sectionMatchesSearch(section, query) {
  if (!query) return true;
  const q = query.toLowerCase();

  if (section.heading && section.heading.toLowerCase().includes(q)) return true;
  if (section.text && section.text.toLowerCase().includes(q)) return true;
  if (section.fields && section.fields.some((f) => 
    (f.label && f.label.toLowerCase().includes(q)) || 
    (f.value && f.value.toLowerCase().includes(q))
  )) {
    return true;
  }
  if (section.subsections && section.subsections.some((sub) => sectionMatchesSearch(sub, query))) {
    return true;
  }
  return false;
}

export default function SectionNode({ section, searchQuery = '', depth = 0 }) {
  const level = section.level || 1;
  const isTopLevel = level <= 1 || depth === 0;

  const [expanded, setExpanded] = useState(isTopLevel);

  useEffect(() => {
    if (searchQuery.trim()) {
      if (sectionMatchesSearch(section, searchQuery.trim())) {
        setExpanded(true);
      }
    } else {
      setExpanded(isTopLevel);
    }
  }, [searchQuery, isTopLevel]);

  if (!section) return null;

  if (searchQuery.trim() && !sectionMatchesSearch(section, searchQuery.trim())) {
    return null;
  }

  const hasContent = 
    (section.fields && section.fields.length > 0) || 
    (section.tables && section.tables.length > 0) ||
    (section.text && section.text.trim().length > 0) || 
    (section.subsections && section.subsections.length > 0);

  const toggleExpand = () => {
    if (hasContent) {
      setExpanded((prev) => !prev);
    }
  };

  const levelBadges = {
    1: 'bg-blue-600 text-white shadow-2xs',
    2: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    3: 'bg-slate-100 text-slate-700 border border-slate-200',
  };

  return (
    <div className={`rounded-2xl transition-all ${
      depth > 0 
        ? 'mt-3 ml-4 pl-4 border-l-2 border-indigo-200' 
        : 'mt-4 border border-slate-200/90 bg-white shadow-sm overflow-hidden'
    }`}>
      {/* Clickable Section Header */}
      <div
        onClick={toggleExpand}
        className={`flex items-center justify-between p-4 select-none transition ${
          hasContent ? 'cursor-pointer hover:bg-slate-50/90' : ''
        }`}
      >
        <div className="flex items-center space-x-3 min-w-0 pr-2">
          {/* Chevron */}
          {hasContent ? (
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-transform duration-200 ${
              expanded ? 'rotate-90 bg-blue-50 text-blue-600' : 'text-slate-400'
            }`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          ) : (
            <div className="w-6 h-6" />
          )}

          {/* Heading Level Tag */}
          <span className={`px-2 py-0.5 text-[11px] font-black rounded-md flex-shrink-0 ${
            levelBadges[level] || 'bg-slate-100 text-slate-700'
          }`}>
            H{level}
          </span>

          {/* Section Heading Title */}
          <h3 className={`font-black truncate ${
            level === 1 ? 'text-base sm:text-lg text-slate-900' : 
            level === 2 ? 'text-sm sm:text-base text-slate-800' : 
            'text-xs sm:text-sm font-bold text-slate-700'
          }`}>
            {section.heading || 'Untitled Section'}
          </h3>
        </div>

        {/* Page Tag */}
        {section.page && (
          <span className="text-[11px] px-2.5 py-1 font-bold bg-slate-100 text-slate-600 rounded-lg flex-shrink-0">
            Page {section.page}
          </span>
        )}
      </div>

      {/* Expanded Section Body */}
      {expanded && (
        <div className="px-5 pb-5 pt-1 space-y-4">
          {/* Body Text */}
          {section.text && section.text.trim().length > 0 && (
            <div className="p-4 bg-slate-50/80 rounded-xl text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line border border-slate-200/60">
              {section.text}
            </div>
          )}

          {/* Structured Key-Value Fields */}
          {section.fields && section.fields.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                Extracted Fields ({section.fields.length})
              </span>
              <FieldTable fields={section.fields} />
            </div>
          )}

          {/* Tables & Schedules */}
          {section.tables && section.tables.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
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
