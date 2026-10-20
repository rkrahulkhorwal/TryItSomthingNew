/* Chronicle animation runtime - maps.
 *
 * Coastlines: Natural Earth land 1:50m (public domain) via world-atlas, projected with d3-geo.
 * Historical territories are hand-traced lon/lat polygons drawn generously over the sea and clipped to land,
 * so only their inland borders need to be right. Approximate, for storytelling - not for an atlas.
 */
(() => {
'use strict';
const { PAL, col, f, pt, clamp, seg, ease, rng, el, path, INK, smooth } = CH;
const ink = PAL.ink;

window.CH_MAP_READY = fetch('/runtime/vendor/world-atlas-land-50m.json').then(r => r.json()).then(topo => {
  CH.LAND = topojson.feature(topo, topo.objects.land);
}).catch(e => CH.errors.push('land data: ' + e));

// ------------------------------------------------------------------------------------------------ places
CH.CITIES = {
  constantinople: [28.98, 41.01], rome: [12.5, 41.9], ravenna: [12.2, 44.42], milan: [9.19, 45.46], venice: [12.33, 45.44],
  florence: [11.25, 43.77], naples: [14.27, 40.85], carthage: [10.32, 36.85], alexandria: [29.92, 31.2], cairo: [31.24, 30.04],
  antioch: [36.16, 36.2], jerusalem: [35.23, 31.78], damascus: [36.3, 33.51], athens: [23.73, 37.98], thessalonica: [22.94, 40.64],
  nicaea: [29.72, 40.43], trebizond: [39.72, 41.0], manzikert: [42.54, 39.14], yarmouk: [35.95, 32.75], moscow: [37.62, 55.75],
  kyiv: [30.52, 50.45], baghdad: [44.36, 33.31], mecca: [39.83, 21.42], medina: [39.6, 24.47], edirne: [26.56, 41.68], adrianople: [26.56, 41.68],
  sofia: [23.32, 42.7], preslav: [26.82, 43.16], ohrid: [20.8, 41.12], mistra: [22.37, 37.07], syracuse: [15.29, 37.07],
  cordoba: [-4.78, 37.88], paris: [2.35, 48.86], aachen: [6.08, 50.78], trier: [6.64, 49.75], london: [-0.13, 51.5],
  byzantion: [28.98, 41.01], byzantium: [28.98, 41.01], bosphorus: [29.05, 41.1], ctesiphon: [44.58, 33.09],
  bursa: [29.06, 40.19], kleidion: [23.05, 41.38], dyrrachium: [19.45, 41.32], acre: [35.07, 32.93], cyprus: [33.2, 35.1], crete: [24.9, 35.2],
  sicily: [14.1, 37.5], genoa: [8.93, 44.41], pisa: [10.4, 43.72], wittenberg: [12.65, 51.87], augsburg: [10.9, 48.37], vienna: [16.37, 48.21],
  sarajevo: [18.41, 43.86], belgrade: [20.46, 44.79], tbilisi: [44.8, 41.7], konya: [32.48, 37.87], iconium: [32.48, 37.87], ankara: [32.85, 39.93],
  smyrna: [27.14, 38.42], ephesus: [27.34, 37.94], pelusium: [32.55, 31.04],
};
CH.place = p => {
  if (Array.isArray(p)) return p;
  const k = String(p || '').toLowerCase().replace(/[^a-z]/g, '');
  return CH.CITIES[k] || null;
};
const cityName = p => (Array.isArray(p) ? '' : String(p));

// view boxes [lon0, lat0, lon1, lat1]; v = the tighter box used for vertical frames
CH.VIEWS = {
  world: { h: [-20, 5, 75, 65], v: [5, 15, 55, 60] },
  europe: { h: [-12, 33, 62, 64], v: [8, 30, 50, 64] },
  empire: { h: [-12, 22, 50, 57], v: [5, 26, 42, 50] },
  mediterranean: { h: [-8, 26, 46, 49], v: [8, 28, 40, 47] },
  east: { h: [10, 27, 46, 47], v: [18, 28, 40, 46] },
  levant: { h: [24, 26, 46, 42], v: [28, 26, 42, 41] },
  balkans: { h: [13, 34, 36, 47.5], v: [17, 34, 32, 47] },
  anatolia: { h: [20, 33, 46, 45], v: [24, 33, 42, 44] },
  aegean: { h: [18, 34, 34, 43.5], v: [20, 34, 31, 43] },
  bosphorus: { h: [24.5, 38.5, 33.5, 43.0], v: [26.8, 38.8, 31.2, 43.2] },
  italy: { h: [3, 35, 24, 47.5], v: [6, 36, 20, 47] },
  north: { h: [10, 36, 60, 62], v: [18, 36, 50, 62] },
  arabia: { h: [18, 12, 62, 42], v: [25, 14, 55, 40] },
};

// territories: lists of rings of [lon, lat]
const R = {};
R.rome_117 = [[[-10, 34], [-11, 36], [-11, 44], [-6, 48], [-5.5, 50], [-4.6, 53], [-5.2, 54.8], [-3.3, 55.05], [-1.5, 55.05], [1, 55], [3, 53], [5, 52.5], [6.5, 51.6], [7.6, 50.5], [8.7, 50.3], [9.6, 49.5], [10.5, 48.9], [12, 48.9], [13.5, 48.5], [16.4, 48.3], [17.6, 48], [18.9, 47.8], [19, 47], [19.2, 45.6], [21, 46.2], [22.5, 47.8], [24.5, 47.8], [25.8, 46.8], [26.5, 45.6], [27.5, 44.4], [28.1, 45.3], [29.7, 45.25], [31, 44.5], [33, 43], [38, 42], [41.5, 41.8], [42.5, 41.4], [43.5, 40.5], [44.5, 39.5], [45, 37.5], [46, 35], [48.5, 31], [48.5, 29.8], [47, 29.5], [39, 30.5], [36.5, 29], [35, 28], [34.5, 27.5], [35.5, 24], [35, 23], [32.9, 22.8], [30, 23], [28.5, 26], [25, 29.5], [20, 30], [15, 31], [11, 31.5], [8.5, 33], [6, 34], [2, 34.6], [-2, 34.6], [-5, 33.5], [-8, 33.5]]];
R.west_395 = [[[-10, 34], [-11, 36], [-11, 44], [-6, 48], [-5.5, 50], [-4.6, 53], [-5.2, 54.8], [-3.3, 55.05], [-1.5, 55.05], [1, 55], [3, 53], [5, 52.5], [6.5, 51.6], [7.6, 50.5], [8.7, 50.3], [9.6, 49.5], [10.5, 48.9], [12, 48.9], [13.5, 48.5], [16.4, 48.3], [17.6, 48], [18.9, 47.8], [19, 47], [19.3, 45.3], [20.5, 44.85], [19.6, 43.5], [19.4, 42], [18.5, 41], [17.9, 39.4], [16.8, 37.4], [15.2, 35.4], [18.5, 33.2], [19.3, 30.4], [15, 31], [11, 31.5], [8.5, 33], [6, 34], [2, 34.6], [-2, 34.6], [-5, 33.5], [-8, 33.5]]];
const EAST_CORE = [[20.5, 44.85], [22.0, 44.6], [22.8, 44.0], [25, 43.65], [26.5, 44.0], [27.6, 44.15], [28.1, 45.3], [29.7, 45.25], [31, 44], [35, 42.6], [38, 41.75], [41.5, 41.6], [42.0, 40.6], [41.3, 39.6], [40.2, 37.9], [39.5, 36.7], [38.7, 35.6], [38.3, 34.6], [37.0, 32.6], [36.5, 30.0], [35, 28], [34.5, 27], [33.3, 24.5], [32.9, 23.0], [30, 23.2], [28.5, 26], [25, 29.5], [20.5, 30.3], [19.3, 30.4]];
R.east_395 = [[...EAST_CORE, [18.6, 33.2], [19.1, 36], [19.3, 39.2], [19.45, 42], [19.6, 43.5]]];
R.byz_565 = [
  [[7.5, 43.8], [6.8, 45], [7.1, 45.9], [8.5, 46.4], [10.4, 46.6], [12.4, 46.6], [13.7, 46.5], [14.5, 46], [16, 45.4], [19, 45], ...EAST_CORE.slice(0, 29), [15, 31], [11, 31.8], [9.5, 32.5], [8.3, 34.2], [6.5, 35.3], [5, 35.6], [3, 36.0], [1.5, 36.25], [2, 37.5], [4, 38.5], [7.4, 41], [8, 43.2]],
  [[-6.6, 36.8], [-5.5, 37.8], [-3.5, 38.0], [-1.5, 38.3], [-0.4, 38.5], [0.5, 38.5], [0.5, 36.5], [-5.6, 35.7], [-7, 36.2]],
];
R.byz_555 = R.byz_565;
R.arab_642 = [[[20.5, 30.3], [20.5, 33], [26, 32.6], [34.2, 33.2], [35.6, 35.9], [36.3, 36.6], [37.5, 36.9], [40, 37.3], [42.5, 37.2], [44.5, 38.5], [48, 38.6], [52, 37.2], [56, 36.4], [60, 34], [61.5, 29], [57, 25.5], [56.5, 23], [59.5, 22], [52, 16], [44, 12.2], [43, 13], [40, 17], [36.6, 22], [34, 24.5], [32.9, 22.0], [25, 22], [24.9, 29.5]]];
R.arab_750 = [[[-10, 31], [-9.5, 36.5], [-9.7, 42.5], [-7.5, 43.6], [-1.7, 43.2], [3, 42.4], [2, 39], [-1, 37.4], [-1.4, 36.6], [1, 36.6], [4, 37.2], [10.4, 37.6], [11.6, 35.6], [15, 32.6], [20.5, 33], [26, 32.6], [34.2, 33.2], [35.6, 35.9], [36.2, 36.7], [38, 37.2], [40.4, 37.6], [42.5, 38.3], [44.5, 39.6], [47, 40], [50, 37.5], [56, 38], [62, 37.5], [67, 37.5], [69, 35], [70, 30], [68, 24], [57, 25.5], [56.5, 23], [59.5, 22], [52, 16], [44, 12.2], [43, 13], [40, 17], [36.6, 22], [33, 23], [25, 22], [15, 24], [5, 27], [-5, 27], [-10, 28]]];
const ANATOLIA = [[26.0, 40.0], [26.2, 41.1], [28.0, 41.6], [29.2, 41.3], [31.5, 41.6], [35, 42.3], [38, 41.75], [41.6, 41.6], [41.6, 40.6], [40.3, 39.4], [38.6, 38.3], [37.2, 37.4], [36.2, 36.8], [35.6, 36.2], [33.5, 35.7], [29, 35.8], [26.5, 36.6], [25.6, 38.5]];
R.byz_717 = [
  [...ANATOLIA, [25.2, 39.6], [24, 39.2], [23, 38.6], [21.5, 37.0], [20.8, 37.4], [21.4, 39.2], [22.3, 40.0], [22.6, 40.9], [24.5, 41.0], [26.0, 41.6], [28.0, 42.0], [28.6, 41.9], [29.2, 41.3]],
  [[12.0, 37.0], [15.8, 36.3], [16.2, 38.0], [17.4, 38.9], [18.6, 40.0], [18.0, 41.0], [16.6, 41.2], [15.6, 41.0], [14.9, 40.4], [16.2, 39.9], [15.5, 38.3], [12.3, 38.3]],
  [[12.1, 44.0], [12.6, 44.0], [12.7, 44.7], [12.0, 44.7]],
  [[8.0, 38.8], [10.0, 38.8], [10.0, 41.3], [8.0, 41.3]],
];
R.byz_1025 = [
  [[19.4, 42], [19.6, 43.5], [19.4, 44.9], [20.5, 44.85], [22.0, 44.6], [22.8, 44.0], [25, 43.65], [26.5, 44.0], [27.6, 44.15], [28.1, 45.3], [29.7, 45.25], [31, 44], [35, 42.6], [38, 41.75], [41.5, 41.6], [43.2, 41.3], [44.6, 40.6], [45.0, 39.4], [43.6, 38.6], [42.2, 37.4], [40.6, 37.0], [39.0, 36.6], [38.0, 35.9], [36.6, 35.4], [35.6, 34.8], [33.0, 34.4], [27.0, 34.4], [23.0, 34.6], [21.0, 36.4], [19.2, 39.3]],
  [[15.3, 37.8], [16.2, 38.0], [17.4, 38.9], [18.6, 40.0], [18.0, 41.0], [15.9, 42.1], [14.9, 41.6], [15.5, 40.6], [15.4, 39.3]],
  [[32.4, 44.2], [34.0, 44.2], [34.0, 45.2], [32.4, 45.2]],
  [[31.8, 34.5], [34.8, 34.5], [34.8, 35.8], [31.8, 35.8]],
];
R.bulgaria_1000 = [[[19.6, 41.0], [19.6, 43.0], [20.2, 44.6], [22.0, 44.6], [22.8, 44.0], [25, 43.65], [26.5, 44.0], [27.6, 44.15], [28.6, 43.7], [27.9, 42.9], [26.6, 42.5], [24.5, 42.0], [23.5, 41.3], [22.2, 40.9], [21.0, 40.3]]];
R.byz_1100 = [
  [[19.4, 42], [19.6, 43.5], [19.4, 44.9], [20.5, 44.85], [22.0, 44.6], [22.8, 44.0], [25, 43.65], [26.5, 44.0], [27.6, 44.15], [28.6, 43.7], [29.6, 42.2], [30.6, 41.3], [30.8, 40.3], [29.4, 39.0], [28.6, 37.6], [27.2, 36.6], [23.0, 34.6], [21.0, 36.4], [19.2, 39.3]],
  [[38, 40.6], [41.6, 40.6], [41.6, 41.6], [38, 41.6]],
  [[31.8, 34.5], [34.8, 34.5], [34.8, 35.8], [31.8, 35.8]],
];
R.seljuk_1092 = [[[30.8, 40.3], [31.5, 41.6], [35, 42.3], [38, 41.4], [41.6, 40.6], [44.6, 40.6], [48, 40], [55, 38], [62, 37.5], [62, 30], [56, 26], [48.5, 29.8], [44, 31], [38.5, 33.2], [36.6, 35.4], [35.6, 36.2], [33.5, 35.7], [29, 35.8], [29.4, 39.0]]];
R.latin_1204 = [
  [[25.8, 40.5], [26.2, 41.6], [28.0, 42.0], [29.2, 41.3], [30.0, 40.9], [29.4, 40.3], [27.2, 40.2], [26.4, 40.1]],
  [[21.2, 36.4], [23.2, 36.4], [23.4, 38.4], [22.4, 39.3], [22.6, 40.9], [21.6, 40.6], [21.5, 38.2]],
];
R.nicaea_1220 = [[[26.2, 38.0], [27.0, 40.2], [29.4, 40.3], [30.6, 41.0], [31.4, 41.0], [32, 39.6], [30.4, 38.0], [28.8, 37.0], [27.0, 36.8]]];
R.byz_1350 = [
  [[27.0, 40.6], [27.4, 41.6], [28.2, 41.6], [29.2, 41.3], [29.0, 40.9], [28.0, 40.8]],
  [[22.5, 40.4], [23.2, 40.4], [23.2, 40.8], [22.5, 40.8]],
  [[21.6, 36.4], [23.2, 36.4], [23.4, 37.8], [22.4, 38.3], [21.5, 37.8]],
];
R.byz_1450 = [
  [[28.4, 40.85], [28.6, 41.25], [29.15, 41.25], [29.15, 40.85]],
  [[21.6, 36.4], [23.2, 36.4], [23.4, 37.8], [22.4, 38.3], [21.5, 37.8]],
];
R.ottoman_1450 = [
  [[19.4, 40.2], [19.6, 42.6], [20.6, 44.6], [22.8, 44.0], [25, 43.65], [26.5, 44.0], [27.6, 44.15], [28.6, 43.7], [28.0, 42.0], [28.5, 41.3], [28.4, 40.85], [29.15, 40.85], [29.3, 41.25], [31.5, 41.6], [35, 42.3], [36, 41.8], [37.5, 41.1], [38.6, 40.0], [38.6, 38.3], [37.2, 37.4], [36.2, 36.8], [33.5, 35.7], [29, 35.8], [26.5, 36.6], [25.6, 38.5], [24.0, 39.0], [23.0, 39.2], [22.2, 39.8], [21.0, 39.6]],
];
R.muscovy_1500 = [[[30.5, 54.0], [30.5, 58.0], [29.5, 60.0], [32, 64], [40, 67], [48, 67.5], [56, 66], [60, 62], [56, 56], [50, 55], [44, 54], [40, 52.5], [36, 52.2], [33, 53]]];
R.kievan_rus = [[[23.5, 50.5], [24, 54], [27, 57.5], [29.5, 60], [33, 61.5], [40, 60], [42, 57], [40, 54], [37, 51], [33, 49.5], [29, 48.5], [25.5, 48.8]]];
R.italy = [[[7.5, 43.8], [6.8, 45], [7.1, 45.9], [8.5, 46.4], [10.4, 46.6], [12.4, 46.6], [13.7, 46.5], [13.9, 45.6], [13.0, 44.5], [14.2, 42.6], [16.4, 41.6], [18.6, 40.4], [18.6, 39.6], [17.2, 38.8], [16.4, 37.6], [15.2, 36.5], [12.2, 37.2], [12.0, 38.6], [15.4, 39.6], [13.0, 41.2], [10.5, 43.0], [9.5, 44.0], [8.2, 43.6]]];
R.persia_600 = [[[38.5, 33.2], [41.5, 37.0], [44.5, 38.5], [44.6, 40.6], [48, 41], [54, 38], [62, 37.5], [67, 37.5], [69, 35], [68, 24], [57, 25.5], [52, 27], [48.5, 29.8], [44, 31]]];
CH.REGIONS = R;

// ------------------------------------------------------------------------------------------------ projection
CH.mapProjection = (view, env, opt = {}) => {
  const V = env.H > env.W;
  const box = Array.isArray(view) ? view : ((CH.VIEWS[view] || CH.VIEWS.mediterranean)[V ? 'v' : 'h']);
  const top = V ? env.H * 0.11 : 0, bottom = V ? env.H * 0.66 : env.H;
  const proj = d3.geoMercator().fitExtent([[0, top], [env.W, bottom]], { type: 'MultiPoint', coordinates: [[box[0], box[1]], [box[2], box[3]]] });
  // fitExtent keeps the box inside the frame; recentre so the box centre is the frame/stage centre
  const c = proj([(box[0] + box[2]) / 2, (box[1] + box[3]) / 2]);
  const [tx, ty] = proj.translate();
  proj.translate([tx + env.W / 2 - c[0], ty + (top + bottom) / 2 - c[1]]);
  proj.clipExtent([[-env.W * 0.6, -env.H * 0.6], [env.W * 1.6, env.H * 1.6]]);
  return proj;
};

const ringPath = (proj, ring, close = true) => {
  const pts = ring.map(p => proj(p));
  return smooth(pts, close, 0.6);
};
const regionPath = (proj, id) => {
  const rings = CH.REGIONS[id];
  if (!rings) { CH.errors.push(`unknown region ${id}`); return ''; }
  return rings.map(r => ringPath(proj, r)).join('');
};
const REGION_ANCHOR = {
  rome_117: [18, 41], west_395: [5, 44], east_395: [33, 38.5], byz_565: [27, 38.5], byz_555: [27, 38.5], arab_642: [38, 30],
  arab_750: [30, 29], byz_717: [31, 39], byz_1025: [28, 40.5], bulgaria_1000: [24.5, 42.8], byz_1100: [24.5, 41.2],
  seljuk_1092: [37, 38.6], latin_1204: [27.5, 41.2], nicaea_1220: [29.5, 39.3], byz_1350: [28, 41.2], byz_1450: [28.6, 41.05],
  ottoman_1450: [31.5, 39.4], muscovy_1500: [42, 59], kievan_rus: [32, 54], italy: [12.5, 43], persia_600: [52, 33],
};
CH.regionAnchor = id => REGION_ANCHOR[id] || (CH.REGIONS[id] ? CH.REGIONS[id][0][0] : [0, 0]);

// ------------------------------------------------------------------------------------------------ map template
/* spec: {view, regions:[{id,color,anim:'static|fade|grow|shrink|conquer|crumble|pulse',from,at,label,dur}],
          cities:[{name,label,pulse,icon,at}], arrows:[{from,to,color,at,dur,bend,mover,label}],
          zoom:{to,k,at,dur}, title, labels:[{text,at:[lon,lat],size}], crack:{from,to,at} } */
CH.T.map = (spec, env) => {
  const W = env.W, H = env.H, V = env.V;
  const proj = CH.mapProjection(spec.view || 'mediterranean', env);
  const gp = d3.geoPath(proj).digits(1);
  const land = CH.LAND ? gp(CH.LAND) : '';
  const uid = 'm' + env.beat.id;
  const regions = (spec.regions || []).filter(r => CH.REGIONS[r.id]);
  const rpaths = regions.map(r => regionPath(proj, r.id));
  const sea = '#a9c7c4', landFill = '#efe0b8';
  const staticInk =
    `<defs><clipPath id="${uid}land"><path d="${land}"/></clipPath></defs>` +
    el('rect', { x: -W, y: -H, width: W * 3, height: H * 3, fill: sea }) +
    path(land, { fill: 'none', stroke: '#8fb3b0', 'stroke-width': 26, 'stroke-linejoin': 'round', opacity: 0.55 }) +
    path(land, { fill: 'none', stroke: '#c9dcd6', 'stroke-width': 12, 'stroke-linejoin': 'round', opacity: 0.8 }) +
    path(land, { fill: landFill, stroke: ink, 'stroke-width': 3.2, 'stroke-linejoin': 'round' });
  const P = name => { const c = CH.place(name); return c ? proj(c) : null; };
  const dur = env.dur;
  const tAt = (x, def) => (x === undefined ? def : (x <= 1 ? x * dur : x));
  // max distance from a point to the frame corners (for radial reveals)
  const farthest = ([x, y]) => Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([a, b]) => Math.hypot(a - x, b - y))) * 1.2;

  const zoom = spec.zoom || null;
  let zTarget = null;
  if (zoom) zTarget = P(zoom.to) || (CH.REGIONS[zoom.to] ? proj(CH.regionAnchor(zoom.to)) : null);

  return {
    focus: [0.5, 0.5],
    drift: 0.03,
    static: () => ({ ink: staticInk }),
    camera: ctx => {
      if (!zoom || !zTarget) return CH.defaultCamera({ focus: [0.5, 0.5], drift: 0.03 }, ctx);
      const a = tAt(zoom.at, 0.15 * dur), d = zoom.dur || Math.min(1.6, dur * 0.6);
      const q = ease.inOut(seg(ctx.t, a, a + d));
      const k = zoom.k || 2.2;
      const from = zoom.from === 'target' ? [zTarget[0], zTarget[1], k] : [W / 2, V ? H * 0.385 : H / 2, 1];
      const to = zoom.from === 'target' ? [W / 2, V ? H * 0.385 : H / 2, 1] : [zTarget[0], zTarget[1], k];
      return { x: CH.lerp(from[0], to[0], q), y: CH.lerp(from[1], to[1], q), z: CH.lerp(from[2], to[2], q) * (1 + 0.02 * ctx.p) };
    },
    draw: ctx => {
      const t = ctx.t;
      let s = '', defs = '';
      regions.forEach((r, i) => {
        const c = col(r.color || PAL.purple);
        const at = tAt(r.at, 0), d = r.dur || Math.max(0.6, Math.min(1.8, dur * 0.55));
        const q = seg(t, at, at + d);
        const anim = r.anim || 'static';
        let fill = c, op = 0.78, extra = '';
        let mask = '';
        if (anim === 'fade') op *= ease.out(q);
        if (anim === 'grow' || anim === 'conquer') {
          const o = P(r.from) || proj(CH.regionAnchor(r.id));
          const rad = farthest(o) * ease.inOut(q);
          defs += `<mask id="${uid}mk${i}"><rect x="${-W}" y="${-H}" width="${W * 3}" height="${H * 3}" fill="black"/>${el('circle', { cx: o[0], cy: o[1], r: Math.max(0.1, rad), fill: 'white' })}</mask>`;
          mask = `url(#${uid}mk${i})`;
          if (q > 0 && q < 1) extra += el('circle', { cx: o[0], cy: o[1], r: Math.max(0.1, rad), fill: 'none', stroke: c, 'stroke-width': 6, opacity: 0.5, 'clip-path': `url(#${uid}land)` });
        }
        if (anim === 'shrink') {
          const o = P(r.from) || [W * 0.9, H * 0.6];
          const rad = farthest(o) * ease.inOut(q);
          defs += `<mask id="${uid}mk${i}"><rect x="${-W}" y="${-H}" width="${W * 3}" height="${H * 3}" fill="white"/>${el('circle', { cx: o[0], cy: o[1], r: Math.max(0.1, rad), fill: 'black' })}</mask>`;
          mask = `url(#${uid}mk${i})`;
        }
        if (anim === 'crumble') { fill = CH.mix(c, '#5a5048', ease.out(q)); op = 0.78 * (1 - 0.35 * q); }
        if (anim === 'pulse') extra += path(rpaths[i], { fill: 'none', stroke: c, 'stroke-width': 10 + 6 * Math.sin(t * 5), opacity: 0.5, 'clip-path': `url(#${uid}land)` });
        if (op <= 0.001) return;
        let body = path(rpaths[i], { fill, opacity: f(op) }) + path(rpaths[i], { fill: 'url(#hatchLight)' }) +
          path(rpaths[i], { fill: 'none', stroke: CH.shade(c, -0.45), 'stroke-width': 4, 'stroke-dasharray': '14 9', opacity: f(Math.min(1, op + 0.2)) });
        if (anim === 'crumble' && q > 0) {
          const rr = rng(i + 3);
          for (let k = 0; k < 14; k++) {
            const a = CH.regionAnchor(r.id), pp = proj([a[0] + (rr() - 0.5) * 16, a[1] + (rr() - 0.5) * 9]);
            const fall = ease.in(clamp(q * 1.6 - rr() * 0.6)) * 160;
            body += el('rect', { x: pp[0], y: pp[1] + fall, width: 16, height: 12, fill: '#6a5f55', ...INK(2), opacity: f(1 - clamp(q * 1.6 - rr() * 0.6)), transform: `rotate(${f(fall)} ${f(pp[0])} ${f(pp[1] + fall)})` });
          }
          body += path(rpaths[i], { fill: 'url(#hatch)', opacity: f(q * 0.8) });
        }
        s += `<g clip-path="url(#${uid}land)"${mask ? ` mask="${mask}"` : ''}>${body}</g>${extra}`;
      });
      // crack (e.g. the 395 split)
      if (spec.crack) {
        const a = P(spec.crack.from), b = P(spec.crack.to);
        if (a && b) {
          const at = tAt(spec.crack.at, 0.1 * dur), q = seg(t, at, at + 0.8);
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
          s += CH.crack(a[0], a[1], len, ang, q, 5, { w: 9 });
        }
      }
      // labels for regions
      regions.forEach((r, i) => {
        if (!r.label) return;
        const at = tAt(r.at, 0) + (r.dur || Math.min(1.2, dur * 0.4)) * 0.5;
        const pp0 = proj(r.labelAt || CH.regionAnchor(r.id));
        const pp = [clamp(pp0[0], W * 0.16, W * 0.84), clamp(pp0[1], V ? H * 0.16 : H * 0.1, V ? H * 0.62 : H * 0.9)];
        const pq = CH.pop(t, at, 0.4);
        if (pq.q <= 0) return;
        const c = col(r.color || PAL.purple);
        s += CH.text(r.label, { kind: 'title', size: V ? 50 : 46, fill: '#fff6e0', stroke: CH.shade(c, -0.45), x: pp[0], y: pp[1], s: pq.s, opacity: pq.o, maxW: V ? W * 0.8 : W * 0.4, lines: 2 });
      });
      // arrows with movers
      (spec.arrows || []).forEach((a, i) => {
        const A = P(a.from), B = P(a.to);
        if (!A || !B) return;
        const at = tAt(a.at, 0.15 * dur), d = a.dur || Math.min(1.4, dur * 0.5);
        const q = ease.inOut(seg(t, at, at + d));
        if (q <= 0) return;
        const bend = a.bend === undefined ? 0.18 : a.bend;
        s += CH.arrow(A[0], A[1], B[0], B[1], { p: q, color: a.color || PAL.red, w: V ? 14 : 12, bend });
        if (a.mover && q > 0.02) {
          const [mx, my, ang] = CH.arrowPoint(A[0], A[1], B[0], B[1], Math.min(q, 0.97), bend);
          s += mover(a.mover, mx, my, t, ang, V ? 0.34 : 0.28);
        }
        if (a.label && q > 0.5) {
          const [lx, ly] = CH.arrowPoint(A[0], A[1], B[0], B[1], 0.5, bend);
          s += CH.plate(a.label, { size: V ? 34 : 28, x: lx, y: ly - 75, opacity: clamp((q - 0.5) * 4) });
        }
      });
      // cities
      (spec.cities || []).forEach((c, i) => {
        const p = P(c.name);
        if (!p) return;
        const at = tAt(c.at, 0.05 * dur);
        const pq = CH.pop(t, at, 0.35);
        if (pq.q <= 0) return;
        const sz = c.big ? 1.4 : 1;
        if (c.pulse) {
          const u = (t * 0.9) % 1;
          s += el('circle', { cx: p[0], cy: p[1], r: (14 + u * 50) * sz, fill: 'none', stroke: col(c.color || PAL.red), 'stroke-width': 5, opacity: f(1 - u) });
        }
        if (c.icon) s += CH.icon(c.icon, p[0], p[1] - 70 * sz, 0.5 * sz * pq.s, t);
        else s += `<g transform="${CH.tr(p[0], p[1], pq.s)}">${el('circle', { r: 11 * sz, fill: col(c.color || PAL.red), ...INK(4) })}${el('circle', { r: 4 * sz, fill: '#fff6e0' })}</g>`;
        if (c.label !== false) {
          const name = c.label || cityName(c.name).toUpperCase();
          const dy = c.below ? 46 * sz : -44 * sz - (c.icon ? 100 * sz : 0);
          const lw = CH.measure(name, 'label', (V ? 32 : 27) * sz) / 2 + 30;
          s += CH.plate(name, { size: (V ? 32 : 27) * sz, x: clamp(p[0] + (c.dx || 0), lw, W - lw), y: p[1] + dy, s: pq.s, opacity: pq.o });
        }
      });
      (spec.labels || []).forEach(l => {
        const p = P(l.at) || [W / 2, H / 2];
        const pq = CH.pop(t, tAt(l.t, 0.2 * dur), 0.35);
        if (pq.q > 0) s += CH.text(l.text, { kind: l.kind || 'title', size: l.size || (V ? 46 : 40), x: p[0], y: p[1], s: pq.s, opacity: pq.o, fill: l.fill || '#fff6e0', stroke: l.stroke || ink, maxW: W * 0.5 });
      });
      let hud = '';
      if (spec.title) {
        const pq = CH.pop(t, 0.1, 0.4);
        hud += CH.plate(spec.title, { kind: spec.titleKind || 'label', size: V ? 48 : 44, x: W / 2, y: V ? H * 0.155 : H * 0.085, s: pq.s, opacity: pq.o, accent: spec.date ? PAL.red : null });
      }
      return { ink: (defs ? `<defs>${defs}</defs>` : '') + s, hud };
    },
  };
};

function mover(kind, x, y, t, ang, k) {
  const flip = Math.cos(ang) < 0 ? -1 : 1;
  switch (kind) {
    case 'ship': case 'fleet': return CH.ship(x, y + 10, k * 0.55, t, { f: flip, flag: PAL.purple });
    case 'army': return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(k)})">${[-60, 0, 60].map((dx, i) => CH.person({ x: dx, y: 60 + (i % 2) * 14, s: 0.55, f: flip, hat: 'helmet', body: 'armor', pose: 'walk', prop: 'spear', seed: i + 3, lod: 1 }, t)).join('')}</g>`;
    case 'horse': return CH.horse(x, y + 30, k * 0.5, t, { f: flip, fill: '#6a4426', rider: { hat: 'cap', body: 'tunic', robe: PAL.green, pose: 'raise', prop: 'spear' } });
    case 'book': case 'books': return CH.icon('book', x, y, k * 0.42, t, {});
    case 'scroll': return CH.icon('scroll', x, y, k * 0.42, t, {});
    case 'crown': case 'parcel': return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(k)}) rotate(${f(Math.sin(t * 6) * 8)})">${el('rect', { x: -60, y: -46, width: 120, height: 92, rx: 6, fill: '#c9a26a', ...INK(5) })}${path('M-60,0L60,0M0,-46L0,46', { stroke: PAL.red, 'stroke-width': 8 })}${kind === 'crown' ? CH.icon('crown', 0, -86, 0.45, 0) : ''}</g>`;
    case 'rat': return CH.icon('rat', x, y, k * 0.45, t, {});
    case 'cross': return CH.icon('cross', x, y, k * 0.4, t, {});
    case 'eagle': return CH.icon('eagle', x, y, k * 0.4, t, {});
    case 'letters': return CH.icon('letters', x, y, k * 0.4, t, {});
    default: return el('circle', { cx: x, cy: y, r: 14, fill: PAL.red, ...INK(4) });
  }
}
CH.mover = mover;

// ------------------------------------------------------------------------------------------------ Constantinople plan
/* A stylised plan of the city (not to scale), designed in a 1000 x 600 box. show: walls, seawalls, chain, camp,
   fleet, overland, cannons, breach, siege (ring of attackers), greekfire, city (buildings), labels */
CH.T.cityplan = (spec, env) => {
  const W = env.W, H = env.H, V = env.V, dur = env.dur;
  const show = new Set(spec.show || ['walls', 'seawalls', 'city', 'labels']);
  // design space -> screen
  const k = V ? 1.25 : Math.min(W / 1000, H / 600) * 1.02;
  const ox = V ? W / 2 - 470 * k : (W - 1000 * k) / 2, oy = V ? H * 0.40 - 270 * k : (H - 600 * k) / 2;
  const S = (x, y) => [ox + x * k, oy + y * k];
  const D = pts => smooth(pts.map(p => S(...p)), true, 0.8);
  const Dopen = pts => smooth(pts.map(p => S(...p)), false, 0.8);
  const europe = [[-400, -300], [770, -300], [760, -60], [745, 80], [735, 190], [745, 262], [660, 236], [560, 196], [470, 168], [380, 150], [340, 158], [420, 196], [520, 232], [620, 268], [712, 300], [732, 340], [700, 382], [600, 404], [480, 418], [380, 430], [250, 440], [100, 452], [-400, 470]];
  const asia = [[840, -300], [1500, -300], [1500, 900], [1100, 520], [980, 470], [880, 420], [835, 360], [828, 260], [836, 120], [850, -60]];
  const tAt = (x, def) => (x === undefined ? def : x <= 1 ? x * dur : x);
  const stat =
    el('rect', { x: -W, y: -H, width: W * 3, height: H * 3, fill: '#a9c7c4' }) +
    path(D(europe), { fill: '#efe0b8', ...INK(4.5) }) + path(D(asia), { fill: '#efe0b8', ...INK(4.5) });
  const wallPts = [[350, 156], [338, 240], [326, 330], [318, 432]];
  const seaPts = [[350, 156], [470, 196], [600, 250], [712, 300], [722, 345], [690, 380], [560, 400], [430, 420], [318, 432]];
  return {
    focus: spec.focus || [0.55, 0.5], drift: 0.04,
    static: () => ({ ink: stat }),
    draw: ctx => {
      const t = ctx.t;
      let s = '';
      s += CH.waves(W, H, -H, t * 0.6, 3, { rows: 10 }).replace('opacity="0.75"', 'opacity="0.35"');
      if (show.has('city')) {
        const r = rng(7);
        for (let i = 0; i < 70; i++) {
          const x = 360 + r() * 330, y = 190 + r() * 220;
          if (y < 150 + (x - 340) * 0.36 + 30 || y > 418 - (x - 340) * 0.05 || (x > 640 && y > 360)) continue;
          const [X, Y] = S(x, y);
          s += CH.house(X, Y, 22 * k, 16 * k, { roof: r() < 0.5 ? '#b5532f' : '#c46a3d' });
        }
        const [hx, hy] = S(655, 330);
        s += CH.hagiaSophia(hx, hy, 0.17 * k, { minarets: spec.minarets ? 1 : 0 });
        if (show.has('labels')) s += CH.plate('CONSTANTINOPLE', { size: 30 * k, x: S(520, 300)[0], y: S(520, 300)[1] });
      }
      if (show.has('seawalls')) s += path(Dopen(seaPts), { fill: 'none', stroke: PAL.stone2, 'stroke-width': 9 * k, 'stroke-linecap': 'round' }) + path(Dopen(seaPts), { fill: 'none', ...INK(2.5) });
      if (show.has('walls')) {
        const q = ease.out(seg(t, tAt(spec.wallsAt, 0), tAt(spec.wallsAt, 0) + 1.2));
        const d = Dopen(wallPts);
        for (const [w, c] of [[30, ink], [24, PAL.stone], [10, PAL.stone2]]) s += path(d, { fill: 'none', stroke: c, 'stroke-width': w * k, 'stroke-linecap': 'round', ...CH.draw(q) });
        for (let i = 0; i <= 8 && q >= 1; i++) {
          const u = i / 8, [x, y] = S(CH.lerp(350, 318, u), CH.lerp(156, 432, u));
          s += el('rect', { x: x - 12 * k, y: y - 12 * k, width: 24 * k, height: 24 * k, fill: PAL.stone, ...INK(3) });
        }
        if (show.has('labels')) s += CH.plate(spec.wallsLabel || 'LAND WALLS', { size: 26 * k, x: S(250, 120)[0], y: S(250, 120)[1], opacity: q });
      }
      if (show.has('breach')) {
        const q = seg(t, tAt(spec.breachAt, 0.4 * dur), tAt(spec.breachAt, 0.4 * dur) + 0.6);
        if (q > 0) { const [bx, by] = S(331, 290); s += CH.burst(bx, by, 90 * k, tAt(spec.breachAt, 0.4 * dur), t); s += el('circle', { cx: bx, cy: by, r: 22 * k * ease.out(q), fill: '#3a2f2a', ...INK(3) }); s += CH.smoke(bx, by, 0.5 * k, t, 3, 5); }
      }
      if (show.has('chain')) {
        const [ax, ay] = S(712, 296), [bx, by] = S(722, 222);
        s += CH.chain(ax, ay, bx, by, { sag: 10 * k });
        if (show.has('labels')) s += CH.plate('CHAIN', { size: 24 * k, x: S(790, 250)[0], y: S(790, 250)[1] });
        const [gx, gy] = S(690, 200);
        s += CH.tower(gx, gy, 30 * k, 60 * k) + (show.has('labels') ? CH.plate('GALATA', { size: 20 * k, x: gx - 70 * k, y: gy - 30 * k }) : '');
      }
      if (show.has('camp')) {
        const r = rng(11);
        for (let i = 0; i < 16; i++) { const [x, y] = S(150 + r() * 140, 160 + r() * 260); s += CH.tent(x, y, 0.32 * k, { stripe: r() < 0.5 ? PAL.red : PAL.green }); }
        if (show.has('labels')) s += CH.plate('OTTOMAN CAMP', { size: 24 * k, x: S(200, 470)[0], y: S(200, 470)[1] });
      }
      if (show.has('cannons')) {
        const fa = tAt(spec.fireAt, 0.25 * dur);
        for (const [x, y, d] of [[268, 230, 0], [262, 320, 0.35], [272, 400, 0.7]]) {
          const [X, Y] = S(x, y);
          s += CH.cannon(X, Y, 0.16 * k, t, { fireAt: fa + d, ball: true });
        }
      }
      if (show.has('fleet')) {
        for (let i = 0; i < 6; i++) { const [x, y] = S(800 + (i % 2) * 18, 40 + i * 52); s += CH.ship(x, y, 0.13 * k, t, { flag: col(spec.fleetColor || PAL.red), seed: i, f: -1 }); }
      }
      if (show.has('siege')) {
        const r = rng(4);
        for (let i = 0; i < 26; i++) { const a = Math.PI * (0.62 + r() * 0.72), rr = 330 + r() * 50; const [x, y] = S(560 + Math.cos(a) * rr * 0.75, 300 + Math.sin(a) * rr * 0.55); s += CH.person({ ...CH.castMember({ who: spec.besieger || 'arab' }), x, y, s: 0.12 * k, pose: 'walk', lod: 0, seed: i }, t); }
      }
      if (show.has('greekfire')) {
        const [x, y] = S(600, 470);
        s += CH.ship(x, y, 0.22 * k, t, { siphon: true, fire: clamp(seg(t, 0.4, 1.0) * 1.2), flag: PAL.purple, f: 1 });
        const [ex, ey] = S(820, 500);
        s += CH.ship(ex, ey, 0.2 * k, t, { flag: PAL.green, burning: t > 1.0, f: -1, seed: 4 });
      }
      if (show.has('overland')) {
        const route = [[800, 120], [730, 92], [640, 96], [570, 130], [520, 178]];
        const d = Dopen(route);
        const at = tAt(spec.overlandAt, 0.1 * dur), q = seg(t, at, at + Math.max(1.6, dur * 0.7));
        s += path(d, { fill: 'none', stroke: '#8a5a33', 'stroke-width': 16 * k, 'stroke-linecap': 'round', opacity: 0.55 });
        s += path(d, { fill: 'none', ...INK(3), 'stroke-dasharray': `${f(10 * k)} ${f(12 * k)}` });
        // logs
        for (let i = 0; i <= 12; i++) { const u = i / 12, p = pathPoint(route, u); const [X, Y] = S(...p); s += el('rect', { x: X - 10 * k, y: Y - 2 * k, width: 20 * k, height: 4 * k, rx: 2, fill: '#6a4426' }); }
        for (let j = 0; j < 5; j++) {
          const u = clamp(q * 1.25 - j * 0.12);
          if (u <= 0) continue;
          const p = pathPoint(route, u), p2 = pathPoint(route, Math.min(1, u + 0.02));
          const [X, Y] = S(...p), fl = p2[0] < p[0] ? -1 : 1;
          s += CH.ship(X, Y - 6 * k, 0.12 * k, t, { flag: PAL.red, f: fl, seed: j, oars: false });
        }
        if (show.has('labels')) s += CH.plate(spec.overlandLabel || 'SHIPS OVER LAND', { size: 26 * k, x: S(500, 60)[0], y: S(500, 60)[1], accent: PAL.red });
        s += CH.plate('GOLDEN HORN', { size: 20 * k, x: S(430, 205)[0], y: S(430, 205)[1], opacity: 0.85 });
      }
      if (show.has('labels')) {
        s += CH.plate('BOSPHORUS', { size: 22 * k, x: S(800, -20)[0], y: S(800, -20)[1], opacity: 0.85 });
        s += CH.plate('SEA OF MARMARA', { size: 22 * k, x: S(520, 520)[0], y: S(520, 520)[1], opacity: 0.85 });
      }
      let hud = '';
      if (spec.title) { const pq = CH.pop(t, 0.1, 0.4); hud += CH.plate(spec.title, { size: V ? 44 : 44, x: V ? W / 2 : W * 0.8, y: V ? H * 0.635 : H * 0.92, s: pq.s, opacity: pq.o, accent: PAL.red }); }
      return { ink: s, hud };
    },
  };
};
function pathPoint(pts, u) {               // point at fraction u along a polyline
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); total += l; }
  let d = clamp(u) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) { const q = segs[i] ? d / segs[i] : 0; return [CH.lerp(pts[i][0], pts[i + 1][0], q), CH.lerp(pts[i][1], pts[i + 1][1], q)]; }
    d -= segs[i];
  }
  return pts[pts.length - 1];
}
CH.pathPoint = pathPoint;
})();
