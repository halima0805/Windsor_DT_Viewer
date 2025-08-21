// ===== Windsor DT Viewer (Leaflet) =====
// Loads Zoning + Parcels + Flood + Buildings from /Windsor_DT_Viewer/data/*

// ---- ABSOLUTE paths for your public GitHub Pages
const BASE           = '/Windsor_DT_Viewer'; // do NOT change
const ZONING_URL     = `${BASE}/data/zoning_layers/axisgis_zoning_live.geojson`;
const PARCELS_URL    = `${BASE}/data/parcels/parcels.geojson`;
const FLOOD_URL      = `${BASE}/data/hazard_layers/flood_zones.geojson`;
const BUILDINGS_URL  = `${BASE}/data/buildings/windsor_buildings.geojson`;

// ---- Map
const map = L.map('map', { preferCanvas: true }).setView([43.4806, -72.3851], 13);
const osmBase = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// ---- Layer control
const overlays = {};
const layerControl = L.control.layers({ 'OpenStreetMap': osmBase }, overlays, { collapsed: false }).addTo(map);

// ---- Helpers
async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}
function fitToLayers(layers) {
  let bounds = null;
  layers.forEach(Lyr => {
    if (Lyr && Lyr.getLayers && Lyr.getLayers().length) {
      const b = Lyr.getBounds();
      bounds = bounds ? bounds.extend(b) : b;
    }
  });
  if (bounds) map.fitBounds(bounds, { padding: [20, 20] });
}
function popupTable(props, prefer = []) {
  const p = props || {};
  const rows = [];
  prefer.forEach(k => { if (p[k] != null) rows.push([k, p[k]]); });
  if (!rows.length) Object.keys(p).slice(0, 6).forEach(k => rows.push([k, p[k]]));
  return `<div style="font:13px system-ui"><table>${
    rows.map(([k,v]) => `<tr><td style="color:#666;padding:2px 6px">${k}</td><td style="padding:2px 6px">${v}</td></tr>`).join('')
  }</table></div>`;
}

// ---- Zoning
let zoningLayer = null;
async function loadZoning() {
  try {
    const gj = await getJSON(ZONING_URL);
    zoningLayer = L.geoJSON(gj, {
      style: { color: '#3f51b5', weight: 1, fillOpacity: 0.10 },
      onEachFeature: (f, lyr) => {
        const p = f.properties || {};
        const zone = p.ZONE || p.zone || p.district || 'N/A';
        lyr.bindPopup(`<div style="font:13px system-ui">Zoning District: <b>${zone}</b></div>`);
      }
    }).addTo(map);
    layerControl.addOverlay(zoningLayer, 'Zoning Districts');
    return zoningLayer;
  } catch (e) { console.error('Zoning load failed:', e); return null; }
}

// ---- Parcels
let parcelsLayer = null;
async function loadParcels() {
  try {
    const gj = await getJSON(PARCELS_URL);
    parcelsLayer = L.geoJSON(gj, {
      style: { color: '#ff9800', weight: 0.8, fillColor: '#f3e7cf', fillOpacity: 0.25 },
      onEachFeature: (f, lyr) => {
        const wanted = ['OWNER','Owner','owner','OwnerName','SPAN','MAPLOT','PID','ACCOUNT','ADDRESS','LOC_ADDR'];
        lyr.bindPopup(popupTable(f.properties, wanted));
      }
    }).addTo(map);
    layerControl.addOverlay(parcelsLayer, 'Parcel Boundaries');
    return parcelsLayer;
  } catch (e) { console.error('Parcels load failed:', e); return null; }
}

// ---- Flood Zones
let floodLayer = null;
async function loadFlood() {
  try {
    const gj = await getJSON(FLOOD_URL);
    floodLayer = L.geoJSON(gj, {
      style: f => ({
        color: (f.properties?.FLD_ZONE || f.properties?.ZONE) === 'AE' ? '#f44336' : '#2196f3',
        weight: 1,
        fillOpacity: 0.30
      }),
      onEachFeature: (f, lyr) => {
        const zone = f.properties?.FLD_ZONE || f.properties?.ZONE || 'N/A';
        lyr.bindPopup(`<div style="font:13px system-ui">Flood Zone: <b>${zone}</b></div>`);
      }
    }).addTo(map);
    layerControl.addOverlay(floodLayer, 'FEMA Flood Zones');
    return floodLayer;
  } catch (e) { console.warn('Flood layer not found (ok to skip):', e); return null; }
}

// ---- Buildings (OSM static)
let buildingsLayer = null;
async function loadBuildings() {
  try {
    const gj = await getJSON(BUILDINGS_URL);
    (gj.features || []).forEach(f => {
      const p = f.properties || (f.properties = {});
      if (p.height_m == null) {
        const floors = Number(p.floors ?? p.levels ?? p['building:levels'] ?? 2);
        p.height_m = floors * 3.0; // ~3 m/floor
      }
    });
    buildingsLayer = L.geoJSON(gj, {
      style: { color: '#0c2038', weight: 0.5, fillColor: '#8fb4d9', fillOpacity: 0.6 },
      onEachFeature: (f, lyr) => {
        const p = f.properties || {};
        const name = p.name || 'Building';
        const h = Number(p.height_m);
        lyr.bindPopup(
          `<div style="font:13px system-ui">
             <div style="font-weight:600;margin-bottom:4px;">${name}</div>
             <div>Estimated height: ${isFinite(h) ? h.toFixed(1) : '—'} m</div>
           </div>`
        );
      }
    }).addTo(map);
    layerControl.addOverlay(buildingsLayer, 'Buildings (OSM)');
    return buildingsLayer;
  } catch (e) { console.warn('Buildings layer not found (ok to skip):', e); return null; }
}

// ---- Load everything, then zoom to what exists
(async () => {
  const [z, p, f, b] = await Promise.all([loadZoning(), loadParcels(), loadFlood(), loadBuildings()]);
  fitToLayers([b, p, z, f]); // prioritize buildings/parcels for view
})();
