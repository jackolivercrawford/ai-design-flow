import { RequirementsDocument, MockupVersion } from '@/types';
import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import dynamic from 'next/dynamic';

// Dynamically import a component that will render the live preview
const LivePreview = dynamic(() => import('./LivePreview'), { ssr: false });

interface MockupData {
  code: string;
  colorScheme: {
    primary: string;
    'primary-focus': string;
    'primary-content': string;
    secondary: string;
    'secondary-focus': string;
    'secondary-content': string;
    accent: string;
    'accent-focus': string;
    'accent-content': string;
    neutral: string;
    'neutral-focus': string;
    'neutral-content': string;
    'base-100': string;
    'base-200': string;
    'base-300': string;
    'base-content': string;
    [key: string]: string; // Allow string indexing for dynamic access
  };
  components: string[];
  features: string[];
  nextSteps: string[];
}

interface PreviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  requirementsDoc: RequirementsDocument;
  qaTree: any;
  onVersionRestore?: (version: MockupVersion) => void;
}

// Helper function to ensure complete color scheme
const ensureCompleteColorScheme = (version: MockupVersion): MockupVersion => {
  const defaultColors: Record<string, string> = {
    'primary-focus': '#1E40AF',
    'primary-content': '#FFFFFF',
    'secondary-focus': '#475569',
    'secondary-content': '#FFFFFF',
    'accent-focus': '#D97706',
    'accent-content': '#FFFFFF',
    'neutral': '#3D4451',
    'neutral-focus': '#2A2E37',
    'neutral-content': '#FFFFFF',
    'base-100': '#FFFFFF',
    'base-200': '#F3F4F6',
    'base-300': '#E5E7EB',
    'base-content': '#1F2937'
  };

  return {
    ...version,
    mockupData: {
      ...version.mockupData,
      colorScheme: {
        ...defaultColors,
        ...version.mockupData.colorScheme,
      }
    }
  };
};

export default function PreviewPanel({
  isOpen,
  onClose,
  requirementsDoc,
  qaTree,
  onVersionRestore
}: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<'requirements' | 'mockup' | 'versions'>('requirements');
  const [mockupData, setMockupData] = useState<MockupData | null>(null);
  const [isMockupLoading, setIsMockupLoading] = useState(false);
  const [versions, setVersions] = useState<MockupVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<MockupVersion | null>(null);
  const [activeVersion, setActiveVersion] = useState<MockupVersion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevRequirementsRef = useRef<RequirementsDocument | null>(null);

  useEffect(() => {
    // Load versions from localStorage
    try {
      const storedVersions = localStorage.getItem('mockupVersions');
      if (storedVersions) {
        const parsedVersions = JSON.parse(storedVersions);
        setVersions(parsedVersions);
        // Set the most recent version as active if it exists
        if (parsedVersions.length > 0) {
          setActiveVersion(parsedVersions[parsedVersions.length - 1]);
        }
      }

      // Load current mockup state
      const currentMockup = localStorage.getItem('currentMockup');
      if (currentMockup) {
        setMockupData(JSON.parse(currentMockup));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, []);

  // Store the current requirements for comparison
  useEffect(() => {
    prevRequirementsRef.current = requirementsDoc;
  }, [requirementsDoc]);

  const generateMockup = async (saveCurrentVersion: boolean = false) => {
    setIsMockupLoading(true);
    setError(null);

    // If requested, save current version before generating new one
    if (saveCurrentVersion && mockupData) {
      const currentVersion: MockupVersion = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        qaTree,
        requirementsDoc,
        mockupData
      };

      const updatedVersions = [...versions, currentVersion];
      setVersions(updatedVersions);
      localStorage.setItem('mockupVersions', JSON.stringify(updatedVersions));
    }

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
      if (!data.code || !data.components || !data.features || !data.nextSteps) {
        throw new Error('Invalid mockup data received');
      }

      setMockupData(data);
      // Save current mockup state
      localStorage.setItem('currentMockup', JSON.stringify(data));

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
      
      // Set as active version and clear selected version
      setActiveVersion(newVersion);
      setSelectedVersion(null);

    } catch (error) {
      console.error('Error generating mockup:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate mockup');
    } finally {
      setIsMockupLoading(false);
    }
  };

  const handleVersionSelect = (version: MockupVersion) => {
    if (version.id === activeVersion?.id) {
      // If clicking the active version, just toggle selection
      setSelectedVersion(selectedVersion?.id === version.id ? null : version);
    } else {
      // If clicking a different version, select it
      setSelectedVersion(version);
    }
  };

  const handleVersionRestore = (version: MockupVersion) => {
    const completeVersion = ensureCompleteColorScheme(version);
    setMockupData(completeVersion.mockupData);
    setActiveVersion(completeVersion);
    setSelectedVersion(null);
    // Save restored mockup as current
    localStorage.setItem('currentMockup', JSON.stringify(completeVersion.mockupData));
    setActiveTab('mockup');
    
    if (onVersionRestore) {
      onVersionRestore(version);
    }
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

  const renderContent = () => {
    if (activeTab === 'mockup') {
      return (
        <>
          {/* Live Preview (Left Side) */}
          <div className="w-2/3 h-full border-r border-gray-200 bg-gray-50 overflow-auto">
            <div className="h-full">
              {mockupData ? (
                <LivePreview code={mockupData.code} colorScheme={mockupData.colorScheme} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Click "Generate Mockup" to create a mockup based on your requirements
                </div>
              )}
            </div>
          </div>

          {/* Details Panel (Right Side) */}
          <div className="w-1/3 h-full overflow-auto">
            <div className="p-6">
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
              ) : isMockupLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-gray-600">
                      Generating mockup...
                    </p>
                  </div>
                </div>
              ) : mockupData ? (
                <div className="space-y-8">
                  {/* Code */}
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Generated Code</h2>
                    <div className="relative">
                      <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-sm max-h-96">
                        <code className="text-gray-800">{mockupData.code}</code>
                      </pre>
                      <button
                        onClick={handleCopyCode}
                        className="absolute top-2 right-2 p-2 bg-white rounded-md shadow-sm hover:bg-gray-50"
                        title="Copy code"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
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
          </div>
        </>
      );
    }

    if (activeTab === 'versions') {
      return (
        <div className="flex h-full">
          {/* Version History (Left Side) */}
          <div className="w-1/3 h-full border-r border-gray-200 overflow-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Version History</h2>
              <div className="space-y-4">
                {[...versions].reverse().map((version) => (
                  <div
                    key={version.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      version.id === activeVersion?.id
                        ? 'border-green-500 bg-green-50'
                        : version.id === selectedVersion?.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                    onClick={() => handleVersionSelect(version)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">
                            Version from {new Date(version.timestamp).toLocaleString()}
                          </p>
                          {version.id === activeVersion?.id && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {version.requirementsDoc.categories.basicNeeds.requirements.length} requirements,{' '}
                          {version.mockupData.components.length} components
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Version Preview (Right Side) */}
          <div className="w-2/3 h-full overflow-auto">
            {(selectedVersion || activeVersion) ? (
              <div className="h-full">
                <LivePreview 
                  code={(selectedVersion || activeVersion)!.mockupData.code} 
                  colorScheme={(selectedVersion || activeVersion)!.mockupData.colorScheme} 
                />
                <div className="p-6">
                  <div className="space-y-8">
                    {/* Components */}
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-4">Components</h2>
                      <ul className="list-disc list-inside space-y-2">
                        {(selectedVersion || activeVersion)!.mockupData.components.map((component, index) => (
                          <li key={index} className="text-gray-700">{component}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Features */}
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-4">Implemented Features</h2>
                      <ul className="list-disc list-inside space-y-2">
                        {(selectedVersion || activeVersion)!.mockupData.features.map((feature, index) => (
                          <li key={index} className="text-gray-700">{feature}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No versions available
              </div>
            )}
          </div>
        </div>
      );
    }

    // Requirements tab content
    return (
      <div className="w-full h-full overflow-auto">
        <div className="p-6">
          <div className="space-y-8">
            <div className="prose max-w-none">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                {requirementsDoc.prompt.split('\n')[0]}
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
                    {[...category.requirements]
                      .sort((a, b) => {
                        const priorityOrder: Record<string, number> = { 'high': 0, 'medium': 1, 'low': 2 };
                        const aPriority = (a.priority && priorityOrder[a.priority.toLowerCase()]) ?? 1;
                        const bPriority = (b.priority && priorityOrder[b.priority.toLowerCase()]) ?? 1;
                        return aPriority - bPriority;
                      })
                      .map((req, index) => (
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
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
      <div className="w-full bg-white h-full shadow-lg flex flex-col">
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
            {activeTab === 'mockup' && (
              <button
                onClick={() => generateMockup(!!mockupData)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {versions.length > 0 ? 'Regenerate Mockup' : 'Generate Mockup'}
              </button>
            )}
            {activeTab === 'versions' && selectedVersion && selectedVersion.id !== activeVersion?.id && (
              <button
                onClick={() => handleVersionRestore(selectedVersion)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Restore Version
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {renderContent()}
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