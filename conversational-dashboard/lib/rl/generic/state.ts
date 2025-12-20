/**
 * Generic State Extraction
 *
 * Domain-agnostic state representation for RL optimization.
 * Works with any type of output and objective.
 */

import crypto from "crypto";

export interface GenericState {
  /** Hash of the objective (for grouping similar problems) */
  objectiveHash: string;

  /** Hash of the current output */
  outputHash: string;

  /** Features extracted from the output */
  features: Record<string, any>;

  /** Metadata about the state */
  metadata: {
    iteration: number;
    timestamp: number;
  };
}

/**
 * Extract state from output and objective (generic version)
 *
 * @param output - The current output (any type)
 * @param objective - The optimization objective
 * @param analysis - Analysis result from analyzer function (optional)
 * @param iteration - Current iteration number (optional)
 * @returns Generic state representation
 */
export function extractGenericState(
  output: any,
  objective: any,
  analysis?: any,
  iteration: number = 0
): GenericState {
  // Hash the objective for grouping similar problems
  const objectiveHash = hashObject(objective);

  // Hash the output for state identification
  const outputHash = hashObject(output);

  // Extract features from the output and analysis
  const features: Record<string, any> = {
    // Output-based features
    outputType: typeof output,
    outputLength: getOutputLength(output),
    isEmpty: isOutputEmpty(output),

    // Analysis-based features (if available)
    ...(analysis || {}),

    // Objective-based features
    hasConstraints: objective.constraints !== undefined,
    constraintCount: objective.constraints
      ? Object.keys(objective.constraints).length
      : 0,
  };

  return {
    objectiveHash,
    outputHash,
    features,
    metadata: {
      iteration,
      timestamp: Date.now(),
    },
  };
}

/**
 * Generate a unique key for a state
 *
 * @param state - The state to generate a key for
 * @returns A unique string key representing the state
 */
export function getStateKey(state: GenericState): string {
  // Combine objective hash and key features for state identification
  const keyFeatures = {
    objective: state.objectiveHash,
    output: state.outputHash,
    // Include important features that distinguish states
    outputLength: state.features.outputLength,
    isEmpty: state.features.isEmpty,
  };

  return hashObject(keyFeatures);
}

/**
 * Compare two states for similarity
 *
 * @param state1 - First state
 * @param state2 - Second state
 * @returns Similarity score between 0 and 1
 */
export function compareStates(state1: GenericState, state2: GenericState): number {
  let similarity = 0;
  let totalChecks = 0;

  // Compare objective hash
  if (state1.objectiveHash === state2.objectiveHash) {
    similarity += 1;
  }
  totalChecks += 1;

  // Compare output hash
  if (state1.outputHash === state2.outputHash) {
    similarity += 1;
  }
  totalChecks += 1;

  // Compare features
  const features1 = state1.features;
  const features2 = state2.features;
  const allFeatureKeys = new Set([
    ...Object.keys(features1),
    ...Object.keys(features2),
  ]);

  for (const key of allFeatureKeys) {
    if (features1[key] === features2[key]) {
      similarity += 1;
    }
    totalChecks += 1;
  }

  return totalChecks > 0 ? similarity / totalChecks : 0;
}

/**
 * Hash an object to a string (for state identification)
 */
function hashObject(obj: any): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  return crypto.createHash("md5").update(str).digest("hex").substring(0, 16);
}

/**
 * Get the length/size of output (generic)
 */
function getOutputLength(output: any): number {
  if (typeof output === "string") {
    return output.length;
  }
  if (Array.isArray(output)) {
    return output.length;
  }
  if (typeof output === "object" && output !== null) {
    return Object.keys(output).length;
  }
  return 0;
}

/**
 * Check if output is empty (generic)
 */
function isOutputEmpty(output: any): boolean {
  if (output === null || output === undefined) {
    return true;
  }
  if (typeof output === "string") {
    return output.trim().length === 0;
  }
  if (Array.isArray(output)) {
    return output.length === 0;
  }
  if (typeof output === "object") {
    return Object.keys(output).length === 0;
  }
  return false;
}

/**
 * Create a custom state extractor
 *
 * Allows domain-specific state extraction while maintaining the generic interface
 */
export function createCustomStateExtractor(
  featureExtractor: (output: any, objective: any, analysis?: any) => Record<string, any>
): (output: any, objective: any, analysis?: any, iteration?: number) => GenericState {
  return (output, objective, analysis, iteration = 0) => {
    const objectiveHash = hashObject(objective);
    const outputHash = hashObject(output);
    const features = featureExtractor(output, objective, analysis);

    return {
      objectiveHash,
      outputHash,
      features,
      metadata: {
        iteration,
        timestamp: Date.now(),
      },
    };
  };
}
