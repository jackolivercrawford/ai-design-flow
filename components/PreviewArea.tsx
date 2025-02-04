interface PreviewAreaProps {
  requirements: string;
  uiCode: string;
}

export default function PreviewArea({ requirements, uiCode }: PreviewAreaProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-white rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Requirements</h2>
        <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded">
          {requirements}
        </pre>
      </div>
      <div className="bg-white rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Generated UI Code</h2>
        <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded overflow-auto">
          {uiCode}
        </pre>
      </div>
    </div>
  );
} 