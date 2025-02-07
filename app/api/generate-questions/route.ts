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
   - BFS: Focus on getting a complete picture at the current level before going deeper
   - DFS: Thoroughly explore one aspect before moving to siblings

4. Knowledge Base Context:
${knowledgeBaseContext}

5. Response Format:
   Return a JSON object with:
   {
     "questions": ["Next question to ask"],
     "shouldStopBranch": boolean,
     "stopReason": "string explaining why we should stop (if shouldStopBranch is true)",
     "suggestedAnswer": "string with auto-populated answer based on knowledge base (if applicable)",
     "sourceReferences": ["array of source indices that contributed to the suggested answer"]
   }`
      },
      {
        role: 'user' as const,
        content: `The design prompt is: "${prompt}".
Previous Q&A: ${JSON.stringify(previousQuestions, null, 2)}

Based on this context:
1. Generate the next most appropriate question for the current depth level
2. Determine if we should stop this line of questioning
3. If possible, suggest an answer based on the knowledge base (cite sources)
4. Return in the specified JSON format`
      },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.7,
      max_tokens: 150,
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content?.trim();
    let response: {
      questions: string[];
      shouldStopBranch: boolean;
      stopReason: string;
      suggestedAnswer: string | null;
      sourceReferences: number[];
    } = { 
      questions: [], 
      shouldStopBranch: false, 
      stopReason: '',
      suggestedAnswer: null,
      sourceReferences: []
    };

    try {
      response = JSON.parse(content!);
      if (!Array.isArray(response.questions)) {
        throw new Error("Questions is not an array");
      }
    } catch (jsonError) {
      console.error("Error parsing API response:", jsonError);
      // Fallback: extract questions from text
      response = {
        questions: content?.split('\n').filter((line) => line.trim() !== '') || [],
        shouldStopBranch: false,
        stopReason: '',
        suggestedAnswer: null,
        sourceReferences: []
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
