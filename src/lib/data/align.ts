import type { OF1CarData, OF1Lap, OF1Location } from "../openf1/types";
import { parseOpenF1Date } from "./time";

/** One normalised sample. Telemetry fields are null when no real measurement is close enough. */
export interface TraceSample {
  /** Seconds since the lap's start. */
  t: number;
  /** OpenF1 track coordinates (arbitrary units, y up). */
  x: number;
  y: number;
  /** km/h */
  speed: number | null;
  /** 0..1 (OpenF1 reports brake as 0 or 100). */
  brake: number | null;
  /** 0 = neutral. */
  gear: number | null;
}

export interface LapWindow {
  startMs: number;
  endMs: number;
}

export type MissingReason =
  | "lap-not-found"
  | "lap-start-missing"
  | "lap-duration-missing"
  | "no-location-data"
  | "no-car-data"
  | "too-few-samples";

export interface Missing {
  ok: false;
  reason: MissingReason;
  detail: string;
}

export function lapWindow(lap: OF1Lap | undefined): { ok: true; window: LapWindow } | Missing {
  if (!lap) return { ok: false, reason: "lap-not-found", detail: "No such lap for this driver." };
  const startMs = parseOpenF1Date(lap.date_start);
  if (!Number.isFinite(startMs)) {
    return { ok: false, reason: "lap-start-missing", detail: `Lap ${lap.lap_number} has no start timestamp.` };
  }
  if (lap.lap_duration === null || !Number.isFinite(lap.lap_duration) || lap.lap_duration <= 0) {
    return {
      ok: false,
      reason: "lap-duration-missing",
      detail: `Lap ${lap.lap_number} has no recorded lap time (often an out-lap, in-lap or deleted lap).`,
    };
  }
  return { ok: true, window: { startMs, endMs: startMs + lap.lap_duration * 1000 } };
}

export interface AlignOptions {
  /** Max distance in time from a location sample to a telemetry sample we will use. */
  maxGapMs?: number;
  minSamples?: number;
}

export interface AlignStats {
  locationSamples: number;
  droppedLocations: number;
  carSamples: number;
  missingSpeed: number;
  missingBrake: number;
  missingGear: number;
}

export type AlignResult = { ok: true; samples: TraceSample[]; stats: AlignStats } | Missing;

interface Timed<T> {
  ms: number;
  row: T;
}

function sortByTime<T extends { date: string }>(rows: T[]): Timed<T>[] {
  return rows
    .map((row) => ({ ms: parseOpenF1Date(row.date), row }))
    .filter((r) => Number.isFinite(r.ms))
    .sort((a, b) => a.ms - b.ms);
}

/** Index of the last element with ms <= t, or -1. */
function lastAtOrBefore<T>(arr: Timed<T>[], t: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].ms <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Selects location samples inside the lap window and attaches telemetry by
 * timestamp (never by array index). Location is the base clock because it
 * defines the drawn path.
 *
 * - speed: linear interpolation between the bracketing car_data samples when both
 *   are within maxGap; otherwise the nearest one if within maxGap/2; otherwise null.
 * - brake, gear: step-hold (value of the latest car_data sample at or before t, if
 *   within maxGap). They are discrete states and are never interpolated.
 */
export function alignLap(
  locations: OF1Location[],
  carData: OF1CarData[],
  window: LapWindow,
  opts: AlignOptions = {},
): AlignResult {
  const maxGap = opts.maxGapMs ?? 1000;
  const minSamples = opts.minSamples ?? 20;

  const locSorted = sortByTime(locations);
  const inWindow = locSorted.filter((l) => l.ms >= window.startMs && l.ms <= window.endMs);
  // (0,0,0) rows are OpenF1's "no position" placeholder, not a real point on track.
  const valid = inWindow.filter(
    (l) => isNum(l.row.x) && isNum(l.row.y) && !(l.row.x === 0 && l.row.y === 0 && (l.row.z ?? 0) === 0),
  );
  if (valid.length === 0) {
    return { ok: false, reason: "no-location-data", detail: "OpenF1 has no position samples for this lap." };
  }

  const car = sortByTime(carData).filter(
    (c) => c.ms >= window.startMs - maxGap && c.ms <= window.endMs + maxGap,
  );
  if (car.length === 0) {
    return { ok: false, reason: "no-car-data", detail: "OpenF1 has no car telemetry for this lap." };
  }

  const stats: AlignStats = {
    locationSamples: valid.length,
    droppedLocations: inWindow.length - valid.length,
    carSamples: car.length,
    missingSpeed: 0,
    missingBrake: 0,
    missingGear: 0,
  };

  const samples: TraceSample[] = valid.map(({ ms, row }) => {
    const i = lastAtOrBefore(car, ms);
    const prev = i >= 0 ? car[i] : undefined;
    const next = i + 1 < car.length ? car[i + 1] : undefined;
    const prevOk = prev && ms - prev.ms <= maxGap;
    const nextOk = next && next.ms - ms <= maxGap;

    let speed: number | null = null;
    const ps = prev?.row.speed;
    const ns = next?.row.speed;
    if (prevOk && nextOk && isNum(ps) && isNum(ns)) {
      const span = next!.ms - prev!.ms;
      const u = span > 0 ? (ms - prev!.ms) / span : 0;
      speed = ps + (ns - ps) * u;
    } else {
      const cands = [
        prev && isNum(ps) ? { d: ms - prev.ms, v: ps } : null,
        next && isNum(ns) ? { d: next.ms - ms, v: ns } : null,
      ].filter((c): c is { d: number; v: number } => c !== null && c.d <= maxGap / 2);
      cands.sort((a, b) => a.d - b.d);
      speed = cands[0]?.v ?? null;
    }

    const held = prevOk ? prev!.row : undefined;
    const brake = held && isNum(held.brake) ? Math.min(1, Math.max(0, held.brake / 100)) : null;
    const gear = held && isNum(held.n_gear) ? held.n_gear : null;

    if (speed === null) stats.missingSpeed++;
    if (brake === null) stats.missingBrake++;
    if (gear === null) stats.missingGear++;

    return { t: (ms - window.startMs) / 1000, x: row.x as number, y: row.y as number, speed, brake, gear };
  });

  if (samples.length < minSamples) {
    return {
      ok: false,
      reason: "too-few-samples",
      detail: `Only ${samples.length} position samples in this lap (need ${minSamples}).`,
    };
  }
  return { ok: true, samples, stats };
}
