import type { Era } from '../../data/schema';

type ScrubberProps = {
  minYear: number;
  maxYear: number;
  year: number;
  currentEra: Era | null;
  onYearChange: (year: number) => void;
};

export default function Scrubber({
  minYear,
  maxYear,
  year,
  currentEra,
  onYearChange,
}: ScrubberProps) {
  return (
    <div className="rounded-[1.5rem] border border-white/60 bg-[#f8f5ef]/85 px-5 py-3 shadow-panel backdrop-blur">
      <div className="flex items-center gap-5">
        <div className="flex w-56 shrink-0 items-baseline gap-2">
          <span className="font-display text-3xl leading-none text-slate-950">{year}</span>
          <span className="truncate text-sm text-slate-600">
            {currentEra?.name ?? 'Outside chapter range'}
          </span>
        </div>

        <label className="min-w-0 flex-1">
          <span className="sr-only">Timeline year</span>
          <input
            type="range"
            min={minYear}
            max={maxYear}
            step={1}
            value={year}
            onChange={(event) => onYearChange(Number(event.target.value))}
            className="timeline-range w-full accent-slate-900"
          />
          <div className="mt-1 flex justify-between text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
            <span>{minYear}</span>
            <span>{maxYear}</span>
          </div>
        </label>
      </div>
    </div>
  );
}
