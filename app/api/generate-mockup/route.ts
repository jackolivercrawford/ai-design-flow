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
          content: `You are an expert UI developer. Your task is to generate a complete, production-ready React component mockup based on the provided requirements. You MUST use React with Tailwind CSS and DaisyUI for styling. DaisyUI is already included via CDN in the preview environment.

Guidelines:
1. Use React as the core technology.
2. Use Tailwind CSS with DaisyUI as the primary styling system.
3. Follow modern design principles and best practices.
4. Ensure the UI is responsive and accessible.
5. Include comments explaining key design decisions.
6. Structure the code in a clean, maintainable way.
7. Use semantic HTML elements.
8. Include hover states, transitions, and proper spacing.
9. Generate a comprehensive color scheme that works with DaisyUI.
10. Include TypeScript types as comments only (avoid inline type assertions).

CRITICAL REQUIREMENTS:
1. Implement ALL features mentioned in the requirements.
2. Each requirement must map to specific UI elements or functionality.
3. All interactive elements must have proper ARIA labels and roles.
4. Handle error, loading, and success states appropriately.
5. Export the main component as default.
6. Use DaisyUI classes for components:
   - Buttons: btn, btn-primary, btn-secondary, etc.
   - Cards: card, card-body, card-title
   - Forms: input, select, textarea
   - Alerts: alert, alert-info, alert-success, etc.
   - Modals: modal, modal-box
   - Dropdowns: dropdown, dropdown-content
   - Tabs: tabs, tab
   - Loading states: loading, loading-spinner

COLOR SCHEME REQUIREMENTS:
1. Generate a visually appealing and accessible color scheme
2. Ensure sufficient contrast between text and background colors (minimum 4.5:1 for normal text, 3:1 for large text)
3. Primary colors should be bold and attention-grabbing
4. Secondary colors should complement the primary colors
5. Accent colors should provide visual interest and highlight important elements
6. Base colors should provide a clean, readable foundation
7. State colors should be clearly distinguishable (info, success, warning, error)
8. Content colors (--pc, --sc, --ac, --nc, --bc) must have excellent contrast with their backgrounds

The color scheme must work with DaisyUI's theme system using these variables:
- Primary: --p, --pf (focus), --pc (content)
- Secondary: --s, --sf (focus), --sc (content)
- Accent: --a, --af (focus), --ac (content)
- Neutral: --n, --nf (focus), --nc (content)
- Base: --b1, --b2, --b3, --bc (content)
- State: --in, --su, --wa, --er

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
    "primary-focus": "hex color (darker shade of primary for focus/hover)",
    "primary-content": "hex color (text color on primary background)",
    "secondary": "hex color (for supporting elements)",
    "secondary-focus": "hex color (darker shade of secondary for focus/hover)",
    "secondary-content": "hex color (text color on secondary background)",
    "accent": "hex color (for attention-grabbing elements)",
    "accent-focus": "hex color (darker shade of accent for focus/hover)",
    "accent-content": "hex color (text color on accent background)",
    "neutral": "hex color (for neutral elements)",
    "neutral-focus": "hex color (darker shade of neutral for focus/hover)",
    "neutral-content": "hex color (text color on neutral background)",
    "base-100": "hex color (main background color)",
    "base-200": "hex color (slightly darker background)",
    "base-300": "hex color (even darker background)",
    "base-content": "hex color (main text color)",
    "info": "hex color (for informational elements)",
    "success": "hex color (for success states)",
    "warning": "hex color (for warning states)",
    "error": "hex color (for error states)"
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
      reasoning_effort: 'medium'
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    try {
      const mockupData = JSON.parse(content);

      // Validate mockup data structure
      if (!mockupData.code || !mockupData.colorScheme || !mockupData.components || !mockupData.features || !mockupData.nextSteps) {
        throw new Error('Invalid mockup data received');
      }

      // Ensure all required color scheme properties exist
      const requiredColors = [
        'primary',
        'primary-focus',
        'primary-content',
        'secondary',
        'secondary-focus',
        'secondary-content',
        'accent',
        'accent-focus',
        'accent-content',
        'neutral',
        'neutral-focus',
        'neutral-content',
        'base-100',
        'base-200',
        'base-300',
        'base-content',
        'info',
        'success',
        'warning',
        'error'
      ];

      // Fill in any missing colors with defaults
      const defaultColors: Record<string, string> = {
        'primary': '#374151',
        'primary-focus': '#1F2937',
        'primary-content': '#FFFFFF',
        'secondary': '#6B7280',
        'secondary-focus': '#4B5563',
        'secondary-content': '#FFFFFF',
        'accent': '#111827',
        'accent-focus': '#030712',
        'accent-content': '#FFFFFF',
        'neutral': '#4B5563',
        'neutral-focus': '#374151',
        'neutral-content': '#FFFFFF',
        'base-100': '#FFFFFF',
        'base-200': '#F3F4F6',
        'base-300': '#E5E7EB',
        'base-content': '#111827',
        'info': '#4B5563',
        'success': '#374151',
        'warning': '#6B7280',
        'error': '#1F2937'
      };

      // Ensure all required colors exist, use defaults if missing
      requiredColors.forEach(color => {
        if (!mockupData.colorScheme[color]) {
          mockupData.colorScheme[color] = defaultColors[color];
        }
      });

      // Remove inline type assertions from the code
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
