import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import maplibregl, {
  type Map as MapLibreMap,
  type Marker,
  type Popup,
} from 'maplibre-gl';

import type { StoryEvent } from '../data/schema';
import { BUILDING_SOURCE_LAYER, TILE_SOURCE } from '../lib/mapStyle';
import { getEventMarkerState, type TimeFilter } from '../store/useAppStore';
import EventPopup from './EventPopup';

type FeatureId = string | number;

const MAX_BUILDING_MATCH_METERS = 200;

/**
 * Rough equirectangular distance, accurate enough at Prague's latitude for a
 * same-city plausibility check — not for anything requiring real precision.
 */
function approxMetersBetween(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
): number {
  const metersPerDegLat = 111_320;
  const metersPerDegLng = 111_320 * Math.cos((a.lat * Math.PI) / 180);
  const dLat = (a.lat - b.lat) * metersPerDegLat;
  const dLng = (a.lng - b.lng) * metersPerDegLng;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function geometryCenter(geometry: GeoJSON.Geometry): { lng: number; lat: number } | null {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let found = false;

  const walk = (value: unknown): void => {
    if (
      Array.isArray(value) &&
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      const [lng, lat] = value as [number, number];
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      found = true;
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item);
      }
    }
  };

  walk('coordinates' in geometry ? geometry.coordinates : null);
  return found ? { lng: (minLng + maxLng) / 2, lat: (minLat + maxLat) / 2 } : null;
}

type MarkerRecord = {
  marker: Marker;
  popup: Popup;
  popupRoot: Root;
  button: HTMLButtonElement;
  tooltipTitle: HTMLSpanElement;
  tooltipYear: HTMLSpanElement;
};

type EventMarkersProps = {
  map: MapLibreMap;
  events: StoryEvent[];
  timeFilter: TimeFilter;
  selectedEventId: string | null;
  onSelectEvent: (event: StoryEvent) => void;
  onReadMore: (event: StoryEvent) => void;
};

/**
 * Toggle only our own classes. MapLibre adds `maplibregl-marker` to the element it
 * is given, and that class carries `position:absolute; left:0; top:0` — assigning
 * `element.className` wholesale strips it and drops every pin into normal flow.
 */
function applyMarkerClasses(
  button: HTMLButtonElement,
  event: StoryEvent,
  state: ReturnType<typeof getEventMarkerState>,
  selected: boolean,
): void {
  button.classList.add('story-marker');
  button.classList.toggle('story-marker--active', state === 'active');
  button.classList.toggle('story-marker--hidden', state !== 'active');
  button.classList.toggle('story-marker--dashed', event.locationPrecision !== 'exact');
  button.classList.toggle('story-marker--selected', selected);
}

export default function EventMarkers({
  map,
  events,
  timeFilter,
  selectedEventId,
  onSelectEvent,
  onReadMore,
}: EventMarkersProps) {
  const markerRecordsRef = useRef(new globalThis.Map<string, MarkerRecord>());
  // Which building underlies each event, resolved lazily the first time that
  // patch of the map has loaded tiles — there is no static list, only
  // coordinates, so this has to be a runtime lookup against whatever is
  // actually rendered. Once resolved for an event it is kept forever: the
  // building itself does not move even if the event later scrolls out of the
  // current time window.
  const buildingIdByEventRef = useRef(new globalThis.Map<string, FeatureId>());
  // The set of building ids currently carrying highlight feature-state, so a
  // building can be un-highlighted the instant its event leaves the visible
  // window instead of staying lit from a stale era selection.
  const highlightedIdsRef = useRef(new Set<FeatureId>());

  useEffect(() => {
    const records = markerRecordsRef.current;

    for (const event of events) {
      if (records.has(event.id)) {
        continue;
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', `${event.title}, ${event.yearStart}`);

      const tooltip = document.createElement('span');
      tooltip.className = 'story-marker-tooltip';
      tooltip.setAttribute('aria-hidden', 'true');

      const tooltipTitle = document.createElement('span');
      tooltipTitle.className = 'story-marker-tooltip__title';
      tooltipTitle.textContent = event.title;

      const tooltipYear = document.createElement('span');
      tooltipYear.className = 'story-marker-tooltip__year';
      tooltipYear.textContent = `${event.yearStart}`;

      tooltip.append(tooltipTitle, tooltipYear);
      button.append(tooltip);

      const popupNode = document.createElement('div');
      const popupRoot = createRoot(popupNode);
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnMove: false,
        offset: 18,
        maxWidth: '22rem',
      }).setDOMContent(popupNode);

      const marker = new maplibregl.Marker({
        element: button,
        anchor: 'bottom',
      })
        .setLngLat([event.coordinates.lng, event.coordinates.lat])
        .setPopup(popup)
        .addTo(map);

      button.addEventListener('click', () => {
        onSelectEvent(event);
      });

      records.set(event.id, {
        marker,
        popup,
        popupRoot,
        button,
        tooltipTitle,
        tooltipYear,
      });
    }

    return () => {
      for (const record of markerRecordsRef.current.values()) {
        const { popupRoot } = record;
        record.popup.remove();
        record.marker.remove();
        // Unmounting a React root synchronously inside an effect cleanup happens
        // while React is still rendering, which it warns is a race. A microtask is
        // not enough — it can still flush inside React's work loop — so defer to a
        // macrotask, which is guaranteed to run after the commit finishes.
        setTimeout(() => popupRoot.unmount(), 0);
      }
      markerRecordsRef.current.clear();
    };
  }, [events, map, onSelectEvent]);

  useEffect(() => {
    for (const event of events) {
      const record = markerRecordsRef.current.get(event.id);
      if (!record) {
        continue;
      }

      const state = getEventMarkerState(event, timeFilter);
      const active = state === 'active';

      applyMarkerClasses(record.button, event, state, selectedEventId === event.id);

      // MapLibre stamps its own generic aria-label onto a custom marker element,
      // so re-apply ours or every pin announces as "Map marker".
      record.button.setAttribute('aria-label', `${event.title}, ${event.yearStart}`);
      record.tooltipTitle.textContent = event.title;
      record.tooltipYear.textContent = `${event.yearStart}`;

      // Belt and braces: `display` cannot be defeated by a CSS specificity clash the
      // way an opacity-only hide can, so an out-of-window pin is genuinely gone.
      record.button.style.display = active ? '' : 'none';
      // Hidden markers must not stay in the tab order, or keyboard users land on
      // pins they cannot see.
      record.button.tabIndex = active ? 0 : -1;
      record.button.setAttribute('aria-hidden', active ? 'false' : 'true');
      if (!active) {
        record.popup.remove();
      }
      record.popupRoot.render(
        <EventPopup
          event={event}
          onReadMore={(storyEvent) => {
            onReadMore(storyEvent);
            record.popup.remove();
          }}
        />,
      );
    }
  }, [events, onReadMore, selectedEventId, timeFilter]);

  useEffect(() => {
    const buildingIdByEvent = buildingIdByEventRef.current;
    const highlightedIds = highlightedIdsRef.current;

    const setHighlight = (
      id: FeatureId,
      state: { isEventBuilding: boolean; isSelectedEventBuilding: boolean },
    ): void => {
      map.setFeatureState(
        { source: TILE_SOURCE, sourceLayer: BUILDING_SOURCE_LAYER, id },
        state,
      );
    };

    const resolveAndApply = (): void => {
      // Lazily resolve each exact-precision event's building. Only queryable
      // once its patch of the map has actually loaded tiles, which is why this
      // also runs on every 'idle' — an event far from the initial camera
      // position resolves the moment a flight brings its tiles in.
      for (const event of events) {
        if (event.locationPrecision !== 'exact' || buildingIdByEvent.has(event.id)) {
          continue;
        }

        let features: maplibregl.MapGeoJSONFeature[] = [];
        try {
          const point = map.project([event.coordinates.lng, event.coordinates.lat]);
          features = map.queryRenderedFeatures(point, { layers: ['building-extrusions'] });
        } catch {
          // Map not ready to be queried yet (e.g. style still loading); retry
          // on the next 'idle'.
          continue;
        }

        // queryRenderedFeatures hit-tests the RENDERED (screen-space) extrusion,
        // not the ground footprint. At this map's 55° pitch, a tall or unusually
        // large building can visually occupy a screen pixel far from where it
        // actually stands — observed directly: one candidate near the New Town
        // Hall query point was a MultiPolygon whose real bounding box didn't even
        // reach the event's coordinate, over 500m short. Accept the first
        // candidate whose own geometry is plausibly close to the coordinate we
        // asked about; skip ones that aren't rather than highlight the wrong
        // building.
        const plausible = features.find((feature) => {
          const center = geometryCenter(feature.geometry);
          return (
            center !== null &&
            approxMetersBetween(center, event.coordinates) <= MAX_BUILDING_MATCH_METERS
          );
        });

        if (plausible?.id !== undefined) {
          buildingIdByEvent.set(event.id, plausible.id);
        }
      }

      const desired = new globalThis.Map<FeatureId, { isEventBuilding: boolean; isSelectedEventBuilding: boolean }>();
      for (const event of events) {
        const buildingId = buildingIdByEvent.get(event.id);
        if (buildingId === undefined) {
          continue;
        }

        if (getEventMarkerState(event, timeFilter) !== 'active') {
          continue;
        }

        const existing = desired.get(buildingId);
        const isSelected = event.id === selectedEventId;
        desired.set(buildingId, {
          isEventBuilding: true,
          isSelectedEventBuilding: (existing?.isSelectedEventBuilding ?? false) || isSelected,
        });
      }

      for (const id of highlightedIds) {
        if (!desired.has(id)) {
          setHighlight(id, { isEventBuilding: false, isSelectedEventBuilding: false });
          highlightedIds.delete(id);
        }
      }

      for (const [id, state] of desired) {
        setHighlight(id, state);
        highlightedIds.add(id);
      }
    };

    resolveAndApply();
    map.on('idle', resolveAndApply);

    return () => {
      map.off('idle', resolveAndApply);
    };
  }, [events, map, selectedEventId, timeFilter]);

  return null;
}
