import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Map } from 'maplibre-gl';

import { nodeCoordinates, type Chapter } from './data/schema';
import EventMarkers from './components/EventMarkers';
import EventPanel from './components/EventPanel';
import IconRail from './components/IconRail';
import ListFallback from './components/ListFallback';
import MapCanvas from './components/MapCanvas';
import { getChapterZoneFeature } from './lib/eraZones';
import Splitter from './components/Splitter';
import ChapterBands from './components/Timeline/ChapterBands';
import Scrubber from './components/Timeline/Scrubber';
import WindowNote from './components/Timeline/WindowNote';
import { flyToChapter, flyToCoordinates, flyToLocality } from './lib/camera';
import { StaticJsonRepository } from './lib/repository';
import { useMapHealth } from './lib/useMapHealth';
import {
  describeStorylineSpan,
  getCurrentChapter,
  getEntriesByChapter,
  getStorylineYearRange,
  getVisibleEntries,
  MAX_RIGHT_COLUMN_WIDTH_COLUMNS,
  MAX_RIGHT_COLUMN_WIDTH_STACKED,
  MIN_RIGHT_COLUMN_WIDTH,
  resolveStorylineEntries,
  type PanelId,
  type ResolvedEntry,
  describeTimeFilter,
  useAppStore,
} from './store/useAppStore';

const MIN_RIGHT_PANEL_HEIGHT = 8 * 16;
const MIN_RIGHT_PANEL_WIDTH = 12 * 16;

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

function getClampedRightColumnWidth(
  rawWidth: number,
  availableWidth: number,
  minWidth: number,
  maxAllowedWidth: number,
): number {
  const resolvedMaxWidth = Math.min(
    maxAllowedWidth,
    Math.max(minWidth, availableWidth - 1),
  );
  return clamp(rawWidth, minWidth, resolvedMaxWidth);
}

/**
 * The right column's width is a ratio of the available width, not a stored
 * pixel value — see the comment on DEFAULT_RIGHT_COLUMN_WIDTH_RATIO in
 * useAppStore.ts. This is what makes the panel hold its proportion as the
 * window resizes rather than claiming a growing share of a shrinking window.
 */
function getRightColumnWidthFromRatio(
  ratio: number,
  availableWidth: number,
  minWidth: number,
  maxAllowedWidth: number,
): number {
  return getClampedRightColumnWidth(ratio * availableWidth, availableWidth, minWidth, maxAllowedWidth);
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

function getRightColumnSplitWidths(
  ratio: number,
  totalWidth: number,
): { leftWidth: number; rightWidth: number } {
  if (totalWidth <= MIN_RIGHT_PANEL_WIDTH * 2) {
    const leftWidth = totalWidth / 2;
    return {
      leftWidth,
      rightWidth: totalWidth - leftWidth,
    };
  }

  const leftWidth = clamp(
    totalWidth * ratio,
    MIN_RIGHT_PANEL_WIDTH,
    totalWidth - MIN_RIGHT_PANEL_WIDTH,
  );

  return {
    leftWidth,
    rightWidth: totalWidth - leftWidth,
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
    ref: mainRegionRef,
    setRef: setMainRegionRef,
    size: mainRegionSize,
  } = useMeasuredRef<HTMLDivElement>();
  const rightColumnRef = useRef<HTMLDivElement | null>(null);

  const {
    status,
    storylines,
    activeStorylineId,
    events,
    visitablePlaces,
    localities,
    errorMessage,
    navigation,
    timeFilter,
    panelEventId,
    layout,
    loadContent,
    setActiveStoryline,
    setYearFromScrubber,
    selectChapterFilter,
    clearTimeFilter,
    openPanel,
    closePanel,
    togglePanel,
    resetLayout,
    setRightColumnWidthRatio,
    setRightColumnSplit,
    setRightColumnOrientation,
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
  const rightColumnOrientation = layout.rightColumnOrientation;
  const isRightColumnColumns =
    rightColumnOrientation === 'columns' &&
    panelVisibility.eventList &&
    panelVisibility.description;

  const activeStoryline =
    storylines.find((storyline) => storyline.id === activeStorylineId) ?? null;

  // Memoised because EventMarkers keys its create-and-destroy effect on this
  // array's identity: a fresh array every render would tear down and rebuild every
  // marker on every keystroke of the scrubber.
  const resolvedEntries = useMemo(
    () =>
      activeStoryline
        ? resolveStorylineEntries(activeStoryline, events, visitablePlaces)
        : [],
    [activeStoryline, events, visitablePlaces],
  );

  const visibleEntries = useMemo(
    () => getVisibleEntries(resolvedEntries, timeFilter),
    [resolvedEntries, timeFilter],
  );

  const chapters = activeStoryline?.chapters ?? [];
  const yearRange = activeStoryline
    ? getStorylineYearRange(activeStoryline, resolvedEntries, new Date().getFullYear())
    : { minYear: 870, maxYear: new Date().getFullYear() };
  const currentChapter = getCurrentChapter(chapters, navigation.year);
  const activeChapterZone =
    timeFilter.kind === 'chapter'
      ? getChapterZoneFeature(activeStorylineId, timeFilter.chapterId)
      : null;
  const windowNote = describeTimeFilter(
    timeFilter,
    activeStoryline,
    activeChapterZone !== null,
  );
  const entryGroups = activeStoryline
    ? getEntriesByChapter(activeStoryline, visibleEntries)
    : [];

  // The panel reads the *entry*, not the event: the framing note is what differs
  // between storylines, and it lives on the entry.
  const panelEntry =
    resolvedEntries.find((resolved) => {
      const { node } = resolved;
      return (node.kind === 'event' ? node.event.id : node.place.id) === panelEventId;
    }) ?? null;
  const panelChapter = panelEntry
    ? chapters.find((chapter) => chapter.id === panelEntry.entry.chapterId) ?? null
    : null;


  const rightColumnMinWidth = isRightColumnColumns
    ? Math.max(MIN_RIGHT_COLUMN_WIDTH, MIN_RIGHT_PANEL_WIDTH * 2)
    : MIN_RIGHT_COLUMN_WIDTH;
  const rightColumnMaxWidth =
    rightColumnOrientation === 'columns'
      ? MAX_RIGHT_COLUMN_WIDTH_COLUMNS
      : MAX_RIGHT_COLUMN_WIDTH_STACKED;

  const rightColumnWidth = showRightColumn
    ? getRightColumnWidthFromRatio(
        layout.rightColumnWidthRatio,
        mainRegionSize.width,
        rightColumnMinWidth,
        rightColumnMaxWidth,
      )
    : 0;

  const rightColumnHeights =
    panelVisibility.eventList &&
    panelVisibility.description &&
    rightColumnOrientation === 'stacked'
      ? getRightColumnSplitHeights(layout.rightColumnSplit, mainRegionSize.height)
      : null;
  const rightColumnWidths =
    isRightColumnColumns
      ? getRightColumnSplitWidths(layout.rightColumnSplit, rightColumnWidth)
      : null;

  const completeFlight = useCallback((token: number) => {
    if (useAppStore.getState().navigation.flightToken !== token) {
      return;
    }

    // Tier-0 has no post-flight side effect yet; later playback and tour flows consume accepted completions.
  }, []);

  const focusEntryOnMap = useCallback(
    (resolved: ResolvedEntry) => {
      const coordinates = nodeCoordinates(resolved.node);
      // An off-map entry holds the camera where it is, by design (Decision #14).
      if (!map || !coordinates) {
        return;
      }

      const token = issueFlightToken();
      flyToCoordinates(map, coordinates, localities, token, completeFlight);
    },
    [completeFlight, issueFlightToken, localities, map],
  );

  const focusChapterOnMap = useCallback(
    (chapter: Chapter) => {
      if (!map) {
        return;
      }

      const token = issueFlightToken();
      flyToChapter(map, chapter, resolvedEntries, localities, token, completeFlight);
    },
    [completeFlight, issueFlightToken, localities, map, resolvedEntries],
  );

  const handleSelectLocality = useCallback(
    (localityId: string) => {
      const locality = localities.find((candidate) => candidate.id === localityId);
      // The locality *filter* (Decisions #9, #10) is Phase 3; for now a pin click
      // only travels there.
      if (!map || !locality) {
        return;
      }

      const token = issueFlightToken();
      flyToLocality(map, locality, token, completeFlight);
    },
    [completeFlight, issueFlightToken, localities, map],
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

  const handleChapterSelect = useCallback(
    (chapter: Chapter) => {
      selectChapterFilter(chapter);
      focusChapterOnMap(chapter);
    },
    [focusChapterOnMap, selectChapterFilter],
  );

  const handleOpenEntry = useCallback(
    (resolved: ResolvedEntry) => {
      const { node } = resolved;
      openPanel(node.kind === 'event' ? node.event.id : node.place.id);
      focusEntryOnMap(resolved);
    },
    [focusEntryOnMap, openPanel],
  );

  const handleStorylineSelect = useCallback(
    (storylineId: string) => {
      setActiveStoryline(storylineId);
    },
    [setActiveStoryline],
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

  const handleToggleRightColumnOrientation = useCallback(() => {
    setRightColumnOrientation(
      rightColumnOrientation === 'stacked' ? 'columns' : 'stacked',
    );
  }, [rightColumnOrientation, setRightColumnOrientation]);

  const handleVerticalDrag = useCallback(
    (clientX: number) => {
      const rect = mainRegionRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) {
        return;
      }

      const clampedWidth = getClampedRightColumnWidth(
        rect.right - clientX,
        rect.width,
        rightColumnMinWidth,
        rightColumnMaxWidth,
      );
      setRightColumnWidthRatio(clampedWidth / rect.width);
    },
    [rightColumnMaxWidth, rightColumnMinWidth, setRightColumnWidthRatio],
  );

  const handleVerticalStep = useCallback(
    (delta: number) => {
      if (mainRegionSize.width <= 0) {
        return;
      }

      const clampedWidth = getClampedRightColumnWidth(
        rightColumnWidth - delta,
        mainRegionSize.width,
        rightColumnMinWidth,
        rightColumnMaxWidth,
      );
      setRightColumnWidthRatio(clampedWidth / mainRegionSize.width);
    },
    [
      rightColumnWidth,
      mainRegionSize.width,
      rightColumnMaxWidth,
      rightColumnMinWidth,
      setRightColumnWidthRatio,
    ],
  );


  const handleRightColumnSplitDrag = useCallback(
    (clientX: number, clientY: number) => {
      const rect = rightColumnRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      if (rightColumnOrientation === 'columns') {
        if (rect.width <= 0) {
          return;
        }

        const leftWidth =
          rect.width <= MIN_RIGHT_PANEL_WIDTH * 2
            ? rect.width / 2
            : clamp(
                clientX - rect.left,
                MIN_RIGHT_PANEL_WIDTH,
                rect.width - MIN_RIGHT_PANEL_WIDTH,
              );

        setRightColumnSplit(leftWidth / rect.width);
        return;
      }

      if (rect.height <= 0) {
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
    [rightColumnOrientation, setRightColumnSplit],
  );

  const handleRightColumnSplitStep = useCallback(
    (delta: number) => {
      if (rightColumnOrientation === 'columns') {
        if (!rightColumnWidths || rightColumnWidth <= 0) {
          return;
        }

        const totalWidth = rightColumnWidth;
        const leftWidth =
          totalWidth <= MIN_RIGHT_PANEL_WIDTH * 2
            ? totalWidth / 2
            : clamp(
                rightColumnWidths.leftWidth + delta,
                MIN_RIGHT_PANEL_WIDTH,
                totalWidth - MIN_RIGHT_PANEL_WIDTH,
              );

        setRightColumnSplit(leftWidth / totalWidth);
        return;
      }

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
    [
      mainRegionSize.height,
      rightColumnHeights,
      rightColumnOrientation,
      rightColumnWidth,
      rightColumnWidths,
      setRightColumnSplit,
    ],
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

  // Chrome is built once and placed twice: floating over the map when there is a
  // map, and in normal flow in the list fallback, where floating it would bury
  // the only content on screen.
  const topBar = panelVisibility.header ? (
    <header className="pointer-events-auto flex w-fit max-w-full flex-wrap items-center gap-x-5 gap-y-1.5 rounded-[1.25rem] border border-white/50 bg-[#f8f5ef]/75 px-5 py-2.5 shadow-panel backdrop-blur-md">
      <div className="flex min-w-0 items-baseline gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
          City-Storyline
        </p>
        <h1 className="truncate font-display text-xl leading-tight text-slate-950">
          {activeStoryline ? activeStoryline.title : 'No storyline loaded'}
        </h1>
      </div>

      {/*
        Phase 1 stand-in for the front door. The card rail, hover-to-fly and
        locality filter are Phase 3; this exists only so the same node can be
        read from two storylines, which is what Phase 1 has to prove.
      */}
      <div className="flex flex-wrap items-center gap-1.5">
        {storylines.map((storyline) => {
          const active = storyline.id === activeStorylineId;
          return (
            <button
              key={storyline.id}
              type="button"
              onClick={() => handleStorylineSelect(storyline.id)}
              aria-pressed={active}
              className={[
                'flex items-baseline gap-2 rounded-full border px-3 py-1 text-sm transition',
                active
                  ? 'border-slate-900 bg-slate-900 text-[#f8f5ef]'
                  : 'border-slate-200 bg-white/80 text-slate-800 hover:border-slate-400 hover:bg-white',
              ].join(' ')}
            >
              <span className="font-semibold">{storyline.title}</span>
              <span
                className={[
                  'text-[10px] font-semibold uppercase tracking-[0.16em]',
                  active ? 'text-[#f8f5ef]/70' : 'text-slate-500',
                ].join(' ')}
              >
                {storyline.type}
              </span>
            </button>
          );
        })}
      </div>

      {activeStoryline ? (
        <p className="text-xs text-slate-500">
          {resolvedEntries.length} entries · {chapters.length} chapters ·{' '}
          {describeStorylineSpan(activeStoryline)}
        </p>
      ) : null}
    </header>
  ) : null;

  const banner = bannerMessage ? (
    <div className="pointer-events-auto flex w-fit max-w-full flex-wrap items-center gap-3 rounded-[1.25rem] border border-amber-300/80 bg-amber-50/90 px-4 py-2.5 text-sm text-amber-950 shadow-panel backdrop-blur-md">
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
  ) : null;

  // Timeline and chapter chips are one bar now rather than two stacked cards.
  // Capped and scrollable so a storyline with many chapters cannot grow the bar
  // until it swallows the map.
  const bottomBar = showBottomRegion ? (
    <div className="pointer-events-auto max-h-[45vh] min-w-0 overflow-y-auto overflow-x-hidden rounded-[1.25rem] border border-white/50 bg-[#f8f5ef]/80 shadow-panel backdrop-blur-md">
      {panelVisibility.timeline ? (
        <>
          <WindowNote
            title={windowNote.title}
            blurb={windowNote.blurb}
            visibleCount={visibleEntries.length}
            totalCount={resolvedEntries.length}
          />
          <Scrubber
            minYear={yearRange.minYear}
            maxYear={yearRange.maxYear}
            year={navigation.year}
            onYearChange={handleYearChange}
          />
        </>
      ) : null}
      {panelVisibility.chapters ? (
        <ChapterBands
          chapters={chapters}
          spanLabel={activeStoryline ? describeStorylineSpan(activeStoryline) : ''}
          timeFilter={timeFilter}
          onSelectChapter={handleChapterSelect}
          onSelectAll={handleSelectAll}
        />
      ) : null}
    </div>
  ) : null;

  const rightColumn = showRightColumn ? (
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
        className={[
          'flex min-h-0 shrink-0 py-3 pr-3',
          rightColumnOrientation === 'columns' ? 'flex-row' : 'flex-col',
        ].join(' ')}
      >
        {panelVisibility.eventList &&
        panelVisibility.description &&
        rightColumnOrientation === 'stacked' &&
        rightColumnHeights ? (
          <>
            <div
              style={{ height: rightColumnHeights.topHeight }}
              className="min-h-0 shrink-0"
            >
              <ListFallback
                storylineTitle={activeStoryline?.title ?? ''}
                groups={entryGroups}
                currentChapterId={currentChapter?.id ?? null}
                selectedEventId={navigation.selectedEventId}
                onOpenEntry={handleOpenEntry}
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
                entry={panelEntry}
                chapter={panelChapter}
                storylineTitle={activeStoryline?.title ?? ''}
                onClose={closePanel}
              />
            </div>
          </>
        ) : isRightColumnColumns && rightColumnWidths ? (
          <>
            <div
              style={{ width: rightColumnWidths.leftWidth }}
              className="min-h-0 min-w-0 shrink-0"
            >
              <ListFallback
                storylineTitle={activeStoryline?.title ?? ''}
                groups={entryGroups}
                currentChapterId={currentChapter?.id ?? null}
                selectedEventId={navigation.selectedEventId}
                onOpenEntry={handleOpenEntry}
              />
            </div>
            <Splitter
              orientation="vertical"
              ariaLabel="Resize event list and description panels"
              onDragMove={handleRightColumnSplitDrag}
              onStep={handleRightColumnSplitStep}
            />
            <div
              style={{ width: rightColumnWidths.rightWidth }}
              className="min-h-0 min-w-0 shrink-0"
            >
              <EventPanel
                entry={panelEntry}
                chapter={panelChapter}
                storylineTitle={activeStoryline?.title ?? ''}
                onClose={closePanel}
              />
            </div>
          </>
        ) : panelVisibility.eventList ? (
          <div className="min-h-0 flex-1">
            <ListFallback
              storylineTitle={activeStoryline?.title ?? ''}
              groups={entryGroups}
              currentChapterId={currentChapter?.id ?? null}
              selectedEventId={navigation.selectedEventId}
              onOpenEntry={handleOpenEntry}
            />
          </div>
        ) : panelVisibility.description ? (
          <div className="min-h-0 flex-1">
            <EventPanel
              entry={panelEntry}
              chapter={panelChapter}
              storylineTitle={activeStoryline?.title ?? ''}
              onClose={closePanel}
            />
          </div>
        ) : null}
      </div>
    </>
  ) : null;

  return (
    <main className="relative h-screen overflow-hidden">
      <div className="absolute inset-0 flex">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div ref={setMainRegionRef} className="flex min-h-0 min-w-0 flex-1">
            {desktopMapMode ? (
              <>
                {/*
                  The map runs edge to edge and the chrome floats over it, anchored
                  to this container rather than to the viewport so it never covers
                  the side panels' own controls.
                */}
                <div className="relative min-h-0 min-w-0 flex-1">
                  <MapCanvas
                    key={mapRetryKey}
                    onMapReady={setMap}
                    onMapUnavailable={reportUnsupported}
                    activeChapterZone={activeChapterZone}
                    localities={localities}
                    onSelectLocality={handleSelectLocality}
                  />
                  {map ? (
                    <EventMarkers
                      map={map}
                      entries={resolvedEntries}
                      timeFilter={timeFilter}
                      selectedEventId={navigation.selectedEventId}
                      onSelectEntry={handleOpenEntry}
                      onReadMore={handleOpenEntry}
                    />
                  ) : null}

                  {/* pointer-events-none on the wrapper, auto on the bars, so the
                      map stays draggable in the gaps around them. */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-start gap-2 p-3">
                    {topBar}
                    {banner}
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-3">
                    {bottomBar}
                  </div>
                </div>

                {rightColumn}
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
                {topBar}
                {banner}
                <div className="min-h-0 flex-1">
                  <ListFallback
                    storylineTitle={activeStoryline?.title ?? ''}
                    groups={entryGroups}
                    currentChapterId={currentChapter?.id ?? null}
                    selectedEventId={navigation.selectedEventId}
                    onOpenEntry={handleOpenEntry}
                  />
                </div>
                {showStackedDescription ? (
                  <div className="min-h-[12rem] shrink-0">
                    <EventPanel
                      entry={panelEntry}
                      chapter={panelChapter}
                      storylineTitle={activeStoryline?.title ?? ''}
                      onClose={closePanel}
                    />
                  </div>
                ) : null}
                {bottomBar}
              </div>
            )}
          </div>
        </div>

        {showRail ? (
          <div className="z-30 py-3 pr-3">
            <IconRail
              panels={panelVisibility}
              rightColumnOrientation={rightColumnOrientation}
              orientationDisabled={!panelVisibility.eventList || !panelVisibility.description}
              onToggle={handleTogglePanel}
              onToggleOrientation={handleToggleRightColumnOrientation}
              onReset={handleResetLayout}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
