type WindowNoteProps = {
  title: string;
  blurb: string;
  visibleCount: number;
  totalCount: number;
};

export default function WindowNote({
  title,
  blurb,
  visibleCount,
  totalCount,
}: WindowNoteProps) {
  return (
    <div className="flex min-w-0 items-baseline gap-x-4 border-b border-slate-200/70 px-5 pb-2 pt-2.5">
      <h2 className="shrink-0 font-display text-base leading-tight text-slate-950">
        {title}
      </h2>
      <p
        className={[
          'min-w-0 flex-1 truncate text-sm leading-6',
          visibleCount === 0 ? 'text-amber-800' : 'text-slate-600',
        ].join(' ')}
        title={visibleCount === 0 ? undefined : blurb}
      >
        {visibleCount === 0
          ? 'No events fall in this century — the map is empty on purpose. Drag on, or pick a chapter below.'
          : blurb}
      </p>
      <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {visibleCount} of {totalCount} shown
      </p>
    </div>
  );
}
