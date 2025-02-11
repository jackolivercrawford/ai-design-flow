// components/CanvasTree.tsx
import React from 'react';
import { QANode } from '@/types'; // if you're using a separate types file

interface CanvasTreeProps {
  node: QANode | null;
  depth?: number;
  isRoot?: boolean;
}

const getQuestionColor = (depth: number): string => {
  switch (depth) {
    case 1:
      return 'text-red-600';
    case 2:
      return 'text-orange-500';
    case 3:
      return 'text-yellow-500';
    case 4:
      return 'text-green-600';
    case 5:
      return 'text-blue-600';
    default:
      return 'text-gray-600';
  }
};

const CanvasTree: React.FC<CanvasTreeProps> = ({ node, depth = 0, isRoot = true }) => {
  if (!node) return null;

  const isPromptNode = node.question.startsWith('Prompt:');
  const questionColor = getQuestionColor(depth);

  return (
    <div style={{ marginLeft: depth * 16 }} className="mb-4">
      <div className={`p-2 border rounded mb-2 ${isPromptNode ? 'bg-gray-50' : 'bg-white'} shadow`}>
        <p className={`${isPromptNode ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'}`}>
          {isPromptNode ? (
            node.question
          ) : (
            <>
              <span className={`${questionColor} font-semibold`}>Q{node.questionNumber}: </span>
              {node.question}
            </>
          )}
        </p>
        {!isPromptNode && node.answer && (
          <p className="text-gray-800 mt-1">
            <span className={`${questionColor} font-semibold`}>A{node.questionNumber}: </span>
            {node.answer}
          </p>
        )}
      </div>
      {node.children?.map((child: QANode) => (
        <CanvasTree key={child.id} node={child} depth={depth + 1} isRoot={false} />
      ))}
    </div>
  );
};

export default CanvasTree;
