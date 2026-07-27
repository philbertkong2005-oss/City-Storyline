import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Map } from 'maplibre-gl';

import type { Era, StoryEvent } from './data/schema';
import EventMarkers from './components/EventMarkers';
import EventPanel from './components/EventPanel';
import IconRail from './components/IconRail';
import ListFallback from './components/ListFallback';
import MapCanvas from './components/MapCanvas';
import Splitter from './components/Splitter';
import EraBands from './components/Timeline/EraBands';
import Scrubber from './components/Timeline/Scrubber';
import WindowNote from './components/Timeline/WindowNote';
import { flyToEra, flyToEvent } from './lib/camera';
import { StaticJsonRepository } from './lib/repository';
import { useMapHealth } from './lib/useMapHealth';
import {
  DEFAULT_RIGHT_COLUMN_SPLIT,
  getCurrentEra,
  getEventsByEra,
  getTimelineEnd,
  getVisibleEvents,
  MAX_RIGHT_COLUMN_WIDTH,
  MIN_BOTTOM_REGION_HEIGHT,
  MIN_RIGHT_COLUMN_WIDTH,
  type PanelId,
  describeTimeFilter,
  useAppStore,
} from './store/useAppStore';

const MIN_RIGHT_PANEL_HEIGHT = 8 * 16;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

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

/**
 * Measures an element and keeps a ref to it.
 *
 * Uses a callback ref rather than observing `ref.current` in a mount-only effect:
 * content loads asynchronously, so App renders a loading screen first and these
 * elements do not exist yet on first mount. An effect keyed on a stable ref object
 * would bail once and never re-run, leaving every measurement at 0 — which silently
 * collapses the splitter clamps to their minimums.
 */
function useMeasuredRef<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0, scrollHeight: 0 });

  const setRef = useCallback((element: T | null) => {
    ref.current = element;
    setNode(element);
  }, []);

  useEffect(() => {
    if (!node) {
      return;
    }

    const measure = (): void => {
      setSize({
        width: node.clientWidth,
        height: node.clientHeight,
        scrollHeight: node.scrollHeight,
      });
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => observer.disconnect();
  }, [node]);

  return { ref, setRef, size };
}

function getClampedRightColumnWidth(rawWidth: number, availableWidth: number): number {
  const maxWidth = Math.min(
    MAX_RIGHT_COLUMN_WIDTH,
    Math.max(MIN_RIGHT_COLUMN_WIDTH, availableWidth - 1),
  );
  return clamp(rawWidth, MIN_RIGHT_COLUMN_WIDTH, maxWidth);
}

function getClampedBottomRegionHeight(
  rawHeight: number,
  naturalHeight: number,
  availableHeight: number,
): number {
  const maxHeight = Math.min(
    Math.max(MIN_BOTTOM_REGION_HEIGHT, availableHeight * 0.6),
    Math.max(MIN_BOTTOM_REGION_HEIGHT, availableHeight - 1),
  );
  const baseHeight = rawHeight === 0 ? naturalHeight : rawHeight;
  return clamp(baseHeight, MIN_BOTTOM_REGION_HEIGHT, maxHeight);
}

function getRightColumnSplitHeights(
  ratio: number,
  totalHeight: number,
): { topHeight: number; bottomHeight: number } {
  if (totalHeight <= MIN_RIGHT_PANEL_HEIGHT * 2) {
    const topHeight = totalHeight / 2;
    return {
      topHeight,
      bottomHeight: totalHeight - topHeight,
    };
  }

  const topHeight = clamp(
    totalHeight * ratio,
    MIN_RIGHT_PANEL_HEIGHT,
    totalHeight - MIN_RIGHT_PANEL_HEIGHT,
  );

  return {
    topHeight,
    bottomHeight: totalHeight - topHeight,
  };
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
    ref: workspaceRef,
    setRef: setWorkspaceRef,
    size: workspaceSize,
  } = useMeasuredRef<HTMLDivElement>();
  const {
    ref: mainRegionRef,
    setRef: setMainRegionRef,
    size: mainRegionSize,
  } = useMeasuredRef<HTMLDivElement>();
  const { setRef: setBottomMeasureRef, size: bottomContentSize } =
    useMeasuredRef<HTMLDivElement>();
  const rightColumnRef = useRef<HTMLDivElement | null>(null);

  const {
    status,
    eras,
    events,
    errorMessage,
    navigation,
    timeFilter,
    panelEventId,
    layout,
    loadContent,
    setYearFromScrubber,
    selectEraFilter,
    clearTimeFilter,
    openPanel,
    closePanel,
    togglePanel,
    resetLayout,
    setRightColumnWidth,
    setBottomRegionHeight,
    setRightColumnSplit,
    issueFlightToken,
  } = useAppStore();

  useEffect(() => {
    void loadContent(repository);
  }, [loadContent, repository]);

  useEffect(() => {
    attachMap(map);
  }, [attachMap, map]);

  const desktopMapMode = largeScreen && !hasFailed;
  const panelVisibility = layout.panels;
  const showRail = desktopMapMode;
  const showRightColumn = desktopMapMode && (panelVisibility.eventList || panelVisibility.description);
  const showBottomRegion = panelVisibility.timeline || panelVisibility.chapters;
  const showStackedDescription = !desktopMapMode && panelVisibility.description;

  const timelineEnd = getTimelineEnd(events, new Date().getFullYear());
  const currentEra = getCurrentEra(eras, navigation.year);
  const visibleEvents = getVisibleEvents(events, timeFilter);
  const windowNote = describeTimeFilter(timeFilter, eras);
  const eventGroups = getEventsByEra(eras, visibleEvents);
  const panelEvent = events.find((event) => event.id === panelEventId) ?? null;
  const panelEra = panelEvent ? eras.find((era) => era.id === panelEvent.eraId) ?? null : null;

  const bottomRegionHeight = showBottomRegion
    ? getClampedBottomRegionHeight(
        layout.bottomRegionHeight,
        bottomContentSize.scrollHeight,
        workspaceSize.height,
      )
    : 0;

  const rightColumnWidth = showRightColumn
    ? getClampedRightColumnWidth(layout.rightColumnWidth, mainRegionSize.width)
    : 0;

  const rightColumnHeights =
    panelVisibility.eventList && panelVisibility.description
      ? getRightColumnSplitHeights(layout.rightColumnSplit, mainRegionSize.height)
      : null;

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
      openPanel(event.id);
      focusEventOnMap(event);
    },
    [focusEventOnMap, openPanel],
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

  const handleTogglePanel = useCallback(
    (panelId: PanelId) => {
      togglePanel(panelId);
    },
    [togglePanel],
  );

  const handleResetLayout = useCallback(() => {
    resetLayout();
  }, [resetLayout]);

  const handleVerticalDrag = useCallback(
    (clientX: number) => {
      const rect = mainRegionRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setRightColumnWidth(getClampedRightColumnWidth(rect.right - clientX, rect.width));
    },
    [setRightColumnWidth],
  );

  const handleVerticalStep = useCallback(
    (delta: number) => {
      setRightColumnWidth(
        getClampedRightColumnWidth(layout.rightColumnWidth - delta, mainRegionSize.width),
      );
    },
    [layout.rightColumnWidth, mainRegionSize.width, setRightColumnWidth],
  );

  const handleBottomDrag = useCallback(
    (_clientX: number, clientY: number) => {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setBottomRegionHeight(
        getClampedBottomRegionHeight(
          rect.bottom - clientY,
          bottomContentSize.scrollHeight,
          rect.height,
        ),
      );
    },
    [bottomContentSize.scrollHeight, setBottomRegionHeight],
  );

  const handleBottomStep = useCallback(
    (delta: number) => {
      setBottomRegionHeight(
        getClampedBottomRegionHeight(
          bottomRegionHeight - delta,
          bottomContentSize.scrollHeight,
          workspaceSize.height,
        ),
      );
    },
    [bottomContentSize.scrollHeight, bottomRegionHeight, setBottomRegionHeight, workspaceSize.height],
  );

  const handleRightColumnSplitDrag = useCallback(
    (_clientX: number, clientY: number) => {
      const rect = rightColumnRef.current?.getBoundingClientRect();
      if (!rect || rect.height <= 0) {
        return;
      }

      const topHeight =
        rect.height <= MIN_RIGHT_PANEL_HEIGHT * 2
          ? rect.height / 2
          : clamp(
              clientY - rect.top,
              MIN_RIGHT_PANEL_HEIGHT,
              rect.height - MIN_RIGHT_PANEL_HEIGHT,
            );

      setRightColumnSplit(topHeight / rect.height);
    },
    [setRightColumnSplit],
  );

  const handleRightColumnSplitStep = useCallback(
    (delta: number) => {
      if (!rightColumnHeights || mainRegionSize.height <= 0) {
        return;
      }

      const totalHeight = mainRegionSize.height;
      const topHeight =
        totalHeight <= MIN_RIGHT_PANEL_HEIGHT * 2
          ? totalHeight / 2
          : clamp(
              rightColumnHeights.topHeight + delta,
              MIN_RIGHT_PANEL_HEIGHT,
              totalHeight - MIN_RIGHT_PANEL_HEIGHT,
            );

      setRightColumnSplit(topHeight / totalHeight);
    },
    [mainRegionSize.height, rightColumnHeights, setRightColumnSplit],
  );

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

        <div ref={setWorkspaceRef} className="flex min-h-0 flex-1 gap-3">
          <div className="flex min-h-0 flex-1 flex-col">
            <div ref={setMainRegionRef} className="flex min-h-0 flex-1">
              {desktopMapMode ? (
                <>
                  <div className="min-h-0 min-w-0 flex-1">
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
                  </div>

                  {showRightColumn ? (
                    <>
                      <Splitter
                        orientation="vertical"
                        ariaLabel="Resize map and side panels"
                        onDragMove={(clientX) => handleVerticalDrag(clientX)}
                        onStep={handleVerticalStep}
                      />
                      <div
                        ref={rightColumnRef}
                        style={{ width: rightColumnWidth }}
                        className="flex min-h-0 shrink-0 flex-col"
                      >
                        {panelVisibility.eventList && panelVisibility.description && rightColumnHeights ? (
                          <>
                            <div
                              style={{ height: rightColumnHeights.topHeight }}
                              className="min-h-0 shrink-0"
                            >
                              <ListFallback
                                groups={eventGroups}
                                currentEraId={currentEra?.id ?? null}
                                selectedEventId={navigation.selectedEventId}
                                onOpenPanel={handleOpenPanel}
                              />
                            </div>
                            <Splitter
                              orientation="horizontal"
                              ariaLabel="Resize event list and description panels"
                              onDragMove={handleRightColumnSplitDrag}
                              onStep={handleRightColumnSplitStep}
                            />
                            <div
                              style={{ height: rightColumnHeights.bottomHeight }}
                              className="min-h-0 shrink-0"
                            >
                              <EventPanel
                                event={panelEvent}
                                era={panelEra}
                                onClose={closePanel}
                              />
                            </div>
                          </>
                        ) : panelVisibility.eventList ? (
                          <div className="min-h-0 flex-1">
                            <ListFallback
                              groups={eventGroups}
                              currentEraId={currentEra?.id ?? null}
                              selectedEventId={navigation.selectedEventId}
                              onOpenPanel={handleOpenPanel}
                            />
                          </div>
                        ) : panelVisibility.description ? (
                          <div className="min-h-0 flex-1">
                            <EventPanel
                              event={panelEvent}
                              era={panelEra}
                              onClose={closePanel}
                            />
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-3">
                  <div className="min-h-0 flex-1">
                    <ListFallback
                      groups={eventGroups}
                      currentEraId={currentEra?.id ?? null}
                      selectedEventId={navigation.selectedEventId}
                      onOpenPanel={handleOpenPanel}
                    />
                  </div>
                  {showStackedDescription ? (
                    <div className="min-h-[12rem] shrink-0">
                      <EventPanel
                        event={panelEvent}
                        era={panelEra}
                        onClose={closePanel}
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {showBottomRegion ? (
              <>
                {desktopMapMode ? (
                  <Splitter
                    orientation="horizontal"
                    ariaLabel="Resize map and bottom panels"
                    onDragMove={handleBottomDrag}
                    onStep={handleBottomStep}
                  />
                ) : null}
                <div
                  style={desktopMapMode ? { height: bottomRegionHeight } : undefined}
                  className={[
                    'min-h-0 overflow-y-auto',
                    desktopMapMode ? 'shrink-0' : 'mt-3',
                  ].join(' ')}
                >
                  <div ref={setBottomMeasureRef} className="flex min-h-0 flex-col gap-2">
                    {panelVisibility.timeline ? (
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
                    ) : null}
                    {panelVisibility.chapters ? (
                      <EraBands
                        eras={eras}
                        timeFilter={timeFilter}
                        onSelectEra={handleEraSelect}
                        onSelectAll={handleSelectAll}
                      />
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {showRail ? (
            <IconRail
              panels={panelVisibility}
              onToggle={handleTogglePanel}
              onReset={handleResetLayout}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}
