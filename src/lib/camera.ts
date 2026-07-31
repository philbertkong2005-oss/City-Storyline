import type { CameraOptions, LngLatBoundsLike, Map } from 'maplibre-gl';

import {
  nodeCoordinates,
  type Chapter,
  type Coordinates,
  type Locality,
} from '../data/schema';
import { approxMetersBetween, getLocalityFor } from './geo';
import type { ResolvedEntry } from '../store/useAppStore';

const DEFAULT_BEARING = -20;
const DEFAULT_PITCH = 55;
const DEFAULT_EVENT_ZOOM = 15.8;

const MIN_FLIGHT_MS = 1200;
const MAX_FLIGHT_MS = 3400;

export type FlightOptions = {
  /** Stale-flight guard: the store's flightToken for this move. */
  token: number;
  /**
   * Reduced motion. Cuts straight to the destination instead of animating —
   * `jumpTo` rather than `flyTo`, per PLAN-V2's front-door spec.
   */
  instant?: boolean;
  onComplete?: (token: number) => void;
};

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

/**
 * A hop across town and a hop across Bohemia should not take the same time. The
 * long one has to zoom out far enough to drop the city model and bring it back,
 * and at 1.4s that reads as a glitch rather than a journey.
 */
function flightDuration(map: Map, target: Coordinates): number {
  const current = map.getCenter();
  const metres = approxMetersBetween(
    { lng: current.lng, lat: current.lat },
    target,
  );
  return Math.min(MAX_FLIGHT_MS, Math.max(MIN_FLIGHT_MS, 1200 + metres / 20));
}

/**
 * Arrival framing comes from the destination's locality, not from one global
 * constant. Prague wants a wide pitched city shot and Karlštejn is a single
 * castle on a hill; no formula produces both, so `defaultView` is authored.
 */
function arrivalFraming(
  coordinates: Coordinates,
  localities: Locality[],
): { pitch: number; bearing: number } {
  const locality = getLocalityFor(coordinates, localities);
  return {
    pitch: locality?.defaultView.pitch ?? DEFAULT_PITCH,
    bearing: locality?.defaultView.bearing ?? DEFAULT_BEARING,
  };
}

/**
 * One place decides animate-or-jump, so reduced motion cannot be honoured in
 * three camera helpers and forgotten in a fourth.
 */
function moveCamera(
  map: Map,
  camera: CameraOptions & { center: [number, number] },
  duration: number,
  { token, instant, onComplete }: FlightOptions,
): void {
  attachMoveEnd(map, token, onComplete);

  if (instant) {
    map.jumpTo(camera);
    return;
  }

  // No intermediate waypoints and no scripted zoom-out: flyTo's own parabolic
  // path already arcs high enough on a long hop that `building-extrusions`
  // (minzoom 13) drops out in the middle and returns on arrival. The city
  // dissolving and reforming is a consequence of the zoom thresholds, not
  // something choreographed on top of them.
  map.flyTo({ ...camera, duration, essential: true });
}

export function flyToCoordinates(
  map: Map,
  coordinates: Coordinates,
  localities: Locality[],
  options: FlightOptions,
): void {
  const { pitch, bearing } = arrivalFraming(coordinates, localities);
  moveCamera(
    map,
    {
      center: [coordinates.lng, coordinates.lat],
      zoom: DEFAULT_EVENT_ZOOM,
      pitch,
      bearing,
    },
    flightDuration(map, coordinates),
    options,
  );
}

/** Lands on a place using its authored framing, rather than on one of its events. */
export function flyToLocality(
  map: Map,
  locality: Locality,
  options: FlightOptions,
): void {
  const [lng, lat] = locality.defaultView.center;
  moveCamera(
    map,
    {
      center: locality.defaultView.center,
      zoom: locality.defaultView.zoom,
      pitch: locality.defaultView.pitch,
      bearing: locality.defaultView.bearing,
    },
    flightDuration(map, { lng, lat }),
    options,
  );
}

/** Lands on a storyline's authored opening shot. */
export function flyToOpeningView(
  map: Map,
  openingView: { center: [number, number]; zoom: number; pitch: number; bearing: number },
  options: FlightOptions,
): void {
  const [lng, lat] = openingView.center;
  moveCamera(
    map,
    {
      center: openingView.center,
      zoom: openingView.zoom,
      pitch: openingView.pitch,
      bearing: openingView.bearing,
    },
    flightDuration(map, { lng, lat }),
    options,
  );
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
  localities: Locality[],
  options: FlightOptions,
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
      flyToCoordinates(map, only, localities, options);
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

  // A chapter can straddle localities — Charles IV's "King of Bohemia" holds both
  // Prague and Karlštejn, 23km apart — so framing comes from wherever the
  // chapter's centre of gravity lands, and fitBounds picks the zoom.
  const centre = { lng: (minLng + maxLng) / 2, lat: (minLat + maxLat) / 2 };
  const { pitch, bearing } = arrivalFraming(centre, localities);
  const { token, instant, onComplete } = options;

  attachMoveEnd(map, token, onComplete);
  map.fitBounds(bounds, {
    padding: { top: 96, right: 96, bottom: 220, left: 96 },
    maxZoom: 15.4,
    pitch,
    bearing,
    duration: instant ? 0 : flightDuration(map, centre),
    essential: true,
  });
}
