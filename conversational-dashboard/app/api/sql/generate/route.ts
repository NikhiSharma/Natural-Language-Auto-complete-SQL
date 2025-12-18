import { NextRequest, NextResponse } from "next/server";
import { introspectSchema } from "@/lib/schema/introspect";
import OpenAI from "openai";
import { OBJECTIVE_MODEL } from "@/lib/llm/models";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Basic text-to-SQL generator (no RL optimization)
 * Fast, simple SQL generation from natural language
 */
export async function POST(req: NextRequest) {
  try {
    const { objective } = await req.json();

    if (!objective) {
      return NextResponse.json(
        { error: "Missing objective" },
        { status: 400 }
      );
    }

    console.log("[Text2SQL] Generating SQL from objective...");

    // Get live database schema
    const schema = await introspectSchema();

    // Build schema description
    const schemaDescription = schema.tables
      .map((table) => {
        const cols = table.columns.map(c => `${c.name} (${c.type})`).join(", ");
        return `- Table: ${table.name}\n  Columns: ${cols}`;
      })
      .join("\n\n");

    const relationshipsDescription = schema.relationships
      .map(rel => `- ${rel.from} -> ${rel.to}`)
      .join("\n");

    const prompt = `You are a PostgreSQL expert. Generate a SQL query based on the user's request.

OBJECTIVE:
${JSON.stringify(objective, null, 2)}

DATABASE SCHEMA:
${schemaDescription}

${schema.relationships.length > 0 ? `FOREIGN KEY RELATIONSHIPS:\n${relationshipsDescription}` : ""}

YOUR TASK: Act as a cost-aware query optimizer.

PROCESS:
1. **Enumerate candidate plans**: For this objective, mentally list 2-3 valid SQL formulations
   - Example candidates: JOINs vs subqueries, different join orders, aggregation strategies

2. **Analyze performance tradeoffs** for each candidate:
   - Cardinality: How many rows after each operation?
   - Join fan-out: Does joining create duplicates requiring GROUP BY?
   - Filter pushdown: Can WHERE clauses reduce rows early?
   - Index usage: Which columns are in foreign keys?

3. **Reason about cost factors**:
   - PREFER: CTEs (WITH clause) + ARRAY_AGG for complex aggregations (best pattern for modularity)
   - PREFER: Early filtering (WHERE before JOIN), reduced intermediate result sizes
   - PREFER: Aggregation (ARRAY_AGG + GROUP BY) over Cartesian products for one-to-many
   - PREFER: Direct JOINs over correlated subqueries when cardinality is low
   - PREFER: LEFT JOIN for optional relationships to avoid losing base rows
   - AVOID: Full table scans, unnecessary join fan-out, duplicate row elimination via DISTINCT, correlated subqueries in WHERE

4. **Select the single best query** based on expected execution efficiency
   - Minimize rows at each step
   - Push filters down close to base tables
   - Use aggregation to prevent row multiplication
   - Preserve all semantic constraints from the objective

CONSTRAINTS TO PRESERVE:
- Include ALL columns from objective.constraints.mustInclude
- Apply ALL filters from objective.scope.filters
- Respect the dataSource tables specified
- Use proper table aliases for readability

SEMANTIC INTENT PRESERVATION (CRITICAL):
- When optimizing, preserve the semantic intent of the original query
- Removing a table means eliminating joins to that table, NOT introducing exclusion predicates unless explicitly requested
- Example: "remove team" → eliminate team JOIN, don't add WHERE team_id NOT IN (...)
- Only add exclusion filters (NOT IN, !=, EXCEPT) when the user explicitly requests exclusion

OUTPUT: Return ONLY the selected optimized PostgreSQL query, no explanations or commentary

Generate the optimal query:`;

    const response = await openai.chat.completions.create({
      model: OBJECTIVE_MODEL,
      temperature: 0.1,
      messages: [
        { role: "system", content: "You are a PostgreSQL expert. Return ONLY valid SQL queries." },
        { role: "user", content: prompt },
      ],
    });

    let sql = response.choices[0]?.message?.content?.trim();

    if (!sql) {
      throw new Error("Failed to generate SQL");
    }

    // Clean up markdown formatting
    sql = sql
      .replace(/```sql\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    console.log("[Text2SQL] Generated SQL:", sql);

    return NextResponse.json({ sql });

  } catch (error: any) {
    console.error("[Text2SQL Error]:", error.message);
    return NextResponse.json(
      { error: "Failed to generate SQL", details: error.message },
      { status: 500 }
    );
  }
}
