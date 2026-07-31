import type { Coordinates, Locality } from '../data/schema';
import { CITY_DETAIL_MIN_ZOOM } from './mapStyle';

/**
 * How far past a locality's own bounds you must pan before the filter lets go,
 * as a fraction of that locality's half-extent.
 *
 * Proportional rather than absolute so the friction scales with the place:
 * drifting 2km off Karlštejn means you have left, drifting 2km across Prague
 * means you are still in Prague. A feel value — expect to tune it with the thing
 * in hand, on trackpad and touch, exactly as PLAN-V2's risks section says.
 */
const RELEASE_MARGIN_RATIO = 0.75;

/**
 * Three states, not two. The middle one is the whole point of Decision #9: a
 * hard in/out boundary snaps, and true elastic rubber-banding means fighting
 * MapLibre's drag transform mid-gesture, which breaks under touch inertia where
 * a single flick carries the camera far past any boundary. Hysteresis gives the
 * same felt friction without contesting the gesture.
 */
export type LocalityProximity = 'inside' | 'leaving' | 'outside';

function releaseBounds(locality: Locality): [[number, number], [number, number]] {
  const [[west, south], [east, north]] = locality.bounds;
  const lngMargin = ((east - west) / 2) * RELEASE_MARGIN_RATIO;
  const latMargin = ((north - south) / 2) * RELEASE_MARGIN_RATIO;

  return [
    [west - lngMargin, south - latMargin],
    [east + lngMargin, north + latMargin],
  ];
}

function isWithin(
  point: Coordinates,
  [[west, south], [east, north]]: [[number, number], [number, number]],
): boolean {
  return (
    point.lng >= west && point.lng <= east && point.lat >= south && point.lat <= north
  );
}

export function getLocalityProximity(
  center: Coordinates,
  zoom: number,
  locality: Locality,
): LocalityProximity {
  // Zooming out past city detail releases outright rather than passing through
  // "leaving". At that zoom the locality pins are back on screen and you are
  // choosing a place again, not standing in one.
  if (zoom < CITY_DETAIL_MIN_ZOOM) {
    return 'outside';
  }

  if (isWithin(center, locality.bounds)) {
    return 'inside';
  }

  return isWithin(center, releaseBounds(locality)) ? 'leaving' : 'outside';
}
