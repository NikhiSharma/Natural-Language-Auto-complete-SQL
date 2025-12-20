export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 }
    );
  }

  return handleRLRequest(req, {
    openaiApiKey: apiKey,
    model: "gpt-4o-mini" // or gpt-4 for better results
  });
}
