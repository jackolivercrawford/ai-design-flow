// /app/qna/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import HeaderToolbar from '../../components/HeaderToolbar';
import QAPanel from '../../components/QAPanel';
import CanvasTree from '../../components/CanvasTree';
import { QANode, RequirementsDocument } from '@/types';
import { QASettings } from '@/types/settings';

interface SavedProgress {
  qaTree: QANode;
  currentNodeId: string | null;
  questionCount: number;
  prompt: string;
  settings: QASettings;
  requirementsDoc: RequirementsDocument;
}

export default function QnAPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState<string>('');
  const [settings, setSettings] = useState<QASettings | null>(null);
  const [qaTree, setQaTree] = useState<QANode | null>(null);
  const [currentNode, setCurrentNode] = useState<QANode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [suggestedAnswer, setSuggestedAnswer] = useState<string | null>(null);
  const [requirementsDoc, setRequirementsDoc] = useState<RequirementsDocument | null>(null);

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
      const parent = findParentNode(qaTree!, node);
      if (!parent) return null; // Safety check
      
      // First, try to generate siblings at the current level
      const currentLevelNodes = parent.children;
      const currentIndex = currentLevelNodes.indexOf(node);
      
      // If this was the last answered node in its level, try to generate a new sibling
      if (currentIndex === currentLevelNodes.length - 1 && node.answer) {
        const { nodes: newSiblings, shouldStopBranch } = await fetchQuestionsForNode(prompt, parent);
        if (!shouldStopBranch && newSiblings.length > 0) {
          parent.children = [...currentLevelNodes, ...newSiblings];
          return newSiblings[0];
        }
      } 
      // If there are existing unanswered siblings, move to the next one
      else if (currentIndex < currentLevelNodes.length - 1) {
        return currentLevelNodes[currentIndex + 1];
      }
      
      // If we can't generate more siblings or move to next sibling,
      // look for the first answered node without children at the current level
      for (const sibling of currentLevelNodes) {
        if (sibling.answer && sibling.children.length === 0) {
          const { nodes: children, shouldStopBranch } = await fetchQuestionsForNode(prompt, sibling);
          if (!shouldStopBranch && children.length > 0) {
            sibling.children = children;
            return children[0];
          }
        }
      }
      
      // If we can't go deeper at this level, move to the next level
      const nextLevelStart = findFirstUnansweredChild(qaTree!);
      if (nextLevelStart) {
        return nextLevelStart;
      }
      
      // If no existing unanswered nodes, try to start a new level
      // Find the first node at the current level that can have children
      for (const sibling of currentLevelNodes) {
        if (sibling.answer && sibling.children.length === 0) {
          const { nodes: children, shouldStopBranch } = await fetchQuestionsForNode(prompt, sibling);
          if (!shouldStopBranch && children.length > 0) {
            sibling.children = children;
            return children[0];
          }
        }
      }
      
      return null; // No more questions at this level or deeper
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
          knowledgeBase: settings?.knowledgeBase
        }),
      });
      const data = await response.json();
      
      // Set suggested answer if available
      setSuggestedAnswer(data.suggestedAnswer);
      
      // Create a single child node with the next question number
      const nextQuestionNumber = questionCount + 1;
      const nodes: QANode[] = data.questions.slice(0, 1).map((q: string) => ({
        id: uuidv4(),
        question: q,
        children: [],
        questionNumber: nextQuestionNumber,
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

  // Helper: Find node by ID in the tree
  const findNodeById = (root: QANode | null, id: string): QANode | null => {
    if (!root) return null;
    if (root.id === id) return root;
    for (const child of root.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
    return null;
  };

  // Helper: Update requirements document
  const updateRequirements = async (nodeId: string | null) => {
    try {
      const response = await fetch('/api/update-requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qaTree,
          currentNodeId: nodeId,
          knowledgeBase: settings?.knowledgeBase,
          existingDocument: requirementsDoc
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update requirements');
      }

      const updatedDoc = await response.json();
      setRequirementsDoc(updatedDoc);
      
      // Save progress including requirements
      saveProgress();
    } catch (error) {
      console.error('Error updating requirements:', error);
    }
  };

  // Helper: Save current progress to localStorage
  const saveProgress = () => {
    if (!qaTree || !settings) return;
    
    const progress: SavedProgress = {
      qaTree,
      currentNodeId: currentNode?.id || null,
      questionCount,
      prompt,
      settings,
      requirementsDoc: requirementsDoc!
    };
    
    localStorage.setItem('qaProgress', JSON.stringify(progress));
  };

  // Effect to save progress whenever relevant state changes
  useEffect(() => {
    if (qaTree && !isLoading) {
      saveProgress();
    }
  }, [qaTree, currentNode, questionCount, prompt, settings]);

  // On mount: try to load saved progress or start new session
  useEffect(() => {
    const savedProgress = localStorage.getItem('qaProgress');
    const storedPrompt = localStorage.getItem('designPrompt');
    const storedSettings = localStorage.getItem('qaSettings');
    
    if (savedProgress) {
      // Load saved progress
      try {
        const progress: SavedProgress = JSON.parse(savedProgress);
        setPrompt(progress.prompt);
        setSettings(progress.settings);
        setQaTree(progress.qaTree);
        setQuestionCount(progress.questionCount);
        setRequirementsDoc(progress.requirementsDoc);
        if (progress.currentNodeId) {
          const node = findNodeById(progress.qaTree, progress.currentNodeId);
          setCurrentNode(node);
        }
        setIsLoading(false);
        return;
      } catch (error) {
        console.error("Error loading saved progress:", error);
        // If loading saved progress fails, fall back to new session
      }
    }
    
    // Start new session
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
      
      // Initialize requirements document
      const initialRequirementsDoc: RequirementsDocument = {
        id: uuidv4(),
        prompt: storedPrompt,
        lastUpdated: new Date().toISOString(),
        categories: {
          basicNeeds: { title: 'Basic Needs', requirements: [] },
          functionalRequirements: { title: 'Functional Requirements', requirements: [] },
          userExperience: { title: 'User Experience', requirements: [] },
          implementation: { title: 'Implementation', requirements: [] },
          refinements: { title: 'Refinements', requirements: [] },
          constraints: { title: 'Constraints', requirements: [] }
        }
      };
      setRequirementsDoc(initialRequirementsDoc);
      
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
    
    // Update requirements document with new answer
    await updateRequirements(currentNode.id);
    
    // Get the next question based on traversal mode
    const nextNode = await getNextQuestion(currentNode);
    
    if (nextNode) {
      setCurrentNode(nextNode);
      setQuestionCount(prev => prev + 1);
    } else {
      setCurrentNode(null); // No more questions
      // Final requirements update with no current node
      await updateRequirements(null);
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
            suggestedAnswer={suggestedAnswer}
          />
        </div>
      </main>
    </div>
  );
}
