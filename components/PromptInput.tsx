// components/PromptInput.tsx
import React, { useState, ChangeEvent } from 'react';
import { QASettings } from '@/types/settings';

interface PromptInputProps {
  onSubmit: (prompt: string, settings: QASettings) => void;
}

const PromptInput: React.FC<PromptInputProps> = ({ onSubmit }) => {
  const [prompt, setPrompt] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<QASettings>({
    traversalMode: 'bfs',
    unknownHandling: 'auto',
    conflictResolution: 'auto'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      setShowSettings(true);
    }
  };

  const handleStartQA = () => {
    onSubmit(prompt, settings);
  };

  const handleSettingChange = (
    setting: keyof QASettings,
    value: string | number | File | undefined
  ) => {
    setSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  if (showSettings) {
    return (
      <div className="p-8 w-full max-w-2xl">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Your Prompt:</h3>
          <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{prompt}</p>
          <button
            onClick={() => setShowSettings(false)}
            className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
          >
            Edit Prompt
          </button>
        </div>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Traversal Mode
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="traversalMode"
                  value="bfs"
                  checked={settings.traversalMode === 'bfs'}
                  onChange={(e) => handleSettingChange('traversalMode', e.target.value)}
                  className="mr-2"
                />
                <span className="text-gray-900">Breadth-First</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="traversalMode"
                  value="dfs"
                  checked={settings.traversalMode === 'dfs'}
                  onChange={(e) => handleSettingChange('traversalMode', e.target.value)}
                  className="mr-2"
                />
                <span className="text-gray-900">Depth-First</span>
              </label>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unknown Handling
            </label>
            <select 
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 bg-white"
              value={settings.unknownHandling}
              onChange={(e) => handleSettingChange('unknownHandling', e.target.value)}
            >
              <option value="auto">Auto (trivial)</option>
              <option value="prompt">Always Prompt</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conflict Resolution
            </label>
            <select 
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 bg-white"
              value={settings.conflictResolution}
              onChange={(e) => handleSettingChange('conflictResolution', e.target.value)}
            >
              <option value="auto">Auto-resolve Minor</option>
              <option value="manual">Manual Resolution</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Questions
            </label>
            <input
              type="number"
              min="1"
              placeholder="Optional"
              className="w-full border border-gray-300 rounded-lg p-2 text-gray-900 bg-white"
              value={settings.maxQuestions || ''}
              onChange={(e) => handleSettingChange('maxQuestions', e.target.value ? parseInt(e.target.value) : undefined)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Knowledge Base (Optional)
            </label>
            <input
              type="file"
              className="w-full text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                handleSettingChange('knowledgeBase', file);
              }}
            />
          </div>

          <button
            onClick={handleStartQA}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Start Q&A
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label htmlFor="prompt" className="text-xl font-bold text-gray-900">
          Enter your design prompt:
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Design the interface for a 1000-floor elevator"
          className="border border-gray-300 p-4 rounded-lg h-48 text-gray-900 text-base resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        />
        <button 
          type="submit" 
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Configure Settings
        </button>
      </form>
    </div>
  );
};

export default PromptInput;