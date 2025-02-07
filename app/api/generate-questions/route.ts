// /app/api/generate-questions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { prompt, previousQuestions, traversalMode } = await request.json();

    // Calculate current depth by counting parents in previousQuestions
    let currentDepth = 0;
    let currentParent = previousQuestions[previousQuestions.length - 1];
    while (currentParent?.parent) {
      currentDepth++;
      currentParent = currentParent.parent;
    }

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

4. Response Format:
   Return a JSON object with:
   {
     "questions": ["Next question to ask"],
     "shouldStopBranch": boolean, // true if this line of questioning is complete
     "stopReason": "string explaining why we should stop (if shouldStopBranch is true)"
   }`
      },
      {
        role: 'user' as const,
        content: `The design prompt is: "${prompt}".
Previous Q&A: ${JSON.stringify(previousQuestions, null, 2)}

Based on this context:
1. Generate the next most appropriate question for the current depth level
2. Determine if we should stop this line of questioning
3. Return in the specified JSON format`
      },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.7,
      max_tokens: 150,
    });

    const content = completion.choices[0].message.content?.trim();
    let response = { questions: [], shouldStopBranch: false, stopReason: '' };

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
        stopReason: ''
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
