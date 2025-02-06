// components/CanvasTree.tsx
import React from 'react';
import { QANode } from '@/types'; // if you're using a separate types file

interface CanvasTreeProps {
  node: QANode | null;
  depth?: number;
}

const CanvasTree: React.FC<CanvasTreeProps> = ({ node, depth = 0 }) => {
  if (!node) return null;

  return (
    <div style={{ marginLeft: depth * 16 }} className="mb-4">
      <div className="p-2 border rounded mb-2 bg-white shadow">
        <p className="font-medium text-gray-900">{node.question}</p>
        {node.answer && <p className="text-gray-800">Answer: {node.answer}</p>}
      </div>
      {node.children?.map((child: QANode) => (
        <CanvasTree key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
};

export default CanvasTree;
