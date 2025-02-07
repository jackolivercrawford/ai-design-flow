import { useState } from 'react';

interface QAPanelProps {
  currentQuestion: string;
  onSubmitAnswer: (answer: string) => void;
  isLoading: boolean;
  suggestedAnswer?: string | null;
}

export default function QAPanel({ currentQuestion, onSubmitAnswer, isLoading, suggestedAnswer }: QAPanelProps) {
  const [answer, setAnswer] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answer.trim()) {
      onSubmitAnswer(answer);
      setAnswer('');
    }
  };

  const handleUseSuggestion = () => {
    if (suggestedAnswer) {
      setAnswer(suggestedAnswer);
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-lg">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Current Question:</h3>
        {isLoading ? (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <p className="text-gray-600">Loading question...</p>
          </div>
        ) : (
          <p className="text-gray-800">{currentQuestion}</p>
        )}
      </div>

      {suggestedAnswer && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-sm font-medium text-blue-900 mb-1">Suggested Answer:</h4>
              <p className="text-sm text-blue-800">{suggestedAnswer}</p>
            </div>
            <button
              onClick={handleUseSuggestion}
              className="ml-4 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Use Suggestion
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full h-32 p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            placeholder="Type your answer..."
            disabled={isLoading}
          />
          <button
            type="submit"
            className={`w-full px-4 py-2 rounded-lg transition-colors ${
              isLoading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white`}
            disabled={isLoading}
          >
            Submit Answer
          </button>
        </div>
      </form>
    </div>
  );
} 