/**
 * SQL-Specific Adapter for Generic RL Optimizer
 *
 * This adapter wraps the generic RL optimizer with SQL-specific
 * state extraction, actions, and reward calculation for backward compatibility.
 */

import { optimizeWithRL, GenericFeedback, OptimizationResult } from "./optimizerGeneric";
import { GenericAction } from "./generic/actions";
import { extractGenericState, GenericState } from "./generic/state";
import { RewardComponents, GenericEvaluationResult, GenericExecutionMetrics } from "./generic/reward";

// Import SQL-specific types
import { ObjectiveConfig } from "@/lib/objective/schema";
import { SQLAction } from "./types";

type Schema = {
  tables: { name: string; columns: string[] }[];
};

/**
 * SQL-specific wrapper around the generic RL optimizer
 *
 * This maintains backward compatibility with the existing SQL optimizer
 * while using the generic RL core.
 */
export async function optimizeSQLWithGenericRL(
  objective: ObjectiveConfig,
  schema: Schema,
  generateSQL: (input: {
    objective: any;
    schema: Schema;
    previousSql: string | null;
    feedback: GenericFeedback | null;
  }) => Promise<string>,
  evaluateSQL: (sql: string, explain: any, objective: any) => { passed: boolean; feedback?: GenericFeedback },
  explainQuery: (sql: string) => any
): Promise<{ sql: string; iterations: number; finalReward: number; iterationLogs: any[] }> {
  // Adapt SQL functions to generic interface
  const generateOutput = async (input: {
    objective: any;
    context: any;
    previousOutput: string | null;
    feedback: GenericFeedback | null;
  }) => {
    return await generateSQL({
      objective: input.objective,
      schema: input.context,
      previousSql: input.previousOutput,
      feedback: input.feedback,
    });
  };

  const evaluateOutput = (output: string, analysis: any, objective: any): GenericEvaluationResult => {
    return evaluateSQL(output, analysis, objective);
  };

  const analyzeOutput = (output: string) => {
    return explainQuery(output);
  };

  // SQL-specific state extractor
  const sqlStateExtractor = (sql: string, objective: any, analysis?: any, iteration: number = 0): GenericState => {
    const state = extractGenericState(sql, objective, analysis, iteration);

    // Add SQL-specific features
    state.features = {
      ...state.features,
      usesJoin: analysis?.usesJoin || false,
      usesWhere: analysis?.usesWhere || false,
      hasAggregation: analysis?.hasAggregation || false,
      joinCount: analysis?.joinedTables?.length || 0,
    };

    return state;
  };

  // SQL-specific action selector
  const sqlActionSelector = (sql: string, objective: any, iteration: number): GenericAction[] => {
    const actions: GenericAction[] = [GenericAction.USE_GENERATOR];

    if (sql && sql.trim().length > 0) {
      actions.push(GenericAction.REFINE);

      // Map SQL actions to generic actions
      if (!sql.toLowerCase().includes("where")) {
        actions.push(GenericAction.EXPAND); // Add WHERE clause
      }

      if (sql.toLowerCase().split("join").length > 5) {
        actions.push(GenericAction.SIMPLIFY); // Reduce joins
      }
    }

    if (iteration > 3) {
      actions.push(GenericAction.RESET);
    }

    return actions;
  };

  // SQL-specific reward function
  const sqlRewardFn = (
    sql: string,
    objective: any,
    evaluation: GenericEvaluationResult,
    metrics: GenericExecutionMetrics
  ): RewardComponents => {
    let constraintScore = 0;
    let qualityScore = 0;
    const details: string[] = [];

    // Constraint satisfaction
    if (evaluation.passed) {
      constraintScore = 60;
      details.push("✓ All SQL constraints satisfied (+60)");
    } else {
      constraintScore = 0;
      details.push(`✗ SQL constraints failed: ${evaluation.feedback?.code || 'UNKNOWN'} (+0)`);
    }

    // Quality metrics
    if (!metrics.hasErrors) {
      qualityScore += 10;
      details.push("✓ Valid SQL syntax (+10)");
    } else {
      qualityScore -= 30;
      details.push("✗ SQL syntax errors (-30)");
    }

    // Performance bonus/penalty
    if (metrics.executionTime !== undefined) {
      if (metrics.executionTime < 50) {
        qualityScore += 15;
        details.push(`✓ Fast query: ${metrics.executionTime}ms (+15)`);
      } else if (metrics.executionTime > 1000) {
        qualityScore -= 10;
        details.push(`✗ Slow query: ${metrics.executionTime}ms (-10)`);
      }
    }

    // SQL-specific quality checks
    const lower = sql.toLowerCase();

    // Prefer indexed columns in WHERE
    if (lower.includes("where") && lower.includes("id")) {
      qualityScore += 5;
      details.push("✓ Uses indexed column in WHERE (+5)");
    }

    // Penalty for SELECT *
    if (lower.includes("select *")) {
      qualityScore -= 5;
      details.push("✗ Uses SELECT * (-5)");
    }

    // Bonus for efficient patterns
    if (lower.includes("limit")) {
      qualityScore += 3;
      details.push("✓ Uses LIMIT (+3)");
    }

    return {
      total: constraintScore + qualityScore,
      constraintScore,
      qualityScore,
      details,
    };
  };

  // Run generic optimizer with SQL-specific customizations
  const result = await optimizeWithRL(
    objective,
    schema, // context
    generateOutput,
    evaluateOutput,
    analyzeOutput,
    objective?.loopPolicy?.maxIterations ?? 10,
    {
      customRewardFn: sqlRewardFn,
      customStateExtractor: sqlStateExtractor,
      customActionSelector: sqlActionSelector,
    }
  );

  // Map generic result to SQL format
  return {
    sql: result.output,
    iterations: result.iterations,
    finalReward: result.finalReward,
    iterationLogs: result.iterationLogs.map((log) => ({
      ...log,
      sql: log.output, // Add SQL-specific field
    })),
  };
}
