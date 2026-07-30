# Content drafts

Authoring material for storylines that the app cannot load yet. Deliberately **outside `src/data/`**
so `npm run validate:content` does not see it — several of these records would hard-fail today.

The Tier-0 pattern applies: structure is pre-filled, prose is yours. Every `body` is `[]` and every
entry `note` is `""`, so the validator's empty-body warnings will track your progress once the schema
lands and these move into `src/data/`.

## charles-iv-bohemia.json

The first person storyline. 13 new events (9 anchored in the Czech lands, 4 off-map), 4 existing
events reused, 6 visitable places, 2 new localities, 6 chapters.

### It assumes three schema changes that do not exist yet

1. **`coordinates` becomes optional.** Four events — the French court, Crécy, the Rome coronation,
   the Golden Bull — have no Czech coordinate and render as narrative steps with no marker. Without
   this, the storyline loses his childhood, his battles and his imperial crown, which is four of the
   six things the arc is supposed to cover. See PLAN-V2 for why the alternative (dropping them) was
   rejected.
2. **`category` gains `life`.** Birth and death fit none of the existing seven values, and because
   genre labels are *derived* from categories (PLAN-V2 Decision #8), filing a birth under `politics`
   would quietly pollute the storyline's derived genre. Three events use `life`.
3. **Chapters gain `kind: 'period' | 'present'`.** The closing "Where to see him today" chapter has no
   year range, so the contiguity assertion inherited from PLAN.md Decision #2 must apply only to
   `period` chapters.

With these in place the derived genre for this storyline comes out as **architecture · politics ·
religion** (top 3 by event count), which is a fairer description of him than any single label.

### Verify before it goes near the validator

- **Coordinates for the new locations are estimates.** Karlštejn, Karlovy Vary, Emmaus and the Petřín
  wall need checking against OSM, as PLAN.md required for the original 23. The reused Prague Castle,
  St Vitus and Karolinum coordinates are copied exactly from `events.json` so the same building
  highlights correctly.
- **Every `wikipediaUrl` needs confirming.** The validator enforces HTTPS plus a host allowlist but
  cannot tell you an article title is wrong.
- **Locality `bounds` are rough boxes**, sized to make the soft-boundary filter behave sensibly rather
  than to trace an administrative border.

### Suggested entry notes for the four reused events

These are the only writing the existing events need — one framing line each, shown above their
unchanged prose:

- `st-vitus-cathedral-begun` — the cathedral he began the same year Prague became an archbishopric,
  and where he was crowned, married, and buried.
- `charles-university-founded` — the first university north of the Alps and east of Paris, founded in
  the same year as the New Town and Karlštejn.
- `new-town-founded` — a planned district roughly the size of the existing city, laid out around three
  great market squares.
- `charles-bridge-begun` — the crossing he commissioned, whose foundation stone he laid himself at a
  moment his astrologers chose.

### Historical care

The project has been strict about not asserting false precision, and three records here need it:

- **His birthplace is not securely identified** — `approximate`, with the reason in `locationNote`.
- **Karlovy Vary's founding legend** (discovering the springs while hunting) is tradition; the 1370
  charter is the record. Both are in `locationNote`; keep them distinguished in the prose.
- **The Hunger Wall as famine relief** is a traditional attribution that historians question. Its
  defensive purpose is not in doubt.

Conversely, the 1333 ruined-castle detail comes from his own autobiography, the *Vita Caroli* — worth
saying so in the prose, since a first-person medieval source is a rarity in this corpus.

### Suggested writing order

Chapter blurbs first — six short paragraphs that establish the arc and will show you whether the
chapter spine is right before you commit to thirteen write-ups. Then the four entry notes above, which
make the many-to-many model real for the first time. Then the new events in chronological order.
Visitable-place summaries last, since they depend on how much the events already say.
