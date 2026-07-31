import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Map } from 'maplibre-gl';

import { nodeCoordinates, type Chapter, type Storyline } from './data/schema';
import EventMarkers from './components/EventMarkers';
import EventPanel from './components/EventPanel';
import IconRail from './components/IconRail';
import StoryNarrative from './components/StoryNarrative';
import MapCanvas from './components/MapCanvas';
import { getChapterZoneFeature } from './lib/eraZones';
import Splitter from './components/Splitter';
import ChapterBands from './components/Timeline/ChapterBands';
import Scrubber from './components/Timeline/Scrubber';
import WindowNote from './components/Timeline/WindowNote';
import LocalityChip from './components/FrontDoor/LocalityChip';
import StorylineCard from './components/FrontDoor/StorylineCard';
import StorylineRail from './components/FrontDoor/StorylineRail';
import {
  flyToChapter,
  flyToCoordinates,
  flyToLocality,
  flyToOpeningView,
} from './lib/camera';
import { getLocalityFor } from './lib/geo';
import { topGenres } from './lib/genres';
import { getLocalityProximity } from './lib/localityFilter';
import { formatRoute, parseHash, routesEqual, type Route } from './lib/routing';
import { useReducedMotion } from './lib/useReducedMotion';
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

/**
 * How long a pointer must rest on a card before its preview flight launches.
 * Without it, sweeping the cursor along the rail queues a flight per card.
 */
const PREVIEW_DWELL_MS = 300;

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
  const reducedMotion = useReducedMotion();
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
    mode,
    localityFilter,
    enterStoryline,
    returnToChooser,
    applyLocalityFilter,
    setLocalityProximity,
    clearLocalityFilter,
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
  // In the chooser the map belongs to the cards: no side panels, no timeline, no
  // layout rail. They arrive with the storyline.
  const reading = mode === 'reading';
  const showRail = desktopMapMode && reading;
  const showRightColumn =
    desktopMapMode && reading && (panelVisibility.eventList || panelVisibility.description);
  const showBottomRegion = reading && (panelVisibility.timeline || panelVisibility.chapters);
  const showStackedDescription = !desktopMapMode && reading && panelVisibility.description;
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

  /**
   * Every storyline resolved once for the card rail: counts, span, derived genre,
   * and which localities it touches. Locality membership is computed from the
   * entries' coordinates rather than tagged on the storyline (Decision #3) —
   * Charles IV spans Prague, Karlštejn and Karlovy Vary and has no single home.
   */
  const storylineCards = useMemo(
    () =>
      storylines.map((storyline) => {
        const entries = resolveStorylineEntries(storyline, events, visitablePlaces);
        const localityIds = new Set<string>();
        for (const { node } of entries) {
          const locality = getLocalityFor(nodeCoordinates(node), localities);
          if (locality) {
            localityIds.add(locality.id);
          }
        }

        return {
          storyline,
          entryCount: entries.length,
          span: describeStorylineSpan(storyline),
          genres: topGenres(entries),
          localityIds,
        };
      }),
    [events, localities, storylines, visitablePlaces],
  );

  const visibleCards = localityFilter
    ? storylineCards.filter((card) => card.localityIds.has(localityFilter.localityId))
    : storylineCards;
  const hiddenElsewhere = storylineCards.length - visibleCards.length;
  const filteredLocality = localityFilter
    ? localities.find((locality) => locality.id === localityFilter.localityId) ?? null
    : null;

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

      flyToCoordinates(map, coordinates, localities, {
        token: issueFlightToken(),
        instant: reducedMotion,
        onComplete: completeFlight,
      });
    },
    [completeFlight, issueFlightToken, localities, map, reducedMotion],
  );

  const focusChapterOnMap = useCallback(
    (chapter: Chapter) => {
      if (!map) {
        return;
      }

      flyToChapter(map, chapter, resolvedEntries, localities, {
        token: issueFlightToken(),
        instant: reducedMotion,
        onComplete: completeFlight,
      });
    },
    [completeFlight, issueFlightToken, localities, map, reducedMotion, resolvedEntries],
  );

  const handleSelectLocality = useCallback(
    (localityId: string) => {
      const locality = localities.find((candidate) => candidate.id === localityId);
      if (!map || !locality) {
        return;
      }

      // Decision #11's other half: a map click sets both camera and filter, where
      // a card hover only ever moves the camera. Stated as one rule up front
      // because two-way binding between the same two surfaces oscillates if it is
      // left to emerge.
      if (mode === 'chooser') {
        applyLocalityFilter(localityId);
      }

      flyToLocality(map, locality, {
        token: issueFlightToken(),
        instant: reducedMotion,
        onComplete: completeFlight,
      });
    },
    [applyLocalityFilter, completeFlight, issueFlightToken, localities, map, mode, reducedMotion],
  );

  /**
   * Hover-to-fly, after a dwell delay so sweeping the cursor across the rail does
   * not launch four flights in a row. Never touches the locality filter.
   */
  const previewTimerRef = useRef<number | null>(null);

  const cancelPreview = useCallback(() => {
    if (previewTimerRef.current !== null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  }, []);

  const handlePreviewStart = useCallback(
    (storyline: Storyline) => {
      cancelPreview();
      if (!map) {
        return;
      }

      previewTimerRef.current = window.setTimeout(() => {
        previewTimerRef.current = null;

        // If the storyline opens on the place already on screen, the camera does
        // not move at all — the card's own hover state is the only feedback, by
        // design. Flying Prague→Prague would be a pointless twitch.
        const centre = map.getCenter();
        const currentLocality = getLocalityFor(
          { lng: centre.lng, lat: centre.lat },
          localities,
        );
        if (currentLocality?.id === storyline.openingView.localityId) {
          return;
        }

        flyToOpeningView(map, storyline.openingView, {
          token: issueFlightToken(),
          instant: reducedMotion,
          onComplete: completeFlight,
        });
      }, PREVIEW_DWELL_MS);
    },
    [cancelPreview, completeFlight, issueFlightToken, localities, map, reducedMotion],
  );

  useEffect(() => cancelPreview, [cancelPreview]);

  const handleEnterStoryline = useCallback(
    (storyline: Storyline) => {
      cancelPreview();
      enterStoryline(storyline.id);

      if (map) {
        flyToOpeningView(map, storyline.openingView, {
          token: issueFlightToken(),
          instant: reducedMotion,
          onComplete: completeFlight,
        });
      }
    },
    [cancelPreview, completeFlight, enterStoryline, issueFlightToken, map, reducedMotion],
  );

  const handleReturnHome = useCallback(() => {
    cancelPreview();
    returnToChooser();
  }, [cancelPreview, returnToChooser]);

  /**
   * Hash routing, both directions (Decision #5).
   *
   * The two effects below would feed each other forever without a guard, so
   * `appliedRouteRef` records the last route this component reconciled: whichever
   * side moves first, the other recognises the result as already-applied and
   * stops. Without it, writing the hash fires hashchange, which sets state, which
   * writes the hash.
   */
  const appliedRouteRef = useRef<Route | null>(null);

  const applyRoute = useCallback(
    (route: Route) => {
      appliedRouteRef.current = route;

      if (route.kind === 'chooser') {
        returnToChooser();
        return;
      }

      const target = useAppStore
        .getState()
        .storylines.find((storyline) => storyline.id === route.storylineId);
      if (!target) {
        // An unknown id in a shared link lands on the chooser rather than a blank
        // screen.
        returnToChooser();
        return;
      }

      if (useAppStore.getState().activeStorylineId !== route.storylineId) {
        enterStoryline(route.storylineId);
      }

      if (route.entryRef) {
        openPanel(route.entryRef);
      }
    },
    [enterStoryline, openPanel, returnToChooser],
  );

  // Hash → state, on first load and on every back/forward.
  useEffect(() => {
    if (status !== 'ready') {
      return;
    }

    const syncFromHash = (): void => {
      const route = parseHash(window.location.hash);
      if (appliedRouteRef.current && routesEqual(appliedRouteRef.current, route)) {
        return;
      }
      applyRoute(route);
    };

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [applyRoute, status]);

  // State → hash.
  useEffect(() => {
    if (status !== 'ready') {
      return;
    }

    const route: Route =
      mode === 'reading' && activeStorylineId
        ? { kind: 'storyline', storylineId: activeStorylineId, entryRef: panelEventId }
        : { kind: 'chooser' };

    if (appliedRouteRef.current && routesEqual(appliedRouteRef.current, route)) {
      return;
    }

    const previous = appliedRouteRef.current;
    appliedRouteRef.current = route;

    // Entering or leaving a storyline is deliberate navigation and earns a
    // history entry, so Back returns to the chooser. Moving between entries does
    // not: scrolling the narrative would otherwise push one entry per step and
    // bury the way out under twenty presses of Back.
    const isNavigation =
      !previous || previous.kind !== route.kind ||
      (previous.kind === 'storyline' &&
        route.kind === 'storyline' &&
        previous.storylineId !== route.storylineId);

    const url = `${window.location.pathname}${window.location.search}${formatRoute(route)}`;
    if (isNavigation) {
      window.history.pushState(null, '', url);
    } else {
      window.history.replaceState(null, '', url);
    }
  }, [activeStorylineId, mode, panelEventId, status]);

  // pushState does not emit hashchange, so Back/Forward across our own pushes
  // arrives here instead.
  useEffect(() => {
    const handlePopState = (): void => {
      const route = parseHash(window.location.hash);
      if (appliedRouteRef.current && routesEqual(appliedRouteRef.current, route)) {
        return;
      }
      applyRoute(route);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [applyRoute]);

  /**
   * The soft boundary (Decision #9), split across two map events on purpose.
   *
   * `move` updates inside↔leaving continuously, so the chip warns you while you
   * are still dragging. `moveend` is the only thing that actually clears the
   * filter — releasing mid-gesture would fight touch inertia, where one flick
   * carries the camera far past any boundary and back is not an option.
   */
  useEffect(() => {
    if (!map || mode !== 'chooser' || !localityFilter) {
      return;
    }

    const locality = localities.find(
      (candidate) => candidate.id === localityFilter.localityId,
    );
    if (!locality) {
      return;
    }

    const measure = () => {
      const centre = map.getCenter();
      return getLocalityProximity(
        { lng: centre.lng, lat: centre.lat },
        map.getZoom(),
        locality,
      );
    };

    const handleMove = (): void => {
      const proximity = measure();
      if (proximity !== 'outside') {
        setLocalityProximity(proximity);
      }
    };

    const handleMoveEnd = (): void => {
      if (measure() === 'outside') {
        clearLocalityFilter();
      }
    };

    map.on('move', handleMove);
    map.on('moveend', handleMoveEnd);

    return () => {
      map.off('move', handleMove);
      map.off('moveend', handleMoveEnd);
    };
  }, [clearLocalityFilter, localities, localityFilter, map, mode, setLocalityProximity]);

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
  const topBar = !panelVisibility.header ? null : reading ? (
    <header className="pointer-events-auto flex w-fit max-w-full flex-wrap items-center gap-x-5 gap-y-1.5 rounded-[1.25rem] border border-white/50 bg-[#f8f5ef]/75 px-5 py-2.5 shadow-panel backdrop-blur-md">
      <div className="flex min-w-0 items-baseline gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
          City-Storyline
        </p>
        <h1 className="truncate font-display text-xl leading-tight text-slate-950">
          {activeStoryline ? activeStoryline.title : 'No storyline loaded'}
        </h1>
      </div>

      {activeStoryline ? (
        <p className="text-xs text-slate-500">
          {resolvedEntries.length} entries · {chapters.length} chapters ·{' '}
          {describeStorylineSpan(activeStoryline)}
        </p>
      ) : null}

      {/*
        PLAN-V2 puts the home button in the top-right corner, which the map's own
        zoom controls already occupy. Docking it to the end of this bar keeps it
        in the top strip without the two fighting for the same pixels.
      */}
      <button
        type="button"
        onClick={handleReturnHome}
        className="rounded-full border border-slate-300 bg-white/70 px-3 py-1 text-sm font-semibold text-slate-800 transition hover:border-slate-500 hover:bg-white"
      >
        ← All storylines
      </button>
    </header>
  ) : (
    <header className="pointer-events-auto flex w-fit max-w-full flex-col gap-0.5 rounded-[1.25rem] border border-white/50 bg-[#f8f5ef]/75 px-5 py-2.5 shadow-panel backdrop-blur-md">
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
        City-Storyline
      </p>
      <h1 className="font-display text-xl leading-tight text-slate-950">
        Enter history from any point of interest.
      </h1>
      <p className="text-xs text-slate-500">
        {storylineCards.length} storylines over one shared pool of events. Hover a
        card to look, click to read.
      </p>
    </header>
  );

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
  const chooserRail = reading ? null : (
    <div className="pointer-events-none flex flex-col gap-2">
      {filteredLocality && localityFilter ? (
        <LocalityChip
          localityName={filteredLocality.name}
          proximity={localityFilter.proximity}
          hiddenElsewhere={hiddenElsewhere}
          onClear={clearLocalityFilter}
        />
      ) : null}

      {visibleCards.length > 0 ? (
        <StorylineRail autoScroll={!reducedMotion}>
          {visibleCards.map((card) => (
            <StorylineCard
              key={card.storyline.id}
              storyline={card.storyline}
              entryCount={card.entryCount}
              span={card.span}
              genres={card.genres}
              active={card.storyline.id === activeStorylineId}
              onEnter={() => handleEnterStoryline(card.storyline)}
              onPreviewStart={() => handlePreviewStart(card.storyline)}
              onPreviewEnd={cancelPreview}
            />
          ))}
        </StorylineRail>
      ) : (
        /* Decision #10's honest empty state: never a dead end. */
        <div className="pointer-events-auto flex w-fit max-w-full flex-wrap items-center gap-3 rounded-[1.25rem] border border-white/50 bg-[#f8f5ef]/85 px-5 py-3 text-sm text-slate-700 shadow-panel backdrop-blur-md">
          <p>
            No storylines in {filteredLocality?.name ?? 'this area'} —{' '}
            {hiddenElsewhere} elsewhere.
          </p>
          <button
            type="button"
            onClick={clearLocalityFilter}
            className="rounded-full border border-slate-400 px-3 py-1 font-semibold transition hover:bg-white"
          >
            Show all
          </button>
        </div>
      )}
    </div>
  );

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
              <StoryNarrative
                storylineTitle={activeStoryline?.title ?? ''}
                groups={entryGroups}
                currentChapterId={currentChapter?.id ?? null}
                selectedEventId={navigation.selectedEventId}
                onOpenEntry={handleOpenEntry}
                onStepInto={handleOpenEntry}
                reducedMotion={reducedMotion}
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
              <StoryNarrative
                storylineTitle={activeStoryline?.title ?? ''}
                groups={entryGroups}
                currentChapterId={currentChapter?.id ?? null}
                selectedEventId={navigation.selectedEventId}
                onOpenEntry={handleOpenEntry}
                onStepInto={handleOpenEntry}
                reducedMotion={reducedMotion}
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
            <StoryNarrative
              storylineTitle={activeStoryline?.title ?? ''}
              groups={entryGroups}
              currentChapterId={currentChapter?.id ?? null}
              selectedEventId={navigation.selectedEventId}
              onOpenEntry={handleOpenEntry}
              onStepInto={handleOpenEntry}
              reducedMotion={reducedMotion}
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
                    {chooserRail}
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
                  <StoryNarrative
                    storylineTitle={activeStoryline?.title ?? ''}
                    groups={entryGroups}
                    currentChapterId={currentChapter?.id ?? null}
                    selectedEventId={navigation.selectedEventId}
                    onOpenEntry={handleOpenEntry}
                    reducedMotion={reducedMotion}
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
                {chooserRail}
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
