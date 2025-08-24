// 3d_overlays.js — add Windsor overlays on top of the existing 3D map
(function waitForMap() {
  if (!window.map) return setTimeout(waitForMap, 50);
  const map = window.map;

  const BASE          = '/Windsor_DT_Viewer';
  const ZONING_LOCAL  = `${BASE}/data/zoning_layers/axisgis_zoning_live.geojson`;
  const OVERLAY_LOCAL = `${BASE}/data/zoning_layers/windsor_zoning_overlay.geojson`;
  const PARCELS_URL =
    'https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/FS_VCGI_OPENDATA_Cadastral_VTPARCELS_poly_standardized_parcels_SP_v1/FeatureServer/0';
  const FEMA_URL =
    'https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_EMERGENCY_SP_NOCACHE_v2/MapServer/57';

  function addOverlays() {
    // --- Parcels (VCGI, Windsor only)
    (async () => {
      try {
        const where = "UPPER(TNAME) = 'WINDSOR'";
        const outFields = ['OBJECTID','TNAME','PARCID','OWNER1','E911ADDR','ACRESGL'].join(',');
        const url = `${PARCELS_URL}/query?where=${encodeURIComponent(where)}&outFields=${encodeURIComponent(outFields)}&outSR=4326&f=geojson`;
        const gj = await fetch(url, { cache: 'no-cache' }).then(r => r.json());
        map.addSource('parcels-gj', { type: 'geojson', data: gj });
        map.addLayer({
          id: 'parcels-line',
          type: 'line',
          source: 'parcels-gj',
          paint: { 'line-color': '#333', 'line-width': 1.2 }
        });
      } catch (e) { console.warn('Parcels load failed:', e); }
    })();

    // --- Zoning (local)
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

    // --- Zoning Overlay (local)
    (async () => {
      try {
        const gj = await fetch(OVERLAY_LOCAL, { cache: 'no-cache' }).then(r => r.json());
        map.addSource('zoning-overlay', { type: 'geojson', data: gj });
        map.addLayer({
          id: 'overlay-fill',
          type: 'fill',
          source: 'zoning-overlay',
          paint: { 'fill-color': '#9c27b0', 'fill-opacity': 0.15 }
        });
        map.addLayer({
          id: 'overlay-line',
          type: 'line',
          source: 'zoning-overlay',
          paint: { 'line-color': '#9c27b0', 'line-width': 2, 'line-dasharray': [4, 2] }
        });
      } catch (e) { console.warn('Overlay load failed:', e); }
    })();

    // --- FEMA Flood (ANR, clipped to current view once)
    (async () => {
      try {
        const b = map.getBounds();
        const env = {
          xmin: b.getWest(), ymin: b.getSouth(), xmax: b.getEast(), ymax: b.getNorth(),
          spatialReference: { wkid: 4326 }
        };
        const params =
          `where=1%3D1&outFields=${encodeURIComponent('FLD_ZONE,SFHA_TF')}` +
          `&geometry=${encodeURIComponent(JSON.stringify(env))}` +
          `&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outSR=4326&f=geojson`;
        const gj = await fetch(`${FEMA_URL}/query?${params}`, { cache: 'no-cache' }).then(r => r.json());
        map.addSource('fema-flood', { type: 'geojson', data: gj });
        map.addLayer({
          id: 'fema-fill',
          type: 'fill',
          source: 'fema-flood',
          paint: {
            'fill-color': ['case', ['==', ['get', 'FLD_ZONE'], 'AE'], '#d32f2f', '#1976d2'],
            'fill-opacity': 0.20
          }
        });
        map.addLayer({
          id: 'fema-line',
          type: 'line',
          source: 'fema-flood',
          paint: { 'line-color': '#1976d2', 'line-width': 1 }
        });
      } catch (e) { console.warn('FEMA load failed:', e); }
    })();

    // --- Checkbox wiring for overlays
    const setVis = (id, on) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); };
    const wire = (elId, ids) => {
      const el = document.getElementById(elId);
      if (!el) return;
      const apply = () => ids.forEach(id => setVis(id, el.checked));
      el.addEventListener('change', apply);
      apply(); // initial
    };
    wire('lgParcels', ['parcels-line']);
    wire('lgZoning',  ['zoning-fill','zoning-line']);
    wire('lgOverlay', ['overlay-fill','overlay-line']);
    wire('lgFlood',   ['fema-fill','fema-line']);
  }

  if (map.isStyleLoaded && map.isStyleLoaded()) addOverlays();
  else map.on('load', addOverlays);
})();
