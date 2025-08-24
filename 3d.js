// Windsor 3D terrain + 2D layers in 3D (MapLibre)

const BASE   = '/Windsor_DT_Viewer';
const CENTER = [-72.3851, 43.4806];

// local files (paths match your repo)
const ZONING_LOCAL  = `${BASE}/data/zoning_layers/axisgis_zoning_live.geojson`;
const OVERLAY_LOCAL = `${BASE}/data/zoning_layers/windsor_zoning_overlay.geojson`;
const BUILDINGS_3D  = `${BASE}/data/buildings/windsor_buildings_3d.geojson`;

// live services
const PARCELS_URL =
  'https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/FS_VCGI_OPENDATA_Cadastral_VTPARCELS_poly_standardized_parcels_SP_v1/FeatureServer/0';
const FEMA_URL =
  'https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_EMERGENCY_SP_NOCACHE_v2/MapServer/57';

// minimal raster basemap (OSM)
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
  layers: [{ id: 'osm', type: 'raster', source: 'osm', layout: { visibility: 'visible' } }]
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

// ---------------- terrain with fallback + base toggles ----------------
map.on('load', () => {
  // add DEM helper
  function addDEM({ id, tiles, encoding, maxzoom = 15, exaggeration = 6 }) {
    if (map.getSource('terrain-dem')) map.removeSource('terrain-dem');
    map.addSource('terrain-dem', { type: 'raster-dem', tiles: [tiles], tileSize: 256, maxzoom, encoding });
    map.setTerrain({ source: 'terrain-dem', exaggeration });

    if (!map.getLayer('hillshade')) {
      map.addLayer({
        id: 'hillshade',
        type: 'hillshade',
        source: 'terrain-dem',
        layout: { visibility: 'visible' },
        paint: { 'hillshade-exaggeration': 0.8 }
      });
    }
    if (!map.getSource('esri-sat')) {
      map.addSource('esri-sat', {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19
      });
      map.addLayer({ id: 'satellite', type: 'raster', source: 'esri-sat', layout: { visibility: 'none' } });
    }
    map.setSky({ 'sun': [0, 90], 'sun-intensity': 8, 'sky-type': 'atmosphere' });
  }

  // try MapLibre demo (terrain-RGB, encoding=mapbox)
  addDEM({
    id: 'MapLibre demo',
    tiles: 'https://demotiles.maplibre.org/terrain-tiles/{z}/{x}/{y}.png',
    encoding: 'mapbox',
    maxzoom: 14,
    exaggeration: 6
  });

  // fallback to AWS Terrarium (encoding=terrarium) if not loaded quickly
  let demLoaded = false;
  const onSource = (e) => {
    if (e.sourceId === 'terrain-dem' && map.isSourceLoaded('terrain-dem')) {
      demLoaded = true;
      map.off('sourcedata', onSource);
    }
  };
  map.on('sourcedata', onSource);
  setTimeout(() => {
    if (!demLoaded) {
      map.off('sourcedata', onSource);
      addDEM({
        id: 'AWS Terrarium',
        tiles: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
        encoding: 'terrarium',
        maxzoom: 15,
        exaggeration: 6
      });
    }
  }, 4000);

  // base UI toggles (from your 3d.html)
  const toggleSat   = document.getElementById('toggleSat');
  const toggleShade = document.getElementById('toggleShade');
  function applyBase() {
    const satOn = toggleSat && toggleSat.checked;
    map.setLayoutProperty('satellite', 'visibility', satOn ? 'visible' : 'none');
    map.setLayoutProperty('osm',       'visibility', satOn ? 'none'    : 'visible');
  }
  if (toggleSat) { applyBase(); toggleSat.addEventListener('change', applyBase); }
  if (toggleShade) {
    const setShade = () => map.setLayoutProperty('hillshade', 'visibility', toggleShade.checked ? 'visible' : 'none');
    setShade();
    toggleShade.addEventListener('change', setShade);
  }

  // ---------------- layers (same datasets as 2D) ----------------

  // Parcels (VCGI live; Windsor)
  (async () => {
    try {
      const where = "UPPER(TNAME) = 'WINDSOR'";
      const outFields = 'TNAME,PARCID,OWNER1,E911ADDR,ACRESGL';
      const q = `${PARCELS_URL}/query?where=${encodeURIComponent(where)}&outFields=${encodeURIComponent(outFields)}&outSR=4326&f=geojson`;
      const gj = await fetch(q, { cache: 'no-cache' }).then(r => r.json());
      map.addSource('parcels-gj', { type: 'geojson', data: gj });
      map.addLayer({
        id: 'parcels-line',
        type: 'line',
        source: 'parcels-gj',
        paint: { 'line-color': '#333', 'line-width': 1.2 }
      });
    } catch (e) { console.warn('Parcels load failed:', e); }
  })();

  // Zoning (local)
  (async () => {
    try {
      const gj = await fetch(ZONING_LOCAL, { cache: 'no-cache' }).then(r => r.json());
      map.addSource('zoning', { type: 'geojson', data: gj });
      map.addLayer({
        id: 'zoning-fill',
        type: 'fill',
        source: 'zoning',
        paint: { 'fill-color': '#3f51b5', 'fill-opacity': 0.10 }
      });
      map.addLayer({
        id: 'zoning-line',
        type: 'line',
        source: 'zoning',
        paint: { 'line-color': '#3f51b5', 'line-width': 1 }
      });
    } catch (e) { console.warn('Zoning load failed:', e); }
  })();

  // Zoning Overlay (local)
  (async () => {
    try {
      const gj = await fetch(OVERLAY_LOCAL, { cache: 'no-cache' }).then(r => r.json());
      map.addSource('zoning-overlay', { type: 'geojson', data: gj });
      map.addLayer({
        id: 'zoning-overlay-fill',
        type: 'fill',
        source: 'zoning-overlay',
        paint: { 'fill-color': '#9c27b0', 'fill-opacity': 0.15 }
      });
      map.addLayer({
        id: 'zoning-overlay-line',
        type: 'line',
        source: 'zoning-overlay',
        paint: { 'line-color': '#9c27b0', 'line-width': 2, 'line-dasharray': [4, 2] }
      });
    } catch (e) { console.warn('Zoning overlay load failed:', e); }
  })();

  // FEMA Flood (ANR live; clipped to current view)
  (async () => {
    try {
      const b = map.getBounds();
      const envelope = {
        xmin: b.getWest(), ymin: b.getSouth(), xmax: b.getEast(), ymax: b.getNorth(),
        spatialReference: { wkid: 4326 }
      };
      const params =
        `where=1%3D1&outFields=${encodeURIComponent('FLD_ZONE,SFHA_TF')}` +
        `&geometry=${encodeURIComponent(JSON.stringify(envelope))}` +
        `&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outSR=4326&f=geojson`;
      const url = `${FEMA_URL}/query?${params}`;
      const gj = await fetch(url, { cache: 'no-cache' }).then(r => r.json());
      map.addSource('fema-flood', { type: 'geojson', data: gj });
      map.addLayer({
        id: 'fema-flood-fill',
        type: 'fill',
        source: 'fema-flood',
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'FLD_ZONE'], 'AE'], '#d32f2f',
            '#1976d2'
          ],
          'fill-opacity': 0.20
        }
      });
      map.addLayer({
        id: 'fema-flood-line',
        type: 'line',
        source: 'fema-flood',
        paint: { 'line-color': '#1976d2', 'line-width': 1 }
      });
    } catch (e) { console.warn('FEMA flood load failed:', e); }
  })();

  // optional buildings extrusion if your file exists
  (async () => {
    try {
      const gj = await fetch(BUILDINGS_3D, { cache: 'no-cache' }).then(r => {
        if (!r.ok) throw new Error('buildings file missing');
        return r.json();
      });
      (gj.features || []).forEach(f => {
        const p = f.properties || (f.properties = {});
        if (p.height_m == null) {
          const lv = Number(p['building:levels'] ?? p.levels ?? 2);
          p.height_m = lv * 3.0;
        }
      });
      map.addSource('windsor-buildings', { type: 'geojson', data: gj });
      map.addLayer({
        id: 'windsor-buildings-3d',
        type: 'fill-extrusion',
        source: 'windsor-buildings',
        paint: {
          'fill-extrusion-color': '#8fb4d9',
          'fill-extrusion-opacity': 0.9,
          'fill-extrusion-height': [
            'coalesce',
            ['to-number', ['get', 'height_m']],
            ['*', 3, ['coalesce',
              ['to-number', ['get', 'levels']],
              ['to-number', ['get', 'building:levels']],
              2
            ]]
          ],
          'fill-extrusion-base': 0
        }
      });
    } catch (_) { /* ignore if missing */ }
  })();

  // ---------------- layer checkboxes wiring ----------------
  const lgParcels = document.getElementById('lgParcels');
  const lgZoning  = document.getElementById('lgZoning');
  const lgOverlay = document.getElementById('lgOverlay');
  const lgFlood   = document.getElementById('lgFlood');

  function setVis(ids, show) {
    ids.forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', show ? 'visible' : 'none');
    });
  }

  function applyLayerToggles() {
    setVis(['parcels-line'], !!(lgParcels && lgParcels.checked));
    setVis(['zoning-fill', 'zoning-line'], !!(lgZoning && lgZoning.checked));
    setVis(['zoning-overlay-fill', 'zoning-overlay-line'], !!(lgOverlay && lgOverlay.checked));
    setVis(['fema-flood-fill', 'fema-flood-line'], !!(lgFlood && lgFlood.checked));
  }

  [lgParcels, lgZoning, lgOverlay, lgFlood].forEach(el => {
    if (el) el.addEventListener('change', applyLayerToggles);
  });

  // apply once after a short delay so layers exist
  setTimeout(applyLayerToggles, 800);
});
