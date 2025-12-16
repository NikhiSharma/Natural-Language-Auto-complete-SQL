"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface ChatMessage {
  role: "assistant" | "user";
  text: string;
}

type Stage = "chat" | "objective" | "optimizing" | "sql";

export default function Home() {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    // CORE STATE
  const [stage, setStage] = useState<Stage>("chat");
  const [conversation, setConversation] = useState<ChatMessage[]>([
    { role: "assistant", text: "Hello there! \n How can I help you today." },
  ]);

  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);

    // OBJECTIVE FUNCTION
  const [objectiveAst, setObjectiveAst] = useState<any | null>(null);
  const [objectiveLocked, setObjectiveLocked] = useState(false);


     //SQL
  const [sql, setSql] = useState("");
  const [queryResults, setQueryResults] = useState<any[] | null>(null);

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

     //SEND / ENTER HANDLER

  const handleSend = async () => {
    const clean = userInput.trim();
    if (!clean) return;

    addDebugLog(`User query: "${clean}"`);
    setConversation((prev) => [...prev, { role: "user", text: clean }]);
    setUserInput("");
    setLoading(true);

    // Save to user history
    try {
      addDebugLog("Saving to user history...");
      await fetch("/api/store-user-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naturalText: clean }),
      });
      addDebugLog("✓ Saved to user history");
    } catch (err) {
      console.error("Failed to save user history:", err);
      addDebugLog("✗ Failed to save user history");
    }

    try {
      addDebugLog("Generating objective function...");
      const res = await fetch("/api/objective/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userInput: clean,
          currentObjective: objectiveAst,
        }),
      });

      const data = await res.json();
      addDebugLog(`✓ Objective function generated`);
      addDebugLog(`Entity: ${data.objective?.entity?.identifier || "N/A"}`);

      setObjectiveAst(data.objective);
      setObjectiveLocked(false); // Reset lock state for new objective
      setStage("objective");

      setConversation((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Objective function generated. Review and approve it.",
        },
      ]);
    } catch (err) {
      addDebugLog("✗ Failed to generate objective function");
      setConversation((prev) => [
        ...prev,
        { role: "assistant", text: "Failed to generate objective function." },
      ]);
    }

    setLoading(false);
    loadHistory(); // Reload history after sending query
  };

  const handleKeyDown = async (e: any) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await handleSend();
    }
  };

     //APPROVE → AUTO RUN rlTool
  const approveObjective = async () => {
    if (!objectiveAst) return;

    addDebugLog("Objective approved, starting RL optimization...");
    setObjectiveLocked(true);
    setStage("optimizing");

    setConversation((prev) => [
      ...prev,
      { role: "assistant", text: "Optimizing query using rlTool…" },
    ]);

    try {
      const startTime = Date.now();
      addDebugLog("Calling /api/rl/execute...");

      const res = await fetch("/api/rl/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: objectiveAst }),
      });

      const data = await res.json();
      const duration = Date.now() - startTime;

      addDebugLog(`✓ RL optimization complete (${duration}ms)`);
      addDebugLog(`Generated SQL: ${data.sql}`);

      // Log iteration details
      if (data.iterationLogs && data.iterationLogs.length > 0) {
        addDebugLog(`\n=== RL OPTIMIZATION LOOPS (${data.iterationLogs.length} iterations) ===`);
        data.iterationLogs.forEach((log: any) => {
          addDebugLog(`\n--- Iteration ${log.iteration} ---`);
          addDebugLog(`Action: ${log.action}`);
          addDebugLog(`Evaluation: ${log.evaluation.passed ? "PASS ✓" : "FAIL ✗"}`);
          addDebugLog(`Semantic Match: ${log.semanticMatch ? "YES ✓" : "NO ✗"}`);
          if (log.semanticIssues && log.semanticIssues.length > 0) {
            addDebugLog(`Semantic Issues: ${log.semanticIssues.join(", ")}`);
          }
          addDebugLog(`Reward: ${log.reward.total} (constraint: ${log.reward.constraintScore}, quality: ${log.reward.qualityScore})`);
          addDebugLog(`SQL: ${log.sql.substring(0, 80)}...`);
          addDebugLog(`Converged: ${log.converged ? "YES ✓" : "NO ✗"}`);
        });
        addDebugLog(`\n=== END LOOPS ===`);
      }

      setSql(data.sql);
      setStage("sql");

      setConversation((prev) => [
        ...prev,
        { role: "assistant", text: "Optimization complete. SQL is ready." },
      ]);
    } catch (err) {
      addDebugLog("✗ RL optimization failed");
      setConversation((prev) => [
        ...prev,
        { role: "assistant", text: "rlTool execution failed." },
      ]);
      setStage("objective");
    }
  };
//UI from here
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
            <h1 className="text-4xl font-bold text-black">Quill chat</h1>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="px-4 py-2 bg-blue-100 hover:bg-blue-200 rounded-lg text-sm transition-colors"
            >
              {showDebug ? "Hide Debug" : "Show Debug"}
            </button>
          </div>
          <p className="text-gray-500 text-sm mt-2">Ask me anything about objectiveFunctions and SQL optimization</p>
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

       <div className={`max-w-7xl mx-auto ${objectiveAst || stage === "sql" ? "flex gap-6" : "flex justify-center"}`}>
        <div className={`bg-white rounded-3xl shadow-lg border border-gray-200 overflow-hidden transition-all flex flex-col ${objectiveAst || stage === "sql" ? "flex-1" : "w-full max-w-3xl"}`}>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[400px] max-h-[600px]">
            {conversation.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-5 py-3 rounded-2xl ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  dangerouslySetInnerHTML={{ __html: msg.text }}
                />
              </div>
            ))}
          </div>

          {stage === "optimizing" && (
            <div className="px-6 pb-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                Optimizing query...
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
                placeholder="Send a message..."
                rows={1}
                className="flex-1 p-3 rounded-xl bg-white border border-gray-300 focus:border-blue-500 focus:outline-none resize-none transition-all text-gray-900 text-sm"
              />
              <button
                onClick={handleSend}
                disabled={loading}
                className="px-5 py-3 bg-black hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-xl font-medium transition-colors text-white text-sm"
              >
                {loading ? "..." : "Send"}
              </button>
            </div>
          </div>
        </div>

        {(objectiveAst || stage === "sql") && (
          <div className="w-[500px] flex flex-col gap-6">
            {objectiveAst && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-black">Objective Function</h2>
                  {!objectiveLocked ? (
                    <button
                      onClick={approveObjective}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors text-white"
                    >
                      Approve
                    </button>
                  ) : (
                    <button
                      onClick={() => setObjectiveLocked(false)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors text-white"
                    >
                      Edit
                    </button>
                  )}
                </div>
                <textarea
                  className="w-full h-[300px] rounded-lg bg-gray-50 border border-gray-300 font-mono text-xs p-4 focus:outline-none focus:border-blue-500 text-gray-900"
                  value={JSON.stringify(objectiveAst, null, 2)}
                  onChange={(e) => {
                    try {
                      setObjectiveAst(JSON.parse(e.target.value));
                    } catch {}
                  }}
                  disabled={objectiveLocked}
                />
              </div>
            )}

            {stage === "sql" && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4 text-black">Generated SQL</h2>
                <textarea
                  className="w-full h-[200px] rounded-lg bg-gray-50 border border-gray-300 font-mono text-sm p-4 mb-4 focus:outline-none focus:border-blue-500 text-gray-900"
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                />
                <button
                  onClick={() => {
                    if (sql) {
                      router.push(`/results?sql=${encodeURIComponent(sql)}`);
                    }
                  }}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors text-white"
                >
                  Run Query →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
