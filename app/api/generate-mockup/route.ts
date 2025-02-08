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

Return your response in this exact JSON format:
{
  "code": "Complete React/Tailwind component code",
  "colorScheme": {
    "primary": "hex color",
    "secondary": "hex color",
    "accent": "hex color",
    "background": "hex color",
    "text": "hex color"
  },
  "components": ["List of reusable components created"],
  "features": ["List of implemented features"],
  "nextSteps": ["Suggested improvements or additions"]
}`
        },
        {
          role: "user",
          content: `Design Prompt: ${requirementsDoc.prompt}

Requirements:
${formattedRequirements}

Generate a complete React/Tailwind mockup that satisfies these requirements. The mockup should be immediately usable and include all necessary types and styling.`
        }
      ],
      max_completion_tokens: 4000,
      response_format: { type: "json_object" },
      reasoning_effort: 'medium'
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    try {
      const mockupData = JSON.parse(content);
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