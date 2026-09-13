import React from 'react';
import { 
  FileText, 
  Layers, 
  Table, 
  Clock, 
  BookOpen, 
  CheckCircle2, 
  Sparkles,
  Zap
} from 'lucide-react';

export default function DocSummary({ documentTree, onOpenTableViewer }) {
  if (!documentTree) return null;

  // Calculate heading breakdown
  const counts = { H1: 0, H2: 0, H3: 0, H4Plus: 0 };
  const countHeadings = (nodes) => {
    for (const node of nodes) {
      if (node.level === 1) counts.H1++;
      else if (node.level === 2) counts.H2++;
      else if (node.level === 3) counts.H3++;
      else if (node.level >= 4) counts.H4Plus++;
      if (node.children) countHeadings(node.children);
    }
  };
  countHeadings(documentTree.toc || []);

  const readingTimeMin = Math.max(1, Math.ceil(documentTree.total_words / 200));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      
      {/* Pages Card */}
      <div className="glass-card p-3.5 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <div className="text-lg font-bold text-white font-mono">
            {documentTree.total_pages}
          </div>
          <div className="text-[11px] text-slate-400">Total Pages</div>
        </div>
      </div>

      {/* Sections Card */}
      <div className="glass-card p-3.5 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
          <Layers className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <div className="text-lg font-bold text-white font-mono">
            {documentTree.total_sections}
          </div>
          <div className="text-[11px] text-slate-400">
            Headings (H1: {counts.H1}, H2: {counts.H2})
          </div>
        </div>
      </div>

      {/* Tables Card */}
      <div 
        onClick={onOpenTableViewer}
        className="glass-card p-3.5 flex items-center space-x-3 cursor-pointer hover:border-emerald-500/40 transition-colors group"
      >
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
          <Table className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <div className="text-lg font-bold text-emerald-400 font-mono flex items-center space-x-1">
            <span>{documentTree.total_tables}</span>
            <span className="text-[10px] text-emerald-500/80 font-normal underline">view</span>
          </div>
          <div className="text-[11px] text-slate-400">Extracted Tables</div>
        </div>
      </div>

      {/* Words / Engine Speed Card */}
      <div className="glass-card p-3.5 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <div className="text-lg font-bold text-white font-mono">
            {documentTree.total_words.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400">
            Words • {documentTree.processing_time_sec}s runtime
          </div>
        </div>
      </div>

    </div>
  );
}
