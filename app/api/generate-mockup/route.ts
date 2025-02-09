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

CRITICAL: YOU MUST USE DAISYUI COMPONENTS INSTEAD OF RAW TAILWIND CLASSES. For example:

❌ WRONG (raw Tailwind):
\`\`\`tsx
<div className="p-4 bg-white rounded-lg shadow-lg">
  <h2 className="text-2xl font-bold mb-4">Title</h2>
  <button className="px-4 py-2 bg-blue-500 text-white rounded">Click me</button>
</div>
\`\`\`

✅ CORRECT (DaisyUI components):
\`\`\`tsx
<div className="card bg-base-100">
  <div className="card-body">
    <h2 className="card-title">Title</h2>
    <div className="card-actions">
      <button className="btn btn-primary">Click me</button>
    </div>
  </div>
</div>
\`\`\`

REQUIRED DAISYUI COMPONENTS:
1. Layout & Containers:
   - Cards: \`card\`, \`card-body\`, \`card-title\`, \`card-actions\`
   - Hero: \`hero\`, \`hero-content\`
   - Divider: \`divider\`

2. Navigation & Actions:
   - Buttons: \`btn\`, \`btn-primary\`, \`btn-secondary\`, etc.
   - Menu: \`menu\`, \`menu-title\`, \`menu-item\`
   - Tabs: \`tabs\`, \`tab\`, \`tab-active\`

3. Data Display:
   - Stats: \`stats\`, \`stat\`, \`stat-title\`, \`stat-value\`, \`stat-desc\`
   - Alert: \`alert\`, \`alert-info\`, \`alert-success\`, etc.
   - Badge: \`badge\`, \`badge-primary\`, etc.

4. Form Elements:
   - Input: \`input\`, \`input-bordered\`
   - Select: \`select\`, \`select-bordered\`
   - Toggle: \`toggle\`
   - Checkbox: \`checkbox\`
   - Radio: \`radio\`

5. Loading States:
   - \`loading\`, \`loading-spinner\`, \`loading-dots\`

Example of a proper DaisyUI industrial control panel:
\`\`\`tsx
function ControlPanel() {
  return (
    <div className="p-4">
      {/* Main Card */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Control Panel</h2>
          
          {/* Status Display */}
          <div className="stats shadow">
            <div className="stat">
              <div className="stat-title">System Status</div>
              <div className="stat-value">Operational</div>
              <div className="stat-desc">All systems nominal</div>
            </div>
          </div>
          
          {/* Alerts */}
          <div className="alert alert-info">
            <span>System running at optimal efficiency</span>
          </div>
          
          {/* Controls */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Power Level</span>
            </label>
            <input type="range" className="range range-primary" />
          </div>
          
          {/* Action Buttons */}
          <div className="card-actions justify-end">
            <button className="btn btn-error">Emergency Stop</button>
            <button className="btn btn-primary">Start System</button>
          </div>
        </div>
      </div>
    </div>
  );
}
\`\`\`

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
3. Follow modern design principles while maintaining an industrial/control system aesthetic.
4. Ensure the UI is responsive and accessible.
5. Include comments explaining key design decisions.
6. Structure the code in a clean, maintainable way.
7. Use semantic HTML elements.
8. Include hover states, transitions, and proper spacing.
9. Generate a comprehensive color scheme that works with DaisyUI.
10. Include TypeScript types as comments only (avoid inline type assertions).

CRITICAL REQUIREMENTS FOR DAISYUI USAGE:
1. ALL buttons MUST use DaisyUI button classes:
   - Primary actions: \`btn btn-primary\`
   - Secondary actions: \`btn btn-secondary\`
   - Accent actions: \`btn btn-accent\`
   - Emergency/Critical: \`btn btn-error\`
   - Info/Status: \`btn btn-info\`
   - Success/Confirm: \`btn btn-success\`
   - Warning/Caution: \`btn btn-warning\`

2. ALL cards/panels MUST use DaisyUI card classes:
   - Container: \`card\`
   - Body: \`card-body\`
   - Title: \`card-title\`
   - Actions: \`card-actions\`

3. ALL status indicators MUST use DaisyUI alerts:
   - Info states: \`alert alert-info\`
   - Success states: \`alert alert-success\`
   - Warning states: \`alert alert-warning\`
   - Error states: \`alert alert-error\`

4. ALL form controls MUST use DaisyUI classes:
   - Inputs: \`input input-bordered\`
   - Select: \`select select-bordered\`
   - Range: \`range\` (with appropriate color classes)
   - Toggle: \`toggle\` (with appropriate color classes)
   - Checkbox: \`checkbox\`
   - Radio: \`radio\`

5. ALL stats/metrics MUST use DaisyUI stat components:
   - Container: \`stats\`
   - Individual stat: \`stat\`
   - Stat title: \`stat-title\`
   - Stat value: \`stat-value\`
   - Stat description: \`stat-desc\`

6. ALL loading states MUST use DaisyUI loading classes:
   - \`loading loading-spinner\`
   - \`loading loading-dots\`
   - \`loading loading-ring\`
   - \`loading loading-ball\`

7. Proper use of DaisyUI modifiers:
   - Sizes: \`btn-lg\`, \`btn-sm\`, \`input-lg\`, etc.
   - Styles: \`btn-outline\`, \`btn-ghost\`, etc.
   - States: \`btn-disabled\`, \`input-error\`, etc.

COLOR SCHEME REQUIREMENTS:
1. Generate a visually appealing and accessible color scheme suitable for industrial/control interfaces
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

Return your response in this exact JSON format:
{
  "code": "Complete React/Tailwind/DaisyUI component code as shown in the example above",
  "colorScheme": {
    "primary": "#hex (for main actions and headers)",
    "primary-focus": "#hex (darker shade of primary for focus/hover)",
    "primary-content": "#hex (text color on primary background)",
    "secondary": "#hex (for supporting elements)",
    "secondary-focus": "#hex (darker shade of secondary for focus/hover)",
    "secondary-content": "#hex (text color on secondary background)",
    "accent": "#hex (for attention-grabbing elements)",
    "accent-focus": "#hex (darker shade of accent for focus/hover)",
    "accent-content": "#hex (text color on accent background)",
    "neutral": "#hex (for neutral elements)",
    "neutral-focus": "#hex (darker shade of neutral for focus/hover)",
    "neutral-content": "#hex (text color on neutral background)",
    "base-100": "#hex (main background color)",
    "base-200": "#hex (slightly darker background)",
    "base-300": "#hex (even darker background)",
    "base-content": "#hex (main text color)",
    "info": "#hex (for informational elements)",
    "success": "#hex (for success states)",
    "warning": "#hex (for warning states)",
    "error": "#hex (for error states)"
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
