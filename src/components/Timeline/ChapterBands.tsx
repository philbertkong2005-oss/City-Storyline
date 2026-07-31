import type { Chapter } from '../../data/schema';
import type { TimeFilter } from '../../store/useAppStore';

type ChapterBandsProps = {
  chapters: Chapter[];
  /** Full extent of the active storyline, e.g. "870 to today" or "1316 to 1378". */
  spanLabel: string;
  timeFilter: TimeFilter;
  onSelectChapter: (chapter: Chapter) => void;
  onSelectAll: () => void;
};

const chipBase =
  'rounded-[1.1rem] border px-2.5 py-1.5 text-left leading-tight transition';
const chipOn = 'border-slate-900 bg-slate-900 text-[#f8f5ef]';
const chipOff =
  'border-slate-200 bg-white/80 text-slate-800 hover:border-slate-400 hover:bg-white';

/**
 * Chapter ranges are half-open, so a chapter ending at 1419 is inclusive of 1418.
 * A present-kind chapter has no range at all (Decision #16).
 */
function describeChapterRange(chapter: Chapter): string {
  if (chapter.kind === 'present') {
    return 'Today';
  }

  return `${chapter.yearStart}–${chapter.yearEnd === null ? 'now' : chapter.yearEnd - 1}`;
}

export default function ChapterBands({
  chapters,
  spanLabel,
  timeFilter,
  onSelectChapter,
  onSelectAll,
}: ChapterBandsProps) {
  const activeChapterId = timeFilter.kind === 'chapter' ? timeFilter.chapterId : null;
  const allActive = timeFilter.kind === 'all';

  return (
    // No card of its own: this nests inside the floating timeline bar, which
    // supplies the surface.
    <div className="min-w-0 px-2.5 pb-2.5 pt-2">
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-9">
        <button
          type="button"
          onClick={onSelectAll}
          aria-pressed={allActive}
          title={`Show every entry, ${spanLabel}`}
          className={[chipBase, allActive ? chipOn : chipOff].join(' ')}
        >
          <p className="font-display text-[0.85rem]">All</p>
          <p
            className={[
              'text-[10px] font-semibold uppercase tracking-[0.14em]',
              allActive ? 'text-[#f8f5ef]/70' : 'text-slate-500',
            ].join(' ')}
          >
            {spanLabel}
          </p>
        </button>

        {chapters.map((chapter) => {
          const active = activeChapterId === chapter.id;
          const range = describeChapterRange(chapter);

          return (
            <button
              key={chapter.id}
              type="button"
              onClick={() => onSelectChapter(chapter)}
              aria-pressed={active}
              title={`${chapter.name} · ${range}`}
              className={[chipBase, active ? chipOn : chipOff].join(' ')}
            >
              <p className="font-display text-[0.85rem]">{chapter.shortName}</p>
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
