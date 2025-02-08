// /app/api/generate-questions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { KnowledgeBaseSource } from '@/types/settings';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { prompt, previousQuestions, traversalMode, knowledgeBase, isAutoPopulate, currentQuestion, depth, parentContext } = await request.json();
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

${knowledgeBase.map((source: KnowledgeBaseSource, index: number) => `
Source ${index + 1} (${source.type === 'file' ? 'File' : 'Text'}: ${source.name}):
Requirements: ${JSON.stringify(source.processedContent?.requirements || [])}
Technical Specs: ${JSON.stringify(source.processedContent?.technicalSpecifications || [])}
Design Guidelines: ${JSON.stringify(source.processedContent?.designGuidelines || [])}
User Preferences: ${JSON.stringify(source.processedContent?.userPreferences || [])}
Industry Standards: ${JSON.stringify(source.processedContent?.industryStandards || [])}
`).join('\n')}

Use this information to:
- Auto-populate answers when confident (especially when multiple sources agree)
- Guide question generation based on available information
- Identify gaps that need to be filled
- Validate answers against known constraints
- Highlight any conflicts between different sources`
      : 'No knowledge base provided.';

    console.log('Formatted knowledge base context:', knowledgeBaseContext);

    const completion = await openai.chat.completions.create({
      model: 'o3-mini',
      messages: [
        {
          role: 'system',
          content: isAutoPopulate 
            ? `You are an expert UX design assistant that helps suggest answers based on the knowledge base and context. Your task is to provide a well-reasoned answer to the current question and return it as a JSON object.

Knowledge Base Context:
${knowledgeBaseContext}

Previous Questions Already Asked:
${previousQuestions.map((q: { question: string; answer: string }, index: number) => 
  `${index + 1}. Q: ${q.question}\n   A: ${q.answer}`
).join('\n')}

Guidelines for suggesting answers:
1. Focus ONLY on answering the current question
2. Use information from the knowledge base when available
3. Write answers in third person, making definitive statements
4. Avoid second person pronouns (your, you, yours) entirely
5. State suggestions as definitive facts that can be modified
6. Avoid hedging words like "might", "could", "probably", "likely", "maybe"
7. Make clear, direct suggestions even with low confidence
8. If multiple knowledge base sources agree, use that information with high confidence
9. If sources conflict, use the most relevant or recent information
10. If no relevant information exists, provide a reasonable suggestion based on UX best practices

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

CRITICAL: The generated question MUST:
1. Be more specific than the parent question
2. Focus on a specific aspect mentioned in the parent's answer
3. Not repeat information already covered in the parent's answer
4. Ask for implementation details or specific requirements about topics mentioned in the parent's answer
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
   - Child questions MUST be more specific than their parent question
   - Child questions MUST explore a specific aspect mentioned in the parent's answer
   - NEVER ask the same question as the parent with slightly different wording
   - Example progression:
     Parent Q: "What sections should the portfolio include?"
     Parent A: "The portfolio should include a projects section, about me, skills, and contact."
     Valid child Q: "What specific project details should be displayed in the projects section?"
     Invalid child Q: "What content should be included in the portfolio?"

3. Traversal Rules (${traversalMode}):
   ${traversalMode === 'bfs' 
     ? `BFS Guidelines:
        - At Level 1: Generate at least 3-4 broad, fundamental questions before going deeper
        - Each level should be more specific than the last
        - Questions at the same level should cover different aspects
        - Example progression:
          Level 1: "Who is the target audience?"
          Level 2: "What main navigation sections are needed?"
          Level 3: "What information should appear in the project cards?"
          Level 4: "What should happen when a project card is clicked?"`
     : `DFS Guidelines:
        - Start with a broad topic
        - Each follow-up should be more specific about that topic
        - Example progression:
          Q1: "What project showcase features are needed?"
          Q2: "How should individual project details be displayed?"
          Q3: "What specific project metrics should be highlighted?"
          Q4: "How should project success metrics be visualized?"`
   }

4. Topic Management:
   - Each level should be distinctly more specific than the previous
   - Questions should build upon previous answers
   - Avoid repeating topics already covered
   - Use previous answers to inform specificity
   - Child questions must explore specific aspects mentioned in parent's answer

5. Question Generation:
   - Generate exactly ONE question
   - Make it specific and focused
   - Include clear parent-child relationships
   - Maintain proper depth progression
   - Follow numbering conventions per mode
   - For child questions:
     * Extract key topics/features from parent's answer
     * Ask about specific implementation details of those topics
     * Focus on one specific aspect rather than broad concepts
     * Ensure the question couldn't be answered by the parent's answer

6. Stopping Criteria:
   - Stop current branch if:
     * Topic is fully explored (all aspects covered)
     * Further questions would be too specific
     * A different topic needs attention
     * Knowledge base provides sufficient information
     * The question would be redundant with parent's answer

7. Knowledge Base Context:
${knowledgeBaseContext}

8. Previous Questions Already Asked:
${previousQuestions.map((q: { question: string; answer: string }, index: number) => 
  `${index + 1}. Q: ${q.question}\n   A: ${q.answer}`
).join('\n')}

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
1. Analyze the knowledge base for relevant information about this specific question
2. Consider the context from previous questions and answers
3. Provide a clear, direct answer following the guidelines
4. Indicate which knowledge base sources (if any) contributed to the answer
5. Rate your confidence in the answer as high/medium/low

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
1. Review ALL previous questions and their topics carefully
2. Generate ONE question that explores a COMPLETELY DIFFERENT aspect not covered in ANY previous question
3. For BFS mode, ensure the new question:
   - Stays at the same level
   - Covers a new topic not related to any previous questions
   - Follows the level-specific topic guidelines
4. Provide a suggested answer following the guidelines

Topics already covered (DO NOT ask about these or related topics):
${previousQuestions.map((q: { question: string }, index: number) => 
  `${index + 1}. ${q.question}`
).join('\n')}

Remember:
- NEVER repeat a topic that's been covered in previous questions
- Each new question must explore a different aspect of the design
- In BFS mode, stay at the current level but explore new topics
- Make clear, direct statements in suggested answers
- Never use second person pronouns`
        }
      ],
      max_completion_tokens: 4000,
      response_format: { type: "json_object" },
      reasoning_effort: 'medium'
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
        questions: Array.isArray(response.questions) ? response.questions : [response.questions || "What are the core features needed for this design?"],
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
      response.questions = response.questions.map((q: any) => {
        if (typeof q === 'string') return q;
        return q.question || q.text || JSON.stringify(q);
      }).filter(Boolean);

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
