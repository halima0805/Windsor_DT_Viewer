// ===== Windsor DT Viewer (Leaflet) =====
// Zoning + Buildings (static) + Parcels (ANR/VCGI live) + Address search

// ---- ABSOLUTE paths for your GitHub Pages site
const BASE           = '/Windsor_DT_Viewer'; // do NOT change
const ZONING_URL     = `${BASE}/data/zoning_layers/axisgis_zoning_live.geojson`;
const BUILDINGS_URL  = `${BASE}/data/buildings/windsor_buildings.geojson`;

// ---- TODO: PASTE YOUR ANR/VCGI PARCELS FeatureServer URL BELOW
// Example shape: https://.../ArcGIS/rest/services/.../FeatureServer/0
const PARCELS_FS = '<<PASTE_FEATURESERVER_URL_HERE>>';

// ---- Map
const map = L.map('map', { preferCanvas: true }).setView([43.4806, -72.3851], 13);
const osmBase = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// ---- Layer control
const layerControl = L.control.layers({ 'OpenStreetMap': osmBase }, {}, { collapsed: false }).addTo(map);

// ---- Helpers
async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}
function fitToLayers(layers) {
  let b = null;
  layers.forEach(Lyr => {
    if (Lyr && Lyr.getLayers && Lyr.getLayers().length) {
      const bb = Lyr.getBounds();
      b = b ? b.extend(bb) : bb;
    }
  });
  if (b) map.fitBounds(b, { padding: [20, 20] });
}
function tablePopup(props, prefer = []) {
  const p = props || {};
  const rows = [];
  prefer.forEach(k => { if (p[k] != null) rows.push([k, p[k]]); });
  if (!rows.length) Object.keys(p).slice(0, 8).forEach(k => rows.push([k, p[k]]));
  return `<div style="font:13px system-ui"><table>${
    rows.map(([k, v]) => `<tr><td style="color:#666;padding:2px 6px">${k}</td><td style="padding:2px 6px">${v}</td></tr>`).join('')
  }</table></div>`;
}

// ---- Zoning (static)
let zoningLayer = null;
(async () => {
  try {
    const gj = await getJSON(ZONING_URL);
    zoningLayer = L.geoJSON(gj, {
      style: { color: '#3f51b5', weight: 1, fillOpacity: 0.10 },
      onEachFeature: (f, lyr) => {
        const zone = f.properties?.ZONE || f.properties?.zone || f.properties?.district || 'N/A';
        lyr.bindPopup(`<div style="font:13px system-ui">Zoning District: <b>${zone}</b></div>`);
      }
    }).addTo(map);
    layerControl.addOverlay(zoningLayer, 'Zoning');
  } catch (e) { console.warn('Zoning not loaded:', e); }
})();

// ---- Buildings (static OSM export)
let buildingsLayer = null;
(async () => {
  try {
    const gj = await getJSON(BUILDINGS_URL);
    (gj.features || []).forEach(f => {
      const p = f.properties || (f.properties = {});
      if (p.height_m == null) {
        const floors = Number(p.floors ?? p.levels ?? p['building:levels'] ?? 2);
        p.height_m = floors * 3.0;
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
  } catch (e) { console.warn('Buildings not loaded:', e); }
})();

// ---- Parcels (live from ANR/VCGI FeatureServer via Esri Leaflet)
let parcelsLayer = null;
let parcelHighlight = null;

if (PARCELS_FS && PARCELS_FS.includes('/FeatureServer/')) {
  parcelsLayer = L.esri.featureLayer({
    url: PARCELS_FS,
    minZoom: 10,               // draw only when fairly zoomed in
    simplifyFactor: 0.5,
    precision: 5,
    style: { color: '#5c3b0a', weight: 1.2, fillOpacity: 0 } // crisp boundaries, no fill
  })
  .bindPopup(function (layer) {
    const p = layer.feature?.properties || {};
    const preferred = ['OWNER','Owner','OwnerName','SPAN','MAPLOT','ACCOUNT','ADDRESS','LOC_ADDR','PROPLOC','ParcelNumber','PID'];
    return tablePopup(p, preferred);
  })
  .addTo(map);

  layerControl.addOverlay(parcelsLayer, 'Parcels (ANR/VCGI)');

  // Click anywhere: find/flash the parcel at that point
  map.on('click', (e) => {
    const q = L.esri.query({ url: PARCELS_FS });
    q.contains(e.latlng).run((err, fc) => {
      if (parcelHighlight) map.removeLayer(parcelHighlight);
      if (!err && fc && fc.features && fc.features.length) {
        parcelHighlight = L.geoJSON(fc, { style: { color: '#ffd54f', weight: 3, fillOpacity: 0 } }).addTo(map);
      }
    });
  });
}

// ---- Address search (keyless, Nominatim via leaflet-control-geocoder)
const geocoder = L.Control.geocoder({
  defaultMarkGeocode: false
})
.on('markgeocode', function(e) {
  const bbox = e.geocode.bbox;
  const bounds = L.latLngBounds(bbox);
  map.fitBounds(bounds);

  // After geocoding, try to select the parcel at the center
  if (PARCELS_FS && PARCELS_FS.includes('/FeatureServer/')) {
    const center = e.geocode.center;
    const q = L.esri.query({ url: PARCELS_FS });
    q.contains(center).run((err, fc) => {
      if (parcelHighlight) map.removeLayer(parcelHighlight);
      if (!err && fc && fc.features && fc.features.length) {
        parcelHighlight = L.geoJSON(fc, { style: { color: '#ffd54f', weight: 3, fillOpacity: 0 } }).addTo(map);
      }
    });
  }
})
.addTo(map);

// ---- Final: auto-fit to what loaded
setTimeout(() => {
  const layers = [buildingsLayer, parcelsLayer, zoningLayer].filter(Boolean);
  if (layers.length) {
    let bb = null;
    layers.forEach(Lyr => { if (Lyr.getLayers && Lyr.getLayers().length) bb = bb ? bb.extend(Lyr.getBounds()) : Lyr.getBounds(); });
    if (bb) map.fitBounds(bb, { padding: [20, 20] });
  }
}, 1200);
