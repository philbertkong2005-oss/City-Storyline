import type { Category } from '../data/schema';
import type { ResolvedEntry } from '../store/useAppStore';

/**
 * Genre is derived from the categories of a storyline's events, never authored
 * (Decision #8). Derivation guarantees completeness, which is exactly what a
 * filter facet needs — hand-labelling's failure mode is the forgotten tag that
 * hides a result.
 */
export type GenreTally = {
  category: Category;
  count: number;
};

export function tallyGenres(entries: ResolvedEntry[]): GenreTally[] {
  const counts = new Map<Category, number>();

  for (const { node } of entries) {
    // Visitable places have no category; only events carry one.
    if (node.kind !== 'event') {
      continue;
    }
    counts.set(node.event.category, (counts.get(node.event.category) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    // Ties broken alphabetically so the badge order is stable between renders
    // rather than depending on Map insertion order.
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));
}

/**
 * The badge shows the top few; the filter matches on *any* category present.
 *
 * That split is deliberate: Prague has one flood in 23 events, so it should be
 * findable under "disaster" without being branded a disaster storyline.
 */
export const GENRE_BADGE_LIMIT = 3;

export function topGenres(entries: ResolvedEntry[], limit = GENRE_BADGE_LIMIT): Category[] {
  return tallyGenres(entries)
    .slice(0, limit)
    .map((tally) => tally.category);
}

export function allGenres(entries: ResolvedEntry[]): Category[] {
  return tallyGenres(entries).map((tally) => tally.category);
}
