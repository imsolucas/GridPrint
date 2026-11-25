import type { TraceSample } from "../data/align";
import { fitToBox, type Pt } from "./fit";
import type { Rect } from "./paper";
import { catmullRom, dedupe } from "./smooth";

export interface TrackStyle {
  /** Colour stops from slowest to fastest. */
  palette: string[];
  /** Colour for stretches without speed telemetry (drawn dashed, never guessed). */
  noDataColour: string;
  /** Stroke width (mm) off the brakes. */
  width: number;
  /** Stroke width (mm) under full braking. */
  brakeWidth: number;
  tickColour: string;
  tickLength: number;
  tickWidth: number;
  startColour: string;
  underlay?: { colour: string; extra: number; opacity: number };
  speedBins?: number;
}

export interface TrackArt {
  svg: string;
  speedMin: number | null;
  speedMax: number | null;
  hasMissingSpeed: boolean;
  gearChanges: number;
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** Samples a multi-stop palette at u ∈ [0, 1]. */
export function samplePalette(palette: string[], u: number): string {
  const x = Math.min(1, Math.max(0, u)) * (palette.length - 1);
  const i = Math.min(palette.length - 2, Math.floor(x));
  const w = x - i;
  const a = hexToRgb(palette[i]);
  const b = hexToRgb(palette[i + 1]);
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * w));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Speed range for the legend, rounded outward to 10 km/h. */
export function speedRange(samples: TraceSample[]): { min: number; max: number } | null {
  const v = samples.map((s) => s.speed).filter((s): s is number => s !== null);
  if (!v.length) return null;
  const min = Math.floor(Math.min(...v) / 10) * 10;
  const max = Math.ceil(Math.max(...v) / 10) * 10;
  return { min, max: max > min ? max : min + 10 };
}

/**
 * Builds the lap artwork: a smoothed path whose stroke colour encodes speed and
 * whose width encodes braking, with short ticks where the gear changes.
 */
export function trackArt(samples: TraceSample[], box: Rect, style: TrackStyle): TrackArt {
  const bins = style.speedBins ?? 18;
  const range = speedRange(samples);
  const fitted = fitToBox(samples, box, { autoRotate: true, padding: style.brakeWidth + style.tickLength + 1 });
  const keepIdx = dedupe(fitted.points, 0.25);
  const pts = keepIdx.map((i) => fitted.points[i]);
  const src = keepIdx.map((i) => samples[i]);
  const dense = catmullRom(pts, 0.5);

  // Per dense point: speed (lerp only between two real values), raw brake (step).
  const attrs = dense.map((d) => {
    const a = src[d.src];
    const b = src[Math.min(d.src + 1, src.length - 1)];
    const speed = a.speed !== null && b.speed !== null ? a.speed + (b.speed - a.speed) * d.u : null;
    return { speed, brake: a.brake };
  });

  // Ease width changes over ~3 mm of path so brake zones taper instead of stepping.
  const K = 6;
  const brakeSmoothed = attrs.map((_, i) => {
    let sum = 0, n = 0;
    for (let j = i - K; j <= i + K; j++) {
      const b = attrs[j]?.brake;
      if (b !== undefined && b !== null) {
        sum += b;
        n++;
      }
    }
    return n ? sum / n : 0;
  });

  const WIDTH_LEVELS = 4;
  const key = (i: number) => {
    const s = attrs[i].speed;
    const bin = s === null || !range ? -1 : Math.min(bins - 1, Math.floor(((s - range.min) / (range.max - range.min)) * bins));
    const lvl = Math.round(brakeSmoothed[i] * WIDTH_LEVELS);
    return { bin, lvl, id: `${bin}:${lvl}` };
  };

  const parts: string[] = [];
  let runStart = 0;
  let cur = key(0);
  const flush = (end: number) => {
    const seg = dense.slice(runStart, end + 1);
    if (seg.length < 2) return;
    const d = "M" + seg.map((p) => `${f(p.x)} ${f(p.y)}`).join("L");
    const w = style.width + ((style.brakeWidth - style.width) * cur.lvl) / WIDTH_LEVELS;
    if (cur.bin < 0) {
      parts.push(`<path d="${d}" stroke="${style.noDataColour}" stroke-width="${f(style.width * 0.6)}" stroke-dasharray="1.2 1.6"/>`);
    } else {
      const colour = samplePalette(style.palette, (cur.bin + 0.5) / bins);
      parts.push(`<path d="${d}" stroke="${colour}" stroke-width="${f(w)}"/>`);
    }
  };
  for (let i = 1; i < dense.length; i++) {
    const k = key(i);
    if (k.id !== cur.id) {
      flush(i); // include point i so runs join without gaps
      runStart = i;
      cur = k;
    }
  }
  flush(dense.length - 1);

  // Gear-change ticks: perpendicular to the path, upshifts on one side, downshifts on the other.
  const ticks: string[] = [];
  let lastGear: number | null = null;
  for (let i = 0; i < src.length; i++) {
    const g = src[i].gear;
    if (g === null) continue;
    if (lastGear !== null && g !== lastGear && i > 0 && i < pts.length - 1) {
      const tx = pts[i + 1].x - pts[i - 1].x;
      const ty = pts[i + 1].y - pts[i - 1].y;
      const len = Math.hypot(tx, ty) || 1;
      const side = g > lastGear ? 1 : -1;
      const nx = (-ty / len) * side;
      const ny = (tx / len) * side;
      const r0 = style.brakeWidth / 2 + 0.6;
      const r1 = r0 + style.tickLength;
      ticks.push(
        `M${f(pts[i].x + nx * r0)} ${f(pts[i].y + ny * r0)}L${f(pts[i].x + nx * r1)} ${f(pts[i].y + ny * r1)}`,
      );
    }
    lastGear = g;
  }

  // Start/finish bar across the line at the first sample (the timing line).
  let startBar = "";
  if (pts.length > 2) {
    const p: Pt = pts[0];
    const tx = pts[1].x - p.x;
    const ty = pts[1].y - p.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len, ny = tx / len;
    const r = style.brakeWidth * 1.4;
    startBar = `<path d="M${f(p.x - nx * r)} ${f(p.y - ny * r)}L${f(p.x + nx * r)} ${f(p.y + ny * r)}" stroke="${style.startColour}" stroke-width="${f(style.width * 0.8)}" stroke-linecap="butt"/>`;
  }

  const underlay = style.underlay
    ? `<path d="M${dense.map((p) => `${f(p.x)} ${f(p.y)}`).join("L")}" stroke="${style.underlay.colour}" stroke-opacity="${style.underlay.opacity}" stroke-width="${f(style.brakeWidth + style.underlay.extra)}"/>`
    : "";

  const svg =
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    underlay +
    parts.join("") +
    (ticks.length
      ? `<path d="${ticks.join("")}" stroke="${style.tickColour}" stroke-width="${f(style.tickWidth)}" stroke-linecap="butt"/>`
      : "") +
    startBar +
    `</g>`;

  return {
    svg,
    speedMin: range?.min ?? null,
    speedMax: range?.max ?? null,
    hasMissingSpeed: attrs.some((a) => a.speed === null),
    gearChanges: ticks.length,
  };
}
