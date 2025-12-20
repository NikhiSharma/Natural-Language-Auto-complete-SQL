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
  rawObjective: any,
  aiEndpoint?: string
): Promise<{ sql: string; iterations?: number; finalReward?: number; iterationLogs?: any[] }> {
  const objective = normalizeObjective(rawObjective);

  console.log("[RL] Normalized Objective:", JSON.stringify(objective, null, 2));

  // Fetch REAL schema from database
  const schema = await getSchema();

  console.log("[RL] Using live database schema with", schema.tables.length, "tables");

  // Create generateSQL function with custom AI endpoint
  const generateSQLFn = (input: any) => generateSQL(input, aiEndpoint);

  // Use Q-Learning optimizer with real schema
  const result = await optimizeSQL(
    objective,
    schema,
    generateSQLFn,
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
}, aiEndpoint?: string): Promise<string> {
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
You are a cost-aware SQL query optimizer for a PostgreSQL database.

OBJECTIVE:
${JSON.stringify(objective, null, 2)}

DATABASE SCHEMA (LIVE FROM PostgreSQL):
${schemaDescription}

${detailedSchema.relationships.length > 0 ? `FOREIGN KEY RELATIONSHIPS:\n${relationshipsDescription}` : ""}

${previousSql ? `PREVIOUS QUERY ATTEMPT:\n${previousSql}` : ""}
${feedback ? `CRITIC FEEDBACK ON PREVIOUS ATTEMPT:\n${JSON.stringify(feedback, null, 2)}\n\nUse this feedback to improve the query.` : ""}

OPTIMIZATION PROCESS:
1. **Enumerate candidate plans**: Mentally consider 2-3 valid SQL formulations for this objective
   - Example candidates: Different join orders, JOINs vs subqueries, aggregation strategies

2. **Analyze performance tradeoffs**:
   - Cardinality: How many rows result from each operation?
   - Join fan-out: Does this join create duplicates that need GROUP BY?
   - Filter pushdown: Can WHERE clauses reduce rows before expensive JOINs?
   - Index efficiency: Which foreign key columns enable fast lookups?

3. **Apply cost-aware optimization principles**:
   - PREFER: CTEs (WITH clause) + ARRAY_AGG for complex aggregations (best pattern for modularity)
   - PREFER: Early filtering (WHERE before JOIN), minimal intermediate result sizes
   - PREFER: Aggregation (ARRAY_AGG + GROUP BY) over row multiplication for one-to-many joins
   - PREFER: Direct JOINs over correlated subqueries when estimated cardinality is low
   - PREFER: LEFT JOIN for optional relationships to preserve base table rows
   - AVOID: Full table scans, Cartesian products, DISTINCT as a band-aid for duplicates, correlated subqueries in WHERE

4. **Select the single best query** based on lowest expected execution cost
   - Minimize rows processed at each step
   - Push filters to base tables
   - Use aggregation to prevent row explosion
   - Preserve all semantic constraints and required columns

CONSTRAINTS TO PRESERVE (CRITICAL):
- Study the LIVE schema above - don't assume column names
- Include ALL columns from objective.constraints.mustInclude
- Apply ALL filters from objective.scope.filters
- Use proper JOINs based on foreign key relationships shown above
- Use clear table aliases (e.g., e for employees, d for departments, c for compensation)

OUTPUT: Return ONLY the selected optimized PostgreSQL query, no explanations or markdown
`;

  // Use custom AI endpoint or default to OpenAI
  const endpoint = aiEndpoint || "https://api.openai.com/v1/chat/completions";
  const isOpenAI = !aiEndpoint || aiEndpoint.includes("openai.com");

  if (isOpenAI && !process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured - cannot generate SQL without LLM");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add authorization header for OpenAI
  if (isOpenAI && process.env.OPENAI_API_KEY) {
    headers["Authorization"] = `Bearer ${process.env.OPENAI_API_KEY}`;
  }

  const body = {
    model: RL_MODEL,
    temperature: 0.1,
    messages: [
      { role: "system", content: "You are a PostgreSQL expert. Return ONLY valid SQL queries." },
      { role: "user", content: prompt },
    ],
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
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
