/**
 * Generic Reward Calculation
 *
 * Domain-agnostic reward calculation for RL optimization.
 * Works with any type of output, objective, and evaluation result.
 */

export interface GenericEvaluationResult {
  passed: boolean;
  feedback?: {
    code: string;
    message: string;
    fix: string;
  };
}

export interface GenericExecutionMetrics {
  executionTime?: number;
  outputSize?: number;
  expectedSize?: number;
  hasErrors: boolean;
  customMetrics?: Record<string, number>;
}

export interface RewardComponents {
  total: number;
  constraintScore: number;
  qualityScore: number;
  details: string[];
}

/**
 * Calculate reward for any optimization task
 *
 * @param output - The generated output (any type)
 * @param objective - The optimization objective
 * @param evaluation - Evaluation result from domain-specific evaluator
 * @param metrics - Execution metrics (optional)
 * @returns Reward components
 */
export function calculateGenericReward(
  output: any,
  objective: any,
  evaluation: GenericEvaluationResult,
  metrics: GenericExecutionMetrics
): RewardComponents {
  let constraintScore = 0;
  let qualityScore = 0;
  const details: string[] = [];

  // 1. CONSTRAINT SATISFACTION (0-60 points)
  if (evaluation.passed) {
    constraintScore = 60;
    details.push("✓ All constraints satisfied (+60)");
  } else {
    constraintScore = 0;
    details.push(`✗ Constraints failed: ${evaluation.feedback?.code || 'UNKNOWN'} (+0)`);
  }

  // 2. EXECUTION QUALITY (0-40 points)
  if (metrics.hasErrors) {
    qualityScore -= 30;
    details.push("✗ Execution errors (-30)");
  } else {
    qualityScore += 10;
    details.push("✓ No errors (+10)");
  }

  // 3. PERFORMANCE METRICS (bonus/penalty)
  if (metrics.executionTime !== undefined) {
    if (metrics.executionTime < 50) {
      qualityScore += 15;
      details.push(`✓ Fast execution: ${metrics.executionTime}ms (+15)`);
    } else if (metrics.executionTime < 100) {
      qualityScore += 10;
      details.push(`✓ Good execution: ${metrics.executionTime}ms (+10)`);
    } else if (metrics.executionTime > 1000) {
      qualityScore -= 10;
      details.push(`✗ Slow execution: ${metrics.executionTime}ms (-10)`);
    }
  }

  // 4. SIZE/COMPLEXITY METRICS (bonus/penalty)
  if (metrics.outputSize !== undefined && metrics.expectedSize !== undefined) {
    const sizeDiff = Math.abs(metrics.outputSize - metrics.expectedSize);
    const sizeRatio = sizeDiff / metrics.expectedSize;

    if (sizeRatio < 0.1) {
      qualityScore += 10;
      details.push("✓ Optimal size (+10)");
    } else if (sizeRatio > 0.5) {
      qualityScore -= 5;
      details.push("✗ Size mismatch (-5)");
    }
  }

  // 5. CUSTOM METRICS (if provided)
  if (metrics.customMetrics) {
    for (const [metric, value] of Object.entries(metrics.customMetrics)) {
      qualityScore += value;
      details.push(`Custom metric ${metric}: ${value > 0 ? '+' : ''}${value}`);
    }
  }

  const total = constraintScore + qualityScore;

  return {
    total,
    constraintScore,
    qualityScore,
    details,
  };
}

/**
 * Validate semantic correctness (generic version)
 *
 * This is a placeholder - domain-specific implementations should override this
 * or provide their own semantic validation in the evaluator.
 */
export function validateGenericSemantics(
  output: any,
  objective: any,
  analysis: any
): { semanticsMatch: boolean; issues: string[] } {
  // Generic semantic validation - can be overridden by domain-specific logic
  const issues: string[] = [];

  // Basic check: output exists and is not empty
  if (!output || (typeof output === 'string' && output.trim().length === 0)) {
    issues.push("Output is empty or null");
  }

  // Check if output type matches expected type (if specified in objective)
  if (objective.expectedType) {
    const actualType = typeof output;
    if (actualType !== objective.expectedType) {
      issues.push(`Expected type ${objective.expectedType}, got ${actualType}`);
    }
  }

  // Check if output meets minimum quality criteria (if specified)
  if (objective.minQuality && analysis.quality !== undefined) {
    if (analysis.quality < objective.minQuality) {
      issues.push(`Quality ${analysis.quality} below minimum ${objective.minQuality}`);
    }
  }

  return {
    semanticsMatch: issues.length === 0,
    issues,
  };
}

/**
 * Calculate reward with custom reward function
 *
 * Allows domain-specific reward calculation while maintaining the generic interface
 */
export function calculateCustomReward(
  output: any,
  objective: any,
  evaluation: GenericEvaluationResult,
  metrics: GenericExecutionMetrics,
  customRewardFn?: (output: any, objective: any, evaluation: GenericEvaluationResult, metrics: GenericExecutionMetrics) => number
): RewardComponents {
  if (customRewardFn) {
    const customScore = customRewardFn(output, objective, evaluation, metrics);
    return {
      total: customScore,
      constraintScore: evaluation.passed ? 60 : 0,
      qualityScore: customScore - (evaluation.passed ? 60 : 0),
      details: [`Custom reward function: ${customScore}`],
    };
  }

  return calculateGenericReward(output, objective, evaluation, metrics);
}
