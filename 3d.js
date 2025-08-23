// Free basemap
const STYLE_URL = 'https://demotiles.maplibre.org/style.json';

// Buildings GeoJSON 
const BUILDINGS_URL = '/Windsor_DT_Viewer/data/buildings/windsor_buildings_3d.geojson';

// Camera
const CENTER  = [-72.3851, 43.4806];
const ZOOM    = 14.3;
const PITCH   = 65;
const BEARING = -20;

const map = new maplibregl.Map({
  container: 'map3d',
  style: STYLE_URL,
  center: CENTER,
  zoom: ZOOM,
  pitch: PITCH,
  bearing: BEARING,
  antialias: true
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

map.on('load', () => {
  // Terrain (no key)
  map.addSource('terrain', {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    tileSize: 256,
    encoding: 'terrarium',
    maxzoom: 15
  });
  map.setTerrain({ source: 'terrain', exaggeration: 1.2 });

  map.addLayer({ id:'hillshade', type:'hillshade', source:'terrain',
    paint:{ 'hillshade-exaggeration': 0.3 }});
  map.addLayer({ id:'sky', type:'sky', paint:{
    'sky-type':'atmosphere',
    'sky-atmosphere-sun':[0,0],
    'sky-atmosphere-sun-intensity':10
  }});

  // Buildings (extruded)
  fetch(BUILDINGS_URL, { cache: 'no-cache' })
    .then(r => r.ok ? r.json() : Promise.reject('HTTP '+r.status))
    .then(gj => {
      (gj.features||[]).forEach(f=>{
        const p=f.properties||(f.properties={});
        if (p.height_m==null) p.height_m = Number(p.floors||p.levels||2)*3; // fallback
      });
      map.addSource('bldg', { type:'geojson', data: gj });
      map.addLayer({ id:'bldg-outline', type:'line', source:'bldg',
        paint:{ 'line-color':'#0c2038', 'line-width':0.4 }});
      map.addLayer({ id:'bldg-extrude', type:'fill-extrusion', source:'bldg',
        paint:{
          'fill-extrusion-color':'#8fb4d9',
          'fill-extrusion-opacity':0.9,
          'fill-extrusion-height':['coalesce',['to-number',['get','height_m']],6],
          'fill-extrusion-base':0
        }});
    })
    .catch(err => console.warn('Buildings skipped:', err));
});
