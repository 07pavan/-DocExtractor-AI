import { useState, useEffect } from 'react';
import FieldTable from './FieldTable';
import TableView from './TableView';

/**
 * Checks whether this section or any of its nested subsections match the search term.
 */
export function sectionMatchesSearch(section, query) {
  if (!query) return true;
  const q = query.toLowerCase();

  // Check heading
  if (section.heading && section.heading.toLowerCase().includes(q)) return true;

  // Check body text
  if (section.text && section.text.toLowerCase().includes(q)) return true;

  // Check fields
  if (section.fields && section.fields.some((f) => 
    (f.label && f.label.toLowerCase().includes(q)) || 
    (f.value && f.value.toLowerCase().includes(q))
  )) {
    return true;
  }

  // Check subsections recursively
  if (section.subsections && section.subsections.some((sub) => sectionMatchesSearch(sub, query))) {
    return true;
  }

  return false;
}

export default function SectionNode({ section, searchQuery = '', depth = 0 }) {
  const level = section.level || 1;
  const isTopLevel = level <= 1 || depth === 0;

  const [expanded, setExpanded] = useState(isTopLevel);

  // Auto-expand if active search matches
  useEffect(() => {
    if (searchQuery.trim()) {
      if (sectionMatchesSearch(section, searchQuery.trim())) {
        setExpanded(true);
      }
    } else {
      // Reset to default expansion when search is cleared
      setExpanded(isTopLevel);
    }
  }, [searchQuery, isTopLevel]);

  if (!section) return null;

  // If search query is active and this section subtree doesn't match, hide it
  if (searchQuery.trim() && !sectionMatchesSearch(section, searchQuery.trim())) {
    return null;
  }

  const hasContent = 
    (section.fields && section.fields.length > 0) || 
    (section.text && section.text.trim().length > 0) || 
    (section.subsections && section.subsections.length > 0);

  const toggleExpand = () => {
    if (hasContent) {
      setExpanded((prev) => !prev);
    }
  };

  return (
    <div className={`rounded-lg transition-all ${depth > 0 ? 'mt-2.5 ml-3 pl-3 border-l-2 border-blue-200' : 'mt-3 border border-gray-200 bg-white shadow-sm'}`}>
      {/* Clickable Header Row */}
      <div
        onClick={toggleExpand}
        className={`flex items-center justify-between p-3 select-none rounded-t-lg transition ${
          hasContent ? 'cursor-pointer hover:bg-gray-50/80' : ''
        }`}
      >
        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
          {/* Chevron Icon */}
          {hasContent ? (
            <svg
              className={`w-4 h-4 text-gray-500 transform transition-transform duration-200 flex-shrink-0 ${
                expanded ? 'rotate-90 text-blue-600' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          ) : (
            <div className="w-4 h-4" />
          )}

          {/* Heading Level Tag */}
          <span className={`px-1.5 py-0.5 text-[11px] font-bold rounded flex-shrink-0 ${
            level === 1 ? 'bg-blue-100 text-blue-800' :
            level === 2 ? 'bg-indigo-100 text-indigo-800' :
            'bg-gray-100 text-gray-700'
          }`}>
            H{level}
          </span>

          {/* Heading Title */}
          <h3 className={`font-semibold truncate ${
            level === 1 ? 'text-base text-gray-900' : 
            level === 2 ? 'text-sm text-gray-800' : 
            'text-xs font-medium text-gray-700'
          }`}>
            {section.heading || 'Untitled Section'}
          </h3>
        </div>

        {/* Page Badge */}
        {section.page && (
          <span className="text-[11px] px-2 py-0.5 font-medium bg-gray-100 text-gray-500 rounded-full flex-shrink-0">
            p. {section.page}
          </span>
        )}
      </div>

      {/* Collapsible Content Body */}
      {expanded && (
        <div className="px-3.5 pb-3.5 pt-1 space-y-3">
          {/* Structured Fields Table */}
          {section.fields && section.fields.length > 0 && (
            <FieldTable fields={section.fields} />
          )}

          {/* Structured Multi-Column Tables / Schedules */}
          {section.tables && section.tables.length > 0 && (
            <TableView tables={section.tables} />
          )}

          {/* Body Text */}
          {section.text && section.text.trim().length > 0 && (
            <div className="p-3 bg-gray-50 rounded text-sm text-gray-700 leading-relaxed whitespace-pre-line border border-gray-100">
              {section.text}
            </div>
          )}

          {/* Recursive Subsections */}
          {section.subsections && section.subsections.length > 0 && (
            <div className="space-y-1 pt-1">
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
