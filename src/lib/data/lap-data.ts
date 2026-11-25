import type { OF1CarData, OF1Driver, OF1Lap, OF1Location, OF1Meeting, OF1Session } from "../openf1/types";
import { alignLap, lapWindow, type AlignStats, type Missing, type TraceSample } from "./align";
import { formatLapTime, formatSessionDate, parseOpenF1Date } from "./time";

/** Everything fetched from OpenF1 for one lap. Also the shape of test fixtures. */
export interface RawLapBundle {
  session: OF1Session;
  meeting: OF1Meeting | null;
  driver: OF1Driver | null;
  lap: OF1Lap | undefined;
  location: OF1Location[];
  car_data: OF1CarData[];
}

export interface PosterMeta {
  sessionKey: number;
  driverNumber: number;
  lapNumber: number;
  driverName: string;
  driverLastName: string;
  driverAcronym: string;
  teamName: string | null;
  /** "#RRGGBB" or null when OpenF1 has none. */
  teamColour: string | null;
  circuit: string;
  eventName: string;
  country: string | null;
  sessionName: string;
  year: number;
  sessionDate: string;
  lapTimeSeconds: number;
  lapTime: string;
  sectors: (number | null)[];
  /** Derived from the aligned samples (null if no speed data). */
  topSpeed: number | null;
  credit: string;
}

export interface LapData {
  meta: PosterMeta;
  samples: TraceSample[];
  stats: AlignStats;
}

export const DATA_CREDIT =
  "Data: OpenF1 (openf1.org), unofficial and not associated with Formula 1. " +
  "Circuit outline traced from sampled car positions: an artistic interpretation, not a surveyed map.";

export function buildLapData(raw: RawLapBundle): { ok: true; data: LapData } | Missing {
  const w = lapWindow(raw.lap);
  if (!w.ok) return w;
  const aligned = alignLap(raw.location, raw.car_data, w.window);
  if (!aligned.ok) return aligned;

  const lap = raw.lap!;
  const d = raw.driver;
  const s = raw.session;
  // Top speed comes from raw car_data rows inside the lap, never from interpolated values.
  const speeds = raw.car_data
    .filter((c) => {
      const ms = parseOpenF1Date(c.date);
      return ms >= w.window.startMs && ms <= w.window.endMs && typeof c.speed === "number";
    })
    .map((c) => c.speed as number);
  const lastName = d?.last_name ?? d?.broadcast_name?.split(" ").pop() ?? `Car ${lap.driver_number}`;
  const colour = d?.team_colour && /^[0-9a-f]{6}$/i.test(d.team_colour) ? `#${d.team_colour}` : null;

  const meta: PosterMeta = {
    sessionKey: s.session_key,
    driverNumber: lap.driver_number,
    lapNumber: lap.lap_number,
    driverName: d?.full_name ?? `Driver #${lap.driver_number}`,
    driverLastName: lastName,
    driverAcronym: d?.name_acronym ?? String(lap.driver_number),
    teamName: d?.team_name ?? null,
    teamColour: colour,
    circuit: s.circuit_short_name ?? raw.meeting?.circuit_short_name ?? s.location ?? "Unknown circuit",
    eventName: raw.meeting?.meeting_name ?? `${s.country_name ?? ""} ${s.year}`.trim(),
    country: s.country_name,
    sessionName: s.session_name,
    year: s.year,
    sessionDate: formatSessionDate(s.date_start, s.gmt_offset),
    lapTimeSeconds: lap.lap_duration!,
    lapTime: formatLapTime(lap.lap_duration),
    sectors: [lap.duration_sector_1, lap.duration_sector_2, lap.duration_sector_3],
    topSpeed: speeds.length ? Math.round(Math.max(...speeds)) : null,
    credit: DATA_CREDIT,
  };
  return { ok: true, data: { meta, samples: aligned.samples, stats: aligned.stats } };
}
