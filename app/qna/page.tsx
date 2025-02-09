// /app/qna/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import HeaderToolbar from '../../components/HeaderToolbar';
import QAPanel from '../../components/QAPanel';
import CanvasTree from '../../components/CanvasTree';
import { QANode, RequirementsDocument, MockupVersion, SessionMetadata } from '@/types';
import { QASettings } from '@/types/settings';
import PreviewPanel from '../../components/PreviewPanel';

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
  const hasFetchedInitialQuestion = useRef(false);
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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessionMetadata, setSessionMetadata] = useState<SessionMetadata | null>(null);
  const [isLeavingPage, setIsLeavingPage] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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
    
    if (isDFS) {
      // DFS: Try to go deeper first by exploring the current topic fully
      if (node.answer) {
        // Build complete question history including topics for the current branch
        const branchHistory: QuestionHistoryItem[] = [];
        let current: QANode | null = node;
        let depth = 0;
        
        // Collect the current branch's history and calculate depth
        while (current) {
          if (current.question !== `Prompt: ${prompt}`) {
            branchHistory.unshift({
              question: current.question,
              answer: current.answer,
              topics: extractTopics(current.question)
            });
            depth++;
          }
          const parent = findParentNode(qaTree!, current);
          if (!parent || parent === current) break;
          current = parent;
        }

        // Try to generate a child question that explores the current topic deeper
        const { nodes: children, shouldStopBranch, stopReason } = await fetchQuestionsForNode(
          prompt, 
          node,
          branchHistory,
          depth,
          true // Enable suggestions for follow-up questions
        );
        
        // If the AI suggests stopping this branch, move to siblings
        if (shouldStopBranch) {
          console.log(`Stopping current branch: ${stopReason}`);
          // Find the next sibling at the highest incomplete level
          let searchNode: QANode | null = node;
          while (searchNode) {
            const parent = findParentNode(qaTree!, searchNode);
            if (!parent) break;
            
            const siblings = parent.children;
            const currentIndex = siblings.indexOf(searchNode);
            
            if (currentIndex < siblings.length - 1) {
              return siblings[currentIndex + 1];
            }
            searchNode = parent;
          }
        } 
        // If we got new questions, verify they explore the current topic deeper
        else if (children.length > 0) {
          const newQuestionTopics = extractTopics(children[0].question);
          const currentTopics = extractTopics(node.question);
          
          // Check if the new question is related to the current topic
          const isRelatedTopic = currentTopics.some(topic => 
            newQuestionTopics.includes(topic) || 
            newQuestionTopics.some(t => t.includes(topic))
          );

          if (isRelatedTopic) {
            // Set the question number based on exploration order
            children[0].questionNumber = questionCount + 1;
            node.children = children;
            return children[0];
          } else {
            console.log('Generated question explores unrelated topic, trying siblings instead');
            // Try to find the next sibling that continues the current topic
            const parent = findParentNode(qaTree!, node);
            if (parent) {
              const siblings = parent.children;
              const currentIndex = siblings.indexOf(node);
              if (currentIndex < siblings.length - 1) {
                return siblings[currentIndex + 1];
              }
            }
          }
        }
      }
      
      return null; // No more questions in this branch
      
    } else {
      // BFS: Complete all questions at the current level before going deeper
      const parent = findParentNode(qaTree!, node);
      if (!parent) return null;
      
      // Get all nodes at the current level
      const currentLevelNodes = parent.children;
      const currentIndex = currentLevelNodes.indexOf(node);
      const currentDepth = getNodeDepth(node);
      
      // Build question history for current level
      const levelHistory: QuestionHistoryItem[] = currentLevelNodes.map(n => ({
        question: n.question,
        answer: n.answer,
        topics: extractTopics(n.question)
      }));
      
      // Check if all nodes at current level are answered
      const allCurrentLevelAnswered = currentLevelNodes.every(n => n.answer);
      
      // If there are existing unanswered siblings, move to the next one
      if (currentIndex < currentLevelNodes.length - 1) {
        return currentLevelNodes[currentIndex + 1];
      }
      
      // For top level (depth 1), ensure we have enough broad coverage before going deeper
      // We want at least 3-4 high-level questions answered before considering going deeper
      const isTopLevel = currentDepth === 1;
      const shouldGenerateMoreSiblings = isTopLevel ? 
        currentLevelNodes.length < 4 : // At top level, always try to get at least 4 questions
        !allCurrentLevelAnswered;      // At other levels, generate siblings until all are answered
      
      // Only try to generate new siblings if we haven't completed the current level
      // or if we need more top-level coverage
      if (shouldGenerateMoreSiblings) {
        const { nodes: newSiblings, shouldStopBranch } = await fetchQuestionsForNode(
          prompt,
          parent,
          levelHistory,
          currentDepth,
          true // Enable suggestions for follow-up questions
        );
        
        if (!shouldStopBranch && newSiblings.length > 0) {
          // Set the question number sequentially within the layer
          newSiblings[0].questionNumber = questionCount + 1;
          parent.children = [...currentLevelNodes, ...newSiblings];
          return newSiblings[0];
        }
      }
      
      // Only if ALL nodes at current level are answered AND we have enough top-level coverage,
      // start going deeper
      if (allCurrentLevelAnswered && (!isTopLevel || currentLevelNodes.length >= 3)) {
        // Find the first answered node that doesn't have children yet
        for (const sibling of currentLevelNodes) {
          if (sibling.answer && sibling.children.length === 0) {
            const siblingHistory = levelHistory.filter(h => 
              extractTopics(h.question).some(t => 
                extractTopics(sibling.question).includes(t)
              )
            );
            
            const { nodes: children, shouldStopBranch } = await fetchQuestionsForNode(
              prompt,
              sibling,
              siblingHistory,
              currentDepth + 1,
              true // Enable suggestions for follow-up questions
            );
            
            if (!shouldStopBranch && children.length > 0) {
              // Set the question number sequentially for the next layer
              children[0].questionNumber = questionCount + 1;
              sibling.children = children;
              return children[0];
            }
          }
        }
      }
      
      return null; // No more questions at this level or deeper
    }
  };

  // Helper: Get the depth of a node in the tree
  const getNodeDepth = (node: QANode): number => {
    let depth = 0;
    let current = node;
    while (findParentNode(qaTree!, current)) {
      depth++;
      current = findParentNode(qaTree!, current)!;
    }
    return depth;
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
  const fetchQuestionsForNode = async (designPrompt: string, parentNode: QANode, questionHistory: QuestionHistoryItem[], depth: number, setSuggestion: boolean = false): Promise<{ nodes: QANode[], shouldStopBranch: boolean, stopReason: string, suggestedAnswer?: string }> => {
    try {
      console.log('Fetching questions with knowledge base:', settings?.knowledgeBase);
      
      // Get parent context for child questions
      const parentContext = parentNode.question !== `Prompt: ${designPrompt}` ? {
        parentQuestion: parentNode.question,
        parentAnswer: parentNode.answer,
        parentTopics: extractTopics(parentNode.question)
      } : null;
      
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: designPrompt,
          previousQuestions: questionHistory,
          traversalMode: settings?.traversalMode,
          knowledgeBase: settings?.knowledgeBase,
          depth: depth,
          parentContext: parentContext,
          includeSuggestions: setSuggestion // Only request suggestions when needed
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

      // Only set suggested answer if explicitly requested
      if (setSuggestion) {
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
        stopReason: data.stopReason || 'No more questions needed',
        suggestedAnswer: data.suggestedAnswer
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
        stopReason: error instanceof Error ? error.message : "Error generating questions",
        suggestedAnswer: undefined
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

  // Auto-save timer
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (qaTree) {
        saveProgress(true);
      }
    }, 60000); // Auto-save every minute

    return () => clearInterval(autoSaveInterval);
  }, [qaTree, currentNode, questionCount, prompt, settings]);

  // Handle page leave
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isLeavingPage) {
        e.preventDefault();
        e.returnValue = '';
        saveProgress(true);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isLeavingPage]);

  // Helper: Save current progress
  const saveProgress = (isAutoSave = false) => {
    if (!qaTree || !settings || !requirementsDoc) return;

    try {
      // Update session metadata
      const currentTime = new Date().toISOString();
      const metadata: SessionMetadata = {
        id: sessionMetadata?.id || uuidv4(),
        prompt,
        lastUpdated: currentTime,
        questionCount,
        versions: [],
        settings: {
          traversalMode: settings.traversalMode,
          unknownHandling: settings.unknownHandling,
          conflictResolution: settings.conflictResolution
        },
        name: sessionMetadata?.name
      };

      // Save progress and metadata
      localStorage.setItem('qaProgress', JSON.stringify({
        qaTree,
        currentNodeId: currentNode?.id || null,
        questionCount,
        prompt,
        settings,
        requirementsDoc
      }));

      localStorage.setItem('sessionMetadata', JSON.stringify(metadata));
      setSessionMetadata(metadata);

      if (!isAutoSave) {
        // Show success message for manual saves
        // TODO: Add a toast notification system
        console.log('Progress saved successfully');
      }
    } catch (error) {
      console.error('Error saving progress:', error);
      // TODO: Add error notification
    }
  };

  const handleVersionRestore = (version: MockupVersion) => {
    // Confirm before restoring
    if (window.confirm('Restoring this version will replace your current progress. Continue?')) {
      setQaTree(version.qaTree);
      setRequirementsDoc(version.requirementsDoc);
      
      // Find the first unanswered question in the restored tree
      const firstUnanswered = findFirstUnansweredChild(version.qaTree);
      setCurrentNode(firstUnanswered);
      
      // Update question count
      let count = 0;
      const countAnswers = (node: QANode) => {
        if (node.answer) count++;
        node.children.forEach(countAnswers);
      };
      countAnswers(version.qaTree);
      setQuestionCount(count);
      
      // Save the restored state
      saveProgress();
    }
  };

  const handleSaveSession = (name?: string) => {
    if (sessionMetadata) {
      const updatedMetadata = {
        ...sessionMetadata,
        name,
        lastUpdated: new Date().toISOString()
      };
      setSessionMetadata(updatedMetadata);
      localStorage.setItem('sessionMetadata', JSON.stringify(updatedMetadata));
      saveProgress();
    }
  };

  // On mount: try to load saved progress or start new session
  useEffect(() => {
    // Prevent duplicate API call on initial load
    if (hasFetchedInitialQuestion.current) return;
    hasFetchedInitialQuestion.current = true;

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
        setIsInitialLoad(false);
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
      
      // Create and set up root node (Q0)
      const rootNode: QANode = {
        id: uuidv4(),
        question: `Prompt: ${storedPrompt}`,
        children: [],
        questionNumber: 0,
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
      
      // Generate first question (Q1)
      fetchQuestionsForNode(storedPrompt, rootNode, [], 0, false).then(({ nodes: children, suggestedAnswer }) => {
        if (children.length > 0) {
          children[0].questionNumber = 1;
          rootNode.children = children;
          setQaTree({ ...rootNode });
          setCurrentNode(children[0]);
          if (suggestedAnswer) {
            setSuggestedAnswer({ 
              text: suggestedAnswer, 
              confidence: 'medium',
              sourceReferences: []
            });
          }
          setQuestionCount(1);
        }
        setIsLoading(false);
        setIsInitialLoad(false);
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
          setAskedQuestions(prev => new Set(prev).add(nextNode.question));
          setIsInitialLoad(true); // Prevent auto-fetch when setting current node
          setCurrentNode(nextNode);
          setQuestionCount(prev => prev + 1);
          setQaTree(prev => prev ? { ...prev } : prev);
          setIsInitialLoad(false); // Reset flag after state updates
        } else {
          console.warn('Duplicate question detected:', nextNode.question);
          setCurrentNode(null);
        }
      } else {
        setCurrentNode(null); // No more questions
        // Final requirements update with no current node
        await updateRequirements(null);
      }
    } catch (error) {
      console.error('Error in handleAnswer:', error);
    } finally {
      setIsLoadingNextQuestion(false);
    }
  };

  const handleAutoPopulate = async (): Promise<string | null> => {
    try {
      // If we already have a suggested answer, use it
      if (suggestedAnswer) {
        return suggestedAnswer.text;
      }
      
      // Otherwise, build the previous Q&A chain up to the current question
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

      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          previousQuestions: questionHistory,
          traversalMode: settings?.traversalMode,
          knowledgeBase: settings?.knowledgeBase,
          currentQuestion: currentNode?.question,
          isAutoPopulate: true
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
      
      return null;
    } catch (error) {
      console.error('Error auto-populating answer:', error);
      return null;
    }
  };

  const handleRestart = () => {
    // Set loading state
    setIsLoading(true);
    setIsLoadingNextQuestion(true);
    
    // Create new root node (Q0)
    const rootNode: QANode = {
      id: uuidv4(),
      question: `Prompt: ${prompt}`,
      children: [],
      questionNumber: 0, // Explicitly set prompt as Q0
    };
    
    // Reset all states
    setQaTree(rootNode);
    setQuestionCount(0);
    setCurrentNode(null);
    setAskedQuestions(new Set());
    setAskedTopics(new Set());
    
    // Reset requirements document
    const initialRequirementsDoc: RequirementsDocument = {
      id: uuidv4(),
      prompt: prompt,
      lastUpdated: new Date().toISOString(),
      categories: {
        basicNeeds: { 
          title: 'Basic Needs', 
          requirements: [] 
        },
        functionalRequirements: { 
          title: 'Functional Requirements', 
          requirements: [] 
        },
        userExperience: { 
          title: 'User Experience', 
          requirements: [] 
        },
        implementation: { 
          title: 'Implementation', 
          requirements: [] 
        },
        refinements: { 
          title: 'Refinements', 
          requirements: [] 
        },
        constraints: { 
          title: 'Constraints', 
          requirements: [] 
        }
      }
    };
    setRequirementsDoc(initialRequirementsDoc);
    
    // Generate first question (Q1)
    fetchQuestionsForNode(prompt, rootNode, [], 0, true).then(({ nodes: children }) => {
      if (children.length > 0) {
        // Set first actual question as Q1
        children[0].questionNumber = 1;
        rootNode.children = children;
        setQaTree({ ...rootNode });
        setCurrentNode(children[0]);
        setQuestionCount(1);
      }
    })
      .catch(error => {
        console.error('Error generating first question:', error);
      })
      .finally(() => {
        setIsLoading(false);
        setIsLoadingNextQuestion(false);
      });
  };

  const handleGenerate = async () => {
    setIsPreviewOpen(true);
    setIsGenerating(true);
    
    try {
      // Update requirements one final time before showing preview
      await updateRequirements(currentNode?.id || null);
      
      // Wait a bit to ensure requirements are updated
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error('Error generating preview:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-100">
      <HeaderToolbar 
        onRestart={handleRestart} 
        onGenerate={handleGenerate}
        onSave={() => handleSaveSession()}
        showRestartButton={!isLoading}
        showGenerateButton={!isLoading && qaTree !== null}
        showSaveButton={!isLoading && qaTree !== null}
      />
      <div className="flex-none py-2 px-6 bg-white border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Questions: {questionCount}{settings?.maxQuestions ? ` / ${settings.maxQuestions}` : ''}
          </div>
          <div className="text-sm text-gray-600">
            Mode: {settings?.traversalMode === 'dfs' ? 'Depth-First' : 'Breadth-First'}
          </div>
        </div>
      </div>
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Canvas Tree view */}
        <div className="w-2/3 h-full overflow-auto">
          <div className="p-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
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
        </div>
        {/* Right: Q&A Panel */}
        <div className="w-1/3 h-full overflow-auto border-l border-gray-200">
          <div className="p-6">
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
        </div>
      </main>
      
      <PreviewPanel
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        requirementsDoc={requirementsDoc!}
        isGenerating={isGenerating}
        qaTree={qaTree}
        onVersionRestore={handleVersionRestore}
      />
    </div>
  );
}
