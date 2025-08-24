// Windsor 3D terrain (MapLibre) — working baseline + extra layers

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
  // ---- terrain & basemap (unchanged baseline) ----
  map.addSource('terrain-dem', {
    type: 'raster-dem',
    tiles: ['https://demotiles.maplibre.org/terrain-tiles/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 14,
    encoding: 'mapbox'
  });

  map.setTerrain({ source: 'terrain-dem', exaggeration: 3.0 });

  map.addLayer({
    id: 'hillshade',
    type: 'hillshade',
    source: 'terrain-dem',
    paint: { 'hillshade-exaggeration': 0.7 },
    layout: { visibility: 'visible' }
  });

  map.addSource('esri-sat', {
    type: 'raster',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
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

  map.setSky({ 'sun': [0, 90], 'sun-intensity': 8, 'sky-type': 'atmosphere' });

  // ---- UI toggles (unchanged) ----
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

  // =================================================================
  // EXTRA LAYERS (added without modifying the working baseline above)
  // =================================================================

  // 1) Parcels (VCGI live, filtered to Windsor) — simple line outline
  (async () => {
    const PARCELS_URL =
      'https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/FS_VCGI_OPENDATA_Cadastral_VTPARCELS_poly_standardized_parcels_SP_v1/FeatureServer/0';

    const where = "UPPER(TNAME) = 'WINDSOR'";
    const outFields = ['OBJECTID','TNAME','PARCID','OWNER1','E911ADDR','ACRESGL'].join(',');
    const q = `${PARCELS_URL}/query?where=${encodeURIComponent(where)}&outFields=${encodeURIComponent(outFields)}&outSR=4326&f=geojson`;
    try {
      const gj = await fetch(q, { cache: 'no-cache' }).then(r => r.json());
      map.addSource('parcels-gj', { type: 'geojson', data: gj });
      map.addLayer({
        id: 'parcels-line',
        type: 'line',
        source: 'parcels-gj',
        paint: { 'lineColor': '#333', 'line-width': 1.2 }
      });
    } catch (e) {
      console.warn('Parcels load failed:', e);
    }
  })();

  // 2) Zoning Overlay (local GeoJSON from your repo)
  (async () => {
    const OVERLAY_URL = '/Windsor_DT_Viewer/data/zoning_layers/windsor_zoning_overlay.geojson';
    try {
      const gj = await fetch(OVERLAY_URL, { cache: 'no-cache' }).then(r => r.json());
      map.addSource('zoning-overlay', { type: 'geojson', data: gj });
      map.addLayer({
        id: 'zoning-overlay-fill',
        type: 'fill',
        source: 'zoning-overlay',
        paint: { 'fill-color': '#9c27b0', 'fill-opacity': 0.15 }
      });
      map.addLayer({
        id: 'zoning-overlay-line',
        type: 'line',
        source: 'zoning-overlay',
        paint: { 'line-color': '#9c27b0', 'line-width': 2, 'line-dasharray': [4, 2] }
      });
    } catch (e) {
      console.warn('Zoning overlay load failed:', e);
    }
  })();

  // 3) FEMA Flood (ANR live, clipped to current map view on load)
  (async () => {
    const FEMA_URL =
      'https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_EMERGENCY_SP_NOCACHE_v2/MapServer/57';

    try {
      const b = map.getBounds(); // current view
      const envelope = {
        xmin: b.getWest(),
        ymin: b.getSouth(),
        xmax: b.getEast(),
        ymax: b.getNorth(),
        spatialReference: { wkid: 4326 }
      };
      const outFields = ['FLD_ZONE','SFHA_TF'].join(',');
      const params =
        `where=1%3D1&outFields=${encodeURIComponent(outFields)}&geometry=${encodeURIComponent(JSON.stringify(envelope))}` +
        `&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outSR=4326&f=geojson`;
      const url = `${FEMA_URL}/query?${params}`;

      const gj = await fetch(url, { cache: 'no-cache' }).then(r => r.json());
      map.addSource('fema-flood', { type: 'geojson', data: gj });

      // fill with simple two-tone based on FLD_ZONE
      map.addLayer({
        id: 'fema-flood-fill',
        type: 'fill',
        source: 'fema-flood',
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'FLD_ZONE'], 'AE'], '#d32f2f', // AE -> red-ish
            '#1976d2'                                 // others -> blue-ish
          ],
          'fill-opacity': 0.20
        }
      });
      map.addLayer({
        id: 'fema-flood-line',
        type: 'line',
        source: 'fema-flood',
        paint: { 'line-color': '#1976d2', 'line-width': 1 }
      });
    } catch (e) {
      console.warn('FEMA flood load failed:', e);
    }
  })();

});
