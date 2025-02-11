// /app/api/generate-questions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { KnowledgeBaseSource } from '@/types/settings';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    console.log('API received knowledge base:', knowledgeBase);

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
Technical Specs: ${JSON.stringify(
      source.processedContent?.technicalSpecifications || []
    )}
Design Guidelines: ${JSON.stringify(
      source.processedContent?.designGuidelines || []
    )}
User Preferences: ${JSON.stringify(
      source.processedContent?.userPreferences || []
    )}
Industry Standards: ${JSON.stringify(
      source.processedContent?.industryStandards || []
    )}
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

    console.log('Formatted knowledge base context:', knowledgeBaseContext);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: isAutoPopulate
            ? `You are an expert UX design assistant that helps suggest answers based on the knowledge base and context. Your task is to provide a well-reasoned answer to the current question and return it as a JSON object.

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
            : `You are an expert UX design assistant that helps generate follow-up questions for a design prompt. Your task is to generate ONE follow-up question based on the traversal mode and return it as a JSON object.

${parentContext ? `
Current Parent Question Context:
- Parent Question: "${parentContext.parentQuestion}"
- Parent Answer: "${parentContext.parentAnswer}"
- Parent Topics: ${JSON.stringify(parentContext.parentTopics)}
- Sibling Questions Already Asked: ${parentContext.siblingQuestions ? JSON.stringify(parentContext.siblingQuestions) : "None"}

CRITICAL: The generated question MUST:
1. Be more specific than the parent question.
2. Focus on a specific aspect mentioned in the parent's answer.
3. Not repeat information already covered in the parent's answer.
4. Not duplicate any topics that have already been addressed by the parent's siblings or related branch questions.
5. Ask for implementation details or specific requirements about topics mentioned in the parent's answer.
` : ''}

Follow these guidelines:
1. Question Progression Levels:
   Current Depth: ${depth}/5
   
   BFS Mode Levels:
   - Level 1 (Basic Needs): Broad, fundamental questions about purpose, audience, and core requirements
     Example: "What is the fundamental purpose of the portfolio website?"
   - Level 2 (Features): Main sections and key features, but not specifics yet
     Example: "What main sections should be included in the navigation?"
   - Level 3 (Details): Specific details about each feature/section identified in level 2
     Example: "What project details should be displayed in each portfolio item?"
   - Level 4 (Refinements): Technical specifications and implementation details
     Example: "What image formats and sizes should be supported for project thumbnails?"
   - Level 5 (Polish): Edge cases and final refinements
     Example: "How should the portfolio handle projects with missing images?"

2. Child Question Generation Rules:
   - Child questions MUST be more specific than their parent question.
   - Child questions MUST explore a specific aspect mentioned in the parent's answer.
   - NEVER ask the same question as the parent with slightly different wording.
   - Example progression:
     Parent Q: "What sections should the portfolio include?"
     Parent A: "The portfolio should include a projects section, about me, skills, and contact."
     Valid child Q: "What specific project details should be displayed in the projects section?"
     Invalid child Q: "What content should be included in the portfolio?"

3. Traversal Rules (${traversalMode}):
   ${traversalMode === 'bfs'
     ? `BFS Guidelines:
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
           * Example: If first cycle covered "user profiles" and "content management",
             second cycle might cover "analytics" and "performance optimization".
        
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
           * ANY questions at current level are unanswered.`
     : `DFS Guidelines:
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
             Example: "What core navigation features are needed?"
           * Level 2: Feature breakdown (exactly 2-3 per feature)
             Example: "What specific items in the main menu?"
           * Level 3: Implementation details (exactly 2-3 per Level 2 answer)
             Example: "How should dropdown menus behave?"
           * Level 4: Edge cases (exactly 2-3 per Level 3 answer)
             Example: "How to handle menu overflow on mobile?"
           * Level 5: Optimizations (exactly 2-3 per Level 4 answer)
             Example: "What menu item preloading strategy to use?"
        
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
           Level 1: High-level feature questions (exactly 4-5)
           Level 2: Specific requirements (exactly 2-3 per parent)
           Level 3: Implementation details (exactly 2-3 per parent)
           Level 4: Edge cases (exactly 2-3 per parent)
           Level 5: Optimizations (exactly 2-3 per parent)
        
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
           * Must cover completely different aspects than ALL previous Level 1s.
           * Maintain same level of importance as original Level 1s.
           * Example: If first set covered "navigation" and "search",
             second set might cover "performance" and "security".
        
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
           * Maintain clear topic boundaries.`
   }

4. Topic Management:
   - In BFS mode:
     * First identify ALL distinct aspects/topics from the parent's answer.
     * Generate siblings to cover EACH aspect before going deeper.
     * Only mark shouldStopBranch=true if ALL aspects have been covered by siblings.
   - In DFS mode:
     * Focus on exploring one aspect deeply before moving to siblings.
     * Mark shouldStopBranch=true when the current aspect is fully explored.

5. Question Generation:
   - Generate exactly ONE question.
   - For BFS mode siblings:
     * Look at the parent's answer for unexplored aspects.
     * Each sibling should focus on a DIFFERENT aspect.
     * Return shouldStopBranch=true ONLY if no unexplored aspects remain.
   - For DFS mode:
     * Focus on drilling deeper into the current aspect.
     * Return shouldStopBranch=true when the aspect is fully explored.

6. Stopping Criteria:
   - Stop the current branch if:
     * The topic is fully explored (all aspects covered).
     * Further questions would be too specific.
     * A different topic needs attention.
     * The knowledge base provides sufficient information.
     * The question would be redundant with the parent's answer.

7. Knowledge Base Context:
${knowledgeBaseContext}

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
}`
        },
        {
          role: 'user',
          content: isAutoPopulate
            ? `The design prompt is: "${prompt}"

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
            : `The design prompt is: "${prompt}".
Previous Q&A History:
${JSON.stringify(previousQuestions, null, 2)}

Current Question: ${previousQuestions[previousQuestions.length - 1]?.question || 'Initial question'}

CRITICAL REQUIREMENTS:
1. Review ALL previous questions and their topics carefully.
2. Generate ONE question that explores a COMPLETELY DIFFERENT aspect not covered in ANY previous question.
3. For BFS mode, ensure the new question:
   - Stays at the same level.
   - Covers a new topic not related to any previous questions.
   - Follows the level-specific topic guidelines.
4. Provide a suggested answer following the guidelines.

Topics already covered (DO NOT ask about these or related topics):
${previousQuestions
  .map((q: { question: string }, index: number) => `${index + 1}. ${q.question}`)
  .join('\n')}

Remember:
- NEVER repeat a topic that's been covered in previous questions.
- Each new question must explore a different aspect of the design.
- In BFS mode, stay at the current level but explore new topics.
- Make clear, direct statements in suggested answers.
- Never use second person pronouns.`
        }
      ],
      // max_completion_tokens: 4000,
      response_format: { type: "json_object" },
      // reasoning_effort: 'medium'
    });

    const content = completion.choices[0].message.content?.trim();
    if (!content) {
      console.error('Empty response from OpenAI');
      // Return a default response instead of throwing
      return NextResponse.json({
        questions: ["What are the core features needed for this design?"],
        shouldStopBranch: false,
        stopReason: "",
        suggestedAnswer: null,
        sourceReferences: [],
        confidence: "low",
        topicsCovered: ["core_features"],
        parentTopic: "requirements",
        subtopics: []
      });
    }

    console.log('Raw OpenAI response:', content);

    let response: {
      questions: string[];
      shouldStopBranch: boolean;
      stopReason: string;
      suggestedAnswer: string | null;
      sourceReferences: number[];
      confidence?: 'high' | 'medium' | 'low';
      topicsCovered: string[];
      parentTopic: string;
      subtopics: string[];
    };

    try {
      // First try to parse the JSON response
      response = JSON.parse(content);

      // Ensure required fields exist with defaults
      response = {
        questions: Array.isArray(response.questions)
          ? response.questions
          : [response.questions || "What are the core features needed for this design?"],
        shouldStopBranch: response.shouldStopBranch || false,
        stopReason: response.stopReason || "",
        suggestedAnswer: response.suggestedAnswer || null,
        sourceReferences: response.sourceReferences || [],
        confidence: response.confidence || "low",
        topicsCovered: response.topicsCovered || [],
        parentTopic: response.parentTopic || "requirements",
        subtopics: response.subtopics || []
      };

      // Clean up questions to ensure they're plain text
      response.questions = response.questions
        .map((q: any) => {
          if (typeof q === 'string') return q;
          return q.question || q.text || JSON.stringify(q);
        })
        .filter(Boolean);

      // If no valid questions after cleanup, provide a default
      if (response.questions.length === 0) {
        response.questions = ["What are the core features needed for this design?"];
      }

      console.log('Formatted response:', response);
      return NextResponse.json(response);
    } catch (jsonError) {
      console.error("Error parsing API response:", jsonError);
      console.error("Raw content causing parse error:", content);

      // Try to extract a valid question from the partial response
      let extractedQuestion = "What are the core features needed for this design?";
      try {
        const questionMatch = content.match(/"questions":\s*\[\s*"([^"]+)"/);
        if (questionMatch && questionMatch[1]) {
          extractedQuestion = questionMatch[1];
        }
      } catch (e) {
        console.error("Failed to extract question from partial response");
      }

      // Provide a default response using any extracted data
      return NextResponse.json({
        questions: [extractedQuestion],
        shouldStopBranch: false,
        stopReason: "",
        suggestedAnswer: null,
        sourceReferences: [],
        confidence: "low",
        topicsCovered: ["core_features"],
        parentTopic: "requirements",
        subtopics: []
      });
    }
  } catch (error) {
    console.error('Error generating questions:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions' },
      { status: 500 }
    );
  }
}
