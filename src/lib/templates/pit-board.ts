import { trackArt, type TrackStyle } from "../geometry/track";
import { fitSize, textPath } from "../text/text";
import { credit, legend } from "./legend";
import type { PosterTemplate } from "./types";

const C = {
  asphalt: "#26262a",
  board: "#0b0b0c",
  slot: "#151517",
  yellow: "#ffd400",
  white: "#f5f5f0",
  muted: "#a3a3a8",
};

export const pitBoardStyle: TrackStyle = {
  palette: ["#3d7bd9", "#8fb8ff", "#f2f2f2", "#ffd400", "#ff7a00"],
  noDataColour: "#5c5c63",
  width: 1.6,
  brakeWidth: 4.2,
  tickColour: C.white,
  tickLength: 2.2,
  tickWidth: 0.35,
  startColour: C.yellow,
  underlay: { colour: "#000000", extra: 1.4, opacity: 0.5 },
};

export const pitBoard: PosterTemplate = {
  id: "pit-board",
  name: "Pit Board",
  description: "Pit-wall signal board in condensed type over an asphalt ground.",
  render({ data, fonts, trimW: W, trimH: H, bleed: b, safe: s }) {
    const m = data.meta;
    const k = fonts.condensed;
    const fb = fonts.mono;
    const team = m.teamColour ?? C.yellow;
    const out: string[] = [];

    out.push(`<rect x="${-b}" y="${-b}" width="${W + 2 * b}" height="${H + 2 * b}" fill="${C.asphalt}"/>`);
    // Team-colour band bleeding off the top edge
    out.push(`<rect x="${-b}" y="${-b}" width="${W + 2 * b}" height="${b + 6}" fill="${team}"/>`);

    // Header
    const title = `${m.eventName} ${m.year}`.toUpperCase();
    const ts = fitSize(k, title, W - 2 * s, 22, 0.02);
    out.push(textPath(k, title, { x: s, y: s + 8 + ts * 0.7, size: ts, fill: C.yellow, tracking: 0.02 }));
    const sub = `${m.circuit} · ${m.sessionName} · ${m.sessionDate}`.toUpperCase();
    const hy = s + 8 + ts * 0.7 + 8;
    out.push(textPath(fb, sub, { x: s, y: hy, size: fitSize(fb, sub, W - 2 * s, 4.2, 0.06), fill: C.white, tracking: 0.06 }));

    // Track
    const boardTop = 236;
    const art = trackArt(data.samples, { x: s, y: hy + 6, w: W - 2 * s, h: boardTop - 8 - (hy + 6) }, pitBoardStyle);
    out.push(art.svg);

    // Pit board: yellow frame, black board, three slotted rows
    const bx = s, bw = W - 2 * s, rowH = 38, pad = 5;
    const bh = pad * 2 + rowH * 3 + 4;
    out.push(`<rect x="${bx - 2.5}" y="${boardTop - 2.5}" width="${bw + 5}" height="${bh + 5}" rx="3" fill="${C.yellow}"/>`);
    out.push(`<rect x="${bx}" y="${boardTop}" width="${bw}" height="${bh}" rx="1.5" fill="${C.board}"/>`);
    out.push(`<rect x="${bx}" y="${boardTop}" width="7" height="${bh}" fill="${team}"/>`);
    const rows = [
      `${m.driverAcronym} ${m.driverNumber}`,
      `LAP ${m.lapNumber}`,
      m.lapTime,
    ];
    rows.forEach((r, i) => {
      const ry = boardTop + pad + i * (rowH + 2);
      out.push(`<rect x="${bx + 12}" y="${ry}" width="${bw - 17}" height="${rowH}" fill="${C.slot}"/>`);
      const size = fitSize(k, r, bw - 30, rowH * 1.12, 0.04);
      out.push(textPath(k, r, { x: bx + 12 + (bw - 17) / 2, y: ry + rowH / 2 + size * 0.35, size, anchor: "middle", fill: i === 2 ? C.yellow : C.white, tracking: 0.04, fallback: fb }));
    });

    // Stats line under the board
    const statY = boardTop + bh + 11;
    const sectors = m.sectors.map((v, i) => `S${i + 1} ${v === null ? "N/A" : v.toFixed(3)}`).join("   ");
    const stats = `${m.driverName.toUpperCase()}${m.teamName ? ` · ${m.teamName.toUpperCase()}` : ""}   ${sectors}   TOP ${m.topSpeed ?? "N/A"} KM/H`;
    out.push(textPath(fonts.monoBold, stats, { x: s, y: statY, size: fitSize(fonts.monoBold, stats, W - 2 * s, 4), fill: C.white }));

    out.push(legend({ x: s, y: statY + 6, width: W - 2 * s, font: fb, text: C.white, muted: C.muted, style: pitBoardStyle, art }));
    out.push(credit(fb, m.credit, s, H - s - 2, W - 2 * s, C.muted).svg);
    return out.join("");
  },
};
