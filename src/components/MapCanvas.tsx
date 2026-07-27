import { useEffect, useRef, useState } from 'react';
import maplibregl, { GeoJSONSource, type Map } from 'maplibre-gl';

import {
  MAP_STYLE,
  PRAGUE_CENTER,
  PRAGUE_MAX_BOUNDS,
  TILE_SOURCE,
} from '../lib/mapStyle';
import {
  ERA_ZONE_FILL_LAYER,
  ERA_ZONE_OUTLINE_LAYER,
  ERA_ZONE_SOURCE,
  type EraZoneFeature,
} from '../lib/eraZones';

type MapCanvasProps = {
  onMapReady: (map: Map | null) => void;
  onMapUnavailable: () => void;
  activeEraZone: EraZoneFeature | null;
};

export default function MapCanvas({
  onMapReady,
  onMapUnavailable,
  activeEraZone,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const [flatMode, setFlatMode] = useState(false);

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
        maxBounds: PRAGUE_MAX_BOUNDS,
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

    map.on('load', setUpEraZoneLayer);

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

    const applyZoneData = (): void => {
      const source = map.getSource(ERA_ZONE_SOURCE);
      if (!(source instanceof GeoJSONSource)) {
        return;
      }

      source.setData({
        type: 'FeatureCollection',
        features: activeEraZone ? [activeEraZone] : [],
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
  }, [activeEraZone]);

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
