import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { RequirementsDocument, RequirementCategory } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { requirementsDoc } = await request.json();
    
    if (!requirementsDoc) {
      return NextResponse.json(
        { error: 'Requirements document is required' },
        { status: 400 }
      );
    }

    // Format requirements for the prompt
    const formattedRequirements = Object.entries(requirementsDoc.categories as Record<string, RequirementCategory>)
      .map(([key, category]) => {
        const reqs = category.requirements
          .map(req => `- ${req.text} (${req.priority} priority)`)
          .join('\n');
        return `${category.title}:\n${reqs}`;
      })
      .join('\n\n');

    // Check requirements size
    const promptText = `Design Prompt: ${requirementsDoc.prompt}\n\nRequirements:\n${formattedRequirements}`;
    const estimatedTokens = promptText.split(/\s+/).length; // Rough estimation
    if (estimatedTokens > 2000) {
      return NextResponse.json(
        { error: 'Requirements document is too large. Please reduce the number of requirements or split into multiple requests.' },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "o3-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert UI developer who creates React components with Tailwind CSS. Your task is to generate a beautiful, modern, and functional mockup based on the provided requirements and return it as a JSON object.

Guidelines:
1. Use only React and Tailwind CSS (no external libraries)
2. Follow modern design principles and best practices
3. Ensure the UI is responsive and accessible
4. Include comments explaining key design decisions
5. Structure the code in a clean, maintainable way
6. Use semantic HTML elements
7. Include hover states and transitions
8. Implement proper spacing and hierarchy
9. Use a consistent color scheme
10. Include proper TypeScript types

CRITICAL REQUIREMENTS:
1. The code MUST implement ALL features mentioned in the requirements
2. Each requirement should be traceable to specific UI elements or functionality
3. The color scheme should be carefully chosen to match the application's purpose
4. Components should be modular and reusable
5. All interactive elements must have proper ARIA labels and roles
6. Error states, loading states, and success states must be handled
7. The interface must be fully responsive
8. All user inputs must be validated
9. Emergency and critical functions must be easily accessible
10. Real-time updates and status changes must be clearly visible

Additional Guideline: Do not include inline type assertions (e.g. "as ElevatorMode") or other TypeScript-only syntax. Include type information only in comments. The code must be production-ready and immediately runnable in a plain JavaScript environment. The generated code must be production-ready and immediately runnable in a plain JavaScript environment.


The code must be a complete, working React component that:
1. Includes all necessary imports at the top
2. Defines all required TypeScript interfaces (as comments or in a way that does not affect runtime)
3. Implements a main component that uses the interfaces
4. Uses React hooks (useState, useEffect) for state management
5. Includes all event handlers and UI interactions
6. Has proper error handling and loading states
7. Uses the provided color scheme consistently
8. Implements all features from the requirements
9. Has proper ARIA labels and accessibility features
10. Exports the main component as default

Example structure:
\`\`\`tsx
import React, { useState, useEffect } from 'react';

interface ComponentProps {
  // prop definitions
}

interface ComponentState {
  // state definitions
}

function MainComponent() {
  const [state, setState] = useState<ComponentState>({});
  
  useEffect(() => {
    // side effects
  }, []);

  const handleEvent = () => {
    // event handling
  };

  return (
    <div>
      {/* component JSX */}
    </div>
  );
}

export default MainComponent;
\`\`\`

Return your response in this exact JSON format:
{
  "code": "Complete React/Tailwind component code as shown in the example above",
  "colorScheme": {
    "primary": "hex color (should be suitable for main actions and headers)",
    "secondary": "hex color (should be suitable for supporting elements)",
    "accent": "hex color (should be suitable for attention-grabbing elements)",
    "background": "hex color (should be suitable for the main background)",
    "text": "hex color (should be suitable for main text content)"
  },
  "components": [
    "Detailed list of all reusable components created, with their purposes"
  ],
  "features": [
    "Comprehensive list of all implemented features, matching the requirements"
  ],
  "nextSteps": [
    "List of suggested improvements or additions for future iterations"
  ]
}`
        },
        {
          role: "user",
          content: `Design Prompt: ${requirementsDoc.prompt}

Requirements (MUST ALL BE IMPLEMENTED):
${formattedRequirements}

Generate a complete React/Tailwind mockup that satisfies ALL these requirements. The mockup should be immediately usable and include all necessary types and styling. Each requirement should be reflected in the implementation.`
        }
      ],
      max_completion_tokens: 25000,
      response_format: { type: "json_object" },
      reasoning_effort: 'high'
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    try {
      const mockupData = JSON.parse(content);

      // Optionally, post-process the generated code to remove any inline type assertions
      if (mockupData.code && typeof mockupData.code === 'string') {
        // Remove inline type assertions like " as ElevatorMode"
        mockupData.code = mockupData.code.replace(/\sas\s+\w+/g, '');
      }
      return NextResponse.json(mockupData);
    } catch (parseError) {
      console.error('Error parsing mockup data:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse mockup data' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error generating mockup:', error);
    return NextResponse.json(
      { error: 'Failed to generate mockup' },
      { status: 500 }
    );
  }
}