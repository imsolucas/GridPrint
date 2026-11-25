import { trackArt, type TrackStyle } from "../geometry/track";
import { fitSize, textPath } from "../text/text";
import { credit, legend } from "./legend";
import type { PosterTemplate } from "./types";

const C = {
  bg: "#020502",
  bezel: "#141714",
  green: "#39ff7a",
  dim: "#1f9a4a",
  amber: "#ffb000",
  white: "#e8ffe8",
};

export const crtStyle: TrackStyle = {
  palette: ["#0f6b2e", "#1fbf4f", "#7dff7a", "#ffd166", "#fff6d5"],
  noDataColour: "#2f4a35",
  width: 1.5,
  brakeWidth: 4,
  tickColour: C.amber,
  tickLength: 2.2,
  tickWidth: 0.35,
  startColour: C.amber,
  underlay: { colour: C.green, extra: 3.2, opacity: 0.1 },
};

export const crtScanline: PosterTemplate = {
  id: "crt-scanline",
  name: "CRT Scanline",
  description: "Green-phosphor telemetry terminal with scanlines and an amber lap time.",
  render({ data, fonts, trimW: W, trimH: H, bleed: b, safe: s }) {
    const m = data.meta;
    const t = fonts.crt;
    const fb = fonts.mono;
    const out: string[] = [];
    const sx = s - 2, sy = s - 2, sw = W - 2 * sx, sh = H - 2 * sy;
    const cx = sx + 10, cw = sw - 20;

    out.push(
      `<defs>` +
        `<radialGradient id="crt-vig" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#0b2a14"/><stop offset="0.7" stop-color="#04120a"/><stop offset="1" stop-color="#010301"/></radialGradient>` +
        // Pattern-based scanlines: cheap to rasterise at 300 DPI, unlike blur filters.
        `<pattern id="crt-scan" width="4" height="0.9" patternUnits="userSpaceOnUse"><rect width="4" height="0.38" fill="#000" fill-opacity="0.45"/></pattern>` +
        `<clipPath id="crt-screen"><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="10"/></clipPath>` +
      `</defs>`,
    );
    out.push(`<rect x="${-b}" y="${-b}" width="${W + 2 * b}" height="${H + 2 * b}" fill="${C.bezel}"/>`);
    out.push(`<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="10" fill="url(#crt-vig)"/>`);

    const body: string[] = [];
    const line = (str: string, y: number, size: number, fill = C.green, anchor: "start" | "end" | "middle" = "start", x = cx) =>
      body.push(textPath(t, str, { x, y, size, fill, anchor, fallback: fb }));

    line(`GRIDPRINT TELEMETRY TERMINAL  //  OPENF1 FEED`, sy + 16, 6, C.dim);
    line(`> LOAD SESSION ${m.sessionKey} ${m.sessionName.toUpperCase()} ........ OK`, sy + 27, 7);
    line(`> DRIVER #${m.driverNumber} ${m.driverName.toUpperCase()}${m.teamName ? ` / ${m.teamName.toUpperCase()}` : ""}`, sy + 36, 7);

    const name = m.driverLastName.toUpperCase();
    const ns = fitSize(t, name, cw, 52, 0.04);
    // Phosphor glow: wide translucent stroke under the fill (no blur filter).
    const glyphs = textPath(t, name, { x: W / 2, y: sy + 48 + ns * 0.72, size: ns, anchor: "middle", fill: C.green, tracking: 0.04 });
    body.push(glyphs.replace("<path ", `<path stroke="${C.green}" stroke-opacity="0.18" stroke-width="2.2" `));
    body.push(glyphs);
    const evY = sy + 48 + ns * 0.72 + 12;
    const ev = `${m.eventName} ${m.year}  ·  ${m.circuit}  ·  ${m.sessionDate}`.toUpperCase();
    line(ev, evY, fitSize(t, ev, cw, 9), C.amber, "middle", W / 2);

    const trackTop = evY + 8;
    const trackBottom = 296;
    const art = trackArt(data.samples, { x: cx, y: trackTop, w: cw, h: trackBottom - trackTop }, crtStyle);
    body.push(art.svg);

    // Lap time readout
    line(`LAP ${String(m.lapNumber).padStart(2, "0")} TIME`, 314, 7, C.dim);
    const lt = textPath(t, m.lapTime, { x: cx, y: 344, size: 32, fill: C.amber, fallback: fb });
    body.push(lt.replace("<path ", `<path stroke="${C.amber}" stroke-opacity="0.2" stroke-width="1.6" `));
    body.push(lt);

    const rx = cx + cw;
    const rows: [string, string][] = [
      ...m.sectors.map((v, i): [string, string] => [`SECTOR ${i + 1}`, v === null ? "NO DATA" : v.toFixed(3)]),
      ["TOP SPEED", m.topSpeed === null ? "NO DATA" : `${m.topSpeed} KM/H`],
    ];
    rows.forEach(([k, v], i) => {
      line(k, 314 + i * 8.5, 7, C.dim, "start", rx - 78);
      line(v, 314 + i * 8.5, 7, C.green, "end", rx);
    });

    out.push(`<g clip-path="url(#crt-screen)">${body.join("")}<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="url(#crt-scan)"/></g>`);

    // Legend and credit sit above the scanlines so small type stays crisp.
    out.push(legend({ x: cx, y: 362, width: cw, font: fb, text: C.white, muted: C.dim, style: crtStyle, art }));
    out.push(credit(fb, m.credit, cx, sy + sh - 8, cw, C.dim).svg);
    out.push(`<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="10" fill="none" stroke="#000" stroke-width="1.2"/>`);
    return out.join("");
  },
};
