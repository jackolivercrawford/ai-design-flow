'use client';

import { useState } from 'react';
import Canvas from '@/components/Canvas';
import QAPanel from '@/components/QAPanel';
import HeaderToolbar from '@/components/HeaderToolbar';

export default function QnAPage() {
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [answers, setAnswers] = useState<Array<{ question: string; answer: string }>>([]);

  const handleAnswer = async (answer: string) => {
    // TODO: Handle answer submission and generate next question
    setAnswers([...answers, { question: currentQuestion, answer }]);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <HeaderToolbar />
      <main className="flex-1 grid grid-cols-[2fr,1fr] gap-4 p-4">
        <Canvas answers={answers} />
        <QAPanel
          currentQuestion={currentQuestion}
          onSubmitAnswer={handleAnswer}
        />
      </main>
    </div>
  );
} 