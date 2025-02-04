interface CanvasProps {
  answers: Array<{ question: string; answer: string }>;
}

export default function Canvas({ answers }: CanvasProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-6 overflow-auto">
      <h2 className="text-xl font-semibold mb-4">Design Flow</h2>
      <div className="space-y-4">
        {answers.map((item, index) => (
          <div key={index} className="bg-white p-4 rounded-lg shadow">
            <p className="font-medium text-gray-700 mb-2">Q: {item.question}</p>
            <p className="text-gray-600">A: {item.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
} 