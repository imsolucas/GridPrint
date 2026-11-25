import type { LapData } from "../data/lap-data";
import { CROP_MARK, cropMarkLines, pageLayout, type PageLayout } from "../geometry/paper";
import type { FontSet } from "../text/text";
import { textPath } from "../text/text";
import type { PosterTemplate } from "./types";

export interface ComposeOptions {
  cropMarks?: boolean;
  /** Preview only: draw trim (cyan) and safe (pink, dashed) guides. Never use for print. */
  guides?: boolean;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function composePoster(
  template: PosterTemplate,
  data: LapData,
  fonts: FontSet,
  opts: ComposeOptions = {},
): { svg: string; layout: PageLayout } {
  const layout = pageLayout({ cropMarks: opts.cropMarks });
  const { trim, bleedBox, safeBox, docW, docH } = layout;
  const inner = template.render({
    data,
    fonts,
    trimW: layout.trimW,
    trimH: layout.trimH,
    bleed: layout.bleed,
    safe: layout.safe,
  });

  const m = data.meta;
  const title = `${m.driverName} · ${m.eventName} ${m.year} · ${m.sessionName} lap ${m.lapNumber}`;
  const marks = cropMarkLines(layout)
    .map((l) => `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}"/>`)
    .join("");
  const slugText = layout.cropMarks
    ? textPath(fonts.mono, `GRID PRINT · ${template.name} · A3 ${layout.trimW}×${layout.trimH} mm trim · ${layout.bleed} mm bleed · print at 100% / actual size`, {
        x: trim.x + 15, // clear of the vertical crop marks at trim.x
        y: docH - 3,
        size: 2.2,
        fill: "#000",
      })
    : "";
  const guides = opts.guides
    ? // Colours match the studio's guide tokens: guide-trim (solid cyan) and guide-safe (dashed pink).
      `<g fill="none" stroke-width="0.35">` +
      `<rect x="${trim.x}" y="${trim.y}" width="${trim.w}" height="${trim.h}" stroke="#4fd8ff"/>` +
      `<rect x="${safeBox.x}" y="${safeBox.y}" width="${safeBox.w}" height="${safeBox.h}" stroke="#ff5c8f" stroke-dasharray="2 1.5"/></g>`
    : "";

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${docW}mm" height="${docH}mm" viewBox="0 0 ${docW} ${docH}"` +
    ` data-trim="${trim.x} ${trim.y} ${trim.w} ${trim.h}" data-bleed="${layout.bleed}">` +
    `<title>${esc(title)}</title>` +
    `<desc>${esc(`GRID PRINT ${template.name}. Trim ${layout.trimW}×${layout.trimH} mm, bleed ${layout.bleed} mm. ${m.credit}`)}</desc>` +
    `<defs><clipPath id="gp-bleed"><rect x="${bleedBox.x}" y="${bleedBox.y}" width="${bleedBox.w}" height="${bleedBox.h}"/></clipPath></defs>` +
    `<rect width="${docW}" height="${docH}" fill="#ffffff"/>` +
    `<g clip-path="url(#gp-bleed)"><g transform="translate(${trim.x} ${trim.y})">${inner}</g></g>` +
    `<rect id="gp-trim" x="${trim.x}" y="${trim.y}" width="${trim.w}" height="${trim.h}" fill="none" stroke="none"/>` +
    (marks ? `<g id="gp-crop-marks" stroke="#000" stroke-width="${CROP_MARK.stroke}">${marks}</g>` : "") +
    slugText +
    guides +
    `</svg>`;
  return { svg, layout };
}
