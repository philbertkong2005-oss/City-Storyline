import type { Era } from '../../data/schema';

type EraBandsProps = {
  eras: Era[];
  timelineEnd: number;
  currentEraId: string | null;
  onSelectEra: (era: Era) => void;
};

export default function EraBands({
  eras,
  timelineEnd,
  currentEraId,
  onSelectEra,
}: EraBandsProps) {
  const totalYears = timelineEnd - (eras[0]?.yearStart ?? timelineEnd) + 1;

  return (
    <div className="rounded-[1.75rem] border border-white/60 bg-[#f8f5ef]/75 p-3 shadow-panel backdrop-blur">
      <div className="grid gap-2 md:grid-flow-col">
        {eras.map((era) => {
          const bandEnd = era.yearEnd ?? timelineEnd + 1;
          const width = ((bandEnd - era.yearStart) / totalYears) * 100;

          return (
            <button
              key={era.id}
              type="button"
              onClick={() => onSelectEra(era)}
              style={{ flexBasis: `${width}%` }}
              className={[
                'min-h-[4.5rem] rounded-[1.4rem] border px-4 py-3 text-left transition md:flex-1',
                currentEraId === era.id
                  ? 'border-slate-900 bg-slate-900 text-[#f8f5ef]'
                  : 'border-slate-200 bg-white/80 text-slate-800 hover:border-slate-400 hover:bg-white',
              ].join(' ')}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em]">
                {era.yearStart}
                {era.yearEnd === null ? ' onward' : `–${era.yearEnd - 1}`}
              </p>
              <p className="mt-2 font-display text-lg leading-tight">{era.name}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
