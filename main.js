// Windsor 2D map
const map = L.map('map').setView([43.4806, -72.3851], 13);

// Base map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Draw-order panes (higher zIndex draws on top)
map.createPane('paneParcels');   map.getPane('paneParcels').style.zIndex   = 420;
map.createPane('paneZoning');    map.getPane('paneZoning').style.zIndex    = 430;
map.createPane('paneOverlay');   map.getPane('paneOverlay').style.zIndex   = 440;
map.createPane('paneFlood');     map.getPane('paneFlood').style.zIndex     = 450;
map.createPane('paneBuildings'); map.getPane('paneBuildings').style.zIndex = 460;
map.createPane('paneAnr');       map.getPane('paneAnr').style.zIndex       = 410;

// Paths (GitHub Pages)
const BASE            = '/Windsor_DT_Viewer';
const ZONING_LOCAL    = `${BASE}/data/zoning_layers/axisgis_zoning_live.geojson`;
const FLOOD_LOCAL     = `${BASE}/data/hazard_layers/flood_zones.geojson`;
const BUILDINGS_GJ    = `${BASE}/data/buildings/windsor_buildings.geojson`;
const ANR_GJ          = `${BASE}/data/anr/anr_land_units.geojson`;
const OVERLAY_LOCAL   = `${BASE}/data/zoning_layers/windsor_zoning_overlay.geojson`;

// Layer groups
const zoningLayer        = L.layerGroup().addTo(map);
const floodLayer         = L.layerGroup().addTo(map);
const buildingsLayer     = L.layerGroup().addTo(map);
const anrLayer           = L.layerGroup().addTo(map);
const zoningOverlayLayer = L.layerGroup().addTo(map);

// Zoning
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
  })
  .catch(e => console.error('zoning load', e));

// Parcels (VCGI live; Windsor only)
const PARCELS_URL =
  'https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/FS_VCGI_OPENDATA_Cadastral_VTPARCELS_poly_standardized_parcels_SP_v1/FeatureServer/0';

const parcelsLive = L.esri.featureLayer({
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
  const id   = p.PARCID   ?? '';
  const own  = p.OWNER1   ?? '';
  const addr = p.E911ADDR ?? '';
  const ac   = p.ACRESGL  ?? '';
  return `<div style="font:13px system-ui">
    <div style="font-weight:600;margin-bottom:4px">Parcel ${id}</div>
    <div>Owner: ${own}</div>
    <div>Address: ${addr}</div>
    <div>Acres: ${ac}</div>
  </div>`;
}).addTo(map);

// Fit to Windsor parcels once
L.esri.query({ url: PARCELS_URL })
  .where("UPPER(TNAME) = 'WINDSOR'")
  .bounds((err, b) => { if (!err && b) map.fitBounds(b, { padding:[20,20] }); });

// FEMA Flood Hazard (ANR live)
const FEMA_URL =
  'https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_EMERGENCY_SP_NOCACHE_v2/MapServer/57';

const femaFlood = L.esri.featureLayer({
  pane: 'paneFlood',
  url: FEMA_URL,
  minZoom: 11,
  simplifyFactor: 0.5,
  precision: 5,
  fields: ['OBJECTID','FLD_ZONE','SFHA_TF'],
  style: function (feature) {
    const z = feature.properties && feature.properties.FLD_ZONE;
    return {
      color: z === 'AE' ? '#d32f2f' : '#1976d2',
      weight: 1.2,
      fillOpacity: 0.20
    };
  }
})
.bindPopup(function (layer) {
  const p = layer.feature && layer.feature.properties || {};
  return `<div style="font:13px system-ui">
    <div style="font-weight:600">Flood Zone: ${p.FLD_ZONE || 'N/A'}</div>
    ${p.SFHA_TF ? `<div>Special Flood Hazard Area: ${p.SFHA_TF}</div>` : ''}
  </div>`;
})
.addTo(floodLayer);

// Buildings (local)
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
  })
  .catch(e => console.warn('buildings load', e));

// ANR Land Units (local)
fetch(ANR_GJ)
  .then(r => r.json())
  .then(gj => {
    L.geoJSON(gj, {
      pane: 'paneAnr',
      style: { color:'#2e7d32', weight:1, fillOpacity:0.15 },
      onEachFeature: (f, l) => {
        const p = f.properties || {};
        const nm = p.UNIT_NAME || '';
        const ow = p.OWNER || '';
        l.bindPopup(`<div style="font:13px system-ui">
          <div style="font-weight:600;margin-bottom:4px">ANR Land Unit</div>
          ${nm ? `Name: ${nm}<br/>` : ''}${ow ? `Owner: ${ow}` : ''}
        </div>`);
      }
    }).addTo(anrLayer);
  })
  .catch(e => console.warn('anr load', e));

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
  })
  .catch(e => console.error('overlay load', e));

// Layer control
const layerControl = L.control.layers(null, {
  'Parcels (VCGI live)': parcelsLive,
  'Zoning Districts': zoningLayer,
  'Zoning Overlay (Windsor)': zoningOverlayLayer,
  'FEMA Flood Zones': floodLayer,
  'Buildings': buildingsLayer,
  'ANR Land Units': anrLayer
}, { collapsed: false }).addTo(map);
