import type { Font } from "opentype.js";

// Text is converted to SVG paths so the browser preview, the SVG download and the
// resvg PNG are pixel-identical and need no installed fonts. These helpers are
// pure: callers pass in already-parsed fonts.

export type FontKey = "pixel" | "crt" | "condensed" | "mono" | "monoBold";
export type FontSet = Record<FontKey, Font>;

export interface TextOptions {
  x: number;
  /** Baseline y. */
  y: number;
  /** Font size in mm (em size). */
  size: number;
  anchor?: "start" | "middle" | "end";
  /** Extra space between glyphs, as a fraction of size. */
  tracking?: number;
  fill?: string;
  opacity?: number;
  /** Used for characters the primary font lacks. */
  fallback?: Font;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function layoutGlyphs(font: Font, str: string, size: number, tracking: number, fallback?: Font) {
  const items: { font: Font; glyph: ReturnType<Font["charToGlyph"]>; x: number }[] = [];
  let x = 0;
  let prev: { font: Font; glyph: ReturnType<Font["charToGlyph"]> } | null = null;
  for (const ch of Array.from(str)) {
    let f = font;
    let g = font.charToGlyph(ch);
    if ((!g || g.index === 0) && fallback && ch.trim()) {
      const fg = fallback.charToGlyph(ch);
      if (fg && fg.index !== 0) {
        f = fallback;
        g = fg;
      }
    }
    const scale = size / f.unitsPerEm;
    if (prev) {
      if (prev.font === f) x += f.getKerningValue(prev.glyph, g) * scale;
      x += tracking * size;
    }
    items.push({ font: f, glyph: g, x });
    x += (g.advanceWidth ?? 0) * scale;
    prev = { font: f, glyph: g };
  }
  return { items, width: x };
}

export function measureText(font: Font, str: string, size: number, tracking = 0, fallback?: Font): number {
  return layoutGlyphs(font, str, size, tracking, fallback).width;
}

/** Largest size (≤ max) at which `str` fits in `width`. */
export function fitSize(font: Font, str: string, width: number, max: number, tracking = 0): number {
  const w1 = measureText(font, str, 1, tracking);
  return w1 > 0 ? Math.min(max, width / w1) : max;
}

/** Returns a single <path> element rendering `str`. */
export function textPath(font: Font, str: string, o: TextOptions): string {
  const { items, width } = layoutGlyphs(font, str, o.size, o.tracking ?? 0, o.fallback);
  const shift = o.anchor === "middle" ? -width / 2 : o.anchor === "end" ? -width : 0;
  let d = "";
  for (const it of items) {
    d += it.glyph.getPath(o.x + shift + it.x, o.y, o.size).toPathData(2);
  }
  if (!d) return "";
  const op = o.opacity !== undefined && o.opacity < 1 ? ` fill-opacity="${o.opacity}"` : "";
  return `<path d="${d}" fill="${o.fill ?? "#000"}"${op}/>`;
}

/** Greedy word wrap by measured width. */
export function wrapText(font: Font, str: string, size: number, width: number, tracking = 0): string[] {
  const words = str.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (line && measureText(font, test, size, tracking) > width) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export { r2 };
