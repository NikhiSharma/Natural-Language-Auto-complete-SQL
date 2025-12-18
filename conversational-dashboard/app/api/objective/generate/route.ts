import { NextResponse } from "next/server";
import OpenAI from "openai";
import { ObjectiveConfig } from "@/lib/objective/schema";
import { OBJECTIVE_MODEL } from "@/lib/llm/models";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const SYSTEM_PROMPT = `
You are an Objective Function Author for an employee/department database.

DATABASE SCHEMA:
- Table: employees
  - Columns: employee_id (integer), name (text), city (text), department_id (integer)

- Table: departments
  - Columns: department_id (integer), name (text), location (text)

- Table: compensation
  - Columns: employee_id (integer), salary (numeric), reports_to (integer)

- Table: teams
  - Columns: team_id (integer), team_name (text), department_id (integer)

- Table: employee_teams
  - Columns: employee_id (integer), team_id (integer)

RELATIONSHIPS:
- employees.department_id -> departments.department_id
- compensation.employee_id -> employees.employee_id
- teams.department_id -> departments.department_id
- employee_teams.employee_id -> employees.employee_id
- employee_teams.team_id -> teams.team_id

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
    "dataSource": "employees" | "employees_with_departments" | "employees_with_compensation",
    "mustInclude": []
  },
}

===========================
RULES
===========================
- intent MUST match the user's actual request - don't add complexity
- If no timeframe mentioned, use "RELATIVE" with value "all time"
- If specific department/employee/city mentioned, extract it to entity.identifier
- For MIXED entity types, use the filters array instead
- Field names can be: name (employee), salary, city, department name
- Know that: Engineering, Product, Design = department names
- If department is mentioned, use dataSource "employees_with_departments" (triggers JOIN)
- If salary is mentioned, use dataSource "employees_with_compensation" (triggers JOIN)
- If only employee names mentioned, use dataSource "employees"
- mustInclude should be empty array unless specific columns requested
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

  const response = await openai.chat.completions.create({
    model: OBJECTIVE_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
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
