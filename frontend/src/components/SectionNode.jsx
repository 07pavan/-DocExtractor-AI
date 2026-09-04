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
        <div className="flex items-center space-x-2.5 min-w-0 pr-2 flex-wrap">
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

          {/* Section Type Tag */}
          {sectionType && (
            <span className="pill-badge !text-[10px] !py-0.5 !px-2 !bg-studio-slate !text-pure-white uppercase font-bold tracking-wider">
              {sectionType}
            </span>
          )}

          {/* Section Heading Title */}
          <h3 className={`font-bold truncate text-studio-slate ${
            level === 1 ? 'text-base sm:text-lg' : 
            level === 2 ? 'text-sm sm:text-base' : 
            'text-xs sm:text-sm'
          }`}>
            {title}
          </h3>

          {/* Confidence Score Pill */}
          {confidence !== null && confidence > 0 && (
            <span className="pill-badge !text-[10px] !py-0.5 !px-2 !bg-mint-wash !text-fern-pop font-semibold" title="AI Extraction Confidence Score">
              {(confidence * 100).toFixed(0)}% Conf
            </span>
          )}
        </div>

        {/* Page Tag */}
        {section.page && (
          <span className="pill-badge !text-[11px] !py-0.5 !px-2.5 !bg-cloud !text-iron flex-shrink-0">
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
          {normalizedFields.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-graphite block">
                Extracted Fields ({normalizedFields.length})
              </span>
              <FieldTable fields={normalizedFields} />
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
