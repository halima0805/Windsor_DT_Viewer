// 3d.js — Windsor 3D map with terrain and building extrusions

const BASE = '/Windsor_DT_Viewer';
const BLD_URL = `${BASE}/data/buildings/windsor_buildings_3d.geojson`;
const WINDSOR_CENTER = [-72.3851, 43.4806];

// OSM raster basemap
const style = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
};

const map = new maplibregl.Map({
  container: 'map',
  style,
  center: WINDSOR_CENTER,
  zoom: 14,
  pitch: 60,
  bearing: -17
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

map.on('load', async () => {
  // Terrain (MapLibre demo terrain-rgb)
  map.addSource('terrain-dem', {
    type: 'raster-dem',
    tiles: ['https://demotiles.maplibre.org/terrain-tiles/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 14,
    encoding: 'mapbox'
  });
  map.setTerrain({ source: 'terrain-dem', exaggeration: 1.8 });

  map.addLayer({
    id: 'hillshade',
    type: 'hillshade',
    source: 'terrain-dem',
    layout: { visibility: 'visible' },
    paint: { 'hillshade-exaggeration': 0.7 }
  });

  // Optional satellite (hidden by default)
  map.addSource('esri-sat', {
    type: 'raster',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    tileSize: 256,
    maxzoom: 19,
    attribution: 'Imagery: Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN, GIS User Community'
  });
  map.addLayer({ id: 'satellite', type: 'raster', source: 'esri-sat', layout: { visibility: 'none' } });

  map.setFog({ 'horizon-blend': 0.2, range: [0.5, 10], 'star-intensity': 0 });

  // Buildings extruded from your GeoJSON
  try {
    const gj = await fetch(BLD_URL, { cache: 'no-cache' }).then(r => r.json());

    // Ensure height per feature
    (gj.features || []).forEach(f => {
      const p = f.properties || (f.properties = {});
      if (p.height_m == null) {
        const lv = Number(p['building:levels'] ?? p.levels ?? 2);
        p.height_m = lv * 3.0;
      }
    });

    map.addSource('windsor-buildings', { type: 'geojson', data: gj });

    map.addLayer({
      id: 'windsor-buildings-3d',
      type: 'fill-extrusion',
      source: 'windsor-buildings',
      paint: {
        'fill-extrusion-color': '#8fb4d9',
        'fill-extrusion-opacity': 0.9,
        'fill-extrusion-height': [
          'coalesce',
          ['to-number', ['get', 'height_m']],
          ['*', 3, ['coalesce',
            ['to-number', ['get', 'levels']],
            ['to-number', ['get', 'building:levels']],
            2
          ]]
        ],
        'fill-extrusion-base': 0
      }
    });

    const bbox = geojsonBbox(gj);
    if (bbox) map.fitBounds(bbox, { padding: 30, pitch: 60, bearing: -17 });

    map.on('click', 'windsor-buildings-3d', (e) => {
      const f = e.features && e.features[0];
      if (!f) return;
      const p = f.properties || {};
      let h = Number(p.height_m);
      if (!isFinite(h)) {
        const lv = Number(p['building:levels'] ?? p.levels ?? 2);
        h = lv * 3.0;
      }
      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`<div style="font:13px system-ui">
          <div style="font-weight:600;margin-bottom:4px">${p.name || 'Building'}</div>
          <div>Estimated height: ${h.toFixed(1)} m</div>
        </div>`)
        .addTo(map);
    });
    map.on('mouseenter', 'windsor-buildings-3d', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', 'windsor-buildings-3d', () => map.getCanvas().style.cursor = '');
  } catch (e) {
    console.warn('Buildings load failed:', e);
  }

  // Optional UI toggles (only if elements exist in 3d.html)
  const toggleSat = document.getElementById('toggleSat');
  if (toggleSat) {
    toggleSat.addEventListener('change', () => {
      map.setLayoutProperty('satellite', 'visibility', toggleSat.checked ? 'visible' : 'none');
    });
  }
  const toggleShade = document.getElementById('toggleShade');
  if (toggleShade) {
    toggleShade.addEventListener('change', () => {
      map.setLayoutProperty('hillshade', 'visibility', toggleShade.checked ? 'visible' : 'none');
    });
  }
});

// Bbox for FeatureCollection polygons
function geojsonBbox(fc) {
  if (!fc || !fc.features || !fc.features.length) return null;
  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    const coords =
      g.type === 'Polygon' ? g.coordinates.flat(1) :
      g.type === 'MultiPolygon' ? g.coordinates.flat(2) : [];
    for (const [x, y] of coords) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return (minX === 180) ? null : [[minX, minY], [maxX, maxY]];
}

