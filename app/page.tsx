// app/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import PromptInput from '@/components/PromptInput';
import { QASettings } from '@/types/settings';

export default function PromptPage() {
  const router = useRouter();

  const handlePromptSubmit = (prompt: string, settings: QASettings) => {
    console.log("User prompt:", prompt);
    console.log("Settings:", settings);
    // Save both prompt and settings in localStorage
    localStorage.setItem('designPrompt', prompt);
    localStorage.setItem('qaSettings', JSON.stringify(settings));
    router.push('/qna');
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 px-4">
      {/* Header */}
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-800">Welcome to AI Design Flow</h1>
        <p className="mt-4 text-lg text-gray-600">
          Enter your design prompt to kick off your interactive design journey.
        </p>
      </header>
      
      {/* Prompt Input */}
      <div className="w-full max-w-2xl">
        <PromptInput onSubmit={handlePromptSubmit} />
      </div>
    </div>
  );
}
