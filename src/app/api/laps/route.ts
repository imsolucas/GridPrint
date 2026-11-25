import { NextResponse } from "next/server";
import { formatLapTime } from "@/lib/data/time";
import { listLaps } from "@/lib/data/load";
import { errorFrom } from "@/lib/poster-server";

export const runtime = "nodejs";

/**
 * Timing-screen sector colours, per driver within the session:
 * purple = this driver's best of the session, green = better than any earlier lap, yellow = slower.
 */
type SectorColour = "purple" | "green" | "yellow" | null;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const sessionKey = Number(sp.get("session_key"));
  const driverNumber = Number(sp.get("driver_number"));
  if (!(sessionKey > 0 && driverNumber > 0)) {
    return NextResponse.json({ error: { code: "bad-request", message: "session_key and driver_number required" } }, { status: 400 });
  }
  try {
    const laps = await listLaps(sessionKey, driverNumber);
    const timed = laps.map((l) => l.lap_duration).filter((d): d is number => d !== null);
    const best = timed.length ? Math.min(...timed) : null;
    const sectorKeys = ["duration_sector_1", "duration_sector_2", "duration_sector_3"] as const;
    const sessionBest = sectorKeys.map((k) => {
      const v = laps.filter((l) => l.lap_duration !== null).map((l) => l[k]).filter((d): d is number => d !== null);
      return v.length ? Math.min(...v) : null;
    });
    const running: (number | null)[] = [null, null, null];

    return NextResponse.json({
      laps: laps.map((l) => {
        const reason = !l.date_start
          ? "No start timestamp"
          : l.lap_duration === null
            ? l.is_pit_out_lap
              ? "Out-lap"
              : "In-lap or deleted"
            : null;
        const sectors = sectorKeys.map((k, i) => {
          const v = l[k];
          let colour: SectorColour = null;
          if (reason === null && v !== null) {
            if (sessionBest[i] !== null && v <= sessionBest[i]!) colour = "purple";
            else if (running[i] === null || v < running[i]!) colour = "green";
            else colour = "yellow";
            running[i] = running[i] === null ? v : Math.min(running[i]!, v);
          }
          return { seconds: v, colour };
        });
        return {
          lap_number: l.lap_number,
          lap_time: formatLapTime(l.lap_duration),
          lap_seconds: l.lap_duration,
          gap: l.lap_duration !== null && best !== null ? l.lap_duration - best : null,
          usable: reason === null,
          reason,
          is_best: l.lap_duration !== null && l.lap_duration === best,
          is_pit_out_lap: !!l.is_pit_out_lap,
          sectors,
          speed_trap: l.st_speed ?? null,
        };
      }),
    });
  } catch (err) {
    const e = errorFrom(err);
    return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
  }
}
