"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  useRLTool: () => useRLTool
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
function useRLTool(options) {
  const {
    onProgress,
    onComplete,
    onError,
    apiEndpoint
  } = options;
  const [loading, setLoading] = (0, import_react.useState)(false);
  const [result, setResult] = (0, import_react.useState)(null);
  const [error, setError] = (0, import_react.useState)(null);
  const [progress, setProgress] = (0, import_react.useState)([]);
  const optimize = (0, import_react.useCallback)(
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
  const reset = (0, import_react.useCallback)(() => {
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  useRLTool
});
//# sourceMappingURL=index.js.map