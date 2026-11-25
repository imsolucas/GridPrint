import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { PosterMeta } from "../data/lap-data";
import { renderThumbnail } from "../export/png";
import type { PosterSpec } from "../poster-server";

// Posters are stored on local disk (not in public/, which `next start` does not
// re-scan) and served through /api/gallery/[id]/[file].
export const GALLERY_DIR = process.env.GRIDPRINT_GALLERY_DIR ?? path.join(process.cwd(), "data", "gallery");

export interface GalleryEntry {
  id: string;
  createdAt: string;
  spec: PosterSpec;
  meta: PosterMeta;
  templateName: string;
}

const ID_RE = /^[a-z0-9-]+$/;
export const isValidId = (id: string) => ID_RE.test(id);

/** One entry per (session, driver, lap, template); saving again overwrites it. */
export function entryId(spec: PosterSpec) {
  return `${spec.sessionKey}-${spec.driverNumber}-${spec.lapNumber}-${spec.template}`;
}

export async function savePoster(spec: PosterSpec, meta: PosterMeta, templateName: string, svg: string) {
  const id = entryId(spec);
  const dir = path.join(GALLERY_DIR, id);
  await fs.mkdir(dir, { recursive: true });
  const entry: GalleryEntry = { id, createdAt: new Date().toISOString(), spec, meta, templateName };
  await fs.writeFile(path.join(dir, "poster.svg"), svg);
  await fs.writeFile(path.join(dir, "thumb.png"), renderThumbnail(svg));
  await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(entry, null, 2));
  return entry;
}

export async function listPosters(): Promise<GalleryEntry[]> {
  let dirs: string[];
  try {
    dirs = await fs.readdir(GALLERY_DIR);
  } catch {
    return [];
  }
  const entries = await Promise.all(
    dirs.filter(isValidId).map(async (d) => {
      try {
        return JSON.parse(await fs.readFile(path.join(GALLERY_DIR, d, "meta.json"), "utf8")) as GalleryEntry;
      } catch {
        return null;
      }
    }),
  );
  return entries.filter((e): e is GalleryEntry => e !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function readPosterFile(id: string, file: "poster.svg" | "thumb.png"): Promise<Buffer | null> {
  if (!isValidId(id)) return null;
  try {
    return await fs.readFile(path.join(GALLERY_DIR, id, file));
  } catch {
    return null;
  }
}

export async function deletePoster(id: string) {
  if (!isValidId(id)) return false;
  await fs.rm(path.join(GALLERY_DIR, id), { recursive: true, force: true });
  return true;
}

export async function readEntry(id: string): Promise<GalleryEntry | null> {
  if (!isValidId(id)) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(GALLERY_DIR, id, "meta.json"), "utf8")) as GalleryEntry;
  } catch {
    return null;
  }
}
