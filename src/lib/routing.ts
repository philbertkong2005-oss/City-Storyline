/**
 * Hash routing, not path routing (Decision #5).
 *
 * GitHub Pages serves static files with no rewrite rules, so a path URL 404s on
 * reload. The `404.html` redirect trick buys clean paths at the cost of a
 * workaround with moving parts; a hash is uglier and cannot break.
 *
 * This is V1, not polish: without it the browser back button *leaves the site*,
 * and a teacher cannot assign a storyline by link.
 */
export type Route =
  | { kind: 'chooser' }
  | { kind: 'storyline'; storylineId: string; entryRef: string | null };

export const CHOOSER_HASH = '#/';

export function parseHash(hash: string): Route {
  const trimmed = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (trimmed.length === 0) {
    return { kind: 'chooser' };
  }

  const [storylineId, entryRef] = trimmed.split('/').map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      // A malformed escape should land on the chooser, not throw during render.
      return '';
    }
  });

  if (!storylineId) {
    return { kind: 'chooser' };
  }

  return {
    kind: 'storyline',
    storylineId,
    entryRef: entryRef && entryRef.length > 0 ? entryRef : null,
  };
}

export function formatRoute(route: Route): string {
  if (route.kind === 'chooser') {
    return CHOOSER_HASH;
  }

  const base = `#/${encodeURIComponent(route.storylineId)}`;
  return route.entryRef ? `${base}/${encodeURIComponent(route.entryRef)}` : base;
}

export function routesEqual(left: Route, right: Route): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  if (left.kind === 'chooser' || right.kind === 'chooser') {
    return true;
  }
  return left.storylineId === right.storylineId && left.entryRef === right.entryRef;
}
