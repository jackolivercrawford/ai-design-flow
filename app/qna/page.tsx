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

interface SuggestedAnswer {
  text: string;
  confidence: 'high' | 'medium' | 'low';
  sourceReferences: number[];
}

export default function QnAPage() {
  const router = useRouter();
  const hasFetchedInitialQuestion = useRef(false);
  const [isAutomating, setIsAutomating] = useState(false);
  const automationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [settings, setSettings] = useState<QASettings | null>(null);
  const [qaTree, setQaTree] = useState<QANode | null>(null);
  const [currentNode, setCurrentNode] = useState<QANode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [suggestedAnswer, setSuggestedAnswer] = useState<SuggestedAnswer | null>(null);
  const [requirementsDoc, setRequirementsDoc] = useState<RequirementsDocument | null>(null);
  const [askedQuestions, setAskedQuestions] = useState<Set<string>>(new Set());
  const [askedTopics, setAskedTopics] = useState<Set<string>>(new Set());
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessionMetadata, setSessionMetadata] = useState<SessionMetadata | null>(null);
  const [isLeavingPage, setIsLeavingPage] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // -------------------- Helpers --------------------

  // Extract topics from a question.
  const extractTopics = (question: string): string[] => {
    const topics: string[] = [];
    if (
      question.toLowerCase().includes('audience') ||
      question.toLowerCase().includes('user') ||
      question.toLowerCase().includes('visitor')
    ) {
      topics.push('audience');
    }
    if (
      question.toLowerCase().includes('purpose') ||
      question.toLowerCase().includes('goal')
    ) {
      topics.push('purpose');
    }
    return topics;
  };

  // Get the depth of a node in the tree.
  const getNodeDepth = (node: QANode): number => {
    let depth = 0;
    let current = node;
    while (findParentNode(qaTree, current)) {
      depth++;
      current = findParentNode(qaTree, current)!;
    }
    return depth;
  };

  // Get all answered questions from the tree.
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

  // Find the parent of a given node.
  const findParentNode = (root: QANode | null, target: QANode): QANode | null => {
    if (!root) return null;
    if (root.children.includes(target)) return root;
    for (const child of root.children) {
      const found = findParentNode(child, target);
      if (found) return found;
    }
    return null;
  };

  // -------------------- DFS Ordering with Automation --------------------

  // getNextQuestion follows DFS:
  // – If the current node is not at max depth (less than 5), it attempts to generate a child.
  // – When at depth 5 (or if no child candidate is available), it forces generation of 1–2 sibling candidates at the parent level.
  // – It then returns the next candidate; if none exists at that level, it recursively backtracks.
  // The suggested answer from the candidate is saved so that the UI displays the answer corresponding to the shown question.
  const getNextQuestion = async (node: QANode): Promise<QANode | null> => {
    // If automation has been stopped, exit early.
    if (!isAutomating) {
      console.log('Automation stopped, not generating next question');
      return null;
    }

    const isDFS = settings?.traversalMode === 'dfs';
    if (isDFS) {
      if (node.answer) {
        // Build branch history and calculate depth.
        const branchHistory: QuestionHistoryItem[] = [];
        let current: QANode | null = node;
        let depth = 0;
        while (current) {
          if (current.question !== `Prompt: ${prompt}`) {
            branchHistory.unshift({
              question: current.question,
              answer: current.answer,
              topics: extractTopics(current.question)
            });
            depth++;
          }
          const parent = findParentNode(qaTree, current);
          if (!parent || parent === current) break;
          current = parent;
        }
    
        // ----- DFS DEPTH CAP: Limit depth to 5 -----
        if (depth >= 5) {
          // At depth 5, backtrack incrementally.
          let temp: QANode | null = node;
          while (temp) {
            const parent = findParentNode(qaTree, temp);
            if (!parent) break;
            // Force-generate new candidate siblings for the parent's children.
            const parentHistory = getAllAnsweredQuestions(parent);
            const { nodes: generatedSiblings } = await fetchQuestionsForNode(
              prompt,
              parent,
              parentHistory,
              getNodeDepth(parent),
              true
            );
            // Append only new candidates (if not already present).
            if (generatedSiblings.length > 0) {
              parent.children = [
                ...parent.children,
                ...generatedSiblings.filter(s => !parent.children.some(ex => ex.id === s.id))
              ];
            }
            const siblings = parent.children;
            if (parent && temp) {
              const index = siblings.findIndex(n => temp?.id && n.id === temp.id);
              if (index >= 0 && index < siblings.length - 1) {
                return siblings[index + 1];
              }
              temp = parent;
            }
          }
          // If backtracking yields nothing, force generate new Level 1 questions.
          const rootHistory = getAllAnsweredQuestions(qaTree!);
          const { nodes: newTopLevel, suggestedAnswer } = await fetchQuestionsForNode(
            prompt,
            qaTree!,
            rootHistory,
            1,
            true
          );
          if (newTopLevel.length > 0) {
            newTopLevel[0].questionNumber = questionCount + 1;
            qaTree!.children = newTopLevel;
            setSuggestedAnswer(suggestedAnswer ? { text: suggestedAnswer, confidence: 'medium', sourceReferences: [] } : null);
            return newTopLevel[0];
          }
          return null;
        }
        // ----- End DFS DEPTH CAP -----
    
        // If depth is less than 5, force a deeper dive.
        const { nodes: children, shouldStopBranch, suggestedAnswer } = await fetchQuestionsForNode(
          prompt,
          node,
          branchHistory,
          depth,
          true
        );
        if (children.length > 0 && (!shouldStopBranch || depth < 5)) {
          const child = children[0];
          // Append the candidate if not already present.
          if (!node.children.find(c => c.id === child.id)) {
            node.children.push(child);
          }
          child.questionNumber = questionCount + 1;
          setSuggestedAnswer(
            suggestedAnswer
              ? { text: suggestedAnswer, confidence: 'medium', sourceReferences: [] }
              : null
          );
          return child;
        }
    
        // If no child candidate was generated (or we're at depth 5),
        // backtrack by forcing generation of sibling candidates at the parent's level.
        const parentNode = findParentNode(qaTree, node);
        if (parentNode) {
          const parentHistory = getAllAnsweredQuestions(parentNode);
          const { nodes: newSiblings } = await fetchQuestionsForNode(
            prompt,
            parentNode,
            parentHistory,
            getNodeDepth(parentNode),
            true
          );
          if (newSiblings.length > 0) {
            // Append new candidates that are not already present.
            parentNode.children = [
              ...parentNode.children,
              ...newSiblings.filter(s => !parentNode.children.find(ex => ex.id === s.id))
            ];
            const index = parentNode.children.findIndex(n => n.id === node.id);
            if (index >= 0 && index < parentNode.children.length - 1) {
              return parentNode.children[index + 1];
            } else if (parentNode.children.length > 0) {
              return parentNode.children[0];
            }
          }
          // As a fallback, recursively try generating a candidate from the parent.
          return await getNextQuestion(parentNode);
        }
    
        // Fallback: Generate new Level 1 questions.
        const rootHistory2 = getAllAnsweredQuestions(qaTree!);
        const { nodes: newTopLevel, suggestedAnswer: fallbackAnswer } = await fetchQuestionsForNode(
          prompt,
          qaTree!,
          rootHistory2,
          1,
          true
        );
        if (newTopLevel.length > 0) {
          newTopLevel[0].questionNumber = questionCount + 1;
          qaTree!.children = newTopLevel;
          setSuggestedAnswer(
            fallbackAnswer
              ? { text: fallbackAnswer, confidence: 'medium', sourceReferences: [] }
              : null
          );
          return newTopLevel[0];
        }
        return null;
      }
      // Fallback for DFS if node.answer is falsy.
      const rootHistory = getAllAnsweredQuestions(qaTree!);
      const { nodes: newTopLevel, suggestedAnswer: fallbackAnswer } = await fetchQuestionsForNode(
        prompt,
        qaTree!,
        rootHistory,
        1,
        true
      );
      if (newTopLevel.length > 0) {
        newTopLevel[0].questionNumber = questionCount + 1;
        qaTree!.children = newTopLevel;
        setSuggestedAnswer(
          fallbackAnswer
            ? { text: fallbackAnswer, confidence: 'medium', sourceReferences: [] }
            : null
        );
        return newTopLevel[0];
      }
      return null;
    } else {
      // BFS mode remains unchanged.
      const parent = findParentNode(qaTree, node);
      if (!parent) {
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
      const currentLevelNodes = parent.children;
      const currentIndex = currentLevelNodes.indexOf(node);
      const currentDepth = getNodeDepth(node);
      const parentAspects = parent.answer ? extractAspectsFromAnswer(parent.answer) : ['basic_requirements'];
      const coveredAspects = new Set(
        currentLevelNodes
          .filter(n => n.answer)
          .map(n => {
            const topics = extractTopics(n.question);
            return topics.filter(topic =>
              parentAspects.some(aspect =>
                topic.includes(aspect) || aspect.includes(topic)
              )
            );
          })
          .flat()
      );
      if (currentDepth === 2) {
        const currentLevel1Node = findParentNode(qaTree, node);
        const hasEnoughChildren = currentLevel1Node &&
          currentLevel1Node.children.length >= Math.min(3, extractAspectsFromAnswer(currentLevel1Node.answer || '').length);
        if (hasEnoughChildren) {
          const level1Nodes = qaTree!.children;
          const nextLevel1WithoutChildren = level1Nodes.find(l1Node =>
            l1Node !== currentLevel1Node &&
            l1Node.answer &&
            l1Node.children.length < Math.min(3, extractAspectsFromAnswer(l1Node.answer).length)
          );
          if (nextLevel1WithoutChildren) {
            const nodeHistory = getAllAnsweredQuestions(nextLevel1WithoutChildren);
            const { nodes: newChildren } = await fetchQuestionsForNode(
              prompt,
              nextLevel1WithoutChildren,
              nodeHistory,
              2,
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
      const levelHistory: QuestionHistoryItem[] = currentLevelNodes
        .filter(n => n.answer)
        .map(n => ({
          question: n.question,
          answer: n.answer,
          topics: extractTopics(n.question)
        }));
      if (currentIndex < currentLevelNodes.length - 1) {
        return currentLevelNodes[currentIndex + 1];
      }
      const isTopLevel = currentDepth === 1;
      const uncoveredAspects = parentAspects.filter(aspect => !coveredAspects.has(aspect));
      const hasEnoughTopLevelQuestions = isTopLevel && currentLevelNodes.length >= 4;
      const hasEnoughSiblingsForLevel = !isTopLevel && currentLevelNodes.length >= 3;
      const shouldGenerateMoreSiblings =
        (isTopLevel && !hasEnoughTopLevelQuestions && uncoveredAspects.length > 0) ||
        (!isTopLevel && uncoveredAspects.length > 0 && !hasEnoughSiblingsForLevel);
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
            2,
            true
          );
          if (newChild.length > 0) {
            newChild[0].questionNumber = questionCount + 1;
            incompleteL2.children = [...incompleteL2.children, ...newChild];
            return newChild[0];
          }
        }
      }
      const allCurrentLevelNodes = getAllNodesAtDepth(qaTree!, currentDepth);
      const allCurrentLevelAnswered = allCurrentLevelNodes.every(n => n.answer);
      if (allCurrentLevelAnswered) {
        const allNodesHaveEnoughChildren = allCurrentLevelNodes.every(n => {
          if (!n.answer) return true;
          const aspects = extractAspectsFromAnswer(n.answer);
          return n.children.length >= Math.min(3, aspects.length);
        });
        if (allNodesHaveEnoughChildren) {
          const nextNodeNeedingChildren = allCurrentLevelNodes.find(n =>
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
          const allChildrenAtNextDepth = allCurrentLevelNodes.flatMap(n => n.children);
          const unansweredChildAtNextDepth = allChildrenAtNextDepth.find(n => !n.answer);
          if (unansweredChildAtNextDepth) {
            return unansweredChildAtNextDepth;
          }
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
          const nextUnansweredNode = allCurrentLevelNodes.find(n => !n.answer);
          if (nextUnansweredNode) {
            return nextUnansweredNode;
          }
          const nextNodeNeedingChildren = allCurrentLevelNodes.find(n =>
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
    
    // Fallback: Generate new Level 1 questions.
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
  };

  // -------------------- Additional Helpers --------------------

  // Find all nodes at the same level as the target.
  const findNodesAtSameLevel = (root: QANode | null, target: QANode): QANode[] => {
    if (!root) return [];
    const parent = findParentNode(root, target);
    if (!parent) return root.children;
    return parent.children;
  };

  // Find the first unanswered child (BFS).
  const findFirstUnansweredChild = (root: QANode | null): QANode | null => {
    if (!root) return null;
    const queue: QANode[] = [root];
    while (queue.length > 0) {
      const node = queue.shift()!;
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

  // Find the first node that can have children (has an answer but no children).
  const findFirstNodeForChildren = (root: QANode | null): QANode | null => {
    if (!root) return null;
    const queue: QANode[] = [root];
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (node.answer && node.children.length === 0 && node.question !== `Prompt: ${prompt}`) {
        return node;
      }
      queue.push(...node.children);
    }
    return null;
  };

  // Fetch questions for a given node.
  const fetchQuestionsForNode = async (
    designPrompt: string,
    parentNode: QANode,
    questionHistory: QuestionHistoryItem[],
    depth: number,
    setSuggestion: boolean = false,
    uncoveredAspects?: string[]
  ): Promise<{ nodes: QANode[]; shouldStopBranch: boolean; stopReason: string; suggestedAnswer?: string }> => {
    try {
      console.log('Fetching questions with knowledge base:', settings?.knowledgeBase);
      const parentContext =
        parentNode.question !== `Prompt: ${designPrompt}`
          ? {
              parentQuestion: parentNode.question,
              parentAnswer: parentNode.answer,
              parentTopics: extractTopics(parentNode.question),
              uncoveredAspects,
            }
          : null;
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
          uncoveredAspects,
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
      if (setSuggestion) {
        if (data.suggestedAnswer) {
          console.log('Setting suggested answer:', {
            text: data.suggestedAnswer,
            confidence: data.confidence || 'low',
            sourceReferences: data.sourceReferences || [],
          });
          setSuggestedAnswer(
            data.suggestedAnswer
              ? { text: data.suggestedAnswer, confidence: data.confidence || 'low', sourceReferences: data.sourceReferences || [] }
              : null
          );
        } else {
          console.log('Clearing suggested answer');
          setSuggestedAnswer(null);
        }
      }
      const nextQuestionNumber = questionCount + 1;
      const nodes: QANode[] = data.questions.map((q: string) => ({
        id: uuidv4(),
        question: q,
        children: [],
        questionNumber: nextQuestionNumber,
      }));
      return {
        nodes,
        shouldStopBranch: data.shouldStopBranch || false,
        stopReason: data.stopReason || 'No more questions needed',
        suggestedAnswer: data.suggestedAnswer,
      };
    } catch (error) {
      console.error("Error in fetchQuestionsForNode:", error);
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
        suggestedAnswer: undefined,
      };
    }
  };

  // Find node by ID.
  const findNodeById = (root: QANode | null, id: string): QANode | null => {
    if (!root) return null;
    if (root.id === id) return root;
    for (const child of root.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
    return null;
  };

  // Update requirements document.
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
          existingDocument: requirementsDoc,
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
      saveProgress();
    } catch (error) {
      console.error('Error updating requirements:', error);
    }
  };

  // -------------------- Automation Functions --------------------

  const startAutomation = () => {
    console.log('startAutomation called - Setting isAutomating to true');
    if (automationTimeoutRef.current) {
      clearTimeout(automationTimeoutRef.current);
      automationTimeoutRef.current = null;
    }
    setIsAutomating(true);
  };

  const stopAutomation = () => {
    console.log('stopAutomation called - Setting isAutomating to false');
    setIsAutomating(false);
    if (automationTimeoutRef.current) {
      console.log('Clearing automation timeout');
      clearTimeout(automationTimeoutRef.current);
      automationTimeoutRef.current = null;
    }
  };

  const runNextAutomatedStep = async () => {
    console.log('runNextAutomatedStep called', {
      isAutomating,
      hasCurrentNode: !!currentNode,
      isLoadingNextQuestion,
    });

    if (!isAutomating || !currentNode) {
      console.log('Stopping automation - conditions not met:', {
        isAutomating,
        hasCurrentNode: !!currentNode,
      });
      stopAutomation();
      return;
    }

    try {
      console.log('Getting suggested answer');
      const autoAnswer = await handleAutoPopulate();

      if (autoAnswer && isAutomating) {
        console.log('Got suggested answer, submitting after delay');
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (isAutomating) {
          await handleAnswer(autoAnswer);
        } else {
          console.log('Automation stopped during delay, skipping answer submission');
        }
      } else {
        console.log('No suggested answer available or automation stopped, stopping automation');
        stopAutomation();
      }
    } catch (error) {
      console.error('Error in automation step:', error);
      stopAutomation();
    }
  };

  useEffect(() => {
    console.log('Automation effect triggered', {
      isAutomating,
      isLoadingNextQuestion,
      hasCurrentNode: !!currentNode,
    });

    if (!isAutomating) {
      if (automationTimeoutRef.current) {
        clearTimeout(automationTimeoutRef.current);
        automationTimeoutRef.current = null;
      }
      return;
    }

    if (!currentNode) {
      stopAutomation();
      return;
    }

    if (isLoadingNextQuestion) {
      return;
    }

    let isEffectActive = true;
    (async () => {
      try {
        if (isEffectActive && isAutomating) {
          await runNextAutomatedStep();
        }
      } catch (error) {
        console.error('Error in automation effect:', error);
        stopAutomation();
      }
    })();

    return () => {
      isEffectActive = false;
      if (automationTimeoutRef.current) {
        clearTimeout(automationTimeoutRef.current);
        automationTimeoutRef.current = null;
      }
    };
  }, [isAutomating, isLoadingNextQuestion, currentNode]);

  // -------------------- Save, Restart, and Version Functions --------------------

  const saveProgress = (isAutoSave = false) => {
    if (!qaTree || !settings || !requirementsDoc) return;
    try {
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
          conflictResolution: settings.conflictResolution,
        },
        name: sessionMetadata?.name,
      };
      localStorage.setItem(
        'qaProgress',
        JSON.stringify({
          qaTree,
          currentNodeId: currentNode?.id || null,
          questionCount,
          prompt,
          settings,
          requirementsDoc,
        })
      );
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
        lastUpdated: new Date().toISOString(),
      };
      setSessionMetadata(updatedMetadata);
      localStorage.setItem('sessionMetadata', JSON.stringify(updatedMetadata));
      saveProgress();
    }
  };

  // -------------------- On Mount: Load or Start a New Session --------------------

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
          constraints: { title: 'Constraints', requirements: [] },
        },
      };
      setRequirementsDoc(initialRequirementsDoc);
      fetchQuestionsForNode(storedPrompt, rootNode, [], 0, false).then(({ nodes: children, suggestedAnswer }) => {
        if (children.length > 0) {
          children[0].questionNumber = 1;
          rootNode.children = children;
          setQaTree({ ...rootNode });
          setCurrentNode(children[0]);
          if (suggestedAnswer) {
            setSuggestedAnswer(
              suggestedAnswer ? { text: suggestedAnswer, confidence: 'medium', sourceReferences: [] } : null
            );
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

  // -------------------- Handle Answer Submission --------------------

  const handleAnswer = async (answer: string) => {
    console.log('handleAnswer called', { hasCurrentNode: !!currentNode, hasSettings: !!settings });
    if (!currentNode || !settings) return;
    setIsLoadingNextQuestion(true);
    setSuggestedAnswer(null);
    if (settings.maxQuestions && questionCount >= settings.maxQuestions) {
      console.log('Max questions reached, stopping automation');
      setCurrentNode(null);
      setIsLoadingNextQuestion(false);
      stopAutomation();
      return;
    }
    try {
      console.log('Setting answer and updating requirements');
      currentNode.answer = answer;
      await updateRequirements(currentNode.id);
      if (isAutomating) {
        console.log('Getting next question (automation active)');
        const nextNode = await getNextQuestion(currentNode);
        if (nextNode) {
          if (!askedQuestions.has(nextNode.question)) {
            console.log('Setting new question');
            setAskedQuestions(prev => new Set(prev).add(nextNode.question));
            setIsInitialLoad(true);
            setCurrentNode(nextNode);
            setQuestionCount(prev => prev + 1);
            setQaTree(prev => prev ? { ...prev } : prev);
            setIsInitialLoad(false);
            if (isAutomating) {
              if (automationTimeoutRef.current) {
                clearTimeout(automationTimeoutRef.current);
              }
              automationTimeoutRef.current = setTimeout(runNextAutomatedStep, 1000);
            } else {
              console.log('Automation stopped during question generation');
            }
          } else {
            console.warn('Duplicate question detected:', nextNode.question);
            setCurrentNode(null);
            stopAutomation();
          }
        } else {
          console.log('No next question available');
          setCurrentNode(null);
          await updateRequirements(null);
          stopAutomation();
        }
      } else {
        console.log('Answer saved, automation not active - keeping current node');
        setQaTree(prev => prev ? { ...prev } : prev);
      }
    } catch (error) {
      console.error('Error in handleAnswer:', error);
      stopAutomation();
    } finally {
      setIsLoadingNextQuestion(false);
    }
  };

  // -------------------- Auto-Populate Suggested Answer --------------------

  const handleAutoPopulate = async (): Promise<string | null> => {
    console.log('handleAutoPopulate called');
    try {
      if (suggestedAnswer) {
        console.log('Using existing suggested answer');
        return suggestedAnswer.text;
      }
      console.log('Building question history');
      const questionHistory: QuestionHistoryItem[] = [];
      const collectHistory = (n: QANode) => {
        if (n.question !== `Prompt: ${prompt}`) {
          questionHistory.push({
            question: n.question,
            answer: n.answer,
            topics: extractTopics(n.question),
          });
        }
        n.children.forEach(collectHistory);
      };
      collectHistory(qaTree!);
      console.log('Fetching suggested answer from API');
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          previousQuestions: questionHistory,
          traversalMode: settings?.traversalMode,
          knowledgeBase: settings?.knowledgeBase,
          currentQuestion: currentNode?.question,
          isAutoPopulate: true,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to generate answer');
      }
      const data = await response.json();
      console.log('Auto-populate API response:', data);
      if (data.suggestedAnswer) {
        console.log('Returning suggested answer from API');
        return data.suggestedAnswer;
      }
      console.log('No suggested answer in API response');
      return null;
    } catch (error) {
      console.error('Error auto-populating answer:', error);
      return null;
    }
  };

  // -------------------- Restart and Generate Handlers --------------------

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
        basicNeeds: { title: 'Basic Needs', requirements: [] },
        functionalRequirements: { title: 'Functional Requirements', requirements: [] },
        userExperience: { title: 'User Experience', requirements: [] },
        implementation: { title: 'Implementation', requirements: [] },
        refinements: { title: 'Refinements', requirements: [] },
        constraints: { title: 'Constraints', requirements: [] },
      },
    };
    setRequirementsDoc(initialRequirementsDoc);
    fetchQuestionsForNode(prompt, rootNode, [], 0, true)
      .then(({ nodes: children }) => {
        if (children.length > 0) {
          children[0].questionNumber = 1;
          rootNode.children = children;
          setQaTree({ ...rootNode });
          setCurrentNode(children[0]);
          setQuestionCount(1);
        }
      })
      .catch((error) => {
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
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Error generating preview:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // -------------------- Extract Aspects from Answer --------------------

  const extractAspectsFromAnswer = (answer: string): string[] => {
    const aspects: string[] = [];
    const sentences = answer.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    sentences.forEach((sentence) => {
      if (sentence.includes(',') || /\band\b/.test(sentence)) {
        const items = sentence
          .split(/,|\band\b/)
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
          .filter((item) => !['the', 'a', 'an', 'should', 'would', 'could', 'with'].includes(item));
        aspects.push(...items);
      } else {
        const cleanedSentence = sentence
          .toLowerCase()
          .replace(/should|would|could|must|with|the|a|an/g, '')
          .trim();
        if (cleanedSentence) {
          aspects.push(cleanedSentence);
        }
      }
    });
    const uniqueAspects = Array.from(new Set(aspects)).filter((aspect, index, self) =>
      !self.some((other, otherIndex) => index !== otherIndex && (other.includes(aspect) || aspect.includes(other)))
    );
    return uniqueAspects.length > 0 ? uniqueAspects : ['basic_requirements'];
  };

  // -------------------- Get All Nodes at a Specific Depth --------------------

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

  // -------------------- Render --------------------
  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <HeaderToolbar
        onRestart={handleRestart}
        onGenerate={handleGenerate}
        onSave={() => handleSaveSession()}
        showRestartButton={!isLoading}
        showGenerateButton={!isLoading && qaTree !== null}
        showSaveButton={!isLoading && qaTree !== null}
        isAutomating={isAutomating}
        onStartAutomation={startAutomation}
        onStopAutomation={stopAutomation}
      />
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
            currentQuestion={currentNode ? currentNode.question : "No more questions. Q&A complete."}
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
