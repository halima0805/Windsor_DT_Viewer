// Minimal 3D terrain sanity check for Windsor

const WINDSOR_CENTER = [-72.3851, 43.4806];

// Style with OSM raster only
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
  zoom: 13.5,
  pitch: 60,
  bearing: -17
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

// Log any errors so we can see them
map.on('error', e => console.error('Map error:', e.error || e));

// Add terrain + hillshade + optional satellite
map.on('load', () => {
  console.log('Map style loaded');

  // DEM: MapLibre demo tiles (terrain-RGB). Must use encoding: "mapbox".
  map.addSource('terrain-dem', {
    type: 'raster-dem',
    tiles: ['https://demotiles.maplibre.org/terrain-tiles/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 14,
    encoding: 'mapbox'
  });

  // When DEM tiles arrive, this fires repeatedly; we’ll announce once.
  let announced = false;
  map.on('sourcedata', (e) => {
    if (e.sourceId === 'terrain-dem' && map.isSourceLoaded('terrain-dem') && !announced) {
      console.log('DEM source is loaded');
      announced = true;
    }
  });

  // Apply terrain with a big exaggeration so the relief is unmistakable
  map.setTerrain({ source: 'terrain-dem', exaggeration: 4.0 });
  console.log('setTerrain called');

  // Hillshade derived from DEM
  map.addLayer({
    id: 'hillshade',
    type: 'hillshade',
    source: 'terrain-dem',
    layout: { visibility: 'visible' },
    paint: { 'hillshade-exaggeration': 0.8 }
  });

  // Esri World Imagery raster (optional)
  map.addSource('esri-sat', {
    type: 'raster',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    ],
    tileSize: 256,
    maxzoom: 19,
    attribution: 'Imagery: Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN, GIS User Community'
  });
  map.addLayer({ id: 'satellite', type: 'raster', source: 'esri-sat', layout: { visibility: 'none' } });

  // Simple sky for depth cue
  map.setSky({
    'sun': [0, 90],
    'sun-intensity': 8,
    'sky-type': 'atmosphere'
  });

  // UI wiring
  const baseStreets = document.getElementById('baseStreets');
  const baseSat     = document.getElementById('baseSat');
  const toggleShade = document.getElementById('toggleShade');

  function applyBase() {
    const streets = baseStreets && baseStreets.checked;
    map.setLayoutProperty('osm',       'visibility', streets ? 'visible' : 'none');
    map.setLayoutProperty('satellite', 'visibility', streets ? 'none'    : 'visible');
  }
  if (baseStreets && baseSat) {
    baseStreets.addEventListener('change', applyBase);
    baseSat.addEventListener('change', applyBase);
    applyBase();
  }
  if (toggleShade) {
    toggleShade.addEventListener('change', () => {
      map.setLayoutProperty('hillshade', 'visibility', toggleShade.checked ? 'visible' : 'none');
    });
  }

  console.log('3D setup complete');
});
