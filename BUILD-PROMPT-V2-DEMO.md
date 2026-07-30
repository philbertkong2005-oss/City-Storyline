# Build prompt — V2 demo

Hand this to a fresh coding session. It is written to be self-contained apart from the three documents
it points at.

---

## Task

Build the V2 demo of City-Storyline, as specified in **[PLAN-V2.md](PLAN-V2.md)** (read it in full
first — the "Demo scope" section defines phases and exit criteria) and
**[content-drafts/README.md](content-drafts/README.md)**. The content to load is
**[content-drafts/charles-iv-bohemia.json](content-drafts/charles-iv-bohemia.json)**.

[PLAN.md](PLAN.md) is the Tier-0 record; PLAN-V2 supersedes its *scope* but not its decisions, which
are still binding except where PLAN-V2 explicitly overrides them.

Work on a branch. Do not merge to `main` — the deploy workflow fires on `main` and the Tier-0 site is
live.

**Stop after Phase 1 and report.** The model is the risk; the human wants to judge it before the front
door is built on top of it.

## Phases

Do them in order. Each has an exit criterion in PLAN-V2's "Demo scope" section.

1. **The model** — schema, store, validator, migration. Plain UI only.
2. **Geography** — localities, `maxBounds` removed, flat base map, Prague → Karlštejn travel.
3. **The front door** — storyline card rail, hover-to-fly, locality filter, home button.
4. **Reading** — stepped scroll narrative, chapter index, rescaled scrubber, hash routing.

## Phase 1 concretely

- `tsc --noEmit` added to CI in `.github/workflows/deploy.yml` before `build`. One line, do it first —
  nothing typechecks today.
- `src/data/schema.ts`: add `storylineSchema`, `chapterSchema`, `entrySchema`, `localitySchema`. Make
  `coordinates` optional on `StoryEvent` (Decision #14). Add `life` to `categorySchema` (#15). Add
  `kind: 'period' | 'present'` to chapters (#16).
- **Migrate `eraId` off the event and onto the storyline entry** (Decision #2). The 8 eras in
  `eras.json` become the *chapters of a new Prague place-storyline*, same shape, so `getCurrentEra`
  becomes chapter-aware and `EraBands` becomes `ChapterBands` parameterised by the active storyline.
  23 events, mechanical.
- Merge `content-drafts/charles-iv-bohemia.json` into `src/data/` once the schema accepts it. Verify
  the estimated coordinates and the Wikipedia article titles first — see the drafts README.
- `scripts/validate-content.ts`: replace the global Prague bounding box (currently hardcoded at
  ~line 198) with a per-locality `bounds` check. Assert contiguity only across `kind: 'period'`
  chapters. Assert every entry `ref` resolves and every `chapterId` exists.
- `tours.json` is superseded — a tour *is* a storyline. Convert its 3 tours to `theme` storylines or
  delete the file; do not leave it loaded and unused as it is today.

**Exit criterion:** Charles Bridge renders correctly in both the Prague storyline and the Charles IV
storyline — different framing note above identical base prose, from one record. Then stop and report.

## Traps a fresh session will fall into

These are decided; do not re-litigate them.

- **Two-way binding oscillates.** Card hover moves the camera and never touches the filter; map click
  sets both (Decision #11). In Phase 4, clicking a marker scrolls the narrative, which fires the scroll
  observer, which moves the camera — that needs a suppression flag during programmatic scroll. The
  store's existing `flightToken` handles the stale-flight half of this and was built for it.
- **The soft boundary is hysteresis, not elastic drag** (Decision #9). Two thresholds and a chip state
  change. Do not fight MapLibre's drag transform mid-gesture.
- **Scroll narrative is stepped, not continuous.** Each event is a step that triggers one camera move.
- **Hillshade/terrain is not in this demo.** Do not add a DEM source.
- **Do not reuse event hero images as card thumbnails** (Decision #12). ~200KB each on first paint and
  an auto-scrolling rail defeats lazy loading. For the demo, placeholders are fine.
- **Reduced motion is designed in, not added later:** no auto-scroll, `jumpTo` instead of `flyTo`, no
  slide transition.
- **The map-failure list fallback is not optional.** It is Tier-0 behaviour (PLAN.md Decision #4) and
  `useMapHealth` already implements the health checks. Keep it working through the refactor.
- **`App.tsx` is 851 lines**, ~450 of them desktop splitter geometry. Phase 3 and 4 will fight it.
  Extract the layout maths when it starts to hurt, not pre-emptively.

## Out of scope for this demo

Visitable places, terrain, historical territory, phone layout, the event-card front-door mode,
clustering, autoplay, historical map overlays, and writing prose. Every `body` stays empty; the
existing `summary` lines stand in.
