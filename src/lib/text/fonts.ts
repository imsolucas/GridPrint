import { readFileSync } from "node:fs";
import path from "node:path";
import opentype from "opentype.js";
import type { FontSet } from "./text";

// All fonts are SIL Open Font License 1.1; licence texts sit next to the files in assets/fonts.
const FILES: Record<keyof FontSet, string> = {
  pixel: "PressStart2P-Regular.ttf",
  crt: "VT323-Regular.ttf",
  condensed: "BebasNeue-Regular.ttf",
  mono: "SpaceMono-Regular.ttf",
  monoBold: "SpaceMono-Bold.ttf",
};

export const FONT_DIR = process.env.GRIDPRINT_FONT_DIR ?? path.join(process.cwd(), "assets", "fonts");

let cached: FontSet | null = null;

export function loadFonts(): FontSet {
  if (cached) return cached;
  const out = {} as FontSet;
  for (const [key, file] of Object.entries(FILES) as [keyof FontSet, string][]) {
    const buf = readFileSync(path.join(FONT_DIR, file));
    out[key] = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }
  cached = out;
  return out;
}
