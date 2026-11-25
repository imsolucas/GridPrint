// Physical page model. All values are millimetres.
//
//   document (slug + bleed + trim)
//   └─ bleed box  = trim grown by `bleed` on every edge (artwork extends to here)
//      └─ trim box = the finished A3 sheet, 297 × 420
//         └─ safe box = trim inset by `safe` (all text and the track live in here)
//
// Crop marks, when enabled, live in the slug: outside the bleed box, so they never
// touch the trim area or the printed artwork.

export const MM_PER_INCH = 25.4;
export const A3 = { width: 297, height: 420 } as const;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PageLayout {
  trimW: number;
  trimH: number;
  bleed: number;
  safe: number;
  /** Extra margin outside the bleed reserved for crop marks (0 when disabled). */
  slug: number;
  cropMarks: boolean;
  docW: number;
  docH: number;
  /** Rects in document coordinates. */
  trim: Rect;
  bleedBox: Rect;
  safeBox: Rect;
}

export interface LayoutOptions {
  cropMarks?: boolean;
  bleed?: number;
  safe?: number;
}

export const CROP_MARK = {
  /** Gap between the bleed edge and the start of each mark. */
  offset: 2,
  length: 6,
  stroke: 0.25,
} as const;

export function pageLayout(opts: LayoutOptions = {}): PageLayout {
  const bleed = opts.bleed ?? 3;
  const safe = opts.safe ?? 12;
  const cropMarks = opts.cropMarks ?? false;
  const slug = cropMarks ? CROP_MARK.offset + CROP_MARK.length + 2 : 0;
  const o = slug + bleed;
  const trim = { x: o, y: o, w: A3.width, h: A3.height };
  return {
    trimW: A3.width,
    trimH: A3.height,
    bleed,
    safe,
    slug,
    cropMarks,
    docW: A3.width + 2 * o,
    docH: A3.height + 2 * o,
    trim,
    bleedBox: { x: slug, y: slug, w: A3.width + 2 * bleed, h: A3.height + 2 * bleed },
    safeBox: { x: o + safe, y: o + safe, w: A3.width - 2 * safe, h: A3.height - 2 * safe },
  };
}

/** mm → device pixels. Single rounding rule used everywhere: Math.round. */
export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / MM_PER_INCH) * dpi);
}

export function exportPixelSize(layout: PageLayout, dpi = 300): { width: number; height: number; dpi: number } {
  return { width: mmToPx(layout.docW, dpi), height: mmToPx(layout.docH, dpi), dpi };
}

export interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Eight crop-mark lines, two per corner, aligned with the trim edges and placed in the slug. */
export function cropMarkLines(layout: PageLayout): Line[] {
  if (!layout.cropMarks) return [];
  const { trim, bleed } = layout;
  const start = bleed + CROP_MARK.offset;
  const end = start + CROP_MARK.length;
  const L = trim.x;
  const R = trim.x + trim.w;
  const T = trim.y;
  const B = trim.y + trim.h;
  return [
    // top-left
    { x1: L - end, y1: T, x2: L - start, y2: T },
    { x1: L, y1: T - end, x2: L, y2: T - start },
    // top-right
    { x1: R + start, y1: T, x2: R + end, y2: T },
    { x1: R, y1: T - end, x2: R, y2: T - start },
    // bottom-left
    { x1: L - end, y1: B, x2: L - start, y2: B },
    { x1: L, y1: B + start, x2: L, y2: B + end },
    // bottom-right
    { x1: R + start, y1: B, x2: R + end, y2: B },
    { x1: R, y1: B + start, x2: R, y2: B + end },
  ];
}
