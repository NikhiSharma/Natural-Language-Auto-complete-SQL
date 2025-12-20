"use client";

import { useRLTool, RLToolOptions } from "./useRLTool";

/**
 * React Hook for SQL Optimization with RL
 *
 * A specialized wrapper around useRLTool for SQL optimization use cases.
 * This hook provides SQL-specific types and a convenient interface.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { optimizeSQL, loading, result, error } = useOptimizeSQL({
 *     tools: ["explain", "ai"],
 *     onProgress: (log) => console.log(log),
 *     onComplete: (result) => console.log("Done!", result)
 *   });
 *
 *   const handleClick = async () => {
 *     await optimizeSQL(myObjective);
 *   };
 * }
 * ```
 */

export interface OptimizeSQLOptions {
  /** Which tools to use during optimization */
  tools?: ("explain" | "ai" | "execute")[];

  /** Callback fired on each iteration/progress update */
  onProgress?: (log: ProgressLog) => void;

  /** Callback fired when optimization completes */
  onComplete?: (result: OptimizationResult) => void;

  /** Callback fired on error */
  onError?: (error: Error) => void;

  /** API endpoint to use (defaults to /api/optimize-sql) */
  apiEndpoint?: string;

  /** Custom AI endpoint URL (e.g., Cloudflare Worker, defaults to OpenAI) */
  aiEndpoint?: string;
}

export interface ProgressLog {
  iteration: number;
  action: string;
  passed: boolean;
  reward: number;
  sql: string;
  timestamp: number;
}

export interface OptimizationResult {
  sql: string;
  analysis: {
    estimatedRows: number;
    estimatedCost: number;
    fields: string[];
    usesIndex: boolean;
    hasAggregation: boolean;
  } | null;
  executionResults: {
    rowCount: number;
    fields: string[];
    executionTime: number;
    rows: any[];
  } | null;
  optimizationMetadata: {
    iterations: number;
    finalReward: number;
    iterationLogs: any[];
  };
  message: string;
}

/**
 * Hook for SQL optimization with RL
 *
 * This is now a thin wrapper around the generic useRLTool hook.
 */
export function useOptimizeSQL(options: OptimizeSQLOptions = {}) {
  const {
    tools = ["explain", "ai"],
    onProgress,
    onComplete,
    onError,
    apiEndpoint = "/api/optimize-sql",
    aiEndpoint,
  } = options;

  // Use the generic RL tool hook
  const rlOptions: RLToolOptions = {
    apiEndpoint,
    config: { tools, aiEndpoint },
    onProgress: onProgress ? (log) => {
      onProgress({
        iteration: log.iteration,
        action: log.action,
        passed: log.passed,
        reward: log.reward,
        sql: log.output,
        timestamp: log.timestamp,
      });
    } : undefined,
    onComplete: onComplete ? (result) => {
      onComplete({
        sql: result.output,
        analysis: (result as any).analysis || null,
        executionResults: (result as any).executionResults || null,
        optimizationMetadata: result.metadata,
        message: result.message,
      });
    } : undefined,
    onError,
  };

  const { optimize, loading, result, error, progress, reset } = useRLTool(rlOptions);

  /**
   * Optimize a SQL query based on an objective
   */
  const optimizeSQL = async (objective: any): Promise<OptimizationResult> => {
    const rlResult = await optimize({ objective });

    // Map generic result to SQL-specific result
    return {
      sql: rlResult.output,
      analysis: (rlResult as any).analysis || null,
      executionResults: (rlResult as any).executionResults || null,
      optimizationMetadata: rlResult.metadata,
      message: rlResult.message,
    };
  };

  // Map progress logs to SQL-specific format
  const sqlProgress: ProgressLog[] = progress.map((log) => ({
    iteration: log.iteration,
    action: log.action,
    passed: log.passed,
    reward: log.reward,
    sql: log.output,
    timestamp: log.timestamp,
  }));

  // Map result to SQL-specific format
  const sqlResult: OptimizationResult | null = result ? {
    sql: result.output,
    analysis: (result as any).analysis || null,
    executionResults: (result as any).executionResults || null,
    optimizationMetadata: result.metadata,
    message: result.message,
  } : null;

  return {
    /** Function to trigger SQL optimization */
    optimizeSQL,

    /** Whether optimization is in progress */
    loading,

    /** The optimization result (null until complete) */
    result: sqlResult,

    /** Error if optimization failed */
    error,

    /** Array of progress logs from RL iterations */
    progress: sqlProgress,

    /** Reset the hook state */
    reset,
  };
}
