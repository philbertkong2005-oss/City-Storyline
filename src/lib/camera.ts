import type { LngLatBoundsLike, Map } from 'maplibre-gl';

import { nodeCoordinates, type Chapter, type Coordinates } from '../data/schema';
import type { ResolvedEntry } from '../store/useAppStore';

const DEFAULT_BEARING = -20;
const DEFAULT_PITCH = 55;
const DEFAULT_EVENT_ZOOM = 15.8;

function attachMoveEnd(
  map: Map,
  token: number,
  onComplete?: (token: number) => void,
): void {
  if (!onComplete) {
    return;
  }

  const handleMoveEnd = (): void => {
    map.off('moveend', handleMoveEnd);
    onComplete(token);
  };

  map.on('moveend', handleMoveEnd);
}

export function flyToCoordinates(
  map: Map,
  coordinates: Coordinates,
  token: number,
  onComplete?: (token: number) => void,
): void {
  attachMoveEnd(map, token, onComplete);
  map.flyTo({
    center: [coordinates.lng, coordinates.lat],
    zoom: DEFAULT_EVENT_ZOOM,
    pitch: DEFAULT_PITCH,
    bearing: DEFAULT_BEARING,
    duration: 1400,
    essential: true,
  });
}

/**
 * Frames a chapter's entries. Entries with no coordinates are skipped rather than
 * defaulted to some fallback point: Decision #14's off-map events are narrative
 * steps, and the camera holding position is the specified behaviour. A chapter
 * made up entirely of off-map entries therefore moves the camera not at all.
 */
export function flyToChapter(
  map: Map,
  chapter: Chapter,
  entries: ResolvedEntry[],
  token: number,
  onComplete?: (token: number) => void,
): void {
  const located = entries
    .filter((resolved) => resolved.entry.chapterId === chapter.id)
    .map((resolved) => nodeCoordinates(resolved.node))
    .filter((coordinates): coordinates is Coordinates => coordinates !== undefined);

  if (located.length === 0) {
    return;
  }

  if (located.length === 1) {
    const [only] = located;
    if (only) {
      flyToCoordinates(map, only, token, onComplete);
    }
    return;
  }

  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const coordinates of located) {
    minLng = Math.min(minLng, coordinates.lng);
    maxLng = Math.max(maxLng, coordinates.lng);
    minLat = Math.min(minLat, coordinates.lat);
    maxLat = Math.max(maxLat, coordinates.lat);
  }

  const bounds: LngLatBoundsLike = [
    [minLng, minLat],
    [maxLng, maxLat],
  ];

  attachMoveEnd(map, token, onComplete);
  map.fitBounds(bounds, {
    padding: { top: 72, right: 360, bottom: 180, left: 72 },
    maxZoom: 15.4,
    pitch: DEFAULT_PITCH,
    bearing: DEFAULT_BEARING,
    duration: 1500,
    essential: true,
  });
}
