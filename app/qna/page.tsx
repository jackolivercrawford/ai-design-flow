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

interface QuestionHistoryItem {
  question: string;
  answer?: string;
  topics: string[];
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
  const [suggestedAnswer, setSuggestedAnswer] = useState<{
    text: string;
    confidence: 'high' | 'medium' | 'low';
    sourceReferences: number[];
  } | null>(null);
  const [requirementsDoc, setRequirementsDoc] = useState<RequirementsDocument | null>(null);
  const [askedQuestions, setAskedQuestions] = useState<Set<string>>(new Set());
  const [askedTopics, setAskedTopics] = useState<Set<string>>(new Set());

  // Helper: Extract topics from a question
  const extractTopics = (question: string): string[] => {
    const topics = [];
    // Common topic indicators in questions
    if (question.toLowerCase().includes('audience') || 
        question.toLowerCase().includes('user') || 
        question.toLowerCase().includes('visitor')) {
      topics.push('audience');
    }
    if (question.toLowerCase().includes('purpose') || 
        question.toLowerCase().includes('goal')) {
      topics.push('purpose');
    }
    // Add more topic extractors as needed
    return topics;
  };

  // Helper: Get the next question based on traversal mode
  const getNextQuestion = async (node: QANode): Promise<QANode | null> => {
    const isDFS = settings?.traversalMode === 'dfs';
    
    // Build complete question history including topics
    const questionHistory: QuestionHistoryItem[] = [];
    const collectHistory = (n: QANode) => {
      if (n.question !== `Prompt: ${prompt}`) {
        questionHistory.push({
          question: n.question,
          answer: n.answer,
          topics: extractTopics(n.question)
        });
      }
      n.children.forEach(collectHistory);
    };
    collectHistory(qaTree!);

    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          previousQuestions: questionHistory,
          traversalMode: settings?.traversalMode,
          knowledgeBase: settings?.knowledgeBase,
          askedQuestions: Array.from(askedQuestions),
          askedTopics: Array.from(askedTopics)
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch next question');
      }

      const data = await response.json();
      
      if (data.questions?.[0]) {
        // Update tracking sets
        setAskedQuestions(prev => new Set([...prev, data.questions[0]]));
        const newTopics = extractTopics(data.questions[0]);
        setAskedTopics(prev => new Set([...prev, ...newTopics]));
        
        // Create new node
        return {
          id: uuidv4(),
          question: data.questions[0],
          children: [],
          questionNumber: questionCount + 1,
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting next question:', error);
      return null;
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

      console.log('Fetching questions with knowledge base:', settings?.knowledgeBase);
      
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        throw new Error(`API request failed: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      console.log('Received API response with suggested answer:', data.suggestedAnswer);
      
      if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error('Invalid response format or no questions received');
      }

      // Set suggested answer if available
      if (data.suggestedAnswer) {
        console.log('Setting suggested answer:', {
          text: data.suggestedAnswer,
          confidence: data.confidence || 'low',
          sourceReferences: data.sourceReferences || []
        });
        
        setSuggestedAnswer({
          text: data.suggestedAnswer,
          confidence: data.confidence || 'low',
          sourceReferences: data.sourceReferences || []
        });
      } else {
        console.log('Clearing suggested answer');
        setSuggestedAnswer(null);
      }
      
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
        shouldStopBranch: data.shouldStopBranch || false,
        stopReason: data.stopReason || 'No more questions needed'
      };
    } catch (error) {
      console.error("Error in fetchQuestionsForNode:", error);
      // Return a default error question node
      const errorNode: QANode = {
        id: uuidv4(),
        question: "Failed to generate question. Please try again or refresh the page.",
        children: [],
        questionNumber: questionCount + 1,
      };
      return { 
        nodes: [errorNode], 
        shouldStopBranch: true, 
        stopReason: error instanceof Error ? error.message : "Error generating questions" 
      };
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
      if (!qaTree || !requirementsDoc) {
        console.warn('Missing qaTree or requirementsDoc, skipping requirements update');
        return;
      }

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
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        throw new Error(`API request failed: ${errorData.error || response.statusText}`);
      }

      const updatedDoc = await response.json();
      if (!updatedDoc || !updatedDoc.categories) {
        throw new Error('Invalid requirements document received');
      }

      setRequirementsDoc(updatedDoc);
      
      // Save progress including requirements
      saveProgress();
    } catch (error) {
      console.error('Error updating requirements:', error);
      // Don't throw the error, just log it and continue
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
        console.log('Loaded settings with knowledge base:', progress.settings.knowledgeBase);
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
      }
    }
    
    // Start new session
    if (storedPrompt && storedSettings) {
      const parsedSettings = JSON.parse(storedSettings);
      console.log('Starting new session with knowledge base:', parsedSettings.knowledgeBase);
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
    setSuggestedAnswer(null);
    
    // Check if we've hit the question limit
    if (settings.maxQuestions && questionCount >= settings.maxQuestions) {
      setCurrentNode(null);
      setIsLoadingNextQuestion(false);
      return;
    }
    
    try {
      // Record the answer
      currentNode.answer = answer;
      
      // Update requirements document with new answer
      await updateRequirements(currentNode.id);
      
      // Get the next question based on traversal mode
      const nextNode = await getNextQuestion(currentNode);
      
      if (nextNode) {
        // Verify this question hasn't been asked before
        if (!askedQuestions.has(nextNode.question)) {
          setCurrentNode(nextNode);
          setQuestionCount(prev => prev + 1);
        } else {
          console.warn('Duplicate question detected:', nextNode.question);
          // Try to get another question or end if no valid questions remain
          setCurrentNode(null);
        }
      } else {
        setCurrentNode(null); // No more questions
        // Final requirements update with no current node
        await updateRequirements(null);
      }
      
      // Update the tree state
      setQaTree(prev => prev ? { ...prev } : prev);
    } catch (error) {
      console.error('Error in handleAnswer:', error);
    } finally {
      setIsLoadingNextQuestion(false);
    }
  };

  const handleAutoPopulate = async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          previousQuestions: [],  // We don't need previous questions for auto-populate
          traversalMode: settings?.traversalMode,
          knowledgeBase: settings?.knowledgeBase,
          currentQuestion: currentNode?.question
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate answer');
      }

      const data = await response.json();
      console.log('Auto-populate response:', data);
      
      // Return the suggestedAnswer text if it exists
      if (data.suggestedAnswer) {
        return data.suggestedAnswer;
      }
      
      // If we have questions but no suggested answer, try to use the first question as context
      if (data.questions?.[0]) {
        const contextResponse = await fetch('/api/generate-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            previousQuestions: [{
              question: currentNode?.question || '',
              answer: data.questions[0]
            }],
            traversalMode: settings?.traversalMode,
            knowledgeBase: settings?.knowledgeBase
          }),
        });

        if (contextResponse.ok) {
          const contextData = await contextResponse.json();
          if (contextData.suggestedAnswer) {
            return contextData.suggestedAnswer;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error auto-populating answer:', error);
      return null;
    }
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
            hasKnowledgeBase={Boolean(settings?.knowledgeBase?.length)}
            onAutoPopulate={handleAutoPopulate}
          />
        </div>
      </main>
    </div>
  );
}
