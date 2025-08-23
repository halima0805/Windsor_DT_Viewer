// Windsor 3D terrain with Esri World Imagery (no API keys)
const BASE = '/Windsor_DT_Viewer';
const WINDSOR_CENTER = [-72.3851, 43.4806];

// Style: Esri satellite as the primary basemap
const style = {
  version: 8,
  sources: {
    'esri-sat': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagery: Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN, GIS User Community'
    }
  },
  layers: [
    { id: 'satellite', type: 'raster', source: 'esri-sat', layout: { visibility: 'visible' } }
  ]
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

map.on('load', () => {
  // Terrain (global, free) — makes the surface 3D
  map.addSource('terrain-dem', {
    type: 'raster-dem',
    tiles: ['https://demotiles.maplibre.org/terrain-tiles/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 14,
    encoding: 'mapbox'
  });
  map.setTerrain({ source: 'terrain-dem', exaggeration: 1.8 });

  // Hillshade on top of satellite for relief
  map.addLayer({
    id: 'hillshade',
    type: 'hillshade',
    source: 'terrain-dem',
    layout: { visibility: 'visible' },
    paint: { 'hillshade-exaggeration': 0.7 }
  });

  // Fog for depth cues
  map.setFog({ 'horizon-blend': 0.2, range: [0.5, 10], 'star-intensity': 0 });

  // UI toggles in 3d.html (optional)
  const shade = document.getElementById('toggleShade');
  if (shade) {
    shade.addEventListener('change', () => {
      map.setLayoutProperty('hillshade', 'visibility', shade.checked ? 'visible' : 'none');
    });
  }
});
