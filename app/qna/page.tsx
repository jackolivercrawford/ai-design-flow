// /app/qna/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import HeaderToolbar from '../../components/HeaderToolbar';
import QAPanel from '../../components/QAPanel';
import CanvasTree from '../../components/CanvasTree';
import { QANode } from '../../types';

export default function QnAPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState<string>('');
  const [qaTree, setQaTree] = useState<QANode | null>(null);
  const [currentNode, setCurrentNode] = useState<QANode | null>(null);
  // Store the array of nodes at the current level and an index pointer
  const [currentLevelNodes, setCurrentLevelNodes] = useState<QANode[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Fetch multiple questions for a given parent node and update its children
  // /app/qna/page.tsx
// /app/qna/page.tsx (updated fetchQuestions function)
const fetchQuestions = async (designPrompt: string, parentNode: QANode) => {
  try {
    const response = await fetch('/api/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: designPrompt,
        previousQuestions: [] // Optionally, pass parent-specific history here
      }),
    });
    const data = await response.json();
    
    // Extract the first question from the returned array.
    const questionText =
      data.questions && data.questions.length > 0
        ? data.questions[0]
        : 'No question returned.';
    
    const newChild: QANode = {
      id: uuidv4(),
      question: questionText,
      children: [],
    };

    // Helper function to immutably update the tree.
    const updateTree = (node: QANode): QANode => {
      // If this is the node we're targeting, add the new child.
      if (node.id === parentNode.id) {
        return {
          ...node,
          children: [...node.children, newChild],
        };
      }
      // Otherwise, update any children recursively.
      return {
        ...node,
        children: node.children.map(child => updateTree(child)),
      };
    };

    // Use the functional state updater to get the latest tree.
    setQaTree((prevTree) => (prevTree ? updateTree(prevTree) : prevTree));
    setCurrentNode(newChild);
  } catch (error) {
    console.error("Error fetching questions:", error);
  }
};


  // On mount: load the stored prompt, create the root node, and fetch top-level questions.
  useEffect(() => {
    const storedPrompt = localStorage.getItem('designPrompt');
    if (storedPrompt) {
      setPrompt(storedPrompt);
      const rootNode: QANode = {
        id: uuidv4(),
        question: `Prompt: ${storedPrompt}`,
        children: [],
      };
      setQaTree(rootNode);
      // Fetch top-level (sibling) questions for the root node
      fetchQuestions(storedPrompt, rootNode);
    } else {
      console.error("No design prompt found.");
      router.push('/');
    }
  }, []);

  // Handle answer submission for the current question.
  const handleAnswer = async (answer: string) => {
    if (!currentNode) return;

    // Save the answer on the current node
    currentNode.answer = answer;

    // Update the tree state first
    setQaTree({ ...qaTree! });

    // Fetch the next question for this node
    await fetchQuestions(prompt, currentNode);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <HeaderToolbar />
      <main className="flex-1 flex">
        {/* Left: Canvas Tree view */}
        <div className="w-2/3 p-6 overflow-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 min-h-full">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Question Tree</h2>
            <CanvasTree node={qaTree} />
          </div>
        </div>
        
        {/* Right: Q&A Panel */}
        <div className="w-1/3 p-6 overflow-auto border-l border-gray-200">
          <QAPanel
            currentQuestion={
              currentNode
                ? currentNode.question
                : "No more questions. Q&A complete."
            }
            onSubmitAnswer={handleAnswer}
          />
        </div>
      </main>
    </div>
  );
}
