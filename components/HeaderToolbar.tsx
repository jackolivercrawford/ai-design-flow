import Link from 'next/link';

interface HeaderToolbarProps {
  onRestart?: () => void;
  onGenerate?: () => void;
  onSave?: () => void;
  showRestartButton?: boolean;
  showGenerateButton?: boolean;
  showSaveButton?: boolean;
  isAutomating?: boolean;
  onStartAutomation?: () => void;
  onStopAutomation?: () => void;
  hasKnowledgeBase?: boolean;
}

const HeaderToolbar: React.FC<HeaderToolbarProps> = ({ 
  onRestart, 
  onGenerate,
  onSave,
  showRestartButton = false,
  showGenerateButton = false,
  showSaveButton = false,
  isAutomating = false,
  onStartAutomation,
  onStopAutomation,
  hasKnowledgeBase = false
}) => {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="w-full px-2">
        <div className="flex justify-between items-center h-16 max-w-[1920px] mx-auto">
          <div className="pl-2">
            <Link href="/" className="text-xl font-bold text-gray-900 hover:text-gray-700 transition-colors">
              AI Design Flow
            </Link>
          </div>
          <div className="pr-2 flex space-x-4">
            {showSaveButton && onSave && (
              <button
                onClick={onSave}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                <span>Save Progress</span>
              </button>
            )}
            {showRestartButton && onRestart && (
              <button
                onClick={onRestart}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Restart Q&A
              </button>
            )}
            {hasKnowledgeBase && onStartAutomation && onStopAutomation && (
              <button
                onClick={isAutomating ? onStopAutomation : onStartAutomation}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                  isAutomating 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                {isAutomating ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 18M6 6L18 6" />
                    </svg>
                    <span>Stop Auto-Answer</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Start Auto-Answer</span>
                  </>
                )}
              </button>
            )}
            {showGenerateButton && onGenerate && (
              <button
                onClick={onGenerate}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span>Preview</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default HeaderToolbar; 