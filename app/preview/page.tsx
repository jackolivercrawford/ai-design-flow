'use client';

import { useState } from 'react';
import PreviewArea from '@/components/PreviewArea';
import HeaderToolbar from '@/components/HeaderToolbar';

export default function PreviewPage() {
  const [generatedContent, setGeneratedContent] = useState({
    requirements: '',
    uiCode: '',
  });

  return (
    <div className="min-h-screen flex flex-col">
      <HeaderToolbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Generated Preview</h1>
        <PreviewArea
          requirements={generatedContent.requirements}
          uiCode={generatedContent.uiCode}
        />
      </main>
    </div>
  );
} 