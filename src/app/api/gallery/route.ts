import { NextResponse } from "next/server";
import { listPosters, savePoster } from "@/lib/gallery/store";
import { generatePoster, parseSpec } from "@/lib/poster-server";
import { getTemplate } from "@/lib/templates";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ posters: await listPosters() });
}

/** Body: { session_key, driver_number, lap_number, template, crop } */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const spec = parseSpec(Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v)])));
  if (!spec) return NextResponse.json({ error: { code: "bad-request", message: "Invalid poster spec" } }, { status: 400 });
  const result = await generatePoster(spec);
  if (!result.ok) return NextResponse.json({ error: { code: result.code, message: result.message } }, { status: result.status });
  const entry = await savePoster(spec, result.meta, getTemplate(spec.template)!.name, result.svg);
  return NextResponse.json({ entry });
}
