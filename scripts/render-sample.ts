// Renders every template from the bundled fixture (no network) into ./out.
// Usage: npm run render:sample [-- --crop-marks]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildLapData, type RawLapBundle } from "../src/lib/data/lap-data";
import { renderPng } from "../src/lib/export/png";
import { composePoster } from "../src/lib/templates/compose";
import { TEMPLATES } from "../src/lib/templates";
import { loadFonts } from "../src/lib/text/fonts";

const cropMarks = process.argv.includes("--crop-marks");
const fixture = path.join(__dirname, "..", "tests", "fixtures", "sgp-2023-q-sai-lap19.json");
const raw = JSON.parse(readFileSync(fixture, "utf8")) as RawLapBundle;
const built = buildLapData(raw);
if (!built.ok) throw new Error(`${built.reason}: ${built.detail}`);
console.log("samples", built.data.samples.length, built.data.stats);

const outDir = path.join(__dirname, "..", "out");
mkdirSync(outDir, { recursive: true });
const fonts = loadFonts();
for (const t of TEMPLATES) {
  const t0 = Date.now();
  const { svg, layout } = composePoster(t, built.data, fonts, { cropMarks });
  const base = path.join(outDir, `${t.id}${cropMarks ? "-crop" : ""}`);
  writeFileSync(`${base}.svg`, svg);
  const { png, info } = renderPng(svg, layout);
  writeFileSync(`${base}.png`, png);
  console.log(t.id, `${(svg.length / 1024).toFixed(0)} KB svg`, info, `${Date.now() - t0} ms`);
}
