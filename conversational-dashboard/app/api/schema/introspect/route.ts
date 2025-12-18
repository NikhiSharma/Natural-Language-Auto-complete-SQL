import { NextResponse } from "next/server";
import { introspectSchema } from "@/lib/schema/introspect";

/**
 * API endpoint to introspect PostgreSQL database schema
 */
export async function GET() {
  try {
    const schema = await introspectSchema();
    return NextResponse.json({ schema });
  } catch (err: any) {
    console.error("[Schema Introspect API Error]:", err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
