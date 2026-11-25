// Shapes returned by the studio's /api routes.
export interface TemplateInfo { id: string; name: string; description: string }

export interface SessionOpt { session_key: number; session_name: string; date_start: string }
export interface Weekend {
  meeting_key: number;
  round: number | null;
  name: string;
  country: string | null;
  circuit: string | null;
  location: string | null;
  date_start: string;
  date_end: string;
  sessions: SessionOpt[];
}

export interface DriverOpt {
  driver_number: number;
  first_name: string;
  last_name: string;
  acronym: string | null;
  team_name: string | null;
  team_colour: string | null;
}

export type SectorColour = "purple" | "green" | "yellow" | null;
export interface LapOpt {
  lap_number: number;
  lap_time: string;
  lap_seconds: number | null;
  gap: number | null;
  usable: boolean;
  reason: string | null;
  is_best: boolean;
  is_pit_out_lap: boolean;
  sectors: { seconds: number | null; colour: SectorColour }[];
  speed_trap: number | null;
}

export interface ApiError { code: string; message: string }

/** Short session names as the timing screens write them. */
export function shortSession(name: string) {
  return name.replace(/^Practice (\d)$/, "FP$1");
}

export function fmtDayRange(a: string, b: string) {
  const d1 = new Date(a), d2 = new Date(b);
  const m = (d: Date) => d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  return m(d1) === m(d2)
    ? `${d1.getUTCDate()}–${d2.getUTCDate()} ${m(d2)}`
    : `${d1.getUTCDate()} ${m(d1)} – ${d2.getUTCDate()} ${m(d2)}`;
}

/** "Singapore Grand Prix" → "Singapore" for compact labels. */
export function gpShortName(name: string) {
  return name.replace(/\s+Grand Prix$/i, "").trim() || name;
}
