import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ZodError, type ZodType } from 'zod';

import {
  erasSchema,
  storyEventsSchema,
  toursSchema,
  type Era,
  type StoryEvent,
  type Tour,
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
    'eras.json': 'era',
    'tours.json': 'tour',
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

function parseJsonFile<T>(relativePath: string, schema: ZodType<T>): T {
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

const eras = parseJsonFile('src/data/eras.json', erasSchema);
const events = parseJsonFile('src/data/events.json', storyEventsSchema);
const tours = parseJsonFile('src/data/tours.json', toursSchema);

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

function validateEras(eraRecords: Era[]): void {
  for (let index = 0; index < eraRecords.length; index += 1) {
    const era = eraRecords[index];
    const nextEra = eraRecords[index + 1];

    if (!era) {
      continue;
    }

    if (era.yearEnd !== null && era.yearEnd <= era.yearStart) {
      errors.push(`Era "${era.id}" must end after it starts.`);
    }

    if (nextEra && era.yearEnd !== nextEra.yearStart) {
      errors.push(
        `Eras must be contiguous: "${era.id}" ends at ${era.yearEnd}, but "${nextEra.id}" starts at ${nextEra.yearStart}.`,
      );
    }
  }
}

function findEraForEvent(event: StoryEvent, eraRecords: Era[]): Era | undefined {
  return eraRecords.find((era) => era.id === event.eraId);
}

function validateEvents(eventRecords: StoryEvent[], eraRecords: Era[]): void {
  const seenEventIds = new Set<string>();
  let proseMissingCount = 0;

  for (const event of eventRecords) {
    if (seenEventIds.has(event.id)) {
      errors.push(`Duplicate event id "${event.id}".`);
    }
    seenEventIds.add(event.id);

    if (
      event.coordinates.lng < 14.22 ||
      event.coordinates.lng > 14.71 ||
      event.coordinates.lat < 49.94 ||
      event.coordinates.lat > 50.18
    ) {
      errors.push(`Event "${event.id}" coordinates are outside the Prague bounding box.`);
    }

    const era = findEraForEvent(event, eraRecords);
    if (!era) {
      errors.push(`Event "${event.id}" references unknown era "${event.eraId}".`);
    } else {
      const insideEra =
        event.yearStart >= era.yearStart &&
        (era.yearEnd === null || event.yearStart < era.yearEnd);
      if (!insideEra) {
        errors.push(
          `Event "${event.id}" yearStart ${event.yearStart} falls outside era "${era.id}".`,
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

    for (const image of event.images) {
      if (!image.src.startsWith('/images/')) {
        errors.push(
          `Image "${image.src}" for event "${event.id}" must start with "/images/".`,
        );
        continue;
      }

      const imagePath = path.join(publicRoot, image.src.replace(/^\//u, ''));

      if (!existsSync(imagePath)) {
        errors.push(`Image "${image.src}" for event "${event.id}" is missing from public/.`);
        continue;
      }

      const imageStats = statSync(imagePath);
      if (imageStats.size > 300 * 1024) {
        errors.push(`Image "${image.src}" for event "${event.id}" exceeds 300 KB.`);
      }

      const dimensions = getImageDimensions(imagePath);
      if (!dimensions) {
        errors.push(
          `Image "${image.src}" for event "${event.id}" must be a PNG or JPEG with readable dimensions.`,
        );
      } else {
        const longEdge = Math.max(dimensions.width, dimensions.height);
        if (longEdge > 1600) {
          errors.push(
            `Image "${image.src}" for event "${event.id}" exceeds 1600px on its long edge.`,
          );
        }
      }

      validateUrl(image.licenseUrl, `Image "${image.src}" licenseUrl`);
      validateUrl(image.sourceUrl, `Image "${image.src}" sourceUrl`);
    }
  }

  console.log(`${proseMissingCount} of ${eventRecords.length} events still need prose.`);
}

function validateTours(tourRecords: Tour[], eventRecords: StoryEvent[]): void {
  const eventIds = new Set(eventRecords.map((event) => event.id));

  for (const tour of tourRecords) {
    for (const eventId of tour.eventIds) {
      if (!eventIds.has(eventId)) {
        errors.push(`Tour "${tour.id}" references unknown event id "${eventId}".`);
      }
    }
  }
}

validateEras(eras);
validateEvents(events, eras);
validateTours(tours, events);

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
