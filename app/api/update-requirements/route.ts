import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { RequirementsDocument, QANode, RequirementCategory } from '@/types';
import { KnowledgeBaseSource } from '@/types/settings';
import { v4 as uuidv4 } from 'uuid';

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
      model: "o3-mini",
      messages: [
        {
          role: "system",
          content: `You are a requirements document updater. Your task is to update a requirements document based on Q&A session information and knowledge base data and return it as a JSON object.

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
          content: `Current Document: ${JSON.stringify(existingDocument)}
Latest Q&A: ${qaContext}
Knowledge Base: ${knowledgeBaseContext}

Update the requirements document with any new information from the Q&A and knowledge base. Return ONLY the updated document as a JSON object.`
        }
      ],
      max_completion_tokens: 16000,
      response_format: { type: "json_object" },
      reasoning_effort: 'medium'
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      console.error('Empty response from OpenAI');
      console.log('Returning existing document due to empty OpenAI response');
      return NextResponse.json(existingDocument);
    }

    console.log('OpenAI response:', content.substring(0, 100) + '...');

    try {
      const updatedDocument = JSON.parse(content);
      
      // Validate the document structure
      if (!updatedDocument.id || !updatedDocument.categories) {
        console.error('Invalid document structure:', updatedDocument);
        console.log('Returning existing document due to invalid structure');
        return NextResponse.json(existingDocument);
      }
      
      // Helper function to determine requirement category and tags
      function analyzeRequirement(text: string): {
        category: 'functional' | 'technical' | 'ux' | 'accessibility' | 'security' | 'performance';
        tags: string[];
        priority: 'high' | 'medium' | 'low';
      } {
        const textLower = text.toLowerCase();
        let category: 'functional' | 'technical' | 'ux' | 'accessibility' | 'security' | 'performance' = 'functional';
        const tags: string[] = [];
        let priority: 'high' | 'medium' | 'low' = 'medium';

        // Category determination
        if (textLower.includes('security') || textLower.includes('emergency') || textLower.includes('safety')) {
          category = 'security';
          priority = 'high';
          tags.push('safety');
        } else if (textLower.includes('user') || textLower.includes('interface') || textLower.includes('display') || textLower.includes('visual')) {
          category = 'ux';
          tags.push('interface');
        } else if (textLower.includes('performance') || textLower.includes('speed') || textLower.includes('efficiency')) {
          category = 'performance';
          tags.push('optimization');
        } else if (textLower.includes('accessible') || textLower.includes('disability')) {
          category = 'accessibility';
          priority = 'high';
          tags.push('ada-compliance');
        } else if (textLower.includes('technical') || textLower.includes('system') || textLower.includes('integration')) {
          category = 'technical';
          tags.push('integration');
        }

        // Additional tags based on content
        if (textLower.includes('monitor') || textLower.includes('sensor')) {
          tags.push('monitoring');
        }
        if (textLower.includes('data') || textLower.includes('analytics')) {
          tags.push('data');
        }
        if (textLower.includes('ai') || textLower.includes('machine learning')) {
          tags.push('ai');
        }
        if (textLower.includes('maintenance')) {
          tags.push('maintenance');
        }
        if (textLower.includes('real-time') || textLower.includes('realtime')) {
          tags.push('real-time');
        }

        // Priority determination (if not already set by category)
        if (priority === 'medium') {
          if (textLower.includes('critical') || textLower.includes('essential') || textLower.includes('must')) {
            priority = 'high';
          } else if (textLower.includes('optional') || textLower.includes('nice to have')) {
            priority = 'low';
          }
        }

        return { category, tags, priority };
      }

      // Ensure all requirements have proper structure and IDs
      Object.values(updatedDocument.categories).forEach((category: any) => {
        if (Array.isArray(category.requirements)) {
          category.requirements = category.requirements.map((req: string | any) => {
            // If the requirement is just a string, convert it to proper structure
            if (typeof req === 'string') {
              const analysis = analyzeRequirement(req);
              return {
                id: uuidv4(),
                text: req,
                source: 'user-qa',
                priority: analysis.priority,
                category: analysis.category,
                tags: analysis.tags,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
            }
            // If it's already an object but missing ID
            if (!req.id) {
              const analysis = analyzeRequirement(req.text);
              req.id = uuidv4();
              req.priority = req.priority || analysis.priority;
              req.category = req.category || analysis.category;
              req.tags = req.tags || analysis.tags;
              req.createdAt = new Date().toISOString();
              req.updatedAt = new Date().toISOString();
            }
            return req;
          });
        } else {
          category.requirements = [];
        }
      });
      
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
        console.log('Returning existing document due to missing categories');
        return NextResponse.json(existingDocument);
      }
      
      return NextResponse.json(updatedDocument);
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      console.error('Raw response:', content);
      // If parsing fails, return the existing document unchanged
      console.log('Returning existing document due to parse error');
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