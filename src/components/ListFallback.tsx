import type { Chapter } from '../data/schema';
import type { ResolvedEntry } from '../store/useAppStore';

type ListFallbackProps = {
  storylineTitle: string;
  groups: Array<{ chapter: Chapter; entries: ResolvedEntry[] }>;
  currentChapterId: string | null;
  selectedEventId: string | null;
  onOpenEntry: (resolved: ResolvedEntry) => void;
};

function describeChapterRange(chapter: Chapter): string {
  if (chapter.kind === 'present') {
    return 'Present day';
  }

  return `${chapter.yearStart}${chapter.yearEnd === null ? ' onward' : `–${chapter.yearEnd - 1}`}`;
}

export default function ListFallback({
  storylineTitle,
  groups,
  currentChapterId,
  selectedEventId,
  onOpenEntry,
}: ListFallbackProps) {
  // A chapter with nothing in the current window is dropped rather than rendered
  // as a bare heading — under a single-chapter filter that would leave a wall of
  // empty sections.
  const populated = groups.filter((group) => group.entries.length > 0);

  return (
    <section className="h-full overflow-y-auto rounded-[2rem] border border-white/60 bg-[#f8f5ef]/80 p-5 shadow-panel backdrop-blur">
      <div className="mb-6 flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
            List View
          </p>
          <h2 className="mt-2 font-display text-3xl text-slate-950">
            {storylineTitle} in chapters
          </h2>
        </div>
        <p className="max-w-xs text-sm leading-6 text-slate-600">
          The list fallback keeps every entry readable when the map is unavailable or the screen is too narrow for the 3D layout.
        </p>
      </div>

      <div className="space-y-8">
        {populated.map(({ chapter, entries }) => (
          <section key={chapter.id}>
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
                const id = isEvent ? node.event.id : node.place.id;
                const title = isEvent ? node.event.title : node.place.title;
                const summary = isEvent ? node.event.summary : node.place.summary;
                const selected = selectedEventId === id;

                return (
                  <button
                    key={id}
                    type="button"
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
