import { useCallback, useEffect, useRef } from 'react';

import type { Chapter } from '../data/schema';
import type { ResolvedEntry } from '../store/useAppStore';

type StoryNarrativeProps = {
  storylineTitle: string;
  groups: Array<{ chapter: Chapter; entries: ResolvedEntry[] }>;
  currentChapterId: string | null;
  selectedEventId: string | null;
  onOpenEntry: (resolved: ResolvedEntry) => void;
  /**
   * Present only when there is a map to drive. Absent, this component is exactly
   * the Tier-0 list fallback: readable, clickable, no scroll choreography. The
   * fallback is not optional (PLAN.md Decision #4), so the narrative behaviour is
   * additive rather than a replacement.
   */
  // Explicitly `| undefined`: exactOptionalPropertyTypes is on, so an optional
  // prop cannot otherwise be passed an undefined value from a conditional.
  onStepInto?: ((resolved: ResolvedEntry) => void) | undefined;
  reducedMotion: boolean;
};

/**
 * How long to ignore the scroll observer after we move the scroller ourselves.
 *
 * The loop this prevents: clicking a marker selects an entry, which scrolls the
 * narrative to it, which fires the observer for every entry the scroll passes
 * through, each of which flies the camera. One click, a dozen camera moves.
 */
const PROGRAMMATIC_SCROLL_MS = 700;

/**
 * How long after the last scroll frame to keep ignoring the observer.
 *
 * A fixed window alone is a guess: smooth-scroll duration varies by browser and
 * by distance, so a long jump can outlast it and wake the observer mid-flight,
 * firing a camera move for every entry the scroll is still passing through. Each
 * scroll frame therefore pushes the deadline out, which makes suppression last
 * exactly as long as the animation actually does.
 */
const SCROLL_IDLE_MS = 180;

/**
 * Absolute ceiling on that extension, so a user who starts scrolling by hand
 * during the window cannot keep the observer muted indefinitely.
 */
const MAX_SUPPRESSION_MS = 2500;

function describeChapterRange(chapter: Chapter): string {
  if (chapter.kind === 'present') {
    return 'Present day';
  }

  return `${chapter.yearStart}${chapter.yearEnd === null ? ' onward' : `–${chapter.yearEnd - 1}`}`;
}

function entryNodeId(resolved: ResolvedEntry): string {
  return resolved.node.kind === 'event' ? resolved.node.event.id : resolved.node.place.id;
}

export default function StoryNarrative({
  storylineTitle,
  groups,
  currentChapterId,
  selectedEventId,
  onOpenEntry,
  onStepInto,
  reducedMotion,
}: StoryNarrativeProps) {
  const scrollerRef = useRef<HTMLElement | null>(null);
  const entryRefs = useRef(new Map<string, HTMLElement>());
  const chapterRefs = useRef(new Map<string, HTMLElement>());
  const suppressUntilRef = useRef(0);
  const suppressCeilingRef = useRef(0);
  // The last step this component caused itself, so a selection that came from
  // scrolling does not get scrolled to a second time.
  const lastSteppedRef = useRef<string | null>(null);

  const populated = groups.filter((group) => group.entries.length > 0);
  const stepping = typeof onStepInto === 'function';

  const suppressScrollObserver = useCallback(() => {
    const now = Date.now();
    suppressUntilRef.current = now + PROGRAMMATIC_SCROLL_MS;
    suppressCeilingRef.current = now + MAX_SUPPRESSION_MS;
  }, []);

  // Each frame of our own scroll pushes the deadline out, bounded by the ceiling.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    const handleScroll = (): void => {
      const now = Date.now();
      if (now >= suppressUntilRef.current) {
        return;
      }
      suppressUntilRef.current = Math.min(
        suppressCeilingRef.current,
        Math.max(suppressUntilRef.current, now + SCROLL_IDLE_MS),
      );
    };

    scroller.addEventListener('scroll', handleScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToElement = useCallback(
    (element: HTMLElement | undefined) => {
      if (!element) {
        return;
      }
      suppressScrollObserver();
      element.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'center',
      });
    },
    [reducedMotion, suppressScrollObserver],
  );

  // Scroll drives selection. Only the entry crossing the upper-middle band counts
  // as "being read", which is what makes this stepped rather than continuous:
  // one entry is active at a time and each becomes active exactly once.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !stepping) {
      return;
    }

    const observer = new IntersectionObserver(
      (records) => {
        if (Date.now() < suppressUntilRef.current) {
          return;
        }

        const active = records
          .filter((record) => record.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
        if (!active) {
          return;
        }

        const id = active.target.getAttribute('data-entry-id');
        if (!id || id === lastSteppedRef.current) {
          return;
        }

        const entry = populated
          .flatMap((group) => group.entries)
          .find((candidate) => entryNodeId(candidate) === id);
        if (entry) {
          lastSteppedRef.current = id;
          onStepInto?.(entry);
        }
      },
      { root: scroller, rootMargin: '-40% 0px -50% 0px', threshold: 0 },
    );

    for (const element of entryRefs.current.values()) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [onStepInto, populated, stepping]);

  // Selection from outside — a marker click, a deep link — pulls the narrative to
  // the matching step.
  useEffect(() => {
    if (!selectedEventId || !stepping) {
      return;
    }
    if (lastSteppedRef.current === selectedEventId) {
      return;
    }

    lastSteppedRef.current = selectedEventId;
    scrollToElement(entryRefs.current.get(selectedEventId));
  }, [scrollToElement, selectedEventId, stepping]);

  return (
    <section
      ref={scrollerRef}
      className="h-full overflow-y-auto rounded-[2rem] border border-white/60 bg-[#f8f5ef]/80 shadow-panel backdrop-blur"
    >
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-[#f8f5ef]/95 px-5 pb-3 pt-4 backdrop-blur">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
          {stepping ? 'Narrative' : 'List View'}
        </p>
        <h2 className="mt-1.5 font-display text-2xl text-slate-950">
          {storylineTitle} in chapters
        </h2>

        {/* Chapter index. Jumping is a deliberate navigation, so it steps the
            camera too rather than only moving the scroller. */}
        {populated.length > 1 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {populated.map(({ chapter, entries }) => (
              <button
                key={chapter.id}
                type="button"
                onClick={() => {
                  scrollToElement(chapterRefs.current.get(chapter.id));
                  const first = entries[0];
                  if (first && onStepInto) {
                    lastSteppedRef.current = entryNodeId(first);
                    onStepInto(first);
                  }
                }}
                className={[
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition',
                  currentChapterId === chapter.id
                    ? 'border-slate-900 bg-slate-900 text-[#f8f5ef]'
                    : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-400 hover:text-slate-900',
                ].join(' ')}
              >
                {chapter.shortName}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-8 px-5 pb-[45vh] pt-5">
        {populated.map(({ chapter, entries }) => (
          <section
            key={chapter.id}
            ref={(element) => {
              if (element) {
                chapterRefs.current.set(chapter.id, element);
              } else {
                chapterRefs.current.delete(chapter.id);
              }
            }}
          >
            <div className="mb-3 flex items-center gap-3">
              <span
                className={[
                  'h-2.5 w-2.5 shrink-0 rounded-full',
                  currentChapterId === chapter.id ? 'bg-slate-900' : 'bg-slate-300',
                ].join(' ')}
              />
              <h3 className="font-display text-2xl text-slate-900">{chapter.name}</h3>
              <p className="text-sm text-slate-500">{describeChapterRange(chapter)}</p>
            </div>
            <div className="grid gap-3">
              {entries.map((resolved) => {
                const { entry, node } = resolved;
                const isEvent = node.kind === 'event';
                const id = entryNodeId(resolved);
                const title = isEvent ? node.event.title : node.place.title;
                const summary = isEvent ? node.event.summary : node.place.summary;
                const selected = selectedEventId === id;

                return (
                  <button
                    key={id}
                    type="button"
                    data-entry-id={id}
                    ref={(element) => {
                      if (element) {
                        entryRefs.current.set(id, element);
                      } else {
                        entryRefs.current.delete(id);
                      }
                    }}
                    onClick={() => onOpenEntry(resolved)}
                    className={[
                      'rounded-[1.75rem] border p-4 text-left transition',
                      selected
                        ? 'border-slate-900 bg-slate-900 text-[#f8f5ef]'
                        : 'border-slate-200 bg-white/80 text-slate-900 hover:border-slate-400 hover:bg-white',
                    ].join(' ')}
                  >
                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em]">
                      <span>
                        {isEvent
                          ? `${node.event.yearStart}${node.event.yearEnd ? `–${node.event.yearEnd}` : ''}`
                          : 'To visit'}
                      </span>
                      <span
                        className={[
                          'rounded-full px-2 py-1 tracking-[0.14em]',
                          selected ? 'bg-white/15 text-[#f8f5ef]' : 'bg-slate-100 text-slate-600',
                        ].join(' ')}
                      >
                        {isEvent ? node.event.category : 'place'}
                      </span>
                      {isEvent && !node.event.coordinates ? (
                        <span
                          className={[
                            'rounded-full px-2 py-1 tracking-[0.14em]',
                            selected ? 'bg-white/15 text-[#f8f5ef]' : 'bg-amber-100 text-amber-900',
                          ].join(' ')}
                        >
                          off map
                        </span>
                      ) : null}
                    </div>
                    <h4 className="mt-3 font-display text-2xl leading-tight">{title}</h4>
                    {/* The per-storyline framing, above the shared summary. Switching
                        storylines changes this line and nothing below it. */}
                    {entry.note ? (
                      <p
                        className={[
                          'mt-2 text-sm italic leading-6',
                          selected ? 'text-[#f8f5ef]/90' : 'text-slate-600',
                        ].join(' ')}
                      >
                        {entry.note}
                      </p>
                    ) : null}
                    {summary ? (
                      <p
                        className={[
                          'mt-2 text-sm leading-6',
                          selected ? 'text-[#f8f5ef]/85' : 'text-slate-700',
                        ].join(' ')}
                      >
                        {summary}
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
