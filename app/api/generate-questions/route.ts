// app/api/generate-questions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize the OpenAI client with your API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { prompt, previousQuestions } = await request.json();

    // Construct a context message for GPT-4
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
Based on this information, generate one clear follow-up question to refine the design requirements.`,
      },
    ];

    // Call the OpenAI API using the GPT-4 model
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      max_tokens: 100, // Adjust as needed for question length
    });

    // Extract the generated question from the response
    const generatedQuestion = completion.choices[0].message.content?.trim();

    if (!generatedQuestion) {
      throw new Error('No question generated.');
    }

    return NextResponse.json({ question: generatedQuestion });
  } catch (error) {
    console.error('Error generating questions:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions' },
      { status: 500 }
    );
  }
}
