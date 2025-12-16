import { ObjectiveConfig } from "@/lib/objective/schema";
import { SQLAction } from "./types";
import { extractState, stateKey } from "./state";
import { applyAction, getApplicableActions } from "./actions";
import { calculateReward, validateQuerySemantics } from "./reward";
import {
  selectAction,
  updateQValue,
  decayEpsilon,
  saveQTable,
} from "./qlearning";
import { addExperience, saveExperiences } from "./experience";

// Import from existing rlTool.ts
type Schema = {
  tables: { name: string; columns: string[] }[];
};

type Feedback = {
  code: string;
  message: string;
  fix: string;
};

/**
 * Main RL Optimizer using Q-Learning
 *
 * This is the optimizeSQLQuery function that implements proper reinforcement learning
 */
export type IterationLog = {
  iteration: number;
  sql: string;
  action: string;
  state: string;
  evaluation: { passed: boolean; feedback?: Feedback };
  semanticMatch: boolean;
  semanticIssues: string[];
  reward: { total: number; constraintScore: number; qualityScore: number };
  converged: boolean;
};

export async function optimizeSQL(
  objective: ObjectiveConfig,
  schema: Schema,
  generateSQL: (input: {
    objective: any;
    schema: Schema;
    previousSql: string | null;
    feedback: Feedback | null;
  }) => Promise<string>,
  evaluateSQL: (sql: string, explain: any, objective: any) => { passed: boolean; feedback?: Feedback },
  explainQuery: (sql: string) => any
): Promise<{ sql: string; iterations: number; finalReward: number; iterationLogs: IterationLog[] }> {
  // console.log("\n========== Q-LEARNING OPTIMIZER ==========");

  const maxIterations = objective?.loopPolicy?.maxIterations ?? 5;
  let currentSQL = "";
  let previousFeedback: Feedback | null = null;
  let finalReward = 0;
  const iterationLogs: IterationLog[] = [];

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    console.log(`\n--- Iteration ${iteration} ---`);

    // 1. EXTRACT STATE
    // If first iteration, generate initial SQL using LLM
    if (iteration === 1) {
      currentSQL = await generateSQL({
        objective,
        schema,
        previousSql: null,
        feedback: null,
      });
      console.log(`[Optimizer] Initial SQL from LLM:\n${currentSQL}`);
    }

    const currentState = extractState(currentSQL, objective);
    const currentStateKey = stateKey(currentState);

    console.log(`[Optimizer] State: ${currentStateKey.substring(0, 50)}...`);

    // 2. GET APPLICABLE ACTIONS
    const applicableActions = getApplicableActions(currentSQL, objective);
    console.log(`[Optimizer] Applicable actions: ${applicableActions.join(", ")}`);

    // 3. SELECT ACTION (epsilon-greedy)
    const selectedAction = selectAction(currentStateKey, applicableActions);
    console.log(`[Optimizer] Selected action: ${selectedAction}`);

    // 4. APPLY ACTION
    let nextSQL: string;
    if (selectedAction === SQLAction.USE_LLM_POLICY) {
      // Use LLM policy
      nextSQL = await generateSQL({
        objective,
        schema,
        previousSql: currentSQL,
        feedback: previousFeedback,
      });
      console.log(`[Optimizer] LLM generated SQL:\n${nextSQL}`);
    } else {
      // Apply transformation action
      nextSQL = applyAction(
        currentSQL,
        { type: selectedAction },
        objective
      );
      console.log(`[Optimizer] Transformed SQL:\n${nextSQL}`);
    }

    // 5. EVALUATE NEW SQL
    const explain = explainQuery(nextSQL);
    const evaluationResult = evaluateSQL(nextSQL, explain, objective);

    console.log(`[Optimizer] Evaluation: ${evaluationResult.passed ? "PASS" : "FAIL"}`);
    if (!evaluationResult.passed && evaluationResult.feedback) {
      console.log(`[Optimizer] Feedback: ${evaluationResult.feedback.message}`);
    }

    // 5.5. SEMANTIC VALIDATION (EXPLAIN-like analysis)
    const semanticValidation = validateQuerySemantics(nextSQL, objective, explain);
    console.log(`[Optimizer] Semantic Match: ${semanticValidation.semanticsMatch ? "✅ YES" : "❌ NO"}`);
    if (!semanticValidation.semanticsMatch) {
      console.log(`[Optimizer] Semantic Issues:`, semanticValidation.issues);
    }

    // 6. CALCULATE REWARD (autonomous - based on execution + semantics)
    let reward = calculateReward(
      nextSQL,
      objective,
      evaluationResult,
      {
        // Execution metrics (in real system, get from actual query execution)
        executionTime: undefined, // TODO: Measure actual execution time
        rowCount: undefined, // TODO: Get from query results
        expectedRowCount: undefined, // TODO: Infer from objective
        hasErrors: !evaluationResult.passed,
      }
    );

    // Apply semantic penalty if query doesn't match intent
    if (!semanticValidation.semanticsMatch) {
      const semanticPenalty = semanticValidation.issues.length * -15; // -15 per issue
      console.log(`[Optimizer] Applying semantic penalty: ${semanticPenalty}`);
      reward = {
        ...reward,
        qualityScore: reward.qualityScore + semanticPenalty,
        total: reward.total + semanticPenalty,
      };
    }

    console.log(`[Optimizer] Reward: ${reward.total} (constraint: ${reward.constraintScore}, quality: ${reward.qualityScore})`);
    finalReward = reward.total;

    // 7. EXTRACT NEXT STATE
    const nextState = extractState(nextSQL, objective);
    const nextStateKey = stateKey(nextState);

    // 8. UPDATE Q-VALUE (Bellman equation)
    updateQValue(
      currentStateKey,
      selectedAction,
      reward.total,
      nextStateKey,
      applicableActions
    );

    // 9. STORE EXPERIENCE
    const experience = addExperience({
      stateKey: currentStateKey,
      action: selectedAction,
      reward: reward.total,
      nextStateKey: nextStateKey,
      terminal: evaluationResult.passed,
      timestamp: new Date().toISOString(),
      objectiveHash: currentState.objectiveHash,
    });

    console.log(`[Optimizer] Stored experience: ${experience.id}`);

    // Log this iteration
    iterationLogs.push({
      iteration,
      sql: nextSQL,
      action: selectedAction,
      state: currentStateKey.substring(0, 80),
      evaluation: evaluationResult,
      semanticMatch: semanticValidation.semanticsMatch,
      semanticIssues: semanticValidation.issues || [],
      reward: {
        total: reward.total,
        constraintScore: reward.constraintScore,
        qualityScore: reward.qualityScore,
      },
      converged: evaluationResult.passed && semanticValidation.semanticsMatch && reward.total >= 100,
    });

    // 10. CHECK CONVERGENCE (constraints + semantics)
    if (evaluationResult.passed && semanticValidation.semanticsMatch && reward.total >= 100) {
      console.log("\n CONVERGED - SQL meets all constraints AND semantic intent!");

      // Save Q-table and experiences asynchronously
      saveQTable().catch((err) => console.error("Failed to save Q-table:", err));
      saveExperiences().catch((err) => console.error("Failed to save experiences:", err));

      // Decay epsilon
      decayEpsilon();

      return { sql: nextSQL, iterations: iteration, finalReward: reward.total, iterationLogs };
    }

    // Partial convergence if only constraints pass (but not semantics)
    if (evaluationResult.passed && !semanticValidation.semanticsMatch && iteration === maxIterations) {
      console.log("\n  PARTIAL CONVERGENCE - Constraints pass but semantic issues remain");
      console.log("Semantic issues:", semanticValidation.issues);
    }

    // 11. UPDATE FOR NEXT ITERATION
    currentSQL = nextSQL;
    previousFeedback = evaluationResult.feedback || null;
  }

  // Failed to converge
  console.log("\n Max iterations reached without full convergence");

  // Still save progress
  saveQTable().catch((err) => console.error("Failed to save Q-table:", err));
  saveExperiences().catch((err) => console.error("Failed to save experiences:", err));
  decayEpsilon();

  return { sql: currentSQL, iterations: maxIterations, finalReward, iterationLogs };
}

/**
 * Retroactively update Q-values based on actual query execution results
 *
 * After query is executed, provide execution metrics to improve learning
 */
export async function updateFromExecution(
  experienceId: string,
  executionMetrics: {
    executionTime: number;
    rowCount: number;
    hasErrors: boolean;
  }
): Promise<void> {
  const { getExperienceById } = await import("./experience");
  const experience = getExperienceById(experienceId);

  if (!experience) {
    console.error(`[Optimizer] Experience ${experienceId} not found`);
    return;
  }

  // Calculate execution bonus/penalty
  let executionReward = 0;

  if (executionMetrics.hasErrors) {
    executionReward = -30; // Error penalty
  } else {
    // Fast execution bonus
    if (executionMetrics.executionTime < 50) executionReward += 15;
    else if (executionMetrics.executionTime < 100) executionReward += 10;
    else if (executionMetrics.executionTime > 1000) executionReward -= 10;

    // Results returned bonus
    if (executionMetrics.rowCount > 0) executionReward += 10;
  }

  const newReward = experience.reward + executionReward;

  console.log(`[Optimizer] Updating from execution metrics for ${experienceId}`);
  console.log(`[Optimizer] Execution: ${executionMetrics.executionTime}ms, ${executionMetrics.rowCount} rows`);
  console.log(`[Optimizer] Reward: ${experience.reward} → ${newReward}`);

  // Re-update Q-value with execution-based reward
  const { updateQValue } = await import("./qlearning");

  updateQValue(
    experience.stateKey,
    experience.action,
    newReward,
    experience.nextStateKey,
    [SQLAction.USE_LLM_POLICY, SQLAction.ADD_COLUMN, SQLAction.ADD_WHERE_CLAUSE] // Approximate
  );

  // Save updated Q-table
  await saveQTable();
}
