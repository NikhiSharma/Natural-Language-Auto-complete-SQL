import { RL_MODEL } from "@/lib/llm/models";
import { optimizeSQL } from "./optimizer";
import { introspectSchema, type DetailedSchema } from "@/lib/schema/introspect";

/**
  rlTool — Q-Learning based SQL Optimizer with REAL schema introspection

  NO HARDCODING - Fetches actual database schema dynamically
 */

// Simplified schema for optimizer
type Schema = {
  tables: { name: string; columns: string[] }[];
};

export type Feedback = {
  code: string;
  message: string;
  fix: string;
};

export async function rlTool(
  rawObjective: any
): Promise<{ sql: string; iterations?: number; finalReward?: number; iterationLogs?: any[] }> {
  const objective = normalizeObjective(rawObjective);

  console.log("[RL] Normalized Objective:", JSON.stringify(objective, null, 2));

  // Fetch REAL schema from database
  const schema = await getSchema();

  console.log("[RL] Using live database schema with", schema.tables.length, "tables");

  // Use Q-Learning optimizer with real schema
  const result = await optimizeSQL(
    objective,
    schema,
    generateSQL,
    evaluateSQL,
    explainQuery
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

// DYNAMIC SCHEMA - Direct introspection from PostgreSQL database

async function getDetailedSchema(): Promise<DetailedSchema> {
  return await introspectSchema();
}

async function getSchema(): Promise<Schema> {
  const detailedSchema = await getDetailedSchema();

  // Convert detailed schema to simplified format
  return {
    tables: detailedSchema.tables.map(table => ({
      name: table.name,
      columns: table.columns.map(col => col.name)
    }))
  };
}

// POLICY (LLM) - Uses DYNAMIC schema

export async function generateSQL(input: {
  objective: any;
  schema: Schema;
  previousSql: string | null;
  feedback: Feedback | null;
}): Promise<string> {
  const { objective, schema, previousSql, feedback } = input;

  // Fetch detailed schema for richer context
  const detailedSchema = await getDetailedSchema();

  // Build schema description from REAL database schema
  const schemaDescription = detailedSchema.tables
    .map((table) => {
      const cols = table.columns.map(c => `${c.name} (${c.type})`).join(", ");
      return `- Table: ${table.name}\n  Columns: ${cols}`;
    })
    .join("\n\n");

  const relationshipsDescription = detailedSchema.relationships
    .map((rel: any) => `- ${rel.from} -> ${rel.to}`)
    .join("\n");

  const prompt = `
You are an autonomous SQL query generator for a PostgreSQL database.

OBJECTIVE:
${JSON.stringify(objective, null, 2)}

DATABASE SCHEMA (LIVE FROM PostgreSQL):
${schemaDescription}

${detailedSchema.relationships.length > 0 ? `FOREIGN KEY RELATIONSHIPS:\n${relationshipsDescription}` : ""}

${previousSql ? `PREVIOUS SQL:\n${previousSql}` : ""}
${feedback ? `CRITIC FEEDBACK:\n${JSON.stringify(feedback, null, 2)}` : ""}

INSTRUCTIONS:
1. Analyze the objective to understand what data is requested
2. Identify which tables need to be joined based on the dataSource and relationships
3. Use proper JOIN syntax with table aliases
4. Apply filters from objective.scope.filters array
5. Select only the columns mentioned in objective.constraints.mustInclude
6. If filtering by a specific entity (like a department name), add appropriate WHERE clause
7. Use PostgreSQL syntax
8. Return ONLY the SQL query, no explanations or markdown

CRITICAL RULES:
- Study the LIVE schema above - don't assume column names
- Use proper JOINs based on foreign key relationships
- Apply ALL filters from the objective
- Select ALL columns from mustInclude
- Use clear table aliases (e.g., e for employees, d for departments, c for compensation)

OPTIMIZATION GUIDELINES (for highest quality):
- PREFER JOINs over subqueries (e.g., JOIN compensation c ON e.employee_id = c.employee_id instead of WHERE employee_id IN (SELECT ...))
- For one-to-many relationships (e.g., employees with multiple teams):
  * USE ARRAY_AGG with GROUP BY to aggregate related data
  * Example: ARRAY_AGG(t.team_name ORDER BY t.team_name) AS teams, then GROUP BY e.employee_id, e.name, ...
  * This prevents duplicate rows and returns cleaner, aggregated results
- Use LEFT JOIN for optional relationships (not all records may have related data)
- Include ORDER BY for consistent, predictable results
- When JOINing multiple tables, always GROUP BY all non-aggregated columns to avoid duplicates
`;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured - cannot generate SQL without LLM");
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
        { role: "system", content: "You are a PostgreSQL expert. Return ONLY valid SQL queries." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const json = await res.json();

  // Log the full response for debugging
  if (!res.ok) {
    console.error("[RL generateSQL] OpenAI API error:", json);
    throw new Error(`OpenAI API error: ${json.error?.message || 'Unknown error'}`);
  }

  const sqlQuery = json?.choices?.[0]?.message?.content?.trim();

  if (!sqlQuery) {
    console.error("[RL generateSQL] No SQL in response:", json);
    throw new Error("LLM failed to generate SQL query - empty response");
  }

  // Clean up any markdown formatting
  return sqlQuery
    .replace(/```sql\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
}

// EXPLAIN (SYMBOLIC ENVIRONMENT) - Analyzes query structure

export function explainQuery(sql: string) {
  const lower = sql.toLowerCase();

  // Extract table names from FROM and JOIN clauses
  const joinMatches = lower.match(/join\s+(\w+)/g) || [];
  const joinedTables = joinMatches.map(match => match.replace(/join\s+/, ''));

  // Extract WHERE conditions
  const whereMatch = lower.match(/where\s+(.+?)(?:group by|order by|limit|$)/);
  const whereClause = whereMatch ? whereMatch[1] : null;

  // Extract SELECT columns
  const selectMatch = lower.match(/select\s+(.+?)\s+from/);
  const selectClause = selectMatch ? selectMatch[1] : null;

  return {
    usesJoin: lower.includes("join"),
    joinedTables,
    usesWhere: lower.includes("where"),
    whereClause,
    selectClause,
    hasAggregation: /sum|avg|count|min|max/i.test(lower),
  };
}

// CRITIC - Validates SQL against objective (NO HARDCODING)

export function evaluateSQL(
  sql: string,
  explain: any,
  objective: any
): { passed: boolean; feedback?: Feedback } {
  const lower = sql.toLowerCase();
  const dataSource = objective?.constraints?.dataSource;
  const mustInclude = objective?.constraints?.mustInclude || [];
  const filters = objective?.scope?.filters || [];
  const entity = objective?.scope?.entity;
  const identifier = entity?.identifier;

  // 1. Check if required columns are selected
  for (const col of mustInclude) {
    const colLower = col.toLowerCase();
    if (!explain.selectClause || !explain.selectClause.includes(colLower)) {
      return {
        passed: false,
        feedback: {
          code: "MISSING_COLUMN",
          message: `Query must select column: ${col}`,
          fix: `Add ${col} to SELECT clause`,
        },
      };
    }
  }

  // 2. Check if filters are applied
  for (const filter of filters) {
    const fieldLower = filter.field.toLowerCase();
    const valueLower = String(filter.value).toLowerCase();

    if (!explain.whereClause || !explain.whereClause.includes(valueLower)) {
      return {
        passed: false,
        feedback: {
          code: "MISSING_FILTER",
          message: `Query must filter by ${filter.field} = ${filter.value}`,
          fix: `Add WHERE clause filtering ${filter.field} = '${filter.value}'`,
        },
      };
    }
  }

  // 3. Check entity identifier filters (e.g., department name)
  if (identifier && entity?.type) {
    const identifierLower = String(identifier).toLowerCase();

    if (!explain.usesWhere || !lower.includes(identifierLower)) {
      return {
        passed: false,
        feedback: {
          code: "MISSING_ENTITY_FILTER",
          message: `Query must filter by ${entity.type}: ${identifier}`,
          fix: `Add WHERE clause for ${entity.type} = '${identifier}'`,
        },
      };
    }
  }

  // 4. Check if dataSource requirements are met
  if (dataSource) {
    // This is flexible - we just check if appropriate JOINs exist
    // The LLM should figure out which tables to join based on schema
    const needsJoin = dataSource.includes("_with_");

    if (needsJoin && !explain.usesJoin) {
      return {
        passed: false,
        feedback: {
          code: "MISSING_JOIN",
          message: `Query must JOIN tables for dataSource: ${dataSource}`,
          fix: `Add appropriate JOIN clauses based on schema relationships`,
        },
      };
    }
  }

  return { passed: true };
}
