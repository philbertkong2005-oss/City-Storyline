import type { Era } from '../../data/schema';
import type { TimeFilter } from '../../store/useAppStore';

type EraBandsProps = {
  eras: Era[];
  timeFilter: TimeFilter;
  onSelectEra: (era: Era) => void;
  onSelectAll: () => void;
};

const chipBase =
  'rounded-[1.1rem] border px-2.5 py-1.5 text-left leading-tight transition';
const chipOn = 'border-slate-900 bg-slate-900 text-[#f8f5ef]';
const chipOff =
  'border-slate-200 bg-white/80 text-slate-800 hover:border-slate-400 hover:bg-white';

export default function EraBands({
  eras,
  timeFilter,
  onSelectEra,
  onSelectAll,
}: EraBandsProps) {
  const activeEraId = timeFilter.kind === 'era' ? timeFilter.eraId : null;
  const allActive = timeFilter.kind === 'all';

  return (
    <div className="min-w-0 rounded-[1.5rem] border border-white/60 bg-[#f8f5ef]/75 p-2 shadow-panel backdrop-blur">
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-9">
        <button
          type="button"
          onClick={onSelectAll}
          aria-pressed={allActive}
          title="Show every event, 870 to today"
          className={[chipBase, allActive ? chipOn : chipOff].join(' ')}
        >
          <p className="font-display text-[0.85rem]">All</p>
          <p
            className={[
              'text-[10px] font-semibold uppercase tracking-[0.14em]',
              allActive ? 'text-[#f8f5ef]/70' : 'text-slate-500',
            ].join(' ')}
          >
            870–now
          </p>
        </button>

        {eras.map((era) => {
          const active = activeEraId === era.id;
          const range = `${era.yearStart}${era.yearEnd === null ? '–now' : `–${era.yearEnd - 1}`}`;

          return (
            <button
              key={era.id}
              type="button"
              onClick={() => onSelectEra(era)}
              aria-pressed={active}
              title={`${era.name} · ${range}`}
              className={[chipBase, active ? chipOn : chipOff].join(' ')}
            >
              <p className="font-display text-[0.85rem]">{era.shortName}</p>
              <p
                className={[
                  'text-[10px] font-semibold uppercase tracking-[0.14em]',
                  active ? 'text-[#f8f5ef]/70' : 'text-slate-500',
                ].join(' ')}
              >
                {range}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
