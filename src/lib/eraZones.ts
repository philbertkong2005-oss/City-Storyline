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

export type EraZoneFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, { eraId: string; color: string }>;

export function getEraZoneFeature(eraId: string): EraZoneFeature | null {
  const record = ERA_ZONES.find((zone) => zone.eraId === eraId);
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
