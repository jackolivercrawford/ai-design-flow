import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { RequirementsDocument } from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Simplify API called, body keys:', Object.keys(body));
    
    const { requirementsDoc } = body;

    if (!requirementsDoc) {
      console.error('No requirementsDoc in request body');
      return NextResponse.json(
        { error: 'Requirements document is required' },
        { status: 400 }
      );
    }

    if (!requirementsDoc.categories || !requirementsDoc.prompt) {
      console.error('Invalid requirementsDoc structure:', requirementsDoc);
      return NextResponse.json(
        { error: 'Invalid requirements document structure' },
        { status: 400 }
      );
    }

    console.log('Starting simplification...');

    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      temperature: 0.3,
      system: `You are a requirements document simplification expert. Your task is to:

1. SCAN the requirements document and identify:
   - Duplicate or overlapping requirements
   - Overly verbose requirements that can be made more concise
   - Requirements that can be consolidated
   - Any redundant information

2. SIMPLIFY by:
   - Merging duplicate requirements into single, clear statements
   - Making verbose requirements more concise while preserving meaning
   - Removing redundancy without losing important details
   - Maintaining the same structure and categories

3. PRESERVE:
   - All unique information and requirements
   - Priority levels
   - The UI/UX focus of requirements
   - The original prompt
   - The overall intent and scope

CRITICAL: You MUST return ONLY a valid JSON object matching the exact structure provided. Do NOT add new requirements, only simplify existing ones.`,
      messages: [
        {
          role: 'user',
          content: `Simplify this requirements document by removing duplicates, consolidating overlapping items, and making verbose requirements more concise. Preserve all unique information and maintain the structure.

Current Document:
${JSON.stringify(requirementsDoc, null, 2)}

Return the simplified document as a JSON object with the exact same structure.`
        }
      ]
    });

    const content = completion.content[0].type === 'text' ? completion.content[0].text : null;
    if (!content) {
      throw new Error('Empty response from Claude');
    }

    try {
      const simplifiedDoc: RequirementsDocument = JSON.parse(content);
      console.log('Parsed simplified doc successfully');

      // Validate structure
      if (!simplifiedDoc.categories || !simplifiedDoc.prompt) {
        console.error('Invalid simplified doc structure');
        throw new Error('Invalid simplified document structure');
      }

      // Preserve original prompt
      simplifiedDoc.prompt = requirementsDoc.prompt;
      simplifiedDoc.lastUpdated = new Date().toISOString();

      console.log('Simplification complete, returning document');
      
      return NextResponse.json(simplifiedDoc, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    } catch (parseError) {
      console.error('Error parsing simplified document:', parseError);
      console.error('Raw content:', content?.substring(0, 500));
      return NextResponse.json(
        { error: 'Failed to parse simplified document from AI response' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in simplify-requirements API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to simplify requirements';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

