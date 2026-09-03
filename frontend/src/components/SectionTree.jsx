import SectionNode from './SectionNode';

export default function SectionTree({ sections = [], searchQuery = '' }) {
  if (!sections || sections.length === 0) {
    return (
      <div className="p-8 text-center bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-gray-500 text-sm">
          No sections or headings were detected in this document.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sections.map((section, idx) => (
        <SectionNode
          key={idx}
          section={section}
          searchQuery={searchQuery}
          depth={0}
        />
      ))}
    </div>
  );
}
