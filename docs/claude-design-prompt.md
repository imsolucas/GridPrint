Design the web interface for GRID PRINT, a local-first tool that turns one real Formula 1 lap into a print-ready A3 poster. Redesign the app around the posters; the posters themselves are already designed and are out of scope.

## What the product does
The user picks a season, a session, a driver and one lap. The app fetches real lap data from OpenF1 (a free, unofficial data source) and draws the lap as a poster: stroke colour shows speed, line width shows braking, and small ticks mark gear changes. The user picks a poster style, previews it, and downloads a print file. Every downloaded poster is kept in a local gallery.

It runs on the user's own machine. There are no accounts, payments or sharing, so don't design sign-in, pricing, profiles or social features.

## Who it's for
F1 fans who like design and print. They want a poster of a lap that mattered to them, such as a pole lap, a race-winning lap or a home Grand Prix. They care about the poster looking great on a wall and printing at the right size. Some will know print terms (bleed, crop marks, DPI) and most won't.

## Screens to design

### 1. Studio (home, `/`)
This is the main workspace and where most time is spent. It currently has a left control column and a large preview. Keep that relationship, but make it feel like a calm, premium print studio.

**Lap picker.** Four cascading choices, each depending on the one before:
- Season (2023 onwards)
- Session: about 100 per season, labelled like "2024-12-08 · United Arab Emirates · Yas Marina Circuit · Race". It needs search or grouping by Grand Prix weekend, since a flat dropdown of 100 is poor.
- Driver: about 20 per session, labelled like "55 · Carlos SAINZ (Ferrari)". The team colour is available.
- Lap: 1–70 per driver, each with a lap time like "1:30.984".
  - Mark the fastest lap and auto-select it.
  - Some laps can't be used (no lap time: out-laps, in-laps, deleted laps). Show them disabled with a short reason.
  - Pit-out laps get a small badge.
  - Consider a compact lap-time list or mini bar chart instead of a dropdown, so the fastest lap stands out.

**Style picker.** Three poster styles, each with a name and a one-line description. Show them as visual swatches or thumbnails, not plain buttons:
- Arcade Flyer: neon 80s cabinet flyer, pixel type, dark navy, magenta, cyan and yellow
- CRT Scanline: green-phosphor terminal, scanlines, amber lap time
- Pit Board: pit-wall signal board, condensed type, asphalt grey with a yellow frame

**Print options:**
- Crop marks toggle. It adds a margin outside the bleed and makes the file bigger.
- "Show trim and safe guides" toggle. These are on-screen only and never exported.
- A short, plain-language spec line that changes with the crop marks toggle: "A3 · 297 × 420 mm trim · 3 mm bleed · PNG 3579 × 5031 px at 300 DPI", or 3815 × 5268 px with crop marks.

**Export.** Download PNG is the primary action and Download SVG is secondary.
- After a download, show a success message with the filename and pixel size, plus a link to the gallery.
- Leave room for a small "How to print at actual size" helper (print at 100%, no fit-to-page, trim to 297 × 420 mm).

**Preview.** The hero of the page.
- It shows a tall A3 portrait poster (aspect ratio 303:426, including bleed) on a neutral backdrop that suggests paper or a wall, so the poster reads as a physical object.
- It should support zooming in to check detail.
- It needs designed states:
  - **Empty:** nothing picked yet.
  - **Loading:** the first fetch of a lap takes 2–15 s; later loads are instant from cache.
  - **Missing data:** "Not enough data for this lap", with the reason, plus the principle that the app never invents telemetry. Offer to try another lap.
  - **Error:** the data source can't be reached, or the export failed.

### 2. Gallery (`/gallery`)
- A grid of saved posters, each shown as a portrait thumbnail.
- Each card shows the driver, Grand Prix, session, lap number, lap time and style.
- Actions per card: SVG, PNG 300 DPI, PNG with crop marks, Remove (with confirmation).
- An empty state that sends the user to the studio to make their first poster.
- Optional: filter by season, driver or style.

### 3. Global frame
- **Header:** the GRID PRINT wordmark and navigation (Studio, Gallery).
- **Footer:** "Lap data from OpenF1. Unofficial fan project, not associated with Formula 1. Circuit outlines are traced from sampled car positions." This credit must stay visible.

## Visual direction
- **Mood:** a precise, quiet, print-shop or gallery feel. Dark UI by default so the posters glow. Think pit wall and timing screens refined into editorial design, not a busy racing game.
- **Restraint:** the posters are loud, so the interface should be restrained. Use a near-black neutral palette, one accent (currently #ff2a6d), thin rules and a strong type hierarchy.
- **Type:** pair a confident sans-serif for the UI with a monospaced or tabular face for lap times, sector times and measurements. Numbers should align.
- **Motorsport details:** use them sparingly, for example timing-screen style lap rows, sector colours (purple for personal or overall best, green, yellow), the driver's team colour as a small accent stripe, and a chequered or start-line motif at most once.
- **No official branding:** don't use F1, FIA or team logos or official marks.
- **Optional light mode:** if you include one, make it a "paper" theme.

## Layout and responsiveness
- **Desktop first:** a control rail about 340–380 px wide, with the preview taking the rest and staying in view while the controls scroll.
- **Tablet and phone:** the controls stack above the preview and the preview stays large. Downloads should be reachable without long scrolling, for example via a sticky bottom action bar on mobile.

## Accessibility
- Every control needs a visible label and visible keyboard focus.
- Body text needs at least 4.5:1 contrast.
- Loading and error states are announced to screen readers.
- Disabled laps explain why they're disabled; they're never just greyed out.

## Deliverables
1. The Studio in four states: empty, loading, ready preview with guides on, and missing data.
2. The Studio's export area after a successful download, with the print-at-actual-size helper open.
3. The Gallery, both filled and empty.
4. A mobile version of the Studio.
5. A small design system: colour tokens, type scale, spacing, and components (select or combobox, lap list row, style swatch, toggle, primary and secondary button, banner, gallery card).

Use these sample values in the designs:
- **Pole lap:** Singapore 2023 Qualifying, Carlos Sainz #55 Ferrari, lap 19, 1:30.984, sectors 26.717 / 38.499 / 25.768, top speed 315 km/h.
- **Race lap:** Abu Dhabi 2024 Race, Nico Hulkenberg #27 Haas F1 Team, lap 17, 1:29.152.
