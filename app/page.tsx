// app/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PromptInput from "@/components/PromptInput";
import { QASettings } from "@/types/settings";

interface SavedProgress {
  qaTree: any;
  currentNodeId: string | null;
  questionCount: number;
  prompt: string;
  settings: QASettings;
}

export default function PromptPage() {
  const router = useRouter();
  const [savedSession, setSavedSession] = useState<SavedProgress | null>(null);

  useEffect(() => {
    const savedProgress = localStorage.getItem("qaProgress");
    if (savedProgress) {
      try {
        const progress = JSON.parse(savedProgress);
        setSavedSession(progress);
      } catch (error) {
        console.error("Error loading saved session:", error);
      }
    }
  }, []);

  const handlePromptSubmit = (prompt: string, settings: QASettings) => {
    console.log("User prompt:", prompt);
    console.log("Settings:", settings);

    // Clear any existing progress and versions
    localStorage.removeItem("qaProgress");
    localStorage.removeItem("mockupVersions");
    localStorage.removeItem("currentMockup");

    // Save new prompt and settings
    localStorage.setItem("designPrompt", prompt);
    localStorage.setItem("qaSettings", JSON.stringify(settings));
    router.push("/qna");
  };

  const handleContinueSession = () => {
    router.push("/qna");
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 px-4">
      {/* Header */}
      <header className="mb-8 text-center relative">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent drop-shadow-sm relative">
          Proto
          <span className="bg-gradient-to-r from-emerald-500 to-emerald-300 bg-clip-text text-transparent">
            synthetic
          </span>
          <div className="absolute -top-4 -right-4 w-8 h-8 border-2 border-emerald-200 rounded-full opacity-50"></div>
          <div className="absolute -bottom-2 -left-4 w-6 h-6 border-2 border-emerald-300 rounded-full opacity-40"></div>
        </h1>
        <p className="mt-6 text-lg text-gray-600 font-light tracking-wide">
          Enter your design prompt to kick off your interactive design journey.
        </p>
      </header>

      {/* Saved Session */}
      {savedSession && (
        <div className="w-full max-w-2xl mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Continue Previous Session
            </h2>
            <div className="space-y-2 mb-4">
              <p className="text-gray-700">
                <span className="font-medium">Prompt:</span>{" "}
                {savedSession.prompt}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Progress:</span>{" "}
                {savedSession.questionCount} questions answered
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Mode:</span>{" "}
                {savedSession.settings.traversalMode === "dfs"
                  ? "Depth-First"
                  : "Breadth-First"}
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleContinueSession}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Continue Session
              </button>
              <button
                onClick={() => setSavedSession(null)}
                className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Start New Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Input */}
      {!savedSession && (
        <div className="w-full max-w-2xl">
          <PromptInput onSubmit={handlePromptSubmit} />
        </div>
      )}
    </div>
  );
}
