import { Reward } from "./types";
import { ObjectiveConfig } from "@/lib/objective/schema";

/**
 * Feedback from symbolic validation (from evaluator.ts or rlTool.ts)
 */
type EvaluationResult = {
  passed: boolean;
  feedback?: {
    code: string;
    message: string;
    fix: string;
  };
};

/**
 * Calculate reward for a SQL query given the objective
 * AUTONOMOUS: Learns from query execution, not user feedback
 */
export function calculateReward(
  sql: string,
  objective: ObjectiveConfig,
  evaluationResult: EvaluationResult,
  executionMetrics?: {
    executionTime?: number;
    rowCount?: number;
    expectedRowCount?: number;
    hasErrors?: boolean;
  }
): Reward & { details: string[] } {
  let constraintScore = 0;
  let qualityScore = 0;
  const details: string[] = [];

  // 1. CONSTRAINT SATISFACTION (Most Important - 100 points)
  if (evaluationResult.passed) {
    constraintScore = 100; // Perfect score
    details.push("✓ All constraints satisfied (+100)");
  } else {
    // Partial credit based on which constraints are partially met
    constraintScore = calculatePartialCredit(sql, objective, evaluationResult);
    details.push(`⚠ Partial constraints (${constraintScore}/100)`);
    if (evaluationResult.feedback) {
      details.push(`  Issue: ${evaluationResult.feedback.message}`);
    }
  }

  // 2. QUERY QUALITY METRICS (up to 80 points - significantly increased)
  const simplicityBonus = calculateSimplicityBonus(sql);
  if (simplicityBonus !== 0) {
    details.push(`${simplicityBonus > 0 ? '✓' : '✗'} Simplicity: ${simplicityBonus > 0 ? '+' : ''}${simplicityBonus}`);
  }
  qualityScore += simplicityBonus;

  const specificityBonus = calculateSpecificityBonus(sql);
  if (specificityBonus !== 0) {
    details.push(`${specificityBonus > 0 ? '✓' : '✗'} Specificity: ${specificityBonus > 0 ? '+' : ''}${specificityBonus}`);
  }
  qualityScore += specificityBonus;

  const costBonus = calculateCostBonus(sql);
  if (costBonus !== 0) {
    details.push(`${costBonus > 0 ? '✓' : '✗'} Query optimization: ${costBonus > 0 ? '+' : ''}${costBonus}`);
  }
  qualityScore += costBonus;

  const patternBonus = calculatePatternBonus(sql, objective);
  if (patternBonus !== 0) {
    details.push(`${patternBonus > 0 ? '✓' : '✗'} Query patterns: ${patternBonus > 0 ? '+' : ''}${patternBonus}`);
  }
  qualityScore += patternBonus;

  // 3. EXECUTION METRICS (autonomous learning - up to 20 points)
  if (executionMetrics) {
    const execBonus = calculateExecutionBonus(executionMetrics);
    if (execBonus !== 0) {
      details.push(`${execBonus > 0 ? '✓' : '✗'} Execution: ${execBonus > 0 ? '+' : ''}${execBonus}`);
    }
    qualityScore += execBonus;
  }

  return {
    constraintScore,
    qualityScore,
    userFeedback: 0, // Not used in autonomous mode
    total: constraintScore + qualityScore,
    details,
  };
}

/**
 * Pattern bonus - reward SQL best practices
 */
function calculatePatternBonus(sql: string, objective: ObjectiveConfig): number {
  const lower = sql.toLowerCase();
  let bonus = 0;

  // Check if query involves one-to-many relationships (e.g., employees with multiple teams)
  const hasOneToMany =
    objective.constraints?.dataSource?.includes("_with_") ||
    lower.includes("employee_teams") ||
    lower.includes("teams");

  if (hasOneToMany) {
    // BEST PRACTICE: Use ARRAY_AGG with GROUP BY to avoid duplicates
    if (lower.includes("array_agg") && lower.includes("group by")) {
      bonus += 30; // Major bonus for best pattern
    }
    // ACCEPTABLE: Use DISTINCT to handle duplicates
    else if (lower.includes("distinct")) {
      bonus += 10; // Minor bonus
    }
    // BAD: No deduplication for one-to-many
    else if (!lower.includes("group by") && !lower.includes("distinct")) {
      bonus -= 20; // Penalty for potential duplicates
    }
  }

  // Reward proper JOIN order (fact table first, then dimensions)
  if (lower.includes("from employees") && lower.includes("join")) {
    bonus += 5; // Good practice to start with main entity
  }

  // Reward table aliases for readability
  const aliasCount = (lower.match(/\sas\s[a-z]/g) || []).length;
  if (aliasCount >= 2) {
    bonus += 5; // Uses aliases consistently
  }

  return bonus;
}

/**
 * Calculate partial credit for constraints
 */
function calculatePartialCredit(
  sql: string,
  objective: ObjectiveConfig,
  evaluationResult: EvaluationResult
): number {
  let score = 0;
  const lower = sql.toLowerCase();

  // Check timeframe constraint (partial credit)
  const timeframe = objective?.scope?.timeframe;
  if (timeframe && timeframe.value) {
    if (lower.includes("created_at") || lower.includes("date")) {
      score += 30; // Has date filtering
    }
  }

  // Check entity constraint (partial credit)
  const entity = objective?.scope?.entity;
  if (entity && entity.type) {
    const entityColumn = getEntityColumn(entity.type);
    if (lower.includes(entityColumn.toLowerCase())) {
      score += 30; // Has correct entity column
    }
  }

  // Check mustInclude constraint (partial credit)
  const mustInclude = objective?.constraints?.mustInclude || [];
  if (mustInclude.length > 0) {
    const includedCount = mustInclude.filter((field) =>
      lower.includes(field.toLowerCase())
    ).length;
    score += (includedCount / mustInclude.length) * 40; // Up to 40 points
  }

  // Give some credit if at least it's a SELECT query
  if (lower.startsWith("select")) {
    score += 10;
  }

  return Math.min(score, 90); // Cap at 90 (< 100 means not fully passing)
}

/**
 * Simplicity bonus - shorter queries are better (if they meet constraints)
 */
function calculateSimplicityBonus(sql: string): number {
  if (sql.length < 100) return 15;
  if (sql.length < 200) return 10;
  if (sql.length < 300) return 5;
  return -5; // Penalty for very long queries
}

/**
 * Specificity bonus - avoid SELECT *
 */
function calculateSpecificityBonus(sql: string): number {
  if (sql.includes("SELECT *")) return -5;

  // Bonus for selecting specific columns
  const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM/i);
  if (selectMatch) {
    const columns = selectMatch[1].split(",").map((c) => c.trim());
    if (columns.length > 0 && columns.length <= 5) {
      return 5; // Reasonable number of columns
    }
  }

  return 0;
}

/**
 * Cost bonus - reward optimized SQL patterns
 */
function calculateCostBonus(sql: string): number {
  const lower = sql.toLowerCase();
  let bonus = 0;

  // MAJOR BONUS: Prefer JOINs over subqueries
  const hasSubquery = lower.includes("where") && (
    lower.includes("in (select") ||
    lower.includes("in ( select") ||
    lower.includes("exists (select")
  );
  const hasJoin = lower.includes("join");

  if (hasJoin && !hasSubquery) {
    bonus += 20; // Reward proper JOINs
  } else if (hasSubquery) {
    bonus -= 15; // Penalize subqueries when JOINs could be used
  }

  // MAJOR BONUS: Reward aggregation for one-to-many relationships
  if (lower.includes("array_agg") && lower.includes("group by")) {
    bonus += 25; // Best pattern for handling multiple teams per employee
  }

  // Reward LEFT JOIN for optional relationships
  if (lower.includes("left join")) {
    bonus += 10; // Good for nullable relationships
  }

  // Reward GROUP BY (prevents duplicate rows)
  if (lower.includes("group by")) {
    bonus += 15;
  }

  // Penalty for SELECT * in production queries
  if (lower.includes("select *") && !lower.includes("select * from")) {
    bonus -= 5;
  }

  // Penalty for missing WHERE when filters are likely needed
  if (!lower.includes("where") && !lower.includes("group by")) {
    bonus -= 5; // Mild penalty
  }

  // Bonus for ordering results
  if (lower.includes("order by")) {
    bonus += 5;
  }

  return bonus;
}

/**
 * Map entity type to column name
 */
function getEntityColumn(entityType: string): string {
  const mapping: Record<string, string> = {
    merchant: "merchant_name",
    merchants: "merchant_name",
    category: "category",
  };

  return mapping[entityType.toLowerCase()] || entityType;
}

/**
 * Validate query semantics using EXPLAIN-like analysis
 * This ensures the query structure matches the intent
 */
export function validateQuerySemantics(
  sql: string,
  objective: ObjectiveConfig,
  explain: any
): {
  semanticsMatch: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const lower = sql.toLowerCase();
  const intent = objective.intent.toLowerCase();

  // 1. Check if intent wants to EXCLUDE but query doesn't
  if (intent.includes("except") || intent.includes("excluding")) {
    const entity = objective.scope?.entity;
    if (entity?.identifier) {
      const excludeTerm = String(entity.identifier).toLowerCase();

      // Should use != or NOT IN for exclusion
      if (!lower.includes("!=") && !lower.includes("not in")) {
        if (lower.includes(`'${excludeTerm}'`) || lower.includes(`"${excludeTerm}"`)) {
          issues.push(`Intent wants to EXCLUDE "${entity.identifier}" but query may INCLUDE it`);
        }
      }
    }
  }

  // 2. Check if intent wants ALL but query has aggregation
  if (intent.includes("all") && !intent.includes("total")) {
    if (explain.aggregation) {
      issues.push("Intent wants ALL records but query uses aggregation (SUM/COUNT)");
    }
  }

  // 3. Check if intent wants SPECIFIC entity but query doesn't filter
  // Handle filters array (mixed entity types)
  if (objective.scope?.filters && Array.isArray(objective.scope.filters)) {
    for (const filter of objective.scope.filters) {
      const filterValue = String(filter.value).toLowerCase();
      const filterField = filter.field.toLowerCase();

      // Check if the field and value are in the SQL
      if (!lower.includes(filterField) || !lower.includes(filterValue)) {
        issues.push(`Intent mentions "${filter.value}" (${filter.field}) but query doesn't filter by it`);
      }
    }
  } else if (objective.scope?.entity?.identifier) {
    // Original single entity check
    const identifiers = Array.isArray(objective.scope.entity.identifier)
      ? objective.scope.entity.identifier
      : [objective.scope.entity.identifier];

    for (const id of identifiers) {
      const entityId = String(id).toLowerCase();
      if (!lower.includes(entityId) && !intent.includes("except")) {
        issues.push(`Intent mentions "${id}" but query doesn't filter by it`);
      }
    }
  }

  // 4. Check SELECT * vs specific fields - REMOVED THIS CHECK
  // SELECT * is fine for "expenses" queries since we want all columns

  return {
    semanticsMatch: issues.length === 0,
    issues,
  };
}

/**
 * Calculate execution-based bonus (autonomous learning)
 */
function calculateExecutionBonus(metrics: {
  executionTime?: number;
  rowCount?: number;
  expectedRowCount?: number;
  hasErrors?: boolean;
}): number {
  let bonus = 0;

  // Penalty for errors
  if (metrics.hasErrors) {
    return -20; // Major penalty
  }

  // Bonus for fast execution (< 100ms)
  if (metrics.executionTime !== undefined) {
    if (metrics.executionTime < 50) bonus += 10;
    else if (metrics.executionTime < 100) bonus += 5;
    else if (metrics.executionTime > 1000) bonus -= 5; // Slow query penalty
  }

  // Bonus for returning expected row count
  if (
    metrics.rowCount !== undefined &&
    metrics.expectedRowCount !== undefined
  ) {
    const rowDiff = Math.abs(metrics.rowCount - metrics.expectedRowCount);
    if (rowDiff === 0) bonus += 10; // Exact match
    else if (rowDiff < 5) bonus += 5; // Close enough
    else if (rowDiff > 100) bonus -= 5; // Way off
  }

  // Bonus for returning results (not empty)
  if (metrics.rowCount !== undefined && metrics.rowCount > 0) {
    bonus += 5;
  }

  return Math.max(-20, Math.min(20, bonus)); // Cap between -20 and +20
}
