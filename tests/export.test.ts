import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildLapData, type RawLapBundle } from "@/lib/data/lap-data";
import { readPngInfo, renderPng, setPngDpi } from "@/lib/export/png";
import { cropMarkLines, CROP_MARK, exportPixelSize, mmToPx, pageLayout } from "@/lib/geometry/paper";
import { composePoster } from "@/lib/templates/compose";
import { TEMPLATES } from "@/lib/templates";
import { loadFonts } from "@/lib/text/fonts";

describe("page layout", () => {
  it("A3 trim with 3 mm bleed", () => {
    const l = pageLayout();
    expect(l.trim).toMatchObject({ w: 297, h: 420 });
    expect([l.docW, l.docH]).toEqual([303, 426]);
  });

  it("300 DPI pixel size comes from the full export size, including bleed", () => {
    expect(exportPixelSize(pageLayout())).toEqual({ width: 3579, height: 5031, dpi: 300 });
    // 303 mm / 25.4 * 300 = 3578.74 → 3579; 426 mm → 5031.5 → 5031 (Math.round of 5031.496)
    expect(mmToPx(303, 300)).toBe(3579);
    expect(mmToPx(426, 300)).toBe(5031);
  });

  it("adds slug space for crop marks and includes it in the pixel size", () => {
    const l = pageLayout({ cropMarks: true });
    expect(l.docW).toBe(297 + 2 * (3 + l.slug));
    expect(exportPixelSize(l)).toEqual({ width: mmToPx(l.docW, 300), height: mmToPx(l.docH, 300), dpi: 300 });
    expect(exportPixelSize(l).width).toBeGreaterThan(3579);
  });

  it("crop marks sit entirely outside the trim and bleed boxes and inside the document", () => {
    const l = pageLayout({ cropMarks: true });
    const lines = cropMarkLines(l);
    expect(lines).toHaveLength(8);
    const hw = CROP_MARK.stroke / 2;
    const b = l.bleedBox;
    for (const ln of lines) {
      const box = {
        x0: Math.min(ln.x1, ln.x2) - hw, x1: Math.max(ln.x1, ln.x2) + hw,
        y0: Math.min(ln.y1, ln.y2) - hw, y1: Math.max(ln.y1, ln.y2) + hw,
      };
      const overlapsBleed = box.x0 < b.x + b.w && box.x1 > b.x && box.y0 < b.y + b.h && box.y1 > b.y;
      expect(overlapsBleed).toBe(false); // bleed box contains the trim box, so trim is clear too
      expect(box.x0).toBeGreaterThanOrEqual(0);
      expect(box.y0).toBeGreaterThanOrEqual(0);
      expect(box.x1).toBeLessThanOrEqual(l.docW);
      expect(box.y1).toBeLessThanOrEqual(l.docH);
    }
    expect(cropMarkLines(pageLayout())).toHaveLength(0);
  });
});

describe("PNG export", () => {
  const raw = JSON.parse(
    readFileSync(path.join(__dirname, "fixtures", "sgp-2023-q-sai-lap19.json"), "utf8"),
  ) as RawLapBundle;
  const built = buildLapData(raw);
  if (!built.ok) throw new Error(built.detail);
  const fonts = loadFonts();

  for (const cropMarks of [false, true]) {
    it(`renders exact 300 DPI pixels with pHYs (cropMarks=${cropMarks})`, () => {
      const { svg, layout } = composePoster(TEMPLATES[0], built.data, fonts, { cropMarks });
      expect(svg).toContain(`width="${layout.docW}mm" height="${layout.docH}mm"`);
      const { png } = renderPng(svg, layout, 300);
      const info = readPngInfo(png);
      expect(info).toEqual({ ...exportPixelSize(layout, 300), dpi: 300 });
    });
  }

  it("every template renders text as paths (no <text>, no font dependency)", () => {
    for (const t of TEMPLATES) {
      const { svg } = composePoster(t, built.data, fonts);
      expect(svg).not.toMatch(/<text[\s>]/);
      expect(svg).not.toContain("font-family");
    }
  });

  it("setPngDpi replaces rather than duplicates pHYs", () => {
    const { png } = renderPng(composePoster(TEMPLATES[0], built.data, fonts).svg, pageLayout(), 300);
    const again = setPngDpi(png, 150);
    expect(readPngInfo(again).dpi).toBe(150);
    expect(again.toString("latin1").split("pHYs").length - 1).toBe(1);
  });
});

describe("missing telemetry rendering", () => {
  it("draws gaps as dashed no-data strokes instead of inventing values", () => {
    const raw = JSON.parse(
      readFileSync(path.join(__dirname, "fixtures", "sgp-2023-q-sai-lap19.json"), "utf8"),
    ) as RawLapBundle;
    // Blank 6 s of car_data in the middle of the lap.
    const t0 = Date.parse(raw.lap!.date_start!) + 40_000;
    raw.car_data = raw.car_data.filter((c) => {
      const ms = Date.parse(c.date);
      return ms < t0 || ms > t0 + 6000;
    });
    const built = buildLapData(raw);
    if (!built.ok) throw new Error(built.detail);
    expect(built.data.stats.missingSpeed).toBeGreaterThan(5);
    const { svg } = composePoster(TEMPLATES[0], built.data, loadFonts());
    expect(svg).toContain('stroke-dasharray="1.2 1.6"');
  });
});
