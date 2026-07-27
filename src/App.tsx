import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Map } from 'maplibre-gl';

import type { Era, StoryEvent } from './data/schema';
import EventMarkers from './components/EventMarkers';
import EventPanel from './components/EventPanel';
import ListFallback from './components/ListFallback';
import MapCanvas from './components/MapCanvas';
import EraBands from './components/Timeline/EraBands';
import Scrubber from './components/Timeline/Scrubber';
import { flyToEra, flyToEvent } from './lib/camera';
import { StaticJsonRepository } from './lib/repository';
import { useMapHealth } from './lib/useMapHealth';
import {
  getCurrentEra,
  getEventsByEra,
  getTimelineEnd,
  useAppStore,
} from './store/useAppStore';

function useLargeScreen(): boolean {
  const [largeScreen, setLargeScreen] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    return window.matchMedia('(min-width: 768px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleChange = (event: MediaQueryListEvent): void => {
      setLargeScreen(event.matches);
    };

    setLargeScreen(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return largeScreen;
}

export default function App() {
  const repository = useMemo(() => new StaticJsonRepository(), []);
  const largeScreen = useLargeScreen();
  const {
    hasFailed,
    bannerMessage,
    dismissBanner,
    retryMap,
    attachMap,
    reportUnsupported,
  } = useMapHealth();
  const [map, setMap] = useState<Map | null>(null);
  const [mapRetryKey, setMapRetryKey] = useState(0);

  const {
    status,
    eras,
    events,
    errorMessage,
    tours,
    navigation,
    panelEventId,
    loadContent,
    setYearFromScrubber,
    selectEra,
    selectEvent,
    openPanel,
    closePanel,
    issueFlightToken,
  } = useAppStore();

  useEffect(() => {
    void loadContent(repository);
  }, [loadContent, repository]);

  useEffect(() => {
    attachMap(map);
  }, [attachMap, map]);

  const timelineEnd = getTimelineEnd(events, new Date().getFullYear());
  const currentEra = getCurrentEra(eras, navigation.year);
  const eventGroups = getEventsByEra(eras, events);
  const panelEvent = events.find((event) => event.id === panelEventId) ?? null;
  const panelEra = panelEvent ? eras.find((era) => era.id === panelEvent.eraId) ?? null : null;
  const showListFallback = !largeScreen || hasFailed;

  const completeFlight = useCallback((token: number) => {
    if (useAppStore.getState().navigation.flightToken !== token) {
      return;
    }

    // Tier-0 has no post-flight side effect yet; later playback and tour flows consume accepted completions.
  }, []);

  const focusEventOnMap = useCallback(
    (event: StoryEvent) => {
      if (!map) {
        return;
      }

      const token = issueFlightToken();
      flyToEvent(map, event, token, completeFlight);
    },
    [completeFlight, issueFlightToken, map],
  );

  const focusEraOnMap = useCallback(
    (era: Era) => {
      if (!map) {
        return;
      }

      const token = issueFlightToken();
      flyToEra(map, era, events, token, completeFlight);
    },
    [completeFlight, events, issueFlightToken, map],
  );

  const handleYearChange = useCallback(
    (year: number) => {
      setYearFromScrubber(year);
    },
    [setYearFromScrubber],
  );

  const handleEraSelect = useCallback(
    (era: Era) => {
      selectEra(era.yearStart);
      focusEraOnMap(era);
    },
    [focusEraOnMap, selectEra],
  );

  const handleSelectEvent = useCallback(
    (event: StoryEvent) => {
      selectEvent(event.id);
      focusEventOnMap(event);
    },
    [focusEventOnMap, selectEvent],
  );

  const handleOpenPanel = useCallback(
    (event: StoryEvent) => {
      openPanel(event.id);
      focusEventOnMap(event);
    },
    [focusEventOnMap, openPanel],
  );

  const handleRetryMap = useCallback(() => {
    setMap(null);
    retryMap();
    setMapRetryKey((current) => current + 1);
  }, [retryMap]);

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-10 text-slate-700">
        Loading Prague's storyline…
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="max-w-lg rounded-[2rem] border border-rose-200 bg-white/90 p-8 text-slate-900 shadow-panel">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-rose-600">
            Content error
          </p>
          <h1 className="mt-3 font-display text-4xl">City-Storyline could not load.</h1>
          <p className="mt-4 text-base leading-7 text-slate-700">
            {errorMessage ?? 'An unknown error prevented the content from loading.'}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] flex-col gap-4">
        <header className="grid gap-4 rounded-[2rem] border border-white/60 bg-[#f8f5ef]/80 px-6 py-5 shadow-panel backdrop-blur md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
              City-Storyline
            </p>
            <h1 className="mt-2 font-display text-4xl leading-tight text-slate-950 md:text-5xl">
              Prague history mapped in time and place.
            </h1>
          </div>
          <div className="text-sm leading-7 text-slate-700">
            <p>
              The timeline drives twenty-three verified event markers across eight chapters, from the founding of Prague Castle to the Vltava floods of 2002.
            </p>
            <p className="mt-2">
              Map unavailable or screen too narrow? The full list view and side panel still work.
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-500">
              {tours.length} tours are validated in data only for later tiers.
            </p>
          </div>
        </header>

        {bannerMessage ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-amber-300/80 bg-amber-50 px-5 py-4 text-sm text-amber-950 shadow-sm">
            <p>{bannerMessage}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRetryMap}
                className="rounded-full border border-amber-500 bg-amber-100 px-3 py-1 font-semibold transition hover:bg-amber-200"
              >
                Try the map again
              </button>
              <button
                type="button"
                onClick={dismissBanner}
                className="rounded-full border border-amber-400 px-3 py-1 font-semibold transition hover:bg-amber-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        <section className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="relative min-h-[32rem]">
            {showListFallback ? (
              <ListFallback
                groups={eventGroups}
                currentEraId={currentEra?.id ?? null}
                selectedEventId={navigation.selectedEventId}
                onOpenPanel={handleOpenPanel}
              />
            ) : (
              <>
                <MapCanvas
                  key={mapRetryKey}
                  onMapReady={setMap}
                  onMapUnavailable={reportUnsupported}
                />
                {map ? (
                  <EventMarkers
                    map={map}
                    events={events}
                    currentYear={navigation.year}
                    currentEra={currentEra}
                    selectedEventId={navigation.selectedEventId}
                    onSelectEvent={handleSelectEvent}
                    onReadMore={handleOpenPanel}
                  />
                ) : null}
              </>
            )}
            <EventPanel
              event={panelEvent}
              era={panelEra}
              open={panelEvent !== null}
              onClose={closePanel}
            />
          </div>

          {!showListFallback ? (
            <div className="hidden xl:block">
              <ListFallback
                groups={eventGroups}
                currentEraId={currentEra?.id ?? null}
                selectedEventId={navigation.selectedEventId}
                onOpenPanel={handleOpenPanel}
              />
            </div>
          ) : null}
        </section>

        <section className="grid gap-4">
          <Scrubber
            minYear={eras[0]?.yearStart ?? 870}
            maxYear={timelineEnd}
            year={navigation.year}
            currentEra={currentEra}
            onYearChange={handleYearChange}
          />
          <EraBands
            eras={eras}
            timelineEnd={timelineEnd}
            currentEraId={currentEra?.id ?? null}
            onSelectEra={handleEraSelect}
          />
        </section>
      </div>
    </main>
  );
}
