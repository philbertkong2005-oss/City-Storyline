import type { ResolvedEntry } from '../store/useAppStore';

type EventPopupProps = {
  entry: ResolvedEntry;
  onReadMore: (entry: ResolvedEntry) => void;
};

export default function EventPopup({ entry, onReadMore }: EventPopupProps) {
  const { node, entry: membership } = entry;
  const isEvent = node.kind === 'event';
  const images = isEvent ? node.event.images : node.place.images;
  const thumbnail = images[0];
  const title = isEvent ? node.event.title : node.place.title;
  const summary = isEvent ? node.event.summary : node.place.summary;
  const dateLabel = isEvent
    ? `${node.event.yearStart}${node.event.yearEnd ? `–${node.event.yearEnd}` : ''}`
    : 'To visit today';

  return (
    <button
      type="button"
      onClick={() => onReadMore(entry)}
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
        {dateLabel}
      </p>
      <h3 className="mt-2 font-display text-xl leading-tight">{title}</h3>
      {/* The active storyline's framing, so the map itself reflects which story
          the reader is in rather than only the side panel. */}
      {membership.note ? (
        <p className="mt-2 text-sm italic leading-6 text-slate-600">{membership.note}</p>
      ) : null}
      {summary ? (
        <p className="mt-3 text-sm leading-6 text-slate-700">{summary}</p>
      ) : null}
    </button>
  );
}
