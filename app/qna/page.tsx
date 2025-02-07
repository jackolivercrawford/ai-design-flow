// /app/qna/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import HeaderToolbar from '../../components/HeaderToolbar';
import QAPanel from '../../components/QAPanel';
import CanvasTree from '../../components/CanvasTree';
import { QANode } from '../../types';
import { QASettings } from '@/types/settings';

export default function QnAPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState<string>('');
  const [settings, setSettings] = useState<QASettings | null>(null);
  const [qaTree, setQaTree] = useState<QANode | null>(null);
  const [currentNode, setCurrentNode] = useState<QANode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);

  // Helper: Get the next question based on traversal mode
  const getNextQuestion = async (node: QANode): Promise<QANode | null> => {
    const isDFS = settings?.traversalMode === 'dfs';
    
    if (isDFS) {
      // DFS: Try to go deeper first
      if (node.answer) {
        // If this node has an answer, try to generate its first child
        const { nodes: children, shouldStopBranch } = await fetchQuestionsForNode(prompt, node);
        
        // If we should stop this branch or no children were generated, move to siblings
        if (!shouldStopBranch && children.length > 0) {
          node.children = children;
          return children[0];
        }
      }
      
      // If we can't go deeper, find the next sibling by traversing up
      let current: QANode | null = node;
      let parent = findParentNode(qaTree!, node);
      
      while (parent) {
        const siblings = parent.children;
        const currentIndex = siblings.indexOf(current!);
        
        if (currentIndex < siblings.length - 1) {
          // Return next sibling
          return siblings[currentIndex + 1];
        }
        
        // Move up to try next level's sibling
        current = parent;
        parent = findParentNode(qaTree!, parent);
      }
      
      return null; // No more questions
    } else {
      // BFS: Complete current level before going deeper
      // Find all nodes at the current level
      const currentLevel = findNodesAtSameLevel(qaTree!, node);
      const currentIndex = currentLevel.indexOf(node);
      
      if (currentIndex < currentLevel.length - 1) {
        // Return next sibling in current level
        return currentLevel[currentIndex + 1];
      }
      
      // If we've completed the current level, start the next level
      const nextLevelStart = findFirstUnansweredChild(qaTree!);
      if (nextLevelStart) {
        return nextLevelStart;
      }
      
      // If no unanswered children found, generate new ones for the first node that can have children
      const nodeForChildren = findFirstNodeForChildren(qaTree!);
      if (nodeForChildren) {
        const { nodes: children, shouldStopBranch } = await fetchQuestionsForNode(prompt, nodeForChildren);
        if (!shouldStopBranch && children.length > 0) {
          nodeForChildren.children = children;
          return children[0];
        }
      }
      
      return null; // No more questions
    }
  };

  // Helper: Find parent node
  const findParentNode = (root: QANode | null, target: QANode): QANode | null => {
    if (!root) return null;
    if (root.children.includes(target)) return root;
    for (const child of root.children) {
      const found = findParentNode(child, target);
      if (found) return found;
    }
    return null;
  };

  // Helper: Find all nodes at the same level as the target node
  const findNodesAtSameLevel = (root: QANode | null, target: QANode): QANode[] => {
    if (!root) return [];
    const parent = findParentNode(root, target);
    if (!parent) return root.children; // If no parent, must be root level
    return parent.children;
  };

  // Helper: Find the first unanswered child in the tree (BFS)
  const findFirstUnansweredChild = (root: QANode | null): QANode | null => {
    if (!root) return null;
    const queue: QANode[] = [root];
    while (queue.length > 0) {
      const node = queue.shift()!;
      // Skip the root node when looking for unanswered questions
      if (node.children.length > 0) {
        for (const child of node.children) {
          if (!child.answer) return child;
          queue.push(child);
        }
      } else if (!node.answer && node.question !== `Prompt: ${prompt}`) {
        return node;
      }
    }
    return null;
  };

  // Helper: Find the first node that can have children (has answer but no children)
  const findFirstNodeForChildren = (root: QANode | null): QANode | null => {
    if (!root) return null;
    const queue: QANode[] = [root];
    while (queue.length > 0) {
      const node = queue.shift()!;
      // Skip the root node when looking for nodes that can have children
      if (node.answer && node.children.length === 0 && node.question !== `Prompt: ${prompt}`) {
        return node;
      }
      queue.push(...node.children);
    }
    return null;
  };

  // Helper: fetch questions for a node
  const fetchQuestionsForNode = async (designPrompt: string, parentNode: QANode): Promise<{ nodes: QANode[], shouldStopBranch: boolean, stopReason: string }> => {
    try {
      // Build the previous Q&A chain up to the root
      const previousQA: Array<{ question: string; answer?: string; parent?: any }> = [];
      let current: QANode | null = parentNode;
      
      while (current) {
        // Don't include the root prompt node in the Q&A chain
        if (current.answer && current.question !== `Prompt: ${prompt}`) {
          previousQA.unshift({
            question: current.question,
            answer: current.answer,
            parent: previousQA[0] || undefined
          });
        }
        const parent = findParentNode(qaTree, current);
        if (!parent || parent === current) break;
        current = parent;
      }
      
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: designPrompt,
          previousQuestions: previousQA,
          traversalMode: settings?.traversalMode,
        }),
      });
      const data = await response.json();
      
      // Create a single child node
      const nodes: QANode[] = data.questions.slice(0, 1).map((q: string) => ({
        id: uuidv4(),
        question: q,
        children: [],
      }));
      
      return {
        nodes,
        shouldStopBranch: data.shouldStopBranch,
        stopReason: data.stopReason
      };
    } catch (error) {
      console.error("Error in fetchQuestionsForNode:", error);
      return { nodes: [], shouldStopBranch: true, stopReason: "Error generating questions" };
    }
  };

  // On mount: load the prompt and settings
  useEffect(() => {
    const storedPrompt = localStorage.getItem('designPrompt');
    const storedSettings = localStorage.getItem('qaSettings');
    
    if (storedPrompt && storedSettings) {
      const parsedSettings = JSON.parse(storedSettings);
      setPrompt(storedPrompt);
      setSettings(parsedSettings);
      
      // Create and set up root node
      const rootNode: QANode = {
        id: uuidv4(),
        question: `Prompt: ${storedPrompt}`,
        children: [],
      };
      setQaTree(rootNode);
      
      // Generate first question
      fetchQuestionsForNode(storedPrompt, rootNode).then(({ nodes: children }) => {
        if (children.length > 0) {
          rootNode.children = children;
          setQaTree({ ...rootNode });
          setCurrentNode(children[0]);
          setQuestionCount(1);
        }
        setIsLoading(false);
      });
    } else {
      console.error("No design prompt or settings found.");
      router.push('/');
    }
  }, [router]);

  // When the user submits an answer
  const handleAnswer = async (answer: string) => {
    if (!currentNode || !settings) return;
    
    setIsLoadingNextQuestion(true);
    
    // Check if we've hit the question limit
    if (settings.maxQuestions && questionCount >= settings.maxQuestions) {
      setCurrentNode(null); // End the Q&A session
      setIsLoadingNextQuestion(false);
      return;
    }
    
    // Record the answer
    currentNode.answer = answer;
    
    // Get the next question based on traversal mode
    const nextNode = await getNextQuestion(currentNode);
    
    if (nextNode) {
      setCurrentNode(nextNode);
      setQuestionCount(prev => prev + 1);
    } else {
      setCurrentNode(null); // No more questions
    }
    
    // Update the tree state
    setQaTree(prev => prev ? { ...prev } : prev);
    setIsLoadingNextQuestion(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <HeaderToolbar />
      <div className="py-2 px-6 bg-white border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Questions: {questionCount}{settings?.maxQuestions ? ` / ${settings.maxQuestions}` : ''}
          </div>
          <div className="text-sm text-gray-600">
            Mode: {settings?.traversalMode === 'dfs' ? 'Depth-First' : 'Breadth-First'}
          </div>
        </div>
      </div>
      <main className="flex-1 flex">
        {/* Left: Canvas Tree view */}
        <div className="w-2/3 p-6 overflow-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 min-h-full">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Question Tree</h2>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <CanvasTree node={qaTree} />
            )}
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
            isLoading={isLoading || isLoadingNextQuestion}
          />
        </div>
      </main>
    </div>
  );
}
