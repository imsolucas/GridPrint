import { contentDisposition, posterFilename } from "@/lib/filename";
import { readEntry, readPosterFile } from "@/lib/gallery/store";

export const runtime = "nodejs";

const FILES = { "poster.svg": "image/svg+xml; charset=utf-8", "thumb.png": "image/png" } as const;

/** ?download=1 on poster.svg sends it as an attachment with the same readable name the studio uses. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await ctx.params;
  if (!(file in FILES)) return new Response("Not found", { status: 404 });
  const buf = await readPosterFile(id, file as keyof typeof FILES);
  if (!buf) return new Response("Not found", { status: 404 });
  const headers: Record<string, string> = { "content-type": FILES[file as keyof typeof FILES], "cache-control": "no-cache" };
  if (file === "poster.svg" && new URL(req.url).searchParams.get("download") === "1") {
    const e = await readEntry(id);
    if (e) {
      headers["content-disposition"] = contentDisposition(
        posterFilename(
          {
            driverName: e.meta.driverName,
            eventName: e.meta.eventName,
            year: e.meta.year,
            sessionName: e.meta.sessionName,
            lapNumber: e.meta.lapNumber,
            templateName: e.templateName,
            cropMarks: e.spec.cropMarks,
          },
          "svg",
        ),
      );
    }
  }
  return new Response(new Uint8Array(buf), { headers });
}
