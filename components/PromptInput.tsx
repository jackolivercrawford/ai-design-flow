// components/PromptInput.tsx
import React, { useState, ChangeEvent } from 'react';
import { QASettings, KnowledgeBaseSource } from '@/types/settings';
import { v4 as uuidv4 } from 'uuid';

interface PromptInputProps {
  onSubmit: (prompt: string, settings: QASettings) => void;
}

const PromptInput: React.FC<PromptInputProps> = ({ onSubmit }) => {
  const [prompt, setPrompt] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<QASettings>({
    traversalMode: 'bfs',
    knowledgeBase: []
  });
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [pastedContent, setPastedContent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      setShowSettings(true);
    }
  };

  const handleStartQA = () => {
    onSubmit(prompt, settings);
  };

  const processKnowledgeBase = async (type: 'file' | 'text', data: File | string, name: string) => {
    try {
      setIsProcessingFile(true);
      const formData = new FormData();
      formData.append('type', type);
      
      if (type === 'file') {
        formData.append('file', data as File);
      } else {
        formData.append('content', data as string);
      }

      const response = await fetch('/api/process-knowledge-base', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process knowledge base');
      }

      const result = await response.json();
      
      const newSource: KnowledgeBaseSource = {
        id: uuidv4(),
        type,
        name,
        ...(type === 'file' ? { file: data as File } : { content: data as string }),
        processedContent: result.processedContent
      };

      setSettings(prev => ({
        ...prev,
        knowledgeBase: [...(prev.knowledgeBase || []), newSource]
      }));
    } catch (error) {
      console.error('Error processing knowledge base:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    await processKnowledgeBase('file', file, file.name);
  };

  const handleTextAdd = async () => {
    if (pastedContent.trim()) {
      await processKnowledgeBase('text', pastedContent, `Pasted content ${new Date().toLocaleString()}`);
      setPastedContent('');
    }
  };

  const removeKnowledgeSource = (id: string) => {
    setSettings(prev => ({
      ...prev,
      knowledgeBase: prev.knowledgeBase?.filter(source => source.id !== id)
    }));
  };

  const handleSettingChange = (
    setting: keyof QASettings,
    value: string | number | { file: File; processedContent: any } | undefined
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
              Knowledge Base Sources
            </label>
            <div className="space-y-4">
              {/* File Upload */}
              <div className="space-y-2">
                <input
                  type="file"
                  className="w-full text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(file);
                    }
                  }}
                  disabled={isProcessingFile}
                />
                <p className="text-xs text-gray-500">
                  Supported formats: PDF, DOC, DOCX, TXT
                </p>
              </div>

              {/* Text Input */}
              <div className="space-y-2">
                <textarea
                  value={pastedContent}
                  onChange={(e) => setPastedContent(e.target.value)}
                  placeholder="Paste additional content here..."
                  className="w-full h-32 p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  disabled={isProcessingFile}
                />
                <button
                  onClick={handleTextAdd}
                  disabled={!pastedContent.trim() || isProcessingFile}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                >
                  Add Text Content
                </button>
              </div>

              {/* Processing Indicator */}
              {isProcessingFile && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Processing content...</span>
                </div>
              )}

              {/* Knowledge Base List */}
              {settings.knowledgeBase && settings.knowledgeBase.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Added Sources:</h4>
                  <div className="space-y-2">
                    {settings.knowledgeBase.map((source) => (
                      <div
                        key={source.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">
                            {source.type === 'file' ? '📄' : '📝'}
                          </span>
                          <span className="text-sm text-gray-800">{source.name}</span>
                        </div>
                        <button
                          onClick={() => removeKnowledgeSource(source.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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