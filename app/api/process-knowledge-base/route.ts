import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
    const completion = await openai.chat.completions.create({
      model: "o3-mini",
      messages: [
        {
          role: "system",
          content: `You are a knowledge base processor. Extract key information from the provided document and return it as a JSON object. Focus on:
1. Requirements and constraints
2. Technical specifications
3. Design guidelines
4. User preferences or patterns
5. Industry standards or best practices

Return your response in this exact JSON format:
{
  "requirements": [],
  "technicalSpecifications": [],
  "designGuidelines": [],
  "userPreferences": [],
  "industryStandards": []}`
        },
        {
          role: "user",
          content
        }
      ],
      max_completion_tokens: 4000,
      response_format: { type: "json_object" },
      reasoning_effort: 'medium'
    });

    // console.log('OpenAI response received');
    const responseContent = completion.choices[0].message.content;
    if (!responseContent) {
      // console.error('Empty response content from OpenAI');
      throw new Error('Empty response from OpenAI');
    }

    try {
      const parsedContent = JSON.parse(responseContent);
      // console.log('Successfully parsed OpenAI response');
      return parsedContent;
    } catch (parseError) {
      // console.error('Error parsing OpenAI response:', parseError, '\nResponse content:', responseContent);
      throw new Error('Failed to parse OpenAI response');
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