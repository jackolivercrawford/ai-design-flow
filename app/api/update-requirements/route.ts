import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { RequirementsDocument, QANode } from '@/types';
import { KnowledgeBaseSource } from '@/types/settings';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function findNodeById(root: QANode | null, id: string): QANode | null {
  if (!root) return null;
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received update request:', body);
    
    const { qaTree, currentNodeId, knowledgeBase, existingDocument } = body;
    
    if (!qaTree || !existingDocument) {
      return NextResponse.json(
        { error: 'QA Tree and existing document are required' },
        { status: 400 }
      );
    }
    
    // Find the current node that was just answered
    const currentNode = currentNodeId ? findNodeById(qaTree, currentNodeId) : null;
    
    // Format the Q&A history and knowledge base for the AI
    const qaContext = JSON.stringify({
      question: currentNode?.question || 'No current question',
      answer: currentNode?.answer || 'No answer',
      previousQuestions: qaTree.children.map((node: QANode) => ({
        question: node.question,
        answer: node.answer
      }))
    }, null, 2);

    const knowledgeBaseContext = knowledgeBase?.length
      ? knowledgeBase.map((source: KnowledgeBaseSource, index: number) => 
          `Source ${index + 1}: ${Object.entries(source.processedContent || {})
            .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
            .join('\n')}`
        ).join('\n\n')
      : 'No knowledge base provided';

    console.log('Sending to OpenAI:', {
      qaContext: qaContext.substring(0, 100) + '...',
      knowledgeBaseContext: knowledgeBaseContext.substring(0, 100) + '...'
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a requirements document updater. Your task is to update a requirements document based on Q&A session information and knowledge base data.

CRITICAL INSTRUCTIONS:
1. You MUST return ONLY a valid JSON object.
2. DO NOT include any explanatory text, markdown, or other content.
3. DO NOT wrap the JSON in code blocks or quotes.
4. The JSON must exactly match this structure:
{
  "id": string,
  "prompt": string,
  "lastUpdated": string (ISO date),
  "categories": {
    "basicNeeds": {
      "title": "Basic Needs",
      "requirements": []
    },
    "functionalRequirements": {
      "title": "Functional Requirements",
      "requirements": []
    },
    "userExperience": {
      "title": "User Experience",
      "requirements": []
    },
    "implementation": {
      "title": "Implementation",
      "requirements": []
    },
    "refinements": {
      "title": "Refinements",
      "requirements": []
    },
    "constraints": {
      "title": "Constraints",
      "requirements": []
    }
  }
}`
        },
        {
          role: "user",
          content: `Current Requirements Document:
${JSON.stringify(existingDocument, null, 2)}

Latest Q&A:
${qaContext}

Knowledge Base Information:
${knowledgeBaseContext}

Update the requirements document with any new information from the Q&A and knowledge base. Return ONLY the updated document as a JSON object. Do not include any additional text or formatting.`
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    console.log('OpenAI response:', content.substring(0, 100) + '...');

    try {
      const updatedDocument = JSON.parse(content);
      
      // Validate the document structure
      if (!updatedDocument.id || !updatedDocument.categories) {
        console.error('Invalid document structure:', updatedDocument);
        return NextResponse.json(existingDocument);
      }
      
      // Ensure all required categories exist
      const requiredCategories = [
        'basicNeeds',
        'functionalRequirements',
        'userExperience',
        'implementation',
        'refinements',
        'constraints'
      ];
      
      const hasAllCategories = requiredCategories.every(
        category => updatedDocument.categories[category]
      );
      
      if (!hasAllCategories) {
        console.error('Missing required categories');
        return NextResponse.json(existingDocument);
      }
      
      return NextResponse.json(updatedDocument);
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      console.error('Raw response:', content);
      // If parsing fails, return the existing document unchanged
      return NextResponse.json(existingDocument);
    }
  } catch (error) {
    console.error('Error updating requirements:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
} 