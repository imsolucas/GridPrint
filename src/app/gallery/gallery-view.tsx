"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronRight, Download, Info } from "@/components/icons";

export interface GalleryItem {
  id: string;
  createdAt: string;
  query: string;
  driverNumber: number;
  driverName: string;
  driverLastName: string;
  teamColour: string | null;
  eventName: string;
  year: number;
  sessionName: string;
  lapNumber: number;
  lapTime: string;
  templateName: string;
}

const ALL = "all";

function splitName(full: string, last: string) {
  const i = full.toLowerCase().lastIndexOf(last.toLowerCase());
  return i > 0 ? { first: full.slice(0, i).trim(), last: last.toUpperCase() } : { first: "", last: full.toUpperCase() };
}

function Card({ p, onRemoved }: { p: GalleryItem; onRemoved: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [thumbMissing, setThumbMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { first, last } = splitName(p.driverName, p.driverLastName);
  const label = `${p.driverName}, ${p.eventName}, lap ${p.lapNumber}`;

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/gallery/${p.id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) onRemoved(p.id);
    else {
      setError("Couldn’t remove it. Try again.");
      setBusy(false);
    }
  }

  return (
    <article className="gp-card" aria-label={label}>
      <div className="mat">
        <div className="pic">
          {thumbMissing ? (
            <div className="gp-placeholder" role="img" aria-label="Thumbnail missing">
              <Info size={18} />
              <span>
                Thumbnail not found.
                <br />
                Poster files are still on disk.
              </span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/gallery/${p.id}/thumb.png?v=${encodeURIComponent(p.createdAt)}`}
              alt={`${p.templateName} poster, ${label}`}
              loading="lazy"
              onError={() => setThumbMissing(true)}
            />
          )}
        </div>
      </div>
      <div className="body">
        <div className="who">
          <span className="gp-stripe" style={{ background: p.teamColour ?? "var(--ink-faint)" }} />
          <div>
            <strong>
              {first} <b>{last}</b>
            </strong>
            <span>
              {p.eventName} {p.year} · {p.sessionName}
            </span>
          </div>
          <span className="no">#{p.driverNumber}</span>
        </div>
        <dl>
          <div>
            <dt>Lap</dt>
            <dd>{p.lapNumber}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{p.lapTime}</dd>
          </div>
          <div>
            <dt>Style</dt>
            <dd style={{ fontFamily: "var(--font-sans)" }}>{p.templateName}</dd>
          </div>
        </dl>
        {confirming ? (
          <div className="confirm" role="alertdialog" aria-label="Remove poster" aria-describedby={`rm-${p.id}`}>
            <div id={`rm-${p.id}`}>
              <b>Remove this poster?</b>
              <span>Deletes its saved SVG and thumbnail from data/gallery. This can’t be undone.</span>
              {error && <span style={{ color: "var(--err)", display: "block" }}>{error}</span>}
            </div>
            <span />
            <button type="button" className="gp-btn gp-btn--ghost gp-btn--sm" autoFocus onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="gp-btn gp-btn--danger gp-btn--sm" onClick={remove} disabled={busy}>
              {busy ? "Removing…" : "Remove"}
            </button>
          </div>
        ) : (
          <div className="dl" role="group" aria-label={`Download ${label}`}>
            <a className="gp-btn gp-btn--secondary gp-btn--sm" href={`/api/gallery/${p.id}/poster.svg?download=1`}>
              <Download />
              SVG
            </a>
            <a className="gp-btn gp-btn--secondary gp-btn--sm" href={`/api/poster?${p.query}&format=png&download=1`}>
              PNG 300 DPI
            </a>
            <a className="gp-btn gp-btn--secondary gp-btn--sm" href={`/api/poster?${p.query}&crop=1&format=png&download=1`}>
              PNG + crop
            </a>
            <button type="button" className="gp-btn gp-btn--ghost gp-btn--sm" onClick={() => setConfirming(true)} aria-label={`Remove ${label}`}>
              Remove
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export default function GalleryView({ posters: initial }: { posters: GalleryItem[] }) {
  const router = useRouter();
  const [posters, setPosters] = useState(initial);
  const [season, setSeason] = useState<string>(ALL);
  const [driver, setDriver] = useState<string>(ALL);
  const [style, setStyle] = useState<string>(ALL);

  const seasons = useMemo(() => [...new Set(posters.map((p) => p.year))].sort(), [posters]);
  const drivers = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of posters) m.set(p.driverNumber, p.driverName);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [posters]);
  const styles = useMemo(() => [...new Set(posters.map((p) => p.templateName))].sort(), [posters]);
  const shown = posters.filter(
    (p) =>
      (season === ALL || String(p.year) === season) &&
      (driver === ALL || String(p.driverNumber) === driver) &&
      (style === ALL || p.templateName === style),
  );

  if (posters.length === 0) {
    return (
      <div className="gp-gallery-page">
        <div className="gp-empty">
          <div className="frame" aria-hidden="true">
            <span className="nail" />
          </div>
          <div>
            <h1 className="gp-empty-title" style={{ margin: "0 0 8px" }}>
              Nothing on the wall yet
            </h1>
            <p>
              Posters land here the moment you download them from the Studio. They stay on this machine, in{" "}
              <span className="mono" style={{ fontSize: 12 }}>
                data/gallery/
              </span>
              .
            </p>
            <ol>
              <li>
                <span>01</span>Pick a session, driver and lap
              </li>
              <li>
                <span>02</span>Choose a poster style
              </li>
              <li>
                <span>03</span>Download PNG or SVG
              </li>
            </ol>
            <Link className="gp-btn gp-btn--primary" href="/">
              Make your first poster <ChevronRight />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gp-gallery-page">
      <div className="gp-gallery-head">
        <div>
          <h1>Gallery</h1>
          <p>
            Every poster you download is kept here, on this machine in <code>data/gallery/</code>.
          </p>
        </div>
        <span className="sp" />
        <Link className="gp-btn gp-btn--secondary" href="/">
          New poster in Studio
        </Link>
      </div>
      <div className="gp-filters" role="search" aria-label="Filter posters">
        <div className="grp" role="group" aria-label="Season">
          <span>Season</span>
          {[ALL, ...seasons.map(String)].map((s) => (
            <button key={s} type="button" className="gp-chip" aria-pressed={season === s} onClick={() => setSeason(s)}>
              {s === ALL ? "All" : s}
            </button>
          ))}
        </div>
        <span className="sep" />
        <label className="grp">
          <span>Driver</span>
          <select value={driver} onChange={(e) => setDriver(e.target.value)}>
            <option value={ALL}>All drivers</option>
            {drivers.map(([n, name]) => (
              <option key={n} value={String(n)}>
                {n} · {name}
              </option>
            ))}
          </select>
        </label>
        <span className="sep" />
        <div className="grp" role="group" aria-label="Style">
          <span>Style</span>
          {[ALL, ...styles].map((s) => (
            <button key={s} type="button" className="gp-chip" aria-pressed={style === s} onClick={() => setStyle(s)}>
              {s === ALL ? "All" : s}
            </button>
          ))}
        </div>
        <span className="count" aria-live="polite">
          {shown.length === posters.length ? `${posters.length} ${posters.length === 1 ? "poster" : "posters"} · newest first` : `${shown.length} of ${posters.length} posters`}
        </span>
      </div>
      {shown.length === 0 ? (
        <p className="gp-hint">No posters match these filters.</p>
      ) : (
        <div className="gp-grid">
          {shown.map((p) => (
            <Card
              key={p.id}
              p={p}
              onRemoved={(id) => {
                setPosters((ps) => ps.filter((x) => x.id !== id));
                router.refresh();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
