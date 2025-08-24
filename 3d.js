// Windsor 3D with terrain (no API keys) + Windsor layers

const BASE    = '/Windsor_DT_Viewer';
const CENTER  = [-72.3851, 43.4806];

// Local data paths (match your repo)
const ZONING_LOCAL  = `${BASE}/data/zoning_layers/axisgis_zoning_live.geojson`;
const OVERLAY_LOCAL = `${BASE}/data/zoning_layers/windsor_zoning_overlay.geojson`;

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
  // --- DEM (AWS Terrarium) + terrain ---
  map.addSource('terrain-dem', {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 15,
    encoding: 'terrarium',
    attribution: 'Elevation: AWS Terrain Tiles'
  });
  map.setTerrain({ source: 'terrain-dem', exaggeration: 1.8 });

  // Hillshade (visible by default)
  map.addLayer({
    id: 'hillshade',
    type: 'hillshade',
    source: 'terrain-dem',
    paint: { 'hillshade-exaggeration': 0.7 },
    layout: { visibility: 'visible' }
  });

  // Satellite (hidden until toggled)
  map.addSource('esri-sat', {
    type: 'raster',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    tileSize: 256,
    maxzoom: 19,
    attribution: 'Imagery: Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN, GIS User Community'
  });
  map.addLayer({ id: 'satellite', type: 'raster', source: 'esri-sat', layout: { visibility: 'none' } });

  map.setSky({ 'sun': [0, 90], 'sun-intensity': 8, 'sky-type': 'atmosphere' });

  // ---------- UI for base layers ----------
  const toggleSat   = document.getElementById('toggleSat');
  const toggleShade = document.getElementById('toggleShade');

  function applyBase() {
    const satOn = !!(toggleSat && toggleSat.checked);
    map.setLayoutProperty('satellite', 'visibility', satOn ? 'visible' : 'none');
    map.setLayoutProperty('osm',       'visibility', satOn ? 'none'    : 'visible');
  }
  if (toggleSat) { applyBase(); toggleSat.addEventListener('change', applyBase); }
  if (toggleShade) {
    const setShade = () => map.setLayoutProperty('hillshade', 'visibility', toggleShade.checked ? 'visible' : 'none');
    setShade();
    toggleShade.addEventListener('change', setShade);
  }

  // =================================================================
  // WINDSOR LAYERS (drawn ABOVE satellite/OSM; toggled by checkboxes)
  // =================================================================

  // 1) Parcels — VCGI FeatureServer (filtered to Windsor)
  try {
    const PARCELS_URL =
      'https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/FS_VCGI_OPENDATA_Cadastral_VTPARCELS_poly_standardized_parcels_SP_v1/FeatureServer/0';
    const where = "UPPER(TNAME) = 'WINDSOR'";
    const outFields = ['OBJECTID','TNAME','PARCID','OWNER1','E911ADDR','ACRESGL'].join(',');
    const q = `${PARCELS_URL}/query?where=${encodeURIComponent(where)}&outFields=${encodeURIComponent(outFields)}&outSR=4326&f=geojson`;

    const parcelsGJ = await fetch(q, { cache: 'no-cache' }).then(r => r.json());
    map.addSource('parcels-gj', { type: 'geojson', data: parcelsGJ });

    // crisp outlines
    map.addLayer({
      id: 'parcels-line',
      type: 'line',
      source: 'parcels-gj',
      paint: { 'line-color': '#333', 'line-width': 1.2 }
    });
  } catch (e) {
    console.warn('Parcels load failed:', e);
  }

  // 2) Zoning Districts — local GeoJSON
  try {
    const zoningGJ = await fetch(ZONING_LOCAL, { cache: 'no-cache' }).then(r => r.json());
    map.addSource('zoning', { type: 'geojson', data: zoningGJ });
    map.addLayer({
      id: 'zoning-fill',
      type: 'fill',
      source: 'zoning',
      paint: { 'fill-color': '#3f51b5', 'fill-opacity': 0.10 }
    });
    map.addLayer({
      id: 'zoning-line',
      type: 'line',
      source: 'zoning',
      paint: { 'line-color': '#3f51b5', 'line-width': 1 }
    });
  } catch (e) {
    console.warn('Zoning load failed:', e);
  }

  // 3) Zoning Overlay — local GeoJSON
  try {
    const overlayGJ = await fetch(OVERLAY_LOCAL, { cache: 'no-cache' }).then(r => r.json());
    map.addSource('zoning-overlay', { type: 'geojson', data: overlayGJ });
    map.addLayer({
      id: 'overlay-fill',
      type: 'fill',
      source: 'zoning-overlay',
      paint: { 'fill-color': '#9c27b0', 'fill-opacity': 0.15 }
    });
    map.addLayer({
      id: 'overlay-line',
      type: 'line',
      source: 'zoning-overlay',
      paint: { 'line-color': '#9c27b0', 'line-width': 2, 'line-dasharray': [4, 2] }
    });
  } catch (e) {
    console.warn('Overlay load failed:', e);
  }

  // 4) FEMA Flood — ANR MapServer (clipped to current view)
  try {
    const FEMA_URL =
      'https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_EMERGENCY_SP_NOCACHE_v2/MapServer/57';
    const b = map.getBounds();
    const env = {
      xmin: b.getWest(), ymin: b.getSouth(), xmax: b.getEast(), ymax: b.getNorth(),
      spatialReference: { wkid: 4326 }
    };
    const params =
      `where=1%3D1&outFields=${encodeURIComponent('FLD_ZONE,SFHA_TF')}` +
      `&geometry=${encodeURIComponent(JSON.stringify(env))}` +
      `&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outSR=4326&f=geojson`;

    const floodGJ = await fetch(`${FEMA_URL}/query?${params}`, { cache: 'no-cache' }).then(r => r.json());
    map.addSource('fema-flood', { type: 'geojson', data: floodGJ });
    map.addLayer({
      id: 'fema-fill',
      type: 'fill',
      source: 'fema-flood',
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'FLD_ZONE'], 'AE'], '#d32f2f',
          '#1976d2'
        ],
        'fill-opacity': 0.20
      }
    });
    map.addLayer({
      id: 'fema-line',
      type: 'line',
      source: 'fema-flood',
      paint: { 'line-color': '#1976d2', 'line-width': 1 }
    });
  } catch (e) {
    console.warn('FEMA load failed:', e);
  }

  // ---------- visibility wiring for the four overlay checkboxes ----------
  const setVis = (id, on) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  };
  const wire = (id, layers) => {
    const el = document.getElementById(id);
    if (!el) return;
    const apply = () => layers.forEach(l => setVis(l, el.checked));
    el.addEventListener('change', apply);
    // initial
    apply();
  };

  wire('lgParcels', ['parcels-line']);
  wire('lgZoning',  ['zoning-fill','zoning-line']);
  wire('lgOverlay', ['overlay-fill','overlay-line']);
  wire('lgFlood',   ['fema-fill','fema-line']);
});
