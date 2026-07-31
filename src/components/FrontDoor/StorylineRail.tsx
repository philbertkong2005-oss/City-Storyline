import { useEffect, useRef, useState, type ReactNode } from 'react';

type StorylineRailProps = {
  /** Off entirely under prefers-reduced-motion, not merely slower. */
  autoScroll: boolean;
  children: ReactNode;
};

const SCROLL_TICK_MS = 32;
const SCROLL_STEP_PX = 0.6;

/**
 * A slowly drifting row of cards that stops the moment a pointer or keyboard
 * focus lands inside it — the drift is an invitation to look, and fighting the
 * user for scroll position while they are trying to read a card would be
 * hostile.
 *
 * Driven by a timer rather than requestAnimationFrame: at ~19px/sec the extra
 * smoothness of rAF buys nothing visible, and a timer keeps the drift
 * observable in headless and non-compositing environments.
 */
export default function StorylineRail({ autoScroll, children }: StorylineRailProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !autoScroll || paused) {
      return;
    }

    const timer = window.setInterval(() => {
      const maxScroll = scroller.scrollWidth - scroller.clientWidth;
      if (maxScroll <= 0) {
        return;
      }

      // Wrap rather than reverse: a rail that bounces back and forth reads as
      // broken, where a loop reads as a carousel.
      scroller.scrollLeft =
        scroller.scrollLeft >= maxScroll - 0.5 ? 0 : scroller.scrollLeft + SCROLL_STEP_PX;
    }, SCROLL_TICK_MS);

    return () => window.clearInterval(timer);
  }, [autoScroll, paused]);

  return (
    <div
      ref={scrollerRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="pointer-events-auto flex gap-3 overflow-x-auto scroll-smooth pb-1"
    >
      {children}
    </div>
  );
}
