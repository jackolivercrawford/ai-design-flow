// /app/api/generate-questions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { KnowledgeBaseSource } from '@/types/settings';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { prompt, previousQuestions, traversalMode, knowledgeBase } = await request.json();
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

    const messages = [
      {
        role: 'system' as const,
        content: `You are an expert UX design assistant that helps generate follow-up questions for a design prompt. Your questions should follow a clear progression from basic needs to specific implementation details.

Follow these guidelines:
1. Question Progression Levels:
   - Level 1 (Basic Needs): Ask about fundamental user needs, target audience, and primary use cases
   - Level 2 (Requirements): Focus on specific requirements, constraints, and key features
   - Level 3 (User Experience): Explore UX preferences, accessibility needs, and interaction patterns
   - Level 4 (Implementation): Discuss specific UI elements, layouts, and technical requirements
   - Level 5 (Refinement): Fine-tune details, edge cases, and specific feature behaviors

2. Current Depth: ${currentDepth}/5
   - If depth > 4, only continue if absolutely necessary for critical information
   - Consider stopping the current line of questioning if:
     * The answers provide sufficient detail for implementation
     * The topic has been thoroughly explored
     * Further questions would be too specific or redundant

3. Traversal Mode: ${traversalMode}
   BFS Guidelines:
   - Complete all questions at the current level before going deeper
   - Each level should cover different aspects of the design, not repeat topics
   - Level 1 topics: Target audience, Core purpose, Main content types
   - Level 2 topics: Visual style, Navigation structure, Key features
   - Level 3 topics: Interaction patterns, Content organization, Technical requirements
   - Ensure each sibling question explores a DIFFERENT aspect of the design
   - NEVER ask about a topic that's been covered in a previous question

4. Question Generation Rules:
   - CRITICAL: Before generating a new question, check if its topic or theme has been covered in ANY previous question
   - If a similar topic has been asked about, choose a completely different topic from the current level
   - Each new question must explore an entirely new aspect not yet discussed
   - For BFS mode, ensure siblings explore different aspects while staying at the same level
   - Track and avoid ALL previously discussed topics, including:
     * Direct topic matches (e.g., "target audience")
     * Similar themes (e.g., "users", "audience", "visitors")
     * Related concepts (e.g., if we asked about "visual style", don't ask about "color scheme")

5. Knowledge Base Context:
${knowledgeBaseContext}

6. Previous Questions Already Asked:
${previousQuestions.map((q: { question: string; answer: string }, index: number) => 
  `${index + 1}. Q: ${q.question}\n   A: ${q.answer}`
).join('\n')}

7. Response Format:
   {
     "questions": ["Next question to ask"],
     "shouldStopBranch": boolean,
     "stopReason": "string explaining why we should stop (if shouldStopBranch is true)",
     "suggestedAnswer": "string with best guess answer based on knowledge base (REQUIRED)",
     "sourceReferences": [array of source indices that contributed to the suggested answer],
     "confidence": "high" | "medium" | "low",
     "topicsCovered": ["list of topics this question relates to"]
   }

8. Answer Generation Guidelines:
   - Write answers in third person, making definitive statements
   - Avoid second person pronouns (your, you, yours) entirely
   - State suggestions as definitive facts that can be modified
   - Avoid hedging words like "might", "could", "probably", "likely", "maybe"
   - Make clear, direct suggestions even with low confidence`
      },
      {
        role: 'user' as const,
        content: `The design prompt is: "${prompt}".
Previous Q&A History:
${JSON.stringify(previousQuestions, null, 2)}

Current Question: ${previousQuestions[previousQuestions.length - 1]?.question || 'Initial question'}

CRITICAL REQUIREMENTS:
1. Review ALL previous questions and their topics carefully
2. Generate a question that explores a COMPLETELY DIFFERENT aspect not covered in ANY previous question
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
      },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.7,
      max_tokens: 500
    });

    const content = completion.choices[0].message.content?.trim();
    if (!content) {
      throw new Error('Empty response from OpenAI');
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
    };

    try {
      response = JSON.parse(content);
      console.log('Initial parsed response:', response);
      
      // Ensure we always have a suggested answer
      if (!response.suggestedAnswer) {
        console.log('No suggested answer provided, creating a default one');
        response.suggestedAnswer = "Based on general UX principles, a reasonable approach would be...";
        response.confidence = 'low';
        response.sourceReferences = [];
      }
      
      if (!Array.isArray(response.questions)) {
        throw new Error("Questions is not an array");
      }
      
      // Clean up questions to ensure they're plain text
      response.questions = response.questions.map((q: any) => {
        if (typeof q === 'string') {
          // Try to parse if it looks like JSON
          try {
            const parsed = JSON.parse(q);
            return parsed.question || parsed.text || q;
          } catch {
            return q;
          }
        }
        return q.question || q.text || JSON.stringify(q);
      });
      
      // Ensure suggestedAnswer has the required format
      if (response.suggestedAnswer) {
        console.log('Found suggested answer:', response.suggestedAnswer);
        
        // Make sure suggestedAnswer is a string
        const suggestedAnswerText = typeof response.suggestedAnswer === 'object' 
          ? (response.suggestedAnswer as { text?: string }).text || JSON.stringify(response.suggestedAnswer)
          : response.suggestedAnswer;
        
        response = {
          ...response,
          suggestedAnswer: suggestedAnswerText,
          confidence: response.confidence || 'high',  // Default to high if we have a suggestion
          sourceReferences: response.sourceReferences || []
        };
        console.log('Formatted response with suggestion:', response);
      } else {
        console.log('No suggested answer in response');
      }
    } catch (jsonError) {
      console.error("Error parsing API response:", jsonError);
      // Fallback: extract questions from text
      response = {
        questions: [content], // Use the entire content as a single question
        shouldStopBranch: false,
        stopReason: '',
        suggestedAnswer: null,
        sourceReferences: [],
        confidence: 'low',
        topicsCovered: []
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating questions:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions' },
      { status: 500 }
    );
  }
}
