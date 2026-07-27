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

type AppStatus = 'idle' | 'loading' | 'ready' | 'error';

type AppStore = {
  status: AppStatus;
  eras: Era[];
  events: StoryEvent[];
  tours: Tour[];
  errorMessage: string | null;
  navigation: NavigationState;
  panelEventId: string | null;
  loadContent: (repository: ContentRepository) => Promise<void>;
  setYearFromScrubber: (year: number) => void;
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
      navigation: {
        ...state.navigation,
        mode: 'idle',
        year,
      },
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

export type EventMarkerState = 'hidden' | 'dimmed' | 'active';

export function getEventMarkerState(
  event: StoryEvent,
  currentYear: number,
  currentEraId: string | null,
): EventMarkerState {
  if (event.yearStart > currentYear) {
    return 'hidden';
  }

  const isOngoing = event.yearEnd === undefined || currentYear < event.yearEnd;
  if (event.eraId === currentEraId && isOngoing) {
    return 'active';
  }

  return 'dimmed';
}

export function getEventsByEra(eras: Era[], events: StoryEvent[]) {
  return eras.map((era) => ({
    era,
    events: events
      .filter((event) => event.eraId === era.id)
      .sort((left, right) => left.yearStart - right.yearStart),
  }));
}
