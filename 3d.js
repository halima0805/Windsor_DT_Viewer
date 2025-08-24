// 3D terrain baseline for Windsor (confirmed working)

const CENTER = [-72.3851, 43.4806];

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
  layers: [
    { id: 'osm', type: 'raster', source: 'osm', layout: { visibility: 'visible' } }
  ]
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

map.on('load', () => {
  // DEM (MapLibre terrain-RGB)
  map.addSource('terrain-dem', {
    type: 'raster-dem',
    tiles: ['https://demotiles.maplibre.org/terrain-tiles/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 14,
    encoding: 'mapbox'
  });

  map.setTerrain({ source: 'terrain-dem', exaggeration: 4.0 });

  // Hillshade
  map.addLayer({
    id: 'hillshade',
    type: 'hillshade',
    source: 'terrain-dem',
    layout: { visibility: 'visible' },
    paint: { 'hillshade-exaggeration': 0.8 }
  });

  // Satellite (Esri World Imagery), hidden by default
  map.addSource('esri-sat', {
    type: 'raster',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    ],
    tileSize: 256,
    maxzoom: 19,
    attribution: 'Imagery: Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN, GIS User Community'
  });
  map.addLayer({
    id: 'satellite',
    type: 'raster',
    source: 'esri-sat',
    layout: { visibility: 'none' }
  });

  // UI toggles
  const toggleSat   = document.getElementById('toggleSat');
  const toggleShade = document.getElementById('toggleShade');

  function applyBase() {
    const satOn = toggleSat && toggleSat.checked;
    map.setLayoutProperty('satellite', 'visibility', satOn ? 'visible' : 'none');
    map.setLayoutProperty('osm',       'visibility', satOn ? 'none'    : 'visible');
  }
  if (toggleSat) {
    applyBase();
    toggleSat.addEventListener('change', applyBase);
  }
  if (toggleShade) {
    const setShade = () => {
      map.setLayoutProperty('hillshade', 'visibility', toggleShade.checked ? 'visible' : 'none');
    };
    setShade();
    toggleShade.addEventListener('change', setShade);
  }
});
