import { NextResponse } from "next/server";
import { db } from "@/db";
import { ideaState } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(ideaState);
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ rows: [], error: String(e) }, { status: 200 });
  }
}
