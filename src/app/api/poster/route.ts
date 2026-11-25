import { NextResponse } from "next/server";
import { renderPng } from "@/lib/export/png";
import { contentDisposition } from "@/lib/filename";
import { savePoster } from "@/lib/gallery/store";
import { generatePoster, parseSpec, posterFilename } from "@/lib/poster-server";
import { getTemplate } from "@/lib/templates";

export const runtime = "nodejs";

/**
 * GET /api/poster?session_key=&driver_number=&lap_number=&template=&crop=1
 *   &format=svg|png  &guides=1 (preview only)  &download=1 (attachment)  &save=1 (also store in gallery)
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const spec = parseSpec(sp);
  if (!spec) {
    return NextResponse.json({ error: { code: "bad-request", message: "session_key, driver_number and lap_number are required" } }, { status: 400 });
  }
  const format = sp.get("format") === "png" ? "png" : "svg";
  const download = sp.get("download") === "1";
  const save = sp.get("save") === "1";
  const guides = sp.get("guides") === "1" && !download;

  const result = await generatePoster(spec, { guides });
  if (!result.ok) {
    return NextResponse.json({ error: { code: result.code, message: result.message } }, { status: result.status });
  }

  if (save) {
    // Keep a local copy of posters exported from the studio. A failure here must not block the download.
    await savePoster(spec, result.meta, getTemplate(spec.template)!.name, result.svg).catch((e) =>
      console.error("gallery save failed", e),
    );
  }

  const headers: Record<string, string> = { "cache-control": "no-store" };
  if (result.meta.topSpeed !== null) headers["x-gridprint-top-speed"] = String(Math.round(result.meta.topSpeed));
  if (download) headers["content-disposition"] = contentDisposition(posterFilename(result.meta, spec, format));

  if (format === "svg") {
    return new Response(result.svg, { headers: { ...headers, "content-type": "image/svg+xml; charset=utf-8" } });
  }
  try {
    const { png, info } = renderPng(result.svg, result.layout, 300);
    headers["x-gridprint-pixels"] = `${info.width}x${info.height}@${info.dpi}dpi`;
    return new Response(new Uint8Array(png), { headers: { ...headers, "content-type": "image/png" } });
  } catch (err) {
    return NextResponse.json({ error: { code: "png-export-failed", message: (err as Error).message } }, { status: 500 });
  }
}
