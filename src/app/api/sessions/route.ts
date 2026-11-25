import { NextResponse } from "next/server";
import { listCompletedSessions, listMeetings } from "@/lib/data/load";
import { errorFrom } from "@/lib/poster-server";

export const runtime = "nodejs";

/**
 * Completed sessions for a season, grouped by Grand Prix weekend (newest first).
 * A flat list is ~100 entries, so the studio's picker searches and groups these.
 */
export async function GET(req: Request) {
  const year = Number(new URL(req.url).searchParams.get("year") ?? new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2023) {
    return NextResponse.json({ error: { code: "bad-year", message: "OpenF1 covers 2023 onwards." } }, { status: 400 });
  }
  try {
    const [sessions, meetings] = await Promise.all([listCompletedSessions(year), listMeetings(year).catch(() => [])]);
    const meetingByKey = new Map(meetings.map((m) => [m.meeting_key, m]));

    // Round numbers: race weekends in date order, testing excluded.
    const firstStart = new Map<number, number>();
    for (const s of sessions) {
      const t = Date.parse(s.date_start);
      firstStart.set(s.meeting_key, Math.min(firstStart.get(s.meeting_key) ?? Infinity, t));
    }
    const isTesting = (key: number) => /test/i.test(meetingByKey.get(key)?.meeting_name ?? "");
    const ordered = [...firstStart.entries()].filter(([k]) => !isTesting(k)).sort((a, b) => a[1] - b[1]);
    const round = new Map(ordered.map(([k], i) => [k, i + 1]));

    const groups = new Map<number, {
      meeting_key: number; round: number | null; name: string; country: string | null; circuit: string | null;
      location: string | null; date_start: string; date_end: string;
      sessions: { session_key: number; session_name: string; date_start: string }[];
    }>();
    for (const s of sessions) {
      const m = meetingByKey.get(s.meeting_key);
      let g = groups.get(s.meeting_key);
      if (!g) {
        g = {
          meeting_key: s.meeting_key,
          round: round.get(s.meeting_key) ?? null,
          name: m?.meeting_name ?? `${s.country_name ?? s.location ?? "Unknown"} Grand Prix`,
          country: s.country_name,
          circuit: s.circuit_short_name,
          location: s.location,
          date_start: s.date_start,
          date_end: s.date_start,
          sessions: [],
        };
        groups.set(s.meeting_key, g);
      }
      if (s.date_start < g.date_start) g.date_start = s.date_start;
      if (s.date_start > g.date_end) g.date_end = s.date_start;
      g.sessions.push({ session_key: s.session_key, session_name: s.session_name, date_start: s.date_start });
    }
    const weekends = [...groups.values()]
      .map((g) => ({ ...g, sessions: g.sessions.sort((a, b) => a.date_start.localeCompare(b.date_start)) }))
      .sort((a, b) => b.date_start.localeCompare(a.date_start));
    return NextResponse.json({ weekends, count: sessions.length });
  } catch (err) {
    const e = errorFrom(err);
    return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
  }
}
