# Plan: City-Storyline — a 2.5D interactive historical map of Prague

_Locked via grill — by Claude + philbertkong2005_
_Deadline: Monday 2026-07-27, 22:00 local. Planning started Sunday 2026-07-26._

## Goal

A single-page static web app that teaches general users and students the history of Prague
by binding events to real geography and real time. The user sees a tilted, stylized 3D map of
Prague with extruded buildings. A timeline at the bottom — segmented into named era chapters
and draggable/playable — controls which events are present on the map. Clicking an event
marker opens a compact popup anchored to the building; clicking through opens a side panel
with a 2–3 paragraph write-up, a Wikimedia Commons image gallery with attribution, and a link
to the source Wikipedia article. Events can additionally be sliced by thematic category,
found by text search, and walked through as pre-built guided tours.

Target: ~22 events spanning c. 870 CE to present, English only, desktop-first with a usable
mobile layout. Static build, no backend, deployed to GitHub Pages.

## Approach

### 1. Scaffold
- Vite + React 18 + TypeScript. Tailwind for styling. Zustand for app state. Zod for content validation.
- `maplibre-gl` v4 for the map. No other map dependency.
- Repo `City-Storyline` (public) under `philbertkong2005-oss`. Local working dir stays `C:\Users\philb\Projects\Geo-story`.

### 2. Data layer (built first — unblocks content authoring immediately)
- `src/data/schema.ts` — Zod schemas + inferred TS types for `GeoEvent`, `Era`, `Tour`.
- `src/data/eras.json` — 8 era chapters (below).
- `src/data/events.json` — ~22 events. **Claude pre-fills** `id`, `title`, `yearStart`/`yearEnd`,
  `displayDate`, `coordinates`, `category`, `era`, `wikipediaUrl`, and per-event camera framing.
  **User writes** `summary` (one sentence) and `body` (2–3 paragraphs) and selects images.
  Unwritten entries carry `body: []` and are surfaced by the validator.
- `src/data/tours.json` — 3 tours referencing event ids.
- `src/lib/repository.ts` — the backend seam:
  ```ts
  export interface ContentRepository {
    getEvents(filter?: EventFilter): Promise<GeoEvent[]>
    getEvent(id: string): Promise<GeoEvent | null>
    getEras(): Promise<Era[]>
    getTours(): Promise<Tour[]>
  }
  ```
  `StaticJsonRepository` resolves from the bundled JSON. Async by design so a future
  `HttpRepository` swaps in without touching call sites.
- `scripts/validate-content.ts`, run via `npm run validate:content` and in CI. Hard-fails on:
  coordinates outside the Prague bbox (`14.22–14.71 E`, `49.94–50.18 N`), unresolvable `era` id,
  `yearStart` outside its era's range, `yearEnd < yearStart`, referenced image file missing from
  `public/images/`, image missing `credit` or `license`, duplicate event `id`, tour referencing an
  unknown event id. Warns (does not fail) on empty `body`.

### 3. Map
- Basemap: **OpenFreeMap** vector tiles (`https://tiles.openfreemap.org/planet`), OpenMapTiles
  schema, no API key, no signup.
- Style authored in `src/lib/mapStyle.ts` as a JS object, not a hosted style URL — so the palette
  is version-controlled and reviewable. Desaturated slate/paper palette; POI icons and most
  labels suppressed; street and district labels retained at low contrast.
- `fill-extrusion` layer over the OpenMapTiles `building` source-layer using `render_height`,
  with a `coalesce` fallback to a nominal 12 m for untagged buildings so the historic centre does
  not read as flat.
- Default camera: centre `[14.4205, 50.0880]` (Staré Město), zoom 14.5, pitch 55°, bearing −20°.
- `src/lib/camera.ts` — `flyToEvent(event)` / `flyToEra(era)` wrapping `map.flyTo` with
  consistent easing and per-event overrides.
- Prague-only: `maxBounds` constrains panning so users cannot get lost in an empty world map.

### 4. Markers, popup, panel
- Markers are `maplibregl.Marker` instances with custom DOM (button elements, not divs) so they
  are focusable and keyboard-activatable. 22 markers is well inside the perf envelope for DOM markers,
  and DOM gives us CSS transitions for the timeline fade and hover states that a symbol layer cannot.
- Marker visual: category-coloured pin, `anchor: 'bottom'`, drop shadow, subtle vertical stem to
  suggest it standing in 3D space.
- Click → `EventPopup`: title, `displayDate`, one-sentence `summary`, thumbnail, "Read more →".
- "Read more" → `EventPanel` slides in from the right (~420px). Full body, image gallery with
  visible `credit` + `license` per image, category chip, era badge, Wikipedia link, and prev/next
  when a tour is active.
- Mobile (`< 768px`): panel becomes a bottom sheet; timeline collapses to a compact scrubber.

### 5. Timeline
- Bottom bar, full width. Era chapters render as labelled, coloured, snappable bands under a
  draggable playhead. Play button advances `year` on `requestAnimationFrame` at a configurable
  years-per-second, pausing at era boundaries.
- Visibility model: events **before** the playhead remain visible but dimmed; events inside the
  **current era** are full-opacity and slightly raised; events **after** the playhead are hidden.
  Scrubbing forward reads as the city accumulating its history rather than markers blinking.
- Selecting an era flies the camera to that era's framing and shows its blurb.

### 6. Filters, search, tours
- Category legend with toggles (`politics`, `conflict`, `architecture`, `culture`, `religion`,
  `disaster`, `science`). Colour-coded, matches marker colours.
- Search: case-insensitive substring match over `title` + `summary` + `body`. 22 events needs no
  index or fuzzy library. Result click flies the camera, moves the playhead to the event's year,
  and opens the panel.
- Tours: ordered `eventId[]` sequences. Entering a tour drives camera, playhead, and panel together;
  panel gains prev/next. Three tours, e.g. _Two Defenestrations and a War_, _Charles IV's Prague_,
  _1968 → 1989_.

### 7. Images
- Downloaded from Wikimedia Commons, resized to ≤1600px, committed under `public/images/`.
- Every image carries `credit`, `license`, `sourceUrl` in the JSON, and all three render in the panel.
- Public-domain and CC-BY/CC-BY-SA only. No fair-use, no unlicensed scrapes.

### 8. Deploy
- GitHub Actions workflow: on push to `main`, run `npm ci`, `npm run validate:content`,
  `npm run build`, publish `dist/` to Pages via `actions/deploy-pages`.
- `vite.config.ts` sets `base: '/City-Storyline/'` for the project-pages subpath.
- Content validation failing the build is deliberate: bad data should not reach the demo.

## Era chapters

| id | Name | Span |
|---|---|---|
| `premyslid` | Founding & the Přemyslids | 870–1306 |
| `charles` | The Golden Age of Charles IV | 1306–1419 |
| `hussite` | Hussite Prague | 1419–1526 |
| `rudolfine` | Habsburg & Rudolfine Prague | 1526–1618 |
| `white-mountain` | After White Mountain | 1618–1848 |
| `revival` | National Revival & the First Republic | 1848–1938 |
| `occupation` | Occupation & Communism | 1939–1989 |
| `velvet` | Velvet Revolution & Modern Prague | 1989–present |

~22 events distributed 2–4 per era. Coordinates verified against OSM during the build.

## Key decisions & tradeoffs

1. **OpenFreeMap over MapTiler/Mapbox.** No API key means no signup friction and no key leaking in
   a public repo. Tradeoff: it is a free community service with no SLA, and a demo-day outage or
   rate-limit would be fatal. Accepted because the alternative is a public repo containing a
   restricted token; mitigation is a documented one-line style switch to a keyed provider.

2. **DOM markers over a MapLibre symbol layer.** Symbol layers scale to thousands of points and
   render inside the GL context; DOM markers do not. At 22 events the perf difference is
   irrelevant, and DOM buys native focusability, CSS transitions, and real hover states —
   all of which the symbol layer would require reimplementing.

3. **Async repository interface despite there being no backend.** Costs a few hours of indirection
   now to make "static now, backend later" a one-file change instead of a refactor.

4. **Content authored by the user against a Zod schema, validated in CI.** The user owns editorial
   voice; the validator owns correctness. This is the only way hand-authored geodata stays sane
   under deadline pressure.

5. **Accumulating timeline (past dimmed, future hidden)** rather than a strict in-window filter.
   More legible as a narrative; costs a slightly more complex opacity model.

6. **Claude pre-fills the structural fields of `events.json`.** The user chose to write all content,
   but coordinate/date research is the slowest and least creative part and sits directly on the
   critical path. Splitting structure (Claude) from prose (user) is what makes the deadline viable.

7. **Content freeze Monday 15:00.** Anything with an empty `body` at freeze gets Claude-drafted
   prose so nothing ships blank; the user may overwrite afterwards.

8. **English only, desktop-first.** Czech and full mobile parity are explicitly deferred.

## Risks / open questions

- **Tile provider dependency.** OpenFreeMap outage or rate-limit during the demo breaks the app
  entirely. Need a decision on whether to add a fallback style/provider or accept the risk.
- **OSM building height coverage in Prague's historic core is uneven.** If too many buildings lack
  `render_height`, the 2.5D effect degrades to a uniform slab. The `coalesce` fallback helps but
  needs visual verification early, not at hour 30.
- **WebGL availability on the demo machine.** No fallback is currently planned for a browser
  without WebGL or with it blocked.
- **Coordinate accuracy.** Several events are legendary or diffuse (the Golem, the Prague Uprising)
  and have no single defensible point. Risk of asserting false precision.
- **Content is the critical path, not code.** 22 entries of prose in ~30 hours alongside everything
  else is aggressive. The 15:00 freeze plus Claude-drafted fallback is the mitigation.
- **Deadline leaves no slack for a Pages deploy failing late.** Deploy should be proven end-to-end
  early with a placeholder build, not first attempted Monday evening.
- **Historical sensitivity.** Several events (the 1893 Jewish Quarter demolition, the 1942 Heydrich
  reprisals, 1968, Jan Palach) involve real atrocity and require careful, non-sensational framing.

## Out of scope

- Georeferenced historical map overlays (explicitly deferred to v2; the layer system should not
  preclude them but nothing will be built).
- Czech or any other localisation.
- User accounts, saved tours, bookmarks, progress tracking.
- Any CMS or teacher-authoring UI.
- Backend, database, or authentication of any kind.
- Full mobile parity — mobile is "usable", not co-equal.
- Any city other than Prague.
- Live Wikipedia fetching at runtime.
