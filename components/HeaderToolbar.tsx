import Link from 'next/link';

interface HeaderToolbarProps {
  onRestart?: () => void;
  onGenerate?: () => void;
  onSave?: () => void;
  showRestartButton?: boolean;
  showGenerateButton?: boolean;
  showSaveButton?: boolean;
}

const HeaderToolbar: React.FC<HeaderToolbarProps> = ({ 
  onRestart, 
  onGenerate,
  onSave,
  showRestartButton = false,
  showGenerateButton = false,
  showSaveButton = false
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
            {showGenerateButton && onGenerate && (
              <button
                onClick={onGenerate}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span>Generate Preview</span>
              </button>
            )}
            {showRestartButton && onRestart && (
              <button
                onClick={onRestart}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Restart Q&A
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default HeaderToolbar; 