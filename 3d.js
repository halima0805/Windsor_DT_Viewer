// Leaflet + MapLibre GL hybrid: 3D terrain base, Leaflet overlays
const CENTER = [43.4806, -72.3851];
const BASE   = '/Windsor_DT_Viewer';

// local files
const ZONING_LOCAL  = `${BASE}/data/zoning_layers/axisgis_zoning_live.geojson`;
const OVERLAY_LOCAL = `${BASE}/data/zoning_layers/windsor_zoning_overlay.geojson`;
const BUILDINGS_GJ  = `${BASE}/data/buildings/windsor_buildings.geojson`;

// services
const PARCELS_URL =
  'https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/FS_VCGI_OPENDATA_Cadastral_VTPARCELS_poly_standardized_parcels_SP_v1/FeatureServer/0';
const FEMA_MAPSERVICE =
  'https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_EMERGENCY_SP_NOCACHE_v2/MapServer';
const FEMA_LAYER_ID = 57;

// ----- Leaflet map -----
const map = L.map('map', { center: CENTER, zoom: 13.5, zoomControl: false });
L.control.zoom({ position: 'topright' }).addTo(map);

// panes for draw order (GL at bottom)
map.createPane('paneGL');        map.getPane('paneGL').style.zIndex        = 200;
map.createPane('paneParcels');   map.getPane('paneParcels').style.zIndex   = 420;
map.createPane('paneZoning');    map.getPane('paneZoning').style.zIndex    = 430;
map.createPane('paneOverlay');   map.getPane('paneOverlay').style.zIndex   = 440;
map.createPane('paneFlood');     map.getPane('paneFlood').style.zIndex     = 450;
map.createPane('paneBuildings'); map.getPane('paneBuildings').style.zIndex = 460;

// ----- MapLibre GL in Leaflet pane (terrain + base maps) -----
const gl = L.maplibreGL({
  pane: 'paneGL',
  style: {
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
  }
}).addTo(map);

// access the inner MapLibre map and configure terrain + satellite + hillshade
(function wireTerrain() {
  const ml = gl.getMaplibreMap ? gl.getMaplibreMap() : gl._glMap;
  if (!ml) { setTimeout(wireTerrain, 50); return; }

  ml.on('load', () => {
    ml.addSource('terrain-dem', {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 15,
      encoding: 'terrarium',
      attribution: 'Elevation: AWS Terrain Tiles'
    });
    ml.setTerrain({ source: 'terrain-dem', exaggeration: 1.8 });

    ml.addLayer({
      id: 'hillshade', type: 'hillshade', source: 'terrain-dem',
      layout: { visibility: 'visible' },
      paint: { 'hillshade-exaggeration': 0.7 }
    });

    ml.addSource('esri-sat', {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256, maxzoom: 19,
      attribution: 'Imagery: Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN, GIS User Community'
    });
    ml.addLayer({ id: 'satellite', type: 'raster', source: 'esri-sat', layout: { visibility: 'none' } });

    ml.setSky({ 'sun': [0, 90], 'sun-intensity': 8, 'sky-type': 'atmosphere' });

    // UI toggles
    const toggleSat   = document.getElementById('toggleSat');
    const toggleShade = document.getElementById('toggleShade');
    const applyBase = () => {
      const satOn = toggleSat && toggleSat.checked;
      ml.setLayoutProperty('satellite', 'visibility', satOn ? 'visible' : 'none');
      ml.setLayoutProperty('osm',       'visibility', satOn ? 'none'    : 'visible');
    };
    if (toggleSat) { applyBase(); toggleSat.addEventListener('change', applyBase); }
    if (toggleShade) {
      const setShade = () => ml.setLayoutProperty('hillshade', 'visibility', toggleShade.checked ? 'visible' : 'none');
      setShade(); toggleShade.addEventListener('change', setShade);
    }
  });
})();

// ----- Leaflet overlay groups -----
const zoningLayer        = L.layerGroup().addTo(map);
const zoningOverlayLayer = L.layerGroup().addTo(map);
const floodLayer         = L.layerGroup().addTo(map);
const parcelsLayer       = L.layerGroup().addTo(map);
const buildingsLayer     = L.layerGroup().addTo(map);

// Zoning (local)
fetch(ZONING_LOCAL)
  .then(r => r.json())
  .then(gj => {
    const lyr = L.geoJSON(gj, {
      pane: 'paneZoning',
      style: { color: '#3f51b5', weight: 1, fillOpacity: 0.10 },
      onEachFeature: (f, l) => {
        const z = f.properties?.ZONE || 'N/A';
        l.bindPopup(`Zoning District: ${z}`);
      }
    }).addTo(zoningLayer);
    map.fitBounds(lyr.getBounds());
  }).catch(()=>{});

// Parcels (VCGI live; Windsor only)
L.esri.featureLayer({
  pane: 'paneParcels',
  url: PARCELS_URL,
  where: "UPPER(TNAME) = 'WINDSOR'",
  fields: ['OBJECTID','TNAME','PARCID','OWNER1','E911ADDR','ACRESGL'],
  minZoom: 11,
  simplifyFactor: 0.5,
  precision: 5,
  style: { color:'#333', weight:1.2, fillOpacity:0 }
})
.bindPopup(layer => {
  const p = layer.feature?.properties || {};
  return `<div style="font:13px system-ui">
    <div style="font-weight:600;margin-bottom:4px">Parcel ${p.PARCID ?? ''}</div>
    <div>Owner: ${p.OWNER1 ?? ''}</div>
    <div>Address: ${p.E911ADDR ?? ''}</div>
    <div>Acres: ${p.ACRESGL ?? ''}</div>
  </div>`;
})
.addTo(parcelsLayer);

// FEMA flood (feature layer, with dynamic fallback)
let femaFallback = null;
L.esri.featureLayer({
  pane: 'paneFlood',
  url: `${FEMA_MAPSERVICE}/${FEMA_LAYER_ID}`,
  minZoom: 11,
  fields: ['FLD_ZONE','SFHA_TF'],
  simplifyFactor: 0.5,
  precision: 5,
  style: (feature) => {
    const z = feature?.properties?.FLD_ZONE;
    return { color: z === 'AE' ? '#d32f2f' : '#1976d2', weight: 1.2, fillOpacity: 0.20 };
  }
})
.bindPopup((layer) => {
  const p = layer.feature?.properties || {};
  return `<div style="font:13px system-ui">
    <div style="font-weight:600">Flood Zone: ${p.FLD_ZONE || 'N/A'}</div>
    ${p.SFHA_TF ? `<div>Special Flood Hazard Area: ${p.SFHA_TF}</div>` : ''}
  </div>`;
})
.on('requesterror', () => {
  if (femaFallback) return;
  femaFallback = L.esri.dynamicMapLayer({
    url: FEMA_MAPSERVICE,
    layers: [FEMA_LAYER_ID],
    opacity: 0.5,
    pane: 'paneFlood'
  }).addTo(floodLayer);
})
.addTo(floodLayer);

// Buildings (local 2D polygons for now)
fetch(BUILDINGS_GJ)
  .then(r => r.json())
  .then(gj => {
    L.geoJSON(gj, {
      pane: 'paneBuildings',
      style: { color:'#0c2038', weight:0.5, fillColor:'#8fb4d9', fillOpacity:0.55 },
      onEachFeature: (f, l) => {
        const p = f.properties || {};
        const nm = p.name || 'Building';
        const h  = Number(p.height_m ?? p.height ?? p.levels ?? p['building:levels']) || null;
        l.bindPopup(`<div style="font:13px system-ui">
          <div style="font-weight:600;margin-bottom:4px">${nm}</div>
          ${h ? `Estimated height: ${h.toFixed(1)} m` : ''}
        </div>`);
      }
    }).addTo(buildingsLayer);
  }).catch(()=>{});

// Zoning overlay (local)
fetch(OVERLAY_LOCAL)
  .then(r => r.json())
  .then(gj => {
    L.geoJSON(gj, {
      pane: 'paneOverlay',
      style: { color:'#8e24aa', weight:2, dashArray:'4,2', fillOpacity:0.15 },
      onEachFeature: (f, l) => {
        const p = f.properties || {};
        const name = p.NAME || p.ZONENAME || p.DISTRICT || 'Overlay';
        const desc = p.DESCRIPTION || p.OVERLAY || '';
        l.bindPopup(`<div style="font:13px system-ui">
          <div style="font-weight:600;margin-bottom:4px">${name}</div>
          ${desc ? `<div>${desc}</div>` : ''}
        </div>`);
      }
    }).addTo(zoningOverlayLayer);
  }).catch(()=>{});

// Layer control (Leaflet checkboxes)
L.control.layers(null, {
  'Parcels (VCGI live)': parcelsLayer,
  'Zoning Districts': zoningLayer,
  'Zoning Overlay (Windsor)': zoningOverlayLayer,
  'FEMA Flood Zones': floodLayer,
  'Buildings': buildingsLayer
}, { collapsed: false }).addTo(map);
