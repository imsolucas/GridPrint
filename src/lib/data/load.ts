import "server-only";
import { openf1 } from "../openf1/client";
import type { OF1CarData, OF1Driver, OF1Lap, OF1Location, OF1Meeting, OF1Session } from "../openf1/types";
import { lapWindow } from "./align";
import type { RawLapBundle } from "./lap-data";

const HOUR = 3_600_000;
const PAD_MS = 2000;

export async function getSession(sessionKey: number): Promise<OF1Session | null> {
  const [s] = await openf1<OF1Session>("sessions", { session_key: sessionKey });
  return s ?? null;
}

/** Sessions for a year that have finished (OpenF1 only has complete data after the session). */
export async function listCompletedSessions(year: number): Promise<OF1Session[]> {
  const all = await openf1<OF1Session>("sessions", { year }, { ttlMs: 6 * HOUR });
  const now = Date.now();
  return all
    .filter((s) => !s.is_cancelled && s.date_end && Date.parse(s.date_end) < now - HOUR)
    .sort((a, b) => Date.parse(b.date_start) - Date.parse(a.date_start));
}

export async function listMeetings(year: number): Promise<OF1Meeting[]> {
  return openf1<OF1Meeting>("meetings", { year }, { ttlMs: 6 * HOUR });
}

export async function listDrivers(sessionKey: number): Promise<OF1Driver[]> {
  const rows = await openf1<OF1Driver>("drivers", { session_key: sessionKey });
  const seen = new Map<number, OF1Driver>();
  for (const d of rows) seen.set(d.driver_number, d);
  return [...seen.values()].sort((a, b) => a.driver_number - b.driver_number);
}

export async function listLaps(sessionKey: number, driverNumber: number): Promise<OF1Lap[]> {
  const rows = await openf1<OF1Lap>("laps", { session_key: sessionKey, driver_number: driverNumber });
  return rows.sort((a, b) => a.lap_number - b.lap_number);
}

/** Fetches everything for one lap. Telemetry is requested only for the lap's time window (+ padding). */
export async function loadLapBundle(
  sessionKey: number,
  driverNumber: number,
  lapNumber: number,
): Promise<RawLapBundle | null> {
  const session = await getSession(sessionKey);
  if (!session) return null;
  const [meetings, drivers, laps] = await Promise.all([
    openf1<OF1Meeting>("meetings", { meeting_key: session.meeting_key }),
    openf1<OF1Driver>("drivers", { session_key: sessionKey, driver_number: driverNumber }),
    listLaps(sessionKey, driverNumber),
  ]);
  const lap = laps.find((l) => l.lap_number === lapNumber);
  const bundle: RawLapBundle = {
    session,
    meeting: meetings[0] ?? null,
    driver: drivers[0] ?? null,
    lap,
    location: [],
    car_data: [],
  };
  const w = lapWindow(lap);
  if (!w.ok) return bundle; // buildLapData reports the precise reason.

  const range = {
    session_key: sessionKey,
    driver_number: driverNumber,
    "date>": new Date(w.window.startMs - PAD_MS).toISOString(),
    "date<": new Date(w.window.endMs + PAD_MS).toISOString(),
  };
  bundle.location = await openf1<OF1Location>("location", range);
  bundle.car_data = await openf1<OF1CarData>("car_data", range);
  return bundle;
}
