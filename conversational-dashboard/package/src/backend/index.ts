/**
 * Backend RL Optimizer for @nikhilayeturi23/rltool
 *
 * This is a server-side module that provides the Q-learning based RL optimizer.
 * It's designed to be used in Node.js environments (e.g., Next.js API routes, Express servers).
 *
 * DO NOT import this in browser/frontend code - it uses Node.js modules (fs, crypto).
 *
 * @module @nikhilayeturi23/rltool/backend
 *
 * @example
 * ```typescript
 * // Import in server-side code only
 * import { optimizeWithRL, type OptimizationResult } from '@nikhilayeturi23/rltool/backend';
 * ```
 *
 * @remarks
 * **Important:** Some type names in this module overlap with frontend types
 * (e.g., OptimizationResult, IterationLog) but have different structures optimized
 * for backend use. Always import from the correct path:
 * - **Backend/Server:** `@nikhilayeturi23/rltool/backend`
 * - **Frontend/React:** `@nikhilayeturi23/rltool`
 */

export { optimizeWithRL } from "./optimizerGeneric";
export type {
  GenericFeedback,
  GenericContext,
  GenericOutput,
  GenericObjective,
  OptimizationResult,
  IterationLog
} from "./optimizerGeneric";

export type {
  QTable,
  QLearningConfig,
  Experience,
  Reward
} from "./types";

export { GenericAction } from "./generic/actions";

export type { GenericState } from "./generic/state";

export type {
  RewardComponents,
  GenericEvaluationResult,
  GenericExecutionMetrics
} from "./generic/reward";
