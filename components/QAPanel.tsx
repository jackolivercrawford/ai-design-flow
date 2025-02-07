import { useState } from 'react';

interface SuggestedAnswer {
  text: string;
  confidence: 'high' | 'medium' | 'low';
  sourceReferences?: number[];
}

interface QAPanelProps {
  currentQuestion: string;
  onSubmitAnswer: (answer: string) => void;
  isLoading: boolean;
  hasKnowledgeBase: boolean;
  onAutoPopulate: () => Promise<string | null>;
  suggestedAnswer?: SuggestedAnswer | null;
}

export default function QAPanel({ 
  currentQuestion, 
  onSubmitAnswer, 
  isLoading,
  hasKnowledgeBase,
  onAutoPopulate,
  suggestedAnswer
}: QAPanelProps) {
  const [answer, setAnswer] = useState('');
  const [isAutoPopulating, setIsAutoPopulating] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answer.trim()) {
      onSubmitAnswer(answer);
      setAnswer('');
    }
  };

  const handleAutoPopulate = async () => {
    setIsAutoPopulating(true);
    try {
      const suggestedAnswer = await onAutoPopulate();
      if (suggestedAnswer) {
        setAnswer(suggestedAnswer);
      } else {
        alert('No relevant information found in the knowledge base. Please provide your expert answer.');
      }
    } catch (error) {
      console.error('Error generating answer:', error);
      alert('There was an error accessing the knowledge base. Please provide your answer manually.');
    } finally {
      setIsAutoPopulating(false);
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
        <div className="mb-4 p-4 rounded-lg border border-gray-200">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-medium">Suggested Answer</h4>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                suggestedAnswer.confidence === 'high' 
                  ? 'bg-green-100 text-green-800'
                  : suggestedAnswer.confidence === 'medium'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {suggestedAnswer.confidence} confidence
              </span>
            </div>
            <p className="text-sm">{suggestedAnswer.text}</p>
            {suggestedAnswer.sourceReferences && suggestedAnswer.sourceReferences.length > 0 && (
              <p className="text-xs mt-2 text-gray-600">
                Sources: {suggestedAnswer.sourceReferences.map(ref => `#${ref + 1}`).join(', ')}
              </p>
            )}
            <button
              onClick={handleAutoPopulate}
              className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Use This Answer
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {hasKnowledgeBase && (
            <button
              type="button"
              onClick={handleAutoPopulate}
              disabled={isLoading || isAutoPopulating}
              className={`w-full px-4 py-2 rounded-lg transition-colors ${
                isLoading || isAutoPopulating
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              } text-white flex items-center justify-center gap-2`}
            >
              {isAutoPopulating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Finding Best Answer...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Get Suggested Answer</span>
                </>
              )}
            </button>
          )}
          
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full h-32 p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            placeholder="Type your answer or use the suggestion button above..."
            disabled={isLoading || isAutoPopulating}
          />
          <button
            type="submit"
            className={`w-full px-4 py-2 rounded-lg transition-colors ${
              isLoading || isAutoPopulating || !answer.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white`}
            disabled={isLoading || isAutoPopulating || !answer.trim()}
          >
            Submit Answer
          </button>
        </div>
      </form>
    </div>
  );
} 