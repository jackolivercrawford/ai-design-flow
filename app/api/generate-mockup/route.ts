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
          content: `You are an expert UI developer specializing in industrial and control system interfaces. Your task is to generate a complete, production-ready React component mockup based on the provided requirements. You MUST use React with Tailwind CSS and DaisyUI for styling. DaisyUI is already included via CDN in the preview environment.

CRITICAL: YOU MUST USE DAISYUI COMPONENTS AND GRAYSCALE CLASSES INSTEAD OF RAW TAILWIND CLASSES. For example:

❌ WRONG (raw Tailwind):
\`\`\`tsx
<div className="p-4 bg-blue-600 text-white rounded-lg shadow-lg">
  <h2 className="text-2xl font-bold text-gray-900 mb-4">Title</h2>
  <button className="px-4 py-2 bg-blue-500 text-white rounded">Click me</button>
</div>
\`\`\`

✅ CORRECT (DaisyUI):
\`\`\`tsx
<div className="card bg-base-100">
  <div className="card-body">
    <h2 className="card-title text-base-content">Title</h2>
    <div className="card-actions">
      <button className="btn">Click me</button>
    </div>
  </div>
</div>
\`\`\`

COLOR USAGE RULES:
1. NEVER use Tailwind color classes (e.g. bg-blue-600, text-gray-900)
2. ALWAYS use DaisyUI base classes for grayscale design:
   - Backgrounds: \`bg-base-100\`, \`bg-base-200\`, \`bg-base-300\`
   - Text: \`text-base-content\`
   - Borders: \`border-base-300\`

3. Common patterns:
   - Main background: \`bg-base-100\`
   - Card background: \`bg-base-200\`
   - Inset/pressed areas: \`bg-base-300\`
   - All text: \`text-base-content\`
   - Buttons: \`btn\` (no color modifiers)
   - Links: \`hover:bg-base-200\`
   - Borders: \`border-base-300\`

REQUIRED DAISYUI COMPONENTS:
1. Layout & Containers:
   - Cards: \`card\`, \`card-body\`, \`card-title\`, \`card-actions\`
   - Hero: \`hero\`, \`hero-content\`
   - Divider: \`divider\`

2. Navigation & Actions:
   - Buttons: \`btn\` (no color modifiers)
   - Menu: \`menu\`, \`menu-title\`, \`menu-item\`
   - Tabs: \`tabs\`, \`tab\`, \`tab-active\`

3. Data Display:
   - Stats: \`stats\`, \`stat\`, \`stat-title\`, \`stat-value\`, \`stat-desc\`
   - Badge: \`badge\`

4. Form Elements:
   - Input: \`input input-bordered\`
   - Select: \`select select-bordered\`
   - Range: \`range\`
   - Toggle: \`toggle\`
   - Checkbox: \`checkbox\`
   - Radio: \`radio\`

5. Loading States:
   - \`loading\`, \`loading-spinner\`, \`loading-dots\`

CRITICAL COMPONENT STRUCTURE REQUIREMENTS:
1. The component MUST be named with an uppercase first letter (e.g., 'MainInterface', 'ControlPanel')
2. The component MUST be a function component with this exact structure:
   \`\`\`tsx
   function ComponentName() {
     // Your component logic here
     return (
       // Your JSX here
     );
   }
   \`\`\`
3. The component MUST have a default export at the end:
   \`export default ComponentName;\`

Guidelines:
1. Use React as the core technology.
2. Use DaisyUI components as the PRIMARY building blocks - avoid raw Tailwind classes when DaisyUI components exist.
3. Follow modern design principles while maintaining a clean, minimal aesthetic.
4. Ensure the UI is responsive and accessible.
5. Include comments explaining key design decisions.
6. Structure the code in a clean, maintainable way.
7. Use semantic HTML elements.
8. Include hover states and proper spacing.
9. Keep the design monochromatic using only base classes.
10. Include TypeScript types as comments only (avoid inline type assertions).

CRITICAL REQUIREMENTS FOR DAISYUI USAGE:
1. ALL buttons MUST use DaisyUI button classes:
   - Main actions: \`btn\`
   - Secondary/ghost actions: \`btn btn-ghost\`
   - Outline actions: \`btn btn-outline\`

2. ALL cards/panels MUST use DaisyUI card classes:
   - Container: \`card\`
   - Body: \`card-body\`
   - Title: \`card-title\`
   - Actions: \`card-actions\`

3. ALL form controls MUST use DaisyUI classes:
   - Inputs: \`input input-bordered\`
   - Select: \`select select-bordered\`
   - Range: \`range\`
   - Toggle: \`toggle\`
   - Checkbox: \`checkbox\`
   - Radio: \`radio\`

4. ALL stats/metrics MUST use DaisyUI stat components:
   - Container: \`stats\`
   - Individual stat: \`stat\`
   - Stat title: \`stat-title\`
   - Stat value: \`stat-value\`
   - Stat description: \`stat-desc\`

5. Proper use of DaisyUI modifiers:
   - Sizes: \`btn-lg\`, \`btn-sm\`, \`input-lg\`, etc.
   - Styles: \`btn-outline\`, \`btn-ghost\`, etc.

Return your response in this exact JSON format:
{
  "code": "Complete React/Tailwind/DaisyUI component code as shown in the example above",
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
      if (!mockupData.code || !mockupData.components || !mockupData.features || !mockupData.nextSteps) {
        throw new Error('Invalid mockup data received');
      }

      // Add default grayscale color scheme
      mockupData.colorScheme = {
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
        'base-content': '#111827'
      };

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
