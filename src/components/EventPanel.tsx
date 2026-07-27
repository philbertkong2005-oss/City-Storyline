import { useEffect, useState } from 'react';

import type { Era, StoryEvent } from '../data/schema';
import GalleryLightbox from './GalleryLightbox';

type EventPanelProps = {
  event: StoryEvent | null;
  era: Era | null;
  onClose: () => void;
};

function formatCategory(category: StoryEvent['category']): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export default function EventPanel({
  event,
  era,
  onClose,
}: EventPanelProps) {
  const [imageIndex, setImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    setImageIndex(0);
    setLightboxOpen(false);
  }, [event?.id]);

  const imageCount = event?.images.length ?? 0;
  const activeImage =
    event && imageCount > 0
      ? event.images[Math.min(imageIndex, imageCount - 1)]
      : null;

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border border-white/60 bg-[#f8f5ef]/95 shadow-panel backdrop-blur">
      <div className="flex items-start justify-between border-b border-slate-200/80 px-6 pb-4 pt-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            {era?.name ?? 'Description'}
          </p>
          <h2 className="mt-2 font-display text-3xl leading-tight text-slate-950">
            {event?.title ?? 'Event details'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-600 transition hover:border-slate-500 hover:text-slate-900"
        >
          Close
        </button>
      </div>

      {event ? (
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-5">
          <section>
            {activeImage ? (
              <div className="space-y-4">
                <figure className="overflow-hidden rounded-3xl border border-slate-200 bg-white/80">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      aria-label={`Enlarge image: ${activeImage.caption}`}
                      className="group block w-full cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                    >
                      <img
                        src={`${import.meta.env.BASE_URL}${activeImage.src.replace(/^\//, '')}`}
                        alt={activeImage.alt}
                        loading="lazy"
                        className="h-56 w-full object-cover transition group-hover:brightness-90"
                      />
                    </button>
                    {imageCount > 1 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setImageIndex((current) => Math.max(0, current - 1))}
                          aria-label="Previous image"
                          disabled={imageIndex === 0}
                          className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-[#f8f5ef]/90 text-2xl leading-none text-slate-900 shadow transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setImageIndex((current) => Math.min(imageCount - 1, current + 1))
                          }
                          aria-label="Next image"
                          disabled={imageIndex === imageCount - 1}
                          className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-[#f8f5ef]/90 text-2xl leading-none text-slate-900 shadow transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          ›
                        </button>
                        <div className="absolute bottom-3 right-3 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-[#f8f5ef]">
                          {imageIndex + 1} / {imageCount}
                        </div>
                      </>
                    ) : null}
                  </div>
                  <figcaption className="space-y-2 px-4 py-4 text-sm leading-6 text-slate-700">
                    <p className="text-slate-900">{activeImage.caption}</p>
                    <p>
                      {activeImage.title} by {activeImage.author}. {activeImage.license}. Modified: {activeImage.modified}.
                    </p>
                    <p className="flex flex-wrap gap-3">
                      <a
                        href={activeImage.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4"
                      >
                        Source
                      </a>
                      <a
                        href={activeImage.licenseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4"
                      >
                        License
                      </a>
                    </p>
                  </figcaption>
                </figure>
                {imageCount > 1 ? (
                  <div className="flex items-center justify-center gap-2">
                    {event.images.map((image, index) => (
                      <span
                        key={image.src}
                        aria-hidden="true"
                        className={[
                          'h-2.5 w-2.5 rounded-full',
                          index === imageIndex ? 'bg-slate-900' : 'bg-slate-300',
                        ].join(' ')}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-4 text-sm text-slate-600">
                No images available for this event yet.
              </p>
            )}
          </section>

          <dl className="mt-6 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
            <div className="rounded-2xl bg-white/80 p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Date
              </dt>
              <dd className="mt-2 text-base text-slate-900">
                {event.yearStart}
                {event.yearEnd ? `–${event.yearEnd}` : ''}
              </dd>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Category
              </dt>
              <dd className="mt-2 text-base text-slate-900">
                {formatCategory(event.category)}
              </dd>
            </div>
            <div className="rounded-2xl bg-white/80 p-4 md:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Location
              </dt>
              <dd className="mt-2 text-base text-slate-900">{event.locationName}</dd>
              {event.locationPrecision !== 'exact' && (
                <p className="mt-2 rounded-2xl border border-amber-300/80 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Approximation note: {event.locationNote ?? 'This marker represents a broader location.'}
                </p>
              )}
            </div>
          </dl>

          <section className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Summary
            </h3>
            <p className="mt-3 text-base leading-7 text-slate-800">{event.summary}</p>
          </section>

          <section className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Story
            </h3>
            {event.body.length > 0 ? (
              <div className="mt-3 space-y-4 text-base leading-7 text-slate-800">
                {event.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-4 text-sm text-slate-600">
                Prose has not been written for this event yet.
              </p>
            )}
          </section>

          <div className="mt-8">
            <a
              href={event.wikipediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-[#f8f5ef] transition hover:bg-slate-700"
            >
              Open Wikipedia article
            </a>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center px-6 py-6">
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-4 text-sm leading-6 text-slate-600">
            Select a marker on the map to read about an event.
          </p>
        </div>
      )}

      {lightboxOpen && event && activeImage ? (
        <GalleryLightbox
          images={event.images}
          index={imageIndex}
          onIndexChange={setImageIndex}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </aside>
  );
}
