import type { StyleSpecification } from 'maplibre-gl';

export const TILE_SOURCE = 'openfreemap';
export const BUILDING_SOURCE_LAYER = 'building';

// Colors for the specific building a story event happened in/at, applied via
// MapLibre feature-state (see eventBuildings.ts) rather than baked into the
// paint expression as a filter — buildings are identified at runtime by
// querying the rendered tile at each event's coordinates, not by any static
// list, so the highlight has to be data-driven.
export const DEFAULT_BUILDING_COLOR = '#b6af9f';
export const EVENT_BUILDING_COLOR = '#c9a227';
export const SELECTED_EVENT_BUILDING_COLOR = '#d97706';

/** Opening camera position only. Extents now live per-locality in localities.json. */
export const PRAGUE_CENTER: [number, number] = [14.4205, 50.088];

/**
 * The zoom at which the map stops being a chooser of places and becomes a city.
 *
 * One number, three consumers, and they have to agree or the handover looks
 * broken: below it you get locality pins and no city; at or above it you get
 * extruded buildings and event markers and no pins. Event markers in particular
 * are city-scale detail — at country zoom they collapse into an unreadable line
 * of overlapping pins that says nothing about where anything is.
 */
export const CITY_DETAIL_MIN_ZOOM = 13;

export const MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    [TILE_SOURCE]: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      attribution:
        '<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> contributors',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#ebe7de',
      },
    },
    {
      id: 'water',
      type: 'fill',
      source: TILE_SOURCE,
      'source-layer': 'water',
      paint: {
        'fill-color': '#c7d5dd',
      },
    },
    {
      id: 'parks',
      type: 'fill',
      source: TILE_SOURCE,
      'source-layer': 'landcover',
      filter: [
        'match',
        ['get', 'class'],
        ['wood', 'grass', 'park', 'cemetery'],
        true,
        false,
      ],
      paint: {
        'fill-color': '#dfe2d2',
        'fill-opacity': 0.7,
      },
    },
    {
      id: 'roads',
      type: 'line',
      source: TILE_SOURCE,
      'source-layer': 'transportation',
      paint: {
        'line-color': '#c3beb4',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          11,
          0.5,
          16,
          2.8,
        ],
        'line-opacity': 0.7,
      },
    },
    {
      id: 'bridges',
      type: 'line',
      source: TILE_SOURCE,
      'source-layer': 'transportation',
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: {
        'line-color': '#a9a39a',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          11,
          0.8,
          16,
          3.4,
        ],
      },
    },
    {
      id: 'building-footprints',
      type: 'fill',
      source: TILE_SOURCE,
      'source-layer': 'building',
      paint: {
        'fill-color': '#d8d2c6',
        'fill-opacity': 0.45,
      },
    },
    {
      id: 'building-extrusions',
      type: 'fill-extrusion',
      source: TILE_SOURCE,
      'source-layer': BUILDING_SOURCE_LAYER,
      minzoom: CITY_DETAIL_MIN_ZOOM,
      paint: {
        'fill-extrusion-color': [
          'case',
          ['boolean', ['feature-state', 'isSelectedEventBuilding'], false],
          SELECTED_EVENT_BUILDING_COLOR,
          ['boolean', ['feature-state', 'isEventBuilding'], false],
          EVENT_BUILDING_COLOR,
          DEFAULT_BUILDING_COLOR,
        ],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 12],
        'fill-extrusion-opacity': 0.94,
      },
    },
    {
      id: 'district-labels',
      type: 'symbol',
      source: TILE_SOURCE,
      'source-layer': 'place',
      filter: [
        'match',
        ['get', 'class'],
        ['borough', 'suburb', 'quarter', 'neighbourhood'],
        true,
        false,
      ],
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          11,
          11,
          16,
          14,
        ],
      },
      paint: {
        'text-color': '#756f66',
        'text-halo-color': '#ebe7de',
        'text-halo-width': 0.8,
      },
    },
    {
      id: 'street-labels',
      type: 'symbol',
      source: TILE_SOURCE,
      'source-layer': 'transportation_name',
      minzoom: 13,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          13,
          10,
          16,
          12,
        ],
      },
      paint: {
        'text-color': '#857f75',
        'text-halo-color': '#ebe7de',
        'text-halo-width': 0.7,
      },
    },
  ],
};
