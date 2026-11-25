# GRID PRINT

Print-ready A3 posters of real Formula 1 laps, generated locally from [OpenF1](https://openf1.org) data.

Each poster traces one lap from the car's sampled positions. Stroke colour shows speed, stroke width shows braking, and small ticks mark gear changes (upshifts on one side of the line, downshifts on the other). The circuit outline comes from sampled car positions, so it's an artistic interpretation and not a surveyed track map.

- Next.js App Router and TypeScript, running entirely on your machine
- Free: no paid APIs, no accounts, no cloud services
- Exports SVG, or PNG at 300 DPI (with a pHYs chunk so print dialogs read the true size)
- Three templates: **Arcade Flyer**, **CRT Scanline** and **Pit Board**

> Unofficial fan project, not associated with Formula 1 or the FIA. Lap data comes from OpenF1, which is also unofficial.

## Local setup

You need Node 20 or later (developed on Node 24).

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3456. The port is pinned to 3456 in `package.json` so it doesn't clash with other local projects; change both `dev` and `start` scripts to move it. The studio opens on the known-good starter lap: Singapore 2023 qualifying, Carlos Sainz, lap 19 (1:30.984, pole).

Other scripts:

| Command | What it does |
| --- | --- |
| `npm test` | Vitest: timestamp alignment, page and export dimensions, crop-mark placement, real PNG size and DPI |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run render:sample` | Renders every template from the bundled fixture into `out/`, with no network. Add `-- --crop-marks` for crop-mark versions. |
| `npm run build && npm start` | Production build |

### Environment variables (all optional)

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENF1_BASE_URL` | `https://api.openf1.org/v1` | API base |
| `OPENF1_OFFLINE` | unset | `1` = serve from the cache only and never touch the network |
| `GRIDPRINT_CACHE_DIR` | `data/cache/openf1` | Response cache |
| `GRIDPRINT_GALLERY_DIR` | `data/gallery` | Saved posters |
| `GRIDPRINT_FONT_DIR` | `assets/fonts` | Fonts used for text-to-path |

## How it works

```
OpenF1 ──► data/cache (JSON) ──► align by timestamp ──► {x,y,speed,brake,gear,t}
        ──► fit to A3 + centripetal Catmull-Rom ──► speed/brake segments + gear ticks
        ──► template (pure fn → SVG string) ──► compose (bleed clip, crop marks)
        ──► SVG download  |  resvg ──► PNG @ 300 DPI
```

| Path | Role |
| --- | --- |
| `src/lib/openf1/client.ts` | Fetching, throttling, 429 retry and the disk cache |
| `src/lib/data/load.ts` | Which endpoints to call. Telemetry is requested only for the lap's time window plus 2 s. |
| `src/lib/data/align.ts` | Selects the lap window and aligns location with car_data by timestamp |
| `src/lib/data/lap-data.ts` | Builds the poster metadata (driver, circuit, lap time, date, credit) |
| `src/lib/geometry/*` | Page model, fitting, smoothing and the track artwork |
| `src/lib/text/*` | Converts text to SVG paths with opentype.js |
| `src/lib/templates/*` | The templates, the shared legend and credit, and document composition |
| `src/lib/export/png.ts` | resvg rendering, exact pixel size and DPI metadata |
| `src/lib/gallery/store.ts` | Local poster storage |

### Data rules

- **Lap window:** from the lap's `date_start` to `date_start + lap_duration`. If either is missing, the lap can't be selected in the picker, and the API returns a `422` with the reason.
- **Alignment:** location is the base clock. Speed is linearly interpolated between the two nearest car_data samples, but only when both are within 1 s. Brake and gear are step-held from the latest sample at or before that time, because they are discrete states and are never interpolated. Arrays are never paired by index.
- **No invented telemetry:** if no real sample is close enough, the value is `null`. That stretch is drawn as a dashed grey line, and the legend gets a "no telemetry" key. `(0,0,0)` position rows are OpenF1 placeholders and are dropped.
- **Timestamps:** OpenF1 uses microsecond fractions, and some rows have no fraction at all. `parseOpenF1Date` handles both explicitly instead of relying on engine-specific `Date.parse` behaviour.

### Geometry

- Units are millimetres throughout. The SVG `viewBox` is the full physical document.
- Positions are flipped to y-down and auto-rotated in 5° steps to fill the template's track box. Near-duplicates are removed, then the points are densified with **centripetal** Catmull-Rom. Unlike uniform Catmull-Rom, that variant doesn't form cusps or loops within a segment, and its overshoot stays small at roughly 20 m sample spacing.
- Speed is split into 18 colour bins. Brake (0 or 100 in OpenF1) is eased over about 3 mm of path and split into 4 width steps, so braking zones taper instead of stepping.

## Caching

Every OpenF1 response is stored in `data/cache/openf1/<endpoint>-<sha1(url)>.json` with its URL and fetch time.

- The cache key is the **full request URL**, so different filters never collide.
- Data for completed sessions never expires. The season session list expires after 6 hours, so new sessions show up.
- Only non-empty array responses are cached. Errors and empty results aren't stored, because an empty result is often just data that hasn't been ingested yet.
- Requests are serialised with a gap of at least 400 ms, and HTTP 429 responses are retried with backoff.
- To work offline, load the laps you want once, then run with `OPENF1_OFFLINE=1`.
- To clear the cache, delete `data/cache/`.

OpenF1's free tier covers historical data from 2023 onwards. The picker only lists sessions that ended at least an hour ago.

## Page, bleed and export dimensions

| | Size (mm) | PNG at 300 DPI (px) |
| --- | --- | --- |
| Trim (finished A3) | 297 × 420 | n/a |
| Export with 3 mm bleed (default) | 303 × 426 | **3579 × 5031** |
| Export with bleed and crop marks (10 mm slug) | 323 × 446 | **3815 × 5268** |

- Pixel size is `round(mm / 25.4 × 300)`, applied to the **full** document: bleed plus any crop-mark slug. `exportPixelSize()` in `src/lib/geometry/paper.ts` is the single source of truth, and the PNG exporter checks the rendered IHDR against it.
- Safe margin: 12 mm inside the trim. All text and the track stay inside it.
- Crop marks start 2 mm beyond the bleed edge, so they never overlap the trim area or the artwork. A test checks this.
- The SVG root is sized in mm (`width="303mm" height="426mm"`), and the trim box is recorded as `data-trim` plus an invisible `#gp-trim` rect.
- All text is converted to paths, so SVG, preview and PNG match exactly without installed fonts. The fonts are SIL OFL 1.1: Press Start 2P, VT323, Bebas Neue and Space Mono. Their licences are in `assets/fonts/`.

## Printing at actual size

1. Download the **PNG**, which carries 300 DPI metadata, or the **SVG**, which is sized in millimetres.
2. In the print dialog, choose **Actual size / 100% / Scale: none**. Turn off "Fit to page", "Shrink oversized pages" and "Auto-rotate and centre".
3. **At a print shop:** send the bleed file (303 × 426 mm), or the crop-mark version, and ask for it to be trimmed to A3 at 297 × 420 mm.
4. **On a home A3 printer:** most can't print to the edge. Print the bleed version at 100% and trim along the crop marks, or accept a white border. Never scale it down to fit.
5. **To check:** the printed trim box should measure exactly 297 × 420 mm. If it doesn't, something scaled the file.

The preview's magenta (trim) and cyan (safe) guides appear only on screen and are never exported.

## Adding a template

A template is a pure function from lap data, metadata and fonts to an SVG fragment drawn in **trim coordinates**: (0, 0) is the top-left of the finished sheet, measured in mm.

1. Create `src/lib/templates/my-style.ts`:

   ```ts
   import { trackArt, type TrackStyle } from "../geometry/track";
   import { textPath } from "../text/text";
   import { credit, legend } from "./legend";
   import type { PosterTemplate } from "./types";

   const style: TrackStyle = {
     palette: ["#223", "#69f", "#fff"], // slow → fast
     noDataColour: "#555", width: 1.6, brakeWidth: 4.2,
     tickColour: "#fff", tickLength: 2.2, tickWidth: 0.35, startColour: "#fff",
   };

   export const myStyle: PosterTemplate = {
     id: "my-style",
     name: "My Style",
     description: "One line for the style picker.",
     render({ data, fonts, trimW: W, trimH: H, bleed: b, safe: s }) {
       const m = data.meta;
       const art = trackArt(data.samples, { x: s, y: 80, w: W - 2 * s, h: 240 }, style);
       return [
         `<rect x="${-b}" y="${-b}" width="${W + 2 * b}" height="${H + 2 * b}" fill="#111"/>`, // full bleed
         textPath(fonts.condensed, m.driverName.toUpperCase(), { x: s, y: 50, size: 24, fill: "#fff" }),
         textPath(fonts.mono, `${m.circuit} · ${m.lapTime} · ${m.sessionDate}`, { x: s, y: 62, size: 4, fill: "#fff" }),
         art.svg,
         legend({ x: s, y: 340, width: W - 2 * s, font: fonts.mono, text: "#fff", muted: "#999", style, art }),
         credit(fonts.mono, m.credit, s, H - s - 2, W - 2 * s, "#999").svg,
       ].join("");
     },
   };
   ```

2. Register it in `src/lib/templates/index.ts` by adding it to `TEMPLATES`.
3. Run `npm run render:sample` and check `out/my-style.png`. `npm test` automatically checks that every registered template renders text as paths.

Every template needs: a full-bleed background (extend to `-b`), the driver, circuit, lap time and session date, the legend, and the data credit. Keep text at least 3 mm tall (credit 2.5 mm) and inside the safe box. Don't use `<text>` or blur filters: text must be paths, and blurs are slow at 18 MP. To add a font, put an OFL TTF and its licence in `assets/fonts/` and add it to `FILES` in `src/lib/text/fonts.ts` and to `FontKey`.

## API

| Route | Purpose |
| --- | --- |
| `GET /api/sessions?year=` | Completed sessions |
| `GET /api/drivers?session_key=` | Drivers |
| `GET /api/laps?session_key=&driver_number=` | Laps, with `usable` and a `reason` when not usable |
| `GET /api/poster?session_key=&driver_number=&lap_number=&template=&crop=1&format=svg\|png&download=1&guides=1` | Renders a poster. `download=1` sends it as an attachment and `save=1` also stores it in the gallery (the studio's download buttons do both). |
| `GET/POST /api/gallery`, `DELETE /api/gallery/:id`, `GET /api/gallery/:id/(poster.svg\|thumb.png)` | Local gallery |

Error responses are `{ error: { code, message } }`:

- `422`: missing data (`lap-duration-missing`, `no-location-data`, `no-car-data` and so on)
- `502`: OpenF1 is unreachable
- `500`: export failure

## Not in v1

There's no authentication, payments, cloud deployment or paid data source.
