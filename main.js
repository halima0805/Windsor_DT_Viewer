const map = L.map('map').setView([43.4806, -72.3851], 13);

// Add OpenStreetMap base layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Define empty layer groups
const zoningLayer = L.layerGroup().addTo(map);
const parcelsLayer = L.layerGroup().addTo(map);
const floodLayer = L.layerGroup().addTo(map);
const anrLandUnitsLayer = L.layerGroup().addTo(map);

// Load Zoning Layer
fetch('axisgis_zoning_live.geojson')
  .then(res => res.json())
  .then(data => {
    const layer = L.geoJSON(data, {
      style: {
        color: '#3f51b5',
        weight: 1,
        fillOpacity: 0.1
      },
      onEachFeature: function (feature, layer) {
        const zone = feature.properties?.ZONE || 'N/A';
        layer.bindPopup(`Zoning District: ${zone}`);
      }
    }).addTo(zoningLayer);
    map.fitBounds(layer.getBounds());
  })
  .catch(err => console.error('Error loading zoning layer:', err));

// Load Parcels Layer
fetch('parcels.geojson')
  .then(res => res.json())
  .then(data => {
    const layer = L.geoJSON(data, {
      style: {
        color: '#ff9800',
        weight: 1,
        fillOpacity: 0.05
      },
      onEachFeature: function (feature, layer) {
        const owner = feature.properties?.OwnerName || 'N/A';
        layer.bindPopup(`Parcel Owner: ${owner}`);
      }
    }).addTo(parcelsLayer);
    map.fitBounds(layer.getBounds());
  })
  .catch(err => console.error('Error loading parcels layer:', err));

// Load Flood Zones Layer
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
    map.fitBounds(layer.getBounds());
  })
  .catch(err => console.error('Error loading flood layer:', err));

// Load ANR Land Units (static GeoJSON)
fetch('data/anr/anr_land_units.geojson')   // <-- make sure this path matches your repo
  .then(res => {
    if (!res.ok) throw new Error('ANR HTTP ' + res.status);
    return res.json();
  })
  .then(data => {
    const layer = L.geoJSON(data, {
      style: { color: '#006d2c', weight: 1.6, fillOpacity: 0.08 },
      onEachFeature: function (feature, layer) {
        const p = feature.properties || {};
        const unit = p.Unit || p.UNIT || p.NAME || p.Name || 'ANR Unit';
        const dept = p.ANRDept || p.Department || p.DEPT || '';
        layer.bindPopup(
          `<div style="font:13px system-ui"><b>${unit}</b>${dept ? `<br>${dept}` : ''}</div>`
        );
      }
    }).addTo(anrLandUnitsLayer);
  })
  .catch(err => console.error('Error loading ANR Land Units:', err));

const anrLandUnitsLive = L.esri.featureLayer({
  url: 'https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_CADASTRAL_SP_NOCACHE_v2/MapServer/38',
  minZoom: 8,
  simplifyFactor: 0.5,
  precision: 5,
  style: { color: '#006d2c', weight: 1.6, fillOpacity: 0.08 }
})
.bindPopup(l => {
  const p = l.feature?.properties || {};
  const unit = p.Unit || p.UNIT || p.NAME || p.Name || 'ANR Unit';
  const dept = p.ANRDept || p.Department || p.DEPT || '';
  return `<div style="font:13px system-ui"><b>${unit}</b>${dept ? `<br>${dept}` : ''}</div>`;
})
.addTo(map);

// Add toggle layer control
L.control.layers(null, {
  "Zoning Districts": zoningLayer,
  "Parcel Boundaries": parcelsLayer,
  "FEMA Flood Zones": floodLayer
  "ANR Land Units": anrLandUnitsLayer
}).addTo(map);
