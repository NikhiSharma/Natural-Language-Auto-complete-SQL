import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Basic output endpoint - v3 FORCE RECOMPILE
export async function POST(req: Request) {
  const { userInput } = await req.json();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful AI assistant. Generate clear, direct responses to user requests.

Keep responses concise and focused.
Provide practical, actionable information.
Match the tone to the request (professional for business, casual for general questions).

Output the response directly without meta-commentary.`,
        },
        {
          role: "user",
          content: userInput,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const output = completion.choices[0].message.content || "";

    return NextResponse.json({ output });
  } catch (error: any) {
    console.error("Error generating response:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate response" },
      { status: 500 }
    );
  }
}
