import { create } from 'zustand';

import type { Era, StoryEvent, Tour } from '../data/schema';
import type { ContentRepository } from '../lib/repository';

export type NavigationMode = 'idle' | 'playing' | 'tour';

export type NavigationState = {
  mode: NavigationMode;
  year: number;
  selectedEventId: string | null;
  flightToken: number;
};

/**
 * Which events are on the map. The era chips and the scrubber are two controls
 * on the same thing — the visible time window — so they share one filter rather
 * than fighting each other.
 *   all     → every event (the default; the map is never empty on arrival)
 *   era     → one chapter, chosen from the chips
 *   century → everything in the playhead's century, chosen by dragging
 */
export type TimeFilter =
  | { kind: 'all' }
  | { kind: 'era'; eraId: string }
  | { kind: 'century'; century: number };

export const centuryOf = (year: number): number => Math.floor(year / 100);

export const centuryLabel = (century: number): string => `${century}00s`;

type AppStatus = 'idle' | 'loading' | 'ready' | 'error';

type AppStore = {
  status: AppStatus;
  eras: Era[];
  events: StoryEvent[];
  tours: Tour[];
  errorMessage: string | null;
  navigation: NavigationState;
  timeFilter: TimeFilter;
  panelEventId: string | null;
  loadContent: (repository: ContentRepository) => Promise<void>;
  setYearFromScrubber: (year: number) => void;
  selectEraFilter: (era: Era) => void;
  clearTimeFilter: () => void;
  selectEra: (year: number) => void;
  selectEvent: (eventId: string | null) => void;
  openPanel: (eventId: string) => void;
  closePanel: () => void;
  issueFlightToken: () => number;
};

export const useAppStore = create<AppStore>((set, get) => ({
  status: 'idle',
  eras: [],
  events: [],
  tours: [],
  errorMessage: null,
  navigation: {
    mode: 'idle',
    year: 870,
    selectedEventId: null,
    flightToken: 0,
  },
  timeFilter: { kind: 'all' },
  panelEventId: null,
  async loadContent(repository) {
    set({ status: 'loading', errorMessage: null });

    try {
      const [eras, events, tours] = await Promise.all([
        repository.getEras(),
        repository.getEvents(),
        repository.getTours(),
      ]);

      const firstEraYear = eras[0]?.yearStart ?? 870;
      set({
        status: 'ready',
        eras,
        events,
        tours,
        timeFilter: { kind: 'all' },
        navigation: {
          mode: 'idle',
          year: firstEraYear,
          selectedEventId: null,
          flightToken: 0,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'The content could not be loaded.';
      set({ status: 'error', errorMessage: message });
    }
  },
  setYearFromScrubber(year) {
    set((state) => ({
      // Dragging the playhead narrows the map to that century, and takes over
      // from any chapter chip — the two controls drive the same window.
      timeFilter: { kind: 'century', century: centuryOf(year) },
      navigation: {
        ...state.navigation,
        mode: 'idle',
        year,
      },
    }));
  },
  selectEraFilter(era) {
    set((state) => ({
      timeFilter: { kind: 'era', eraId: era.id },
      navigation: {
        ...state.navigation,
        mode: 'idle',
        year: era.yearStart,
        selectedEventId: null,
      },
    }));
  },
  clearTimeFilter() {
    set((state) => ({
      timeFilter: { kind: 'all' },
      navigation: { ...state.navigation, mode: 'idle', selectedEventId: null },
    }));
  },
  selectEra(year) {
    set((state) => ({
      navigation: {
        ...state.navigation,
        mode: 'idle',
        year,
        selectedEventId: null,
      },
    }));
  },
  selectEvent(eventId) {
    set((state) => ({
      navigation: {
        ...state.navigation,
        mode: 'idle',
        selectedEventId: eventId,
      },
    }));
  },
  openPanel(eventId) {
    set((state) => ({
      panelEventId: eventId,
      navigation: {
        ...state.navigation,
        mode: 'idle',
        selectedEventId: eventId,
      },
    }));
  },
  closePanel() {
    set({ panelEventId: null });
  },
  issueFlightToken() {
    const nextToken = get().navigation.flightToken + 1;
    set((state) => ({
      navigation: {
        ...state.navigation,
        flightToken: nextToken,
      },
    }));
    return nextToken;
  },
}));

export function getCurrentEra(eras: Era[], year: number): Era | null {
  return (
    eras.find((era) => {
      return year >= era.yearStart && (era.yearEnd === null || year < era.yearEnd);
    }) ?? null
  );
}

export function getTimelineEnd(
  events: StoryEvent[],
  currentYear: number,
): number {
  const maxEventYear = events.reduce((maxYear, event) => {
    const eventEnd = event.yearEnd ?? event.yearStart;
    return Math.max(maxYear, eventEnd);
  }, currentYear);

  return Math.max(currentYear, maxEventYear);
}

export type EventMarkerState = 'hidden' | 'active';

/**
 * An event is on the map when the current window contains it. A span such as the
 * Josefov clearance (1893–1913) counts as inside a century if any part of it falls
 * there, so it is not lost between two windows.
 */
export function isEventInWindow(event: StoryEvent, filter: TimeFilter): boolean {
  switch (filter.kind) {
    case 'all':
      return true;
    case 'era':
      return event.eraId === filter.eraId;
    case 'century': {
      const firstCentury = centuryOf(event.yearStart);
      const lastCentury = centuryOf(event.yearEnd ?? event.yearStart);
      return filter.century >= firstCentury && filter.century <= lastCentury;
    }
  }
}

export function getEventMarkerState(
  event: StoryEvent,
  filter: TimeFilter,
): EventMarkerState {
  return isEventInWindow(event, filter) ? 'active' : 'hidden';
}

export function getVisibleEvents(
  events: StoryEvent[],
  filter: TimeFilter,
): StoryEvent[] {
  return events.filter((event) => isEventInWindow(event, filter));
}

export function describeTimeFilter(
  filter: TimeFilter,
  eras: Era[],
): { title: string; blurb: string } {
  switch (filter.kind) {
    case 'era': {
      const era = eras.find((candidate) => candidate.id === filter.eraId);
      return era
        ? { title: era.name, blurb: era.blurb }
        : { title: 'All of Prague', blurb: '' };
    }
    case 'century':
      return {
        title: centuryLabel(filter.century),
        blurb: 'Showing every event that falls in this century. Pick a chapter below to read about the period, or choose All to see the whole city at once.',
      };
    case 'all':
      return {
        title: 'All of Prague, 870 to today',
        blurb: 'Every event on the map at once. Drag the playhead to narrow to a century, or pick a chapter to focus on one period.',
      };
  }
}

export function getEventsByEra(eras: Era[], events: StoryEvent[]) {
  return eras.map((era) => ({
    era,
    events: events
      .filter((event) => event.eraId === era.id)
      .sort((left, right) => left.yearStart - right.yearStart),
  }));
}
