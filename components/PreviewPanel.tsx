import { RequirementsDocument, MockupVersion, QANode } from '@/types';
import { QASettings } from '@/types/settings';
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
  currentNode: QANode | null;
  suggestedAnswer: { text: string; confidence: 'high' | 'medium' | 'low'; sourceReferences: number[]; } | null;
  settings: QASettings;
  onVersionRestore?: (version: MockupVersion) => void;
  onSimplify?: () => void;
  isSimplifying?: boolean;
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

const style = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .version-list {
    position: relative;
  }

  .version-item {
    position: relative;
    transition: all 0.3s ease-out;
  }

  .version-item.deleting {
    opacity: 0;
    transform: translateX(-100%);
  }
`;

export default function PreviewPanel({
  isOpen,
  onClose,
  requirementsDoc,
  qaTree,
  currentNode,
  suggestedAnswer,
  settings,
  onVersionRestore,
  onSimplify,
  isSimplifying
}: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<'mockup' | 'specs' | 'requirements'>('mockup');
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
        // Set the most recent version as both active and selected if it exists
        if (parsedVersions.length > 0) {
          const mostRecent = parsedVersions[parsedVersions.length - 1];
          setActiveVersion(mostRecent);
          setSelectedVersion(mostRecent);
        }
      }

      // Load current mockup state
      const currentMockup = localStorage.getItem('currentMockup');
      if (currentMockup) {
        setMockupData(JSON.parse(currentMockup));
      }
    } catch (error) {
      // console.error('Error loading data:', error);
    }
  }, []);

  // Keyboard shortcut: Option+Cmd+G to simplify
  useEffect(() => {
    if (!isOpen || !onSimplify) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Option (Alt) + Command (Meta) + G
      if (event.altKey && event.metaKey && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        onSimplify();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onSimplify]);

  // Store the current requirements for comparison
  useEffect(() => {
    prevRequirementsRef.current = requirementsDoc;
  }, [requirementsDoc]);

  const generateMockup = async (saveCurrentVersion: boolean = false) => {
    setIsMockupLoading(true);
    setError(null);
    // Clear current mockup data and active version to force re-render
    setMockupData(null);
    setActiveVersion(null);

    // If requested, save current version before generating new one
    if (saveCurrentVersion && mockupData) {
      const currentVersion: MockupVersion = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        qaTree: JSON.parse(JSON.stringify(qaTree)),
        requirementsDoc: JSON.parse(JSON.stringify(requirementsDoc)),
        currentState: {
          currentNodeId: currentNode?.id || null,
          suggestedAnswer: suggestedAnswer ? { ...suggestedAnswer } : null
        },
        mockupData: { ...mockupData }
      };

      const updatedVersions = [...versions, currentVersion];
      setVersions(updatedVersions);
      localStorage.setItem('mockupVersions', JSON.stringify(updatedVersions));
    }

    try {
      const response = await fetch('/api/generate-mockup', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'  // Prevent caching
        },
        body: JSON.stringify({ 
          requirementsDoc,
          timestamp: Date.now()  // Cache-busting timestamp
        })
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

      // Create new version with unique ID
      const newVersion: MockupVersion = {
        id: `${uuidv4()}-${Date.now()}`, // Extra uniqueness to force React remount
        timestamp: new Date().toISOString(),
        qaTree: JSON.parse(JSON.stringify(qaTree)),
        requirementsDoc: JSON.parse(JSON.stringify(requirementsDoc)),
        currentState: {
          currentNodeId: currentNode?.id || null,
          suggestedAnswer: suggestedAnswer ? { ...suggestedAnswer } : null
        },
        mockupData: data
      };

      // Add to versions and save to localStorage
      const updatedVersions = [...versions, newVersion];
      setVersions(updatedVersions);
      localStorage.setItem('mockupVersions', JSON.stringify(updatedVersions));

      // Set mockup data and active version
      setMockupData(data);
      setActiveVersion(newVersion);
      localStorage.setItem('currentMockup', JSON.stringify(data));
    } catch (error) {
      // console.error('Error generating mockup:', error);
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
    // First restore the mockup and UI state
    const completeVersion = ensureCompleteColorScheme(version);
    setMockupData(completeVersion.mockupData);
    setActiveVersion(completeVersion);
    setSelectedVersion(null);
    // Save restored mockup as current
    localStorage.setItem('currentMockup', JSON.stringify(completeVersion.mockupData));
    // Save the entire version state to qaProgress to ensure tree restoration
    localStorage.setItem('qaProgress', JSON.stringify({
      qaTree: completeVersion.qaTree,
      currentNodeId: completeVersion.currentState?.currentNodeId || null,
      questionCount: countAnswers(completeVersion.qaTree),
      prompt: completeVersion.requirementsDoc.prompt,
      settings,
      requirementsDoc: completeVersion.requirementsDoc
    }));
    setActiveTab('mockup');
    
    if (onVersionRestore) {
      onVersionRestore(completeVersion);
    }
  };

  // Helper function to count answers in a tree
  const countAnswers = (tree: QANode): number => {
    let count = 0;
    const traverse = (node: QANode) => {
      if (node.answer) count++;
      node.children.forEach(traverse);
    };
    traverse(tree);
    return count;
  };

  // Add this helper function after the countAnswers function
  const countTotalRequirements = (doc: RequirementsDocument): number => {
    return Object.values(doc.categories).reduce((total, category) => 
      total + category.requirements.length, 0
    );
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

  const handleVersionDelete = (versionId: string) => {
    if (window.confirm('Are you sure you want to delete this version? This action cannot be undone.')) {
      // Find the DOM element for the version being deleted
      const versionElement = document.querySelector(`[data-version-id="${versionId}"]`);
      if (versionElement) {
        // Add the deleting class to trigger the animation
        versionElement.classList.add('deleting');
        
        // Wait for the animation to complete before updating state
        setTimeout(() => {
          const updatedVersions = versions.filter(v => v.id !== versionId);
          setVersions(updatedVersions);
          localStorage.setItem('mockupVersions', JSON.stringify(updatedVersions));
          
          // If the deleted version was selected, clear selection
          if (selectedVersion?.id === versionId) {
            setSelectedVersion(null);
          }
          
          // If the deleted version was active, set the most recent as active
          if (activeVersion?.id === versionId) {
            const mostRecent = updatedVersions[updatedVersions.length - 1];
            setActiveVersion(mostRecent || null);
          }
        }, 300); // Match this with the CSS transition duration
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
      <style>{style}</style>
      <div className="w-full bg-white h-full shadow-lg flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Design Preview</h2>
          <div className="flex space-x-4">
            <button
              onClick={() => generateMockup(!!mockupData)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {versions.length > 0 ? 'Regenerate Mockup' : 'Generate Mockup'}
            </button>
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
          {/* Version History (Left Side) */}
          <div className="w-1/3 h-full border-r border-gray-200 overflow-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Version History</h2>
              <div className="version-list space-y-4">
                {[...versions].reverse().map((version, index) => (
                  <div
                    key={version.id}
                    data-version-id={version.id}
                    className={`version-item p-4 border rounded-lg ${
                      version.id === selectedVersion?.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    } ${index === 0 && isMockupLoading ? 'cursor-default opacity-70' : 'cursor-pointer'}`}
                    style={{
                      animation: 'slideIn 0.2s ease-out'
                    }}
                    onClick={() => {
                      // Only allow selection if not currently generating
                      if (!(index === 0 && isMockupLoading)) {
                        handleVersionSelect(version);
                      }
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">
                            {index === 0 && isMockupLoading ? 'Generating new version...' : `Version from ${new Date(version.timestamp).toLocaleString()}`}
                          </p>
                          {index === 0 && isMockupLoading && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 flex gap-2">
                          {index === 0 && isMockupLoading ? (
                            <>
                              <span className="inline-block bg-gray-200 rounded-full h-4 w-16 animate-pulse"></span>
                              <span className="inline-block bg-gray-200 rounded-full h-4 w-16 animate-pulse"></span>
                            </>
                          ) : (
                            <>
                              {countTotalRequirements(version.requirementsDoc)} requirements,{' '}
                              {version.mockupData.components.length} components
                            </>
                          )}
                        </p>
                      </div>
                      {/* Add delete button */}
                      {!(index === 0 && isMockupLoading) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent version selection when clicking delete
                            handleVersionDelete(version.id);
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete version"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Version Preview (Right Side) */}
          <div className="w-2/3 h-full overflow-auto">
            {!selectedVersion && isMockupLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  <p className="text-gray-600">Generating new mockup...</p>
                </div>
              </div>
            ) : (selectedVersion || activeVersion) ? (
              <div className="h-full flex flex-col">
                {/* Version Preview Tabs */}
                <div className="border-b border-gray-200">
                  <div className="flex space-x-4 px-6 pt-4">
                    <button
                      onClick={() => setActiveTab('mockup')}
                      className={`px-4 py-2 rounded-t-lg ${
                        activeTab === 'mockup'
                          ? 'bg-white text-blue-700 border-t border-l border-r border-gray-200'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Mockup
                    </button>
                    <button
                      onClick={() => setActiveTab('specs')}
                      className={`px-4 py-2 rounded-t-lg ${
                        activeTab === 'specs'
                          ? 'bg-white text-blue-700 border-t border-l border-r border-gray-200'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Specs
                    </button>
                    <button
                      onClick={() => setActiveTab('requirements')}
                      className={`px-4 py-2 rounded-t-lg ${
                        activeTab === 'requirements'
                          ? 'bg-white text-blue-700 border-t border-l border-r border-gray-200'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Requirements
                    </button>
                  </div>
                </div>

                {/* Version Preview Content */}
                <div className="flex-1 overflow-auto">
                  {activeTab === 'mockup' && (
                    <div className="h-full">
                      <LivePreview 
                        key={(selectedVersion || activeVersion)!.id}
                        code={(selectedVersion || activeVersion)!.mockupData.code} 
                        colorScheme={(selectedVersion || activeVersion)!.mockupData.colorScheme} 
                      />
                    </div>
                  )}
                  {activeTab === 'specs' && (
                    <div className="p-6 space-y-8">
                      {/* Code */}
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Generated Code</h2>
                        <div className="relative">
                          <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-sm max-h-96">
                            <code className="text-gray-800">{(selectedVersion || activeVersion)!.mockupData.code}</code>
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

                      {/* Next Steps */}
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Next Steps</h2>
                        <ul className="list-disc list-inside space-y-2">
                          {(selectedVersion || activeVersion)!.mockupData.nextSteps.map((step, index) => (
                            <li key={index} className="text-gray-700">{step}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  {activeTab === 'requirements' && (
                    <div className="p-6">
                      <div className="space-y-8">
                        <div className="prose max-w-none flex justify-between items-start">
                          <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                              {(selectedVersion || activeVersion)!.requirementsDoc.prompt.split('\n')[0]}
                            </h1>
                          </div>
                          <button
                            onClick={handleDownload}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800 flex items-center gap-2"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download Requirements
                          </button>
                        </div>

                        {Object.entries((selectedVersion || activeVersion)!.requirementsDoc.categories).map(([key, category]) => (
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
                                            {/* Priority Tag */}
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
                                            {/* Category Tag */}
                                            {req.category && (
                                              <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                                {req.category}
                                              </span>
                                            )}
                                            {/* Additional Tags */}
                                            {req.tags?.map((tag, tagIndex) => {
                                              // console.log('Rendering tag:', tag, 'for requirement:', req.text);
                                              return (
                                                <span
                                                  key={`${req.id || index}-tag-${tagIndex}`}
                                                  className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800"
                                                >
                                                  {tag}
                                                </span>
                                              );
                                            })}
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
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No versions available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 