// Human-readable download names, e.g.
//   "Carlos Sainz - Singapore Grand Prix 2023 - Qualifying - Lap 19 - Arcade Flyer.png"
// People keep downloaded posters as-is, so the name should read like a title, not a slug.

export interface FilenameParts {
  driverName: string;
  eventName: string;
  year: number;
  sessionName: string;
  lapNumber: number;
  templateName: string;
  cropMarks: boolean;
}

/** OpenF1 writes surnames in capitals ("Carlos SAINZ"); a file name reads better in title case. */
function titleCaseName(name: string) {
  return name
    .split(/\s+/)
    .map((w) => (w.length > 1 && w === w.toUpperCase() ? w.charAt(0) + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/** Removes characters that Windows, macOS or Linux refuse in file names. */
function sanitize(s: string) {
  return s
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
}

export function posterFilename(p: FilenameParts, ext: string) {
  const event = /\b(19|20)\d{2}\b/.test(p.eventName) ? p.eventName : `${p.eventName} ${p.year}`;
  const base = [titleCaseName(p.driverName), event, p.sessionName, `Lap ${p.lapNumber}`, p.templateName].map(sanitize).filter(Boolean).join(" - ");
  return `${base}${p.cropMarks ? " (crop marks)" : ""}.${ext}`;
}

/**
 * Content-Disposition with an ASCII fallback plus the exact UTF-8 name (RFC 6266 / 5987),
 * so "Sergio Pérez" and "Nico Hülkenberg" keep their accents in every modern browser.
 */
export function contentDisposition(filename: string) {
  const ascii = filename
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/["\\]/g, "");
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** Reads the file name back out of a Content-Disposition header (prefers the UTF-8 form). */
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      /* fall through to the ASCII form */
    }
  }
  return /filename="([^"]+)"/i.exec(header)?.[1] ?? null;
}
