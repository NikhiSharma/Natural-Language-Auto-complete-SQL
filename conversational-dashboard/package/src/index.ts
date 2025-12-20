/**
 * Frontend React Hook and Types for @nikhilayeturi23/rltool
 *
 * This module provides the React hook for RL-based optimization UI state management.
 * Use this in your React components and frontend code.
 *
 * @module @nikhilayeturi23/rltool
 *
 * @example
 * ```typescript
 * // Import in React components
 * import { useRLTool, type RLOptimizationResult } from '@nikhilayeturi23/rltool';
 * ```
 *
 * @remarks
 * This module exports frontend-optimized types. For backend optimization,
 * import from '@nikhilayeturi23/rltool/backend' instead.
 */

import { useState, useCallback } from "react";

/**
 * Generic progress log for RL iterations
 */
export interface RLProgressLog {
  iteration: number;
  action: string;
  passed: boolean;
  reward: number;
  output: any;
  timestamp: number;
}

/**
 * Generic RL optimization result
 */
export interface RLOptimizationResult<T = any> {
  output: T;
  metadata: {
    iterations: number;
    finalReward: number;
    iterationLogs: any[];
  };
  message: string;
}

/**
 * Options for the RL Tool hook
 */
export interface RLToolOptions {
  /** API endpoint to use for optimization */
  apiEndpoint: string;

  /** Callback fired on each iteration/progress update */
  onProgress?: (log: RLProgressLog) => void;

  /** Callback fired when optimization completes */
  onComplete?: (result: RLOptimizationResult) => void;

  /** Callback fired on error */
  onError?: (error: Error) => void;
}

/**
 * Generic input for optimization
 */
export interface OptimizationInput {
  /** The objective to optimize for */
  objective: any;

  /** Any domain-specific parameters */
  [key: string]: any;
}

/**
 * RL Tool Hook - Single Standalone React Hook
 *
 * A React hook that provides RL-based optimization for any domain.
 * Completely decoupled from SQL or any specific use case.
 *
 * @example
 * ```tsx
 * import { useRLTool } from '@nikhilayeturi23/rltool';
 *
 * function MyComponent() {
 *   const { optimize, loading, result, error } = useRLTool({
 *     apiEndpoint: "/api/optimize-anything"
 *   });
 *
 *   const handleClick = async () => {
 *     await optimize({
 *       objective: {
 *         input: "What to optimize",
 *         constraints: { budget: 1000 }
 *       }
 *     });
 *   };
 *
 *   return (
 *     <button onClick={handleClick} disabled={loading}>
 *       {loading ? "Optimizing..." : "Optimize"}
 *     </button>
 *   );
 * }
 * ```
 */
export function useRLTool(options: RLToolOptions) {
  const {
    onProgress,
    onComplete,
    onError,
    apiEndpoint,
  } = options;

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RLOptimizationResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<RLProgressLog[]>([]);

  /**
   * Optimize based on the given input
   */
  const optimize = useCallback(
    async (input: OptimizationInput): Promise<RLOptimizationResult> => {
      setLoading(true);
      setError(null);
      setProgress([]);

      try {
        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          const errorData = await response.json() as { error?: string };
          throw new Error(errorData.error || "Optimization failed");
        }

        const data = await response.json() as RLOptimizationResult;

        // Process iteration logs and fire progress callbacks
        if (data.metadata?.iterationLogs) {
          const logs: RLProgressLog[] = data.metadata.iterationLogs.map(
            (log: any) => ({
              iteration: log.iteration,
              action: log.action,
              passed: log.evaluation?.passed || false,
              reward: log.reward?.total || 0,
              output: log.output || log.sql,
              timestamp: Date.now(),
            })
          );

          setProgress(logs);

          // Fire onProgress for each iteration
          if (onProgress) {
            logs.forEach((log) => onProgress(log));
          }
        }

        setResult(data);

        // Fire completion callback
        if (onComplete) {
          onComplete(data);
        }

        return data;
      } catch (err: any) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);

        // Fire error callback
        if (onError) {
          onError(error);
        }

        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiEndpoint, onProgress, onComplete, onError]
  );

  /**
   * Reset the hook state
   */
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
    reset,
  };
}
