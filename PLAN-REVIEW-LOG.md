# Plan Review Log: City-Storyline — 2.5D interactive historical map of Prague

Act 1 (grill) complete — plan locked with the user. MAX_ROUNDS=3.

Reviewer: OpenAI Codex, model `gpt-5.4`, `model_reasoning_effort = "high"` (CLI config default,
unpinned on the command line), codex-cli 0.143.0. Read-only sandbox every round.

## Act 1 — what the grill settled

Four rounds of scoping questions resolved, in order:

- **Scope** — one region, all of history → narrowed by the user to **Prague only**, c. 870 CE to present.
- **"2.5D"** — tilted real map (MapLibre GL) with extruded buildings, not illustrated isometric art
  and not a Three.js globe.
- **Content source** — curated JSON derived from Wikipedia/Wikimedia Commons, not live API fetching.
- **Build target** — static site now, with a repository interface so a backend can slot in later.
- **Timeline UX** — draggable scrubber *and* named era chapters, combined.
- **Slicing** — thematic categories, text search, and curated guided tours (all three).
- **Art direction** — stylized monochrome basemap with extruded buildings, era-neutral palette.
- **Size** — 15–25 events; settled at ~22 across 8 era chapters.
- **Historical map overlays** — rejected for v1, modern basemap only.
- **Audience** — English only, desktop-first with a usable mobile layout.
- **Authoring** — user writes all prose; Claude pre-fills structural fields (ids, dates,
  coordinates, eras, categories, Wikipedia URLs).
- **Stack** — React + TypeScript + Vite.
- **Images** — downloaded from Commons and bundled locally with per-image attribution.
- **Deploy** — GitHub Pages auto-deploy from a public repo `City-Storyline`.
- **Deadline** — Monday 2026-07-27 22:00, with a 15:00 content freeze and Claude-drafted fallback
  prose for any entry still empty.

Open risks carried into Act 2: free-tier tile provider with no SLA, uneven OSM building-height
coverage in the historic core, no WebGL fallback, false precision on legendary/diffuse events,
and content authoring sitting on the critical path.

---

## Round 1 — Codex

- High: PLAN.md describes a v1 too wide for a solo ship by the deadline: autoplay timeline, tours, search, custom mobile UI, 22 entries of prose, image curation, and Pages deploy are too many concurrent critical paths. Fix: cut tours, autoplay, and custom mobile behavior now; ship desktop-only manual scrubbing plus marker/panel.
- High: Stale timing assumptions — the plan speaks from Sunday and depends on a Monday 15:00 content freeze. Fix: rebaseline to "ship by 2026-07-27 22:00, freeze content immediately, build only what is required."
- High: Schema conflict — era ranges overlap on boundary years 1306, 1419, 1526, 1618, 1848, 1989, so validation can accept ambiguous assignments. Fix: make era ranges half-open or define inclusive/exclusive boundaries explicitly in schema and validator.
- High: Unplanned state/race problem — flyTo, RAF playback, search result jumps, marker clicks, and tour prev/next all mutate navigation with no cancellation or priority rules. Fix: define one authoritative navigation state machine and cancel playback/tours before any manual selection, or cut autoplay/tours entirely.
- High: Knowingly accepts a fatal single-point dependency on OpenFreeMap with no tested fallback. Fix: switch to a provider verifiable on GitHub Pages today, or ship a static non-map fallback.
- Medium: Under-specifies image attribution for CC-BY/CC-BY-SA; `credit` and `license` alone may not satisfy author/title/licence-link requirements. Fix: restrict v1 to public domain, or require `author`, `title`, `licenseUrl`, `sourceUrl`, `modified` and render them.
- Medium: Treats outbound URLs from JSON as trusted; validator does not hard-fail missing/invalid `sourceUrl` and nothing constrains link hosts. Fix: hard-validate as HTTPS on a Wikimedia/Wikipedia allowlist and render with `rel="noopener noreferrer"`.
- Medium: Overstates geodata safety — a bounding-box check catches only absurd errors and does nothing about false precision for legendary or area-wide events. Fix: add `locationPrecision` and `locationNote`, visually mark approximate events or drop them.
- Medium: No real performance budget; "<=1600px" still allows multi-megabyte images. Fix: enforce per-image byte caps plus lazy loading.
- Medium: Speculative architecture under deadline pressure — the async repository seam buys nothing for a static JSON app shipping today. Fix: use direct JSON imports behind a tiny sync data module; defer the abstraction.
- Medium: WebGL and deploy are named as risks with no user-visible fallback or early smoke-test milestone; likely failure mode is "blank app discovered late." Fix: make the first milestone a live Pages deploy plus WebGL check, and keep the event list/panel usable if map init fails.
- Medium: Still carries meaningful mobile work despite mobile parity being out of scope. Fix: narrow v1 to desktop/tablet; phones fall back to a read-only list or static map view.

VERDICT: REVISE

### Claude's response — 11 accepted, 1 rejected, 2 modified

**Accepted in full.**
- *Era boundary overlap.* Correct and a real bug. Eras are now half-open `[start, end)`; the validator asserts `eras[n].yearEnd === eras[n+1].yearStart` and assigns by `yearStart >= start && yearStart < end`. Also corrected `revival` to end 1939 rather than 1938, which had left a one-year gap.
- *Navigation race.* The strongest finding. Added an explicit navigation state machine: a single `navigation` slice, manual interaction forcibly returns `mode` to `idle` before applying its effect, every `flyTo` carries an incrementing `flightToken` so stale `moveend` callbacks are discarded, and autoplay uses elapsed-time deltas rather than per-frame increments.
- *Deploy-first / map-failure fallback.* Adopted. Milestone 1 is now a live Pages deploy plus an extrusion-coverage check, before any feature work. If MapLibre fails to construct for any reason the app renders a full list view with working panels, so content survives the map dying. This covers the WebGL risk too.
- *CC attribution.* Correct — `credit` + `license` does not satisfy CC-BY/BY-SA. Image schema now requires `author`, `title`, `license`, `licenseUrl`, `sourceUrl`, `modified`, all rendered.
- *URL validation.* Adopted. HTTPS + host allowlist (`*.wikipedia.org`, `*.wikimedia.org`, `creativecommons.org`), hard-fail in the validator, `rel="noopener noreferrer"` on all outbound links.
- *False precision.* Good finding and a correctness issue for an educational tool. Added required `locationPrecision: 'exact' | 'approximate' | 'area'` and optional `locationNote`; non-exact markers render with a dashed ring and the panel states the caveat.
- *Image budget.* Adopted. ≤1600px **and** ≤300 KB, both validator-enforced, `loading="lazy"` on gallery images.

**Modified.**
- *Scope too wide (High).* The risk is real but the remedy overreaches: search, tours and autoplay were features the user explicitly selected during scoping, and unilaterally deleting them substitutes the reviewer's judgement for the user's. Instead the plan now carries an explicit **priority ladder with hard cut-lines at T+9 / T+13 / T+17**, ordered so tours and autoplay are the first things to die. Same protection, and the user is told at each cut-line rather than at 22:00.
- *Stale timing (High).* Partly a misread — Codex's sandbox clock showed Monday UTC while the user's local date is Sunday, so the 15:00 freeze had not in fact passed. But the underlying point stands: the original 34-hour budget was wrong. Rebaselined to ~25 hours and every milestone restated as a `T+n` hour-offset so the schedule is timezone- and start-time independent.
- *OpenFreeMap (High).* Agreed on the risk, rejected on the remedy. Switching to a keyed provider means either committing a token to a public repo or building a secret-injection pipeline, both of which cost more than they buy at this budget. Instead: prove tiles load **on the real Pages URL** at Milestone 1, isolate the provider behind a one-line `TILE_SOURCE` constant, and degrade to the list view if tiles are unreachable. Residual risk accepted knowingly and recorded.
- *Mobile (Medium).* Accepted, with the boundary made explicit rather than vague: supported at ≥768px; below that, phones get the same list view as the map-failure path. "Mobile usable" now means something specific and cheap instead of implying a second UX.

**Rejected.**
- *Drop the async repository seam.* "Static now, backend later" was a priced decision the user made after being shown the alternative; the cost is one ~40-line file, which is not meaningfully speculative. The critique does land partially, so filtering logic was moved out of the repository into pure store selectors — the seam is now a plain fetch boundary and nothing more.

---

## Round 2 — Codex

Opened by confirming that the half-open era ranges, navigation-state race handling, deploy-first milestone, CC attribution schema, URL allowlisting, geodata precision flags, image budget, and desktop/tablet scope are all defensible revisions, and that retaining the thin async repository seam is defensible at this size provided it stays as narrow as described.

- High: The fallback that justifies retaining OpenFreeMap is mis-scoped. The phone/list-view fallback sits in `T3`, but the plan relies on that same list view as the mandatory map-failure escape hatch; if it is cut as "polish," the accepted OpenFreeMap/WebGL risk becomes fatal again. Fix: move the map-failure list view into `T0` and leave only phone-specific presentation polish in `T3`.
- High: The degradation trigger is too narrow to be reliable. The plan only falls back if "MapLibre fails to construct," but tile outages, source errors, and rate limits typically produce a successfully constructed map with a blank or partial canvas rather than a constructor failure. Fix: define explicit runtime health checks (`styledata`/`sourcedata` success or timeout, plus `error` handling) that switch to list view when the map does not become usable.
- Medium: The backup for weak building-height coverage is technically muddled — "a flat-tinted footprint layer plus stronger terrain pitch" conflates two things; pitch alone does not create 2.5D, and actual MapLibre terrain needs a DEM source that appears nowhere in the plan. Fix: decide now that failed extrusion coverage means shipping a flat map with markers and dropping the 2.5D claim for that path.
- Medium: The time model still mixes relative and stale absolute framing — "~25 hours remain from plan lock" contradicts the rest of the document's correct `T+n` usage and is operator-hostile once the day turns. Fix: delete the "~25 hours remain" line, keep only `T+n` milestones plus the exact deadline timestamp.
- Medium: The final era is hard-coded as `[1989, 2027)`, which avoids the overlap bug but bakes in date rot for no product gain. Fix: make the last era open-ended in schema/validation, or derive its end at build time.

Closing note: the modified rejection of "cut features immediately" is defensible because the cut-lines are now explicit and front-loaded. The modified rejection of "switch tile providers now" is only defensible if the list fallback is truly must-ship and blank-map detection is widened beyond constructor failure.

VERDICT: REVISE

### Claude's response — all 5 accepted, 0 rejected

- *List view mis-scoped (High).* A genuine self-contradiction, and the sharpest catch of the review: the list view was simultaneously the mandatory mitigation for the two accepted High risks and the first thing the T3 cut-line would delete. Moved into T0 with an explicit note in the ladder explaining why; only phone-specific presentation stays in T3.
- *Degradation trigger too narrow (High).* Correct — "did the constructor throw" does not detect the common failure. Replaced with a `useMapHealth` check that trips on any of: `maplibregl.supported()` false or constructor throw; no `styledata` within 5 s; no `idle` within 10 s; three or more `error` events with `status >= 400` or originating from the tile source within 10 s. One-way switch per session, with a dismissible banner so a blank canvas is never presented as the product.
- *Extrusion fallback muddled (Medium).* Fair — the original wording was hand-waving. Pitch produces perspective, not depth, and a DEM source is an unbudgeted data dependency. Decision rule now fixed in advance: below roughly 60% usable `render_height` coverage in the Staré Město viewport, ship a flat map with tinted footprints and markers and drop the 2.5D claim for that path outright.
- *Mixed time framing (Medium).* Accepted; the absolute line is deleted. Only `T+n` offsets plus the exact deadline timestamp remain.
- *Hard-coded `2027` (Medium).* Accepted. The final era now carries `yearEnd: null`; membership degrades to `yearStart >= start`, and the timeline's right edge is computed at runtime from `max(currentYear, maxEventYear)`.

No rejections this round. Both of Codex's conditions on the tile-provider rejection — list view must-ship, and blank-map detection widened past constructor failure — are now met.

---

## Round 3 — Codex (final round, MAX_ROUNDS=3)

Opened by confirming that the half-open era model, navigation race handling, deploy-first milestone, mandatory list fallback, widened map-health checks, flat-map fallback, CC attribution schema, URL allowlisting, image budget, and desktop/tablet scope are all defensible. Explicitly accepted both standing rejections: the thin async repository seam is fine at this size, and retaining OpenFreeMap is acceptable now that the fallback is must-ship and no longer depends on constructor failure alone.

- High: The plan claims the `T+n` schedule "stays valid regardless of when the build starts," which is false under a hard deadline of 2026-07-27 22:00; if work starts late, every cut-line and the content freeze slips with it and can become nonsense. Fix: state that `T+n` assumes immediate start at plan lock and recompute checkpoints against the absolute deadline if start time slips, or add absolute wall-clock cut-lines alongside `T+n`.
- Medium: The timeline right edge is computed from `max(currentYear, maxEventYear)`, but the validator never states that it rejects future dates, so a bad `yearStart` typo can silently stretch the product into the future instead of failing fast. Fix: hard-fail `yearStart`/`yearEnd` after the current year unless future-dated events are explicitly allowed.

VERDICT: REVISE

### Claude's response — both accepted, 0 rejected

- *Two clocks (High).* Correct, and my error: "valid regardless of when the build starts" is exactly the wrong claim under a fixed deadline. The plan now separates the two explicitly. `T+n` are effort-duration estimates that assume an immediate start and slip if the start slips. `D−n` are hours before the absolute deadline and do not move. Every cut-line and the content freeze is now expressed in `D−n` — T1 gate at D−16h, T2 at D−12h, T3 at D−8h, content freeze at D−11h — so a late start compresses the work rather than silently pushing the gates past the deadline.
- *Future-dated events (Medium).* Accepted. The detailed validator spec had been thinned to a one-liner during the round-1 revision; it is restored in full and now hard-fails `yearStart`/`yearEnd` beyond the current year, alongside bbox, era-range, contiguity, image size/attribution, URL allowlist, duplicate-id and tour-reference checks.

## Resolution — cap reached at REVISE, no substantive disagreement outstanding

MAX_ROUNDS=3 was consumed. The final verdict on record is **REVISE**, and this log does not claim otherwise.

However, this is a cap-exhaustion, not a deadlock. There is no unresolved disagreement between reviewer and author: both round-3 findings were accepted and applied, and Codex had by then explicitly endorsed both of the plan's two standing rejections (the async repository seam, and retaining OpenFreeMap). The trajectory across rounds was 12 findings → 5 → 2, with severity falling and no finding ever re-raised after being addressed.

What is genuinely unverified: the round-3 fixes have not themselves been reviewed. A fourth round would confirm or refute them. That call belongs to the user.

---

# Act 3 — Build (Codex builds, Claude verifies)

Builder: OpenAI Codex, `gpt-5.4` @ high effort, codex-cli 0.143.0, `--yolo` (full write access, repo root).
Scope: Tier 0 of the priority ladder only. MAX_FIX_ROUNDS=2.
PROOF_CMD: `npx tsc --noEmit && npm run validate:content && npm run build`.

### Round 1 — Codex build

Created 34 files / ~2,459 lines: Vite+React+TS+Tailwind scaffold, GitHub Pages workflow, Zod schema,
8 eras, 23 events (structural fields + scaffold summaries, `body: []`, `images: []`), 3 data-only tours,
async repository seam, in-repo MapLibre style with building extrusions, navigation store with flight
tokens, map health checks, markers/popup/panel, list fallback, timeline scrubber and era bands,
content validator.

Codex reported the proof passing. It did pass.

### Claude's verdict — Round 1: REJECTED

`tsc --noEmit` clean, validator green, `vite build` succeeded. **And the map never rendered once.**
Every load fell through to the list view. Two fatal defects, neither visible to any automated check:

1. **Tile URL returned empty 200s.** `tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf` was hardcoded.
   OpenFreeMap serves planet tiles under a dated version segment. Verified with curl:
   the hardcoded path returns **HTTP 200, 0 bytes**; the versioned path returns **HTTP 200, 9,149 bytes**.
   Because the status is 200 and not >= 400, `useMapHealth`'s own error counter never tripped — the
   exact silently-blank-map failure mode the Act 2 review had insisted the health checks must catch.
   Fix: use the TileJSON endpoint (`url:`) so MapLibre resolves the rotating version itself.

2. **Health-check race — CLAIMED BY CLAUDE, LATER PROVEN WRONG.** See correction below.

Also sent back: sessionStorage made a transient failure permanent across reloads with no recovery
path; the validator resolved image paths to `public/images/images/...` so every future image would
report missing; a JSON typo would have thrown the human author a raw Zod stack trace; two identical
list views rendered side by side at >=1280px; `first-defenestration` sat ~240m south of the New Town
Hall while flagged `exact`; dead empty-if in `completeFlight`; missing 1600px dimension check.

### Round 2 — Codex fixes

All items addressed. Codex explicitly reported it could **not** drive a browser and therefore would
not claim the live-render checks — the correct call, and it saved a wasted round.

### Claude's verdict — Round 2: substantively verified, with one correction to my own Round 1 review

**Correction — finding 2 of Round 1 was wrong.** I diagnosed a race in which `attachMap` supposedly
attached the `styledata` listener after the event had already fired, guaranteeing the 5s timeout.
That does not happen: MapLibre dispatches `styledata` asynchronously via `browser.frameAsync`, well
after the listener attaches. The real reason the timer always fired in my harness is that the
verification browser pane never composites frames — `requestAnimationFrame` **never fires**
(`visibilityState: "hidden"`), so MapLibre's style loader stalls forever. Environmental, not a code
defect. Codex's seeding of `styleSeen`/`idleSeen` from `map.isStyleLoaded()`/`map.loaded()` is
harmless defensive coding and was kept, but it fixed a bug that did not exist.

**What was actually verified.** Re-running the map stack in an isolated harness with `requestAnimationFrame`
driven off `setTimeout`:

- `styledata` at 663ms, source loaded at 2,844ms, `idle` at 4,669ms with `loaded: true`.
- TileJSON and glyph endpoints both fetched from OpenFreeMap — the URL fix works.
- **504 building features in the Staré Město viewport, 501 carrying `render_height` — 99% coverage.**
- Height distribution: p25 8m, **median 18m**, p75 30m, p95 58m, max 99m, spread across all buckets.

That settles PLAN.md Milestone 1's exit criterion: Prague's historic core has the height data for
genuine 2.5D, and the plan's flat-map fallback rule (trip below 60% coverage) will not fire.
It also validates raising the idle timeout to 15s — first idle at 4.7s on a fast connection leaves
too little headroom under the original 10s.

Independently re-run by Claude: `npx tsc --noEmit` exit 0, `npm run validate:content` exit 0
(23/23 flagged for prose, as designed), `vite build` succeeded.

All 23 coordinates were spot-checked against known Prague locations. Prague Castle, St Vitus,
Karolinum, Charles Bridge, Old Town Square, the Old New Synagogue, the Libeň curve, Vinohradská 12,
Wenceslas Square and Národní třída are accurate to the building; the `approximate`/`area` flags on
Vítkov, Bílá hora, Josefov, New Town, Brahe/Kepler and the 2002 floods are honest.

**Not verified, and stated as such:** the map rendering inside the full app, marker DOM, popup and
panel interaction, and visual appearance. The verification pane does not composite frames and
reported a 0x0 viewport; the Chrome extension was not connected. This requires a human with a real
browser and is the one open item at hand-off.
