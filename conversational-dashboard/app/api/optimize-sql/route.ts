import { NextRequest, NextResponse } from "next/server";
import { analyzeQuery, executeAndAnalyze } from "@/lib/sql/analyzer";
import { rlTool } from "@/lib/rl/rlTool";

/**
 * Standalone SQL Optimizer API
 *
 * INPUT:
 * - objective: The objective function
 * - tools (optional): Array of tools to use ["explain", "execute", "ai"]
 * - aiEndpoint (optional): Custom AI endpoint URL (defaults to OpenAI)
 *
 * OUTPUT:
 * - sql: Optimized SQL query
 * - analysis: EXPLAIN analysis (row count, cost, fields)
 * - executionResults (if "execute" tool used): Actual results
 * - optimizationLogs: Step-by-step AI iteration logs
 */
export async function POST(req: NextRequest) {
  try {
    const { objective, tools = ["explain", "ai"], aiEndpoint } = await req.json();

    if (!objective) {
      return NextResponse.json(
        { error: "Missing objective" },
        { status: 400 }
      );
    }

    console.log("[OptimizeSQL] Starting optimization...");
    console.log("[OptimizeSQL] Tools enabled:", tools);
    if (aiEndpoint) {
      console.log("[OptimizeSQL] Using custom AI endpoint:", aiEndpoint);
    }

    // Step 1: Generate optimized SQL using RL
    const rlResult = await rlTool(objective, aiEndpoint);

    console.log("[OptimizeSQL] RL optimization complete");

    // Step 2: Analyze the query using EXPLAIN (if enabled)
    let analysis = null;
    if (tools.includes("explain")) {
      console.log("[OptimizeSQL] Running EXPLAIN analysis...");
      analysis = await analyzeQuery(rlResult.sql);
      console.log("[OptimizeSQL] Analysis complete:", {
        estimatedRows: analysis.estimatedRows,
        estimatedCost: analysis.estimatedCost,
        fields: analysis.fields,
      });
    }

    // Step 3: Execute the query (if enabled)
    let executionResults = null;
    if (tools.includes("execute")) {
      console.log("[OptimizeSQL] Executing query...");
      const execResult = await executeAndAnalyze(rlResult.sql);
      executionResults = {
        rowCount: execResult.rowCount,
        fields: execResult.fields,
        executionTime: execResult.executionTime,
        rows: execResult.results,
      };
      console.log("[OptimizeSQL] Execution complete:", {
        rowCount: execResult.rowCount,
        executionTime: execResult.executionTime,
      });
    }

    // Return comprehensive results
    // Note: The response format supports both the generic RL hook and SQL-specific hook
    return NextResponse.json({
      // Generic RL format
      output: rlResult.sql,
      metadata: {
        iterations: rlResult.iterations || 0,
        finalReward: rlResult.finalReward || 0,
        iterationLogs: rlResult.iterationLogs || [],
      },
      message: getOptimizationMessage(rlResult.finalReward || 0),

      // SQL-specific format (for backward compatibility)
      sql: rlResult.sql,
      analysis: analysis
        ? {
            estimatedRows: analysis.estimatedRows,
            estimatedCost: analysis.estimatedCost,
            fields: analysis.fields,
            usesIndex: analysis.usesIndex,
            hasAggregation: analysis.hasAggregation,
          }
        : null,
      executionResults,
      optimizationMetadata: {
        iterations: rlResult.iterations || 0,
        finalReward: rlResult.finalReward || 0,
        iterationLogs: rlResult.iterationLogs || [],
      },
    });
  } catch (error: any) {
    console.error("[OptimizeSQL API] Error:", error);
    return NextResponse.json(
      { error: "Failed to optimize SQL", details: error.message },
      { status: 500 }
    );
  }
}

function getOptimizationMessage(reward: number): string {
  if (reward >= 100) return "Fully optimized - SQL meets all constraints";
  if (reward >= 80) return "Well optimized - SQL mostly satisfies constraints";
  if (reward >= 60) return "Partially optimized - SQL may need refinement";
  return "Optimization incomplete - consider manual review";
}
