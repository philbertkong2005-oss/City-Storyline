import type { Era } from '../../data/schema';

type EraBandsProps = {
  eras: Era[];
  currentEraId: string | null;
  onSelectEra: (era: Era) => void;
};

export default function EraBands({
  eras,
  currentEraId,
  onSelectEra,
}: EraBandsProps) {
  return (
    <div className="rounded-[1.5rem] border border-white/60 bg-[#f8f5ef]/75 p-2 shadow-panel backdrop-blur">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 md:auto-cols-fr md:grid-flow-col">
        {eras.map((era) => (
          <button
            key={era.id}
            type="button"
            onClick={() => onSelectEra(era)}
            aria-pressed={currentEraId === era.id}
            title={`${era.name} · ${era.yearStart}${era.yearEnd === null ? ' onward' : `–${era.yearEnd - 1}`}`}
            className={[
              'rounded-[1.1rem] border px-3 py-1.5 text-left transition',
              currentEraId === era.id
                ? 'border-slate-900 bg-slate-900 text-[#f8f5ef]'
                : 'border-slate-200 bg-white/80 text-slate-800 hover:border-slate-400 hover:bg-white',
            ].join(' ')}
          >
            <p className="truncate font-display text-[0.9rem] leading-tight">{era.name}</p>
            <p
              className={[
                'text-[10px] font-semibold uppercase tracking-[0.16em]',
                currentEraId === era.id ? 'text-[#f8f5ef]/70' : 'text-slate-500',
              ].join(' ')}
            >
              {era.yearStart}
              {era.yearEnd === null ? ' onward' : `–${era.yearEnd - 1}`}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
