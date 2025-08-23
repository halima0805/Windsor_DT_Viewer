// ------------ Windsor 3D base (public, no keys) ------------
const BASE = '/Windsor_DT_Viewer';
const BLD_URL = `${BASE}/data/buildings/windsor_buildings_3d.geojson`;

// Windsor center in [lng, lat] (MapLibre uses lng,lat)
const WINDSOR_CENTER = [-72.3851, 43.4806]; // Town of Windsor, VT

// Minimal style: OSM raster as background (no API key)
const osmSource = {
  type: 'raster',
  tiles: [
    'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
    'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
    'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
  ],
  tileSize: 256,
  attribution: '© OpenStreetMap contributors'
};

const style = {
  version: 8,
  sources: { osm: osmSource },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
};

const map = new maplibregl.Map({
  container: 'map',
  style,
  center: WINDSOR_CENTER,
  zoom: 14,
  pitch: 60,     // tilt for 3D look
  bearing: -17   // small rotation for perspective
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

// Add buildings as 3D extrusions (from your repo GeoJSON)
map.on('load', async () => {
  try {
    // Load once to compute bounds
    const gj = await fetch(BLD_URL, { cache: 'no-cache' }).then(r => r.json());

    // Add as a source for the layer
    map.addSource('windsor-buildings', { type: 'geojson', data: gj });

    // Height expression: prefer explicit "height_m"; else 3m * levels; else default 6m
    const heightExpr = [
      'coalesce',
      ['to-number', ['get', 'height_m']],
      ['*', 3,
        ['coalesce',
          ['to-number', ['get', 'levels']],
          ['to-number', ['get', 'building:levels']],
          2
        ]
      ],
      6
    ];

    map.addLayer({
      id: 'windsor-buildings-3d',
      type: 'fill-extrusion',
      source: 'windsor-buildings',
      paint: {
        'fill-extrusion-color': '#8fb4d9',
        'fill-extrusion-height': heightExpr,
        'fill-extrusion-opacity': 0.9,
        'fill-extrusion-base': 0
      }
    });

    // Fit to buildings extent; fallback to center if empty
    const bbox = geojsonBbox(gj);
    if (bbox) {
      map.fitBounds(bbox, { padding: 30, pitch: 60, bearing: -17 });
    }
  } catch (e) {
    console.warn('Buildings load failed:', e);
  }
});

// Compute a bbox [swLng, swLat, neLng, neLat] for a GeoJSON FeatureCollection
function geojsonBbox(fc) {
  if (!fc || !fc.features || !fc.features.length) return null;
  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    const coords = (g.type === 'Polygon' || g.type === 'MultiPolygon')
      ? (g.type === 'Polygon' ? g.coordinates.flat(1) : g.coordinates.flat(2))
      : [];
    for (const [x, y] of coords) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (minX === 180) return null;
  return [[minX, minY], [maxX, maxY]];
}
