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

// Add toggle layer control
L.control.layers(null, {
  "Zoning Districts": zoningLayer,
  "Parcel Boundaries": parcelsLayer,
  "FEMA Flood Zones": floodLayer
}).addTo(map);
