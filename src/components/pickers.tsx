"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Chevron, Search } from "./icons";
import { fmtDayRange, gpShortName, shortSession, type DriverOpt, type Weekend } from "./types";

/** Closes a popover on outside click or Escape and returns focus to its trigger. */
function usePopover(open: boolean, close: () => void, root: React.RefObject<HTMLElement | null>, trigger: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, root, trigger]);
}

/**
 * Season dropdown, newest first. A native <select> scales to any number of seasons and keeps
 * keyboard and screen-reader behaviour for free. Seasons OpenF1 can't serve are listed
 * disabled, with the reason, so nobody wonders where 2022 went.
 */
export function SeasonPicker({ years, value, onChange }: { years: number[]; value: number; onChange: (y: number) => void }) {
  const id = useId();
  return (
    <div className="gp-field">
      <label className="gp-label" htmlFor={id}>
        Season<small>{years.length} with data</small>
      </label>
      <div className="gp-select">
        <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-describedby={`${id}-note`}>
          {[...years].reverse().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
          <option disabled value="">
            {years[0] - 1} and earlier · no OpenF1 data
          </option>
        </select>
        <Chevron />
      </div>
      <span className="gp-hint" id={`${id}-note`}>
        OpenF1 has car telemetry from {years[0]} onwards.
      </span>
    </div>
  );
}

interface TriggerProps {
  label: string;
  hint?: string;
  value: string;
  sub?: string;
  lead?: string;
  stripe?: string | null;
  placeholder?: boolean;
  disabled?: boolean;
  expanded: boolean;
  controls: string;
  onClick: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

function Trigger({ label, hint, value, sub, lead, stripe, placeholder, disabled, expanded, controls, onClick, triggerRef }: TriggerProps) {
  const id = useId();
  return (
    <>
      <span className="gp-label" id={id}>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <button
        ref={triggerRef}
        type="button"
        className={`gp-trigger${placeholder ? " is-placeholder" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        aria-controls={controls}
        aria-labelledby={id}
        aria-describedby={`${id}-v`}
        disabled={disabled}
        onClick={onClick}
      >
        {stripe !== undefined ? <span className="gp-stripe" style={{ background: stripe ?? "var(--ink-faint)" }} /> : <span className="lead">{lead ?? "—"}</span>}
        <span className="v" id={`${id}-v`}>
          <strong>{value}</strong>
          {sub && <span>{sub}</span>}
        </span>
        <Chevron />
      </button>
    </>
  );
}

// ---------------------------------------------------------------- Session

export function SessionPicker({
  weekends,
  loading,
  value,
  onChange,
  disabled,
}: {
  weekends: Weekend[] | null;
  loading: boolean;
  value: number | null;
  onChange: (sessionKey: number) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const panelId = useId();
  usePopover(open, () => setOpen(false), root, trigger);

  const selected = useMemo(() => {
    for (const w of weekends ?? []) {
      const s = w.sessions.find((x) => x.session_key === value);
      if (s) return { w, s };
    }
    return null;
  }, [weekends, value]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!weekends) return [];
    if (!needle) return weekends;
    return weekends.filter((w) => [w.name, w.country, w.circuit, w.location].some((v) => v?.toLowerCase().includes(needle)));
  }, [weekends, q]);
  const flat = useMemo(() => filtered.flatMap((w) => w.sessions.map((s) => s.session_key)), [filtered]);
  const total = weekends?.reduce((n, w) => n + w.sessions.length, 0) ?? 0;

  useEffect(() => {
    if (open) {
      const i = flat.indexOf(value ?? -1);
      setActive(i >= 0 ? i : 0);
      search.current?.focus();
    }
    // Reset only when the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${panelId}-opt-${flat[active]}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, flat, panelId]);

  function pick(key: number) {
    onChange(key);
    setOpen(false);
    setQ("");
    trigger.current?.focus();
  }

  function onKey(e: React.KeyboardEvent) {
    if (!flat.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(flat[active]);
    }
  }

  const label = selected ? `${gpShortName(selected.w.name)} · ${selected.s.session_name}` : loading ? "Loading sessions…" : "Choose a session";
  const sub = selected
    ? `${selected.s.date_start.slice(0, 10)} · ${selected.w.circuit ?? ""}`
    : loading
      ? undefined
      : "Search by Grand Prix, circuit or country";

  return (
    <div className="gp-field gp-combo" ref={root}>
      <Trigger
        label="Session"
        hint={weekends ? `${total} sessions` : undefined}
        value={label}
        sub={sub}
        lead={selected?.w.round ? `R${selected.w.round}` : "—"}
        placeholder={!selected}
        disabled={disabled || !weekends}
        expanded={open}
        controls={panelId}
        onClick={() => setOpen((o) => !o)}
        triggerRef={trigger}
      />
      {open && (
        <div className="gp-panel gp-pop gp-pop--wide" id={panelId} role="dialog" aria-label="Choose a session" onKeyDown={onKey}>
          <div className="gp-search">
            <Search />
            <input
              ref={search}
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              placeholder="Search Grand Prix, circuit or country"
              aria-label="Search sessions"
              aria-controls={`${panelId}-list`}
              aria-activedescendant={flat.length ? `${panelId}-opt-${flat[active]}` : undefined}
            />
          </div>
          <div className="gp-scroll" id={`${panelId}-list`} role="listbox" aria-label="Sessions by weekend">
            {filtered.length === 0 && <p className="gp-empty-note">No Grand Prix matches “{q}”.</p>}
            {filtered.map((w) => (
              <div className="gp-weekend" role="group" aria-label={w.name} key={w.meeting_key}>
                <header>
                  <span className="rd">{w.round ? `R${w.round}` : "—"}</span>
                  <strong>{w.name}</strong>
                  <span className="dt">{fmtDayRange(w.date_start, w.date_end)}</span>
                </header>
                <span className="circuit">{[w.circuit, w.country].filter(Boolean).join(" · ")}</span>
                <div className="gp-sessions">
                  {w.sessions.map((s) => {
                    const idx = flat.indexOf(s.session_key);
                    return (
                      <button
                        key={s.session_key}
                        id={`${panelId}-opt-${s.session_key}`}
                        type="button"
                        tabIndex={-1}
                        role="option"
                        aria-selected={s.session_key === value}
                        className={`gp-chip${idx === active ? " is-active" : ""}`}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => pick(s.session_key)}
                      >
                        {shortSession(s.session_name)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="gp-panel-foot">
            <span>
              {filtered.length} weekends · {flat.length} sessions
            </span>
            <span>↑↓ move · ↵ pick · esc close</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Driver

export function DriverPicker({
  drivers,
  loading,
  value,
  onChange,
  disabled,
}: {
  drivers: DriverOpt[] | null;
  loading: boolean;
  value: number | null;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const panelId = useId();
  usePopover(open, () => setOpen(false), root, trigger);
  const selected = drivers?.find((d) => d.driver_number === value) ?? null;

  useEffect(() => {
    if (!open || !drivers) return;
    const i = drivers.findIndex((d) => d.driver_number === value);
    setActive(i >= 0 ? i : 0);
    list.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && drivers?.[active]) document.getElementById(`${panelId}-d-${drivers[active].driver_number}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, drivers, panelId]);

  function pick(n: number) {
    onChange(n);
    setOpen(false);
    trigger.current?.focus();
  }

  function onKey(e: React.KeyboardEvent) {
    if (!drivers?.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(drivers.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home") {
      setActive(0);
    } else if (e.key === "End") {
      setActive(drivers.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(drivers[active].driver_number);
    }
  }

  return (
    <div className="gp-field gp-combo" ref={root}>
      <Trigger
        label="Driver"
        hint={drivers ? `${drivers.length} drivers` : loading ? "loading…" : undefined}
        value={selected ? `${selected.driver_number} · ${selected.first_name} ${selected.last_name}` : loading ? "Loading drivers…" : disabled ? "Pick a session first" : "Choose a driver"}
        sub={selected?.team_name ?? undefined}
        stripe={selected ? selected.team_colour : undefined}
        placeholder={!selected}
        disabled={disabled || !drivers}
        expanded={open}
        controls={panelId}
        onClick={() => setOpen((o) => !o)}
        triggerRef={trigger}
      />
      {open && drivers && (
        <div className="gp-panel gp-pop" id={panelId}>
          <div
            className="gp-scroll"
            role="listbox"
            aria-label="Drivers"
            tabIndex={0}
            ref={list}
            onKeyDown={onKey}
            aria-activedescendant={drivers[active] ? `${panelId}-d-${drivers[active].driver_number}` : undefined}
          >
            {drivers.length === 0 && <p className="gp-empty-note">OpenF1 lists no drivers for this session.</p>}
            {drivers.map((d, i) => (
              <div
                key={d.driver_number}
                id={`${panelId}-d-${d.driver_number}`}
                role="option"
                aria-selected={d.driver_number === value}
                className={`gp-option${i === active ? " is-active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(d.driver_number)}
              >
                <span className="gp-stripe" style={{ background: d.team_colour ?? "var(--ink-faint)", minHeight: 20 }} />
                <span className="num">{d.driver_number}</span>
                <span>
                  <span className="nm">
                    {d.first_name} <b>{d.last_name}</b>
                  </span>{" "}
                  <span className="tm">{d.team_name}</span>
                </span>
                <span className="check">{d.driver_number === value && <Check />}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
