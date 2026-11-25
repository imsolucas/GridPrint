import { arcadeFlyer } from "./arcade-flyer";
import { crtScanline } from "./crt-scanline";
import { pitBoard } from "./pit-board";
import type { PosterTemplate } from "./types";

/** Register new templates here (see README → "Adding a template"). */
export const TEMPLATES: PosterTemplate[] = [arcadeFlyer, crtScanline, pitBoard];

export function getTemplate(id: string | null | undefined): PosterTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export type { PosterTemplate };
