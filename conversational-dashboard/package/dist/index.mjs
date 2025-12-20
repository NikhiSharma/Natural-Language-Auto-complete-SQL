// src/index.ts
import { useState, useCallback } from "react";
function useRLTool(options) {
  const {
    onProgress,
    onComplete,
    onError,
    apiEndpoint
  } = options;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState([]);
  const optimize = useCallback(
    async (input) => {
      setLoading(true);
      setError(null);
      setProgress([]);
      try {
        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Optimization failed");
        }
        const data = await response.json();
        if (data.metadata?.iterationLogs) {
          const logs = data.metadata.iterationLogs.map(
            (log) => ({
              iteration: log.iteration,
              action: log.action,
              passed: log.evaluation?.passed || false,
              reward: log.reward?.total || 0,
              output: log.output || log.sql,
              timestamp: Date.now()
            })
          );
          setProgress(logs);
          if (onProgress) {
            logs.forEach((log) => onProgress(log));
          }
        }
        setResult(data);
        if (onComplete) {
          onComplete(data);
        }
        return data;
      } catch (err) {
        const error2 = err instanceof Error ? err : new Error(String(err));
        setError(error2);
        if (onError) {
          onError(error2);
        }
        throw error2;
      } finally {
        setLoading(false);
      }
    },
    [apiEndpoint, onProgress, onComplete, onError]
  );
  const reset = useCallback(() => {
    setLoading(false);
    setResult(null);
    setError(null);
    setProgress([]);
  }, []);
  return {
    /** Function to trigger optimization */
    optimize,
    /** Whether optimization is in progress */
    loading,
    /** The optimization result (null until complete) */
    result,
    /** Error if optimization failed */
    error,
    /** Array of progress logs from RL iterations */
    progress,
    /** Reset the hook state */
    reset
  };
}
export {
  useRLTool
};
//# sourceMappingURL=index.mjs.map