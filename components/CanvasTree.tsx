// components/CanvasTree.tsx
import React from 'react';
import { QANode } from '@/types'; // if you're using a separate types file

interface CanvasTreeProps {
  node: QANode | null;
  depth?: number;
  isRoot?: boolean;
}

const CanvasTree: React.FC<CanvasTreeProps> = ({ node, depth = 0, isRoot = true }) => {
  if (!node) return null;

  const isPromptNode = node.question.startsWith('Prompt:');

  return (
    <div style={{ marginLeft: depth * 16 }} className="mb-4">
      <div className={`p-2 border rounded mb-2 ${isPromptNode ? 'bg-gray-50' : 'bg-white'} shadow`}>
        <p className={`${isPromptNode ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'}`}>
          {node.question}
        </p>
        {!isPromptNode && node.answer && (
          <p className="text-gray-800 mt-1">Answer: {node.answer}</p>
        )}
      </div>
      {node.children?.map((child: QANode) => (
        <CanvasTree key={child.id} node={child} depth={depth + 1} isRoot={false} />
      ))}
    </div>
  );
};

export default CanvasTree;
