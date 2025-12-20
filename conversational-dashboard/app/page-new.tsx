"use client";

import { useState } from "react";
import { useRLTool, ObjectiveModal } from "@nikhilayeturi23/rltool";

export default function Home() {
  // User content to optimize
  const [content, setContent] = useState("");
  const [optimizedContent, setOptimizedContent] = useState("");
  
  // Debug logs
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  // Use the RL Tool hook
  const {
    objective,
    isGeneratingObjective,
    isOptimizing,
    result,
    error,
    generateObjective,
    approveAndOptimize,
    updateObjective,
    reset,
  } = useRLTool({
    apiEndpoint: "/api/optimize",
    onProgress: (iteration, reward, passed) => {
      addDebugLog(`Iteration ${iteration}: ${passed ? "✓" : "✗"} (Reward: ${reward})`);
    },
    onComplete: (result) => {
      addDebugLog(`✓ Optimization complete!`);
      setOptimizedContent(result.optimizedContent);
    },
    onError: (err) => {
      addDebugLog(`✗ Error: ${err.message}`);
    },
  });

  const handleOptimize = async () => {
    if (!content.trim()) {
      addDebugLog("✗ Please enter some content to optimize");
      return;
    }
    
    addDebugLog("Generating objective function...");
    await generateObjective({ content: content.trim() });
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await handleOptimize();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-gray-900 mb-2">Content Optimizer</h1>
          <p className="text-gray-600">AI-powered content optimization with reinforcement learning</p>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="mt-4 px-4 py-2 bg-blue-100 hover:bg-blue-200 rounded-lg text-sm transition-colors"
          >
            {showDebug ? "Hide Debug" : "Show Debug"}
          </button>
        </div>

        {/* Debug Panel */}
        {showDebug && (
          <div className="mb-6 bg-gray-900 text-green-400 rounded-xl p-4 font-mono text-xs max-h-[200px] overflow-y-auto shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-green-300">Debug Console</span>
              <button
                onClick={() => setDebugLogs([])}
                className="text-red-400 hover:text-red-300 text-xs"
              >
                Clear
              </button>
            </div>
            {debugLogs.length === 0 ? (
              <div className="text-gray-500">No logs yet...</div>
            ) : (
              debugLogs.map((log, idx) => (
                <div key={idx} className="py-1">
                  {log}
                </div>
              ))
            )}
          </div>
        )}

        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Enter Your Content</h2>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter the text you want to optimize..."
            className="w-full h-48 p-4 rounded-xl bg-gray-50 border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none resize-none transition-all text-gray-900"
          />
          
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleOptimize}
              disabled={isGeneratingObjective || isOptimizing || !content.trim()}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-xl font-medium transition-colors text-white shadow-md"
            >
              {isGeneratingObjective ? "Generating Objective..." : "Optimize with RL"}
            </button>
            
            {result && (
              <button
                onClick={() => {
                  reset();
                  setOptimizedContent("");
                  setDebugLogs([]);
                }}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-xl font-medium transition-colors text-white shadow-md"
              >
                Reset
              </button>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Optimized Result */}
        {optimizedContent && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Optimized Content</h2>
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-gray-900 whitespace-pre-wrap">
              {optimizedContent}
            </div>
            
            {result?.iterations && (
              <div className="mt-4 text-sm text-gray-600">
                Optimized in <strong>{result.iterations}</strong> iterations
              </div>
            )}
          </div>
        )}

        {/* Optimization Progress */}
        {isOptimizing && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-gray-700">Optimizing your content with reinforcement learning...</span>
            </div>
          </div>
        )}

        {/* Objective Modal */}
        <ObjectiveModal
          objective={objective}
          onApprove={approveAndOptimize}
          onUpdate={updateObjective}
        />
      </div>
    </div>
  );
}
