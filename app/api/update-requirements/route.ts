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
    const { qaTree, currentNodeId, knowledgeBase, existingDocument } = await request.json();
    
    // Find the current node that was just answered
    const currentNode = currentNodeId ? findNodeById(qaTree, currentNodeId) : null;
    
    // Format the Q&A history and knowledge base for the AI
    const qaContext = JSON.stringify(qaTree, null, 2);
    const knowledgeBaseContext = knowledgeBase?.length
      ? knowledgeBase.map((source: KnowledgeBaseSource, index: number) => `
Source ${index + 1} (${source.type}): ${source.name}
${Object.entries(source.processedContent || {}).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}
`).join('\n')
      : 'No knowledge base provided';

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a requirements analyst that helps maintain and update a product requirements document based on Q&A sessions and knowledge base information.

The requirements document is organized into categories:
1. Basic Needs - Fundamental user needs and target audience
2. Functional Requirements - Core features and functionality
3. User Experience - UX patterns, accessibility, and user interactions
4. Implementation - Technical specifications and UI elements
5. Refinements - Edge cases and detailed behaviors
6. Constraints - Limitations and restrictions

For each requirement, you should:
- Determine the appropriate category
- Set priority (high/medium/low)
- Assign relevant tags
- Categorize type (functional/technical/ux/accessibility/security/performance)
- Track the source (user-qa or knowledge-base)

Your task is to:
1. Analyze the new answer and knowledge base
2. Update or add requirements based on new information
3. Ensure consistency across requirements
4. Return the updated document in the specified format`
        },
        {
          role: "user",
          content: `Current Q&A Tree: ${qaContext}

Knowledge Base Information:
${knowledgeBaseContext}

Current Requirements Document:
${JSON.stringify(existingDocument || {}, null, 2)}

Latest Answer: ${currentNode ? `
Question: ${currentNode.question}
Answer: ${currentNode.answer}` : 'No new answer'}

Please update the requirements document and return it in JSON format.`
        }
      ],
      response_format: { type: "json_object" }
    });

    const updatedDocument = JSON.parse(completion.choices[0].message.content!);

    return NextResponse.json(updatedDocument);
  } catch (error) {
    console.error('Error updating requirements:', error);
    return NextResponse.json(
      { error: 'Failed to update requirements' },
      { status: 500 }
    );
  }
} 