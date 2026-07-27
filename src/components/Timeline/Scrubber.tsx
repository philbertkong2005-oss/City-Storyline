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
    <div className="rounded-[1.75rem] border border-white/60 bg-[#f8f5ef]/85 p-4 shadow-panel backdrop-blur">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Timeline
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <span className="font-display text-4xl text-slate-950">{year}</span>
            <span className="pb-1 text-sm text-slate-600">
              {currentEra?.name ?? 'Outside chapter range'}
            </span>
          </div>
        </div>
        <div className="text-sm leading-6 text-slate-600">
          Events before the playhead stay visible but dim, the current chapter lifts forward, and future events stay hidden on the map.
        </div>
      </div>

      <label className="mt-5 block">
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
      </label>

      <div className="mt-2 flex justify-between text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
        <span>{minYear}</span>
        <span>{maxYear}</span>
      </div>
    </div>
  );
}
