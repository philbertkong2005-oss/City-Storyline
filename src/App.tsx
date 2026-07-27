import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Map } from 'maplibre-gl';

import type { Era, StoryEvent } from './data/schema';
import EventMarkers from './components/EventMarkers';
import EventPanel from './components/EventPanel';
import ListFallback from './components/ListFallback';
import MapCanvas from './components/MapCanvas';
import EraBands from './components/Timeline/EraBands';
import Scrubber from './components/Timeline/Scrubber';
import WindowNote from './components/Timeline/WindowNote';
import { flyToEra, flyToEvent } from './lib/camera';
import { StaticJsonRepository } from './lib/repository';
import { useMapHealth } from './lib/useMapHealth';
import {
  describeTimeFilter,
  getCurrentEra,
  getEventsByEra,
  getTimelineEnd,
  getVisibleEvents,
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
    navigation,
    timeFilter,
    panelEventId,
    loadContent,
    setYearFromScrubber,
    selectEraFilter,
    clearTimeFilter,
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
  const visibleEvents = getVisibleEvents(events, timeFilter);
  const windowNote = describeTimeFilter(timeFilter, eras);
  const eventGroups = getEventsByEra(eras, visibleEvents);
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

  const handleSelectAll = useCallback(() => {
    clearTimeFilter();
  }, [clearTimeFilter]);

  const handleEraSelect = useCallback(
    (era: Era) => {
      selectEraFilter(era);
      focusEraOnMap(era);
    },
    [focusEraOnMap, selectEraFilter],
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
    <main className="h-screen overflow-hidden px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-3">
        <header className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-[1.5rem] border border-white/60 bg-[#f8f5ef]/80 px-6 py-3 shadow-panel backdrop-blur">
          <div className="flex items-baseline gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
              City-Storyline
            </p>
            <h1 className="font-display text-2xl leading-tight text-slate-950 md:text-[1.75rem]">
              Prague history mapped in time and place.
            </h1>
          </div>
          <p className="text-sm text-slate-600">
            Twenty-three events across eight chapters, 880 to 2002.
          </p>
        </header>

        {bannerMessage ? (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-amber-300/80 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 shadow-sm">
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

        <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="relative min-h-0">
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
                    timeFilter={timeFilter}
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
            <div className="hidden min-h-0 xl:block">
              <ListFallback
                groups={eventGroups}
                currentEraId={currentEra?.id ?? null}
                selectedEventId={navigation.selectedEventId}
                onOpenPanel={handleOpenPanel}
              />
            </div>
          ) : null}
        </section>

        <section className="grid shrink-0 gap-2">
          <div className="rounded-[1.5rem] border border-white/60 bg-[#f8f5ef]/85 shadow-panel backdrop-blur">
            <WindowNote
              title={windowNote.title}
              blurb={windowNote.blurb}
              visibleCount={visibleEvents.length}
              totalCount={events.length}
            />
            <Scrubber
              minYear={eras[0]?.yearStart ?? 870}
              maxYear={timelineEnd}
              year={navigation.year}
              onYearChange={handleYearChange}
            />
          </div>
          <EraBands
            eras={eras}
            timeFilter={timeFilter}
            onSelectEra={handleEraSelect}
            onSelectAll={handleSelectAll}
          />
        </section>
      </div>
    </main>
  );
}
