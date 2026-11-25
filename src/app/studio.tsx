"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chevron, Download } from "@/components/icons";
import { filenameFromDisposition } from "@/lib/filename";
import { LapList, LapSummary } from "@/components/lap-list";
import { DriverPicker, SeasonPicker, SessionPicker } from "@/components/pickers";
import { NoticeBanner, PrintHelp, SpecLine, StylePicker, Toggle, type Notice } from "@/components/print-controls";
import { Stage, type Preview } from "@/components/stage";
import { gpShortName, type ApiError, type DriverOpt, type LapOpt, type TemplateInfo, type Weekend } from "@/components/types";

const FIRST_YEAR = 2023;
const YEARS = Array.from({ length: new Date().getFullYear() - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);

/** One-click samples from the empty state. */
const SAMPLES = [
  { label: "Singapore 2023 · Sainz pole", year: 2023, session: 9161, driver: 55, lap: 19 },
  { label: "Abu Dhabi 2024 · Hulkenberg L17", year: 2024, session: 9662, driver: 27, lap: 17 },
];

const MISSING_CODES = new Set([
  "lap-not-found", "lap-start-missing", "lap-duration-missing", "no-location-data", "no-car-data", "too-few-samples", "session-not-found",
]);

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw (body?.error as ApiError) ?? { code: "http", message: `Request failed (${res.status})` };
  return body as T;
}

const pixelsLabel = (h: string | null) => {
  const m = h && /^(\d+)x(\d+)@(\d+)dpi$/.exec(h);
  return m ? `${m[1]} × ${m[2]} px · ${m[3]} DPI` : null;
};

export default function Studio({ templates }: { templates: TemplateInfo[] }) {
  const [year, setYear] = useState(YEARS[YEARS.length - 1]);
  const [weekends, setWeekends] = useState<Weekend[] | null>(null);
  const [sessionKey, setSessionKey] = useState<number | null>(null);
  const [drivers, setDrivers] = useState<DriverOpt[] | null>(null);
  const [driver, setDriver] = useState<number | null>(null);
  const [laps, setLaps] = useState<LapOpt[] | null>(null);
  const [lap, setLap] = useState<number | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [template, setTemplate] = useState(templates[0]?.id ?? "arcade-flyer");
  const [crop, setCrop] = useState(false);
  const [guides, setGuides] = useState(true);
  const [preview, setPreview] = useState<Preview>({ kind: "idle" });
  const [topSpeed, setTopSpeed] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState<null | "svg" | "png">(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [pickerCollapsed, setPickerCollapsed] = useState(false);
  // A sample sets the whole cascade at once; these hold the wanted values until each list arrives.
  const pending = useRef<{ session?: number; driver?: number; lap?: number } | null>(null);
  const previewAbort = useRef<AbortController | null>(null);

  // ---- Cascading picker: season → sessions → drivers → laps
  useEffect(() => {
    const ac = new AbortController();
    setWeekends(null);
    setListError(null);
    getJson<{ weekends: Weekend[] }>(`/api/sessions?year=${year}`, ac.signal)
      .then((r) => {
        setWeekends(r.weekends);
        if (pending.current?.session) {
          setSessionKey(pending.current.session);
          pending.current.session = undefined;
        }
      })
      .catch((e) => !ac.signal.aborted && setListError(`Couldn’t load ${year} sessions: ${e.message}`));
    return () => ac.abort();
  }, [year, retry]);

  useEffect(() => {
    if (!sessionKey) return;
    const ac = new AbortController();
    setDrivers(null);
    getJson<{ drivers: DriverOpt[] }>(`/api/drivers?session_key=${sessionKey}`, ac.signal)
      .then((r) => {
        setDrivers(r.drivers);
        if (pending.current?.driver) {
          setDriver(pending.current.driver);
          pending.current.driver = undefined;
        }
      })
      .catch((e) => !ac.signal.aborted && setListError(`Couldn’t load drivers: ${e.message}`));
    return () => ac.abort();
  }, [sessionKey, retry]);

  useEffect(() => {
    if (!sessionKey || !driver) return;
    const ac = new AbortController();
    setLaps(null);
    getJson<{ laps: LapOpt[] }>(`/api/laps?session_key=${sessionKey}&driver_number=${driver}`, ac.signal)
      .then((r) => {
        setLaps(r.laps);
        const want = pending.current?.lap;
        pending.current = null;
        setLap((cur) => {
          const ok = (n: number | null | undefined) => r.laps.some((l) => l.lap_number === n && l.usable);
          if (ok(want)) return want!;
          if (ok(cur)) return cur;
          return r.laps.find((l) => l.is_best)?.lap_number ?? r.laps.find((l) => l.usable)?.lap_number ?? null;
        });
      })
      .catch((e) => !ac.signal.aborted && setListError(`Couldn’t load laps: ${e.message}`));
    return () => ac.abort();
  }, [sessionKey, driver, retry]);

  const query = useMemo(() => {
    if (!sessionKey || !driver || !lap) return null;
    return `session_key=${sessionKey}&driver_number=${driver}&lap_number=${lap}&template=${template}&crop=${crop ? 1 : 0}`;
  }, [sessionKey, driver, lap, template, crop]);

  // ---- Preview
  useEffect(() => {
    if (!query) {
      setPreview({ kind: "idle" });
      return;
    }
    const ac = new AbortController();
    previewAbort.current = ac;
    let url: string | null = null;
    setPreview({ kind: "loading", lap });
    fetch(`/api/poster?${query}&format=svg&guides=${guides ? 1 : 0}`, { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) {
          const err = ((await res.json().catch(() => null))?.error as ApiError) ?? { code: "http", message: `HTTP ${res.status}` };
          setPreview(MISSING_CODES.has(err.code) ? { kind: "missing", error: err } : { kind: "error", error: err });
          return;
        }
        const top = res.headers.get("x-gridprint-top-speed");
        setTopSpeed(top ? Number(top) : null);
        url = URL.createObjectURL(await res.blob());
        setPreview({ kind: "ready", url });
      })
      .catch((e) => {
        if (!ac.signal.aborted) setPreview({ kind: "error", error: { code: "network", message: String(e?.message ?? e) } });
      });
    return () => {
      ac.abort();
      if (url) URL.revokeObjectURL(url);
    };
    // `lap` is part of `query`; it is read here only for the loading message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, guides, retry]);

  // Deep link: /?year=2023&session=9161&driver=55&lap=19&style=pit-board opens that lap directly.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const n = (k: string) => (Number.isInteger(Number(sp.get(k))) && Number(sp.get(k)) > 0 ? Number(sp.get(k)) : null);
    const style = sp.get("style");
    if (style && templates.some((t) => t.id === style)) setTemplate(style);
    if (sp.get("crop") === "1") setCrop(true);
    const [y, s, dr, l] = [n("year"), n("session"), n("driver"), n("lap")];
    if (y && s && dr && YEARS.includes(y)) loadSample({ label: "", year: y, session: s, driver: dr, lap: l ?? 0 });
    // Runs once on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mobile: collapse the picker into a one-line summary once a poster is ready.
  useEffect(() => {
    if (preview.kind === "ready") setPickerCollapsed(true);
  }, [preview.kind]);

  // The mobile toast clears itself; the inline banner in the rail stays.
  const [toast, setToast] = useState<Notice | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const download = useCallback(
    async (format: "svg" | "png") => {
      if (!query) return;
      setBusy(format);
      setNotice(null);
      try {
        const res = await fetch(`/api/poster?${query}&format=${format}&download=1&save=1`);
        if (!res.ok) {
          const err = (await res.json().catch(() => null))?.error as ApiError | undefined;
          throw new Error(err?.message ?? `HTTP ${res.status}.`);
        }
        const name = filenameFromDisposition(res.headers.get("content-disposition")) ?? `GRID PRINT poster.${format}`;
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        const px = format === "png" ? pixelsLabel(res.headers.get("x-gridprint-pixels")) : "SVG · vector, prints at any size";
        const n: Notice = { kind: "ok", file: name, pixels: px };
        setNotice(n);
        setToast(n);
        setHelpOpen(true);
      } catch (e) {
        const n: Notice = { kind: "err", text: (e as Error).message };
        setNotice(n);
        setToast(n);
      } finally {
        setBusy(null);
      }
    },
    [query],
  );

  // ---- Derived labels
  const ready = preview.kind === "ready";
  const weekend = weekends?.find((w) => w.sessions.some((s) => s.session_key === sessionKey)) ?? null;
  const session = weekend?.sessions.find((s) => s.session_key === sessionKey) ?? null;
  const d = drivers?.find((x) => x.driver_number === driver) ?? null;
  const lapRow = laps?.find((l) => l.lap_number === lap) ?? null;
  const best = laps?.find((l) => l.is_best) ?? null;
  const tpl = templates.find((t) => t.id === template);
  const stageMeta = [
    weekend && `${gpShortName(weekend.name)} ${session?.date_start.slice(0, 4)}`,
    session?.session_name,
    d?.acronym,
    lap && `Lap ${lap}`,
    crop && ready ? "crop marks" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  function changeYear(y: number) {
    if (y === year) return;
    setYear(y);
    setSessionKey(null);
    setDriver(null);
    setLap(null);
    setDrivers(null);
    setLaps(null);
  }

  function loadSample(s: (typeof SAMPLES)[number]) {
    pending.current = { session: s.session, driver: s.driver, lap: s.lap };
    if (s.year !== year) {
      changeYear(s.year);
    } else {
      setSessionKey(s.session);
      pending.current.session = undefined;
      setDriver(null);
      setLap(null);
      setLaps(null);
    }
  }

  const exportState = ready ? "ready" : preview.kind === "loading" ? "loading" : preview.kind === "missing" ? "missing" : "empty";
  const disabledHint =
    exportState === "loading"
      ? "Downloads unlock when the preview is ready."
      : exportState === "missing"
        ? "Nothing to download: this lap has no poster."
        : preview.kind === "error"
          ? "Downloads need a working preview."
          : "Pick a lap to enable downloads.";

  const buttons = (
    <>
      <button type="button" className="gp-btn gp-btn--primary" disabled={!ready || busy !== null} aria-busy={busy === "png"} onClick={() => download("png")}>
        {busy === "png" ? <span className="gp-spin" aria-hidden="true" /> : <Download />}
        {busy === "png" ? "Rendering PNG…" : "Download PNG"}
      </button>
      <button type="button" className="gp-btn gp-btn--secondary" disabled={!ready || busy !== null} aria-busy={busy === "svg"} onClick={() => download("svg")}>
        {busy === "svg" ? "Exporting…" : "SVG"}
      </button>
    </>
  );

  return (
    <div className="gp-studio">
      <aside className="gp-rail" aria-label="Poster controls">
        <section className={`gp-section gp-section--lap${pickerCollapsed && ready ? " is-collapsed" : ""}`} aria-labelledby="h-lap">
          <h2 className="gp-eyebrow" id="h-lap">
            <span className="n">01</span>Lap
          </h2>
          {d && lapRow && (
            <button type="button" className="gp-mpick" onClick={() => setPickerCollapsed(false)} aria-label={`Change lap: ${stageMeta}`}>
              <span className="gp-stripe" style={{ background: d.team_colour ?? "var(--ink-faint)" }} />
              <span>
                <strong>
                  {d.driver_number} · {d.first_name} {d.last_name}
                </strong>
                <span>
                  {stageMeta} · {lapRow.lap_time}
                </span>
              </span>
              <Chevron />
            </button>
          )}
          <div className="gp-picker gp-field" style={{ gap: "var(--space-3)" }}>
            <SeasonPicker years={YEARS} value={year} onChange={changeYear} />
            <SessionPicker
              weekends={weekends}
              loading={weekends === null && !listError}
              value={sessionKey}
              onChange={(k) => {
                setSessionKey(k);
                setDriver(null);
                setLap(null);
                setLaps(null);
              }}
            />
            <DriverPicker
              drivers={drivers}
              loading={!!sessionKey && drivers === null && !listError}
              value={driver}
              disabled={!sessionKey}
              onChange={(n) => {
                setDriver(n);
                setLap(null);
              }}
            />
            {laps && laps.length > 0 ? (
              <LapList laps={laps} value={lap} onChange={setLap} />
            ) : (
              <div className="gp-field">
                <span className="gp-label">Lap</span>
                <button type="button" className="gp-trigger" disabled>
                  <span className="lead">—</span>
                  <span className="v">
                    <strong>
                      {laps && laps.length === 0
                        ? "OpenF1 has no laps for this driver in this session."
                        : driver && !listError
                          ? "Loading laps…"
                          : "Pick a driver first"}
                    </strong>
                  </span>
                  <span />
                </button>
              </div>
            )}
            {lapRow && lapRow.usable && d && (
              <LapSummary
                lap={lapRow}
                driverLine={`${d.first_name} ${d.last_name} · ${d.team_name ?? ""} · Lap ${lapRow.lap_number}`}
                stripe={d.team_colour}
                topSpeed={ready ? topSpeed : null}
              />
            )}
            {listError && (
              <div className="gp-banner gp-banner--err" role="alert">
                <span />
                <div>{listError}</div>
                <button type="button" className="gp-btn gp-btn--ghost gp-btn--sm" onClick={() => { setListError(null); setRetry((r) => r + 1); }}>
                  Retry
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="gp-section gp-section--style" aria-labelledby="h-style">
          <h2 className="gp-eyebrow" id="h-style">
            <span className="n">02</span>Style<span className="aside">{templates.length} styles</span>
          </h2>
          <StylePicker templates={templates} value={template} onChange={setTemplate} />
        </section>

        <section className="gp-section gp-section--print" aria-labelledby="h-print">
          <h2 className="gp-eyebrow" id="h-print">
            <span className="n">03</span>Print
          </h2>
          <Toggle title="Crop marks" sub="Adds a margin outside the bleed with trim marks. The file gets bigger." checked={crop} onChange={setCrop} />
          <Toggle title="Show trim and safe guides" sub="On screen only. Never exported." checked={guides} onChange={setGuides} />
          <SpecLine crop={crop} />
        </section>

        <section className="gp-section gp-section--export" aria-labelledby="h-export">
          <h2 className="gp-eyebrow" id="h-export">
            <span className="n">04</span>Export<span className="aside">300 DPI</span>
          </h2>
          <div className="gp-actions">{buttons}</div>
          <p className="gp-hint">
            {ready ? (
              <>
                Every download is also saved to the <a href="/gallery">Gallery</a>.
              </>
            ) : (
              disabledHint
            )}
          </p>
          {notice && <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} />}
          <PrintHelp open={helpOpen} onToggle={setHelpOpen} />
        </section>
      </aside>

      <Stage
        preview={preview}
        title={ready ? (tpl?.name ?? "Preview") : "Preview"}
        meta={stageMeta || "A3 · 303 × 426 mm incl. bleed"}
        guides={guides}
        crop={crop}
        lapLine={lapRow ? `${lapRow.lap_number} · ${lapRow.lap_time}` : null}
        fastest={best && best.lap_number !== lap ? { lap: best.lap_number, time: best.lap_time } : null}
        onUseFastest={() => best && setLap(best.lap_number)}
        onPickAnother={() => {
          setPickerCollapsed(false);
          (document.querySelector('.gp-laps-body [tabindex="0"], .gp-laps-body [role="radio"]:not([aria-disabled])') as HTMLElement | null)?.focus();
        }}
        onRetry={() => setRetry((r) => r + 1)}
        onCancel={() => {
          previewAbort.current?.abort();
          setLap(null);
        }}
        samples={SAMPLES.map((s) => ({ label: s.label, onClick: () => loadSample(s) }))}
      />

      {/* Phones: downloads stay one tap away. */}
      <div className="gp-mbar" aria-label="Download">
        {buttons}
      </div>
      {toast && (
        <div className="gp-toast">
          <NoticeBanner notice={toast} onDismiss={() => setToast(null)} />
        </div>
      )}
    </div>
  );
}
