// app/qna/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import HeaderToolbar from '@/components/HeaderToolbar';
import QAPanel from '@/components/QAPanel';
import CanvasTree from '@/components/CanvasTree'; // We'll create this next.
import { QANode } from '@/types'; // If you placed your interface in a separate file.

export default function QnAPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState<string>('');
  const [qaTree, setQaTree] = useState<QANode | null>(null);
  const [currentNode, setCurrentNode] = useState<QANode | null>(null);

  // Function to fetch a question from the API and add it as a child to the given node.
  const fetchQuestion = async (designPrompt: string, parentNode: QANode) => {
    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: designPrompt,
          // You might want to pass a filtered history of previous Q&A from this branch.
          previousQuestions: [] 
        }),
      });
      const data = await response.json();
      const newChild: QANode = {
        id: uuidv4(),
        question: data.question || 'No question returned.',
        children: [], // Initialize with empty children array
      };
      parentNode.children.push(newChild);
      setCurrentNode(newChild);
      // Force an update to the tree by cloning it.
      setQaTree({ ...qaTree! });
    } catch (error) {
      console.error("Error fetching question:", error);
    }
  };

  // On mount, retrieve the prompt and create the root node.
  useEffect(() => {
    const storedPrompt = localStorage.getItem('designPrompt');
    if (storedPrompt) {
      setPrompt(storedPrompt);
      const rootNode: QANode = {
        id: uuidv4(),
        question: `Prompt: ${storedPrompt}`,
        children: [], // Initialize with empty children array
      };
      setQaTree(rootNode);
      setCurrentNode(rootNode);
      // Immediately fetch the first follow-up question for the root node.
      fetchQuestion(storedPrompt, rootNode);
    } else {
      // Handle missing prompt appropriately.
      console.error("No design prompt found.");
      router.push('/prompt');
    }
  }, []);

  // When the user submits an answer, attach it to the current node and then fetch a follow-up question.
  const handleAnswer = async (answer: string) => {
    if (!currentNode) return;
    // Save the answer on the current node.
    currentNode.answer = answer;
    // Fetch the next question as a child of the current node.
    await fetchQuestion(prompt, currentNode);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <HeaderToolbar />
      <main className="flex-1 flex">
        {/* Left side - Canvas (2/3) */}
        <div className="w-2/3 p-6 overflow-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 min-h-full">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Question Tree</h2>
            <CanvasTree node={qaTree} />
          </div>
        </div>
        
        {/* Right side - Q&A Panel (1/3) */}
        <div className="w-1/3 p-6 overflow-auto border-l border-gray-200">
          <QAPanel
            currentQuestion={currentNode ? currentNode.question : ''}
            onSubmitAnswer={handleAnswer}
          />
        </div>
      </main>
    </div>
  );
}