import { NextResponse } from "next/server";
import { Pool } from "pg";
import { appendQueryHistory } from "@/lib/queryHistory";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sql = (body && (body.sql || body.query)) || "";

    if (!sql || typeof sql !== "string") {
      return NextResponse.json({ sql: "", rows: [], error: "No SQL query provided" });
    }

    console.log("[RUN-QUERY] Executing SQL:", sql);

    // Execute the SQL query against PostgreSQL
    const result = await pool.query(sql);
    const rows = result.rows;

    console.log(`[RUN-QUERY] Success: ${rows.length} rows returned`);

    // Log to query history (don't let this fail the request)
    try {
      appendQueryHistory({
        naturalText: sql,
        sqlQuery: sql,
        rowCount: rows.length,
        createdAt: new Date().toISOString(),
      });
    } catch (historyErr: any) {
      console.warn("[RUN-QUERY] Failed to save history:", historyErr.message);
    }

    return NextResponse.json({ sql, rows });

  } catch (err: any) {
    console.error("[RUN-QUERY ERROR]:", err.message);
    console.error("[RUN-QUERY ERROR] Stack:", err.stack);

    // Return error details for debugging
    return NextResponse.json({
      sql: "",
      rows: [],
      error: err.message,
      hint: err.hint || null,
    }, { status: 500 });
  }
}
