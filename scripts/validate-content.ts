import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ZodError, type ZodTypeDef, type ZodType } from 'zod';

import {
  localitiesSchema,
  storyEventsSchema,
  storylinesSchema,
  visitablePlacesSchema,
  type Coordinates,
  type Locality,
  type PeriodChapter,
  type StoryEvent,
  type StoryImage,
  type Storyline,
  type VisitablePlace,
} from '../src/data/schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(repoRoot, 'public');
const currentYear = new Date().getFullYear();

const errors: string[] = [];
const warnings: string[] = [];

const allowedHostPatterns = [
  /\.wikipedia\.org$/u,
  /\.wikimedia\.org$/u,
  /^commons\.wikimedia\.org$/u,
  /^creativecommons\.org$/u,
];

function formatIssuePath(fileLabel: string, issuePath: Array<string | number>): string {
  const prefixes: Record<string, string> = {
    'events.json': 'event',
    'storylines.json': 'storyline',
    'localities.json': 'locality',
    'visitablePlaces.json': 'place',
  };

  const prefix = prefixes[fileLabel] ?? 'item';
  if (issuePath.length === 0) {
    return `${fileLabel}: ${prefix}`;
  }

  const [first, ...rest] = issuePath;
  const head =
    typeof first === 'number'
      ? `${prefix}[${first}]`
      : `${prefix}.${String(first)}`;

  const tail = rest
    .map((segment) =>
      typeof segment === 'number' ? `[${segment}]` : `.${String(segment)}`,
    )
    .join('');

  return `${fileLabel} - ${head}${tail}`;
}

/**
 * The input side is `unknown` rather than `T`: a schema with a `.default()` (such
 * as an entry's `note`) accepts input that omits the field and outputs one where
 * it is always present, so binding both sides to the same type rejects it.
 */
function parseJsonFile<T>(
  relativePath: string,
  schema: ZodType<T, ZodTypeDef, unknown>,
): T {
  const absolutePath = path.join(repoRoot, relativePath);
  const fileLabel = path.basename(relativePath);
  let rawValue: unknown;

  try {
    rawValue = JSON.parse(readFileSync(absolutePath, 'utf8')) as unknown;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid JSON syntax.';
    console.error(`${fileLabel}: ${message}`);
    process.exit(1);
  }

  try {
    return schema.parse(rawValue);
  } catch (error) {
    if (error instanceof ZodError) {
      for (const issue of error.issues) {
        console.error(`${formatIssuePath(fileLabel, issue.path)}: ${issue.message}`);
      }
      process.exit(1);
    }

    throw error;
  }
}

function getImageDimensions(imagePath: string): { width: number; height: number } | null {
  const file = readFileSync(imagePath);

  if (
    file.length >= 24 &&
    file[0] === 0x89 &&
    file[1] === 0x50 &&
    file[2] === 0x4e &&
    file[3] === 0x47
  ) {
    return {
      width: file.readUInt32BE(16),
      height: file.readUInt32BE(20),
    };
  }

  if (file.length >= 4 && file[0] === 0xff && file[1] === 0xd8) {
    let offset = 2;

    while (offset + 9 < file.length) {
      if (file[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = file[offset + 1];
      const hasDimensions =
        marker === 0xc0 ||
        marker === 0xc1 ||
        marker === 0xc2 ||
        marker === 0xc3;

      const segmentLength = file.readUInt16BE(offset + 2);
      if (hasDimensions) {
        return {
          height: file.readUInt16BE(offset + 5),
          width: file.readUInt16BE(offset + 7),
        };
      }

      if (segmentLength < 2) {
        break;
      }

      offset += 2 + segmentLength;
    }
  }

  return null;
}

const events = parseJsonFile('src/data/events.json', storyEventsSchema);
const visitablePlaces = parseJsonFile('src/data/visitablePlaces.json', visitablePlacesSchema);
const storylines = parseJsonFile('src/data/storylines.json', storylinesSchema);
const localities = parseJsonFile('src/data/localities.json', localitiesSchema);

function isAllowedHost(hostname: string): boolean {
  return allowedHostPatterns.some((pattern) => pattern.test(hostname));
}

function validateUrl(urlValue: string, label: string): void {
  try {
    const parsed = new URL(urlValue);
    if (parsed.protocol !== 'https:') {
      errors.push(`${label} must use HTTPS: ${urlValue}`);
      return;
    }

    if (!isAllowedHost(parsed.hostname)) {
      errors.push(`${label} host is not on the allowlist: ${urlValue}`);
    }
  } catch {
    errors.push(`${label} is not a valid URL: ${urlValue}`);
  }
}

function validateImages(images: StoryImage[], ownerLabel: string): void {
  for (const image of images) {
    if (!image.src.startsWith('/images/')) {
      errors.push(`Image "${image.src}" for ${ownerLabel} must start with "/images/".`);
      continue;
    }

    const imagePath = path.join(publicRoot, image.src.replace(/^\//u, ''));

    if (!existsSync(imagePath)) {
      errors.push(`Image "${image.src}" for ${ownerLabel} is missing from public/.`);
      continue;
    }

    const imageStats = statSync(imagePath);
    if (imageStats.size > 300 * 1024) {
      errors.push(`Image "${image.src}" for ${ownerLabel} exceeds 300 KB.`);
    }

    const dimensions = getImageDimensions(imagePath);
    if (!dimensions) {
      errors.push(
        `Image "${image.src}" for ${ownerLabel} must be a PNG or JPEG with readable dimensions.`,
      );
    } else {
      const longEdge = Math.max(dimensions.width, dimensions.height);
      if (longEdge > 1600) {
        errors.push(`Image "${image.src}" for ${ownerLabel} exceeds 1600px on its long edge.`);
      }
    }

    validateUrl(image.licenseUrl, `Image "${image.src}" licenseUrl`);
    validateUrl(image.sourceUrl, `Image "${image.src}" sourceUrl`);
  }
}

// ---------------------------------------------------------------- localities

function validateLocalities(localityRecords: Locality[]): void {
  const seen = new Set<string>();

  for (const locality of localityRecords) {
    if (seen.has(locality.id)) {
      errors.push(`Duplicate locality id "${locality.id}".`);
    }
    seen.add(locality.id);

    const [[west, south], [east, north]] = locality.bounds;
    if (west >= east || south >= north) {
      errors.push(
        `Locality "${locality.id}" bounds must be [[west, south], [east, north]] with west < east and south < north.`,
      );
      continue;
    }

    const [centerLng, centerLat] = locality.defaultView.center;
    if (
      centerLng < west ||
      centerLng > east ||
      centerLat < south ||
      centerLat > north
    ) {
      errors.push(
        `Locality "${locality.id}" defaultView.center is outside its own bounds.`,
      );
    }
  }
}

function findLocality(
  coordinates: Coordinates,
  localityRecords: Locality[],
): Locality | undefined {
  return localityRecords.find((locality) => {
    const [[west, south], [east, north]] = locality.bounds;
    return (
      coordinates.lng >= west &&
      coordinates.lng <= east &&
      coordinates.lat >= south &&
      coordinates.lat <= north
    );
  });
}

/**
 * Replaces Tier-0's single hard-coded Prague bounding box. Membership is computed,
 * not tagged, so a new event classifies itself — and an event that lands in no
 * locality at all is a real error, because nothing would frame the camera for it.
 */
function validateCoordinatesAgainstLocalities(
  coordinates: Coordinates,
  label: string,
  localityRecords: Locality[],
): void {
  if (!findLocality(coordinates, localityRecords)) {
    errors.push(
      `${label} coordinates (${coordinates.lng}, ${coordinates.lat}) fall outside every locality's bounds. Add a locality or correct the coordinates.`,
    );
  }
}

// -------------------------------------------------------------------- events

function validateEvents(
  eventRecords: StoryEvent[],
  localityRecords: Locality[],
): void {
  const seenEventIds = new Set<string>();
  let proseMissingCount = 0;
  let offMapCount = 0;

  for (const event of eventRecords) {
    if (seenEventIds.has(event.id)) {
      errors.push(`Duplicate event id "${event.id}".`);
    }
    seenEventIds.add(event.id);

    if (event.coordinates) {
      validateCoordinatesAgainstLocalities(
        event.coordinates,
        `Event "${event.id}"`,
        localityRecords,
      );
    } else {
      // Decision #14: legitimate, but it must be deliberate. An off-map event
      // renders as a narrative step with no marker, so the reader needs the note
      // to explain why there is nothing to point at.
      offMapCount += 1;
      if (!event.locationNote) {
        errors.push(
          `Event "${event.id}" has no coordinates and no locationNote. An off-map event needs a note explaining why it has no marker.`,
        );
      }
      if (event.locationPrecision === 'exact') {
        errors.push(
          `Event "${event.id}" has no coordinates but claims "exact" precision.`,
        );
      }
    }

    if (event.yearEnd !== undefined && event.yearEnd < event.yearStart) {
      errors.push(`Event "${event.id}" has yearEnd earlier than yearStart.`);
    }

    if (event.yearStart > currentYear) {
      errors.push(`Event "${event.id}" starts in the future (${event.yearStart}).`);
    }

    if (event.yearEnd !== undefined && event.yearEnd > currentYear) {
      errors.push(`Event "${event.id}" ends in the future (${event.yearEnd}).`);
    }

    validateUrl(event.wikipediaUrl, `Event "${event.id}" wikipediaUrl`);

    if (event.body.length === 0) {
      proseMissingCount += 1;
      warnings.push(`Event "${event.id}" has an empty body array.`);
    }

    validateImages(event.images, `event "${event.id}"`);
  }

  console.log(`${proseMissingCount} of ${eventRecords.length} events still need prose.`);
  console.log(`${offMapCount} events are off-map (no coordinates, narrative steps only).`);
}

// -------------------------------------------------------------------- places

function validateVisitablePlaces(
  placeRecords: VisitablePlace[],
  eventRecords: StoryEvent[],
  localityRecords: Locality[],
): void {
  const eventIds = new Set(eventRecords.map((event) => event.id));
  const seen = new Set<string>();
  let proseMissingCount = 0;

  for (const place of placeRecords) {
    if (seen.has(place.id)) {
      errors.push(`Duplicate visitable place id "${place.id}".`);
    }
    seen.add(place.id);

    if (eventIds.has(place.id)) {
      errors.push(
        `Visitable place "${place.id}" collides with an event id. Entry refs resolve against one shared pool, so node ids must be globally unique.`,
      );
    }

    validateCoordinatesAgainstLocalities(
      place.coordinates,
      `Visitable place "${place.id}"`,
      localityRecords,
    );

    for (const relatedId of place.relatedEventIds) {
      if (!eventIds.has(relatedId)) {
        errors.push(
          `Visitable place "${place.id}" references unknown event id "${relatedId}".`,
        );
      }
    }

    validateUrl(place.wikipediaUrl, `Visitable place "${place.id}" wikipediaUrl`);

    if (place.summary.trim().length === 0 || place.body.length === 0) {
      proseMissingCount += 1;
      warnings.push(`Visitable place "${place.id}" has no summary or body prose.`);
    }

    validateImages(place.images, `visitable place "${place.id}"`);
  }

  console.log(
    `${proseMissingCount} of ${placeRecords.length} visitable places still need prose.`,
  );
}

// ---------------------------------------------------------------- storylines

function validateChapterContiguity(storyline: Storyline): void {
  // Only period chapters carry a range, so only they can be contiguous. A
  // present-kind chapter ("where to see him today") has no years at all and is
  // excluded rather than treated as a gap — Decision #16.
  const periods = storyline.chapters.filter(
    (chapter): chapter is PeriodChapter => chapter.kind === 'period',
  );

  for (let index = 0; index < periods.length; index += 1) {
    const chapter = periods[index];
    const nextChapter = periods[index + 1];

    if (!chapter) {
      continue;
    }

    if (chapter.yearEnd !== null && chapter.yearEnd <= chapter.yearStart) {
      errors.push(
        `Storyline "${storyline.id}" chapter "${chapter.id}" must end after it starts.`,
      );
    }

    if (nextChapter && chapter.yearEnd !== nextChapter.yearStart) {
      errors.push(
        `Storyline "${storyline.id}" period chapters must be contiguous: "${chapter.id}" ends at ${chapter.yearEnd}, but "${nextChapter.id}" starts at ${nextChapter.yearStart}.`,
      );
    }
  }
}

function validateStorylines(
  storylineRecords: Storyline[],
  eventRecords: StoryEvent[],
  placeRecords: VisitablePlace[],
  localityRecords: Locality[],
): void {
  const eventsById = new Map(eventRecords.map((event) => [event.id, event]));
  const placeIds = new Set(placeRecords.map((place) => place.id));
  const localityIds = new Set(localityRecords.map((locality) => locality.id));
  const seenStorylineIds = new Set<string>();

  for (const storyline of storylineRecords) {
    if (seenStorylineIds.has(storyline.id)) {
      errors.push(`Duplicate storyline id "${storyline.id}".`);
    }
    seenStorylineIds.add(storyline.id);

    if (!localityIds.has(storyline.openingView.localityId)) {
      errors.push(
        `Storyline "${storyline.id}" openingView references unknown locality "${storyline.openingView.localityId}".`,
      );
    }

    // Decision #8: genre is derived from categories, but "who he was" is authored,
    // and only a person has a "who".
    if (storyline.roles && storyline.type !== 'person') {
      errors.push(
        `Storyline "${storyline.id}" is type "${storyline.type}" but carries roles. Roles are for person storylines only.`,
      );
    }

    if (storyline.summary.trim().length === 0) {
      warnings.push(`Storyline "${storyline.id}" has an empty summary.`);
    }

    const chapterIds = new Set<string>();
    for (const chapter of storyline.chapters) {
      if (chapterIds.has(chapter.id)) {
        errors.push(
          `Storyline "${storyline.id}" has a duplicate chapter id "${chapter.id}".`,
        );
      }
      chapterIds.add(chapter.id);

      if (chapter.blurb.trim().length === 0) {
        warnings.push(
          `Storyline "${storyline.id}" chapter "${chapter.id}" has an empty blurb.`,
        );
      }
    }

    validateChapterContiguity(storyline);

    const chaptersById = new Map(
      storyline.chapters.map((chapter) => [chapter.id, chapter]),
    );
    const seenRefs = new Set<string>();
    const seenOrdersByChapter = new Map<string, Set<number>>();
    let notesMissingCount = 0;

    for (const entry of storyline.entries) {
      if (seenRefs.has(entry.ref)) {
        errors.push(
          `Storyline "${storyline.id}" lists ref "${entry.ref}" more than once.`,
        );
      }
      seenRefs.add(entry.ref);

      const event = eventsById.get(entry.ref);
      const isPlace = placeIds.has(entry.ref);
      if (!event && !isPlace) {
        errors.push(
          `Storyline "${storyline.id}" entry ref "${entry.ref}" resolves to no event or visitable place.`,
        );
      }

      const chapter = chaptersById.get(entry.chapterId);
      if (!chapter) {
        errors.push(
          `Storyline "${storyline.id}" entry "${entry.ref}" references unknown chapter "${entry.chapterId}".`,
        );
      } else if (event && chapter.kind === 'period') {
        const insideChapter =
          event.yearStart >= chapter.yearStart &&
          (chapter.yearEnd === null || event.yearStart < chapter.yearEnd);
        if (!insideChapter) {
          errors.push(
            `Storyline "${storyline.id}": event "${event.id}" (${event.yearStart}) falls outside chapter "${chapter.id}" [${chapter.yearStart}, ${chapter.yearEnd ?? 'now'}).`,
          );
        }
      }

      // A duplicate order inside one chapter makes reading order depend on array
      // position, which is exactly the silent bug `order` exists to prevent.
      const orders = seenOrdersByChapter.get(entry.chapterId) ?? new Set<number>();
      if (orders.has(entry.order)) {
        errors.push(
          `Storyline "${storyline.id}" chapter "${entry.chapterId}" has two entries with order ${entry.order}.`,
        );
      }
      orders.add(entry.order);
      seenOrdersByChapter.set(entry.chapterId, orders);

      if (entry.note.trim().length === 0) {
        notesMissingCount += 1;
      }
    }

    console.log(
      `Storyline "${storyline.id}" (${storyline.type}): ${storyline.entries.length} entries across ${storyline.chapters.length} chapters, ${notesMissingCount} without a framing note.`,
    );
  }

  // The whole point of the model: a node that appears in more than one storyline
  // is one record read two ways. Report it so a regression to duplicated content
  // is visible.
  const storylinesByRef = new Map<string, string[]>();
  for (const storyline of storylineRecords) {
    for (const entry of storyline.entries) {
      const owners = storylinesByRef.get(entry.ref) ?? [];
      owners.push(storyline.id);
      storylinesByRef.set(entry.ref, owners);
    }
  }

  const shared = [...storylinesByRef.entries()].filter(([, owners]) => owners.length > 1);
  console.log(`${shared.length} nodes appear in more than one storyline:`);
  for (const [ref, owners] of shared) {
    console.log(`  ${ref} → ${owners.join(', ')}`);
  }
}

validateLocalities(localities);
validateEvents(events, localities);
validateVisitablePlaces(visitablePlaces, events, localities);
validateStorylines(storylines, events, visitablePlaces, localities);

for (const warning of warnings) {
  console.warn(`Warning: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`Error: ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log('Content validation passed.');
}
