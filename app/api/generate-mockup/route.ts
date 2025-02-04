import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, answers } = await request.json();

    // TODO: Implement mockup generation logic
    const generatedContent = {
      requirements: '- Requirement 1\n- Requirement 2\n- Requirement 3',
      uiCode: '<div>Sample UI Code</div>',
    };

    return NextResponse.json(generatedContent);
  } catch (error) {
    console.error('Error generating mockup:', error);
    return NextResponse.json(
      { error: 'Failed to generate mockup' },
      { status: 500 }
    );
  }
} 