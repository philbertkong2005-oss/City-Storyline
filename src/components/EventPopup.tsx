import type { StoryEvent } from '../data/schema';

type EventPopupProps = {
  event: StoryEvent;
  onReadMore: (event: StoryEvent) => void;
};

export default function EventPopup({ event, onReadMore }: EventPopupProps) {
  const thumbnail = event.images[0];

  return (
    <button
      type="button"
      onClick={() => onReadMore(event)}
      className="block w-72 rounded-3xl bg-[#f8f5ef] p-4 text-left text-slate-900 shadow-xl transition hover:bg-[#f4efe7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
    >
      {thumbnail ? (
        <img
          src={`${import.meta.env.BASE_URL}${thumbnail.src.replace(/^\//, '')}`}
          alt={thumbnail.alt}
          loading="lazy"
          className="mb-3 h-28 w-full rounded-2xl object-cover"
        />
      ) : null}
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {event.yearStart}
        {event.yearEnd ? `–${event.yearEnd}` : ''}
      </p>
      <h3 className="mt-2 font-display text-xl leading-tight">{event.title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-700">{event.summary}</p>
    </button>
  );
}
