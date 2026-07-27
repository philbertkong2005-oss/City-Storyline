import { useEffect, useRef, useState } from 'react';

type SplitterProps = {
  orientation: 'vertical' | 'horizontal';
  ariaLabel: string;
  onDragMove: (clientX: number, clientY: number) => void;
  onStep: (delta: number) => void;
};

export default function Splitter({
  orientation,
  ariaLabel,
  onDragMove,
  onStep,
}: SplitterProps) {
  const separatorRef = useRef<HTMLDivElement | null>(null);
  // The guard is a ref, not state: a pointermove dispatched in the same tick as
  // pointerdown would otherwise read the stale `false` and drop the first move.
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    return () => {
      document.body.style.userSelect = '';
    };
  }, []);

  const handlePointerDown = (event: Parameters<NonNullable<JSX.IntrinsicElements['div']['onPointerDown']>>[0]): void => {
    // Enter the drag before capturing. setPointerCapture throws if the pointer id
    // is not currently active, and letting that abort the handler would leave the
    // splitter permanently unresponsive rather than merely uncaptured.
    document.body.style.userSelect = 'none';
    draggingRef.current = true;
    setDragging(true);

    try {
      separatorRef.current?.setPointerCapture(event.pointerId);
    } catch {
      // Without capture the drag still tracks while the pointer stays over the handle.
    }
  };

  const handlePointerMove = (event: Parameters<NonNullable<JSX.IntrinsicElements['div']['onPointerMove']>>[0]): void => {
    if (!draggingRef.current) {
      return;
    }

    onDragMove(event.clientX, event.clientY);
  };

  const stopDragging = (pointerId: number): void => {
    if (separatorRef.current?.hasPointerCapture(pointerId)) {
      separatorRef.current.releasePointerCapture(pointerId);
    }
    document.body.style.userSelect = '';
    draggingRef.current = false;
    setDragging(false);
  };

  const handleKeyDown = (event: Parameters<NonNullable<JSX.IntrinsicElements['div']['onKeyDown']>>[0]): void => {
    if (orientation === 'vertical') {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onStep(-16);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        onStep(16);
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onStep(-16);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      onStep(16);
    }
  };

  return (
    <div
      ref={separatorRef}
      role="separator"
      aria-label={ariaLabel}
      aria-orientation={orientation}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => stopDragging(event.pointerId)}
      onPointerCancel={(event) => stopDragging(event.pointerId)}
      onKeyDown={handleKeyDown}
      className={[
        'group relative shrink-0 touch-none rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900',
        orientation === 'vertical'
          ? 'mx-1 h-full w-2 cursor-col-resize'
          : 'my-1 h-2 w-full cursor-row-resize',
      ].join(' ')}
    >
      <div
        className={[
          'absolute rounded-full bg-slate-300/80 transition group-hover:bg-slate-500 group-focus-visible:bg-slate-700',
          dragging ? 'bg-slate-700' : '',
          orientation === 'vertical'
            ? 'bottom-0 left-1/2 top-0 w-px -translate-x-1/2'
            : 'left-0 right-0 top-1/2 h-px -translate-y-1/2',
        ].join(' ')}
      />
    </div>
  );
}
