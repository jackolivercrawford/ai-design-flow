import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import pdfParse from 'pdf-parse';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    // console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

async function processContent(content: string) {
  try {
    // console.log('Starting content processing...');
    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: `You are a knowledge base processor. Extract key information from the provided document and return it as a JSON object. Focus on:
1. Requirements and constraints
2. Technical specifications
3. Design guidelines
4. User preferences or patterns
5. Industry standards or best practices

IMPORTANT: You must return ONLY valid JSON with no additional text before or after the JSON object. Return your response in this exact JSON format:
{
  "requirements": [],
  "technicalSpecifications": [],
  "designGuidelines": [],
  "userPreferences": [],
  "industryStandards": []
}`,
      messages: [
        {
          role: "user",
          content
        }
      ]
    });

    // console.log('Claude response received');
    const responseContent = completion.content[0].type === 'text' ? completion.content[0].text : null;
    if (!responseContent) {
      // console.error('Empty response content from Claude');
      throw new Error('Empty response from Claude');
    }

    try {
      const parsedContent = JSON.parse(responseContent);
      // console.log('Successfully parsed Claude response');
      return parsedContent;
    } catch (parseError) {
      // console.error('Error parsing Claude response:', parseError, '\nResponse content:', responseContent);
      throw new Error('Failed to parse Claude response');
    }
  } catch (error) {
    // console.error('Error in processContent:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to process content: ${error.message}`);
    }
    throw new Error('Failed to process content: Unknown error');
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const sourceType = formData.get('type');
    const file = formData.get('file');
    const textContent = formData.get('content');

    if (!sourceType) {
      return new Response(JSON.stringify({ error: 'Source type is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let content: string;

    if (sourceType === 'file' && file) {
      // Check if the file has arrayBuffer method (indicating it's a File or Blob)
      const fileObject = file as { arrayBuffer(): Promise<ArrayBuffer>; type?: string; name?: string };
      
      if ('arrayBuffer' in fileObject && typeof fileObject.arrayBuffer === 'function') {
        const buffer = Buffer.from(await fileObject.arrayBuffer());
        
        // Check file type using the file's type property or name
        const fileType = fileObject.type || '';
        const fileName = fileObject.name || '';
        
        if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
          content = await extractTextFromPDF(buffer);
        } else {
          // For text files, convert buffer to string
          content = buffer.toString('utf-8');
        }
      } else {
        throw new Error('Invalid file format');
      }
    } else if (sourceType === 'text' && typeof textContent === 'string') {
      content = textContent;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid input' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const processedContent = await processContent(content);

    return new Response(JSON.stringify({ success: true, processedContent }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    // console.error('Error in API route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: 'Internal server error', details: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 