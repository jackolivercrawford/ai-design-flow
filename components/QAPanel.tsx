import { useState } from 'react';

interface QAPanelProps {
  currentQuestion: string;
  onSubmitAnswer: (answer: string) => void;
}

export default function QAPanel({ currentQuestion, onSubmitAnswer }: QAPanelProps) {
  const [answer, setAnswer] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answer.trim()) {
      onSubmitAnswer(answer);
      setAnswer('');
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-lg">
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-2">Current Question:</h3>
        <p className="text-gray-700">{currentQuestion}</p>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full h-32 p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Type your answer..."
          />
          <button
            type="submit"
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Submit Answer
          </button>
        </div>
      </form>
    </div>
  );
} 