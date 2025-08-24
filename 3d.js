// 3D terrain + Windsor overlays (no API keys)
const BASE    = '/Windsor_DT_Viewer';
const CENTER  = [-72.3851, 43.4806];

// Local files (same names/paths you already use in 2D)
const ZONING_LOCAL   = `${BASE}/data/zoning_layers/axisgis_zoning_live.geojson`;
const OVERLAY_LOCAL  = `${BASE}/data/zoning_layers/windsor_zoning_overlay.geojson`;

// Live services as GeoJSON (server-side filters to Windsor)
const PARCELS_BASE = 'https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/FS_VCGI_OPENDATA_Cadastral_VTPARCELS_poly_standardized_parcels_SP_v1/FeatureServer/0';
const PARCELS_GJ   = `${PARCELS_BASE}/query?where=${encodeURIComponent("UPPER(TNAME) = 'WINDSOR'")}`
                   + '&outFields=OBJECTID,TNAME,PARCID,OWNER1,E911ADDR,ACRESGL&outSR=4326&f=geojson';

// FEMA flood — clipped by a Windsor bbox to keep it small
const WRS_BBOX = [-72.47, 43.41, -72.32, 43.52]; // [minX,minY,maxX,maxY]
const FEMA_BASE = 'https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_EMERGENCY_SP_NOCACHE_v2/MapServer/57';
const FEMA_GJ   = `${FEMA_BASE}/query`
  + `?geometry=${encodeURIComponent(JSON.stringify({ xmin:WRS_BBOX[0], ymin:WRS_BBOX[1], xmax:WRS_BBOX[2], ymax:WRS_BBOX[3], spatialReference:{wkid:4326} }))}`
  + '&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects'
  + '&where=1%3D1&outFields=OBJECTID,FLD_ZONE,SFHA_TF&outSR=4326&f=geojson';

// OSM basemap
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
  // Terrain (AWS Terrarium)
  map.addSource('terrain-dem', {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 15,
    encoding: 'terrarium',
    attribution: 'Elevation: AWS Terrain Tiles'
  });
  map.setTerrain({ source: 'terrain-dem', exaggeration: 1.8 });

  // Hillshade
  map.addLayer({
    id: 'hillshade',
    type: 'hillshade',
    source: 'terrain-dem',
    layout: { visibility: 'visible' },
    paint: { 'hillshade-exaggeration': 0.7 }
  });

  // Satellite (Esri World Imagery)
  map.addSource('esri-sat', {
    type: 'raster',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    tileSize: 256, maxzoom: 19,
    attribution: 'Imagery: Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN, GIS User Community'
  });
  map.addLayer({ id: 'satellite', type: 'raster', source: 'esri-sat', layout: { visibility: 'none' } });

  // ---- Parcels (live GeoJSON from FeatureServer) ----
  map.addSource('parcels', { type: 'geojson', data: PARCELS_GJ });
  map.addLayer({
    id: 'parcels-line',
    type: 'line',
    source: 'parcels',
    paint: { 'line-color': '#333', 'line-width': 1.2 },
    layout: { visibility: 'visible' }
  });
  map.addLayer({
    id: 'parcels-hit',
    type: 'fill',
    source: 'parcels',
    paint: { 'fill-color': '#000', 'fill-opacity': 0 },
    layout: { visibility: 'visible' }
  });
  map.on('click', 'parcels-hit', (e) => {
    const f = e.features && e.features[0];
    if (!f) return;
    const p = f.properties || {};
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`<div style="font:13px system-ui">
        <div style="font-weight:600;margin-bottom:4px">Parcel ${p.PARCID || ''}</div>
        <div>Owner: ${p.OWNER1 || ''}</div>
        <div>Address: ${p.E911ADDR || ''}</div>
        <div>Acres: ${p.ACRESGL || ''}</div>
      </div>`)
      .addTo(map);
  });

  // ---- Zoning (local GeoJSON) ----
  map.addSource('zoning', { type: 'geojson', data: ZONING_LOCAL });
  map.addLayer({
    id: 'zoning-fill',
    type: 'fill',
    source: 'zoning',
    paint: { 'fill-color': '#3f51b5', 'fill-opacity': 0.10 },
    layout: { visibility: 'visible' }
  }, 'parcels-line'); // draw beneath parcel lines
  map.addLayer({
    id: 'zoning-line',
    type: 'line',
    source: 'zoning',
    paint: { 'line-color': '#3f51b5', 'line-width': 1 }
  });

  // ---- Zoning Overlay (local GeoJSON) ----
  map.addSource('zoning-overlay', { type: 'geojson', data: OVERLAY_LOCAL });
  map.addLayer({
    id: 'zoverlay-fill',
    type: 'fill',
    source: 'zoning-overlay',
    paint: { 'fill-color': '#9c27b0', 'fill-opacity': 0.15 },
    layout: { visibility: 'visible' }
  });
  map.addLayer({
    id: 'zoverlay-line',
    type: 'line',
    source: 'zoning-overlay',
    paint: { 'line-color': '#9c27b0', 'line-width': 2, 'line-dasharray': [4,2] }
  });

  // ---- FEMA Flood (live GeoJSON clipped to Windsor bbox) ----
  map.addSource('fema-flood', { type: 'geojson', data: FEMA_GJ });
  map.addLayer({
    id: 'fema-fill',
    type: 'fill',
    source: 'fema-flood',
    paint: {
      'fill-color': [
        'case',
        ['==',['get','FLD_ZONE'],'AE'], '#d32f2f',
        '#1976d2'
      ],
      'fill-opacity': 0.20
    ],
    layout: { visibility: 'visible' }
  });
  map.addLayer({
    id: 'fema-line',
    type: 'line',
    source: 'fema-flood',
    paint: { 'line-color': '#555', 'line-width': 1 }
  });

  // ---- UI toggles ----
  const byId = id => document.getElementById(id);
  const setVis = (ids, on) => ids.forEach(l => map.setLayoutProperty(l, 'visibility', on ? 'visible' : 'none'));

  const toggleSat   = byId('toggleSat');
  const toggleShade = byId('toggleShade');
  const lgParcels   = byId('lgParcels');
  const lgZoning    = byId('lgZoning');
  const lgOverlay   = byId('lgOverlay');
  const lgFlood     = byId('lgFlood');

  if (toggleSat)   toggleSat.addEventListener('change', () => setVis(['satellite'], toggleSat.checked));
  if (toggleShade) toggleShade.addEventListener('change', () => setVis(['hillshade'], toggleShade.checked));
  if (lgParcels)   lgParcels.addEventListener('change', () => setVis(['parcels-line','parcels-hit'], lgParcels.checked));
  if (lgZoning)    lgZoning.addEventListener('change', () => setVis(['zoning-fill','zoning-line'], lgZoning.checked));
  if (lgOverlay)   lgOverlay.addEventListener('change', () => setVis(['zoverlay-fill','zoverlay-line'], lgOverlay.checked));
  if (lgFlood)     lgFlood.addEventListener('change', () => setVis(['fema-fill','fema-line'], lgFlood.checked));
});
