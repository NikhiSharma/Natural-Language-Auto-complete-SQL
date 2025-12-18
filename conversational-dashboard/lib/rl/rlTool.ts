import { RL_MODEL } from "@/lib/llm/models";
import { optimizeSQL } from "./optimizer";

/**
  rlTool — Q-Learning based SQL Optimizer with feedback-control loop
 
  NOW USES:
  - Q-Learning for action selection
  - Experience replay for learning
  - Persistent Q-table across sessions
  - LLM = one of the actions (not the only policy)
  - Proper RL: state-action-reward-next_state tuples
 */

type Schema = {
  tables: { name: string; columns: string[] }[];
};

export type Feedback = {
  code: string;
  message: string;
  fix: string;
};

const ENTITY_COLUMN_MAP: Record<string, string> = {
  department: "d.name",
  employee: "e.name",
  user: "e.name",
};

export async function rlTool(
  rawObjective: any
): Promise<{ sql: string; iterations?: number; finalReward?: number; iterationLogs?: any[] }> {
  // 🔁 Normalize objective ONCE (critical)
  const objective = normalizeObjective(rawObjective);

  console.log("[RL] Normalized Objective:", JSON.stringify(objective, null, 2));

  const schema = await getSchema();

  // NEW: Use Q-Learning optimizer instead of simple loop
  const result = await optimizeSQL(
    objective,
    schema,
    generateSQL,       // Pass LLM policy as a function
    evaluateSQL,       // Pass critic as a function
    explainQuery       // Pass environment signal as a function
  );

  console.log(`[RL] Optimizer finished: ${result.iterations} iterations, reward: ${result.finalReward}`);

  return {
    sql: result.sql,
    iterations: result.iterations,
    finalReward: result.finalReward,
    iterationLogs: result.iterationLogs,
  };
}

  // NORMALIZATION

function normalizeObjective(objective: any) {
  const entity = objective?.scope?.entity;

  if (entity?.identifier && typeof entity.identifier === "string") {
    if (entity.identifier.includes(",")) {
      entity.identifier = entity.identifier
        .split(",")
        .map((v: string) => v.trim());
    }
  }

  return objective;
}

  // SCHEMA

async function getSchema(): Promise<Schema> {
  return {
    tables: [
      {
        name: "employees",
        columns: ["employee_id", "name", "city", "department_id"],
      },
      {
        name: "departments",
        columns: ["department_id", "name", "location"],
      },
      {
        name: "compensation",
        columns: ["employee_id", "salary", "reports_to"],
      },
      {
        name: "teams",
        columns: ["team_id", "team_name", "department_id"],
      },
      {
        name: "employee_teams",
        columns: ["employee_id", "team_id"],
      },
    ],
  };
}

   //POLICY (LLM) - Now exported for optimizer

export async function generateSQL(input: {
  objective: any;
  schema: Schema;
  previousSql: string | null;
  feedback: Feedback | null;
}): Promise<string> {
  const { objective, schema, previousSql, feedback } = input;

  const prompt = `
You are an autonomous SQL agent.

OBJECTIVE:
${JSON.stringify(objective, null, 2)}

SCHEMA:
${JSON.stringify(schema, null, 2)}

${previousSql ? `PREVIOUS SQL:\n${previousSql}` : ""}
${feedback ? `CRITIC FEEDBACK:\n${JSON.stringify(feedback, null, 2)}` : ""}

RULES:
- Fix ONLY what critic mentions
- Preserve intent semantics
- Use correct entity-column mapping
- Multiple identifiers → use IN
- If objective has "filters" array, combine them with OR: WHERE (field1 = value1 OR field2 = value2)
- Return ONLY SQL
`;

  if (!process.env.OPENAI_API_KEY) {
    return heuristicFallback(objective);
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: RL_MODEL,
      temperature: 0.1,
      messages: [
        { role: "system", content: "Return ONLY SQL." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const json = await res.json();
  return json?.choices?.[0]?.message?.content?.trim()
    ?? heuristicFallback(objective);
}

  // EXPLAIN (SYMBOLIC ENVIRONMENT) - Now exported for optimizer

export function explainQuery(sql: string) {
  const lower = sql.toLowerCase();

  return {
    usesIn: lower.includes(" in "),
    usesEquality: lower.includes("="),
    filters: {
      merchant: lower.includes("merchant_name"),
      category: lower.includes("category"),
    },
    aggregation: lower.includes("sum(") || lower.includes("count("),
  };
}
 // CRITIC (THE MOST IMPORTANT PART) - Now exported for optimizer

export function evaluateSQL(
  sql: string,
  explain: any,
  objective: any
): { passed: boolean; feedback?: Feedback } {
  const lower = sql.toLowerCase();

  // Handle mixed entity types with filters
  const filters = objective?.scope?.filters;
  if (filters && Array.isArray(filters) && filters.length > 0) {
    // Check if SQL has WHERE clause
    if (!lower.includes("where")) {
      return {
        passed: false,
        feedback: {
          code: "MISSING_WHERE",
          message: "Query needs WHERE clause for filtering",
          fix: "Add WHERE clause with filters",
        },
      };
    }

    // Check if all filter fields are present
    for (const filter of filters) {
      if (!lower.includes(filter.field.toLowerCase())) {
        return {
          passed: false,
          feedback: {
            code: "MISSING_FILTER_FIELD",
            message: `Query must filter by ${filter.field}`,
            fix: `Add ${filter.field} to WHERE clause`,
          },
        };
      }
    }

    // Aggregation mismatch
    if (
      objective.intent.toLowerCase().includes("all") &&
      !objective.intent.toLowerCase().includes("total") &&
      explain.aggregation
    ) {
      return {
        passed: false,
        feedback: {
          code: "UNWANTED_AGGREGATION",
          message: "Aggregation not allowed for 'all records'",
          fix: "Remove aggregation",
        },
      };
    }

    return { passed: true };
  }

  // Original single entity logic
  const entity = objective?.scope?.entity;
  const identifiers = entity?.identifier;
  const expectedColumn = ENTITY_COLUMN_MAP[entity?.type];

  if (!expectedColumn) {
    return {
      passed: false,
      feedback: {
        code: "UNKNOWN_ENTITY",
        message: "Unknown entity type",
        fix: "Use correct entity mapping",
      },
    };
  }

  // Wrong column used
  if (!explain.filters[entity.type]) {
    return {
      passed: false,
      feedback: {
        code: "WRONG_COLUMN",
        message: `Expected filter on ${expectedColumn}`,
        fix: `Filter using ${expectedColumn}`,
      },
    };
  }

  // Multiple identifiers require IN
  if (Array.isArray(identifiers) && !explain.usesIn) {
    return {
      passed: false,
      feedback: {
        code: "MULTI_ENTITY_NO_IN",
        message: "Multiple identifiers require IN clause",
        fix: "Use IN (...) instead of equality",
      },
    };
  }

  // Aggregation mismatch
  if (
    objective.intent.toLowerCase().includes("all") &&
    explain.aggregation
  ) {
    return {
      passed: false,
      feedback: {
        code: "UNWANTED_AGGREGATION",
        message: "Aggregation not allowed for 'all records'",
        fix: "Remove aggregation",
      },
    };
  }

  return { passed: true };
}

 //  FALLBACK (SAFE, SYMBOLIC)

function heuristicFallback(objective: any): string {
  const dataSource = objective?.constraints?.dataSource || "employees";
  const mustInclude = objective?.constraints?.mustInclude || [];
  const entity = objective?.scope?.entity;
  const identifier = entity?.identifier;

  // Determine which tables to join based on dataSource
  if (dataSource === "employees_with_compensation" || mustInclude.includes("salary")) {
    // Need employees, departments, and compensation
    const selectCols = mustInclude.length > 0
      ? mustInclude.map((col: string) => col === "name" ? "e.name" : col === "salary" ? "c.salary" : `d.${col}`).join(", ")
      : "e.name, d.name AS department, c.salary";

    let sql = `SELECT ${selectCols} FROM employees e JOIN departments d ON e.department_id = d.department_id JOIN compensation c ON e.employee_id = c.employee_id`;

    if (identifier && entity?.type === "department") {
      sql += ` WHERE d.name = '${identifier}'`;
    }

    return sql;
  }

  if (dataSource === "employees_with_departments") {
    const selectCols = mustInclude.length > 0
      ? mustInclude.map((col: string) => col === "name" ? "e.name" : `d.${col}`).join(", ")
      : "e.name, d.name AS department";

    let sql = `SELECT ${selectCols} FROM employees e JOIN departments d ON e.department_id = d.department_id`;

    if (identifier && entity?.type === "department") {
      sql += ` WHERE d.name = '${identifier}'`;
    }

    return sql;
  }

  // Default: just employees
  return `SELECT * FROM employees`;
}
