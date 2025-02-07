import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

async function processContent(content: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are a knowledge base processor. Extract key information from the provided document that would be relevant for the design process. Focus on:
1. Requirements and constraints
2. Technical specifications
3. Design guidelines
4. User preferences or patterns
5. Industry standards or best practices

Format the output as a JSON object with these categories.`
      },
      {
        role: "user",
        content
      }
    ],
    response_format: { type: "json_object" }
  });

  return completion.choices[0].message.content;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const sourceType = formData.get('type') as string;
    let content: string;

    if (sourceType === 'file') {
      const file = formData.get('file') as File;
      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }

      // Extract text based on file type
      if (file.type === 'application/pdf') {
        content = await extractTextFromPDF(file);
      } else {
        content = await file.text();
      }
    } else if (sourceType === 'text') {
      content = formData.get('content') as string;
      if (!content) {
        return NextResponse.json(
          { error: 'No content provided' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid source type' },
        { status: 400 }
      );
    }

    const processedContent = await processContent(content);

    return NextResponse.json({
      success: true,
      processedContent
    });

  } catch (error) {
    console.error('Error processing knowledge base:', error);
    return NextResponse.json(
      { error: 'Failed to process knowledge base' },
      { status: 500 }
    );
  }
} 