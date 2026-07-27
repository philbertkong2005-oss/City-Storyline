import { centuryLabel, centuryOf } from '../../store/useAppStore';

type ScrubberProps = {
  minYear: number;
  maxYear: number;
  year: number;
  onYearChange: (year: number) => void;
};

export default function Scrubber({
  minYear,
  maxYear,
  year,
  onYearChange,
}: ScrubberProps) {
  return (
    <div className="px-5 pb-2.5 pt-2">
      <div className="flex items-center gap-5">
        <div className="flex w-40 shrink-0 items-baseline gap-2">
          <span className="font-display text-3xl leading-none text-slate-950">{year}</span>
          <span className="text-sm text-slate-600">{centuryLabel(centuryOf(year))}</span>
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
