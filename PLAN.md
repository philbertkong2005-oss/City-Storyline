# Plan: City-Storyline — a 2.5D interactive historical map of Prague

_Locked via grill (Act 1), hardened by Codex adversarial review (Act 2)._
_Hard deadline: **2026-07-27 22:00**, user's local time._

**Two clocks, and they are not interchangeable.**
`T+n` = hours of *elapsed build effort* from plan lock. These are duration estimates and assume work
starts immediately at lock; if the start slips, every `T+n` slips with it.
`D−n` = hours *before the absolute deadline*. These are the binding decision gates. They do not move.
If the build starts late, `T+n` estimates are recomputed against the `D−n` gates — not the reverse.
Every cut-line and the content freeze below is stated in `D−n` for exactly this reason.

## Goal

A single-page static web app that teaches general users and students the history of Prague by
binding events to real geography and real time. The user sees a tilted, stylized 3D map of Prague
with extruded buildings. A timeline at the bottom — segmented into named era chapters and
draggable — controls which events are present on the map. Clicking an event marker opens a compact
popup anchored to the building; clicking through opens a side panel with a 2–3 paragraph write-up,
a Wikimedia Commons image gallery with full attribution, and a link to the source Wikipedia article.

Target: ~22 events spanning c. 870 CE to present, English only, desktop/tablet, static build on
GitHub Pages at `https://philbertkong2005-oss.github.io/City-Storyline/`.

## Priority ladder — the cut-lines are the plan

The single biggest risk is scope. Features ship in this order and are abandoned in reverse order
the moment a cut-line is reached. Nothing below a cut-line is started until everything above it works.

| Tier | Contents | Cut-line |
|---|---|---|
| **T0 — must ship** | Map + extrusions + camera, 22 markers, popup, side panel, era chapters, manual timeline scrubber, **map-failure list view**, live Pages deploy | none — without this there is no product |
| **T1 — strongly wanted** | Category filter, text search | abandoned if T0 is not done by **D−16h** |
| **T2 — nice to have** | Timeline autoplay, guided tours | abandoned if T1 is not done by **D−12h** |
| **T3 — polish** | Phone-specific presentation of the list view, keyboard nav, reduced-motion, empty states | abandoned if T2 is not done by **D−8h** |

The **list view is T0, not polish**. It is the mandatory escape hatch that makes the OpenFreeMap and
WebGL risks survivable; filing it as polish would have let the one mitigation be cut by the very
time pressure it exists to protect against. Only its phone-specific styling is T3.

The user selected search, tours, and autoplay during scoping, so they are not being cut
pre-emptively — but they are explicitly the first things to go, and the user is told at each cut-line
rather than discovering it at 22:00.

## Approach

### Milestone 1 — deploy first, before any features (T+0 → T+1)
Deliberately inverted from the usual order, because "blank page discovered at hour 24" is the
worst realistic outcome.
- Vite + React 18 + TypeScript + Tailwind scaffold.
- `vite.config.ts` sets `base: '/City-Storyline/'`.
- GitHub Actions workflow → `actions/deploy-pages`.
- **Exit criterion: a placeholder page is live on the real Pages URL and loads in a browser.**
- Same milestone: render a bare MapLibre map with OpenFreeMap tiles and confirm building
  extrusions actually appear over Prague's historic core. If OSM `render_height` coverage is too
  sparse to read as 2.5D, that is discovered at hour 1, not hour 20.

### Milestone 2 — data layer (T+1 → T+2), unblocks the user immediately
- `src/data/schema.ts` — Zod schemas + inferred types.
- `src/data/eras.json` — 8 chapters, **half-open intervals** (see Decisions #2).
- `src/data/events.json` — ~22 events, structurally pre-filled by Claude, prose written by user.
- `src/data/tours.json` — 3 tours (T2 tier).
- `src/lib/repository.ts` — thin async seam (see Decisions #7).
- `scripts/validate-content.ts` → `npm run validate:content`, wired into CI ahead of `build`.
  **Hard-fails on:** coordinates outside the Prague bbox (`14.22–14.71 E`, `49.94–50.18 N`);
  unresolvable `era` id; `yearStart` outside its era's half-open range; `yearEnd < yearStart`;
  **`yearStart` or `yearEnd` later than the current year** — no future-dated events, since a typo like
  `2205` would otherwise silently stretch the timeline's computed right edge instead of failing loudly;
  a referenced image missing from `public/images/`, or over 300 KB or 1600px; any missing image
  attribution field; any URL failing the HTTPS + host allowlist; duplicate event `id`; a tour
  referencing an unknown event id; era ranges that do not tile contiguously.
  **Warns (does not fail) on:** empty `body`, so authoring progress is visible at a glance.
- **Exit criterion: `events.json` handed to the user so prose writing runs in parallel with the build.**

### Milestone 3 — map, markers, panel (T+2 → T+6)
- `src/lib/mapStyle.ts` — style as a version-controlled JS object, not a hosted URL. Desaturated
  slate/paper palette, POI icons suppressed, low-contrast street/district labels retained.
- `fill-extrusion` over the OpenMapTiles `building` source-layer on `render_height`, with
  `coalesce` fallback to 12 m so untagged buildings still have mass.
- Camera: centre `[14.4205, 50.0880]`, zoom 14.5, pitch 55°, bearing −20°, `maxBounds` locked to Prague.
- Markers are `maplibregl.Marker` with `<button>` DOM — focusable, keyboard-activatable, CSS-transitionable.
- Popup → panel, as described in Goal.

### Milestone 4 — timeline (T+6 → T+9)
Manual scrubber and era bands only. Autoplay is T2 and comes later or not at all.

### Milestone 5 onward — T1, then T2, then T3, gated by the cut-lines above.

### Content freeze — **D−11h**
Any event with an empty `body` at freeze gets Claude-drafted prose so nothing ships blank.
The user may overwrite any of it afterwards. This gate is absolute: it does not move if the build
started late, because the whole point is reserving enough runway to write the fallback prose.

## Key decisions & tradeoffs

1. **Deploy is milestone 1, not the last step.** Costs ~45 minutes up front; removes the single
   most likely catastrophic failure (deploy broken, discovered too late to fix).

2. **Era ranges are half-open `[yearStart, yearEnd)`, and the final era is open-ended.** The original
   table double-claimed 1306, 1419, 1526, 1618, 1848 and 1989. The validator now asserts
   `eras[n].yearEnd === eras[n+1].yearStart` and assigns events by
   `yearStart >= era.yearStart && yearStart < era.yearEnd`, so boundary years have exactly one owner.
   The last era carries `yearEnd: null`, meaning unbounded — membership degrades to `yearStart >= start`
   and the timeline's right edge is computed at runtime from `max(currentYear, maxEventYear)`. Hard-coding
   `2027` would have been silent date rot for no product gain.

3. **One authoritative navigation state machine.** Camera flights, scrubber drags, autoplay ticks,
   search jumps, marker clicks and tour steps all mutate the same navigation state and would
   otherwise race — autoplay fighting a user's drag, a tour step landing mid-flyTo. Rules:
   - Store holds `navigation: { mode: 'idle' | 'playing' | 'tour', year, selectedEventId, flightToken }`.
   - Any *manual* interaction (drag, marker click, search result, era click) sets `mode: 'idle'`,
     cancelling playback and exiting tour mode before applying its own effect.
   - Every `flyTo` carries an incrementing `flightToken`; a completion callback whose token is stale
     is discarded. Prevents an old flight's `moveend` clobbering a newer selection.
   - Autoplay advances via `requestAnimationFrame` with elapsed-time deltas, never a fixed
     per-frame increment, so playback speed is frame-rate independent.

4. **OpenFreeMap retained, but the app degrades instead of dying.** Codex argued for switching to a
   provider verifiable today. Rejected as stated — a keyed provider means either a token committed
   to a public repo or a build-secret pipeline, both of which cost more than they buy here. Instead:
   - Milestone 1 proves tiles load *on the real Pages URL*, not just localhost.
   - A single `TILE_SOURCE` constant makes swapping providers a one-line change, documented in the README.
   - The app falls back to a **list view** of all events with fully working panels. This is T0.

   **Degradation triggers — health checks, not just constructor failure.** A tile outage or rate-limit
   usually yields a map that constructs successfully and then renders a blank canvas, so
   "did `new maplibregl.Map()` throw" is far too narrow a test. `useMapHealth` declares the map
   unusable and switches to list view on any of:
   - `maplibregl.supported()` returns false, or the constructor throws.
   - No `styledata` event within **5 s** of construction (style URL unreachable or unparseable).
   - No `idle` event within **10 s** of construction (tiles never finished loading).
   - Three or more `error` events whose `error.status` is `>= 400` or whose `sourceId` is the tile
     source, within the first 10 s.

   The switch is one-way per session and surfaces a dismissible banner explaining that the map could
   not load, so a blank canvas is never presented as if it were the product.

5. **Full CC attribution, not just `credit` + `license`.** CC-BY/CC-BY-SA require attributing the
   author, naming the work, linking the licence, and noting modifications. Image schema is:
   `{ src, alt, caption, author, title, license, licenseUrl, sourceUrl, modified }`, all required,
   all rendered in the panel. Public-domain images are preferred where a choice exists.

6. **Hard URL validation and safe rendering.** `wikipediaUrl`, `sourceUrl` and `licenseUrl` must be
   HTTPS and must match an allowlist of `*.wikipedia.org`, `*.wikimedia.org`, `commons.wikimedia.org`,
   `creativecommons.org`. Validator hard-fails otherwise. All outbound links render with
   `target="_blank" rel="noopener noreferrer"`.

7. **The async repository seam is kept, but thinned.** Codex called it speculative architecture under
   deadline pressure. Rejected: "static now, backend later" was a priced decision the user made
   deliberately after being shown the alternative, and the cost is one ~40-line file. However, the
   critique lands partially — filtering logic is removed from the repository and lives in the store as
   pure selectors, so the seam is a plain fetch boundary and nothing more.

8. **Honest geodata: `locationPrecision` is a required field.** A Prague bounding-box check only
   catches absurd errors. Several events are legendary (Libuše's prophecy), diffuse (the Prague
   Uprising), or off-site (Hus was burned in Konstanz). Every event carries
   `locationPrecision: 'exact' | 'approximate' | 'area'` plus an optional `locationNote`.
   Non-exact markers render with a dashed ring and the panel states the caveat. For an educational
   tool, asserting false precision is a correctness bug, not a cosmetic one.

9. **Enforced image performance budget.** ≤1600px on the long edge **and ≤300 KB per file**, validator
   hard-fails on both, `loading="lazy"` on every gallery image, one hero image per event eagerly loaded.

10. **Support narrowed to desktop and tablet (≥768px).** A pitched 3D map, a scrubber and a bottom
    sheet on a 375px phone is a separate UX problem, not a media query. Below 768px the app serves the
    same list view as the map-failure fallback: chronological, era-grouped, fully readable, no map.
    This is what "mobile usable" honestly means at this budget.

11. **Content authored by the user against a validated schema.** The user owns editorial voice; the
    validator owns correctness. Warnings (not failures) on empty `body` so progress is visible at a glance.

12. **Validation gates the build.** CI runs `validate:content` before `build`; bad data cannot reach
    the demo.

## Era chapters (half-open intervals)

| id | Name | `[start, end)` |
|---|---|---|
| `premyslid` | Founding & the Přemyslids | [870, 1306) |
| `charles` | The Golden Age of Charles IV | [1306, 1419) |
| `hussite` | Hussite Prague | [1419, 1526) |
| `rudolfine` | Habsburg & Rudolfine Prague | [1526, 1618) |
| `white-mountain` | After White Mountain | [1618, 1848) |
| `revival` | National Revival & the First Republic | [1848, 1939) |
| `occupation` | Occupation & Communism | [1939, 1989) |
| `velvet` | Velvet Revolution & Modern Prague | [1989, →) — `yearEnd: null` |

~22 events, 2–4 per era. Coordinates verified against OSM during Milestone 2.

## Risks / open questions

- **Content is the critical path, not code.** ~22 entries of prose in ~25 hours alongside everything
  else is the tightest constraint in the project. Mitigations: structural fields pre-filled, T+14
  freeze, Claude-drafted fallback prose, validator warnings showing progress.
- **OpenFreeMap has no SLA.** Mitigated by the Milestone-1 proof, the one-line provider swap, and the
  list-view degradation — but a mid-demo outage still costs the map. Accepted knowingly.
- **OSM building-height coverage in the historic core may be uneven.** Proven or disproven at T+1.
  **Decision rule fixed in advance:** if fewer than ~60% of buildings in the Staré Město viewport carry
  a usable `render_height`, we ship a **flat map with tinted building footprints and markers, and drop
  the 2.5D claim entirely** for that path. We do not attempt to rescue it with camera pitch — pitch
  without varying geometry produces perspective, not depth — and we do not add a DEM/terrain source,
  which is a whole additional data dependency this budget cannot absorb.
- **Historical sensitivity.** The 1893 Jewish Quarter demolition, the 1942 Heydrich reprisals
  (Lidice), 1968, and Jan Palach involve real atrocity and require careful, non-sensational framing.
  Applies to both user-written and Claude-drafted fallback prose.
- **Timezone ambiguity in the deadline.** "Monday 22:00" is assumed to be the user's local time.
  Hour-offset milestones make this non-fatal, but it should be confirmed.

## Out of scope

- Georeferenced historical map overlays (deferred to v2).
- Czech or any other localisation.
- User accounts, saved tours, bookmarks, progress tracking.
- Any CMS or teacher-authoring UI.
- Backend, database, or authentication.
- Phone-optimised map interaction — phones get the list view.
- Any city other than Prague.
- Live Wikipedia fetching at runtime.
