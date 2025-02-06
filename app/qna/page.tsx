// app/qna/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Canvas from '@/components/Canvas';
import QAPanel from '@/components/QAPanel';
import HeaderToolbar from '@/components/HeaderToolbar';

interface QAItem {
  question: string;
  answer: string;
}

export default function QnAPage() {
  const [prompt, setPrompt] = useState<string>('');
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [answers, setAnswers] = useState<QAItem[]>([]);

  // Function to fetch a question from the API
  const fetchQuestion = async (designPrompt: string, previousQuestions: QAItem[]) => {
    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: designPrompt,
          previousQuestions: previousQuestions,
        }),
      });
      const data = await response.json();
      if (data.question) {
        setCurrentQuestion(data.question);
      } else {
        setCurrentQuestion('No question returned.');
      }
    } catch (error) {
      console.error('Error fetching question:', error);
      setCurrentQuestion('Error fetching question.');
    }
  };

  // On mount, retrieve the prompt and fetch the initial question.
  useEffect(() => {
    const storedPrompt = localStorage.getItem('designPrompt');
    if (storedPrompt) {
      setPrompt(storedPrompt);
      fetchQuestion(storedPrompt, []);
    } else {
      // If no prompt is found, redirect or handle the error accordingly.
      setCurrentQuestion('No design prompt found.');
    }
  }, []);

  // Handle the submission of an answer
  const handleAnswer = async (answer: string) => {
    // Append the current Q&A to our state
    const newAnswers = [...answers, { question: currentQuestion, answer }];
    setAnswers(newAnswers);
    // Fetch the next question using the design prompt and the updated Q&A history
    await fetchQuestion(prompt, newAnswers);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <HeaderToolbar />
      <main className="flex-1 grid grid-cols-[2fr,1fr] gap-4 p-4">
        <Canvas answers={answers} />
        <QAPanel currentQuestion={currentQuestion} onSubmitAnswer={handleAnswer} />
      </main>
    </div>
  );
}