import { NextRequest, NextResponse } from "next/server";
import { rlTool } from "@/lib/rl/rlTool";

export async function POST(req: NextRequest) {
  try {
    const { objective } = await req.json();

    if (!objective) {
      return NextResponse.json(
        { error: "Missing objective" },
        { status: 400 }
      );
    }

    // Run the Q-Learning RL optimizer (autonomous learning)
    const result = await rlTool(objective);

    // Return SQL with RL metadata
    return NextResponse.json({
      sql: result.sql,
      iterations: result.iterations || 0,
      finalReward: result.finalReward || 0,
      iterationLogs: result.iterationLogs || [],
      message: result.finalReward && result.finalReward >= 100
        ? "Fully converged - SQL meets all constraints"
        : result.finalReward && result.finalReward >= 80
        ? "Good - SQL mostly satisfies constraints"
        : "Partial convergence - may need refinement"
    });
  } catch (error) {
    console.error("[RL Execute API] Error:", error);
    return NextResponse.json(
      { error: "Failed to execute RL tool", details: String(error) },
      { status: 500 }
    );
  }
}
