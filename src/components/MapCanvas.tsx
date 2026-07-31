import { useEffect, useRef, useState } from 'react';
import maplibregl, { GeoJSONSource, type Map } from 'maplibre-gl';

import type { Locality } from '../data/schema';
import { MAP_STYLE, PRAGUE_CENTER, TILE_SOURCE } from '../lib/mapStyle';
import {
  ERA_ZONE_FILL_LAYER,
  ERA_ZONE_OUTLINE_LAYER,
  ERA_ZONE_SOURCE,
  type EraZoneFeature,
} from '../lib/eraZones';
import {
  LOCALITY_CIRCLE_LAYER,
  LOCALITY_LABEL_LAYER,
  LOCALITY_PIN_MAX_ZOOM,
  LOCALITY_SOURCE,
  toLocalityFeatureCollection,
} from '../lib/localityPins';

type MapCanvasProps = {
  onMapReady: (map: Map | null) => void;
  onMapUnavailable: () => void;
  activeChapterZone: EraZoneFeature | null;
  localities: Locality[];
  onSelectLocality: (localityId: string) => void;
};

export default function MapCanvas({
  onMapReady,
  onMapUnavailable,
  activeChapterZone,
  localities,
  onSelectLocality,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const [flatMode, setFlatMode] = useState(false);

  /**
   * Held in a ref, and deliberately NOT a dependency of the map-creation effect.
   *
   * The parent's handler closes over the map instance it is given, so it gets a
   * new identity the moment `onMapReady` sets it. Listing it as a dependency made
   * that re-run the creation effect, whose cleanup calls `map.remove()` — the map
   * destroyed and rebuilt itself on a loop and never rendered anything. Reading
   * the latest handler through a ref keeps the click wired up without tying the
   * map's lifetime to a callback's identity.
   */
  const onSelectLocalityRef = useRef(onSelectLocality);
  useEffect(() => {
    onSelectLocalityRef.current = onSelectLocality;
  }, [onSelectLocality]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const maplibreWithSupport = maplibregl as typeof maplibregl & {
      supported?: () => boolean;
    };

    if (
      typeof maplibreWithSupport.supported === 'function' &&
      !maplibreWithSupport.supported()
    ) {
      onMapUnavailable();
      return;
    }

    let map: Map | null = null;
    let coverageChecked = false;

    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: PRAGUE_CENTER,
        zoom: 14.5,
        pitch: 55,
        bearing: -20,
        // No maxBounds (Decision #13). It was the same Prague-shaped assumption as
        // the validator's global bounding box, expressed in the camera instead of
        // the data — and it walled the camera off from Karlštejn and Karlovy Vary,
        // both of which the Charles IV storyline needs to reach. Per-locality
        // bounds replace it, and they inform rather than imprison.
        cooperativeGestures: false,
      });
    } catch {
      onMapUnavailable();
      return;
    }

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    const setUpEraZoneLayer = (): void => {
      if (map?.getSource(ERA_ZONE_SOURCE)) {
        return;
      }

      map?.addSource(ERA_ZONE_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Inserted before the building extrusions so the zone reads as a tint on
      // the ground plane, with buildings still clearly rising above it.
      map?.addLayer(
        {
          id: ERA_ZONE_FILL_LAYER,
          type: 'fill',
          source: ERA_ZONE_SOURCE,
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': 0.22,
          },
        },
        'building-extrusions',
      );
      map?.addLayer(
        {
          id: ERA_ZONE_OUTLINE_LAYER,
          type: 'line',
          source: ERA_ZONE_SOURCE,
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 1.6,
            'line-opacity': 0.75,
          },
        },
        'building-extrusions',
      );
    };

    const setUpLocalityLayer = (): void => {
      if (map?.getSource(LOCALITY_SOURCE)) {
        return;
      }

      map?.addSource(LOCALITY_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Added last, so pins sit above every other layer: they are navigation
      // furniture, not part of the depicted world.
      map?.addLayer({
        id: LOCALITY_CIRCLE_LAYER,
        type: 'circle',
        source: LOCALITY_SOURCE,
        maxzoom: LOCALITY_PIN_MAX_ZOOM,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 4, 12, 9],
          'circle-color': '#8c5a2b',
          'circle-stroke-color': '#f8f5ef',
          'circle-stroke-width': 2,
          'circle-opacity': 0.95,
        },
      });
      map?.addLayer({
        id: LOCALITY_LABEL_LAYER,
        type: 'symbol',
        source: LOCALITY_SOURCE,
        maxzoom: LOCALITY_PIN_MAX_ZOOM,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 11, 12, 14],
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': '#5b4327',
          'text-halo-color': '#f8f5ef',
          'text-halo-width': 1.4,
        },
      });

      // Registered here rather than at map creation: a delegated listener
      // queries its target layer on every matching event, and that layer does
      // not exist until the style has loaded.
      map?.on('click', LOCALITY_CIRCLE_LAYER, handleLocalityClick);
      map?.on('mouseenter', LOCALITY_CIRCLE_LAYER, showPointer);
      map?.on('mouseleave', LOCALITY_CIRCLE_LAYER, hidePointer);
    };

    const handleLocalityClick = (
      event: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
    ): void => {
      const localityId = event.features?.[0]?.properties?.id;
      if (typeof localityId === 'string') {
        onSelectLocalityRef.current(localityId);
      }
    };

    const showPointer = (): void => {
      if (map) {
        map.getCanvas().style.cursor = 'pointer';
      }
    };
    const hidePointer = (): void => {
      if (map) {
        map.getCanvas().style.cursor = '';
      }
    };

    map.on('load', setUpEraZoneLayer);
    map.on('load', setUpLocalityLayer);

    const inspectCoverage = (): void => {
      if (coverageChecked) {
        return;
      }

      coverageChecked = true;

      try {
        const features = map?.querySourceFeatures(TILE_SOURCE, {
          sourceLayer: 'building',
        }) ?? [];

        const sample = features.slice(0, 400);
        if (sample.length === 0) {
          return;
        }

        const withHeight = sample.filter((feature) => {
          const renderHeight = feature.properties?.render_height;
          return typeof renderHeight === 'number' && renderHeight > 0;
        }).length;

        if (withHeight / sample.length < 0.6) {
          map?.setLayoutProperty('building-extrusions', 'visibility', 'none');
          map?.setPaintProperty('building-footprints', 'fill-opacity', 0.8);
          setFlatMode(true);
        }
      } catch {
        // If coverage inspection fails, keep the intended default path.
      }
    };

    map.on('idle', inspectCoverage);
    mapRef.current = map;
    onMapReady(map);

    return () => {
      map?.off('load', setUpEraZoneLayer);
      map?.off('load', setUpLocalityLayer);
      map?.off('click', LOCALITY_CIRCLE_LAYER, handleLocalityClick);
      map?.off('mouseenter', LOCALITY_CIRCLE_LAYER, showPointer);
      map?.off('mouseleave', LOCALITY_CIRCLE_LAYER, hidePointer);
      map?.off('idle', inspectCoverage);
      mapRef.current = null;
      onMapReady(null);
      map?.remove();
    };
  }, [onMapReady, onMapUnavailable]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const applyLocalityData = (): void => {
      const source = map.getSource(LOCALITY_SOURCE);
      if (!(source instanceof GeoJSONSource)) {
        return;
      }

      source.setData(toLocalityFeatureCollection(localities));
    };

    // Same gating as the era zone below: on source presence, not isStyleLoaded(),
    // because MapLibre's 'load' fires exactly once for the map's lifetime and a
    // once('load') registered afterwards never runs.
    if (map.getSource(LOCALITY_SOURCE)) {
      applyLocalityData();
    } else {
      map.once('load', applyLocalityData);
      return () => {
        map.off('load', applyLocalityData);
      };
    }
  }, [localities]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const applyZoneData = (): void => {
      const source = map.getSource(ERA_ZONE_SOURCE);
      if (!(source instanceof GeoJSONSource)) {
        return;
      }

      source.setData({
        type: 'FeatureCollection',
        features: activeChapterZone ? [activeChapterZone] : [],
      });
    };

    // Gate on the source's own presence, not isStyleLoaded(): that flag goes
    // false during ordinary tile loading too (era clicks trigger a camera fly,
    // which counts), and MapLibre's 'load' event fires exactly once for the
    // map's whole lifetime — a once('load', ...) registered after that first
    // load has already happened never fires again, silently dropping the
    // update. The source, once added in setUpEraZoneLayer, is safe to
    // setData() regardless of in-flight tile loads.
    if (map.getSource(ERA_ZONE_SOURCE)) {
      applyZoneData();
    } else {
      map.once('load', applyZoneData);
      return () => {
        map.off('load', applyZoneData);
      };
    }
  }, [activeChapterZone]);

  return (
    <div className="relative h-full overflow-hidden rounded-[2rem] border border-white/60 shadow-panel">
      <div ref={containerRef} className="h-full w-full" />
      {flatMode ? (
        <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-[#f8f5ef]/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700 shadow">
          Flat map mode
        </div>
      ) : null}
    </div>
  );
}
