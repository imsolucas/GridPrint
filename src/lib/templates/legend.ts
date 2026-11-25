import type { Font } from "opentype.js";
import { samplePalette, type TrackArt, type TrackStyle } from "../geometry/track";
import { textPath, wrapText } from "../text/text";

export interface LegendOptions {
  x: number;
  y: number;
  width: number;
  font: Font;
  /** Label cap size in mm; keep ≥ 3 for legibility at A3. */
  size?: number;
  text: string;
  muted: string;
  style: TrackStyle;
  art: TrackArt;
}

/** Speed scale, braking width, gear-tick and (if present) missing-data keys. ~20 mm tall. */
export function legend(o: LegendOptions): string {
  const s = o.size ?? 3.2;
  const out: string[] = [];
  const bins = o.style.speedBins ?? 18;
  const barW = o.width * 0.42;
  const barH = 3;
  const by = o.y + s + 2;

  out.push(textPath(o.font, "SPEED KM/H", { x: o.x, y: o.y + s, size: s, fill: o.muted, tracking: 0.05 }));
  for (let i = 0; i < bins; i++) {
    out.push(
      `<rect x="${(o.x + (barW / bins) * i).toFixed(2)}" y="${by}" width="${(barW / bins + 0.05).toFixed(2)}" height="${barH}" fill="${samplePalette(o.style.palette, (i + 0.5) / bins)}"/>`,
    );
  }
  const lo = o.art.speedMin === null ? "–" : String(o.art.speedMin);
  const hi = o.art.speedMax === null ? "–" : String(o.art.speedMax);
  out.push(textPath(o.font, lo, { x: o.x, y: by + barH + s + 1.5, size: s, fill: o.text }));
  out.push(textPath(o.font, hi, { x: o.x + barW, y: by + barH + s + 1.5, size: s, fill: o.text, anchor: "end" }));

  // Right-hand keys
  const kx = o.x + barW + o.width * 0.08;
  const sw = 14;
  const row = (i: number) => o.y + s + i * (s + 3.2);
  // braking: thin → thick
  out.push(
    `<path d="M${kx} ${row(0) - s / 2}L${kx + sw / 2} ${row(0) - s / 2}" stroke="${o.text}" stroke-width="${o.style.width}" stroke-linecap="round"/>` +
      `<path d="M${kx + sw / 2} ${row(0) - s / 2}L${kx + sw} ${row(0) - s / 2}" stroke="${o.text}" stroke-width="${o.style.brakeWidth}" stroke-linecap="round"/>`,
  );
  out.push(textPath(o.font, "THICKER = BRAKING", { x: kx + sw + 3, y: row(0), size: s, fill: o.text }));
  // gear ticks
  const gy = row(1) - s / 2;
  out.push(
    `<path d="M${kx} ${gy}L${kx + sw} ${gy}" stroke="${o.muted}" stroke-width="${o.style.width}" stroke-linecap="round"/>` +
      `<path d="M${kx + sw / 2} ${gy - o.style.width / 2 - 0.6}L${kx + sw / 2} ${gy - o.style.width / 2 - 0.6 - o.style.tickLength}" stroke="${o.style.tickColour}" stroke-width="${o.style.tickWidth * 1.5}"/>`,
  );
  out.push(textPath(o.font, "TICK = GEAR CHANGE (UP/DOWN SIDES)", { x: kx + sw + 3, y: row(1), size: s, fill: o.text }));
  if (o.art.hasMissingSpeed) {
    const ny = row(2) - s / 2;
    out.push(
      `<path d="M${kx} ${ny}L${kx + sw} ${ny}" stroke="${o.style.noDataColour}" stroke-width="${o.style.width * 0.6}" stroke-dasharray="1.2 1.6"/>`,
    );
    out.push(textPath(o.font, "DASHED = NO TELEMETRY", { x: kx + sw + 3, y: row(2), size: s, fill: o.text }));
  }
  return out.join("");
}

/** Small wrapped data-source credit. Returns markup and the height used. */
export function credit(font: Font, str: string, x: number, yBottom: number, width: number, fill: string, size = 2.5) {
  const lines = wrapText(font, str, size, width);
  const lh = size * 1.35;
  const top = yBottom - (lines.length - 1) * lh;
  return {
    svg: lines.map((l, i) => textPath(font, l, { x, y: top + i * lh, size, fill })).join(""),
    height: lines.length * lh,
  };
}
