import React, { useState, useMemo } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Table, 
  FileText, 
  Layers, 
  ChevronsUpDown, 
  Search,
  Filter
} from 'lucide-react';

const LEVEL_COLORS = {
  1: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'H1' },
  2: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30', label: 'H2' },
  3: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', label: 'H3' },
  4: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', label: 'H4' },
  5: { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30', label: 'H5' },
  6: { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30', label: 'H6' },
  0: { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30', label: 'Doc' }
};

function TreeNode({ 
  node, 
  selectedId, 
  onSelect, 
  expandedNodes, 
  toggleExpand,
  depth = 0,
  filterQuery = ''
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedId === node.id;
  const style = LEVEL_COLORS[node.level] || LEVEL_COLORS[1];

  // Highlight matching search text
  const renderTitle = (title, query) => {
    if (!query) return title;
    const parts = title.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={i} className="bg-brand-500/30 text-brand-200 font-bold px-0.5 rounded">
          {part}
        </span>
      ) : part
    );
  };

  return (
    <div className="select-none text-xs">
      <div 
        onClick={() => onSelect(node)}
        className={`group flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-all duration-150 ${
          isSelected 
            ? 'bg-brand-500/20 text-white font-semibold border-l-2 border-brand-400 shadow-sm' 
            : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
        }`}
        style={{ paddingLeft: `${Math.max(depth * 14 + 8, 8)}px` }}
      >
        <div className="flex items-center space-x-2 truncate mr-2">
          {/* Expand/Collapse Toggle */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              className="p-0.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <span className="w-3.5 h-3.5 flex items-center justify-center text-slate-600">
              •
            </span>
          )}

          {/* Heading Level Tag */}
          <span className={`px-1 py-0.2 rounded text-[10px] font-mono font-bold border ${style.bg} ${style.text} ${style.border}`}>
            {style.label}
          </span>

          {/* Title */}
          <span className="truncate text-xs tracking-tight">
            {renderTitle(node.title, filterQuery)}
          </span>
        </div>

        {/* Right Badges: Page range & table count */}
        <div className="flex items-center space-x-1.5 shrink-0">
          {node.table_count > 0 && (
            <span className="flex items-center space-x-0.5 px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20" title={`${node.table_count} table(s)`}>
              <Table className="w-2.5 h-2.5" />
              <span>{node.table_count}</span>
            </span>
          )}

          <span className="text-[10px] font-mono text-slate-500 group-hover:text-slate-400">
            p.{node.page_start}{node.page_end > node.page_start ? `-${node.page_end}` : ''}
          </span>
        </div>
      </div>

      {/* Render Children if expanded */}
      {hasChildren && isExpanded && (
        <div className="relative">
          {/* Subtle connecting vertical guide line */}
          <div 
            className="absolute left-[14px] top-0 bottom-2 w-px bg-slate-800/80 pointer-events-none"
            style={{ left: `${depth * 14 + 14}px` }}
          />
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              depth={depth + 1}
              filterQuery={filterQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TocTree({ 
  toc, 
  selectedSection, 
  onSelectSection 
}) {
  const [filterQuery, setFilterQuery] = useState('');
  const [maxLevelFilter, setMaxLevelFilter] = useState(6);
  const [expandedNodes, setExpandedNodes] = useState(() => {
    // Expand top 2 levels by default
    const set = new Set();
    const collectInitial = (nodes, currentDepth) => {
      for (const n of nodes) {
        if (currentDepth <= 2) set.add(n.id);
        if (n.children) collectInitial(n.children, currentDepth + 1);
      }
    };
    collectInitial(toc || [], 1);
    return set;
  });

  const toggleExpand = (id) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set();
    const collectAll = (nodes) => {
      for (const n of nodes) {
        all.add(n.id);
        if (n.children) collectAll(n.children);
      }
    };
    collectAll(toc || []);
    setExpandedNodes(all);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Filter TOC based on search query and max level
  const filteredToc = useMemo(() => {
    if (!filterQuery && maxLevelFilter === 6) return toc;

    const filterNode = (node) => {
      const matchesLevel = node.level <= maxLevelFilter;
      const matchesQuery = !filterQuery || node.title.toLowerCase().includes(filterQuery.toLowerCase());
      
      let filteredChildren = [];
      if (node.children) {
        filteredChildren = node.children
          .map(filterNode)
          .filter(Boolean);
      }

      if ((matchesLevel && matchesQuery) || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren
        };
      }
      return null;
    };

    return toc.map(filterNode).filter(Boolean);
  }, [toc, filterQuery, maxLevelFilter]);

  return (
    <div className="flex flex-col h-full bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden shadow-lg">
      
      {/* Sidebar Header */}
      <div className="p-3.5 border-b border-slate-800 bg-slate-900/90 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-brand-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Table of Contents
            </span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={expandAll}
              className="text-[10px] text-slate-400 hover:text-brand-300 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700/80 transition-colors"
              title="Expand All Sections"
            >
              Expand
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="text-[10px] text-slate-400 hover:text-brand-300 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700/80 transition-colors"
              title="Collapse All Sections"
            >
              Collapse
            </button>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filter headings..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
          />
        </div>

        {/* Level Pills */}
        <div className="flex items-center space-x-1 pt-1">
          <span className="text-[10px] text-slate-500 font-medium mr-1">Depth:</span>
          {[
            { label: 'All', val: 6 },
            { label: 'H1', val: 1 },
            { label: 'H1-2', val: 2 },
            { label: 'H1-3', val: 3 },
          ].map((item) => (
            <button
              key={item.val}
              type="button"
              onClick={() => setMaxLevelFilter(item.val)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                maxLevelFilter === item.val
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30 font-semibold'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tree list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filteredToc && filteredToc.length > 0 ? (
          filteredToc.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              selectedId={selectedSection?.id}
              onSelect={onSelectSection}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              depth={0}
              filterQuery={filterQuery}
            />
          ))
        ) : (
          <div className="p-6 text-center text-slate-500 text-xs">
            No headings match &quot;{filterQuery}&quot;
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="p-2.5 border-t border-slate-800 bg-slate-950/60 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Structure extracted via pymupdf4llm</span>
      </div>
    </div>
  );
}
