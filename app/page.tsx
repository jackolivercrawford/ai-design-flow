// app/prompt/page.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import PromptInput from '../components/PromptInput';

const PromptPage: React.FC = () => {
  const router = useRouter();

  // Handle the prompt submission:
  const handlePromptSubmit = (prompt: string) => {
    console.log("User prompt:", prompt);
    router.push('/qna');
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <PromptInput onSubmit={handlePromptSubmit} />
    </div>
  );
};

export default PromptPage;
