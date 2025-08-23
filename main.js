// Windsor 2D map
const map = L.map('map').setView([43.4806, -72.3851], 13);

// Base map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

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
const buildingsLayer     = L.layerGroup();
const anrLayer           = L.layerGroup();
const zoningOverlayLayer = L.layerGroup();

// Zoning
fetch(ZONING_LOCAL)
  .then(r => r.json())
  .then(gj => {
    const lyr = L.geoJSON(gj, {
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

// Flood
fetch(FLOOD_LOCAL)
  .then(r => r.json())
  .then(gj => {
    L.geoJSON(gj, {
      style: f => ({
        color: f.properties?.FLD_ZONE === 'AE' ? '#f44336' : '#2196f3',
        weight: 1,
        fillOpacity: 0.3
      }),
      onEachFeature: (f, l) => {
        const z = f.properties?.FLD_ZONE || 'N/A';
        l.bindPopup(`Flood Zone: ${z}`);
      }
    }).addTo(floodLayer);
  })
  .catch(e => console.error('flood load', e));

// Buildings (local)
fetch(BUILDINGS_GJ)
  .then(r => r.json())
  .then(gj => {
    L.geoJSON(gj, {
      style: { color:'#0c2038', weight:0.5, fillColor:'#8fb4d9', fillOpacity:0.5 },
      onEachFeature: (f, l) => {
        const p = f.properties || {};
        const nm = p.name || 'Building';
        const h  = p.height_m;
        l.bindPopup(`<div style="font:13px system-ui">
          <div style="font-weight:600;margin-bottom:4px">${nm}</div>
          ${h ? `Height (est): ${Number(h).toFixed(1)} m` : ''}
        </div>`);
      }
    }).addTo(buildingsLayer);
    layerControl.addOverlay(buildingsLayer, 'Buildings');
  })
  .catch(e => console.warn('buildings load', e));

// ANR Land Units (local)
fetch(ANR_GJ)
  .then(r => r.json())
  .then(gj => {
    L.geoJSON(gj, {
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
    layerControl.addOverlay(anrLayer, 'ANR Land Units');
  })
  .catch(e => console.warn('anr load', e));

// Zoning overlay (local)
fetch(OVERLAY_LOCAL)
  .then(r => r.json())
  .then(gj => {
    L.geoJSON(gj, {
      style: { color:'#9c27b0', weight:2, dashArray:'4,2', fillOpacity:0.15 },
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
  'FEMA Flood Zones': floodLayer
}, { collapsed: false }).addTo(map);
