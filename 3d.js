// 3d.js — Windsor 3D with terrain (no keys)

// Paths
const BASE = '/Windsor_DT_Viewer';
const BLD_URL = `${BASE}/data/buildings/windsor_buildings_3d.geojson`;
const CENTER = [-72.3851, 43.4806];

// Basemap (OSM raster)
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
  center: CENTER,
  zoom: 13.5,
  pitch: 60,
  bearing: -17
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

map.on('load', async () => {
  // Terrain sources (both available without keys)
  map.addSource('terrain-rgb', {
    type: 'raster-dem',
    tiles: ['https://demotiles.maplibre.org/terrain-tiles/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 14,
    encoding: 'mapbox'
  });
  map.addSource('terrain-terrarium', {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 15,
    encoding: 'terrarium',
    attribution: 'Elevation: AWS Terrain Tiles'
  });

  // Pick one (try demo first; you can switch to 'terrain-terrarium' to compare)
  map.setTerrain({ source: 'terrain-rgb', exaggeration: 2.6 });

  // Hillshade on top of the DEM
  map.addLayer({
    id: 'hillshade',
    type: 'hillshade',
    source: 'terrain-rgb',
    paint: { 'hillshade-exaggeration': 0.7 },
    layout: { visibility: 'visible' }
  });

  // Optional satellite (off by default)
  map.addSource('esri-sat', {
    type: 'raster',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    tileSize: 256,
    maxzoom: 19,
    attribution: 'Imagery: Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN, GIS User Community'
  });
  map.addLayer({ id: 'satellite', type: 'raster', source: 'esri-sat', layout: { visibility: 'none' } });

  map.setFog({ 'horizon-blend': 0.2, range: [0.5, 10], 'star-intensity': 0 });

  // Buildings (if your GeoJSON exists)
  try {
    const gj = await fetch(BLD_URL, { cache: 'no-cache' }).then(r => r.json());
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
  } catch (_) {}

  // Simple UI hooks if present in 3d.html
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

  // Quick exaggeration slider injected if none exists (helps confirm relief)
  if (!document.getElementById('exag')) {
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;z-index:3;top:10px;left:260px;background:#fff;border:1px solid #ddd;border-radius:8px;padding:6px 10px;font:14px system-ui;';
    box.innerHTML = 'Exaggeration <input id="exag" type="range" min="1" max="5" step="0.1" value="2.6">';
    document.body.appendChild(box);
    document.getElementById('exag').addEventListener('input', (e) => {
      const v = Number(e.target.value);
      map.setTerrain({ source: 'terrain-rgb', exaggeration: v });
    });
  }
});
