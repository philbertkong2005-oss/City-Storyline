import { z } from 'zod';

export const categorySchema = z.enum([
  'politics',
  'conflict',
  'architecture',
  'culture',
  'religion',
  'disaster',
  'science',
]);

export const locationPrecisionSchema = z.enum(['exact', 'approximate', 'area']);

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
  eraId: z.string().min(1),
  title: z.string().min(1),
  yearStart: z.number().int(),
  yearEnd: z.number().int().optional(),
  category: categorySchema,
  locationName: z.string().min(1),
  locationPrecision: locationPrecisionSchema,
  locationNote: z.string().min(1).optional(),
  coordinates: z.object({
    lng: z.number(),
    lat: z.number(),
  }),
  wikipediaUrl: z.string().url(),
  summary: z.string().min(1),
  body: z.array(z.string().min(1)),
  images: z.array(imageSchema),
});

export const eraSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Compact label for the timeline chips, where the full name does not fit. */
  shortName: z.string().min(1).max(18),
  /** One or two sentences shown when this chapter is selected. */
  blurb: z.string().min(1),
  yearStart: z.number().int(),
  yearEnd: z.number().int().nullable(),
});

export const tourSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  eventIds: z.array(z.string().min(1)).min(1),
});

export const erasSchema = z.array(eraSchema);
export const storyEventsSchema = z.array(storyEventSchema);
export const toursSchema = z.array(tourSchema);

export type Category = z.infer<typeof categorySchema>;
export type LocationPrecision = z.infer<typeof locationPrecisionSchema>;
export type StoryImage = z.infer<typeof imageSchema>;
export type StoryEvent = z.infer<typeof storyEventSchema>;
export type Era = z.infer<typeof eraSchema>;
export type Tour = z.infer<typeof tourSchema>;
