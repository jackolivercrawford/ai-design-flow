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
          content: `You are a UI/UX-focused requirements document updater. Your task is to update a requirements document based on Q&A session information and knowledge base data, translating all requirements into their UI/UX implications.

CRITICAL INSTRUCTIONS:
1. Transform ALL requirements to focus on UI/UX implications, following these guidelines for each category:

   Basic Needs:
   - Focus on core user interface elements and primary interactions
   - Translate technical requirements into visual and interactive elements
   - Example: "System needs real-time data processing" becomes "Display real-time updates with visual indicators for data freshness"

   Functional Requirements:
   - Express in terms of user interactions and interface behaviors
   - Describe how features manifest in the UI
   - Example: "System must process multiple file formats" becomes "Interface should provide clear drag-drop zones with visual feedback for accepted file types"

   User Experience:
   - Focus on user flows, interaction patterns, and feedback mechanisms
   - Emphasize accessibility and usability aspects
   - Example: "System needs error handling" becomes "Provide clear error messages with suggested actions for recovery"

   Implementation:
   - Transform technical specs into UI patterns and components
   - Focus on visual hierarchy and layout implications
   - Example: "Use REST API" becomes "Implement loading states and progress indicators for all data fetching operations"

   Refinements:
   - Emphasize visual polish and interaction refinements
   - Focus on micro-interactions and visual feedback
   - Example: "Optimize performance" becomes "Add smooth transitions between states and loading placeholders"

   Constraints:
   - Express technical limitations in terms of UI/UX impact
   - Focus on user-facing implications
   - Example: "Limited server resources" becomes "Implement efficient pagination and lazy loading in the interface"

2. For any requirement that seems non-UI/UX related:
   - Consider its impact on the user interface
   - Transform it into its UI/UX implications
   - If truly no UI/UX impact, omit it

3. You MUST return ONLY a valid JSON object.
4. DO NOT include any explanatory text, markdown, or other content.
5. DO NOT wrap the JSON in code blocks or quotes.
6. The JSON must exactly match this structure:
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

Update the requirements document with any new information from the Q&A and knowledge base, ensuring all requirements are expressed in terms of their UI/UX implications. Return ONLY the updated document as a JSON object.`
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
        let priority: 'high' | 'medium' | 'low';

        // Priority determination first (more comprehensive)
        if (
          textLower.includes('critical') || 
          textLower.includes('essential') || 
          textLower.includes('must') ||
          textLower.includes('required') ||
          textLower.includes('necessary') ||
          textLower.includes('important') ||
          textLower.includes('crucial') ||
          textLower.includes('key') ||
          textLower.includes('primary') ||
          textLower.includes('core')
        ) {
          priority = 'high';
        } else if (
          textLower.includes('optional') || 
          textLower.includes('nice to have') ||
          textLower.includes('if possible') ||
          textLower.includes('could') ||
          textLower.includes('might') ||
          textLower.includes('maybe') ||
          textLower.includes('consider') ||
          textLower.includes('secondary') ||
          textLower.includes('additional')
        ) {
          priority = 'low';
        } else {
          priority = 'medium';
        }

        // Category determination (existing logic)
        if (textLower.includes('security') || textLower.includes('emergency') || textLower.includes('safety')) {
          category = 'security';
          priority = 'high'; // Security always high priority
          tags.push('safety');
        } else if (textLower.includes('user') || textLower.includes('interface') || textLower.includes('display') || textLower.includes('visual')) {
          category = 'ux';
          tags.push('interface');
          if (textLower.includes('display')) tags.push('display');
          if (textLower.includes('visual')) tags.push('visual');
        } else if (textLower.includes('performance') || textLower.includes('speed') || textLower.includes('efficiency')) {
          category = 'performance';
          tags.push('optimization');
          if (textLower.includes('speed')) tags.push('speed');
          if (textLower.includes('efficiency')) tags.push('efficiency');
        } else if (textLower.includes('accessible') || textLower.includes('disability')) {
          category = 'accessibility';
          priority = 'high'; // Accessibility always high priority
          tags.push('ada-compliance');
        } else if (textLower.includes('technical') || textLower.includes('system') || textLower.includes('integration')) {
          category = 'technical';
          tags.push('integration');
          if (textLower.includes('system')) tags.push('system');
        }

        // Additional tags based on content
        if (textLower.includes('monitor') || textLower.includes('sensor')) {
          tags.push('monitoring');
          if (textLower.includes('sensor')) tags.push('sensors');
        }
        if (textLower.includes('data') || textLower.includes('analytics')) {
          tags.push('data');
          if (textLower.includes('analytics')) tags.push('analytics');
        }
        if (textLower.includes('ai') || textLower.includes('machine learning')) {
          tags.push('ai');
          if (textLower.includes('machine learning')) tags.push('ml');
        }
        if (textLower.includes('maintenance')) {
          tags.push('maintenance');
        }
        if (textLower.includes('real-time') || textLower.includes('realtime')) {
          tags.push('real-time');
        }
        if (textLower.includes('emergency')) {
          tags.push('emergency');
        }
        if (textLower.includes('status') || textLower.includes('state')) {
          tags.push('status');
        }
        if (textLower.includes('alert') || textLower.includes('notification')) {
          tags.push('alerts');
        }
        if (textLower.includes('control') || textLower.includes('controls')) {
          tags.push('controls');
        }
        if (textLower.includes('feedback')) {
          tags.push('feedback');
        }
        if (textLower.includes('intercom') || textLower.includes('communication')) {
          tags.push('communication');
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

            // Try to find matching requirement in existing document to preserve metadata
            const existingReq = Object.values(existingDocument.categories)
              .flatMap((cat: any) => cat.requirements)
              .find((existing: any) => existing.text === req.text);

            if (existingReq) {
              // If found, preserve all metadata but update the text
              return {
                ...existingReq,
                text: req.text,
                updatedAt: new Date().toISOString()
              };
            }

            // If it's a new requirement but already has some structure
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