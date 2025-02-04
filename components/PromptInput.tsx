// components/PromptInput.tsx
import React, { useState } from 'react';

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
}

const PromptInput: React.FC<PromptInputProps> = ({ onSubmit }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt);
      setPrompt('');
    }
  };

  return (
    <div className="p-8 w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label htmlFor="prompt" className="text-xl font-bold text-white">
          Enter your design prompt:
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Design the interface for a 1000-floor elevator"
          className="border border-gray-300 p-4 rounded-lg h-48 text-gray-900 text-base resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button 
          type="submit" 
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Start Q&A
        </button>
      </form>
    </div>
  );
};

export default PromptInput;