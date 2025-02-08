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
    const estimatedTokens = promptText.split(/\s+/).length;
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
          content: `You are an expert UI developer. Your task is to generate a complete, production-ready React component mockup based on the provided requirements. You must use React with Tailwind CSS for styling—and you are encouraged to integrate DaisyUI (a Tailwind CSS plugin) via CDN to ensure the UI is attractive, modern, and clean.

Guidelines:
1. Use React as the core technology.
2. Use Tailwind CSS, and where appropriate, include DaisyUI via CDN for enhanced styling.
3. Follow modern design principles and best practices.
4. Ensure the UI is responsive and accessible.
5. Include comments explaining key design decisions.
6. Structure the code in a clean, maintainable way.
7. Use semantic HTML elements.
8. Include hover states, transitions, and proper spacing.
9. Use a consistent color scheme that matches the application's purpose.
10. Include TypeScript types as comments only (avoid inline type assertions).

CRITICAL REQUIREMENTS:
1. Implement ALL features mentioned in the requirements.
2. Each requirement must map to specific UI elements or functionality.
3. All interactive elements must have proper ARIA labels and roles.
4. Handle error, loading, and success states appropriately.
5. Export the main component as default.

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
    "primary": "hex color (for main actions and headers)",
    "secondary": "hex color (for supporting elements)",
    "accent": "hex color (for attention-grabbing elements)",
    "background": "hex color (for the main background)",
    "text": "hex color (for main text content)"
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

      // Optionally, post-process the generated code to remove inline type assertions
      if (mockupData.code && typeof mockupData.code === 'string') {
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
