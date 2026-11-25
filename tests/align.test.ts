import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { alignLap, lapWindow } from "@/lib/data/align";
import { buildLapData, type RawLapBundle } from "@/lib/data/lap-data";
import { parseOpenF1Date } from "@/lib/data/time";
import type { OF1CarData, OF1Lap, OF1Location } from "@/lib/openf1/types";

const T0 = Date.UTC(2023, 8, 16, 14, 0, 0);
const iso = (ms: number) => new Date(T0 + ms).toISOString().replace("Z", "000+00:00"); // microsecond form
const loc = (ms: number, x: number, y = 0): OF1Location => ({ date: iso(ms), x, y, z: 1, driver_number: 1, session_key: 1 });
const car = (ms: number, speed: number | null, brake: number | null = 0, gear: number | null = 5): OF1CarData => ({
  date: iso(ms), speed, brake, n_gear: gear, driver_number: 1, session_key: 1,
});
const win = { startMs: T0, endMs: T0 + 10_000 };

describe("parseOpenF1Date", () => {
  it("parses microsecond fractions, no fraction, Z and offsets", () => {
    expect(parseOpenF1Date("2023-09-16T14:26:39.212000+00:00")).toBe(Date.UTC(2023, 8, 16, 14, 26, 39, 212));
    expect(parseOpenF1Date("2023-09-16T14:26:39+00:00")).toBe(Date.UTC(2023, 8, 16, 14, 26, 39));
    expect(parseOpenF1Date("2023-09-16T14:26:39.5Z")).toBe(Date.UTC(2023, 8, 16, 14, 26, 39, 500));
    expect(parseOpenF1Date("2023-09-16T22:26:39.000+08:00")).toBe(Date.UTC(2023, 8, 16, 14, 26, 39));
    expect(parseOpenF1Date("2023-09-16T14:26:39.212345+00:00")).toBeCloseTo(Date.UTC(2023, 8, 16, 14, 26, 39, 212) + 0.345, 6);
    expect(parseOpenF1Date("not a date")).toBeNaN();
    expect(parseOpenF1Date(null)).toBeNaN();
  });
});

describe("alignLap", () => {
  it("aligns by timestamp, not by array index", () => {
    // Telemetry has extra leading rows and is shuffled; index pairing would be wrong.
    const locations = [loc(1000, 1), loc(2000, 2), loc(3000, 3)];
    const carData = [car(2500, 250), car(-500, 999), car(500, 100), car(1500, 200), car(3500, 300), car(0, 999)];
    const r = alignLap(locations, carData, win, { minSamples: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.samples.map((s) => s.speed)).toEqual([150, 225, 275]);
    expect(r.samples.map((s) => s.t)).toEqual([1, 2, 3]);
  });

  it("step-holds brake and gear instead of interpolating them", () => {
    const r = alignLap([loc(1400, 1)], [car(1000, 100, 0, 3), car(1500, 120, 100, 4)], win, { minSamples: 1 });
    if (!r.ok) throw new Error(r.detail);
    expect(r.samples[0].gear).toBe(3);
    expect(r.samples[0].brake).toBe(0);
  });

  it("keeps only samples inside the lap window", () => {
    const r = alignLap([loc(-100, 0), loc(5000, 5), loc(10_100, 9)], [car(4900, 1), car(5100, 1)], win, { minSamples: 1 });
    if (!r.ok) throw new Error(r.detail);
    expect(r.samples.map((s) => s.x)).toEqual([5]);
  });

  it("marks telemetry missing across a gap instead of inventing it", () => {
    const r = alignLap([loc(1000, 1), loc(5000, 5), loc(9000, 9)], [car(900, 100), car(9100, 300)], win, {
      minSamples: 1,
      maxGapMs: 1000,
    });
    if (!r.ok) throw new Error(r.detail);
    expect(r.samples[1]).toMatchObject({ speed: null, brake: null, gear: null });
    expect(r.samples[0].speed).toBe(100);
    expect(r.samples[2].speed).toBe(300);
    expect(r.stats.missingSpeed).toBe(1);
  });

  it("drops (0,0,0) placeholder positions", () => {
    const zero = { ...loc(2000, 0, 0), z: 0 };
    const r = alignLap([loc(1000, 1), zero], [car(1000, 100), car(2000, 100)], win, { minSamples: 1 });
    if (!r.ok) throw new Error(r.detail);
    expect(r.samples).toHaveLength(1);
    expect(r.stats.droppedLocations).toBe(1);
  });

  it("reports missing data explicitly", () => {
    expect(alignLap([], [car(1, 1)], win)).toMatchObject({ ok: false, reason: "no-location-data" });
    expect(alignLap([loc(1000, 1)], [], win)).toMatchObject({ ok: false, reason: "no-car-data" });
    const lap = { lap_number: 1, date_start: iso(0), lap_duration: null } as OF1Lap;
    expect(lapWindow(lap)).toMatchObject({ ok: false, reason: "lap-duration-missing" });
    expect(lapWindow(undefined)).toMatchObject({ ok: false, reason: "lap-not-found" });
  });
});

describe("fixture: Singapore 2023 Q, Sainz lap 19", () => {
  const raw = JSON.parse(
    readFileSync(path.join(__dirname, "fixtures", "sgp-2023-q-sai-lap19.json"), "utf8"),
  ) as RawLapBundle;
  it("produces a full normalised trace", () => {
    const r = buildLapData(raw);
    if (!r.ok) throw new Error(r.detail);
    const { samples, meta } = r.data;
    expect(samples.length).toBeGreaterThan(300);
    expect(samples[0].t).toBeGreaterThanOrEqual(0);
    expect(samples.at(-1)!.t).toBeLessThanOrEqual(90.984);
    expect(samples.every((s, i) => i === 0 || s.t > samples[i - 1].t)).toBe(true);
    expect(Object.keys(samples[0]).sort()).toEqual(["brake", "gear", "speed", "t", "x", "y"]);
    expect(meta.lapTime).toBe("1:30.984");
    expect(meta.sessionDate).toBe("16 SEP 2023");
  });
});
