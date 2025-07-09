var map = L.map('map').setView([43.4806, -72.3851], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

fetch('axisgis_zoning_live.geojson')
  .then(response => response.json())
  .then(data => {
    L.geoJSON(data).addTo(map);
  })
  .catch(error => {
    console.error('Error loading GeoJSON:', error);
  });
