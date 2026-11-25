import { NextResponse } from "next/server";
import { listDrivers } from "@/lib/data/load";
import { errorFrom } from "@/lib/poster-server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sessionKey = Number(new URL(req.url).searchParams.get("session_key"));
  if (!Number.isInteger(sessionKey) || sessionKey <= 0) {
    return NextResponse.json({ error: { code: "bad-request", message: "session_key required" } }, { status: 400 });
  }
  try {
    const drivers = await listDrivers(sessionKey);
    return NextResponse.json({
      drivers: drivers.map((d) => {
        const full = d.full_name ?? d.broadcast_name ?? "Unknown";
        const first = d.first_name ?? (d.last_name ? full.replace(new RegExp(`\\s*${d.last_name}$`, "i"), "") : "");
        const last = (d.last_name ?? full.split(" ").slice(-1)[0] ?? "").toUpperCase();
        return {
          driver_number: d.driver_number,
          first_name: first,
          last_name: last,
          acronym: d.name_acronym,
          team_name: d.team_name,
          team_colour: d.team_colour ? `#${d.team_colour.replace(/^#/, "")}` : null,
        };
      }),
    });
  } catch (err) {
    const e = errorFrom(err);
    return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
  }
}
