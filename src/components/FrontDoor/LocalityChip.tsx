import type { LocalityFilter } from '../../store/useAppStore';

type LocalityChipProps = {
  localityName: string;
  proximity: LocalityFilter['proximity'];
  hiddenElsewhere: number;
  onClear: () => void;
};

/**
 * Decision #10: hiding results is allowed, hiding them silently is not.
 *
 * The chip is always dismissible, always says how many storylines it is keeping
 * off screen, and in the `leaving` state warns that panning further will drop it
 * — so the filter never clears as an unexplained surprise.
 */
export default function LocalityChip({
  localityName,
  proximity,
  hiddenElsewhere,
  onClear,
}: LocalityChipProps) {
  const leaving = proximity === 'leaving';

  return (
    <div
      className={[
        'pointer-events-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-full border px-3 py-1.5 text-sm shadow-panel backdrop-blur-md transition',
        leaving
          ? 'border-amber-400 bg-amber-50/90 text-amber-950'
          : 'border-slate-300 bg-[#f8f5ef]/85 text-slate-800',
      ].join(' ')}
    >
      <span className="font-semibold">{localityName}</span>
      {leaving ? (
        <span className="text-xs">Keep going to leave {localityName}</span>
      ) : hiddenElsewhere > 0 ? (
        <span className="text-xs text-slate-500">
          {hiddenElsewhere} more elsewhere
        </span>
      ) : null}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear the ${localityName} filter`}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-current/30 text-xs leading-none transition hover:bg-white/70"
      >
        ×
      </button>
    </div>
  );
}
