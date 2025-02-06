// /app/api/generate-questions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { prompt, previousQuestions } = await request.json();

    const messages = [
      {
        role: 'system' as const,
        content:
          'You are an expert design assistant that helps generate follow-up questions for a design prompt. Your questions should be clear, concise, and focus on gathering detailed design requirements. When previous Q&A is provided, reference those answers to ask more specific, probing questions rather than generic ones.'
      },
      {
        role: 'user' as const,
        content: `The design prompt is: "${prompt}".
Previous Q&A: ${JSON.stringify(previousQuestions)}.
Based on this information, generate up to three specific follow-up questions that build on the provided answers. Avoid broad or repetitive questions. 
Return your questions as a JSON array.
For example: 
[
  "How will you implement ADA compliance in the interface based on your requirements?",
  "What specific features will you add to enhance user safety during emergencies?",
  "How do you plan to integrate voice activation with the building's existing systems?"
]`
      },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      max_tokens: 150,
    });

    const content = completion.choices[0].message.content?.trim();
    let questions: string[] = [];

    try {
      questions = JSON.parse(content!);
      if (!Array.isArray(questions)) {
        throw new Error("Output is not an array");
      }
    } catch (jsonError) {
      // Fallback: if JSON parsing fails, split by newline
      questions = content?.split('\n').filter((line) => line.trim() !== '') || [];
    }

    if (!questions || questions.length === 0) {
      throw new Error('No questions generated.');
    }

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Error generating questions:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions' },
      { status: 500 }
    );
  }
}
