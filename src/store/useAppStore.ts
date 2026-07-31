import { create } from 'zustand';

import {
  type Chapter,
  type Locality,
  type PeriodChapter,
  type StoryEvent,
  type StoryNode,
  type Storyline,
  type StorylineEntry,
  type VisitablePlace,
} from '../data/schema';
import type { ContentRepository } from '../lib/repository';

const LAYOUT_STORAGE_KEY = 'city-storyline-layout';
export const MIN_RIGHT_COLUMN_WIDTH = 18 * 16;
export const MAX_RIGHT_COLUMN_WIDTH_STACKED = 40 * 16;
export const MAX_RIGHT_COLUMN_WIDTH_COLUMNS = 64 * 16;
/**
 * The right column's width is stored as a ratio of the available main-region
 * width, not a raw pixel value — the same pattern already used for
 * rightColumnSplit. A pixel value that stayed fixed while the window resized
 * meant the panel claimed a larger and larger share of a shrinking window
 * (measured: 32% of a 1440px window grew to 55% of a 900px window) instead of
 * holding its proportion. MIN/MAX_RIGHT_COLUMN_WIDTH remain absolute pixel
 * floors/ceilings applied on top of the ratio, so the panel stays usable at
 * both extremes rather than shrinking to unreadable or growing to absurd.
 */
export const DEFAULT_RIGHT_COLUMN_WIDTH_RATIO = 0.25;
export const DEFAULT_RIGHT_COLUMN_SPLIT = 0.5;
export const DEFAULT_RIGHT_COLUMN_ORIENTATION = 'stacked';

export type NavigationMode = 'idle' | 'playing' | 'tour';

export type NavigationState = {
  mode: NavigationMode;
  year: number;
  selectedEventId: string | null;
  flightToken: number;
};

/**
 * Which of the active storyline's entries are on the map. The chapter chips and
 * the scrubber are two controls on the same thing — the visible time window — so
 * they share one filter rather than fighting each other.
 *   all     → every entry (the default; the map is never empty on arrival)
 *   chapter → one chapter, chosen from the chips
 *   century → everything in the playhead's century, chosen by dragging
 *
 * Note this filters *entries*, not events: which chapter a node sits in is a
 * per-storyline fact now, so the same event can be visible in one storyline's
 * window and not in another's.
 */
export type TimeFilter =
  | { kind: 'all' }
  | { kind: 'chapter'; chapterId: string }
  | { kind: 'century'; century: number };

export const centuryOf = (year: number): number => Math.floor(year / 100);

export const centuryLabel = (century: number): string => `${century}00s`;

export type PanelId =
  | 'header'
  | 'timeline'
  | 'chapters'
  | 'eventList'
  | 'description';

export type PanelVisibility = Record<PanelId, boolean>;

/**
 * The chrome floats over the map rather than taking space from it, so there is no
 * bottom-region height to store any more: the map is always full-bleed, and the
 * timeline bar is sized by its own content.
 */
export type LayoutState = {
  panels: PanelVisibility;
  rightColumnWidthRatio: number;
  rightColumnSplit: number;
  rightColumnOrientation: 'stacked' | 'columns';
};

type AppStatus = 'idle' | 'loading' | 'ready' | 'error';

const defaultPanels: PanelVisibility = {
  header: true,
  timeline: true,
  chapters: true,
  eventList: true,
  description: true,
};

const defaultLayoutState: LayoutState = {
  panels: defaultPanels,
  rightColumnWidthRatio: DEFAULT_RIGHT_COLUMN_WIDTH_RATIO,
  rightColumnSplit: DEFAULT_RIGHT_COLUMN_SPLIT,
  rightColumnOrientation: DEFAULT_RIGHT_COLUMN_ORIENTATION,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function clampRatio(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function parseStoredLayout(): LayoutState {
  if (typeof window === 'undefined') {
    return defaultLayoutState;
  }

  try {
    const rawValue = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!rawValue) {
      return defaultLayoutState;
    }

    const parsed = JSON.parse(rawValue) as unknown;
    if (!isRecord(parsed)) {
      return defaultLayoutState;
    }

    const panels = parsed.panels;
    const rightColumnWidthRatio = parsed.rightColumnWidthRatio;
    const rightColumnSplit = parsed.rightColumnSplit;
    const rightColumnOrientation = parsed.rightColumnOrientation;

    if (
      !isRecord(panels) ||
      typeof panels.timeline !== 'boolean' ||
      typeof panels.chapters !== 'boolean' ||
      typeof panels.eventList !== 'boolean' ||
      typeof panels.description !== 'boolean' ||
      typeof rightColumnWidthRatio !== 'number' ||
      !Number.isFinite(rightColumnWidthRatio) ||
      rightColumnWidthRatio < 0.05 ||
      rightColumnWidthRatio > 0.95 ||
      typeof rightColumnSplit !== 'number' ||
      !Number.isFinite(rightColumnSplit) ||
      rightColumnSplit < 0 ||
      rightColumnSplit > 1 ||
      (rightColumnOrientation !== 'stacked' && rightColumnOrientation !== 'columns')
    ) {
      return defaultLayoutState;
    }

    return {
      panels: {
        // Added after this key was already being persisted, so a stored layout
        // from before it existed is missing it. Default to shown rather than
        // discarding the whole saved layout over one absent boolean.
        header: typeof panels.header === 'boolean' ? panels.header : true,
        timeline: panels.timeline,
        chapters: panels.chapters,
        eventList: panels.eventList,
        description: panels.description,
      },
      rightColumnWidthRatio,
      rightColumnSplit,
      rightColumnOrientation,
    };
  } catch {
    return defaultLayoutState;
  }
}

type AppStore = {
  status: AppStatus;
  storylines: Storyline[];
  activeStorylineId: string | null;
  events: StoryEvent[];
  visitablePlaces: VisitablePlace[];
  localities: Locality[];
  errorMessage: string | null;
  navigation: NavigationState;
  timeFilter: TimeFilter;
  panelEventId: string | null;
  layout: LayoutState;
  loadContent: (repository: ContentRepository) => Promise<void>;
  setActiveStoryline: (storylineId: string) => void;
  setYearFromScrubber: (year: number) => void;
  selectChapterFilter: (chapter: Chapter) => void;
  clearTimeFilter: () => void;
  selectYear: (year: number) => void;
  selectEvent: (eventId: string | null) => void;
  openPanel: (eventId: string) => void;
  closePanel: () => void;
  togglePanel: (panelId: PanelId) => void;
  showPanel: (panelId: PanelId) => void;
  hidePanel: (panelId: PanelId) => void;
  resetLayout: () => void;
  setRightColumnWidthRatio: (ratio: number) => void;
  setRightColumnSplit: (ratio: number) => void;
  setRightColumnOrientation: (orientation: LayoutState['rightColumnOrientation']) => void;
  issueFlightToken: () => number;
};

function persistLayout(layout: LayoutState): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
}

export const useAppStore = create<AppStore>((set, get) => ({
  status: 'idle',
  storylines: [],
  activeStorylineId: null,
  events: [],
  visitablePlaces: [],
  localities: [],
  errorMessage: null,
  navigation: {
    mode: 'idle',
    year: 870,
    selectedEventId: null,
    flightToken: 0,
  },
  timeFilter: { kind: 'all' },
  panelEventId: null,
  layout: parseStoredLayout(),
  async loadContent(repository) {
    set({ status: 'loading', errorMessage: null });

    try {
      const [storylines, events, visitablePlaces, localities] = await Promise.all([
        repository.getStorylines(),
        repository.getEvents(),
        repository.getVisitablePlaces(),
        repository.getLocalities(),
      ]);

      const firstStoryline = storylines[0] ?? null;
      set({
        status: 'ready',
        storylines,
        activeStorylineId: firstStoryline?.id ?? null,
        events,
        visitablePlaces,
        localities,
        timeFilter: { kind: 'all' },
        navigation: {
          mode: 'idle',
          year: firstStoryline ? getStorylineStartYear(firstStoryline) : 870,
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
  setActiveStoryline(storylineId) {
    const storyline = get().storylines.find((item) => item.id === storylineId);
    if (!storyline) {
      return;
    }

    // Everything downstream of the storyline is reset, not carried over: a
    // chapterId from Prague means nothing in Charles IV, and a selected event may
    // not be in the new storyline at all.
    set((state) => ({
      activeStorylineId: storylineId,
      timeFilter: { kind: 'all' },
      panelEventId: null,
      navigation: {
        ...state.navigation,
        mode: 'idle',
        year: getStorylineStartYear(storyline),
        selectedEventId: null,
      },
    }));
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
  selectChapterFilter(chapter) {
    set((state) => ({
      timeFilter: { kind: 'chapter', chapterId: chapter.id },
      navigation: {
        ...state.navigation,
        mode: 'idle',
        // A present-kind chapter has no year to move the playhead to, so it stays
        // where it was rather than jumping somewhere arbitrary.
        year: chapter.kind === 'period' ? chapter.yearStart : state.navigation.year,
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
  selectYear(year) {
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
      layout: {
        ...state.layout,
        panels: {
          ...state.layout.panels,
          description: true,
        },
      },
      navigation: {
        ...state.navigation,
        mode: 'idle',
        selectedEventId: eventId,
      },
    }));
    persistLayout(get().layout);
  },
  closePanel() {
    set((state) => ({
      panelEventId: null,
      layout: {
        ...state.layout,
        panels: {
          ...state.layout.panels,
          description: false,
        },
      },
      navigation: {
        ...state.navigation,
        selectedEventId: null,
      },
    }));
    persistLayout(get().layout);
  },
  togglePanel(panelId) {
    set((state) => ({
      layout: {
        ...state.layout,
        panels: {
          ...state.layout.panels,
          [panelId]: !state.layout.panels[panelId],
        },
      },
    }));
    persistLayout(get().layout);
  },
  showPanel(panelId) {
    set((state) => ({
      layout: {
        ...state.layout,
        panels: {
          ...state.layout.panels,
          [panelId]: true,
        },
      },
    }));
    persistLayout(get().layout);
  },
  hidePanel(panelId) {
    set((state) => ({
      layout: {
        ...state.layout,
        panels: {
          ...state.layout.panels,
          [panelId]: false,
        },
      },
    }));
    persistLayout(get().layout);
  },
  resetLayout() {
    set((state) => ({
      layout: {
        ...defaultLayoutState,
        panels: { ...defaultPanels },
      },
      navigation: {
        ...state.navigation,
      },
    }));
    persistLayout(get().layout);
  },
  setRightColumnWidthRatio(ratio) {
    set((state) => ({
      layout: {
        ...state.layout,
        rightColumnWidthRatio: clampRatio(ratio),
      },
    }));
    persistLayout(get().layout);
  },
  setRightColumnSplit(ratio) {
    set((state) => ({
      layout: {
        ...state.layout,
        rightColumnSplit: ratio,
      },
    }));
    persistLayout(get().layout);
  },
  setRightColumnOrientation(orientation) {
    // No width adjustment needed here: rightColumnWidthRatio is dimensionless
    // and gets re-clamped against the current orientation's absolute max at
    // render time regardless (see getClampedRightColumnWidth in App.tsx), so
    // there is no "stored value springs back oversized" case to guard against
    // the way there was when width was stored in raw pixels.
    set((state) => ({
      layout: {
        ...state.layout,
        rightColumnOrientation: orientation,
      },
    }));
    persistLayout(get().layout);
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

export function getPeriodChapters(storyline: Storyline): PeriodChapter[] {
  return storyline.chapters.filter(
    (chapter): chapter is PeriodChapter => chapter.kind === 'period',
  );
}

export function getStorylineStartYear(storyline: Storyline): number {
  const periods = getPeriodChapters(storyline);
  return periods.length > 0
    ? Math.min(...periods.map((chapter) => chapter.yearStart))
    : 870;
}

/**
 * The scrubber's extent, taken from the storyline rather than the whole corpus.
 * Tier-0 ran the timeline to the present because Prague's last chapter is open
 * ended; a person's is not, and a scrubber from 1316 to today for a man who died
 * in 1378 would be almost entirely dead track.
 */
export function getStorylineYearRange(
  storyline: Storyline,
  nodes: ResolvedEntry[],
  currentYear: number,
): { minYear: number; maxYear: number } {
  const periods = getPeriodChapters(storyline);
  const minYear = getStorylineStartYear(storyline);
  const isOpenEnded = periods.some((chapter) => chapter.yearEnd === null);

  let maxYear = isOpenEnded
    ? currentYear
    : // Chapter ranges are half-open, so the last *inclusive* year is yearEnd - 1.
      // Without the -1 the playhead can be dragged one year past the end of the
      // final chapter, where getCurrentChapter matches nothing.
      Math.max(minYear + 1, ...periods.map((chapter) => (chapter.yearEnd ?? minYear) - 1));

  // An event can outlast its chapter's declared end (a span such as the Hunger
  // Wall, 1360–1362), so the track has to reach it either way.
  for (const { node } of nodes) {
    if (node.kind === 'event') {
      maxYear = Math.max(maxYear, node.event.yearEnd ?? node.event.yearStart);
    }
  }

  return { minYear, maxYear };
}

export function getCurrentChapter(
  chapters: Chapter[],
  year: number,
): PeriodChapter | null {
  return (
    chapters.find((chapter): chapter is PeriodChapter => {
      if (chapter.kind !== 'period') {
        return false;
      }
      return (
        year >= chapter.yearStart &&
        (chapter.yearEnd === null || year < chapter.yearEnd)
      );
    }) ?? null
  );
}

/** An entry paired with the node it points at. */
export type ResolvedEntry = {
  entry: StorylineEntry;
  node: StoryNode;
};

/**
 * Walks one storyline's entries and pairs each with its node, in reading order:
 * chapter order as declared on the storyline, then `entry.order` within a chapter.
 *
 * An entry whose `ref` resolves to nothing is dropped rather than thrown on — the
 * content validator is the gate for dangling refs, and a typo should not blank the
 * whole app at runtime.
 */
export function resolveStorylineEntries(
  storyline: Storyline,
  events: StoryEvent[],
  visitablePlaces: VisitablePlace[],
): ResolvedEntry[] {
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const placesById = new Map(visitablePlaces.map((place) => [place.id, place]));
  const chapterIndexById = new Map(
    storyline.chapters.map((chapter, index) => [chapter.id, index]),
  );

  const resolved: ResolvedEntry[] = [];
  for (const entry of storyline.entries) {
    const event = eventsById.get(entry.ref);
    if (event) {
      resolved.push({ entry, node: { kind: 'event', event } });
      continue;
    }

    const place = placesById.get(entry.ref);
    if (place) {
      resolved.push({ entry, node: { kind: 'place', place } });
    }
  }

  return resolved.sort((left, right) => {
    const leftChapter = chapterIndexById.get(left.entry.chapterId) ?? Number.MAX_SAFE_INTEGER;
    const rightChapter = chapterIndexById.get(right.entry.chapterId) ?? Number.MAX_SAFE_INTEGER;
    return leftChapter - rightChapter || left.entry.order - right.entry.order;
  });
}

export type EventMarkerState = 'hidden' | 'active';

/**
 * An entry is in the current window when the filter admits it. A span such as the
 * Josefov clearance (1893–1913) counts as inside a century if any part of it falls
 * there, so it is not lost between two windows.
 *
 * A visitable place has no date at all, so it never matches a century — it is
 * reachable through its own chapter, or through "all".
 */
export function isEntryInWindow(
  { entry, node }: ResolvedEntry,
  filter: TimeFilter,
): boolean {
  switch (filter.kind) {
    case 'all':
      return true;
    case 'chapter':
      return entry.chapterId === filter.chapterId;
    case 'century': {
      if (node.kind !== 'event') {
        return false;
      }
      const firstCentury = centuryOf(node.event.yearStart);
      const lastCentury = centuryOf(node.event.yearEnd ?? node.event.yearStart);
      return filter.century >= firstCentury && filter.century <= lastCentury;
    }
  }
}

export function getEntryMarkerState(
  resolved: ResolvedEntry,
  filter: TimeFilter,
): EventMarkerState {
  return isEntryInWindow(resolved, filter) ? 'active' : 'hidden';
}

export function getVisibleEntries(
  entries: ResolvedEntry[],
  filter: TimeFilter,
): ResolvedEntry[] {
  return entries.filter((resolved) => isEntryInWindow(resolved, filter));
}

/** How a storyline's full span reads in a label: "870 to today", "1316 to 1378". */
export function describeStorylineSpan(storyline: Storyline): string {
  const periods = getPeriodChapters(storyline);
  if (periods.length === 0) {
    return '';
  }

  const minYear = Math.min(...periods.map((chapter) => chapter.yearStart));
  const isOpenEnded = periods.some((chapter) => chapter.yearEnd === null);
  if (isOpenEnded) {
    return `${minYear} to today`;
  }

  // Chapter ranges are half-open, so the last inclusive year is yearEnd - 1.
  const lastYear = Math.max(...periods.map((chapter) => chapter.yearEnd ?? chapter.yearStart));
  return `${minYear} to ${lastYear - 1}`;
}

export function describeTimeFilter(
  filter: TimeFilter,
  storyline: Storyline | null,
  /**
   * Whether the map is also showing an era zone for this chapter. Only the Prague
   * chapters have hand-drawn zones, so the "illustrative sketch" caveat has to be
   * conditional — claiming a zone that is not on screen would be worse than not
   * mentioning one that is.
   */
  hasZone = false,
): { title: string; blurb: string } {
  if (!storyline) {
    return { title: 'No storyline selected', blurb: '' };
  }

  switch (filter.kind) {
    case 'chapter': {
      const chapter = storyline.chapters.find(
        (candidate) => candidate.id === filter.chapterId,
      );
      if (!chapter) {
        return { title: storyline.title, blurb: '' };
      }

      const zoneCaveat = hasZone
        ? " The shaded zone on the map is an illustrative sketch of the city's built-up area in this period, not a surveyed boundary."
        : '';
      return {
        title: chapter.name,
        blurb: `${chapter.blurb}${zoneCaveat}`.trim(),
      };
    }
    case 'century':
      return {
        title: centuryLabel(filter.century),
        blurb:
          'Showing every entry that falls in this century. Pick a chapter below to read about the period, or choose All to see the whole storyline at once.',
      };
    case 'all': {
      const span = describeStorylineSpan(storyline);
      return {
        title: span ? `${storyline.title}, ${span}` : storyline.title,
        blurb:
          'Every entry on the map at once. Drag the playhead to narrow to a century, or pick a chapter to focus on one part of the story.',
      };
    }
  }
}

export function getEntriesByChapter(
  storyline: Storyline,
  entries: ResolvedEntry[],
): Array<{ chapter: Chapter; entries: ResolvedEntry[] }> {
  return storyline.chapters.map((chapter) => ({
    chapter,
    entries: entries
      .filter((resolved) => resolved.entry.chapterId === chapter.id)
      .sort((left, right) => left.entry.order - right.entry.order),
  }));
}
