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
          'You are an expert design assistant that helps generate follow-up questions for a design prompt. Your questions are clear, concise, and focused on gathering detailed design requirements.',
      },
      {
        role: 'user' as const,
        content: `The design prompt is: "${prompt}".
Previous Q&A history: ${JSON.stringify(previousQuestions)}.
Based on this information, generate up to three clear follow-up questions as a JSON array.
For example: ["Is the elevator primarily for humans or machinery?", "What is the total number of floors?", "Is there a known budget constraint?"]`,
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
