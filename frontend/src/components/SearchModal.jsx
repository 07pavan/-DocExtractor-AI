import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, ChevronRight, FileText, Sparkles } from 'lucide-react';

export default function SearchModal({ 
  isOpen, 
  onClose, 
  documentTree, 
  onSelectSection 
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Handle Ctrl+K shortcut globally
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else if (documentTree) {
          // Open search modal
          const btn = document.querySelector('[title*="Ctrl+K"]');
          if (btn) btn.click();
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, documentTree]);

  // Flatten all sections with their full content
  const allSections = useMemo(() => {
    if (!documentTree) return [];
    const list = [];
    const collect = (nodes) => {
      for (const n of nodes) {
        list.push(n);
        if (n.children && n.children.length > 0) {
          collect(n.children);
        }
      }
    };
    collect(documentTree.toc || []);
    return list;
  }, [documentTree]);

  // Perform search
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();

    return allSections
      .map(sec => {
        const titleMatch = sec.title.toLowerCase().includes(q);
        const contentMatch = (sec.content || '').toLowerCase().indexOf(q);

        if (titleMatch || contentMatch !== -1) {
          let snippet = '';
          if (contentMatch !== -1) {
            const start = Math.max(0, contentMatch - 40);
            const end = Math.min(sec.content.length, contentMatch + q.length + 60);
            snippet = (start > 0 ? '...' : '') + sec.content.slice(start, end).replace(/\n+/g, ' ') + (end < sec.content.length ? '...' : '');
          }
          return {
            section: sec,
            titleMatch,
            snippet
          };
        }
        return null;
      })
      .filter(Boolean)
      .slice(0, 15);
  }, [query, allSections]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 sm:pt-28 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
        
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-800 flex items-center space-x-3 bg-slate-900/90">
          <Search className="w-5 h-5 text-brand-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search headings, content, tables across document..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {query.trim() ? (
            results.length > 0 ? (
              results.map(({ section, titleMatch, snippet }, idx) => (
                <div
                  key={section.id || idx}
                  onClick={() => {
                    onSelectSection(section);
                    onClose();
                  }}
                  className="p-3 rounded-xl hover:bg-slate-800/80 cursor-pointer border border-transparent hover:border-slate-700 transition-all group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2 truncate">
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20 font-bold">
                        H{section.level || 1}
                      </span>
                      <span className="text-xs font-semibold text-white group-hover:text-brand-300 truncate">
                        {section.title}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                      Page {section.page_start}
                    </span>
                  </div>

                  {snippet && (
                    <p className="text-[11px] text-slate-400 line-clamp-2 pl-6">
                      {snippet}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs">
                No matching sections found for &quot;{query}&quot;
              </div>
            )
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              Type keywords to search across all sections and extracted tables.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Navigate with mouse or click section to jump</span>
          <span className="font-mono">ESC to close</span>
        </div>
      </div>
    </div>
  );
}
