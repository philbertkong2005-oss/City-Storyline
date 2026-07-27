import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import maplibregl, {
  type Map as MapLibreMap,
  type Marker,
  type Popup,
} from 'maplibre-gl';

import type { Era, StoryEvent } from '../data/schema';
import { getEventMarkerState } from '../store/useAppStore';
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
  currentYear: number;
  currentEra: Era | null;
  selectedEventId: string | null;
  onSelectEvent: (event: StoryEvent) => void;
  onReadMore: (event: StoryEvent) => void;
};

function markerClassName(event: StoryEvent, state: ReturnType<typeof getEventMarkerState>, selected: boolean): string {
  const baseClasses = ['story-marker'];

  if (state === 'active') {
    baseClasses.push('story-marker--active');
  } else if (state === 'dimmed') {
    baseClasses.push('story-marker--dimmed');
  } else {
    baseClasses.push('story-marker--hidden');
  }

  if (event.locationPrecision !== 'exact') {
    baseClasses.push('story-marker--dashed');
  }

  if (selected) {
    baseClasses.push('story-marker--selected');
  }

  return baseClasses.join(' ');
}

export default function EventMarkers({
  map,
  events,
  currentYear,
  currentEra,
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

      const state = getEventMarkerState(event, currentYear, currentEra?.id ?? null);
      record.button.className = markerClassName(
        event,
        state,
        selectedEventId === event.id,
      );
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
  }, [currentEra, currentYear, events, onReadMore, selectedEventId]);

  return null;
}
