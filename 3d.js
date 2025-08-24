// 3d.js — Windsor 3D map with terrain + overlays (MapLibre GL, no API keys)

const BASE    = '/Windsor_DT_Viewer';
const BLD_URL = `${BASE}/data/buildings/windsor_buildings_3d.geojson`;
const OVERLAY_URL = `${BASE}/data/zoning_layers/windsor_zoning_overlay.geojson`;
const CENTER  = [-72.3851, 43.4806];

// ---- Base style (OSM raster)
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

map.on('error', e => console.error('Map error:', e && (e.error || e)));

// ---- Helpers
function json(url) { return fetch(url, { cache: 'no-cache' }).then(r => {
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
});}

// VCGI parcels (Windsor only) as GeoJSON
const PARCELS_GJ_URL = (function () {
  const base = 'https://services1.arcgis.com/BkFxaEFNwHqX3tAw/ArcGIS/rest/services/FS_VCGI_OPENDATA_Cadastral_VTPARCELS_poly_standardized_parcels_SP_v1/FeatureServer/0/query';
  const where = encodeURIComponent("UPPER(TNAME)='WINDSOR'");
  const fields = encodeURIComponent('OBJECTID,TNAME,PARCID,OWNER1,E911ADDR,ACRESGL');
  return `${base}?where=${where}&outFields=${fields}&returnGeometry=true&outSR=4326&f=geojson`;
})();

// FEMA flood (ANR MapServer 57) clipped to a Windsor bbox (tweak if needed)
const WINDSOR_BBOX = [-72.45, 43.42, -72.32, 43.53]; // xmin,ymin,xmax,ymax in lon/lat
const FEMA_GJ_URL = (function () {
  const base = 'https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_EMERGENCY_SP_NOCACHE_v2/MapServer/57/query';
  const geom = WINDSOR_BBOX.join(',');
  const fields = encodeURIComponent('FLD_ZONE,SFHA_TF');
  return `${base}?where=1%3D1&geometry=${geom}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=${fields}&returnGeometry=true&outSR=4326&f=geojson`;
})();

map.on('load', async () => {
  // ---- Terrain (DEM + hillshade + optional satellite)
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
  map.addLayer({ id: 'satellite', type: 'raster', source: 'esri-sat', layout: { visibility: 'none' } });

  map.setSky({ 'sun': [0, 90], 'sun-intensity': 8, 'sky-type': 'atmosphere' });

  // ---- Zoning overlay (local)
  try {
    const overlay = await json(OVERLAY_URL);
    map.addSource('zoning-overlay', { type: 'geojson', data: overlay });
    map.addLayer({
      id: 'zoning-overlay-fill',
      type: 'fill',
      source: 'zoning-overlay',
      paint: { 'fill-color': '#9c27b0', 'fill-opacity': 0.15 }
    }, 'satellite'); // before labels if you had any
    map.addLayer({
      id: 'zoning-overlay-line',
      type: 'line',
      source: 'zoning-overlay',
      paint: { 'line-color': '#9c27b0', 'line-width': 2, 'line-dasharray': [4,2] }
    });
  } catch (e) {
    console.warn('overlay load failed:', e);
  }

  // ---- Parcels (VCGI → GeoJSON)
  try {
    const parcels = await json(PARCELS_GJ_URL);
    map.addSource('parcels', { type: 'geojson', data: parcels });
    map.addLayer({
      id: 'parcels-outline',
      type: 'line',
      source: 'parcels',
      paint: { 'line-color': '#333', 'line-width': 1.2 }
    });
  } catch (e) {
    console.warn('parcels load failed:', e);
  }

  // ---- FEMA flood (ANR → GeoJSON)
  try {
    const flood = await json(FEMA_GJ_URL);
    map.addSource('fema-flood', { type: 'geojson', data: flood });
    map.addLayer({
      id: 'fema-flood-fill',
      type: 'fill',
      source: 'fema-flood',
      paint: {
        'fill-color': [
          'case',
          ['==', ['upcase', ['get','FLD_ZONE']], 'AE'], '#d32f2f',
          '#1976d2'
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
    console.warn('flood load failed:', e);
  }

  // ---- Buildings (optional, from your repo)
  try {
    const gj = await json(BLD_URL);
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
  } catch (e) {
    console.warn('buildings load failed:', e);
  }

  // ---- UI toggles (only if elements exist)
  const byId = id => document.getElementById(id);

  const toggleSat     = byId('toggleSat');
  const toggleShade   = byId('toggleShade');
  const toggleParcels = byId('toggleParcels');
  const toggleOverlay = byId('toggleOverlay');
  const toggleFlood   = byId('toggleFlood');
  const toggleBldg    = byId('toggleBldg');

  function setVis(id, on) {
    if (!map.getLayer(id)) return;
    map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  }

  if (toggleSat) {
    const applyBase = () => {
      const sat = toggleSat.checked;
      setVis('satellite', sat);
      setVis('osm', !sat);
    };
    applyBase();
    toggleSat.addEventListener('change', applyBase);
  }
  if (toggleShade) {
    const applyShade = () => setVis('hillshade', !!toggleShade.checked);
    applyShade();
    toggleShade.addEventListener('change', applyShade);
  }
  if (toggleParcels) {
    const apply = () => setVis('parcels-outline', !!toggleParcels.checked);
    apply();
    toggleParcels.addEventListener('change', apply);
  }
  if (toggleOverlay) {
    const apply = () => {
      const on = !!toggleOverlay.checked;
      setVis('zoning-overlay-fill', on);
      setVis('zoning-overlay-line', on);
    };
    apply();
    toggleOverlay.addEventListener('change', apply);
  }
  if (toggleFlood) {
    const apply = () => {
      const on = !!toggleFlood.checked;
      setVis('fema-flood-fill', on);
      setVis('fema-flood-line', on);
    };
    apply();
    toggleFlood.addEventListener('change', apply);
  }
  if (toggleBldg) {
    const apply = () => setVis('windsor-buildings-3d', !!toggleBldg.checked);
    apply();
    toggleBldg.addEventListener('change', apply);
  }
});
