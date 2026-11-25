import { trackArt, type TrackStyle } from "../geometry/track";
import { fitSize, textPath } from "../text/text";
import { credit, legend } from "./legend";
import type { PosterTemplate } from "./types";

const C = {
  bg: "#0d0a26",
  grid: "#ff2a6d",
  yellow: "#ffd319",
  magenta: "#ff2a6d",
  cyan: "#05d9e8",
  white: "#f4f1ff",
  muted: "#a59fd0",
};

export const arcadeStyle: TrackStyle = {
  palette: ["#3a86ff", "#8338ec", "#ff006e", "#fb5607", "#ffd319"],
  noDataColour: "#6c6a8a",
  width: 1.6,
  brakeWidth: 4.2,
  tickColour: C.white,
  tickLength: 2.2,
  tickWidth: 0.35,
  startColour: C.white,
  underlay: { colour: "#000000", extra: 1.6, opacity: 0.55 },
};

export const arcadeFlyer: PosterTemplate = {
  id: "arcade-flyer",
  name: "Arcade Flyer",
  description: "Neon 80s cabinet flyer with pixel type and a high-score lap time.",
  render({ data, fonts, trimW: W, trimH: H, bleed: b, safe: s }) {
    const m = data.meta;
    const out: string[] = [];
    const px = fonts.pixel;
    const fb = fonts.mono;

    // Full-bleed background
    out.push(`<rect x="${-b}" y="${-b}" width="${W + 2 * b}" height="${H + 2 * b}" fill="${C.bg}"/>`);

    // Perspective floor grid across the lower third (decorative, low contrast)
    const hz = 300;
    const grid: string[] = [];
    for (let i = 0; i <= 14; i++) {
      const y = hz + (H + b - hz) * (i / 14) ** 1.8;
      grid.push(`M${-b} ${y.toFixed(2)}L${W + b} ${y.toFixed(2)}`);
    }
    for (let i = -12; i <= 12; i++) {
      grid.push(`M${(W / 2 + i * 6).toFixed(2)} ${hz}L${(W / 2 + i * 60).toFixed(2)} ${H + b}`);
    }
    out.push(`<path d="${grid.join("")}" stroke="${C.grid}" stroke-opacity="0.16" stroke-width="0.4" fill="none"/>`);

    // Inset double frame
    out.push(
      `<rect x="${s - 5}" y="${s - 5}" width="${W - 2 * (s - 5)}" height="${H - 2 * (s - 5)}" fill="none" stroke="${C.cyan}" stroke-width="0.8"/>` +
        `<rect x="${s - 3}" y="${s - 3}" width="${W - 2 * (s - 3)}" height="${H - 2 * (s - 3)}" fill="none" stroke="${C.magenta}" stroke-width="0.4"/>`,
    );

    // Score bar
    const lab = 3.6, val = 4.6;
    const cols: [string, string, "start" | "middle" | "end", number][] = [
      ["1UP", `${m.driverAcronym} ${m.driverNumber}`, "start", s + 4],
      ["HI-SCORE", m.lapTime, "middle", W / 2],
      ["LAP", String(m.lapNumber).padStart(2, "0"), "end", W - s - 4],
    ];
    for (const [l, v, anchor, x] of cols) {
      out.push(textPath(px, l, { x, y: s + 10, size: lab, anchor, fill: C.magenta, fallback: fb }));
      out.push(textPath(px, v, { x, y: s + 18, size: val, anchor, fill: C.white, fallback: fb }));
    }

    // Title: driver surname, fitted to width, with offset shadow
    const name = m.driverLastName.toUpperCase();
    const ts = fitSize(px, name, W - 2 * s - 8, 30);
    const ty = s + 30 + ts;
    out.push(textPath(px, name, { x: W / 2 + 1.4, y: ty + 1.4, size: ts, anchor: "middle", fill: C.magenta, fallback: fb }));
    out.push(textPath(px, name, { x: W / 2, y: ty, size: ts, anchor: "middle", fill: C.yellow, fallback: fb }));

    const sub = `${m.eventName} ${m.year}`.toUpperCase();
    const ss = fitSize(px, sub, W - 2 * s - 8, 5.2);
    out.push(textPath(px, sub, { x: W / 2, y: ty + 13, size: ss, anchor: "middle", fill: C.cyan, fallback: fb }));
    const sub2 = `${m.circuit} · ${m.sessionName} · ${m.sessionDate}`.toUpperCase();
    const ss2 = fitSize(fb, sub2, W - 2 * s - 8, 4.2, 0.05);
    out.push(textPath(fb, sub2, { x: W / 2, y: ty + 21, size: ss2, anchor: "middle", fill: C.white, tracking: 0.05 }));

    // Track
    const trackTop = ty + 28;
    const trackBottom = 322;
    const art = trackArt(data.samples, { x: s, y: trackTop, w: W - 2 * s, h: trackBottom - trackTop }, arcadeStyle);
    out.push(art.svg);

    // Lap time block
    const by = 340;
    out.push(textPath(px, "LAP TIME", { x: s + 4, y: by, size: 4, fill: C.magenta }));
    const lt = fitSize(px, m.lapTime, 150, 15);
    out.push(textPath(px, m.lapTime, { x: s + 4, y: by + 6 + lt, size: lt, fill: C.yellow }));
    const team = (m.teamName ?? "").toUpperCase();
    if (team) out.push(textPath(fb, team, { x: s + 4, y: by + lt + 12, size: 3.6, fill: m.teamColour ?? C.white, fallback: fb }));

    const rx = W - s - 4;
    const stats: [string, string][] = [
      ...m.sectors.map((v, i): [string, string] => [`S${i + 1}`, v === null ? "N/A" : v.toFixed(3)]),
      ["TOP KM/H", m.topSpeed === null ? "N/A" : String(m.topSpeed)],
    ];
    stats.forEach(([k, v], i) => {
      const y = by + i * 7;
      out.push(textPath(fonts.monoBold, v, { x: rx, y, size: 4.2, anchor: "end", fill: C.white }));
      out.push(textPath(fb, k, { x: rx - 28, y, size: 3.4, anchor: "end", fill: C.muted }));
    });

    // Legend
    out.push(
      legend({ x: s + 4, y: 377, width: W - 2 * s - 8, font: fb, text: C.white, muted: C.muted, style: arcadeStyle, art }),
    );

    // Credit
    out.push(credit(fb, m.credit, s + 4, H - s - 2, W - 2 * s - 8, C.muted).svg);
    return out.join("");
  },
};
