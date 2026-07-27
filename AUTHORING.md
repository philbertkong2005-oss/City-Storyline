# Writing the 23 entries — City-Storyline

You write two fields per event. Everything else is already filled in.

```jsonc
{
  "id": "second-defenestration",          // done — don't touch
  "yearStart": 1618,                       // done
  "coordinates": [14.4004, 50.0906],       // done
  "era": "white-mountain",                 // done
  "category": "conflict",                  // done
  "locationPrecision": "exact",            // done
  "wikipediaUrl": "https://...",           // done

  "summary": "…",     // ← YOU. One sentence. Shows in the map popup.
  "body": [],         // ← YOU. 2–3 strings, one per paragraph. Shows in the side panel.
  "images": []        // ← optional, see below
}
```

Run `npm run validate:content` any time. It prints `N of 23 events still need prose` — that's your
progress bar. Empty `body` is a warning, never a build failure, so a half-written file always builds.

## `summary` — one sentence

This is what a student reads *before* deciding to click. It appears in a small popup over the map.

- One sentence. Under ~140 characters. It will be visually cramped if longer.
- Say what happened and why it mattered — not just what happened.
- Present it in past tense, plainly.

> **Good:** "Two Catholic governors were thrown from a castle window, triggering a revolt that grew into the Thirty Years' War."
>
> **Too dry:** "An event in 1618 at Prague Castle."
>
> **Too breathless:** "In one shocking moment, history changed forever!"

The scaffold summaries Codex generated are factually correct but flat. Overwrite them — they exist
so the app renders, not because they're good.

## `body` — 2–3 paragraphs

An array of strings; each string is one paragraph. Aim for **90–140 words per paragraph**.

A structure that works for almost every entry:

1. **What happened**, concretely, with the specifics that make it real — names, the actual window,
   the actual date, the number of people.
2. **Why it mattered** — what changed afterward. This is the paragraph that does the teaching.
3. *(optional)* **What's there now** — what a visitor standing on that spot sees today. This is the
   payoff of putting history on a map, and it's the paragraph students remember.

Write for a curious 15-year-old who doesn't know Czech history. Assume intelligence, not knowledge.
Explain "Hussite" and "Estates" the first time they appear. Avoid unglossed Czech terms.

Don't editorialise about the present. No "and it still resonates today."

## Four entries need real care

`josefov-clearance`, `heydrich-assassination`, `prague-spring-invasion`, `jan-palach-self-immolation`.

These involve real atrocity and real deaths — the Lidice reprisals killed 340 people; Jan Palach was
20 and died of his burns three days later. Write them straight and factually. State what happened,
including the human cost, without dramatising it and without softening it. Understatement is the
correct register here; the facts are already heavy enough.

For `josefov-clearance`, note that this was a poor Jewish neighbourhood demolished by the city, and
that the people displaced were largely not the people who benefited. Getting this one wrong reads as
tourist-brochure history.

## `images` — optional, and skippable

The app works fine with `images: []`. **Do this last, or not at all.** Chasing images is the easiest
way to lose three hours you needed for prose.

If you do add them:

1. Find the file on [Wikimedia Commons](https://commons.wikimedia.org). Prefer **public domain** —
   old engravings, pre-1930 photographs — because attribution is simpler.
2. Download at ≤1600px on the long edge. Compress to **under 300 KB** (squoosh.app). The validator
   hard-fails above either limit.
3. Save to `public/images/` and fill every field:

```jsonc
{
  "src": "/images/defenestration-1618.jpg",
  "alt": "Contemporary engraving showing three men falling from a tall window",  // for screen readers — describe the picture
  "caption": "A 1618 broadsheet engraving of the defenestration",                // for sighted readers — give context
  "author": "Matthäus Merian",
  "title": "Prager Fenstersturz",
  "license": "Public domain",
  "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
  "sourceUrl": "https://commons.wikimedia.org/wiki/File:...",
  "modified": false      // true if you cropped or altered it
}
```

`alt` and `caption` are different jobs — `alt` describes what's in the image for someone who can't
see it; `caption` tells a sighted reader what they're looking at. Don't duplicate one into the other.

All fields are required and the validator enforces them. That's not bureaucracy — CC-BY and CC-BY-SA
legally require naming the author, naming the work, linking the licence, and flagging modifications.

## Order of attack

Write in this order so that if you run out of time, what's missing is what matters least:

1. **All 23 `summary` lines first.** ~30 minutes total. This alone makes every marker on the map
   useful, and it's the highest value-per-minute work in the project.
2. **`body` for the 8 headline events** — the two defenestrations, White Mountain, Charles Bridge,
   the National Theatre, 1918, 1968, 1989.
3. **`body` for the remaining 15.**
4. **Images**, if there's time left. There probably won't be, and that's fine.

At **D−11h** anything with an empty `body` gets drafted prose from me so nothing ships blank. You can
overwrite any of it afterwards — and you should, where you have something better to say.
