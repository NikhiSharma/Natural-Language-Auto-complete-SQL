/**
 * Generic Action System
 *
 * Domain-agnostic action selection and application for RL optimization.
 * Works with any type of output and objective.
 */

/**
 * Generic action types
 *
 * These are domain-agnostic actions that can be applied to any optimization task.
 */
export enum GenericAction {
  /** Use the generator function (e.g., LLM) to create a new output */
  USE_GENERATOR = "USE_GENERATOR",

  /** Apply a small perturbation to the current output */
  PERTURB_OUTPUT = "PERTURB_OUTPUT",

  /** Simplify the output (reduce complexity) */
  SIMPLIFY = "SIMPLIFY",

  /** Expand the output (add more detail) */
  EXPAND = "EXPAND",

  /** Refine the output (improve quality without changing structure) */
  REFINE = "REFINE",

  /** Reset and start over with generator */
  RESET = "RESET",
}

/**
 * Action configuration
 */
export interface ActionConfig {
  type: GenericAction;
  parameters?: Record<string, any>;
}

/**
 * Get applicable actions for the current state
 *
 * @param output - Current output
 * @param objective - Optimization objective
 * @param iteration - Current iteration number
 * @returns List of applicable actions
 */
export function getApplicableActions(
  output: any,
  objective: any,
  iteration: number = 0
): GenericAction[] {
  const actions: GenericAction[] = [];

  // Generator is always available
  actions.push(GenericAction.USE_GENERATOR);

  // If we have output, we can apply transformations
  if (output && !isOutputEmpty(output)) {
    actions.push(GenericAction.PERTURB_OUTPUT);
    actions.push(GenericAction.REFINE);

    // Simplify available if output is complex
    if (getOutputComplexity(output) > 0.5) {
      actions.push(GenericAction.SIMPLIFY);
    }

    // Expand available if output is simple
    if (getOutputComplexity(output) < 0.7) {
      actions.push(GenericAction.EXPAND);
    }
  }

  // Reset available after a few iterations
  if (iteration > 3) {
    actions.push(GenericAction.RESET);
  }

  return actions;
}

/**
 * Apply an action to transform the output
 *
 * NOTE: Most actions require the generator function, so they return null
 * to signal that the generator should be called instead.
 *
 * @param output - Current output
 * @param action - Action to apply
 * @param objective - Optimization objective
 * @returns Transformed output, or null if generator should be used
 */
export function applyAction(
  output: any,
  action: ActionConfig,
  objective: any
): any | null {
  switch (action.type) {
    case GenericAction.USE_GENERATOR:
    case GenericAction.RESET:
      // Signal that generator should be called
      return null;

    case GenericAction.PERTURB_OUTPUT:
      return perturbOutput(output, action.parameters);

    case GenericAction.SIMPLIFY:
      return simplifyOutput(output, action.parameters);

    case GenericAction.EXPAND:
      return expandOutput(output, action.parameters);

    case GenericAction.REFINE:
      // Refinement usually requires generator
      return null;

    default:
      return output;
  }
}

/**
 * Perturb the output (make small random changes)
 */
function perturbOutput(output: any, parameters?: Record<string, any>): any {
  if (typeof output === "string") {
    // For strings, make small modifications
    const words = output.split(" ");
    if (words.length > 2) {
      // Swap two random words
      const i = Math.floor(Math.random() * words.length);
      const j = Math.floor(Math.random() * words.length);
      [words[i], words[j]] = [words[j], words[i]];
      return words.join(" ");
    }
  }

  if (Array.isArray(output)) {
    // For arrays, shuffle slightly
    const result = [...output];
    if (result.length > 2) {
      const i = Math.floor(Math.random() * result.length);
      const j = Math.floor(Math.random() * result.length);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // For other types, return unchanged
  return output;
}

/**
 * Simplify the output (reduce complexity)
 */
function simplifyOutput(output: any, parameters?: Record<string, any>): any {
  if (typeof output === "string") {
    // For strings, truncate or summarize
    const maxLength = parameters?.maxLength || output.length * 0.8;
    return output.substring(0, Math.floor(maxLength));
  }

  if (Array.isArray(output)) {
    // For arrays, reduce size
    const maxSize = parameters?.maxSize || Math.floor(output.length * 0.8);
    return output.slice(0, maxSize);
  }

  if (typeof output === "object" && output !== null) {
    // For objects, remove some properties
    const keys = Object.keys(output);
    const keepCount = Math.floor(keys.length * 0.8);
    const result: any = {};
    for (let i = 0; i < keepCount; i++) {
      result[keys[i]] = output[keys[i]];
    }
    return result;
  }

  return output;
}

/**
 * Expand the output (add more detail)
 */
function expandOutput(output: any, parameters?: Record<string, any>): any {
  // Expansion usually requires external knowledge (generator/LLM)
  // Return null to signal that generator should be used
  return null;
}

/**
 * Calculate output complexity (0-1 scale)
 */
function getOutputComplexity(output: any): number {
  if (typeof output === "string") {
    // Complexity based on length and structure
    const length = output.length;
    const words = output.split(" ").length;
    const avgWordLength = words > 0 ? length / words : 0;

    // Normalize to 0-1 (longer and more complex words = higher complexity)
    const lengthScore = Math.min(length / 1000, 1);
    const wordScore = Math.min(avgWordLength / 10, 1);
    return (lengthScore + wordScore) / 2;
  }

  if (Array.isArray(output)) {
    // Complexity based on array size and nesting
    const size = output.length;
    const hasNested = output.some(
      (item) => typeof item === "object" || Array.isArray(item)
    );
    const sizeScore = Math.min(size / 100, 1);
    const nestScore = hasNested ? 0.5 : 0;
    return (sizeScore + nestScore) / 1.5;
  }

  if (typeof output === "object" && output !== null) {
    // Complexity based on property count and nesting
    const keys = Object.keys(output);
    const keyCount = keys.length;
    const hasNested = keys.some(
      (key) => typeof output[key] === "object" || Array.isArray(output[key])
    );
    const keyScore = Math.min(keyCount / 50, 1);
    const nestScore = hasNested ? 0.5 : 0;
    return (keyScore + nestScore) / 1.5;
  }

  return 0.5; // Default complexity
}

/**
 * Check if output is empty
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
 * Create custom action system
 *
 * Allows domain-specific actions while maintaining the generic interface
 */
export function createCustomActionSystem(
  getActions: (output: any, objective: any, iteration: number) => string[],
  applyAction: (output: any, action: ActionConfig, objective: any) => any | null
): {
  getApplicableActions: typeof getApplicableActions;
  applyAction: typeof applyAction;
} {
  return {
    getApplicableActions: (output, objective, iteration = 0) => {
      const customActions = getActions(output, objective, iteration);
      // Convert strings to GenericAction enum values
      return customActions.map((action) => action as any as GenericAction);
    },
    applyAction,
  };
}
