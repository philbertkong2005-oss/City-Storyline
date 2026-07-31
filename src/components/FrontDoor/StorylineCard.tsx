import type { Category, Storyline, StorylineType } from '../../data/schema';

type StorylineCardProps = {
  storyline: Storyline;
  entryCount: number;
  span: string;
  genres: Category[];
  active: boolean;
  onEnter: () => void;
  onPreviewStart: () => void;
  onPreviewEnd: () => void;
};

/**
 * Decision #12: card thumbnails are a distinct asset class and must NOT reuse the
 * ~200KB event hero images — every visible card would download one on first
 * paint, and an auto-scrolling rail defeats lazy loading because every card
 * becomes visible within seconds. Real thumbnails are ~480px WebP at 40–60KB with
 * their own validator budget; until those are authored this placeholder costs
 * nothing and ships no bytes.
 */
const typeStyles: Record<StorylineType, { badge: string; thumb: string }> = {
  person: { badge: 'bg-amber-100 text-amber-900', thumb: 'from-amber-200 to-amber-400 text-amber-950' },
  place: { badge: 'bg-sky-100 text-sky-900', thumb: 'from-sky-200 to-sky-400 text-sky-950' },
  period: { badge: 'bg-emerald-100 text-emerald-900', thumb: 'from-emerald-200 to-emerald-400 text-emerald-950' },
  theme: { badge: 'bg-violet-100 text-violet-900', thumb: 'from-violet-200 to-violet-400 text-violet-950' },
};

export default function StorylineCard({
  storyline,
  entryCount,
  span,
  genres,
  active,
  onEnter,
  onPreviewStart,
  onPreviewEnd,
}: StorylineCardProps) {
  const styles = typeStyles[storyline.type];

  return (
    <button
      type="button"
      onClick={onEnter}
      onMouseEnter={onPreviewStart}
      onMouseLeave={onPreviewEnd}
      // Focus mirrors hover so the preview flight is reachable by keyboard, not
      // only by pointer.
      onFocus={onPreviewStart}
      onBlur={onPreviewEnd}
      aria-label={`Open the ${storyline.title} storyline`}
      className={[
        'group flex w-[17rem] shrink-0 flex-col gap-3 rounded-[1.5rem] border p-3 text-left transition',
        active
          ? 'border-slate-900 bg-white shadow-panel'
          : 'border-white/60 bg-[#f8f5ef]/85 hover:border-slate-400 hover:bg-white',
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={[
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-gradient-to-br font-display text-xl',
            styles.thumb,
          ].join(' ')}
        >
          {storyline.title.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg leading-tight text-slate-950">
            {storyline.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={[
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]',
                styles.badge,
              ].join(' ')}
            >
              {storyline.type}
            </span>
            <span className="text-[11px] text-slate-500">
              {entryCount} entries · {span}
            </span>
          </div>
        </div>
      </div>

      {storyline.summary ? (
        <p className="line-clamp-2 text-sm leading-6 text-slate-700">{storyline.summary}</p>
      ) : null}

      {genres.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {genres.map((genre) => (
            <span
              key={genre}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600"
            >
              {genre}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
}
