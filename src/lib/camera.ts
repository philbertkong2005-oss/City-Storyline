import type { LngLatBoundsLike, Map } from 'maplibre-gl';

import type { Era, StoryEvent } from '../data/schema';

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

export function flyToEvent(
  map: Map,
  event: StoryEvent,
  token: number,
  onComplete?: (token: number) => void,
): void {
  attachMoveEnd(map, token, onComplete);
  map.flyTo({
    center: [event.coordinates.lng, event.coordinates.lat],
    zoom: DEFAULT_EVENT_ZOOM,
    pitch: DEFAULT_PITCH,
    bearing: DEFAULT_BEARING,
    duration: 1400,
    essential: true,
  });
}

export function flyToEra(
  map: Map,
  era: Era,
  events: StoryEvent[],
  token: number,
  onComplete?: (token: number) => void,
): void {
  const eraEvents = events.filter((event) => event.eraId === era.id);

  if (eraEvents.length <= 1) {
    const singleEvent = eraEvents[0];
    if (singleEvent) {
      flyToEvent(map, singleEvent, token, onComplete);
    }
    return;
  }

  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const event of eraEvents) {
    minLng = Math.min(minLng, event.coordinates.lng);
    maxLng = Math.max(maxLng, event.coordinates.lng);
    minLat = Math.min(minLat, event.coordinates.lat);
    maxLat = Math.max(maxLat, event.coordinates.lat);
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
