import eraZonesJson from '../data/eraZones.json';

/**
 * Rough, hand-drawn approximations of Prague's built-up extent per era — NOT a
 * surveyed dataset. There is no verified historical GIS source wired into this
 * project; these shapes exist to give a directional sense of how the city grew
 * (scattered early settlements -> the walled medieval "four towns" -> 19th/20th
 * century suburb incorporation -> the modern administrative area) and should be
 * read that way, never as an authoritative boundary. The caveat is surfaced in
 * the UI wherever a zone is shown — see describeTimeFilter in useAppStore.ts.
 */
export const ERA_ZONE_SOURCE = 'era-zones';
export const ERA_ZONE_FILL_LAYER = 'era-zone-fill';
export const ERA_ZONE_OUTLINE_LAYER = 'era-zone-outline';

type EraZoneRecord = {
  eraId: string;
  color: string;
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
};

const ERA_ZONES = eraZonesJson as EraZoneRecord[];

/**
 * These zones sketch the growth of one city, so they belong to the Prague
 * storyline and to nothing else. Gating on the storyline id rather than relying
 * on chapter ids not colliding: Prague's chapters are Tier-0's eras and keep
 * their ids, but a future storyline is free to name a chapter "charles" without
 * inheriting Prague's 14th-century footprint.
 */
export const ZONED_STORYLINE_ID = 'prague';

export type EraZoneFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, { eraId: string; color: string }>;

export function getChapterZoneFeature(
  storylineId: string | null,
  chapterId: string,
): EraZoneFeature | null {
  if (storylineId !== ZONED_STORYLINE_ID) {
    return null;
  }

  const record = ERA_ZONES.find((zone) => zone.eraId === chapterId);
  if (!record) {
    return null;
  }

  return {
    type: 'Feature',
    properties: { eraId: record.eraId, color: record.color },
    geometry:
      record.type === 'MultiPolygon'
        ? { type: 'MultiPolygon', coordinates: record.coordinates as number[][][][] }
        : { type: 'Polygon', coordinates: record.coordinates as number[][][] },
  };
}
