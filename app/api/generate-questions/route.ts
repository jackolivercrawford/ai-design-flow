import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, previousQuestions } = await request.json();

    // TODO: Implement question generation logic
    const generatedQuestion = "What are the key features you'd like to include?";

    return NextResponse.json({ question: generatedQuestion });
  } catch (error) {
    console.error('Error generating questions:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions' },
      { status: 500 }
    );
  }
} 