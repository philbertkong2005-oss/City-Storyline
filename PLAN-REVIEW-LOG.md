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
