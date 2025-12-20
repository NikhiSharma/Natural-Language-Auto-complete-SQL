import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const getSystemPrompt = () => `
You are an Objective Function Author. You analyze user requests and create structured objective functions.

Current date: ${new Date().toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
})}

You MUST output a VALID JSON object with ALL required fields.

The Objective Function defines:
- WHAT the user wants (intent)
- WHAT constraints must be satisfied
- HOW success should be measured

===========================
REQUIRED JSON SCHEMA
===========================

{
  "intent": string,  // Clear description of what the user wants
  
  "domain": string,  // Type: "sql", "content", "analysis", "code", "general"
  
  "constraints": {
    "mustInclude": string[],  // Required elements/keywords
    "mustAvoid": string[],    // Things to avoid
    "tone"?: string,          // For content: "professional", "casual", "formal", etc.
    "style"?: string          // Additional style requirements
  },
  
  "success_criteria": {
    "clarity": number,      // 0-1 score for clarity
    "completeness": number, // 0-1 score for completeness  
    "accuracy": number      // 0-1 score for accuracy
  }
}

===========================
RULES
===========================
- intent MUST match the user's actual request exactly
- domain should be: "sql" for queries, "content" for text, "analysis" for data analysis, "code" for programming
- mustInclude should list key elements the output must have
- Output ONLY valid JSON
- No markdown
- No explanations

EXAMPLES:

User: "write me a professional email about project delays"
{
  "intent": "Write professional email about project delays",
  "domain": "content",
  "constraints": {
    "mustInclude": ["project delays", "professional tone"],
    "mustAvoid": ["casual language", "emojis"],
    "tone": "professional",
    "style": "email format"
  },
  "success_criteria": {
    "clarity": 0.9,
    "completeness": 0.85,
    "accuracy": 0.9
  }
}

User: "show all employees in Engineering"
{
  "intent": "Get all employees in Engineering department",
  "domain": "sql",
  "constraints": {
    "mustInclude": ["employees", "Engineering department"],
    "mustAvoid": ["other departments"]
  },
  "success_criteria": {
    "clarity": 0.95,
    "completeness": 1.0,
    "accuracy": 1.0
  }
}
`;

export async function POST(req: Request) {
  const { userInput } = await req.json();

  const systemPrompt = getSystemPrompt();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInput },
      ],
      temperature: 0.3,
    });

    const content = completion.choices[0].message.content || "";
    const objective = JSON.parse(content);

    return NextResponse.json({ objective });
  } catch (error: any) {
    console.error("Error generating objective:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate objective" },
      { status: 500 }
    );
  }
}
