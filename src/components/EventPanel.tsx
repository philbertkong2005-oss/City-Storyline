import type { Era, StoryEvent } from '../data/schema';

type EventPanelProps = {
  event: StoryEvent | null;
  era: Era | null;
  open: boolean;
  onClose: () => void;
};

function formatCategory(category: StoryEvent['category']): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export default function EventPanel({
  event,
  era,
  open,
  onClose,
}: EventPanelProps) {
  return (
    <aside
      className={[
        'pointer-events-none absolute inset-y-3 right-3 z-20 flex w-[min(28rem,calc(100%-1.5rem))] justify-end transition duration-300',
        open ? 'translate-x-0 opacity-100' : 'translate-x-6 opacity-0',
      ].join(' ')}
      aria-hidden={!open}
    >
      <div className="pointer-events-auto flex h-full w-full flex-col overflow-hidden rounded-[2rem] border border-white/60 bg-[#f8f5ef]/95 shadow-panel backdrop-blur">
        <div className="flex items-start justify-between border-b border-slate-200/80 px-6 pb-4 pt-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              {era?.name ?? 'Event'}
            </p>
            <h2 className="mt-2 font-display text-3xl leading-tight text-slate-950">
              {event?.title ?? 'No event selected'}
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
            <dl className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
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
                Story Draft
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

            <section className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Gallery
              </h3>
              {event.images.length > 0 ? (
                <div className="mt-3 space-y-4">
                  {event.images.map((image) => (
                    <figure
                      key={image.src}
                      className="overflow-hidden rounded-3xl border border-slate-200 bg-white/80"
                    >
                      <img
                        src={`${import.meta.env.BASE_URL}images/${image.src}`}
                        alt={image.alt}
                        loading="lazy"
                        className="h-56 w-full object-cover"
                      />
                      <figcaption className="space-y-2 px-4 py-4 text-sm leading-6 text-slate-700">
                        <p className="text-slate-900">{image.caption}</p>
                        <p>
                          {image.title} by {image.author}. {image.license}. Modified: {image.modified}.
                        </p>
                        <p className="flex flex-wrap gap-3">
                          <a
                            href={image.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4"
                          >
                            Source
                          </a>
                          <a
                            href={image.licenseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4"
                          >
                            License
                          </a>
                        </p>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-4 text-sm text-slate-600">
                  No images ship in Tier-0.
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
        ) : null}
      </div>
    </aside>
  );
}
