"use client";

import { useEffect, useRef, useState } from "react";
import { ErrorIcon, Loupe, Shield, Warn } from "./icons";
import type { ApiError } from "./types";

export type Preview =
  | { kind: "idle" }
  | { kind: "loading"; lap: number | null }
  | { kind: "ready"; url: string }
  | { kind: "missing"; error: ApiError }
  | { kind: "error"; error: ApiError };

type Zoom = "fit" | 1 | 2;
/** CSS px for 1 mm at 100 % (96 px per inch). */
const PX_PER_MM = 96 / 25.4;
/** Seconds before the loading state is shown, so cached laps never flash a spinner. */
const LOADING_DELAY_MS = 300;

const MISSING_LABEL: Record<string, string> = {
  "no-location-data": "Car positions",
  "no-car-data": "Car telemetry: speed, brake and gear",
  "too-few-samples": "Enough position samples to trace the lap",
  "lap-start-missing": "The lap's start timestamp",
  "lap-duration-missing": "A lap time",
  "lap-not-found": "This lap",
  "session-not-found": "This session",
};

function Ghost({ children }: { children: React.ReactNode }) {
  return (
    <div className="gp-ghost-sheet">
      <span className="corner c1" />
      <span className="corner c2" />
      <span className="corner c3" />
      <span className="corner c4" />
      <div className="inner">{children}</div>
    </div>
  );
}

export function Stage({
  preview,
  title,
  meta,
  guides,
  crop,
  lapLine,
  fastest,
  onUseFastest,
  onPickAnother,
  onRetry,
  onCancel,
  samples,
}: {
  preview: Preview;
  title: string;
  meta: string;
  guides: boolean;
  crop: boolean;
  lapLine: string | null;
  fastest: { lap: number; time: string } | null;
  onUseFastest: () => void;
  onPickAnother: () => void;
  onRetry: () => void;
  onCancel: () => void;
  samples: { label: string; onClick: () => void }[];
}) {
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [loupeOn, setLoupeOn] = useState(false);
  const [lens, setLens] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const body = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const ready = preview.kind === "ready";
  const docMm = crop ? { w: 323, h: 446 } : { w: 303, h: 426 };

  useEffect(() => {
    if (preview.kind !== "loading") return;
    const t0 = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Date.now() - t0), 100);
    return () => clearInterval(id);
  }, [preview]);

  useEffect(() => {
    if (!ready) setZoom("fit");
  }, [ready]);

  function onKey(e: React.KeyboardEvent) {
    if (!ready) return;
    const order: Zoom[] = ["fit", 1, 2];
    const i = order.indexOf(zoom);
    if (e.key === "+" || e.key === "=") setZoom(order[Math.min(2, i + 1)]);
    else if (e.key === "-" || e.key === "_") setZoom(order[Math.max(0, i - 1)]);
    else if (e.key === "0") setZoom("fit");
  }

  function onWheel(e: React.WheelEvent) {
    if (!ready || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const order: Zoom[] = ["fit", 1, 2];
    const i = order.indexOf(zoom);
    setZoom(order[e.deltaY < 0 ? Math.min(2, i + 1) : Math.max(0, i - 1)]);
  }

  const zoomed = zoom !== "fit";
  const sheetStyle: React.CSSProperties = { aspectRatio: `${docMm.w} / ${docMm.h}` };
  if (zoomed) sheetStyle.width = `${Math.round(docMm.w * PX_PER_MM * (zoom as number))}px`;

  let content: React.ReactNode;
  if (preview.kind === "ready") {
    content = (
      <div
        className="gp-sheet"
        style={sheetStyle}
        onMouseMove={(e) => {
          if (!loupeOn) return;
          const r = e.currentTarget.getBoundingClientRect();
          setLens({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, w: r.width, h: r.height });
        }}
        onMouseLeave={() => setLens(null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview.url} alt={`${title} poster preview${lapLine ? `: ${lapLine}` : ""}`} draggable={false} />
        {!zoomed && (
          <>
            <span className="gp-dim w" aria-hidden="true">
              <span>{docMm.w} mm{crop ? " with crop marks" : ""}</span>
            </span>
            <span className="gp-dim h" aria-hidden="true">
              <span>{docMm.h} mm</span>
            </span>
          </>
        )}
      </div>
    );
  } else if (preview.kind === "loading") {
    content =
      elapsed < LOADING_DELAY_MS ? null : (
        <Ghost>
          <div className="gp-state">
            <span className="gp-spin" style={{ width: 22, height: 22, color: "var(--ink)" }} aria-hidden="true" />
            <h2>{preview.lap ? `Fetching lap ${preview.lap} from OpenF1` : "Fetching lap data from OpenF1"}</h2>
            <p>The first load of a lap takes 2–15 seconds. After that it opens instantly from the local cache.</p>
            <ol className="gp-steps" aria-label="What is being fetched">
              <li>
                <span className="ic" />
                <span>Session and lap timing</span>
                <span className="s">OpenF1</span>
              </li>
              <li>
                <span className="ic" />
                <span>Car positions</span>
                <span className="s">OpenF1</span>
              </li>
              <li>
                <span className="ic" />
                <span>Car telemetry · speed, brake, gear</span>
                <span className="s">OpenF1</span>
              </li>
              <li>
                <span className="ic" />
                <span>Draw poster</span>
                <span className="s">local</span>
              </li>
            </ol>
            <span className="gp-elapsed">{(elapsed / 1000).toFixed(1)} s</span>
            <button type="button" className="gp-btn gp-btn--ghost gp-btn--sm" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </Ghost>
      );
  } else if (preview.kind === "missing") {
    content = (
      <Ghost>
        <div className="gp-state gp-state--missing">
          <span className="gp-state-icon">
            <Warn />
          </span>
          <h2>Not enough data for this lap</h2>
          <dl className="gp-reason">
            {lapLine && (
              <div>
                <dt>Lap</dt>
                <dd className="mono">{lapLine}</dd>
              </div>
            )}
            <div>
              <dt>Missing</dt>
              <dd>{MISSING_LABEL[preview.error.code] ?? "Telemetry for this lap"}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>
                {preview.error.message} <code>{preview.error.code}</code>
              </dd>
            </div>
          </dl>
          <p className="gp-principle">
            <Shield />
            <span>GRID PRINT never invents telemetry. Every line on a poster comes from a real sample, so a lap with gaps gets no poster.</span>
          </p>
          <div className="gp-row">
            {fastest && (
              <button type="button" className="gp-btn gp-btn--secondary" onClick={onUseFastest}>
                Use fastest lap · {fastest.lap} · <span className="mono">{fastest.time}</span>
              </button>
            )}
            <button type="button" className="gp-btn gp-btn--ghost" onClick={onPickAnother}>
              Pick another lap
            </button>
          </div>
        </div>
      </Ghost>
    );
  } else if (preview.kind === "error") {
    const offline = preview.error.code === "openf1-unavailable" || preview.error.code === "network";
    content = (
      <Ghost>
        <div className="gp-state gp-state--error">
          <span className="gp-state-icon">
            <ErrorIcon />
          </span>
          <h2>{offline ? "Can’t reach OpenF1" : "Couldn’t build the poster"}</h2>
          <p>{offline ? "Check your connection. Laps you opened before still work offline." : preview.error.message}</p>
          {offline && <p className="gp-hint mono">{preview.error.message}</p>}
          <button type="button" className="gp-btn gp-btn--secondary gp-btn--sm" onClick={onRetry}>
            Retry
          </button>
        </div>
      </Ghost>
    );
  } else {
    content = (
      <Ghost>
        <div className="gp-state">
          <h2>Pick a lap</h2>
          <p>Choose a season, session, driver and lap. Your poster appears here at A3 proportions.</p>
          {samples.length > 0 && (
            <>
              <p className="gp-hint" style={{ marginTop: 14 }}>
                Or start from a sample
              </p>
              <div className="gp-row">
                {samples.map((s) => (
                  <button key={s.label} type="button" className="gp-btn gp-btn--secondary gp-btn--sm" onClick={s.onClick}>
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </Ghost>
    );
  }

  return (
    <section className="gp-stage" aria-label="Poster preview" onKeyDown={onKey}>
      <div className="gp-stage-bar">
        <span className="ttl">{title}</span>
        <span className="meta">{meta}</span>
        <span className="sp" />
        <div className="gp-zoom" role="group" aria-label="Zoom">
          {(["fit", 1, 2] as Zoom[]).map((z) => (
            <button key={String(z)} type="button" aria-pressed={zoom === z} disabled={!ready} onClick={() => setZoom(z)}>
              {z === "fit" ? "Fit" : `${z * 100}%`}
            </button>
          ))}
          <button type="button" aria-pressed={loupeOn} aria-label="Loupe, 4× detail on hover" disabled={!ready} onClick={() => setLoupeOn((v) => !v)}>
            <Loupe />
          </button>
        </div>
      </div>
      <div
        ref={body}
        className={`gp-stage-body${zoomed ? " is-zoomed" : ""}${loupeOn ? " is-loupe" : ""}`}
        aria-live="polite"
        aria-busy={preview.kind === "loading"}
        tabIndex={ready ? 0 : -1}
        onWheel={onWheel}
        onPointerDown={(e) => {
          if (!zoomed || !body.current) return;
          drag.current = { x: e.clientX, y: e.clientY, sl: body.current.scrollLeft, st: body.current.scrollTop };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current || !body.current) return;
          body.current.scrollLeft = drag.current.sl - (e.clientX - drag.current.x);
          body.current.scrollTop = drag.current.st - (e.clientY - drag.current.y);
        }}
        onPointerUp={() => (drag.current = null)}
      >
        <div role={preview.kind === "loading" ? "status" : preview.kind === "missing" || preview.kind === "error" ? "alert" : undefined} style={{ display: "contents" }}>
          {content}
        </div>
      </div>
      <div className="gp-stage-foot">
        {ready && guides ? (
          <>
            <span className="k">
              <i />
              Trim 297 × 420
            </span>
            <span className="k">
              <i className="s" />
              Safe 12 mm
            </span>
            <span className="k">Bleed 3 mm</span>
            <span className="sp" />
            <span>Guides are on-screen only, never exported</span>
          </>
        ) : (
          <>
            <span>A3 portrait · {docMm.w} × {docMm.h} mm {crop ? "with crop marks" : "including bleed"}</span>
            <span className="sp" />
            <span>{ready ? "Press + / − or ctrl-scroll to zoom" : ""}</span>
          </>
        )}
      </div>
      {ready && loupeOn && lens && (
        <div className="gp-loupe" aria-hidden="true">
          <div
            className="lens"
            style={{
              backgroundImage: `url(${(preview as { url: string }).url})`,
              backgroundSize: `${lens.w * 4}px ${lens.h * 4}px`,
              backgroundPosition: `${84 - lens.x * lens.w * 4}px ${66 - lens.y * lens.h * 4}px`,
            }}
          />
          <div className="cap">
            <span>LOUPE 4×</span>
            <span>
              {Math.round(lens.x * docMm.w)} × {Math.round(lens.y * docMm.h)} mm
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
