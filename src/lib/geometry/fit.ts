import type { Rect } from "./paper";

export interface Pt {
  x: number;
  y: number;
}

export interface FitResult {
  points: Pt[];
  /** Rotation applied (radians) before scaling. */
  rotation: number;
  /** mm per OpenF1 unit. */
  scale: number;
}

function rotate(p: Pt, a: number): Pt {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

function bounds(pts: Pt[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/**
 * Fits OpenF1 positions (y up) into a box in page mm (y down), preserving aspect ratio.
 * With `autoRotate`, tries rotations in 5° steps and keeps the one that draws the
 * circuit largest in the box; this is a composition choice, the outline is not a
 * north-up map either way.
 */
export function fitToBox(raw: Pt[], box: Rect, opts: { autoRotate?: boolean; padding?: number } = {}): FitResult {
  const pad = opts.padding ?? 0;
  const inner = { x: box.x + pad, y: box.y + pad, w: box.w - 2 * pad, h: box.h - 2 * pad };
  const flipped = raw.map((p) => ({ x: p.x, y: -p.y }));

  let best = { a: 0, scale: -Infinity };
  const steps = opts.autoRotate ? 36 : 1;
  for (let i = 0; i < steps; i++) {
    const a = (i * Math.PI) / 36;
    const b = bounds(flipped.map((p) => rotate(p, a)));
    const scale = Math.min(inner.w / (b.w || 1), inner.h / (b.h || 1));
    if (scale > best.scale + 1e-9) best = { a, scale };
  }

  const rotated = flipped.map((p) => rotate(p, best.a));
  const b = bounds(rotated);
  const ox = inner.x + (inner.w - b.w * best.scale) / 2;
  const oy = inner.y + (inner.h - b.h * best.scale) / 2;
  return {
    points: rotated.map((p) => ({ x: ox + (p.x - b.minX) * best.scale, y: oy + (p.y - b.minY) * best.scale })),
    rotation: best.a,
    scale: best.scale,
  };
}
