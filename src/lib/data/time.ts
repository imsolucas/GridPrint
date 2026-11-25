// OpenF1 timestamps look like "2023-09-16T14:26:39.212000+00:00" (microseconds),
// but some rows have no fraction ("2023-09-16T14:26:40+00:00"). Date.parse handling
// of >3 fractional digits is engine-specific, so we parse explicitly and keep
// sub-millisecond precision as a fractional ms value.

const RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/;

/** Returns epoch milliseconds (possibly fractional) or NaN if unparseable. Assumes UTC if no zone. */
export function parseOpenF1Date(s: string | null | undefined): number {
  if (!s) return NaN;
  const m = RE.exec(s.trim());
  if (!m) return NaN;
  const [, y, mo, d, h, mi, se, frac, zone] = m;
  let ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se);
  if (frac) ms += Number(`0.${frac}`) * 1000;
  if (zone && zone !== "Z") {
    const sign = zone[0] === "-" ? -1 : 1;
    const digits = zone.slice(1).replace(":", "");
    const offsetMin = +digits.slice(0, 2) * 60 + +digits.slice(2, 4);
    ms -= sign * offsetMin * 60_000;
  }
  return ms;
}

export function formatLapTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "--:--.---";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Formats a session start as its local calendar date using OpenF1's gmt_offset ("08:00:00"). */
export function formatSessionDate(dateStart: string, gmtOffset: string | null): string {
  const utc = parseOpenF1Date(dateStart);
  if (!Number.isFinite(utc)) return "DATE UNKNOWN";
  let offsetMs = 0;
  const m = gmtOffset ? /^(-)?(\d{2}):(\d{2})/.exec(gmtOffset) : null;
  if (m) offsetMs = (m[1] ? -1 : 1) * (+m[2] * 60 + +m[3]) * 60_000;
  const d = new Date(utc + offsetMs);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
