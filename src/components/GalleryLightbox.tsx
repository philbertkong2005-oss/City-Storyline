import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import type { StoryImage } from '../data/schema';

type GalleryLightboxProps = {
  images: StoryImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

export default function GalleryLightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: GalleryLightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<Element | null>(null);
  const count = images.length;
  const activeImage = images[Math.min(index, count - 1)];

  // Portaled to <body> rather than rendered in place: the panel this opens from
  // scrolls internally and sits inside a few nested flex/grid containers, and a
  // portal is the reliable way to guarantee a true full-viewport overlay
  // regardless of any ancestor's stacking context.
  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault();
        onIndexChange(index - 1);
      } else if (event.key === 'ArrowRight' && index < count - 1) {
        event.preventDefault();
        onIndexChange(index + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [count, index, onClose, onIndexChange]);

  if (!activeImage) {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${activeImage.caption} — enlarged image ${index + 1} of ${count}`}
      className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/85 p-4 sm:p-8"
      onClick={onClose}
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label="Close enlarged image"
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/10 text-2xl leading-none text-white shadow transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-6 sm:top-6"
      >
        ×
      </button>

      {index > 0 ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onIndexChange(index - 1);
          }}
          aria-label="Previous image"
          className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white/10 text-3xl leading-none text-white shadow transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:left-6"
        >
          ‹
        </button>
      ) : null}

      {index < count - 1 ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onIndexChange(index + 1);
          }}
          aria-label="Next image"
          className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white/10 text-3xl leading-none text-white shadow transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-6"
        >
          ›
        </button>
      ) : null}

      <figure
        className="flex max-h-full max-w-full flex-col items-center gap-4"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={`${import.meta.env.BASE_URL}${activeImage.src.replace(/^\//, '')}`}
          alt={activeImage.alt}
          className="max-h-[78vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl sm:max-h-[82vh]"
        />
        <figcaption className="max-w-[90vw] text-center text-sm leading-6 text-white/85 sm:max-w-xl">
          <p>{activeImage.caption}</p>
          <p className="mt-1 text-white/60">
            {activeImage.title} by {activeImage.author}. {activeImage.license}.
          </p>
          {count > 1 ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              {index + 1} / {count}
            </p>
          ) : null}
        </figcaption>
      </figure>
    </div>,
    document.body,
  );
}
