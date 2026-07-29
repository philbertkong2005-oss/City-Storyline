# Plan v2: from City-Storyline to a storyline-first history map

_Supersedes the scope of [PLAN.md](PLAN.md), which remains the record of the Tier-0 deadline build
(shipped 2026-07-27, live). Nothing in Tier-0 is discarded — this plan generalises it._

_Locked conversationally on 2026-07-29. No hard deadline. The priority ladder is therefore the only
forcing function this project has, and it is load-bearing._

## Goal

A static single-page app that teaches history by letting people enter it from **any point of
interest** — a person, a place, a period, a theme — where every entry point draws on one shared pool
of geo-anchored events and present-day visitable places, and each tells its own ordered story over
them.

The Tier-0 product answered "what happened in Prague, and when." This one answers "show me Charles
IV," "show me the Hussite Wars," "show me Prague," and "show me what I can go and see" — from the
same data.

## What changed from v1, and why

Tier-0 assumed a city was the container. A character storyline breaks that assumption immediately:
Charles IV was born in Prague but raised in Paris, campaigned in Italy, was wounded at Crécy, crowned
emperor in Rome, and built Karlštejn and Karlovy Vary — both outside the Prague bounding box that
[scripts/validate-content.ts](scripts/validate-content.ts) hard-fails on, and outside the
`maxBounds` that [src/components/MapCanvas.tsx](src/components/MapCanvas.tsx) locks the camera to.

The generalisation is therefore **not** "support multiple cities." It is: geography is global,
narratives are lenses over it, and a city is one kind of lens.

## The model

### Nodes — things anchored to a place

- **`StoryEvent`** — something that *happened*. Time, place, prose, images. Exists today; loses its
  `eraId` (see Decisions #2).
- **`VisitablePlace`** — something you can *go and see now*. Place, what is held there, prose,
  images, links. New. Deliberately excludes opening hours, ticket prices and current-exhibition
  detail, which go stale on a static site with no CMS.

### Storyline — a typed, ordered narrative over nodes

```
Storyline {
  id
  type: 'person' | 'place' | 'period' | 'theme'
  title, summary
  openingView: { center, zoom, pitch, bearing, localityId }
  roles?: string[]                    // person storylines only — 'king', 'patron', 'soldier'
  chapters: [ { id, name, shortName, blurb, yearStart, yearEnd } ]
  entries:  [ { ref, chapterId, order, note? } ]
}
```

`entries[].note` is the load-bearing field. The same event means different things in different
storylines — Charles Bridge is *the crossing he commissioned* in the Charles IV storyline, *the
city's second stone bridge* in Prague, and *the structure that held* in a 2002 floods storyline.
Without per-entry framing, many-to-many produces the same paragraph in four contexts, wrong in three
of them.

### Locality — a place with an extent

```
Locality { id, name, bounds, defaultView }
```

One entity, four jobs: it defines the "same city, don't move the camera" rule; it holds the authored
2.5D framing for that place; it becomes a pin on the base map; and its `bounds` replace the global
Prague bounding box in the validator. Membership is *computed* from coordinates, so new events
classify themselves.

`defaultView` is authored, not derived — Prague wants a wide pitched city shot, Karlštejn is a single
castle on a hill and wants a tight one. No formula produces both.

## Priority ladder — the cut-lines are the plan

Same discipline as v1. Features ship in this order and are abandoned in reverse. Nothing below a line
starts until everything above it works.

| Tier | Contents | Evenings |
|---|---|---|
| **V1 — the model, proven** | Storyline/locality/entry schema; migrate the 23 events; Prague and *Charles IV in Bohemia* as two real storylines; localities + flat base map + travel choreography; two-mode front door; standalone event views; deep links. **Desktop only.** | 15–22 |
| **V2 — reach** | Full phone map: bottom sheet, phone scrubber, swipe-to-preview card deck, keyboard nav, `prefers-reduced-motion`, a11y pass | 6–10 |
| **V3 — depth of place** | `VisitablePlace` as a first-class layer; hillshade terrain on the base map; hand-drawn historical territory bound to the active chapter | 6–10 |
| **V4 — motion and scale** | Storyline playback/autoplay, authored camera choreography, marker clustering, cross-cutting event search refinement | 6–9 |
| **V5 — expansion** | Georeferenced historical map overlays (**gated on a sourcing spike, see Risks**); Charles IV's European chapters; further characters; a second city | 12–20 |

**Total: ~48–65 evenings.** At two or three evenings a week, V1 alone is roughly two months.

**One tension recorded deliberately.** Full phone support was rated a top priority early in scoping,
then a desktop-only V1 was accepted once the front door was designed. V2 is therefore phone, first
thing below the line. If the teaching-tool goal is the real one, phone arguably belongs *inside* V1 —
this is the single most likely place this ladder is wrong.

## Key decisions & tradeoffs

1. **Storylines are many-to-many over nodes, and membership carries framing.** An event belongs to
   any number of storylines; each storyline's entry supplies its own `note` and chapter placement.
   Rejected alternatives: duplicating events per storyline (two copies of the same prose to
   maintain), and a single "primary storyline" per event (hides the overlap, which is the product's
   central idea).

2. **Chapters generalise eras; the v1 interval rules survive intact.** A chapter has the same shape
   as an era — `{ id, name, shortName, blurb, yearStart, yearEnd }` — so a person's life stages, a
   war's phases and a city's eras are one concept. The half-open `[start, end)` rule and contiguity
   assertion from PLAN.md Decision #2 carry over unchanged, and `EraBands` becomes `ChapterBands`
   parameterised by the active storyline. **Migration:** `eraId` moves off the event and onto the
   storyline entry, because chapter membership is a per-storyline fact, not a global property. 23
   events, mechanical.

3. **Localities are boundary-defined, not tagged.** An earlier proposal tagged each storyline with a
   locality by hand. Rejected in favour of computing membership from coordinates against a locality's
   `bounds`: authored once per place instead of once per storyline, and new events classify
   themselves. The locality lives on `openingView`, not on the storyline — Charles IV in Bohemia spans
   Prague, Karlštejn and Karlovy Vary and has no single locality, but his opening shot does.

4. **Events get standalone views.** An event has its own URL, its own base prose, and an "appears in"
   strip of its storylines. This resolves the entry ambiguity (an event card need not choose a
   storyline), gives the base prose a home that per-storyline notes *add to* rather than replace, and
   means searching "Charles Bridge" returns the bridge rather than a question about which story you
   would like it in.

5. **Hash routing for deep links.** GitHub Pages serves static files with no rewrite rules, so a path
   URL 404s. The `404.html` redirect trick buys clean paths at the cost of a workaround with moving
   parts; hash routing (`#/charles-iv/karlstejn-founded`) is uglier and cannot break. Deep links are
   V1, not polish: without them the browser back button *leaves the site*, and a teacher cannot assign
   a storyline by link.

6. **Terrain is hillshade below zoom 13, and nothing above it.** `building-extrusions` is
   `minzoom: 13`; capping hillshade at `maxzoom: 13` means terrain and extrusions never appear in the
   same frame. This is not just tidy — it sidesteps the real integration bug, where enabling true 3D
   terrain plants `fill-extrusion-base: 0` buildings at sea level so they sink into hillsides, which
   in a city as hilly as Prague would be glaring. True 3D terrain is explicitly **not** pursued.
   PLAN.md Decision #4's logic still applies: the DEM is a second dependency with no SLA, so the base
   map must degrade to flat if it fails.

7. **Historical territory is hand-drawn and labelled as illustrative.** No free, licensable vector
   dataset exists for 14th-century borders. This extends the precedent already set for
   [src/data/eraZones.json](src/data/eraZones.json), which the UI describes to the user as "an
   illustrative sketch … not a surveyed boundary." Same honesty, larger polygons, bound to the active
   chapter rather than the selected era.

8. **Genre is derived from event categories, not authored.** A storyline's genre labels come from the
   `category` values of its entries. Derivation guarantees completeness, which is exactly what a
   filter facet needs — hand-labelling's failure mode is the forgotten tag that hides a result.
   **Badge shows the top 3 by event count; the filter matches on any category present**, so Prague
   (one flood in 23 events) is findable under "disaster" without being *branded* a disaster storyline.
   Derivation describes what a storyline is *about*, not what its subject *was*, so person storylines
   additionally carry a short authored `roles` list — one line each, and the filter offers "About"
   and "Who" as separate groups.

9. **The locality filter uses a soft boundary implemented as hysteresis, not elastic drag.** Clicking
   a locality pin zooms in, filters the cards, and ticks the filter. Panning away eventually clears
   it — but with friction, via two thresholds: inside the locality's `bounds` nothing happens;
   between `bounds` and an outer release threshold the filter chip shows a "keep going to leave
   Prague" state; crossing the outer threshold clears it. **True elastic rubber-banding is
   rejected** — fighting MapLibre's drag transform mid-gesture feels janky and breaks under touch
   inertia, where a single flick carries the camera far past any boundary. Hysteresis gives the same
   felt friction without contesting the gesture. Zooming out past the locality's zoom floor also
   releases. Note this is the *opposite* of `maxBounds`, which is a hard wall and is being removed.

10. **Hiding results is allowed; hiding them silently is not.** With a locality filter active, search
    genuinely will not surface storylines elsewhere. That requires a visible dismissible chip
    (`Prague ×`) and an honest empty state — *"No results in Prague — 3 matches elsewhere, show
    all?"* Same behaviour, no dead end.

11. **One binding rule between cards and map.** Card hover moves the camera and never touches the
    filter. Map click sets both camera and filter. Stated up front because two-way binding between
    the same two surfaces oscillates if it is left to emerge.

12. **Card thumbnails are a distinct asset class.** Reusing event heroes on the front door means
    ~200KB × every visible card downloading on first paint, and an auto-scrolling rail defeats lazy
    loading because every card becomes visible within seconds. Thumbnails target ~480px WebP at
    40–60KB with their own validator budget. A crop is a modification under CC-BY, and a card has no
    room for an attribution block, so **full attribution lives on the destination** and the card
    carries a minimal credit.

13. **`maxBounds` is removed.** It is the same Prague-shaped assumption as the validator's bounding
    box, expressed in the camera instead of the data. Per-locality bounds replace it.

## Front door — specified

- Title, search bar, filter button, and an auto-scrolling row of storyline cards over a live,
  interactive map.
- **Card hover** pauses the rail and flies the map to that storyline's `openingView`, after a ~300ms
  dwell delay so sweeping the cursor across the rail does not launch four flights. If the target
  locality matches what is already on screen, the camera does not move at all — the card's own hover
  state is the only feedback, by design.
- **Card click** raises and dismisses the title, search and rail; the map zooms in; panels enter from
  the edges they dock to. A **home button, top right**, returns to the chooser. The header's
  "Twenty-three events across eight chapters" line gives up that corner.
- **Map click** on a locality pin zooms to it and applies that locality as a filter to both the cards
  and the search (Decisions #9, #10).
- **Mode toggle** switches the rail from storyline cards to **event cards**, faceted by category,
  date range, locality, storyline membership, and person. Person facets come free: a person-type
  storyline *is* a people-tag, so "events involving Charles IV" is "entries in the Charles IV
  storyline" with no separate taxonomy.
- **Card content:** title, type badge, event count, date range, thumbnail, up to 3 genre labels
  (expandable).
- **On phone (V2):** swipe a card deck to preview, tap to enter — swipe replaces hover, tap stays tap.
- **Reduced motion:** no auto-scroll, `jumpTo` instead of `flyTo`, no slide transition. Designed in,
  not bolted on.

## Risks / open questions

- **The reading experience is entirely unspecified.** This plan details the front door to the
  millisecond and says almost nothing about what happens after the click — how a person's life reads
  differently from a city's history, how visitable places sit alongside historical events, how
  chapters drive the map. It is where users spend all of their time. **Biggest open item.**
- **Content is the critical path, again**, exactly as PLAN.md warned. Charles IV in Bohemia needs
  8–12 new events with prose and attributed images. Separately, the four existing Charles events
  (`st-vitus-cathedral-begun`, `charles-university-founded`, `new-town-founded`,
  `charles-bridge-begun`) were written city-first and need per-storyline entry notes — re-framing
  existing prose, not only writing new prose.
- **Historical map overlays (V5) are gated on a sourcing spike** that has not been run. The question
  is not technical: does a georeferenced historical map of Prague or Bohemia exist under a licence
  that permits redeployment on GitHub Pages? A public-domain original does not imply a freely
  reusable scan. **Run the spike before sequencing anything around V5** — if the answer is no, the
  item dies rather than lingering.
- **A second no-SLA tile dependency** arrives with V3's hillshade. The list-view fallback covers a
  vector-tile outage; the base map needs an equivalent flat fallback for a DEM outage.
- **The soft boundary is a feel problem.** Thresholds cannot be specified on paper; they need tuning
  with the thing in hand, on both trackpad and touch.
- **No deadline means no natural forcing function.** The Tier-0 build succeeded largely because the
  cut-lines were real. This ladder is the only substitute, and this scope grew from "finish T1/T2" to
  ~50 evenings in a single conversation — deliberately and coherently, but it grew.

## Out of scope

Carried over from v1: Czech or any localisation; user accounts, bookmarks, progress tracking; any CMS
or teacher-authoring UI; backend, database, authentication; live Wikipedia fetching at runtime.

New to v2:

- **True 3D terrain** (Decision #6) — hillshade only.
- **Any locality outside the Czech lands under Charles IV**, for now. His French, Italian and Roman
  chapters are V5.
- **Live visiting information** — opening hours, ticket prices, current exhibitions.
- **Viewport-following filters.** The locality filter is set by an explicit click and cleared by
  explicitly leaving, never by incidental panning.
