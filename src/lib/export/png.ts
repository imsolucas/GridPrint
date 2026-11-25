import { Resvg } from "@resvg/resvg-js";
import { exportPixelSize, type PageLayout } from "../geometry/paper";

/**
 * Rewrites the root <svg> width/height (mm) to exact device pixels. The viewBox
 * stays in mm, and preserveAspectRatio="none" maps it onto the pixel grid without
 * a sub-pixel letterbox (the x/y scale differ by < 0.03% because of rounding).
 */
export function withPixelSize(svg: string, width: number, height: number): string {
  return svg.replace(/^<svg([^>]*?)\swidth="[^"]*"\s+height="[^"]*"/, (_all, pre) => {
    return `<svg${pre} width="${width}" height="${height}" preserveAspectRatio="none"`;
  });
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Inserts (or replaces) a pHYs chunk so print dialogs and image editors read the
 * PNG as `dpi` and default to its true physical size. resvg does not write one.
 */
export function setPngDpi(png: Buffer, dpi: number): Buffer {
  const ppm = Math.round(dpi / 0.0254);
  const data = Buffer.alloc(9);
  data.writeUInt32BE(ppm, 0);
  data.writeUInt32BE(ppm, 4);
  data.writeUInt8(1, 8); // unit: metre
  const type = Buffer.from("pHYs", "ascii");
  const chunk = Buffer.alloc(12 + 9);
  chunk.writeUInt32BE(9, 0);
  type.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([type, data])), 17);

  // Walk chunks: keep everything except an existing pHYs; insert ours right after IHDR.
  const parts: Buffer[] = [png.subarray(0, 8)];
  let off = 8;
  while (off < png.length) {
    const len = png.readUInt32BE(off);
    const t = png.toString("ascii", off + 4, off + 8);
    const end = off + 12 + len;
    if (t !== "pHYs") parts.push(png.subarray(off, end));
    if (t === "IHDR") parts.push(chunk);
    off = end;
  }
  return Buffer.concat(parts);
}

export interface PngInfo {
  width: number;
  height: number;
  /** Pixels per inch from pHYs, or null if absent. */
  dpi: number | null;
}

export function readPngInfo(png: Buffer): PngInfo {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  let dpi: number | null = null;
  let off = 8;
  while (off < png.length) {
    const len = png.readUInt32BE(off);
    const t = png.toString("ascii", off + 4, off + 8);
    if (t === "pHYs" && png.readUInt8(off + 16) === 1) dpi = Math.round(png.readUInt32BE(off + 8) * 0.0254);
    if (t === "IDAT") break;
    off += 12 + len;
  }
  return { width, height, dpi };
}

export function renderPng(svg: string, layout: PageLayout, dpi = 300): { png: Buffer; info: PngInfo } {
  const size = exportPixelSize(layout, dpi);
  const resvg = new Resvg(withPixelSize(svg, size.width, size.height), {
    fitTo: { mode: "original" },
    background: "#ffffff",
    // Every glyph is already a path; never let system fonts change the output.
    font: { loadSystemFonts: false },
  });
  const png = setPngDpi(Buffer.from(resvg.render().asPng()), dpi);
  const info = readPngInfo(png);
  if (info.width !== size.width || info.height !== size.height) {
    throw new Error(`PNG size mismatch: got ${info.width}×${info.height}, expected ${size.width}×${size.height}`);
  }
  return { png, info };
}

/** Small preview raster (for gallery thumbnails). */
export function renderThumbnail(svg: string, width = 480): Buffer {
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width }, background: "#ffffff", font: { loadSystemFonts: false } });
  return Buffer.from(resvg.render().asPng());
}
