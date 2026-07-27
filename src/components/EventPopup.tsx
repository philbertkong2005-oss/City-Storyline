import type { StoryEvent } from '../data/schema';

type EventPopupProps = {
  event: StoryEvent;
  onReadMore: (event: StoryEvent) => void;
};

export default function EventPopup({ event, onReadMore }: EventPopupProps) {
  return (
    <article className="w-72 rounded-3xl bg-[#f8f5ef] p-4 text-slate-900 shadow-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {event.yearStart}
        {event.yearEnd ? `–${event.yearEnd}` : ''}
      </p>
      <h3 className="mt-2 font-display text-xl leading-tight">{event.title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-700">{event.summary}</p>
      <button
        type="button"
        onClick={() => onReadMore(event)}
        className="mt-4 inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-[#f8f5ef] transition hover:bg-slate-700"
      >
        Read more
      </button>
    </article>
  );
}
