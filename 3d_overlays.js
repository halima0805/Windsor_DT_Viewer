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

// Buildings footprints (local fallback -> OSM Overpass)
(function () {
  const BASE = '/Windsor_DT_Viewer';
  const BLD_LOCAL = `${BASE}/data/buildings/windsor_buildings_3d.geojson`;

  function whenMapReady(fn) {
    if (!window.map) return setTimeout(() => whenMapReady(fn), 80);
    const m = window.map;
    if (m.loaded()) fn(m); else m.once('load', () => fn(m));
  }

  function addBuildingsLayer(m, gj) {
    try {
      if (m.getLayer('bld-3d')) m.removeLayer('bld-3d');
      if (m.getSource('bld-src')) m.removeSource('bld-src');
    } catch (_) {}
    m.addSource('bld-src', { type: 'geojson', data: gj });
    m.addLayer({
      id: 'bld-3d',
      type: 'fill-extrusion',
      source: 'bld-src',
      paint: {
        'fill-extrusion-color': '#8fb4d9',
        'fill-extrusion-opacity': 0.9,
        'fill-extrusion-height': [
          'coalesce',
          ['to-number', ['get', 'height_m']],
          6
        ],
        'fill-extrusion-base': 0
      }
    }); // top of stack
  }

  async function tryLocal(m) {
    try {
      const r = await fetch(BLD_LOCAL, { cache: 'no-cache' });
      if (!r.ok) throw new Error('no local buildings file');
      const gj = await r.json();
      const n = Array.isArray(gj.features) ? gj.features.length : 0;
      if (n < 20) throw new Error('sample too small');
      (gj.features || []).forEach(f => {
        const p = f.properties || (f.properties = {});
        if (p.height_m == null) {
          const lv = Number(p['building:levels'] ?? p.levels ?? 2);
          p.height_m = Number.isFinite(lv) ? lv * 3.0 : 6.0;
        }
      });
      addBuildingsLayer(m, gj);
      console.log(`Buildings (local): ${n}`);
      return true;
    } catch (e) {
      console.warn('Local buildings not used:', e.message || e);
      return false;
    }
  }

  async function tryOverpass(m) {
    const b = m.getBounds();
    const s = b.getSouth().toFixed(6), w = b.getWest().toFixed(6),
          n = b.getNorth().toFixed(6), e = b.getEast().toFixed(6);
    const query = `
      [out:json][timeout:180];
      (
        way["building"](${s},${w},${n},${e});
        relation["building"](${s},${w},${n},${e});
      );
      out body; >; out skel qt;
    `;
    const resp = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: 'data=' + encodeURIComponent(query)
    });
    if (!resp.ok) throw new Error('Overpass error');
    const osmJson = await resp.json();
    const gj = osmtogeojson(osmJson, { polygonFeatures: { 'building': true } });
    const n = Array.isArray(gj.features) ? gj.features.length : 0;
    if (!n) throw new Error('No OSM buildings');
    gj.features.forEach(f => {
      const p = f.properties || (f.properties = {});
      const h = Number(p.height);
      const lv = Number(p['building:levels']);
      p.height_m = Number.isFinite(h) ? h : (Number.isFinite(lv) ? lv * 3.0 : 6.0);
    });
    addBuildingsLayer(m, gj);
    console.log(`Buildings (OSM): ${n}`);
  }

  function wireToggle(m) {
    const cb = document.getElementById('lgBuildings');
    if (!cb) return;
    const apply = () => {
      if (!m.getLayer('bld-3d')) return;
      m.setLayoutProperty('bld-3d', 'visibility', cb.checked ? 'visible' : 'none');
    };
    cb.addEventListener('change', apply);
    apply();
  }

  whenMapReady(async (m) => {
    const ok = await tryLocal(m);
    if (!ok) {
      try { await tryOverpass(m); }
      catch (e) { console.warn('OSM buildings failed:', e.message || e); }
    }
    wireToggle(m);
  });
})();
