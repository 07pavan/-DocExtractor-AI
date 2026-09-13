import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import UploadZone from './components/UploadZone';
import TocTree from './components/TocTree';
import SectionViewer from './components/SectionViewer';
import TableViewer from './components/TableViewer';
import SearchModal from './components/SearchModal';
import DocSummary from './components/DocSummary';
import { PanelLeftClose, PanelLeftOpen, Layers } from 'lucide-react';

export default function App() {
  const [documentTree, setDocumentTree] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeTableModal, setActiveTableModal] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Extract all tables across the document for table modal
  const allDocumentTables = React.useMemo(() => {
    if (!documentTree) return [];
    const tables = [];
    const collectTables = (nodes) => {
      for (const node of nodes) {
        if (node.tables && node.tables.length > 0) {
          tables.push(...node.tables);
        }
        if (node.children && node.children.length > 0) {
          collectTables(node.children);
        }
      }
    };
    collectTables(documentTree.toc || []);
    return tables;
  }, [documentTree]);

  // When new document extracted, select first section
  const handleExtractionComplete = (tree) => {
    setDocumentTree(tree);
    if (tree.toc && tree.toc.length > 0) {
      setSelectedSection(tree.toc[0]);
    }
  };

  const handleReset = () => {
    setDocumentTree(null);
    setSelectedSection(null);
    setActiveTableModal(null);
  };

  const handleOpenTableViewer = (table = null) => {
    if (allDocumentTables.length === 0) {
      alert("No tables found in this document.");
      return;
    }
    setActiveTableModal(table || allDocumentTables[0]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-brand-500/30 selection:text-brand-200">
      
      {/* Top Header */}
      <Header
        documentTree={documentTree}
        onReset={handleReset}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenTableViewer={() => handleOpenTableViewer()}
      />

      {/* Main App Body */}
      <main className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {!documentTree ? (
          /* Empty State / Upload & Sample Selection */
          <div className="flex-1 flex items-center justify-center">
            <UploadZone onExtractionComplete={handleExtractionComplete} />
          </div>
        ) : (
          /* Active Document Viewer Layout */
          <div className="flex-1 flex flex-col space-y-4">
            
            {/* Top Overview Metrics */}
            <DocSummary 
              documentTree={documentTree} 
              onOpenTableViewer={() => handleOpenTableViewer()} 
            />

            {/* Split Pane: TOC Navigator on Left, Content on Right */}
            <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-[600px] h-[calc(100vh-230px)]">
              
              {/* Sidebar: Table of Contents */}
              {sidebarOpen && (
                <div className="w-full lg:w-80 shrink-0 h-80 lg:h-full transition-all duration-200">
                  <TocTree
                    toc={documentTree.toc || []}
                    selectedSection={selectedSection}
                    onSelectSection={(sec) => setSelectedSection(sec)}
                  />
                </div>
              )}

              {/* Main Content Pane */}
              <div className="flex-1 h-full flex flex-col relative overflow-hidden">
                
                {/* Mobile sidebar toggle button */}
                <button
                  type="button"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="hidden lg:flex absolute top-4 -left-3 z-20 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 items-center justify-center text-slate-400 hover:text-white shadow-md transition-colors"
                  title={sidebarOpen ? "Hide Table of Contents" : "Show Table of Contents"}
                >
                  {sidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
                </button>

                <SectionViewer
                  section={selectedSection}
                  documentTree={documentTree}
                  onSelectSection={(sec) => setSelectedSection(sec)}
                  onOpenTableModal={(table) => setActiveTableModal(table)}
                />
              </div>

            </div>

          </div>
        )}

      </main>

      {/* Global Full Document Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        documentTree={documentTree}
        onSelectSection={(sec) => setSelectedSection(sec)}
      />

      {/* Table Modal Inspector */}
      {activeTableModal && (
        <TableViewer
          tables={allDocumentTables}
          initialTable={activeTableModal}
          onClose={() => setActiveTableModal(null)}
        />
      )}

    </div>
  );
}
