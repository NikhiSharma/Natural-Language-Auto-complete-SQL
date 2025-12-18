import { NextResponse } from "next/server";
import OpenAI from "openai";
import { ObjectiveConfig } from "@/lib/objective/schema";
import { OBJECTIVE_MODEL } from "@/lib/llm/models";
import { introspectSchema } from "@/lib/schema/introspect";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

async function getSchemaDescription() {
  try {
    const schema = await introspectSchema();

    const schemaDescription = schema.tables
      .map((table: any) => {
        const cols = table.columns.map((c: any) => `${c.name} (${c.type})`).join(", ");
        return `- Table: ${table.name}\n  Columns: ${cols}`;
      })
      .join("\n\n");

    const relationshipsDescription = schema.relationships
      .map((rel: any) => `- ${rel.from} -> ${rel.to}`)
      .join("\n");

    return { schemaDescription, relationshipsDescription };
  } catch (err) {
    console.error("[Objective Generate] Failed to introspect schema:", err);
    throw new Error("Cannot generate objective without database schema");
  }
}

const getSystemPrompt = (schemaDescription: string, relationshipsDescription: string) => `
You are an Objective Function Author for a PostgreSQL database.

DATABASE SCHEMA (LIVE FROM PostgreSQL):
${schemaDescription}

${relationshipsDescription ? `FOREIGN KEY RELATIONSHIPS:\n${relationshipsDescription}` : ""}

Current date: ${new Date().toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
})}

You MUST output a VALID JSON object with ALL required fields.

The Objective Function defines:
- WHAT the user wants
- WHAT must NEVER change during optimization
- HOW success is measured

===========================
REQUIRED JSON SCHEMA
===========================

{
  "intent": string,

  "scope": {
    "timeframe": {
      "type": "RELATIVE" | "ABSOLUTE",
      "value": string
    },
    "entity": {
      "type": string,
      "identifier"?: string | string[]
    },
    "filters"?: Array<{
      "field": string,
      "value": string | string[]
    }>
  },

  "constraints": {
    "dataSource": string,
    "mustInclude": string[]
  },
}

===========================
RULES
===========================
- intent MUST match the user's actual request - don't add complexity
- If no timeframe mentioned, use "RELATIVE" with value "all time"
- If specific entity mentioned (department/employee/city), extract it to entity.identifier
- For MIXED entity types or multiple filters, use the filters array
- dataSource should describe which tables are needed (e.g., "employees_with_departments_and_compensation")
- If query needs data from multiple tables, dataSource should reflect that (use "_with_" pattern)
- mustInclude should list ALL columns the user wants to see in results
- For WHERE conditions on specific values (like salary > 140000), add to filters array
- Output ONLY valid JSON
- No markdown
- No explanations

EXAMPLES:

User: "show all employees in Engineering"
{
  "intent": "Get all employees in Engineering department",
  "scope": {
    "timeframe": { "type": "RELATIVE", "value": "all time" },
    "entity": { "type": "department", "identifier": "Engineering" }
  },
  "constraints": {
    "dataSource": "employees_with_departments",
    "mustInclude": ["name"]
  }
}

User: "name and salary of people in Engineering"
{
  "intent": "Get name and salary of Engineering employees",
  "scope": {
    "timeframe": { "type": "RELATIVE", "value": "all time" },
    "entity": { "type": "department", "identifier": "Engineering" }
  },
  "constraints": {
    "dataSource": "employees_with_compensation",
    "mustInclude": ["name", "salary"]
  }
}

User: "all employees"
{
  "intent": "Get all employees",
  "scope": {
    "timeframe": { "type": "RELATIVE", "value": "all time" },
    "entity": { "type": "employee", "identifier": null }
  },
  "constraints": {
    "dataSource": "employees",
    "mustInclude": []
  }
}
`;

export async function POST(req: Request) {
  const { userInput } = await req.json();

  // Fetch live schema
  const { schemaDescription, relationshipsDescription } = await getSchemaDescription();
  const systemPrompt = getSystemPrompt(schemaDescription, relationshipsDescription);

  const response = await openai.chat.completions.create({
    model: OBJECTIVE_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userInput },
    ],
  });

  function extractJson(text: string) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("No JSON object found in model response");
    }
    return JSON.parse(match[0]);
  }

  const raw = response.choices[0].message.content!;
  const objective = extractJson(raw) as ObjectiveConfig;

  // Fallback intent (defensive)
  if (!objective.intent || typeof objective.intent !== "string") {
    objective.intent =
      typeof userInput === "string" && userInput.trim()
        ? userInput.trim()
        : "(no intent provided)";
  }

  return NextResponse.json({ objective });
}
