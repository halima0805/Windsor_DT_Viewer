// ===== Windsor 2D map (Leaflet) =====
const map = L.map('map').setView([43.4806, -72.3851], 13);

// Base map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Overlay groups you already use
const zoningLayer = L.layerGroup().addTo(map);
const floodLayer  = L.layerGroup().addTo(map);

// ---- Zoning (your existing local file)
fetch('axisgis_zoning_live.geojson')
  .then(res => res.json())
  .then(data => {
    const layer = L.geoJSON(data, {
      style: { color: '#3f51b5', weight: 1, fillOpacity: 0.1 },
      onEachFeature: function (feature, layer) {
        const zone = feature.properties?.ZONE || 'N/A';
        layer.bindPopup(`Zoning District: ${zone}`);
      }
    }).addTo(zoningLayer);
    // Fit to zoning if you want an initial view; keep or remove as you prefer
    map.fitBounds(layer.getBounds());
  })
  .catch(err => console.error('Error loading zoning layer:', err));

// ---- Parcels (VCGI statewide; filtered to Windsor)
const PARCELS_URL =
  'https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/FS_VCGI_OPENDATA_Cadastral_VTPARCELS_poly_standardized_parcels_SP_v1/FeatureServer/0';

const parcelsLive = L.esri.featureLayer({
  url: PARCELS_URL,
  where: "UPPER(TNAME) = 'WINDSOR'",            // filter to Windsor only
  fields: ['OBJECTID','TNAME','PARCID','OWNER1','E911ADDR','ACRESGL'], // limit attrs
  minZoom: 11,
  simplifyFactor: 0.5,
  precision: 5,
  style: { color:'#333', weight:1.2, fillOpacity:0 } // crisp tax-map outlines
})
.bindPopup(function (layer) {
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

// Optionally fit once to the Windsor parcel extent (removes guesswork)
L.esri.query({ url: PARCELS_URL })
  .where("UPPER(TNAME) = 'WINDSOR'")
  .bounds((err, bounds) => {
    if (!err && bounds) map.fitBounds(bounds, { padding: [20, 20] });
  });

// ---- Flood (your existing local file)
fetch('flood_zones.geojson')
  .then(res => res.json())
  .then(data => {
    const layer = L.geoJSON(data, {
      style: feature => ({
        color: feature.properties?.FLD_ZONE === 'AE' ? '#f44336' : '#2196f3',
        weight: 1,
        fillOpacity: 0.3
      }),
      onEachFeature: function (feature, layer) {
        const zone = feature.properties?.FLD_ZONE || 'N/A';
        layer.bindPopup(`Flood Zone: ${zone}`);
      }
    }).addTo(floodLayer);
    // Optional: fit; remove if you don't want the map to jump
    // map.fitBounds(layer.getBounds());
  })
  .catch(err => console.error('Error loading flood layer:', err));

// ---- Layer control (use the live parcels layer here)
L.control.layers(null, {
  "Parcels (VCGI live)": parcelsLive,
  "Zoning Districts": zoningLayer,
  "FEMA Flood Zones": floodLayer
}, { collapsed: false }).addTo(map);
