import Link from 'next/link';

interface HeaderToolbarProps {
  onRestart?: () => void;
  showRestartButton?: boolean;
}

const HeaderToolbar: React.FC<HeaderToolbarProps> = ({ onRestart, showRestartButton = false }) => {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="w-full px-2">
        <div className="flex justify-between items-center h-16 max-w-[1920px] mx-auto">
          <div className="pl-2">
            <Link href="/" className="text-xl font-bold text-gray-900 hover:text-gray-700 transition-colors">
              AI Design Flow
            </Link>
          </div>
          <div className="pr-2">
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