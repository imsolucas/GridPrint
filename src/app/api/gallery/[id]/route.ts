import { NextResponse } from "next/server";
import { deletePoster } from "@/lib/gallery/store";

export const runtime = "nodejs";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!(await deletePoster(id))) return NextResponse.json({ error: { code: "bad-id", message: "Invalid id" } }, { status: 400 });
  return NextResponse.json({ ok: true });
}
