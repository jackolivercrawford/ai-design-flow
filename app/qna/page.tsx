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

        // First try to go deeper by generating a child question
        // Make multiple attempts to get a valid child question
        for (let attempt = 0; attempt < 3; attempt++) {
          const { nodes: children, shouldStopBranch } = await fetchQuestionsForNode(
            prompt, 
            node,
            branchHistory,
            depth,
            true
          );
          
          // If we can go deeper and got valid children
          if (!shouldStopBranch && children.length > 0) {
            const newQuestionTopics = extractTopics(children[0].question);
            const currentTopics = extractTopics(node.question);
            
            // Verify the child question is related to current topic
            const isRelatedTopic = currentTopics.some(topic => 
              newQuestionTopics.includes(topic) || 
              newQuestionTopics.some(t => t.includes(topic))
            );

            if (isRelatedTopic) {
              children[0].questionNumber = questionCount + 1;
              node.children = children;
              return children[0];
            }
          }
          
          // If shouldStopBranch is true, break the retry loop
          if (shouldStopBranch) break;
        }
        
        // If we can't go deeper after attempts, try to move to the next sibling
        const parent = findParentNode(qaTree!, node);
        if (parent) {
          const siblings = parent.children;
          const currentIndex = siblings.indexOf(node);
          
          // If there are more siblings at this level, move to the next sibling
          if (currentIndex < siblings.length - 1) {
            return siblings[currentIndex + 1];
          }
          
          // If no more siblings at this level, go up one level and try those siblings
          let ancestor = parent;
          let previousNode = node;
          
          while (ancestor) {
            const ancestorParent = findParentNode(qaTree!, ancestor);
            if (!ancestorParent) {
              // We've reached the root, generate new Level 1 questions
              const rootHistory = getAllAnsweredQuestions(qaTree!);
              const { nodes: newTopLevel } = await fetchQuestionsForNode(
                prompt,
                qaTree!,
                rootHistory,
                1,
                true
              );
              
              if (newTopLevel.length > 0) {
                newTopLevel[0].questionNumber = questionCount + 1;
                qaTree!.children = [...qaTree!.children, ...newTopLevel];
                return newTopLevel[0];
              }
            }
            
            const uncles = ancestorParent?.children || [];
            const ancestorIndex = uncles.indexOf(ancestor);
            
            // If there are more siblings at this ancestor's level, use the next one
            if (ancestorIndex < uncles.length - 1) {
              return uncles[ancestorIndex + 1];
            }
            
            previousNode = ancestor;
            ancestor = ancestorParent as QANode;
          }
        }
      }
      
      // If we reach here, generate new Level 1 questions
      const rootHistory = getAllAnsweredQuestions(qaTree!);
      const { nodes: newTopLevel } = await fetchQuestionsForNode(
        prompt,
        qaTree!,
        rootHistory,
        1,
        true
      );
      
      if (newTopLevel.length > 0) {
        newTopLevel[0].questionNumber = questionCount + 1;
        qaTree!.children = [...qaTree!.children, ...newTopLevel];
        return newTopLevel[0];
      }
      
    } else {
      // BFS mode:
      const parent = findParentNode(qaTree!, node);
      if (!parent) {
        // We're at the root, generate new Level 1 questions
        const rootHistory = getAllAnsweredQuestions(qaTree!);
        const { nodes: newTopLevel } = await fetchQuestionsForNode(
          prompt,
          qaTree!,
          rootHistory,
          1,
          true
        );
        
        if (newTopLevel.length > 0) {
          newTopLevel[0].questionNumber = questionCount + 1;
          qaTree!.children = [...qaTree!.children, ...newTopLevel];
          return newTopLevel[0];
        }
        return null;
      }
      
      // Get all nodes at the current level
      const currentLevelNodes = parent.children;
      const currentIndex = currentLevelNodes.indexOf(node);
      const currentDepth = getNodeDepth(node);
      
      // Extract aspects from parent's answer that need to be covered
      const parentAspects = parent.answer ? 
        extractAspectsFromAnswer(parent.answer) : 
        ['basic_requirements'];
      
      // Get aspects already covered by existing siblings
      const coveredAspects = new Set(
        currentLevelNodes
          .filter(n => n.answer) // Only consider answered questions
          .map(n => {
            const topics = extractTopics(n.question);
            // Also check if the question directly references parent aspects
            return topics.filter(topic => 
              parentAspects.some(aspect => 
                topic.includes(aspect) || aspect.includes(topic)
              )
            );
          })
          .flat()
      );

      // In BFS mode at Level 2, check if current Level 1 node has enough children
      if (currentDepth === 2) {
        const currentLevel1Node = findParentNode(qaTree!, node);
        const hasEnoughChildren = currentLevel1Node && 
          currentLevel1Node.children.length >= Math.min(3, extractAspectsFromAnswer(currentLevel1Node.answer || '').length);

        if (hasEnoughChildren) {
          // Get all Level 1 nodes
          const level1Nodes = qaTree!.children;
          
          // Find the next Level 1 node that needs children
          const nextLevel1WithoutChildren = level1Nodes.find(l1Node => 
            l1Node !== currentLevel1Node && // Not current Level 1
            l1Node.answer && // Has an answer
            l1Node.children.length < Math.min(3, extractAspectsFromAnswer(l1Node.answer).length) // Needs more children
          );

          if (nextLevel1WithoutChildren) {
            // Generate a child question for the next Level 1 node
            const nodeHistory = getAllAnsweredQuestions(nextLevel1WithoutChildren);
            const { nodes: newChildren } = await fetchQuestionsForNode(
              prompt,
              nextLevel1WithoutChildren,
              nodeHistory,
              2, // Level 2 depth
              true
            );
            
            if (newChildren.length > 0) {
              newChildren[0].questionNumber = questionCount + 1;
              nextLevel1WithoutChildren.children = [...nextLevel1WithoutChildren.children, ...newChildren];
              return newChildren[0];
            }
          }
        }
      }

      // Build question history for current level
      const levelHistory: QuestionHistoryItem[] = currentLevelNodes
        .filter(n => n.answer)
        .map(n => ({
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
      
      // Determine if we need more siblings at this level
      const isTopLevel = currentDepth === 1;
      const uncoveredAspects = parentAspects.filter(aspect => !coveredAspects.has(aspect));
      const hasEnoughTopLevelQuestions = isTopLevel && currentLevelNodes.length >= 4;
      const hasEnoughSiblingsForLevel = !isTopLevel && currentLevelNodes.length >= 3;
      
      const shouldGenerateMoreSiblings = 
        // At top level, generate more if we don't have enough questions AND have uncovered aspects
        (isTopLevel && !hasEnoughTopLevelQuestions && uncoveredAspects.length > 0) ||
        // At other levels, only generate more if we have uncovered aspects AND haven't hit the sibling limit
        (!isTopLevel && uncoveredAspects.length > 0 && !hasEnoughSiblingsForLevel);

      // Try to generate new siblings if needed
      if (shouldGenerateMoreSiblings) {
        const { nodes: newSiblings } = await fetchQuestionsForNode(
          prompt,
          parent,
          levelHistory,
          currentDepth,
          true,
          uncoveredAspects
        );
        
        if (newSiblings.length > 0) {
          newSiblings[0].questionNumber = questionCount + 1;
          parent.children = [...currentLevelNodes, ...newSiblings];
          return newSiblings[0];
        }
      }
      
      // <-- INSERTED CODE START: Ensure all L3 children from L2 parents are created before moving on to L4 -->
      // When the current depth is 3 or deeper, check all level-2 nodes (whose children would be level-3)
      // and generate any missing children.
      if (currentDepth >= 3) {
        const l2Nodes = getAllNodesAtDepth(qaTree!, 2);
        const incompleteL2 = l2Nodes.find(l2Node => {
          if (!l2Node.answer) return false;
          const expectedChildren = Math.min(3, extractAspectsFromAnswer(l2Node.answer).length);
          return l2Node.children.length < expectedChildren;
        });
        if (incompleteL2) {
          const nodeHistory = getAllAnsweredQuestions(incompleteL2);
          const { nodes: newChild } = await fetchQuestionsForNode(
            prompt,
            incompleteL2,
            nodeHistory,
            2, // generate a level 3 child (child of a level 2 node)
            true
          );
          if (newChild.length > 0) {
            newChild[0].questionNumber = questionCount + 1;
            incompleteL2.children = [...incompleteL2.children, ...newChild];
            return newChild[0];
          }
        }
      }
      // <-- INSERTED CODE END -->

      // If all current level questions are answered and we have enough coverage, try to go deeper
      if (allCurrentLevelAnswered && 
          (isTopLevel ? hasEnoughTopLevelQuestions : currentLevelNodes.length >= 2)) {
        
        // For BFS, we need to ensure all nodes at the current level across all branches have been explored
        // before going deeper
        const allNodesAtCurrentDepth = getAllNodesAtDepth(qaTree!, currentDepth);
        const allNodesAtCurrentDepthAnswered = allNodesAtCurrentDepth.every(n => n.answer);
        
        // Check if each node at current depth has enough children based on its aspects
        const allNodesHaveEnoughChildren = allNodesAtCurrentDepth.every(n => {
          if (!n.answer) return true; // Skip unanswered nodes
          const aspects = extractAspectsFromAnswer(n.answer);
          return n.children.length >= Math.min(3, aspects.length);
        });

        // Only proceed deeper if all nodes at current depth are properly explored
        if (allNodesAtCurrentDepthAnswered && allNodesHaveEnoughChildren) {
          // Find the first node at the current level that needs children
          const nextNodeNeedingChildren = allNodesAtCurrentDepth.find(n => 
            n.answer &&
            n.children.length < Math.min(3, extractAspectsFromAnswer(n.answer).length)
          );

          if (nextNodeNeedingChildren) {
            const nodeHistory = getAllAnsweredQuestions(nextNodeNeedingChildren);
            const { nodes: children } = await fetchQuestionsForNode(
              prompt,
              nextNodeNeedingChildren,
              nodeHistory,
              currentDepth + 1,
              true
            );
            
            if (children.length > 0) {
              children[0].questionNumber = questionCount + 1;
              nextNodeNeedingChildren.children = [...nextNodeNeedingChildren.children, ...children];
              return children[0];
            }
          }

          // If all nodes at current depth have enough children, explore the next depth
          const allChildrenAtNextDepth = allNodesAtCurrentDepth.flatMap(n => n.children);
          const unansweredChildAtNextDepth = allChildrenAtNextDepth.find(n => !n.answer);
          
          if (unansweredChildAtNextDepth) {
            return unansweredChildAtNextDepth;
          }
          
          // If all children are answered, find a node at next depth that needs more children
          const nextDepthNodeNeedingChildren = allChildrenAtNextDepth.find(n => 
            n.answer &&
            n.children.length < Math.min(3, extractAspectsFromAnswer(n.answer).length)
          );

          if (nextDepthNodeNeedingChildren) {
            const nodeHistory = getAllAnsweredQuestions(nextDepthNodeNeedingChildren);
            const { nodes: children } = await fetchQuestionsForNode(
              prompt,
              nextDepthNodeNeedingChildren,
              nodeHistory,
              currentDepth + 2,
              true
            );
            
            if (children.length > 0) {
              children[0].questionNumber = questionCount + 1;
              nextDepthNodeNeedingChildren.children = [...nextDepthNodeNeedingChildren.children, ...children];
              return children[0];
            }
          }
        } else {
          // If not all nodes are explored at current depth, return the next unanswered node
          const nextUnansweredNode = allNodesAtCurrentDepth.find(n => !n.answer);
          if (nextUnansweredNode) {
            return nextUnansweredNode;
          }

          // If all nodes are answered but some need more children, find the next one needing children
          const nextNodeNeedingChildren = allNodesAtCurrentDepth.find(n => 
            n.answer &&
            n.children.length < Math.min(3, extractAspectsFromAnswer(n.answer).length)
          );

          if (nextNodeNeedingChildren) {
            const nodeHistory = getAllAnsweredQuestions(nextNodeNeedingChildren);
            const { nodes: children } = await fetchQuestionsForNode(
              prompt,
              nextNodeNeedingChildren,
              nodeHistory,
              currentDepth + 1,
              true
            );
            
            if (children.length > 0) {
              children[0].questionNumber = questionCount + 1;
              nextNodeNeedingChildren.children = [...nextNodeNeedingChildren.children, ...children];
              return children[0];
            }
          }
        }
        
        // If we couldn't go deeper or find unexplored nodes, generate new Level 1 questions
        const rootHistory = getAllAnsweredQuestions(qaTree!);
        const { nodes: newTopLevel } = await fetchQuestionsForNode(
          prompt,
          qaTree!,
          rootHistory,
          1,
          true
        );
        
        if (newTopLevel.length > 0) {
          newTopLevel[0].questionNumber = questionCount + 1;
          qaTree!.children = [...qaTree!.children, ...newTopLevel];
          return newTopLevel[0];
        }
      }
    }
    
    // Fallback: try generating new Level 1 questions
    const rootHistory = getAllAnsweredQuestions(qaTree!);
    const { nodes: newTopLevel } = await fetchQuestionsForNode(
      prompt,
      qaTree!,
      rootHistory,
      1,
      true
    );
    
    if (newTopLevel.length > 0) {
      newTopLevel[0].questionNumber = questionCount + 1;
      qaTree!.children = [...qaTree!.children, ...newTopLevel];
      return newTopLevel[0];
    }
    
    return null; // This should never be reached in practice
  };

  // Helper: Get all answered questions from the tree
  const getAllAnsweredQuestions = (root: QANode): QuestionHistoryItem[] => {
    const history: QuestionHistoryItem[] = [];
    const traverse = (node: QANode) => {
      if (node.question !== `Prompt: ${prompt}` && node.answer) {
        history.push({
          question: node.question,
          answer: node.answer,
          topics: extractTopics(node.question)
        });
      }
      node.children.forEach(traverse);
    };
    traverse(root);
    return history;
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
  const fetchQuestionsForNode = async (
    designPrompt: string, 
    parentNode: QANode, 
    questionHistory: QuestionHistoryItem[], 
    depth: number, 
    setSuggestion: boolean = false,
    uncoveredAspects?: string[]
  ): Promise<{ nodes: QANode[], shouldStopBranch: boolean, stopReason: string, suggestedAnswer?: string }> => {
    try {
      console.log('Fetching questions with knowledge base:', settings?.knowledgeBase);
      
      // Get parent context for child questions
      const parentContext = parentNode.question !== `Prompt: ${designPrompt}` ? {
        parentQuestion: parentNode.question,
        parentAnswer: parentNode.answer,
        parentTopics: extractTopics(parentNode.question),
        uncoveredAspects // Add uncovered aspects to parent context
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
          includeSuggestions: setSuggestion,
          uncoveredAspects // Pass uncovered aspects to API
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
        console.log('Progress saved successfully');
      }
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const handleVersionRestore = (version: MockupVersion) => {
    if (window.confirm('Restoring this version will replace your current progress. Continue?')) {
      setQaTree(version.qaTree);
      setRequirementsDoc(version.requirementsDoc);
      
      const firstUnanswered = findFirstUnansweredChild(version.qaTree);
      setCurrentNode(firstUnanswered);
      
      let count = 0;
      const countAnswers = (node: QANode) => {
        if (node.answer) count++;
        node.children.forEach(countAnswers);
      };
      countAnswers(version.qaTree);
      setQuestionCount(count);
      
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
    if (hasFetchedInitialQuestion.current) return;
    hasFetchedInitialQuestion.current = true;

    const savedProgress = localStorage.getItem('qaProgress');
    const storedPrompt = localStorage.getItem('designPrompt');
    const storedSettings = localStorage.getItem('qaSettings');
    
    if (savedProgress) {
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
    
    if (storedPrompt && storedSettings) {
      const parsedSettings = JSON.parse(storedSettings);
      console.log('Starting new session with knowledge base:', parsedSettings.knowledgeBase);
      setPrompt(storedPrompt);
      setSettings(parsedSettings);
      
      const rootNode: QANode = {
        id: uuidv4(),
        question: `Prompt: ${storedPrompt}`,
        children: [],
        questionNumber: 0,
      };
      setQaTree(rootNode);
      
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
    
    if (settings.maxQuestions && questionCount >= settings.maxQuestions) {
      setCurrentNode(null);
      setIsLoadingNextQuestion(false);
      return;
    }
    
    try {
      currentNode.answer = answer;
      
      await updateRequirements(currentNode.id);
      
      const nextNode = await getNextQuestion(currentNode);
      
      if (nextNode) {
        if (!askedQuestions.has(nextNode.question)) {
          setAskedQuestions(prev => new Set(prev).add(nextNode.question));
          setIsInitialLoad(true);
          setCurrentNode(nextNode);
          setQuestionCount(prev => prev + 1);
          setQaTree(prev => prev ? { ...prev } : prev);
          setIsInitialLoad(false);
        } else {
          console.warn('Duplicate question detected:', nextNode.question);
          setCurrentNode(null);
        }
      } else {
        setCurrentNode(null);
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
      if (suggestedAnswer) {
        return suggestedAnswer.text;
      }
      
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
    setIsLoading(true);
    setIsLoadingNextQuestion(true);
    
    const rootNode: QANode = {
      id: uuidv4(),
      question: `Prompt: ${prompt}`,
      children: [],
      questionNumber: 0,
    };
    
    setQaTree(rootNode);
    setQuestionCount(0);
    setCurrentNode(null);
    setAskedQuestions(new Set());
    setAskedTopics(new Set());
    
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
    
    fetchQuestionsForNode(prompt, rootNode, [], 0, true).then(({ nodes: children }) => {
      if (children.length > 0) {
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
      await updateRequirements(currentNode?.id || null);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error('Error generating preview:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper: Extract aspects from an answer that need to be covered by child questions
  const extractAspectsFromAnswer = (answer: string): string[] => {
    const aspects: string[] = [];
    
    const sentences = answer.split(/[.!?]+/)
      .map(s => s.trim())
      .filter(Boolean);
    
    sentences.forEach(sentence => {
      if (sentence.includes(',') || /\band\b/.test(sentence)) {
        const items = sentence
          .split(/,|\band\b/)
          .map(item => item.trim().toLowerCase())
          .filter(Boolean)
          .filter(item => !['the', 'a', 'an', 'should', 'would', 'could', 'with'].includes(item));
        aspects.push(...items);
      } else {
        const cleanedSentence = sentence.toLowerCase()
          .replace(/should|would|could|must|with|the|a|an/g, '')
          .trim();
        if (cleanedSentence) {
          aspects.push(cleanedSentence);
        }
      }
    });
    
    const uniqueAspects = Array.from(new Set(aspects))
      .filter((aspect, index, self) => 
        !self.some((other, otherIndex) => 
          index !== otherIndex && 
          (other.includes(aspect) || aspect.includes(other))
        )
      );
    
    return uniqueAspects.length > 0 ? uniqueAspects : ['basic_requirements'];
  };

  // Helper: Get all nodes at a specific depth
  const getAllNodesAtDepth = (root: QANode, targetDepth: number): QANode[] => {
    const result: QANode[] = [];
    
    const traverse = (node: QANode, currentDepth: number) => {
      if (currentDepth === targetDepth) {
        result.push(node);
        return;
      }
      for (const child of node.children) {
        traverse(child, currentDepth + 1);
      }
    };
    
    traverse(root, 0);
    return result;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <HeaderToolbar 
        onRestart={handleRestart} 
        onGenerate={handleGenerate}
        onSave={() => handleSaveSession()}
        showRestartButton={!isLoading}
        showGenerateButton={!isLoading && qaTree !== null}
        showSaveButton={!isLoading && qaTree !== null}
      />
      <div className="py-2 px-6 bg-white border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Questions: {questionCount}{settings?.maxQuestions ?  ` / ${settings.maxQuestions}` : ''}
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