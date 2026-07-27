import type { Era, StoryEvent } from '../data/schema';

type ListFallbackProps = {
  groups: Array<{ era: Era; events: StoryEvent[] }>;
  currentEraId: string | null;
  selectedEventId: string | null;
  onOpenPanel: (event: StoryEvent) => void;
};

export default function ListFallback({
  groups,
  currentEraId,
  selectedEventId,
  onOpenPanel,
}: ListFallbackProps) {
  return (
    <section className="h-full overflow-y-auto rounded-[2rem] border border-white/60 bg-[#f8f5ef]/80 p-5 shadow-panel backdrop-blur">
      <div className="mb-6 flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
            List View
          </p>
          <h2 className="mt-2 font-display text-3xl text-slate-950">
            Prague in chapters
          </h2>
        </div>
        <p className="max-w-xs text-sm leading-6 text-slate-600">
          The list fallback keeps every event readable when the map is unavailable or the screen is too narrow for the 3D layout.
        </p>
      </div>

      <div className="space-y-8">
        {groups.map(({ era, events }) => (
          <section key={era.id}>
            <div className="mb-3 flex items-center gap-3">
              <span
                className={[
                  'h-2.5 w-2.5 rounded-full',
                  currentEraId === era.id ? 'bg-slate-900' : 'bg-slate-300',
                ].join(' ')}
              />
              <h3 className="font-display text-2xl text-slate-900">{era.name}</h3>
              <p className="text-sm text-slate-500">
                {era.yearStart}
                {era.yearEnd === null ? ' onward' : `–${era.yearEnd - 1}`}
              </p>
            </div>
            <div className="grid gap-3">
              {events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onOpenPanel(event)}
                  className={[
                    'rounded-[1.75rem] border p-4 text-left transition',
                    selectedEventId === event.id
                      ? 'border-slate-900 bg-slate-900 text-[#f8f5ef]'
                      : 'border-slate-200 bg-white/80 text-slate-900 hover:border-slate-400 hover:bg-white',
                  ].join(' ')}
                >
                  <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em]">
                    <span>{event.yearStart}{event.yearEnd ? `–${event.yearEnd}` : ''}</span>
                    <span
                      className={[
                        'rounded-full px-2 py-1 tracking-[0.14em]',
                        selectedEventId === event.id
                          ? 'bg-white/15 text-[#f8f5ef]'
                          : 'bg-slate-100 text-slate-600',
                      ].join(' ')}
                    >
                      {event.category}
                    </span>
                  </div>
                  <h4 className="mt-3 font-display text-2xl leading-tight">{event.title}</h4>
                  <p
                    className={[
                      'mt-2 text-sm leading-6',
                      selectedEventId === event.id ? 'text-[#f8f5ef]/85' : 'text-slate-700',
                    ].join(' ')}
                  >
                    {event.summary}
                  </p>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
