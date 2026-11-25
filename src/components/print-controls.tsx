"use client";

import { ChevronRight, Close, ErrorIcon, Ok } from "./icons";
import type { TemplateInfo } from "./types";

/** Palette dots and thumbnails for each poster template (thumbnails are real renders of the sample lap). */
const STYLE_ART: Record<string, { thumb: string; dots: string[] }> = {
  "arcade-flyer": { thumb: "/styles/arcade-flyer.webp", dots: ["#0d0a26", "#ff2a6d", "#05d9e8", "#ffd319"] },
  "crt-scanline": { thumb: "/styles/crt-scanline.webp", dots: ["#020502", "#39ff7a", "#1f9a4a", "#ffb000"] },
  "pit-board": { thumb: "/styles/pit-board.webp", dots: ["#26262a", "#0b0b0c", "#ffd400", "#f5f5f0"] },
};

export function StylePicker({ templates, value, onChange }: { templates: TemplateInfo[]; value: string; onChange: (id: string) => void }) {
  const current = templates.find((t) => t.id === value);
  const ids = templates.map((t) => t.id);
  function onKey(e: React.KeyboardEvent) {
    const i = ids.indexOf(value);
    let n = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % ids.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + ids.length) % ids.length;
    if (n < 0) return;
    e.preventDefault();
    onChange(ids[n]);
    requestAnimationFrame(() => (document.querySelector(`[data-style="${ids[n]}"]`) as HTMLElement | null)?.focus());
  }
  return (
    <>
      <div className="gp-swatches" role="radiogroup" aria-label="Poster style" onKeyDown={onKey}>
        {templates.map((t) => {
          const art = STYLE_ART[t.id];
          return (
            <div
              key={t.id}
              data-style={t.id}
              className="gp-swatch"
              role="radio"
              aria-checked={t.id === value}
              aria-label={`${t.name}: ${t.description}`}
              tabIndex={t.id === value ? 0 : -1}
              onClick={() => onChange(t.id)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  onChange(t.id);
                }
              }}
            >
              <div className="thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {art ? <img src={art.thumb} alt="" /> : null}
              </div>
              <span className="nm">{t.name}</span>
              {art && (
                <span className="dots" aria-hidden="true">
                  {art.dots.map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {current && (
        <p className="gp-swatch-desc">
          <b>{current.name}.</b> {current.description}
        </p>
      )}
    </>
  );
}

export function Toggle({ title, sub, checked, onChange }: { title: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="gp-toggle" onClick={() => onChange(!checked)}>
      <span className="tx">
        <strong>{title}</strong>
        <span>{sub}</span>
      </span>
      <button
        type="button"
        className="gp-switch"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
      />
    </div>
  );
}

/** Pixel sizes at 300 DPI from paper.ts: 303 × 426 mm with bleed, 323 × 446 mm with the crop-mark slug. */
export const PNG_SIZE = { plain: "3579 × 5031", crop: "3815 × 5268" } as const;

export function SpecLine({ crop }: { crop: boolean }) {
  return (
    <dl className="gp-spec" aria-live="polite">
      <div>
        <dt>Paper</dt>
        <dd>A3 portrait</dd>
      </div>
      <div>
        <dt>Trim</dt>
        <dd>297 × 420 mm</dd>
      </div>
      <div>
        <dt>Bleed</dt>
        <dd>3 mm</dd>
      </div>
      <div className="px">
        <span>
          PNG <b>{crop ? PNG_SIZE.crop : PNG_SIZE.plain} px</b> at 300 DPI
        </span>
        {crop ? <span className="chg">+ crop marks</span> : <span className="muted">SVG: vector</span>}
      </div>
    </dl>
  );
}

export function PrintHelp({ open, onToggle }: { open: boolean; onToggle: (open: boolean) => void }) {
  return (
    <details className="gp-help" open={open} onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        <ChevronRight />
        How to print at actual size<span className="r">A3</span>
      </summary>
      <ol>
        <li>
          <div>
            <b>Print at 100 %</b>
            <span>Choose “Actual size” in the print dialog.</span>
          </div>
        </li>
        <li>
          <div>
            <b>Turn off “Fit to page”</b>
            <span>Any scaling shrinks the poster and breaks the 3 mm bleed.</span>
          </div>
        </li>
        <li>
          <div>
            <b>Trim to 297 × 420 mm</b>
            <span>Cut on the crop marks. The bleed falls away.</span>
          </div>
        </li>
      </ol>
      <p className="note">
        Using a print shop? Send the <b>PNG with crop marks</b> and say “A3, 3 mm bleed, no scaling”.
      </p>
    </details>
  );
}

export type Notice = { kind: "ok"; file: string; pixels: string | null } | { kind: "err"; text: string };

export function NoticeBanner({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  if (notice.kind === "ok") {
    return (
      <div className="gp-banner gp-banner--ok" role="status">
        <Ok />
        <div>
          <strong>Poster saved</strong>
          {notice.pixels && <span className="px">{notice.pixels}</span>}
          <span className="file">{notice.file}</span>
        </div>
        <a href="/gallery">Gallery →</a>
      </div>
    );
  }
  return (
    <div className="gp-banner gp-banner--err" role="alert">
      <ErrorIcon />
      <div>
        <strong>Export failed</strong>
        {notice.text} Your preview is fine; try again or download the SVG.
      </div>
      <button type="button" className="x" aria-label="Dismiss" onClick={onDismiss}>
        <Close />
      </button>
    </div>
  );
}
