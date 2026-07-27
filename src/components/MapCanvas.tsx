import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map } from 'maplibre-gl';

import {
  MAP_STYLE,
  PRAGUE_CENTER,
  PRAGUE_MAX_BOUNDS,
  TILE_SOURCE,
} from '../lib/mapStyle';

type MapCanvasProps = {
  onMapReady: (map: Map | null) => void;
  onMapUnavailable: () => void;
};

export default function MapCanvas({
  onMapReady,
  onMapUnavailable,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
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
    onMapReady(map);

    return () => {
      map?.off('idle', inspectCoverage);
      onMapReady(null);
      map?.remove();
    };
  }, [onMapReady, onMapUnavailable]);

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
