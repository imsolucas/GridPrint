"use client";

import { useEffect, useRef } from "react";
import type { LapOpt } from "./types";

/**
 * Timing-screen lap list. A radiogroup with a roving tabindex: arrow keys move between
 * usable laps; unavailable laps stay in the list with their reason as text.
 */
export function LapList({ laps, value, onChange }: { laps: LapOpt[]; value: number | null; onChange: (lap: number) => void }) {
  const body = useRef<HTMLDivElement>(null);
  const usable = laps.filter((l) => l.usable).map((l) => l.lap_number);
  const maxGap = Math.max(1, ...laps.map((l) => l.gap ?? 0).filter((g) => g < 10));

  // Keep the selected lap in view when the list loads or the selection changes.
  useEffect(() => {
    const el = body.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (el && body.current) body.current.scrollTop = el.offsetTop - body.current.clientHeight / 2 + el.clientHeight / 2;
  }, [value, laps]);

  function move(e: React.KeyboardEvent) {
    const i = usable.indexOf(value ?? -1);
    let next: number | undefined;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = usable[Math.min(usable.length - 1, i + 1)];
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = usable[Math.max(0, i - 1)];
    else if (e.key === "Home") next = usable[0];
    else if (e.key === "End") next = usable[usable.length - 1];
    if (next === undefined) return;
    e.preventDefault();
    onChange(next);
    requestAnimationFrame(() => body.current?.querySelector<HTMLElement>(`[data-lap="${next}"]`)?.focus());
  }

  return (
    <div className="gp-field">
      <span className="gp-label" id="lb-lap">
        Lap<small>{laps.length} laps · fastest auto-selected</small>
      </span>
      <div className="gp-laps">
        <div className="gp-laps-head" aria-hidden="true">
          <span>Lap</span>
          <span>Gap to fastest</span>
          <span>Time</span>
        </div>
        <div className="gp-laps-body" role="radiogroup" aria-labelledby="lb-lap" ref={body} onKeyDown={move}>
          {laps.map((l) => {
            if (!l.usable) {
              return (
                <div key={l.lap_number} className="gp-lap" role="radio" aria-checked="false" aria-disabled="true" aria-label={`Lap ${l.lap_number}, unavailable: ${l.reason}`}>
                  <span className="no">{l.lap_number}</span>
                  <span className="track">
                    <span className="rule" />
                    <span className="why">{l.reason}</span>
                    {l.is_pit_out_lap && <span className="gp-tag gp-tag--pit">Pit out</span>}
                  </span>
                  <span className="dash">—</span>
                </div>
              );
            }
            const selected = l.lap_number === value;
            const width = 14 + 86 * (1 - Math.min(1, (l.gap ?? 0) / maxGap));
            return (
              <div
                key={l.lap_number}
                data-lap={l.lap_number}
                className={`gp-lap${l.is_best ? " is-best" : ""}`}
                role="radio"
                aria-checked={selected}
                tabIndex={selected || (value === null && l.is_best) ? 0 : -1}
                aria-label={`Lap ${l.lap_number}, ${l.lap_time}${l.is_best ? ", fastest" : ` , plus ${l.gap?.toFixed(3)} seconds`}${l.is_pit_out_lap ? ", pit out" : ""}`}
                onClick={() => onChange(l.lap_number)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    onChange(l.lap_number);
                  }
                }}
              >
                <span className="no">{l.lap_number}</span>
                <span className="track">
                  <span className="bar" style={{ width: `${(width * 0.6).toFixed(0)}%` }} />
                  {l.is_best ? <span className="gp-tag gp-tag--best">Fastest</span> : <span className="d">+{l.gap?.toFixed(3)}</span>}
                  {l.is_pit_out_lap && <span className="gp-tag gp-tag--pit">Pit out</span>}
                </span>
                <span className="t">{l.lap_time}</span>
              </div>
            );
          })}
        </div>
        <div className="gp-laps-foot">
          <span className="gp-key">
            <i className="gp-p-bg" />
            Fastest
          </span>
          <span className="gp-key">
            <span className="gp-tag gp-tag--pit">Pit out</span>
          </span>
          <span>Unavailable rows say why</span>
        </div>
      </div>
    </div>
  );
}

const SECTOR_CLASS = { purple: "p", green: "g", yellow: "y" } as const;

export function LapSummary({
  lap,
  driverLine,
  stripe,
  topSpeed,
}: {
  lap: LapOpt;
  driverLine: string;
  stripe: string | null;
  topSpeed: number | null;
}) {
  const fmt = (s: number | null) => (s === null ? "—" : s >= 60 ? `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, "0")}` : s.toFixed(3));
  return (
    <div className="gp-summary" aria-label="Selected lap">
      <span className="gp-stripe" style={{ background: stripe ?? "var(--ink-faint)" }} />
      <div>
        <div className="who">
          <span>{driverLine}</span>
          <span className="mono">{lap.is_best ? "FASTEST" : `+${lap.gap?.toFixed(3)}`}</span>
        </div>
        <div className="time">{lap.lap_time}</div>
        <dl className="gp-sectors">
          {lap.sectors.map((s, i) => {
            const c = s.colour ? SECTOR_CLASS[s.colour] : null;
            return (
              <div key={i}>
                <dt>
                  {c && <i className={`gp-${c}-bg`} />}S{i + 1}
                </dt>
                <dd className={c ? `gp-${c}` : undefined} title={s.colour ? `${s.colour === "purple" ? "Driver's best of the session" : s.colour === "green" ? "Improved on earlier laps" : "Slower than earlier laps"}` : undefined}>
                  {fmt(s.seconds)}
                </dd>
              </div>
            );
          })}
          <div>
            <dt>TOP</dt>
            <dd>{topSpeed ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
