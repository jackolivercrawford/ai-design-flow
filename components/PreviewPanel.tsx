import { RequirementsDocument, MockupVersion } from '@/types';
import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface MockupData {
  code: string;
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  components: string[];
  features: string[];
  nextSteps: string[];
}

interface PreviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  requirementsDoc: RequirementsDocument;
  isGenerating: boolean;
  qaTree: any;
  onVersionRestore?: (version: MockupVersion) => void;
}

export default function PreviewPanel({
  isOpen,
  onClose,
  requirementsDoc,
  isGenerating,
  qaTree,
  onVersionRestore
}: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<'requirements' | 'mockup' | 'versions'>('requirements');
  const [mockupData, setMockupData] = useState<MockupData | null>(null);
  const [isMockupLoading, setIsMockupLoading] = useState(false);
  const [versions, setVersions] = useState<MockupVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<MockupVersion | null>(null);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareVersion, setCompareVersion] = useState<MockupVersion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load versions from localStorage
    try {
      const storedVersions = localStorage.getItem('mockupVersions');
      if (storedVersions) {
        setVersions(JSON.parse(storedVersions));
      }
    } catch (error) {
      console.error('Error loading versions:', error);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'mockup' && !mockupData && !isMockupLoading && !error) {
      generateMockup();
    }
  }, [activeTab, mockupData, isMockupLoading, error]);

  const generateMockup = async () => {
    setIsMockupLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/generate-mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirementsDoc })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        throw new Error(errorData.error || 'Failed to generate mockup');
      }

      const data = await response.json();
      
      // Validate mockup data structure
      if (!data.code || !data.colorScheme || !data.components || !data.features || !data.nextSteps) {
        throw new Error('Invalid mockup data received');
      }

      setMockupData(data);

      // Create new version
      const newVersion: MockupVersion = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        qaTree,
        requirementsDoc,
        mockupData: data
      };

      // Add to versions and save to localStorage
      const updatedVersions = [...versions, newVersion];
      setVersions(updatedVersions);
      localStorage.setItem('mockupVersions', JSON.stringify(updatedVersions));

    } catch (error) {
      console.error('Error generating mockup:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate mockup');
    } finally {
      setIsMockupLoading(false);
    }
  };

  const handleVersionSelect = (version: MockupVersion) => {
    setSelectedVersion(version);
    setMockupData(version.mockupData);
  };

  const handleVersionRestore = (version: MockupVersion) => {
    if (onVersionRestore) {
      onVersionRestore(version);
    }
  };

  const handleCompareSelect = (version: MockupVersion) => {
    setCompareVersion(version);
    setIsCompareMode(true);
  };

  const handleCopyCode = () => {
    if (mockupData?.code) {
      navigator.clipboard.writeText(mockupData.code);
    }
  };

  const handleDownload = () => {
    if (activeTab === 'requirements') {
      // Download requirements as markdown
      const requirementsText = Object.entries(requirementsDoc.categories)
        .map(([key, category]) => {
          const reqs = category.requirements
            .map(req => `- ${req.text} (${req.priority} priority)`)
            .join('\n');
          return `## ${category.title}\n${reqs}`;
        })
        .join('\n\n');

      const content = `# ${requirementsDoc.prompt}\n\n${requirementsText}`;
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'requirements.md';
      a.click();
      URL.revokeObjectURL(url);
    } else if (mockupData?.code) {
      // Download mockup as TypeScript file
      const blob = new Blob([mockupData.code], { type: 'text/typescript' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mockup.tsx';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
      <div className={`${isCompareMode ? 'w-4/5' : 'w-2/5'} bg-white h-full shadow-lg flex flex-col`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('requirements')}
              className={`px-4 py-2 rounded-lg ${
                activeTab === 'requirements'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Requirements
            </button>
            <button
              onClick={() => setActiveTab('mockup')}
              className={`px-4 py-2 rounded-lg ${
                activeTab === 'mockup'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Mockup
            </button>
            <button
              onClick={() => setActiveTab('versions')}
              className={`px-4 py-2 rounded-lg ${
                activeTab === 'versions'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Versions ({versions.length})
            </button>
          </div>
          <div className="flex space-x-4">
            {activeTab === 'versions' && selectedVersion && (
              <>
                <button
                  onClick={() => handleVersionRestore(selectedVersion)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Restore Version
                </button>
                <button
                  onClick={() => handleCompareSelect(selectedVersion)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Compare
                </button>
              </>
            )}
            <button
              onClick={() => {
                setIsCompareMode(false);
                setCompareVersion(null);
                onClose();
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {error ? (
            <div className="p-6 text-center">
              <div className="text-red-600 mb-4">{error}</div>
              <button
                onClick={() => {
                  setError(null);
                  generateMockup();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          ) : isGenerating || isMockupLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="text-gray-600">
                  {isGenerating ? 'Generating preview...' : 'Generating mockup...'}
                </p>
              </div>
            </div>
          ) : activeTab === 'versions' ? (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Version History</h2>
              <div className="space-y-4">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedVersion?.id === version.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                    onClick={() => handleVersionSelect(version)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">
                          Version from {new Date(version.timestamp).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {version.requirementsDoc.categories.basicNeeds.requirements.length} requirements,{' '}
                          {version.mockupData.components.length} components
                        </p>
                      </div>
                      {version.name && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                          {version.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={`flex ${isCompareMode ? 'space-x-4' : ''}`}>
              <div className={`${isCompareMode ? 'w-1/2' : 'w-full'} p-6`}>
                {activeTab === 'requirements' ? (
                  <div className="space-y-8">
                    <div className="prose max-w-none">
                      <h1 className="text-2xl font-bold text-gray-900 mb-4">
                        {requirementsDoc.prompt}
                      </h1>
                      <p className="text-sm text-gray-500 mb-8">
                        Last updated: {new Date(requirementsDoc.lastUpdated).toLocaleString()}
                      </p>
                    </div>

                    {Object.entries(requirementsDoc.categories).map(([key, category]) => (
                      <div key={key} className="space-y-4">
                        <h2 className="text-xl font-semibold text-gray-900">
                          {category.title}
                        </h2>
                        {category.requirements && category.requirements.length > 0 ? (
                          <ul className="space-y-3">
                            {category.requirements.map((req, index) => (
                              <li
                                key={req.id || `${key}-${index}-${req.text}`}
                                className="bg-white rounded-lg border border-gray-200 p-4"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="text-gray-900">{req.text}</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {req.priority && (
                                        <span className={`px-2 py-1 rounded-full text-xs ${
                                          req.priority === 'high'
                                            ? 'bg-red-100 text-red-800'
                                            : req.priority === 'medium'
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : 'bg-green-100 text-green-800'
                                        }`}>
                                          {req.priority} priority
                                        </span>
                                      )}
                                      {req.category && (
                                        <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                          {req.category}
                                        </span>
                                      )}
                                      {req.tags?.map((tag, tagIndex) => (
                                        <span
                                          key={`${req.id || index}-tag-${tagIndex}`}
                                          className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800"
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-500 italic">No requirements in {category.title}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : mockupData ? (
                  <div className="space-y-8">
                    {/* Color Scheme */}
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-4">Color Scheme</h2>
                      <div className="flex flex-wrap gap-4">
                        {Object.entries(mockupData.colorScheme).map(([name, color]) => (
                          <div key={name} className="flex flex-col items-center">
                            <div
                              className="w-16 h-16 rounded-lg shadow-md"
                              style={{ backgroundColor: color }}
                            />
                            <span className="mt-2 text-sm text-gray-600">{name}</span>
                            <span className="text-xs text-gray-400">{color}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Components */}
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-4">Components</h2>
                      <ul className="list-disc list-inside space-y-2">
                        {mockupData.components.map((component, index) => (
                          <li key={index} className="text-gray-700">{component}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Features */}
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-4">Implemented Features</h2>
                      <ul className="list-disc list-inside space-y-2">
                        {mockupData.features.map((feature, index) => (
                          <li key={index} className="text-gray-700">{feature}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Code */}
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-4">Generated Code</h2>
                      <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-sm">
                        <code className="text-gray-800">{mockupData.code}</code>
                      </pre>
                    </div>

                    {/* Next Steps */}
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-4">Next Steps</h2>
                      <ul className="list-disc list-inside space-y-2">
                        {mockupData.nextSteps.map((step, index) => (
                          <li key={index} className="text-gray-700">{step}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </div>
              {isCompareMode && compareVersion && (
                <div className="w-1/2 p-6 border-l border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Comparing with version from {new Date(compareVersion.timestamp).toLocaleString()}
                  </h2>
                  {/* Render comparison content */}
                  {activeTab === 'requirements' ? (
                    <div className="space-y-8">
                      {/* ... requirements comparison rendering ... */}
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {/* ... mockup comparison rendering ... */}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex justify-between">
            <button
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
              onClick={handleDownload}
            >
              Download {activeTab === 'requirements' ? 'Requirements' : 'Code'}
            </button>
            {activeTab === 'mockup' && mockupData && (
              <div className="flex space-x-4">
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  onClick={handleCopyCode}
                >
                  Copy Code
                </button>
                <button
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  onClick={() => {
                    // TODO: Implement Figma export
                    alert('Figma export coming soon!');
                  }}
                >
                  Export to Figma
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 