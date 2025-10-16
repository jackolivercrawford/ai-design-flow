// /app/api/generate-questions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { KnowledgeBaseSource } from '@/types/settings';

// A helper to extract subtopics from a parent's answer (basic version).
function extractSubtopicsFromAnswer(answer: string): string[] {
  // Very simple approach: split on punctuation, remove short fragments
  const lines = answer
    .split(/[.!?]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const subtopics: string[] = [];
  for (const line of lines) {
    // Optionally also split on commas or 'and' for more granular sub-points
    const miniPoints = line.split(/,\s*|\sand\s+/).map((p) => p.trim());
    miniPoints.forEach((p) => {
      // Filter out very short or duplicate segments
      if (p.length > 3 && !subtopics.includes(p.toLowerCase())) {
        subtopics.push(p.toLowerCase());
      }
    });
  }
  return subtopics;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * BFS_RULES and DFS_RULES are appended conditionally inside the system prompt.
 * The CRITICAL_RELEVANCE_RULE ensures that child questions quote the parent’s answer.
 */

// BFS instructions
const BFS_RULES = `
BFS Guidelines:
          - CRITICAL: At Level 1 (top level), generate exactly 4-5 comprehensive questions that cover the main aspects.
          - For Level 2+, generate exactly 2-3 questions per parent aspect from the parent's answer.
          - Each sibling at the same level MUST focus on a different aspect from the parent's answer.
          - CRITICAL: ALL Level 2 children of ALL Level 1 questions must be generated before ANY Level 3 questions.
          - Example progression:
            Parent Q1: "What are the core user flows and functional requirements?"
            Parent A1: "The interface should offer search, filtering, and zoom levels..."
            Valid Child Q5: "What specific search capabilities should be implemented?"
            Valid Child Q6: "What filtering options should be available to users?"
            Valid Child Q7: "How should the zoom level functionality work?"
      
          Level Structure and Progression:
          - Level 1 (exactly 4-5 questions): Core requirements and fundamental aspects.
            Example: "What are the core user flows?", "What accessibility features are needed?"
      
          - Level 2 (exactly 2-3 questions per parent aspect): Direct exploration of parent aspects.
            Example: If Level 1 answer mentions "search, filtering, and zoom":
            * Q5-Q7 explores search aspects.
            * Q8-Q10 explores filtering aspects.
            * Q11-Q13 explores zoom aspects.
            CRITICAL: Generate Level 2 questions for ALL Level 1 answers before moving to Level 3.
      
          - Level 3+ (exactly 2-3 questions per parent aspect): Implementation details.
            Example: If Level 2 answer about search mentions "real-time search and filters":
            * "How should real-time search results be displayed?"
            * "What search result filtering options are needed?"
            * "What performance requirements for search response time?"
      
          Aspect Coverage Rules:
          1. Each child question MUST:
             * Directly reference a specific aspect from parent's answer using exact terminology.
             * Maintain clear topic lineage from Level 1 through current level.
             * Ask for more specific details about that aspect.
      
          2. Sibling questions MUST:
             * Each focus on a different aspect from parent's answer.
             * Not overlap in their focus areas.
             * Together cover all major aspects mentioned in parent's answer.
             * Stay at the same depth level as each other.
      
          3. Moving Deeper Rules:
             * NEVER generate Level 3 questions until ALL Level 2 questions for ALL Level 1 parents are complete.
             * Each deeper question must make the parent aspect more specific.
             * Maintain clear topic lineage by referencing both direct parent and Level 1 ancestor.
      
          Cycling Behavior:
          1. When a branch is fully explored:
             * First complete all siblings at current level.
             * Only move deeper when ALL nodes at current level across ALL branches are complete.
             * If all branches are explored, return to Level 1 with new aspects.
      
          2. When generating new Level 1 questions after a cycle:
             * Must cover completely different aspects than ALL previous Level 1 questions.
             * Should maintain the same level of importance as original Level 1 questions.
      
          Progression Rules:
          1. After getting exactly 4-5 Level 1 questions answered:
             * Generate Level 2 questions for EACH answered Level 1 question.
             * Only add new Level 1 questions if starting a new cycle.
      
          2. When to move deeper:
             * ALL questions at current level are answered.
             * EACH parent has exactly 2-3 child questions.
             * ALL aspects from ALL parent answers are covered.
      
          3. When to stay at current level:
             * ANY aspects from ANY parent answer are still unexplored.
             * ANY parent has fewer than 2 child questions.
   * ANY questions at current level are unanswered.
`;

// DFS instructions
const DFS_RULES = `
DFS Guidelines:
          - CRITICAL: In DFS mode, fully explore ONE topic branch before moving to siblings.
          - Maximum depth is 5 levels, but can be less if topics are fully explored.
          - When all branches are exhausted, return to Level 1 with new aspects.
      
          Sibling Count Guidelines:
          - Level 1: Exactly 4-5 main topic questions.
          - Level 2-5: Exactly 2-3 questions per parent aspect.
      
          Example proper DFS progression:
          Q1: "What are the core navigation features needed?"
          Parent A1: "Need a main menu, search bar, and user profile section."
      
          First Branch (Main Menu) - Complete this ENTIRE branch before siblings:
          Q2: "What specific items should be in the main menu?"
          A2: "Home, Products, Categories, Cart, and User Profile links."
          Q3: "How should the menu items be organized?"
          A3: "Primary items visible, secondary in dropdown."
          Q4: "What interactions should menu items have?"
          A4: "Hover previews and dropdown menus."
          [MUST complete ALL menu questions before moving to search]
      
          Second Branch (Search) - Only start after menu is complete:
          Q5: "What search functionality is required?"
          A5: "Real-time search with filters and suggestions."
          Q6: "How should search results be displayed?"
          A6: "Grid layout with quick preview cards."
          Q7: "What advanced search options are needed?"
          A7: "Category filters and price range selectors."
          [MUST complete ALL search questions before user profile]
      
          Third Branch (User Profile) - Only start after search is complete:
          Q8: "What user profile information should be shown?"
          Q9: "What profile customization options are needed?"
      
          Topic Exploration Rules:
          1. Each branch MUST:
             * Start with broad feature questions.
             * Progress to specific implementation details.
             * End with edge cases and optimizations.
             * Maintain clear topic lineage throughout.
      
          2. Question Depth Requirements:
             * Level 1: Broad feature questions (exactly 4-5)
             * Level 2: Feature breakdown (exactly 2-3 per feature)
             * Level 3: Technical implementation details (exactly 2-3 per Level 2 answer)
             * Level 4: Edge cases (exactly 2-3 per Level 3 answer)
             * Level 5: Optimizations (exactly 2-3 per Level 4 answer)
      
          Branch Completion Rules:
          1. A branch is ONLY complete when:
             - ALL aspects of the current topic are fully explored.
             - Questions have reached implementation-level detail.
             - Edge cases and optimizations are addressed.
             - Reached maximum depth (5 levels) OR
             - ALL possible questions about the topic are answered.
      
          2. When to stop current branch (shouldStopBranch=true):
             - Reached maximum depth (5 levels) OR
             - ALL aspects from parent's answer are fully explored AND
             - Questions would become too specific to be useful OR
             - Current topic is fully defined with implementation details.
      
          3. When to move to siblings:
             - ONLY after current branch is FULLY explored.
             - When shouldStopBranch=true is returned AND
             - No more meaningful child questions can be generated.
             - NEVER move to siblings until current topic is complete.
      
          4. Question Depth Progression:
             Level 1: High-level feature questions (exactly 4-5).
             Level 2: Specific requirements (exactly 2-3 per parent).
             Level 3: Technical implementation details (exactly 2-3 per parent).
             Level 4: Edge case handling (exactly 2-3 per parent).
             Level 5: Performance optimization (exactly 2-3 per parent).
      
          Topic Lineage Rules:
          1. Each question MUST:
             * Directly reference its parent topic.
             * Use exact terminology from parent's answer.
             * Maintain clear connection to Level 1 ancestor.
             * Progress logically deeper into the topic.
      
          2. Moving Between Siblings:
             * NEVER move to a sibling until current branch is complete.
             * Each sibling must explore a different main topic.
             * Siblings must be at the same depth level.
             * Complete ALL aspects of current topic before moving.
      
          3. Starting New Level 1 Questions:
             * Only after ALL current Level 1 branches are complete.
             * Must cover completely different aspects than ALL previous Level 1 questions.
             * Maintain same level of importance as original Level 1s.
      
          Question Generation Rules:
          1. Each new question MUST:
             * Be more specific than its parent.
             * Focus on unexplored aspects of parent's answer.
             * Maintain clear topic focus.
             * Progress logically deeper into implementation.
      
          2. Depth Requirements:
             * Level 1: Core feature identification.
             * Level 2: Feature requirement specification.
             * Level 3: Technical implementation details.
             * Level 4: Edge case handling.
             * Level 5: Performance optimization.
      
          3. When generating questions:
             * Use exact terminology from parent's answer.
             * Focus on one specific aspect at a time.
             * Ensure logical progression of detail.
   * Maintain clear topic boundaries.
`;

// Shared CRITICAL RELEVANCE RULE - applies to both BFS & DFS:
const CRITICAL_RELEVANCE_RULE = `
CRITICAL RELEVANCE RULE:
1. The new question MUST explicitly quote at least one exact phrase from the parent's answer in quotes 
   (e.g., "voice-activated controls" or "categorized floor directory").
2. The new question MUST demand deeper detail or specific implementation guidelines for that phrase.
3. If the parent’s answer already covers that phrase fully, the new question must explore edge cases, advanced features, or constraints related to it.
4. The new question must NOT be fully answerable by the parent's answer alone; it must prompt for additional clarifications or deeper specifics.
5. Failure to quote the parent's exact phrase is not permitted for the new child question.
6. The new question MUST explicitly reference both the parent's question and its answer (for example, by quoting key parts of each).
7. Use the parent's question and answer as anchors to drive the follow-up inquiry.
`;

export async function POST(request: NextRequest) {
  try {
    const {
      prompt,
      previousQuestions,
      traversalMode,
      knowledgeBase,
      isAutoPopulate,
      currentQuestion,
      depth,
      parentContext,
    } = await request.json();
    // console.log('API received knowledge base:', knowledgeBase);

    // Calculate current depth by counting parents in previousQuestions
    let currentDepth = 0;
    let currentParent = previousQuestions[previousQuestions.length - 1];
    while (currentParent?.parent) {
      currentDepth++;
      currentParent = currentParent.parent;
    }

    // Format knowledge base content for the prompt
    const knowledgeBaseContext = knowledgeBase?.length
      ? `The following information is available from multiple knowledge base sources:

${knowledgeBase
  .map(
    (source: KnowledgeBaseSource, index: number) => `
Source ${index + 1} (${source.type === 'file' ? 'File' : 'Text'}: ${source.name}):
Requirements: ${JSON.stringify(source.processedContent?.requirements || [])}
Technical Specs: ${JSON.stringify(source.processedContent?.technicalSpecifications || [])}
Design Guidelines: ${JSON.stringify(source.processedContent?.designGuidelines || [])}
User Preferences: ${JSON.stringify(source.processedContent?.userPreferences || [])}
Industry Standards: ${JSON.stringify(source.processedContent?.industryStandards || [])}
`
  )
  .join('\n')}

Use this information to:
- Auto-populate answers when confident (especially when multiple sources agree)
- Guide question generation based on available information
- Identify gaps that need to be filled
- Validate answers against known constraints
- Highlight any conflicts between different sources`
      : 'No knowledge base provided.';

    // console.log('Formatted knowledge base context:', knowledgeBaseContext);

    // If we have a parent answer, extract subtopics
    let parentAnswerSubtopics: string[] = [];
    if (
      parentContext &&
      parentContext.parentAnswer &&
      typeof parentContext.parentAnswer === 'string'
    ) {
      parentAnswerSubtopics = extractSubtopicsFromAnswer(parentContext.parentAnswer);
    }

    // Build the systemPrompt for either auto-populate or BFS/DFS question generation
    const includeCriticalRule = !!parentContext;
    const topLevelBfsBlock = (depth === 1 && traversalMode === 'bfs') ? `
TOP-LEVEL BFS RULES:
- Generate a new level-1 question covering a different main aspect.
- Do NOT reference or quote any previous answers or terms from them.
- Keep it broad and foundational, not a follow-up to any prior question.
Examples of main aspects: safety & emergency, monitoring & diagnostics, maintenance tooling, accessibility, admin/operations.
` : '';

    const systemPrompt = isAutoPopulate
      ? 
      // ------------------- AUTO-POPULATE (Suggested Answer) -------------------
      `You are an expert UX design assistant that helps suggest answers based on the knowledge base and context. Your task is to provide a well-reasoned answer to the current question and return it as a JSON object.

Knowledge Base Context:
${knowledgeBaseContext}

Previous Questions Already Asked:
${previousQuestions
  .map(
    (q: { question: string; answer: string }, index: number) =>
      `${index + 1}. Q: ${q.question}\n   A: ${q.answer}`
  )
  .join('\n')}

Guidelines for suggesting answers:
1. Focus ONLY on answering the current question.
2. Use information from the knowledge base when available.
3. Write answers in third person, making definitive statements.
4. Avoid second person pronouns (your, you, yours) entirely.
5. State suggestions as definitive facts that can be modified.
6. Avoid hedging words like "might", "could", "probably", "likely", "maybe".
7. Make clear, direct suggestions even with low confidence.
8. If multiple knowledge base sources agree, use that information with high confidence.
9. If sources conflict, use the most relevant or recent information.
10. If no relevant information exists, provide a reasonable suggestion based on UX best practices.

Return your response in this JSON format:
{
  "questions": [],
  "shouldStopBranch": false,
  "stopReason": "",
  "suggestedAnswer": "Your suggested answer here",
  "sourceReferences": [array of source indices that contributed],
  "confidence": "high" | "medium" | "low"
}`
      :
      // ------------------- FOLLOW-UP QUESTION GENERATION -------------------
      `You are an expert UX design assistant that helps generate follow-up questions for a design prompt. Your task is to generate ONE question based on the traversal mode and return it as a JSON object.

${
  parentContext
    ? `
Current Parent Context:
- Parent Question: "${parentContext.parentQuestion}"
- Parent Answer: "${parentContext.parentAnswer}"
- Parent Topics: ${JSON.stringify(parentContext.parentTopics)}
- Sibling Questions Already Asked: ${
        parentContext.siblingQuestions
          ? JSON.stringify(parentContext.siblingQuestions)
          : 'None'
      }

Extracted Parent Answer Subtopics:
${parentAnswerSubtopics.map((t) => `- ${t}`).join('\n')}

IMPORTANT: The follow-up question MUST directly reference both the parent's question and its answer. For example, it should mention or quote key parts of:
   • The parent's question: "${parentContext.parentQuestion}"
   • The parent's answer: "${parentContext.parentAnswer}"
This ensures that the generated question builds upon the specific details already provided.

CRITICAL: The generated question MUST:
1. Be more specific than the parent question.
2. Focus on a specific aspect mentioned in the parent's answer (see subtopics above).
3. Not repeat information already covered in the parent's answer.
4. Not duplicate any topics that have already been addressed by siblings or previous questions.
5. Ask for implementation details or specific requirements about that aspect.
6. Directly reference both the parent's question and its answer.
`
    : ''
}

// ------------------------------------------------------------
// SHARED CRITICAL RELEVANCE RULE (applies to BOTH BFS AND DFS):
// ------------------------------------------------------------
${includeCriticalRule ? CRITICAL_RELEVANCE_RULE : ''}

Follow these guidelines:
1. Question Progression Levels:
   Current Depth: ${depth}/5

   BFS Mode Levels:
   - Level 1 (Basic Needs): Broad, fundamental questions about purpose, audience, and core requirements
   - Level 2 (Features): Main sections and key features
   - Level 3 (Details): Specific details about each feature or section
   - Level 4 (Refinements): Technical specs and implementation details
   - Level 5 (Polish): Edge cases, final refinements

2. Child Question Generation Rules:
   - Child questions MUST be more specific than their parent question.
   - Child questions MUST explore a specific aspect mentioned in the parent's answer.
   - NEVER ask the same question as the parent with slightly different wording.

3. Traversal Rules (${traversalMode}):
${traversalMode === 'bfs' ? BFS_RULES : DFS_RULES}
      
      4. Topic Management:
   - BFS: Generate siblings for each aspect first
   - DFS: Explore one aspect deeply before siblings
      
      5. Question Generation:
         - Generate exactly ONE question.
   - For BFS: Return shouldStopBranch=true if no unexplored aspects remain
   - For DFS: Return shouldStopBranch=true when the aspect is fully explored
      
      6. Stopping Criteria:
   - Topic fully explored, or the knowledge base is sufficient.
      
      7. Knowledge Base Context:
      ${knowledgeBaseContext}
      
      ${topLevelBfsBlock}
      
      8. Previous Questions Already Asked:
      ${previousQuestions
        .map(
          (q: { question: string; answer: string }, index: number) =>
            `${index + 1}. Q: ${q.question}\n   A: ${q.answer}`
        )
        .join('\n')}
      
      9. Response Format:
      Return your response in this exact JSON format:
      {
        "questions": ["Next question to ask"],
        "shouldStopBranch": boolean,
        "stopReason": "Detailed explanation of why we should stop this branch",
        "suggestedAnswer": "string with best guess answer based on knowledge base",
        "sourceReferences": [array of source indices that contributed],
        "confidence": "high" | "medium" | "low",
        "topicsCovered": ["list of topics this question relates to"],
        "parentTopic": "The main topic this question belongs to",
        "subtopics": ["Potential child topics for this question"]
}`;

    // Next, build the userPrompt to finalize the conversation:
    const userPrompt = isAutoPopulate
      ? // AUTO-POPULATE user instructions
            `The design prompt is: "${prompt}"
      
      Current Question: "${currentQuestion}"
      
      Based on the knowledge base and previous Q&A context:
      1. Analyze the knowledge base for relevant information about this specific question.
      2. Consider the context from previous questions and answers.
      3. Provide a clear, direct answer following the guidelines.
      4. Indicate which knowledge base sources (if any) contributed to the answer.
      5. Rate your confidence in the answer as high/medium/low.
      
      Return your response in this format:
      {
        "questions": [],
        "shouldStopBranch": false,
        "stopReason": "",
        "suggestedAnswer": "Your suggested answer here",
        "sourceReferences": [array of source indices that contributed],
        "confidence": "high" | "medium" | "low"
      }`
      : // FOLLOW-UP question user instructions
            `The design prompt is: "${prompt}".
      Previous Q&A History:
      ${JSON.stringify(previousQuestions, null, 2)}
      
      Current Question: ${
        previousQuestions[previousQuestions.length - 1]?.question || 'Initial question'
      }
      
      CRITICAL REQUIREMENTS:
      1. Review ALL previous questions and their topics carefully.
      2. Generate ONE question that explores a COMPLETELY DIFFERENT aspect not covered in ANY previous question.
3. If BFS, ensure the new question:
   - Stays at the current level
   - Covers a new topic not yet discussed
   - Follows the BFS rules
4. If DFS, continue deeper on the current aspect until fully explored
5. Provide a suggestedAnswer following the guidelines

Topics already covered (DO NOT repeat these or related topics):
      ${previousQuestions
        .map((q: { question: string }, index: number) => `${index + 1}. ${q.question}`)
        .join('\n')}
      
      Remember:
- No second-person pronouns
- No repeating or rephrasing parent's question
- BFS covers all aspects at a level; DFS goes deeper on one aspect.`;

    // Call Claude with the system + user prompts
    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const content = completion.content[0].type === 'text' ? completion.content[0].text.trim() : null;
    if (!content) {
      // console.error('Empty response from Claude');
      // Return a default fallback response
      return NextResponse.json({
        questions: ["What are the core features needed for this design?"],
        shouldStopBranch: false,
        stopReason: "",
        suggestedAnswer: null,
        sourceReferences: [],
        confidence: "low",
        topicsCovered: ["core_features"],
        parentTopic: "requirements",
        parentReference: "",
        subtopics: []
      });
    }

    // console.log('Raw Claude response:', content);

    let parsedResponse: {
      questions: string[];
      shouldStopBranch: boolean;
      stopReason: string;
      suggestedAnswer: string | null;
      sourceReferences: number[];
      confidence?: 'high' | 'medium' | 'low';
      topicsCovered: string[];
      parentTopic: string;
      subtopics: string[];
      parentReference?: string;
    };

    try {
      // Attempt to parse JSON
      parsedResponse = JSON.parse(content);

      // Ensure required fields have defaults
      parsedResponse = {
        questions: Array.isArray(parsedResponse.questions)
          ? parsedResponse.questions
          : [parsedResponse.questions || "What are the core features needed for this design?"],
        shouldStopBranch: parsedResponse.shouldStopBranch || false,
        stopReason: parsedResponse.stopReason || "",
        suggestedAnswer: parsedResponse.suggestedAnswer || null,
        sourceReferences: parsedResponse.sourceReferences || [],
        confidence: parsedResponse.confidence || "low",
        topicsCovered: parsedResponse.topicsCovered || [],
        parentTopic: parsedResponse.parentTopic || "requirements",
        subtopics: parsedResponse.subtopics || [],
        parentReference: parsedResponse.parentReference || ""
      };

      // Normalize question array items to strings
      parsedResponse.questions = parsedResponse.questions
        .map((q: any) => (typeof q === 'string' ? q : JSON.stringify(q)))
        .filter(Boolean);

      // If no valid questions, provide a default
      if (!parsedResponse.questions.length) {
        parsedResponse.questions = ["What are the core features needed for this design?"];
      }

      // console.log('Final formatted response:', parsedResponse);
      return NextResponse.json(parsedResponse);
    } catch (jsonError) {
      // console.error("Error parsing JSON response:", jsonError);
      // console.error("Raw content was:", content);

      // Attempt to salvage partial data
      let fallbackQuestion = "What are the core features needed for this design?";
      try {
        const match = content.match(/"questions":\s*\[\s*"([^"]+)"/);
        if (match && match[1]) {
          fallbackQuestion = match[1];
        }
      } catch (extractionError) {
        // console.error("No fallback question found in partial content");
      }

      return NextResponse.json({
        questions: [fallbackQuestion],
        shouldStopBranch: false,
        stopReason: "",
        suggestedAnswer: null,
        sourceReferences: [],
        confidence: "low",
        topicsCovered: [],
        parentTopic: "requirements",
        parentReference: "",
        subtopics: []
      });
    }
  } catch (error) {
    // console.error('Error in route:', error);
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 });
  }
}
