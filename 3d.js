// Free basemap
const STYLE_URL = 'https://demotiles.maplibre.org/style.json';

// Buildings GeoJSON (absolute URL so there’s no path confusion)
const BUILDINGS_URL = 'https://halima0805.github.io/Windsor_DT_Viewer/data/buildings/windsor_buildings_3d.geojson';

// Camera
const CENTER  = [-72.3851, 43.4806];
const ZOOM    = 14.3;
const PITCH   = 65;
const BEARING = -20;

const map = new maplibregl.Map({
  container: 'map3d',
  style: STYLE_URL,
  center: CENTER,
  zoom: ZOOM,
  pitch: PITCH,
  bearing: BEARING,
  antialias: true
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

map.on('load', () => {
  // Terrain (no key)
  map.addSource('terrain', {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    tileSize: 256,
    encoding: 'terrarium',
    maxzoom: 15
  });
  map.setTerrain({ source: 'terrain', exaggeration: 1.2 });

  // Optional hillshade
  map.addLayer({
    id: 'hillshade',
    type: 'hillshade',
    source: 'terrain',
    paint: { 'hillshade-exaggeration': 0.3 }
  });

  // --- Buildings (extruded)
  fetch(BUILDINGS_URL, { cache: 'no-cache' })
    .then(r => {
      if (!r.ok) throw new Error('Buildings HTTP ' + r.status + ' @ ' + BUILDINGS_URL);
      return r.json();
    })
    .then(gj => {
      const feats = gj.features || [];
      // Fill in height if missing (floors*3m fallback)
      feats.forEach(f => {
        const p = f.properties || (f.properties = {});
        if (p.height_m == null) p.height_m = Number(p.floors || p.levels || p['building:levels'] || 2) * 3;
      });

      map.addSource('bldg', { type: 'geojson', data: gj });

      map.addLayer({
        id: 'bldg-outline',
        type: 'line',
        source: 'bldg',
        paint: { 'line-color': '#0c2038', 'line-width': 0.4 }
      });

      map.addLayer({
        id: 'bldg-extrude',
        type: 'fill-extrusion',
        source: 'bldg',
        paint: {
          'fill-extrusion-color': '#8fb4d9',
          'fill-extrusion-opacity': 0.9,
          'fill-extrusion-height': ['coalesce', ['to-number', ['get', 'height_m']], 6],
          'fill-extrusion-base': 0
        }
      });
    })
    .catch(err => {
      console.error('Buildings load failed:', err);
      alert('Could not load buildings. Open Console for details.');
    });
});
