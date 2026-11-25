import "server-only";
import { buildLapData, type PosterMeta } from "./data/lap-data";
import { posterFilename as readableFilename } from "./filename";
import { loadLapBundle } from "./data/load";
import type { PageLayout } from "./geometry/paper";
import { OpenF1Error } from "./openf1/client";
import { composePoster } from "./templates/compose";
import { getTemplate } from "./templates";
import { loadFonts } from "./text/fonts";

export interface PosterSpec {
  sessionKey: number;
  driverNumber: number;
  lapNumber: number;
  template: string;
  cropMarks: boolean;
}

export type PosterResult =
  | { ok: true; svg: string; layout: PageLayout; meta: PosterMeta; spec: PosterSpec }
  | { ok: false; status: number; code: string; message: string };

export function parseSpec(sp: URLSearchParams | Record<string, unknown>): PosterSpec | null {
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) : (sp[k] as string | undefined) ?? null);
  const sessionKey = Number(get("session_key"));
  const driverNumber = Number(get("driver_number"));
  const lapNumber = Number(get("lap_number"));
  const template = get("template") ?? "arcade-flyer";
  const crop = get("crop");
  if (![sessionKey, driverNumber, lapNumber].every((n) => Number.isInteger(n) && n > 0)) return null;
  return { sessionKey, driverNumber, lapNumber, template: String(template), cropMarks: crop === "1" || crop === "true" };
}

export function errorFrom(err: unknown): { ok: false; status: number; code: string; message: string } {
  if (err instanceof OpenF1Error) {
    return { ok: false, status: 502, code: "openf1-unavailable", message: err.message };
  }
  return { ok: false, status: 500, code: "internal", message: (err as Error)?.message ?? "Unknown error" };
}

export async function generatePoster(spec: PosterSpec, opts: { guides?: boolean } = {}): Promise<PosterResult> {
  const template = getTemplate(spec.template);
  if (!template) return { ok: false, status: 400, code: "unknown-template", message: `No template "${spec.template}".` };
  try {
    const bundle = await loadLapBundle(spec.sessionKey, spec.driverNumber, spec.lapNumber);
    if (!bundle) return { ok: false, status: 404, code: "session-not-found", message: "OpenF1 has no such session." };
    const built = buildLapData(bundle);
    if (!built.ok) return { ok: false, status: 422, code: built.reason, message: built.detail };
    const { svg, layout } = composePoster(template, built.data, loadFonts(), {
      cropMarks: spec.cropMarks,
      guides: opts.guides,
    });
    return { ok: true, svg, layout, meta: built.data.meta, spec };
  } catch (err) {
    return errorFrom(err);
  }
}

export function posterFilename(meta: PosterMeta, spec: PosterSpec, ext: string) {
  return readableFilename(
    {
      driverName: meta.driverName,
      eventName: meta.eventName,
      year: meta.year,
      sessionName: meta.sessionName,
      lapNumber: meta.lapNumber,
      templateName: getTemplate(spec.template)?.name ?? spec.template,
      cropMarks: spec.cropMarks,
    },
    ext,
  );
}
