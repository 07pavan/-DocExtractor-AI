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

  return (
    <div className={`rounded-card transition-all ${
      depth > 0 
        ? 'mt-3 ml-4 pl-4 border-l border-mist' 
        : 'mt-4 card-specify overflow-hidden'
    }`}>
      {/* Clickable Section Header */}
      <div
        onClick={toggleExpand}
        className={`flex items-center justify-between p-2 select-none transition ${
          hasContent ? 'cursor-pointer hover:bg-cloud/70 rounded-control' : ''
        }`}
      >
        <div className="flex items-center space-x-3 min-w-0 pr-2">
          {/* Chevron */}
          {hasContent ? (
            <div className={`w-6 h-6 rounded-control flex items-center justify-center transition-transform duration-200 ${
              expanded ? 'rotate-90 text-iris bg-lilac-wash' : 'text-graphite'
            }`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          ) : (
            <div className="w-6 h-6" />
          )}

          {/* Heading Level Tag */}
          <span className="pill-badge !text-[11px] !py-0.5 !px-2 !bg-studio-slate !text-pure-white !border-studio-slate">
            H{level}
          </span>

          {/* Section Heading Title */}
          <h3 className={`font-bold truncate text-studio-slate ${
            level === 1 ? 'text-base sm:text-lg' : 
            level === 2 ? 'text-sm sm:text-base' : 
            'text-xs sm:text-sm'
          }`}>
            {section.heading || 'Untitled Section'}
          </h3>
        </div>

        {/* Page Tag */}
        {section.page && (
          <span className="pill-badge !text-[11px] !py-0.5 !px-2.5 !bg-cloud !text-iron">
            Page {section.page}
          </span>
        )}
      </div>

      {/* Expanded Section Body */}
      {expanded && (
        <div className="px-3 pb-3 pt-3 space-y-4">
          {/* Body Text */}
          {section.text && section.text.trim().length > 0 && (
            <div className="p-4 bg-cloud rounded-card text-xs sm:text-sm text-studio-slate leading-relaxed whitespace-pre-line border border-mist">
              {section.text}
            </div>
          )}

          {/* Structured Key-Value Fields */}
          {section.fields && section.fields.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-graphite block">
                Extracted Fields ({section.fields.length})
              </span>
              <FieldTable fields={section.fields} />
            </div>
          )}

          {/* Tables & Schedules */}
          {section.tables && section.tables.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-graphite block">
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
