import type { Coordinates, Locality } from '../data/schema';

/**
 * Rough equirectangular distance, accurate enough at Bohemian latitudes for
 * same-region comparisons — not for anything requiring real precision.
 */
export function approxMetersBetween(a: Coordinates, b: Coordinates): number {
  const metersPerDegLat = 111_320;
  const metersPerDegLng = 111_320 * Math.cos((a.lat * Math.PI) / 180);
  const dLat = (a.lat - b.lat) * metersPerDegLat;
  const dLng = (a.lng - b.lng) * metersPerDegLng;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

export function isInsideLocality(
  coordinates: Coordinates,
  locality: Locality,
): boolean {
  const [[west, south], [east, north]] = locality.bounds;
  return (
    coordinates.lng >= west &&
    coordinates.lng <= east &&
    coordinates.lat >= south &&
    coordinates.lat <= north
  );
}

/**
 * Which place a coordinate belongs to. Membership is computed, never tagged
 * (Decision #3), so a new event classifies itself the moment it has coordinates.
 */
export function getLocalityFor(
  coordinates: Coordinates | undefined,
  localities: Locality[],
): Locality | null {
  if (!coordinates) {
    return null;
  }

  return localities.find((locality) => isInsideLocality(coordinates, locality)) ?? null;
}
