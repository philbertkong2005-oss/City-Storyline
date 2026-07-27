import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import maplibregl, {
  type Map as MapLibreMap,
  type Marker,
  type Popup,
} from 'maplibre-gl';

import type { StoryEvent } from '../data/schema';
import { getEventMarkerState, type TimeFilter } from '../store/useAppStore';
import EventPopup from './EventPopup';

type MarkerRecord = {
  marker: Marker;
  popup: Popup;
  popupRoot: Root;
  button: HTMLButtonElement;
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

  useEffect(() => {
    const records = markerRecordsRef.current;

    for (const event of events) {
      if (records.has(event.id)) {
        continue;
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', `${event.title}, ${event.yearStart}`);

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
      });
    }

    return () => {
      for (const record of markerRecordsRef.current.values()) {
        record.popupRoot.unmount();
        record.popup.remove();
        record.marker.remove();
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

  return null;
}
