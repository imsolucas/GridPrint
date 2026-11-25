import type { LapData } from "../data/lap-data";
import type { FontSet } from "../text/text";

export interface TemplateInput {
  data: LapData;
  fonts: FontSet;
  /** Trim size in mm; templates draw in trim coordinates (0,0 = top-left of the trimmed sheet). */
  trimW: number;
  trimH: number;
  /** Backgrounds must extend this far past every trim edge. */
  bleed: number;
  /** Keep text and the track inside [safe, trim - safe]. */
  safe: number;
}

/**
 * A poster template is a pure function: (lap data, metadata, fonts) → SVG markup.
 * It returns the inner artwork only; `composePoster` adds the document frame,
 * bleed clip and optional crop marks.
 */
export interface PosterTemplate {
  id: string;
  name: string;
  description: string;
  render(input: TemplateInput): string;
}
