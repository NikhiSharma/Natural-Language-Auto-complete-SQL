"use client";

import { useState, useEffect, useRef } from "react";

interface ChatMessage {
  role: "assistant" | "user";
  text: string;
}

export default function Home() {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // CORE STATE
  const [conversation, setConversation] = useState<ChatMessage[]>([
    { role: "assistant", text: "Hello! I can help you with anything - SQL queries, content writing, data analysis, and more. What would you like me to do?" },
  ]);

  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUserQuery, setLastUserQuery] = useState(""); // Store last query for RL optimization
  const [generatedOutput, setGeneratedOutput] = useState(""); // Store RL output

  // OBJECTIVE FUNCTION (generated on submit)
  const [objectiveFunction, setObjectiveFunction] = useState<any | null>(null);
  const [editingObjective, setEditingObjective] = useState(false);
  const [objectiveText, setObjectiveText] = useState("");

  // HISTORY
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // DEBUG PANEL
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  // LOAD HISTORY
  const loadHistory = async () => {
    try {
      const res = await fetch("/api/store-user-history");
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // SEND / ENTER HANDLER - Generate objective function
  const handleSend = async () => {
    const clean = userInput.trim();
    if (!clean) return;

    addDebugLog(`User request: "${clean}"`);
    setConversation((prev) => [...prev, { role: "user", text: clean }]);
    setUserInput("");
    setLastUserQuery(clean);
    setLoading(true);
    setGeneratedOutput(""); // Clear previous output

    // Save to user history
    try {
      await fetch("/api/store-user-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naturalText: clean }),
      });
    } catch (err) {
      console.error("Failed to save user history:", err);
    }

    try {
      // Generate objective function
      addDebugLog("Generating objective function...");
      const objResponse = await fetch("/api/objective/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput: clean }),
      });

      const objData = await objResponse.json();
      if (objData.objective) {
        setObjectiveFunction(objData.objective);
        addDebugLog(`✓ Objective function generated`);
        
        setConversation((prev) => [
          ...prev,
          { role: "assistant", text: "✓ Objective function ready! You can edit it or click 'Optimize with RL' to generate optimized output." },
        ]);
      }
    } catch (err) {
      addDebugLog("✗ Failed to generate objective function");
      setConversation((prev) => [
        ...prev,
        { role: "assistant", text: "Sorry, I encountered an error generating the objective function." },
      ]);
    }

    setLoading(false);
    loadHistory();
  };

  const handleKeyDown = async (e: any) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 p-6 flex">
      {/* HISTORY SIDEBAR */}
      <div className={`transition-all duration-300 ${showHistory ? "w-64 mr-4" : "w-0"} overflow-hidden`}>
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 h-full p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-black">History</h2>
            <button
              onClick={() => setShowHistory(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setUserInput(item.naturalText);
                  setShowHistory(false);
                }}
                className="w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors text-sm"
              >
                <p className="text-gray-900 truncate">{item.naturalText}</p>
                <p className="text-gray-400 text-xs mt-1">
                  {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-4">
            {!showHistory && (
              <button
                onClick={() => setShowHistory(true)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
              >
                History
              </button>
            )}
            <h1 className="text-4xl font-bold text-black">AI Assistant</h1>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="px-4 py-2 bg-blue-100 hover:bg-blue-200 rounded-lg text-sm transition-colors"
            >
              {showDebug ? "Hide Debug" : "Show Debug"}
            </button>
          </div>
          <p className="text-gray-500 text-sm mt-2">Ask me anything - I'll help with SQL, content, analysis, and more</p>
        </div>

        {/* DEBUG PANEL */}
        {showDebug && (
          <div className="mb-4 bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-xs max-h-[200px] overflow-y-auto">
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

        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-200 overflow-hidden transition-all flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[300px] max-h-[500px]">
              {conversation.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] px-5 py-3 rounded-2xl whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {loading && (
              <div className="px-6 pb-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                  Generating response...
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={textareaRef}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything..."
                  rows={1}
                  className="flex-1 p-3 rounded-xl bg-white border border-gray-300 focus:border-blue-500 focus:outline-none resize-none transition-all text-gray-900 text-sm"
                />
                <button
                  onClick={handleSend}
                  disabled={loading}
                  className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-xl font-medium transition-colors text-white text-sm"
                >
                  {loading ? "..." : "Send"}
                </button>
              </div>
            </div>
          </div>

          {/* Optimize with RL Button */}
          {lastUserQuery && (
            <div className="mt-6 bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-black">RL Optimization</h2>
                  <p className="text-sm text-gray-500 mt-1">Generate optimized response using Reinforcement Learning</p>
                </div>
                <div className="flex gap-2">
                  {objectiveFunction && (
                    <button
                      onClick={() => {
                        if (!editingObjective) {
                          setObjectiveText(JSON.stringify(objectiveFunction, null, 2));
                          setEditingObjective(true);
                        } else {
                          try {
                            const parsed = JSON.parse(objectiveText);
                            setObjectiveFunction(parsed);
                            setEditingObjective(false);
                            addDebugLog("✓ Objective function updated");
                          } catch (e) {
                            alert("Invalid JSON format. Please fix and try again.");
                          }
                        }
                      }}
                      disabled={loading}
                      className="px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 rounded-lg text-sm font-medium text-white"
                    >
                      {editingObjective ? "Save Objective" : "Edit Objective"}
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (!objectiveFunction || !lastUserQuery) {
                        alert("Please submit a query first to generate an objective function.");
                        return;
                      }
                      
                      addDebugLog("Starting RL optimization...");
                      setLoading(true);
                      
                      try {
                        // STEP 1: Generate basic response first
                        addDebugLog("Generating basic response...");
                        const basicResponse = await fetch("/api/generate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ query: lastUserQuery }),
                        });
                        
                        const basicData = await basicResponse.json();
                        if (basicData.response) {
                          // Show basic response in chat
                          setConversation((prev) => [
                            ...prev,
                            { role: "assistant", text: `**Basic Response:**\n\n${basicData.response}` },
                          ]);
                          addDebugLog("✓ Basic response generated");
                        }
                        
                        // STEP 2: Show optimizing message
                        setConversation((prev) => [
                          ...prev,
                          { role: "assistant", text: "Now optimizing with Q-Learning RL..." },
                        ]);
                        
                        // STEP 3: Run RL optimization
                        addDebugLog("Running Q-Learning optimization...");
                        const response = await fetch("/api/rl/optimize", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ 
                            objective: objectiveFunction,
                            userQuery: lastUserQuery
                          }),
                        });
                        
                        const data = await response.json();
                        if (data.optimizedOutput) {
                          // Store in Generated Output section
                          setGeneratedOutput(data.optimizedOutput);
                          
                          addDebugLog(`✓ RL optimization complete in ${data.iterations} iterations!`);
                          addDebugLog(`Final Reward: ${data.finalReward?.toFixed(2)}`);
                          addDebugLog(`Converged: ${data.converged}`);
                          
                          // Log iteration details
                          if (data.iterationLogs) {
                            addDebugLog(`\n=== Q-LEARNING ITERATIONS ===`);
                            data.iterationLogs.forEach((log: any) => {
                              addDebugLog(`Iteration ${log.iteration}: Action=${log.action}, Reward=${log.reward?.total?.toFixed(2)}, Converged=${log.converged}`);
                            });
                          }
                          
                          // Update chat with success message
                          setConversation((prev) => [
                            ...prev.slice(0, -1), // Remove "optimizing..." message
                            { role: "assistant", text: `✓ **RL-Optimized Output Generated**\n\nQ-Learning Metrics:\n- Iterations: ${data.iterations}\n- Final Reward: ${data.finalReward?.toFixed(2)}\n- Converged: ${data.converged ? 'Yes' : 'No'}\n\n Check the **Generated Output** section below for the optimized result.` },
                          ]);
                        }
                      } catch (error: any) {
                        addDebugLog(`✗ Optimization failed: ${error.message}`);
                        setConversation((prev) => [
                          ...prev.slice(0, -1),
                          { role: "assistant", text: "Optimization failed. Please try again." },
                        ]);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading || !objectiveFunction}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 rounded-lg text-sm font-medium transition-colors text-white"
                  >
                    {loading ? "Optimizing..." : "Optimize with RL"}
                  </button>
                </div>
              </div>
              
              {/* Objective Function Display */}
              {objectiveFunction && (
                <div className="mt-4">
                  {editingObjective ? (
                    <textarea
                      value={objectiveText}
                      onChange={(e) => setObjectiveText(e.target.value)}
                      className="w-full p-4 bg-white border border-gray-300 rounded-lg font-mono text-xs text-gray-900 min-h-[200px] focus:border-blue-500 focus:outline-none"
                      placeholder="Edit objective function JSON..."
                    />
                  ) : (
                    <div className="p-4 bg-blue-50 rounded-lg font-mono text-xs text-gray-900 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                      {JSON.stringify(objectiveFunction, null, 2)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Generated Output Section */}
          {generatedOutput && (
            <div className="mt-6 bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-black mb-4">Generated Output</h2>
              <div className="p-4 bg-green-50 rounded-lg font-mono text-sm text-gray-900 whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                {generatedOutput}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
