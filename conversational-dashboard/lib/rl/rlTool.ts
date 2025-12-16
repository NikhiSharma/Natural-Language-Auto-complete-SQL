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
  merchant: "merchant_name",
  merchants: "merchant_name",
  category: "category",
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
        name: "transactions",
        columns: [
          "id",
          "merchant_name",
          "amount",
          "category",
          "created_at",
        ],
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
  const entity = objective?.scope?.entity;
  const column = ENTITY_COLUMN_MAP[entity?.type];
  const id = entity?.identifier;

  if (!column || !id) {
    return `SELECT * FROM transactions;`;
  }

  if (Array.isArray(id)) {
    const values = id.map(v => `'${v}'`).join(", ");
    return `SELECT * FROM transactions WHERE ${column} IN (${values})`;
  }

  return `SELECT * FROM transactions WHERE ${column} = '${id}'`;
}
