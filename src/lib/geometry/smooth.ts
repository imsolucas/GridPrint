import type { Pt } from "./fit";

export interface DensePoint extends Pt {
  /** Index of the source sample this point's segment starts at. */
  src: number;
  /** 0..1 position between src and src+1. */
  u: number;
}

/**
 * Removes near-duplicate consecutive points (stationary car / duplicate rows),
 * which would otherwise create zero-length segments and spikes. Returns the kept
 * source indices so attributes can be looked up.
 */
export function dedupe(points: Pt[], minDist: number): number[] {
  const keep: number[] = [];
  for (let i = 0; i < points.length; i++) {
    if (!keep.length) {
      keep.push(i);
      continue;
    }
    const p = points[keep[keep.length - 1]];
    if (Math.hypot(points[i].x - p.x, points[i].y - p.y) >= minDist) keep.push(i);
  }
  return keep;
}

/**
 * Centripetal Catmull-Rom (alpha = 0.5) through the points. Unlike uniform
 * Catmull-Rom or Bézier fitting, the centripetal form is proven not to form
 * cusps or self-intersections within a segment and keeps overshoot small, which
 * matters at ~20 m sample spacing in tight corners. The curve passes through
 * every input point, so no position is invented between real samples beyond
 * the visual interpolation.
 *
 * `step` is the target spacing (mm) of output points.
 */
export function catmullRom(points: Pt[], step = 0.6): DensePoint[] {
  const n = points.length;
  if (n < 2) return points.map((p, i) => ({ ...p, src: i, u: 0 }));
  const get = (i: number): Pt => {
    if (i < 0) return { x: 2 * points[0].x - points[1].x, y: 2 * points[0].y - points[1].y };
    if (i >= n) return { x: 2 * points[n - 1].x - points[n - 2].x, y: 2 * points[n - 1].y - points[n - 2].y };
    return points[i];
  };
  const tj = (ti: number, a: Pt, b: Pt) => ti + Math.max(Math.sqrt(Math.hypot(b.x - a.x, b.y - a.y)), 1e-6);

  const out: DensePoint[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const t0 = 0;
    const t1 = tj(t0, p0, p1);
    const t2 = tj(t1, p1, p2);
    const t3 = tj(t2, p2, p3);
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const steps = Math.max(1, Math.ceil(segLen / step));
    for (let k = 0; k < steps; k++) {
      const u = k / steps;
      const t = t1 + (t2 - t1) * u;
      const lerp = (pa: Pt, pb: Pt, ta: number, tb: number): Pt => {
        const w = (t - ta) / (tb - ta);
        return { x: pa.x + (pb.x - pa.x) * w, y: pa.y + (pb.y - pa.y) * w };
      };
      const a1 = lerp(p0, p1, t0, t1);
      const a2 = lerp(p1, p2, t1, t2);
      const a3 = lerp(p2, p3, t2, t3);
      const b1 = lerp(a1, a2, t0, t2);
      const b2 = lerp(a2, a3, t1, t3);
      const c = lerp(b1, b2, t1, t2);
      out.push({ x: c.x, y: c.y, src: i, u });
    }
  }
  out.push({ ...points[n - 1], src: n - 1, u: 0 });
  return out;
}
