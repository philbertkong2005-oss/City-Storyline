import { z } from 'zod';

export const categorySchema = z.enum([
  'politics',
  'conflict',
  'architecture',
  'culture',
  'religion',
  'disaster',
  'science',
  // A birth or a death fits none of the seven above. It earns its own value
  // because genre labels are derived from categories (PLAN-V2 Decision #8), so
  // filing a birth under `politics` would silently skew a person storyline's
  // derived genre.
  'life',
]);

export const locationPrecisionSchema = z.enum(['exact', 'approximate', 'area']);

export const coordinatesSchema = z.object({
  lng: z.number(),
  lat: z.number(),
});

/** A camera position. Authored, never derived — see PLAN-V2's Locality section. */
export const viewSchema = z.object({
  center: z.tuple([z.number(), z.number()]),
  zoom: z.number(),
  pitch: z.number(),
  bearing: z.number(),
});

export const imageSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  caption: z.string().min(1),
  author: z.string().min(1),
  title: z.string().min(1),
  license: z.string().min(1),
  licenseUrl: z.string().url(),
  sourceUrl: z.string().url(),
  modified: z.string().min(1),
});

export const storyEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  yearStart: z.number().int(),
  yearEnd: z.number().int().optional(),
  category: categorySchema,
  locationName: z.string().min(1),
  locationPrecision: locationPrecisionSchema,
  locationNote: z.string().min(1).optional(),
  /**
   * Optional (PLAN-V2 Decision #14). An event with no coordinates is a narrative
   * step with no marker: the text carries it and the camera holds position.
   * Charles IV's French childhood, Crécy, the Rome coronation and the Golden Bull
   * all happened outside the Czech lands this demo maps, and dropping them would
   * cost the storyline its childhood, its battles and its imperial crown.
   */
  coordinates: coordinatesSchema.optional(),
  wikipediaUrl: z.string().url(),
  summary: z.string().min(1),
  body: z.array(z.string().min(1)),
  images: z.array(imageSchema),
});

/**
 * Something you can go and see now, as opposed to something that happened.
 *
 * Coordinates are *required* here, unlike on an event: an event can legitimately
 * have happened off this map, but a place you cannot locate is not visitable.
 */
export const visitablePlaceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  locationName: z.string().min(1),
  locationNote: z.string().min(1).optional(),
  coordinates: coordinatesSchema,
  relatedEventIds: z.array(z.string().min(1)),
  wikipediaUrl: z.string().url(),
  // Empty while prose is out of scope; the validator warns rather than fails, the
  // same way it already tracks unwritten event bodies.
  summary: z.string(),
  body: z.array(z.string().min(1)),
  images: z.array(imageSchema),
});

const chapterBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Compact label for the timeline chips, where the full name does not fit. */
  shortName: z.string().min(1).max(18),
  /** One or two sentences shown when this chapter is selected. May be unwritten. */
  blurb: z.string(),
});

/**
 * Chapters generalise Tier-0's eras: a city's eras, a person's life stages and a
 * war's phases are one concept (PLAN-V2 Decision #2). The half-open `[start, end)`
 * rule survives intact, and `yearEnd: null` still means "and onward".
 *
 * The two kinds are a discriminated union rather than a flat shape with nullable
 * years so that the contiguity assertion and `getCurrentChapter` get non-null
 * years from the type system instead of re-checking at every call site.
 */
export const periodChapterSchema = chapterBaseSchema.extend({
  kind: z.literal('period'),
  yearStart: z.number().int(),
  yearEnd: z.number().int().nullable(),
});

/**
 * A chapter with no year range — the closing "where to see him today" chapter
 * (PLAN-V2 Decision #16). Contiguity does not apply to these.
 */
export const presentChapterSchema = chapterBaseSchema.extend({
  kind: z.literal('present'),
  yearStart: z.null(),
  yearEnd: z.null(),
});

export const chapterSchema = z.discriminatedUnion('kind', [
  periodChapterSchema,
  presentChapterSchema,
]);

/**
 * A node's membership in one storyline, and what it means *there*.
 *
 * `note` is the load-bearing field of the whole model: the same event means
 * different things in different storylines, so framing lives on the entry while
 * the base prose stays on the single shared record.
 */
export const entrySchema = z.object({
  ref: z.string().min(1),
  chapterId: z.string().min(1),
  order: z.number().int().nonnegative(),
  note: z.string().default(''),
});

export const storylineTypeSchema = z.enum(['person', 'place', 'period', 'theme']);

export const storylineSchema = z.object({
  id: z.string().min(1),
  type: storylineTypeSchema,
  title: z.string().min(1),
  summary: z.string(),
  /** Person storylines only — genre is derived, but "who he was" is authored. */
  roles: z.array(z.string().min(1)).optional(),
  openingView: viewSchema.extend({ localityId: z.string().min(1) }),
  chapters: z.array(chapterSchema).min(1),
  entries: z.array(entrySchema).min(1),
});

/**
 * A place with an extent. One entity, four jobs: the "same city, don't move the
 * camera" rule, the authored 2.5D framing for that place, a pin on the base map,
 * and the per-locality bounds that replace Tier-0's single global Prague box.
 */
export const localitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** [[west, south], [east, north]] */
  bounds: z.tuple([
    z.tuple([z.number(), z.number()]),
    z.tuple([z.number(), z.number()]),
  ]),
  defaultView: viewSchema,
});

export const storyEventsSchema = z.array(storyEventSchema);
export const visitablePlacesSchema = z.array(visitablePlaceSchema);
export const storylinesSchema = z.array(storylineSchema);
export const localitiesSchema = z.array(localitySchema);

export type Category = z.infer<typeof categorySchema>;
export type LocationPrecision = z.infer<typeof locationPrecisionSchema>;
export type Coordinates = z.infer<typeof coordinatesSchema>;
export type View = z.infer<typeof viewSchema>;
export type StoryImage = z.infer<typeof imageSchema>;
export type StoryEvent = z.infer<typeof storyEventSchema>;
export type VisitablePlace = z.infer<typeof visitablePlaceSchema>;
export type PeriodChapter = z.infer<typeof periodChapterSchema>;
export type PresentChapter = z.infer<typeof presentChapterSchema>;
export type Chapter = z.infer<typeof chapterSchema>;
export type StorylineEntry = z.infer<typeof entrySchema>;
export type StorylineType = z.infer<typeof storylineTypeSchema>;
export type Storyline = z.infer<typeof storylineSchema>;
export type Locality = z.infer<typeof localitySchema>;

/**
 * Entries point at either kind of node, so anything that walks a storyline works
 * against this rather than against `StoryEvent` directly.
 */
export type StoryNode =
  | { kind: 'event'; event: StoryEvent }
  | { kind: 'place'; place: VisitablePlace };

export function nodeId(node: StoryNode): string {
  return node.kind === 'event' ? node.event.id : node.place.id;
}

export function nodeTitle(node: StoryNode): string {
  return node.kind === 'event' ? node.event.title : node.place.title;
}

export function nodeCoordinates(node: StoryNode): Coordinates | undefined {
  return node.kind === 'event' ? node.event.coordinates : node.place.coordinates;
}
