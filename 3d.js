const BASE    = '/Windsor_DT_Viewer';
const BLD_URL = `${BASE}/data/buildings/windsor_buildings_3d.geojson`;
const CENTER  = [-72.3851, 43.4806];

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
  layers: [{ id: 'osm', type: 'raster', source: 'osm', layout: { visibility: 'visible' } }]
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
  map.addSource('terrain-dem', {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 15,
    encoding: 'terrarium',
    attribution: 'Elevation: AWS Terrain Tiles'
  });
  map.setTerrain({ source: 'terrain-dem', exaggeration: 2.0 });

  map.addLayer({
    id: 'hillshade',
    type: 'hillshade',
    source: 'terrain-dem',
    paint: {
      'hillshade-exaggeration': 0.6,
      'hillshade-shadow-color':   'rgba(0,0,0,0.25)',
      'hillshade-highlight-color':'rgba(255,255,255,0.15)',
      'hillshade-accent-color':   'rgba(0,0,0,0.10)'
    },
    layout: { visibility: 'visible' }
  });

  map.addSource('esri-sat', {
    type: 'raster',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    tileSize: 256,
    maxzoom: 19,
    attribution: 'Imagery: Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN, GIS User Community'
  });
  map.addLayer({ id: 'satellite', type: 'raster', source: 'esri-sat', layout: { visibility: 'none' } });

  map.setSky({ 'sun': [0, 90], 'sun-intensity': 8, 'sky-type': 'atmosphere' });

  const toggleSat   = document.getElementById('toggleSat');
  const toggleShade = document.getElementById('toggleShade');

  function applyBase() {
    const satOn = !!(toggleSat && toggleSat.checked);
    map.setLayoutProperty('satellite', 'visibility', satOn ? 'visible' : 'none');
    map.setLayoutProperty('osm',       'visibility', satOn ? 'none'    : 'visible');
  }
  if (toggleSat) {
    applyBase();
    toggleSat.addEventListener('change', applyBase);
  }
  if (toggleShade) {
    toggleShade.addEventListener('change', () => {
      map.setLayoutProperty('hillshade', 'visibility', toggleShade.checked ? 'visible' : 'none');
    });
  }

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
});
