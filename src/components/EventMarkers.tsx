import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import maplibregl, {
  type Map as MapLibreMap,
  type Marker,
  type Popup,
} from 'maplibre-gl';

import { nodeCoordinates, type Coordinates } from '../data/schema';
import { approxMetersBetween } from '../lib/geo';
import { BUILDING_SOURCE_LAYER, TILE_SOURCE } from '../lib/mapStyle';
import {
  getEntryMarkerState,
  type ResolvedEntry,
  type TimeFilter,
} from '../store/useAppStore';
import EventPopup from './EventPopup';

type FeatureId = string | number;

const MAX_BUILDING_MATCH_METERS = 200;

function geometryCenter(geometry: GeoJSON.Geometry): Coordinates | null {
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
  /** The active storyline's entries. Membership, not the whole corpus. */
  entries: ResolvedEntry[];
  timeFilter: TimeFilter;
  selectedEventId: string | null;
  onSelectEntry: (entry: ResolvedEntry) => void;
  onReadMore: (entry: ResolvedEntry) => void;
};

type MarkerFacts = {
  id: string;
  title: string;
  yearLabel: string;
  coordinates: Coordinates;
  isDashed: boolean;
  /** Only exact-precision events drive per-building highlighting. */
  isExactEvent: boolean;
};

/**
 * An entry earns a marker only if its node has coordinates. Decision #14's
 * off-map events are narrative steps: they appear in the list and the scroll, but
 * there is nowhere on this map to point at, and inventing a pin would be a lie.
 */
function markerFactsFor(resolved: ResolvedEntry): MarkerFacts | null {
  const coordinates = nodeCoordinates(resolved.node);
  if (!coordinates) {
    return null;
  }

  if (resolved.node.kind === 'event') {
    const { event } = resolved.node;
    return {
      id: event.id,
      title: event.title,
      yearLabel: `${event.yearStart}`,
      coordinates,
      isDashed: event.locationPrecision !== 'exact',
      isExactEvent: event.locationPrecision === 'exact',
    };
  }

  const { place } = resolved.node;
  return {
    id: place.id,
    title: place.title,
    yearLabel: 'Today',
    coordinates,
    isDashed: false,
    isExactEvent: false,
  };
}

/**
 * Toggle only our own classes. MapLibre adds `maplibregl-marker` to the element it
 * is given, and that class carries `position:absolute; left:0; top:0` — assigning
 * `element.className` wholesale strips it and drops every pin into normal flow.
 */
function applyMarkerClasses(
  button: HTMLButtonElement,
  facts: MarkerFacts,
  active: boolean,
  selected: boolean,
): void {
  button.classList.add('story-marker');
  button.classList.toggle('story-marker--active', active);
  button.classList.toggle('story-marker--hidden', !active);
  button.classList.toggle('story-marker--dashed', facts.isDashed);
  button.classList.toggle('story-marker--selected', selected);
}

export default function EventMarkers({
  map,
  entries,
  timeFilter,
  selectedEventId,
  onSelectEntry,
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
  // window instead of staying lit from a stale chapter selection.
  const highlightedIdsRef = useRef(new Set<FeatureId>());

  useEffect(() => {
    const records = markerRecordsRef.current;
    const wanted = new Set<string>();

    for (const resolved of entries) {
      const facts = markerFactsFor(resolved);
      if (!facts) {
        continue;
      }
      wanted.add(facts.id);

      if (records.has(facts.id)) {
        continue;
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', `${facts.title}, ${facts.yearLabel}`);

      const tooltip = document.createElement('span');
      tooltip.className = 'story-marker-tooltip';
      tooltip.setAttribute('aria-hidden', 'true');

      const tooltipTitle = document.createElement('span');
      tooltipTitle.className = 'story-marker-tooltip__title';
      tooltipTitle.textContent = facts.title;

      const tooltipYear = document.createElement('span');
      tooltipYear.className = 'story-marker-tooltip__year';
      tooltipYear.textContent = facts.yearLabel;

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
        .setLngLat([facts.coordinates.lng, facts.coordinates.lat])
        .setPopup(popup)
        .addTo(map);

      button.addEventListener('click', () => {
        onSelectEntry(resolved);
      });

      records.set(facts.id, {
        marker,
        popup,
        popupRoot,
        button,
        tooltipTitle,
        tooltipYear,
      });
    }

    // Switching storyline swaps the entry set wholesale, so markers for nodes that
    // are not in the new storyline have to go rather than linger as orphans.
    for (const [id, record] of records) {
      if (wanted.has(id)) {
        continue;
      }
      record.popup.remove();
      record.marker.remove();
      const { popupRoot } = record;
      setTimeout(() => popupRoot.unmount(), 0);
      records.delete(id);
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
  }, [entries, map, onSelectEntry]);

  useEffect(() => {
    for (const resolved of entries) {
      const facts = markerFactsFor(resolved);
      if (!facts) {
        continue;
      }

      const record = markerRecordsRef.current.get(facts.id);
      if (!record) {
        continue;
      }

      const active = getEntryMarkerState(resolved, timeFilter) === 'active';

      applyMarkerClasses(record.button, facts, active, selectedEventId === facts.id);

      // MapLibre stamps its own generic aria-label onto a custom marker element,
      // so re-apply ours or every pin announces as "Map marker".
      record.button.setAttribute('aria-label', `${facts.title}, ${facts.yearLabel}`);
      record.tooltipTitle.textContent = facts.title;
      record.tooltipYear.textContent = facts.yearLabel;

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
          entry={resolved}
          onReadMore={(target) => {
            onReadMore(target);
            record.popup.remove();
          }}
        />,
      );
    }
  }, [entries, onReadMore, selectedEventId, timeFilter]);

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
      for (const resolved of entries) {
        const facts = markerFactsFor(resolved);
        if (!facts?.isExactEvent || buildingIdByEvent.has(facts.id)) {
          continue;
        }

        // Bail before querying rather than after failing. MapLibre *fires* an
        // error event for an unknown layer instead of throwing, so a try/catch
        // never sees it and the console fills with "layer does not exist" on
        // every run before the style has loaded.
        if (!map.getLayer('building-extrusions')) {
          continue;
        }

        let features: maplibregl.MapGeoJSONFeature[] = [];
        try {
          const point = map.project([facts.coordinates.lng, facts.coordinates.lat]);
          features = map.queryRenderedFeatures(point, { layers: ['building-extrusions'] });
        } catch {
          // Map not ready to be queried yet; retry on the next 'idle'.
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
            approxMetersBetween(center, facts.coordinates) <= MAX_BUILDING_MATCH_METERS
          );
        });

        if (plausible?.id !== undefined) {
          buildingIdByEvent.set(facts.id, plausible.id);
        }
      }

      const desired = new globalThis.Map<FeatureId, { isEventBuilding: boolean; isSelectedEventBuilding: boolean }>();
      for (const resolved of entries) {
        const facts = markerFactsFor(resolved);
        if (!facts) {
          continue;
        }

        const buildingId = buildingIdByEvent.get(facts.id);
        if (buildingId === undefined) {
          continue;
        }

        if (getEntryMarkerState(resolved, timeFilter) !== 'active') {
          continue;
        }

        const existing = desired.get(buildingId);
        const isSelected = facts.id === selectedEventId;
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
  }, [entries, map, selectedEventId, timeFilter]);

  return null;
}
