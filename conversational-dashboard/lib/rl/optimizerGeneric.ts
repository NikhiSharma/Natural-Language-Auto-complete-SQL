/**
 * Fully Generic RL Optimizer using Q-Learning
 *
 * This optimizer is completely domain-agnostic and can optimize ANY type of output.
 * It uses only generic helper functions - NO SQL-specific code.
 */

import { GenericAction, getApplicableActions, applyAction } from "./generic/actions";
import { extractGenericState, getStateKey, GenericState } from "./generic/state";
import {
  calculateGenericReward,
  validateGenericSemantics,
  GenericEvaluationResult,
  GenericExecutionMetrics,
  RewardComponents,
} from "./generic/reward";
import {
  selectAction,
  updateQValue,
  decayEpsilon,
  saveQTable,
} from "./qlearning";
import { addExperience, saveExperiences } from "./experience";

/**
 * Generic types for any domain
 */
export type GenericFeedback = {
  code: string;
  message: string;
  fix: string;
};

export type GenericContext = any;
export type GenericOutput = any;
export type GenericObjective = any;

export interface IterationLog {
  iteration: number;
  output: GenericOutput;
  action: string;
  state: string;
  evaluation: GenericEvaluationResult;
  semanticMatch: boolean;
  semanticIssues: string[];
  reward: RewardComponents;
  converged: boolean;
}

export interface OptimizationResult {
  output: GenericOutput;
  iterations: number;
  finalReward: number;
  iterationLogs: IterationLog[];
}

/**
 * Fully Generic RL Optimizer
 *
 * This function can optimize ANYTHING using Q-learning.
 * It's completely independent from SQL or any specific domain.
 *
 * @param objective - The optimization objective (any structure)
 * @param context - Domain-specific context (e.g., schema, rules, constraints)
 * @param generateOutput - Function to generate/improve output
 * @param evaluateOutput - Function to evaluate if output meets constraints
 * @param analyzeOutput - Function to analyze output structure
 * @param maxIterations - Maximum number of iterations
 * @param customConfig - Optional custom configuration
 * @returns Optimization result
 */
export async function optimizeWithRL(
  objective: GenericObjective,
  context: GenericContext,
  generateOutput: (input: {
    objective: GenericObjective;
    context: GenericContext;
    previousOutput: GenericOutput | null;
    feedback: GenericFeedback | null;
  }) => Promise<GenericOutput>,
  evaluateOutput: (
    output: GenericOutput,
    analysis: any,
    objective: GenericObjective
  ) => GenericEvaluationResult,
  analyzeOutput: (output: GenericOutput) => any,
  maxIterations: number = 10,
  customConfig?: {
    customRewardFn?: (
      output: any,
      objective: any,
      evaluation: GenericEvaluationResult,
      metrics: GenericExecutionMetrics
    ) => RewardComponents;
    customStateExtractor?: (output: any, objective: any, analysis?: any, iteration?: number) => GenericState;
    customActionSelector?: (output: any, objective: any, iteration: number) => GenericAction[];
  }
): Promise<OptimizationResult> {
  console.log("\n========== GENERIC Q-LEARNING OPTIMIZER ==========");
  console.log(`Optimizing for objective: ${JSON.stringify(objective).substring(0, 100)}...`);

  let currentOutput: GenericOutput = null;
  let previousFeedback: GenericFeedback | null = null;
  let finalReward = 0;
  const iterationLogs: IterationLog[] = [];

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    console.log(`\n--- Iteration ${iteration}/${maxIterations} ---`);

    // STEP 1: GENERATE OR TRANSFORM OUTPUT
    if (iteration === 1 || currentOutput === null) {
      // First iteration: generate initial output
      console.log("[RL] Generating initial output...");
      currentOutput = await generateOutput({
        objective,
        context,
        previousOutput: null,
        feedback: null,
      });
      console.log(`[RL] Initial output generated (type: ${typeof currentOutput})`);
    }

    // STEP 2: EXTRACT STATE
    const analysis = analyzeOutput(currentOutput);
    const currentState = customConfig?.customStateExtractor
      ? customConfig.customStateExtractor(currentOutput, objective, analysis, iteration)
      : extractGenericState(currentOutput, objective, analysis, iteration);
    const currentStateKey = getStateKey(currentState);

    console.log(`[RL] State: ${currentStateKey.substring(0, 50)}...`);
    console.log(`[RL] Features:`, Object.keys(currentState.features).slice(0, 5));

    // STEP 3: GET APPLICABLE ACTIONS
    const applicableActions = customConfig?.customActionSelector
      ? customConfig.customActionSelector(currentOutput, objective, iteration)
      : getApplicableActions(currentOutput, objective, iteration);

    console.log(`[RL] Applicable actions: ${applicableActions.join(", ")}`);

    // STEP 4: SELECT ACTION (epsilon-greedy from Q-learning)
    const selectedAction = selectAction(currentStateKey, applicableActions);
    console.log(`[RL] Selected action: ${selectedAction}`);

    // STEP 5: APPLY ACTION
    let nextOutput: GenericOutput;

    if (selectedAction === GenericAction.USE_GENERATOR || selectedAction === GenericAction.RESET) {
      // Use generator function
      console.log("[RL] Using generator to create new output...");
      nextOutput = await generateOutput({
        objective,
        context,
        previousOutput: currentOutput,
        feedback: previousFeedback,
      });
      console.log(`[RL] New output generated (type: ${typeof nextOutput})`);
    } else {
      // Apply transformation action
      console.log(`[RL] Applying transformation: ${selectedAction}...`);
      const transformed = applyAction(
        currentOutput,
        { type: selectedAction as GenericAction },
        objective
      );

      if (transformed === null) {
        // Action requires generator
        console.log("[RL] Transformation requires generator, using it...");
        nextOutput = await generateOutput({
          objective,
          context,
          previousOutput: currentOutput,
          feedback: previousFeedback,
        });
      } else {
        nextOutput = transformed;
        console.log("[RL] Transformation applied");
      }
    }

    // STEP 6: EVALUATE OUTPUT
    const nextAnalysis = analyzeOutput(nextOutput);
    const evaluationResult = evaluateOutput(nextOutput, nextAnalysis, objective);

    console.log(`[RL] Evaluation: ${evaluationResult.passed ? "✓ PASS" : "✗ FAIL"}`);
    if (!evaluationResult.passed && evaluationResult.feedback) {
      console.log(`[RL] Feedback: ${evaluationResult.feedback.message}`);
    }

    // STEP 7: SEMANTIC VALIDATION
    const semanticValidation = validateGenericSemantics(nextOutput, objective, nextAnalysis);
    console.log(
      `[RL] Semantic Match: ${semanticValidation.semanticsMatch ? "✅ YES" : "❌ NO"}`
    );
    if (!semanticValidation.semanticsMatch) {
      console.log(`[RL] Semantic Issues:`, semanticValidation.issues);
    }

    // STEP 8: CALCULATE REWARD
    const executionMetrics: GenericExecutionMetrics = {
      executionTime: nextAnalysis.executionTime,
      outputSize: nextAnalysis.size || nextAnalysis.length,
      expectedSize: objective.expectedSize,
      hasErrors: !evaluationResult.passed,
      customMetrics: nextAnalysis.customMetrics,
    };

    let reward = customConfig?.customRewardFn
      ? customConfig.customRewardFn(nextOutput, objective, evaluationResult, executionMetrics)
      : calculateGenericReward(nextOutput, objective, evaluationResult, executionMetrics);

    // Apply semantic penalty if output doesn't match intent
    if (!semanticValidation.semanticsMatch) {
      const semanticPenalty = semanticValidation.issues.length * -15;
      console.log(`[RL] Applying semantic penalty: ${semanticPenalty}`);
      reward = {
        ...reward,
        qualityScore: reward.qualityScore + semanticPenalty,
        total: reward.total + semanticPenalty,
      };
    }

    console.log(
      `[RL] Reward: ${reward.total} (constraint: ${reward.constraintScore}, quality: ${reward.qualityScore})`
    );
    finalReward = reward.total;

    // STEP 9: EXTRACT NEXT STATE
    const nextState = customConfig?.customStateExtractor
      ? customConfig.customStateExtractor(nextOutput, objective, nextAnalysis, iteration)
      : extractGenericState(nextOutput, objective, nextAnalysis, iteration);
    const nextStateKey = getStateKey(nextState);

    // STEP 10: UPDATE Q-VALUE (Bellman equation)
    updateQValue(
      currentStateKey,
      selectedAction,
      reward.total,
      nextStateKey,
      applicableActions
    );

    // STEP 11: STORE EXPERIENCE
    const experience = addExperience({
      stateKey: currentStateKey,
      action: selectedAction,
      reward: reward.total,
      nextStateKey: nextStateKey,
      terminal: evaluationResult.passed,
      timestamp: new Date().toISOString(),
      objectiveHash: currentState.objectiveHash,
    });

    console.log(`[RL] Stored experience: ${experience.id}`);

    // STEP 12: LOG ITERATION
    iterationLogs.push({
      iteration,
      output: nextOutput,
      action: selectedAction,
      state: currentStateKey.substring(0, 80),
      evaluation: evaluationResult,
      semanticMatch: semanticValidation.semanticsMatch,
      semanticIssues: semanticValidation.issues || [],
      reward,
      converged:
        evaluationResult.passed &&
        semanticValidation.semanticsMatch &&
        reward.total >= 70, // Lowered threshold for faster convergence
    });

    // STEP 13: CHECK CONVERGENCE
    // Early stopping: accept "good enough" outputs (reward >= 70) to speed up
    if (
      evaluationResult.passed &&
      semanticValidation.semanticsMatch &&
      reward.total >= 70 // Lowered from 100 for faster convergence
    ) {
      console.log("\n CONVERGED - Output meets constraints with good quality!");
      console.log(`Final output (type: ${typeof nextOutput}), Reward: ${reward.total}`);

      // Save Q-table and experiences
      saveQTable().catch((err) => console.error("Failed to save Q-table:", err));
      saveExperiences().catch((err) =>
        console.error("Failed to save experiences:", err)
      );
      decayEpsilon();

      return {
        output: nextOutput,
        iterations: iteration,
        finalReward: reward.total,
        iterationLogs,
      };
    }

    // Partial convergence
    if (
      evaluationResult.passed &&
      !semanticValidation.semanticsMatch &&
      iteration === maxIterations
    ) {
      console.log("\n  PARTIAL CONVERGENCE - Constraints pass but semantic issues remain");
      console.log("Semantic issues:", semanticValidation.issues);
    }

    // STEP 14: UPDATE FOR NEXT ITERATION
    currentOutput = nextOutput;
    previousFeedback = evaluationResult.feedback || null;
  }

  // Failed to converge
  console.log("\n Max iterations reached without full convergence");

  // Save progress
  saveQTable().catch((err) => console.error("Failed to save Q-table:", err));
  saveExperiences().catch((err) => console.error("Failed to save experiences:", err));
  decayEpsilon();

  return {
    output: currentOutput,
    iterations: maxIterations,
    finalReward,
    iterationLogs,
  };
}
