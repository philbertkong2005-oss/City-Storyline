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

### Verification pass — done 2026-07-29

All 13 `wikipediaUrl` values were fetched and resolve. Coordinates were checked against the
coordinates each article publishes. Corrections already applied to the JSON:

| Record | Was | Now | Off by |
|---|---|---|---|
| `karlovy-vary-chartered` | 12.883, 50.2231 | 12.8725, 50.23056 | ~1.3 km |
| `emmaus-monastery-founded` | 14.4172, 50.0745 | 14.4175, 50.07222 | ~250 m |
| `hunger-wall-built` | 14.395, 50.0805 | 14.395, 50.083 | ~280 m |
| `karlstejn-castle-founded` | 14.1881, 49.9394 | 14.18806, 49.93944 | ~5 m |

The Emmaus fix mattered most: at `exact` precision the coordinate drives per-building highlighting, so
250 m would have coloured the wrong building.

Dates confirmed and written into `locationNote`: born 14 May 1316 · seven years at the French court ·
archbishopric 30 April 1344 · Crécy 26 August 1346, Charles wounded and fighting on the French side ·
crowned King of Bohemia 2 September 1347, with a crown made in 1346 · Karlštejn 1348 · emperor
5 April 1355, crowned by a cardinal · Golden Bull at Nuremberg 10 January and Metz 25 December 1356 ·
Hunger Wall 1360–1362 · Karlovy Vary privileges 14 August 1370, settlement c. 1349 · died
29 November 1378, buried at St Vitus.

**Two claims failed verification and are flagged in the JSON, not silently kept:**

1. **`charles-iv-returns-to-bohemia` cited an article that does not support it.** The Prague Castle
   article says only that the royal palace was rebuilt in Gothic style under Charles IV — nothing about
   the castle being ruined in 1333. That detail comes from the *Vita Caroli*, which has **no standalone
   English Wikipedia article**. The URL now points to the Charles IV article, which at least confirms
   the autobiography exists; cite the *Vita Caroli* directly in the prose.
   **Do not link `Vita Karoli Magni`** — that is Einhard's life of Charlemagne, a different work by
   five centuries.
2. **`place-st-wenceslas-crown` would have sent visitors to see something they cannot see.** The
   original is behind seven locks, keys split among seven office-holders, and is displayed roughly once
   every five years. Visitors see a replica. The entry now says so.

**Still unconfirmed, flagged in `locationNote` rather than dropped:** the Slavonic-rite licence at
Emmaus (the English article mentions only that students of Cyril and Methodius studied there; the Czech
name *Na Slovanech* supports it); a triforium bust specifically of Charles IV (the article confirms
busts of the royal family, bishops and the master builders, without naming his); and the multi-day
funeral in 1378.

**One deliberate non-change:** St Vitus is at 14.40052, 50.09034 in `events.json`, while Wikipedia
gives 14.40056, 50.09083 — about 55 m apart. The Tier-0 value was verified against the building
footprint in OSM, which is what per-building highlighting needs. Wikipedia's is a rough centroid.
Keep the existing value.

**Locality `bounds` remain rough boxes**, sized so the soft-boundary filter behaves sensibly rather
than to trace an administrative border. Both `defaultView` centres now match the verified coordinates.

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
