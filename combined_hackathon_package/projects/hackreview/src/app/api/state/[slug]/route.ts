import { NextResponse } from "next/server";
import { db } from "@/db";
import { ideaState } from "@/db/schema";

export const dynamic = "force-dynamic";

const STATUSES = ["none", "shortlist", "maybe", "drop"];

export async function PUT(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    status?: string;
    note?: string;
    scores?: Record<string, number>;
  };

  const values: {
    slug: string;
    status?: string;
    note?: string;
    scores?: Record<string, number>;
    updatedAt: Date;
  } = { slug, updatedAt: new Date() };

  if (typeof body.status === "string" && STATUSES.includes(body.status)) values.status = body.status;
  if (typeof body.note === "string") values.note = body.note.slice(0, 5000);
  if (body.scores && typeof body.scores === "object") {
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(body.scores)) {
      if (typeof v === "number" && v >= 1 && v <= 5) clean[k] = Math.round(v);
    }
    values.scores = clean;
  }

  try {
    const [row] = await db
      .insert(ideaState)
      .values(values)
      .onConflictDoUpdate({ target: ideaState.slug, set: values })
      .returning();
    return NextResponse.json({ row });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
