import type { Locality } from '../data/schema';

export const LOCALITY_SOURCE = 'localities';
export const LOCALITY_CIRCLE_LAYER = 'locality-pins';
export const LOCALITY_LABEL_LAYER = 'locality-labels';

/**
 * Pins vanish at the zoom where the 2.5D city appears.
 *
 * `building-extrusions` is `minzoom: 13`, so capping the pins at the same value
 * means navigation furniture and the city model never share a frame — the same
 * reasoning Decision #6 applies to hillshade. Zoomed out you are choosing a
 * place; zoomed in you are inside one, and a pin hovering over the rooftops
 * would be neither.
 */
export const LOCALITY_PIN_MAX_ZOOM = 13;

export function toLocalityFeatureCollection(
  localities: Locality[],
): GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; name: string }> {
  return {
    type: 'FeatureCollection',
    features: localities.map((locality) => ({
      type: 'Feature',
      properties: { id: locality.id, name: locality.name },
      geometry: {
        type: 'Point',
        coordinates: [locality.defaultView.center[0], locality.defaultView.center[1]],
      },
    })),
  };
}
