import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "userHistory.json"); // user history file

export async function POST(req: Request) {
  try {
    const { naturalText } = await req.json();

    // Read existing history
    let existing: any[] = [];
    try {
      if (fs.existsSync(FILE)) {
        existing = JSON.parse(fs.readFileSync(FILE, "utf8"));
        // migrate legacy string array to objects
        if (Array.isArray(existing) && existing.length > 0 && typeof existing[0] === 'string') {
          existing = existing.map((s: string, i: number) => ({ naturalText: s, createdAt: new Date().toISOString(), id: `u-${i}` }));
        }
      }
    } catch {
      existing = [];
    }

    const entry = { naturalText, createdAt: new Date().toISOString(), id: `u-${Date.now()}` };
    // Prepend newest entries so file keeps newest-first order
    existing.unshift(entry);

    fs.mkdirSync(path.dirname(FILE), { recursive: true }); // ensure directory exists
    fs.writeFileSync(FILE, JSON.stringify(existing, null, 2), "utf8"); // write updated history back to file

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("POST /store-user-history error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (!fs.existsSync(FILE)) return NextResponse.json([]);

    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));

    // Normalize entries and ensure we return newest-first
    const out = (Array.isArray(raw) ? raw : []).map((entry: any, idx: number) => {
      if (typeof entry === "string") {
        return { naturalText: entry, createdAt: new Date().toISOString(), id: `u-${idx}` }; // migrate legacy string to object
      }
      return { naturalText: entry.naturalText || "", createdAt: entry.createdAt || new Date().toISOString(), id: entry.id || `u-${idx}` };
    }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // sort by createdAt descending

    return NextResponse.json(out);
  } catch (err) {
    console.error("GET /store-user-history error:", err);
    return NextResponse.json([]);
  }
}
