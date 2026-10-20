/* Chronicle animation runtime - the world: skies, land, sea, architecture, effects, vehicles, icons, bubbles. */
(() => {
'use strict';
const { PAL, col, f, pt, clamp, seg, ease, rng, hash, noise, el, path, INK, smooth, poly } = CH;
const ink = PAL.ink;

// ------------------------------------------------------------------------------------------------ layout
/* Stage geometry per aspect. Vertical frames keep the top 11 % for the header and 0.69-0.82 H for captions. */
CH.L = env => {
  const W = env.W, H = env.H, V = H > W;
  return {
    W, H, V, cx: W / 2,
    gy: V ? H * 0.665 : H * 0.84,            // ground line for standing characters
    top: V ? H * 0.12 : H * 0.06,             // first usable y
    cy: V ? H * 0.40 : H * 0.48,              // visual centre of the stage
    k: V ? 1.22 : 1.0,                        // character scale
    titleY: V ? H * 0.2 : H * 0.15,
    labelY: V ? H * 0.6 : H * 0.88,
  };
};
CH.fmtNum = n => {
  const neg = n < 0; n = Math.abs(n);
  const s = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + s;
};

// ------------------------------------------------------------------------------------------------ sky
const SKIES = {
  day: ['#a9d3e2', '#f1ead2'], dawn: ['#f2b98a', '#f6e4c2'], dusk: ['#d9774c', '#f3c98d'], night: ['#24304a', '#4a5578'],
  fire: ['#c4482a', '#f0a050'], storm: ['#6f7e8c', '#c3c5bb'], gold: ['#f0c66e', '#fbefcc'], plain: ['#efe2c4', '#efe2c4'],
  desert: ['#f2c27a', '#f8e6bd'], dark: ['#3a2f3a', '#6b5560'], sepia: ['#d8c49a', '#efe2c4'],
};
CH.SKIES = Object.keys(SKIES);
CH.skyStatic = (W, H, kind = 'day', id = 'sky') => {
  const [a, b] = SKIES[kind] || SKIES.day;
  let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;
  s += el('rect', { x: -60, y: -60, width: W + 120, height: H + 120, fill: `url(#${id})` });
  if (kind === 'night') {
    const r = rng(5);
    for (let i = 0; i < 70; i++) s += el('circle', { cx: r() * W, cy: r() * H * 0.6, r: 1 + r() * 2.2, fill: '#fff6d8', opacity: 0.5 + r() * 0.5 });
  }
  return s;
};
CH.sun = (x, y, r, t, o = {}) => {
  const c = col(o.color || '#f7d36a');
  let s = '';
  const n = 14, rot = t * (o.spin || 6);
  let rays = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rot * Math.PI / 180, a2 = a + Math.PI / n * 0.45;
    rays += `M${pt(x + Math.cos(a) * r * 1.25, y + Math.sin(a) * r * 1.25)}L${pt(x + Math.cos(a2) * r * 1.9, y + Math.sin(a2) * r * 1.9)}`;
  }
  s += path(rays, { stroke: c, 'stroke-width': r * 0.16, 'stroke-linecap': 'round', opacity: 0.85 });
  s += el('circle', { cx: x, cy: y, r, fill: c, ...INK(4.5) });
  if (o.moon) s = el('circle', { cx: x, cy: y, r, fill: '#f6efd8', ...INK(4) }) + el('circle', { cx: x + r * 0.35, cy: y - r * 0.2, r: r * 0.85, fill: SKIES.night[0] });
  return s;
};
CH.cloud = (x, y, s, o = {}) => {
  const d = `M${pt(x - 90 * s, y)}C${pt(x - 110 * s, y - 40 * s)} ${pt(x - 60 * s, y - 60 * s)} ${pt(x - 36 * s, y - 44 * s)}` +
    `C${pt(x - 30 * s, y - 90 * s)} ${pt(x + 40 * s, y - 92 * s)} ${pt(x + 46 * s, y - 48 * s)}` +
    `C${pt(x + 90 * s, y - 64 * s)} ${pt(x + 120 * s, y - 20 * s)} ${pt(x + 92 * s, y)}Z`;
  return path(d, { fill: col(o.fill || '#fbf6ea'), ...INK(4 * Math.min(1.2, s + 0.3)), opacity: o.opacity || 1 });
};
CH.clouds = (W, H, t, seed, n = 4, y0 = 0.08, y1 = 0.3, o = {}) => {
  const r = rng(seed);
  let s = '';
  for (let i = 0; i < n; i++) {
    const sc = 0.6 + r() * 0.7, speed = 8 + r() * 14;
    const span = W + 400;
    const x = ((r() * span + t * speed) % span) - 200;
    s += CH.cloud(x, H * (y0 + r() * (y1 - y0)), sc, o);
  }
  return s;
};

// ------------------------------------------------------------------------------------------------ land & sea
CH.hills = (W, H, y, seed, o = {}) => {
  const r = rng(seed), amp = o.amp || 40, n = o.n || 6;
  const pts = [[-80, y]];
  for (let i = 0; i <= n; i++) pts.push([(i / n) * (W + 160) - 80, y - r() * amp]);
  pts.push([W + 80, y]);
  const d = smooth(pts, false, 1) + `L${W + 80},${H + 80}L-80,${H + 80}Z`;
  return path(d, { fill: col(o.fill || PAL.green), ...INK(o.sw || 5) });
};
CH.ground = (W, H, y, o = {}) => {
  let s = el('rect', { x: -80, y, width: W + 160, height: H - y + 80, fill: col(o.fill || PAL.sand) });
  s += path(`M-80,${f(y)}L${W + 80},${f(y)}`, INK(5));
  const r = rng(o.seed || 3);
  if (o.tufts !== false) for (let i = 0; i < (o.n || 16); i++) {
    const x = r() * W, yy = y + 14 + r() * (H - y - 20) * 0.5;
    s += path(`M${pt(x - 10, yy)}Q${pt(x - 6, yy - 12)} ${pt(x - 2, yy - 16)}M${pt(x, yy)}L${pt(x + 1, yy - 18)}M${pt(x + 9, yy)}Q${pt(x + 7, yy - 10)} ${pt(x + 4, yy - 14)}`, { fill: 'none', ...INK(2.5), opacity: 0.45 });
  }
  return s;
};
CH.floor = (W, H, y, o = {}) => {             // indoor floor with tiles
  let s = el('rect', { x: -80, y, width: W + 160, height: H - y + 80, fill: col(o.fill || '#c9b48a') });
  s += path(`M-80,${f(y)}L${W + 80},${f(y)}`, INK(5));
  const n = 14;
  for (let i = -n; i <= n * 2; i++) s += path(`M${pt(W / 2 + i * 60, y)}L${pt(W / 2 + i * 160, H + 80)}`, { stroke: ink, 'stroke-width': 2, opacity: 0.18 });
  for (let k = 1; k < 6; k++) { const yy = y + (H - y) * (k * k) / 36; s += path(`M-80,${f(yy)}L${W + 80},${f(yy)}`, { stroke: ink, 'stroke-width': 2, opacity: 0.18 }); }
  return s;
};
CH.seaStatic = (W, H, y, o = {}) => {
  const c = col(o.fill || PAL.sea);
  return el('rect', { x: -80, y, width: W + 160, height: H - y + 80, fill: c }) +
    el('rect', { x: -80, y: y + (H - y) * 0.45, width: W + 160, height: H, fill: CH.shade(c, -0.12), opacity: 0.5 }) +
    path(`M-80,${f(y)}L${W + 80},${f(y)}`, INK(4.5));
};
CH.waves = (W, H, y, t, seed = 1, o = {}) => {
  const r = rng(seed);
  let d = '';
  const rows = o.rows || 6;
  for (let k = 0; k < rows; k++) {
    const yy = y + 18 + (H - y) * (k / rows) * 0.95, sp = (k % 2 ? -1 : 1) * (14 + k * 4);
    for (let i = 0; i < 9; i++) {
      const x = ((r() * (W + 200) + t * sp) % (W + 200) + W + 200) % (W + 200) - 100;
      const w = 30 + r() * 30;
      d += `M${pt(x - w, yy)}Q${pt(x - w / 2, yy - 9)} ${pt(x, yy)}Q${pt(x + w / 2, yy - 9)} ${pt(x + w, yy)}`;
    }
  }
  return path(d, { fill: 'none', stroke: '#e8f1ef', 'stroke-width': 3.5, 'stroke-linecap': 'round', opacity: 0.75 });
};

// ------------------------------------------------------------------------------------------------ architecture
const stone = o => col((o && o.fill) || PAL.stone);
CH.windowArch = (x, y, w, h, c = '#3a2f2a') => path(`M${pt(x - w / 2, y)}L${pt(x - w / 2, y - h + w / 2)}A${f(w / 2)},${f(w / 2)} 0 0 1 ${pt(x + w / 2, y - h + w / 2)}L${pt(x + w / 2, y)}Z`, { fill: c, ...INK(2.5) });
CH.dome = (x, y, w, h, o = {}) => {        // drum + dome + finial; y = base of the drum
  const dh = h * 0.62, drum = h - dh;
  let s = el('rect', { x: x - w * 0.46, y: y - drum, width: w * 0.92, height: drum, fill: stone(o), ...INK(4) });
  for (let i = -2; i <= 2; i++) s += CH.windowArch(x + i * w * 0.17, y - drum * 0.2, w * 0.07, drum * 0.6);
  s += path(`M${pt(x - w / 2, y - drum)}C${pt(x - w / 2, y - drum - dh * 1.3)} ${pt(x + w / 2, y - drum - dh * 1.3)} ${pt(x + w / 2, y - drum)}Z`, { fill: col(o.domeFill || '#9aa7a5'), ...INK(4.5) });
  s += path(`M${pt(x - w * 0.25, y - drum - dh * 0.2)}Q${pt(x - w * 0.18, y - drum - dh * 0.8)} ${pt(x, y - drum - dh * 0.97)}`, { fill: 'none', stroke: '#fff', 'stroke-width': 4, opacity: 0.35, 'stroke-linecap': 'round' });
  if (o.cross !== false) s += path(`M${pt(x, y - drum - dh * 0.96)}l0,${f(-h * 0.22)}M${pt(x - h * 0.06, y - drum - dh * 0.96 - h * 0.15)}l${f(h * 0.12)},0`, INK(4));
  if (o.crescent) s += path(`M${pt(x, y - drum - dh * 0.96)}l0,${f(-h * 0.12)}`, INK(4)) + el('circle', { cx: x, cy: y - drum - dh * 0.96 - h * 0.18, r: h * 0.06, fill: 'none', stroke: PAL.gold, 'stroke-width': 4 });
  return s;
};
CH.house = (x, y, w, h, o = {}) => {
  const roof = col(o.roof || '#b5532f');
  let s = el('rect', { x: x - w / 2, y: y - h, width: w, height: h, fill: col(o.fill || '#ead9b4'), ...INK(4) });
  s += path(`M${pt(x - w / 2 - 8, y - h)}L${pt(x, y - h - w * 0.32)}L${pt(x + w / 2 + 8, y - h)}Z`, { fill: roof, ...INK(4) });
  if (w > 30) s += CH.windowArch(x, y - h * 0.3, Math.min(16, w * 0.22), h * 0.38);
  return s;
};
CH.tower = (x, y, w, h, o = {}) => {
  let s = el('rect', { x: x - w / 2, y: y - h, width: w, height: h, fill: stone(o), ...INK(4.5) });
  const n = 3, cw = w / (2 * n - 1);
  for (let i = 0; i < n; i++) s += el('rect', { x: x - w / 2 + i * 2 * cw, y: y - h - cw * 0.9, width: cw, height: cw * 0.9 + 2, fill: stone(o), ...INK(4) });
  s += CH.windowArch(x, y - h * 0.55, w * 0.18, h * 0.16);
  if (o.flag) s += path(`M${pt(x, y - h - cw)}l0,-50`, INK(4)) + path(`M${pt(x + 2, y - h - cw - 50)}q20,-6 40,4l0,22q-20,-8 -40,-2z`, { fill: col(o.flag), ...INK(3) });
  return s;
};
CH.crenels = (x0, x1, y, size, o = {}) => {
  let s = '';
  for (let x = x0; x < x1 - size * 0.5; x += size * 2) s += el('rect', { x, y: y - size, width: size, height: size + 2, fill: stone(o), ...INK(3.5) });
  return s;
};
/* a city wall with towers; build 0..1 raises it, damage 0..1 knocks holes; y = foot of the wall */
CH.wall = (x0, x1, y, h, o = {}) => {
  const build = o.build === undefined ? 1 : o.build;
  const hh = h * build;
  if (hh <= 1) return '';
  let s = el('rect', { x: x0, y: y - hh, width: x1 - x0, height: hh, fill: stone(o), ...INK(5) });
  const r = rng(o.seed || 9);
  for (let i = 0; i < (x1 - x0) * h / 2600; i++) {
    const bx = x0 + r() * (x1 - x0 - 40), by = y - r() * hh;
    s += path(`M${pt(bx, by)}l${f(26 + r() * 20)},0`, { stroke: ink, 'stroke-width': 2, opacity: 0.25 });
  }
  if (build >= 0.999) s += CH.crenels(x0, x1, y - h, Math.max(10, h * 0.12), o);
  const tw = o.towerW || h * 0.42, gap = o.towerGap || h * 1.5;
  for (let x = x0 + gap * 0.5; x < x1 - tw * 0.5; x += gap) s += CH.tower(x, y, tw, (o.towerH || h * 1.32) * build, o);
  if (o.damage > 0) {
    const holes = Math.ceil(o.damage * 5);
    const r2 = rng((o.seed || 9) + 3);
    for (let i = 0; i < holes; i++) {
      const hx = x0 + (0.15 + r2() * 0.7) * (x1 - x0), hy = y - hh * (0.35 + r2() * 0.45), rr = h * (0.12 + r2() * 0.12) * clamp(o.damage * 2 - i * 0.25);
      if (rr > 2) s += path(smooth([...Array(8)].map((_, k) => { const a = k / 8 * Math.PI * 2; return [hx + Math.cos(a) * rr * (0.7 + r2() * 0.5), hy + Math.sin(a) * rr * (0.7 + r2() * 0.5)]; })), { fill: '#3a2f2a', ...INK(4) });
    }
  }
  return s;
};
CH.column = (x, y, h, o = {}) => {
  const w = o.w || h * 0.09;
  let s = el('rect', { x: x - w / 2, y: y - h, width: w, height: h, fill: col(o.fill || '#e8dcc0'), ...INK(4) });
  for (let i = 1; i < 4; i++) s += path(`M${pt(x - w / 2 + i * w / 4, y - h + 6)}L${pt(x - w / 2 + i * w / 4, y - 6)}`, { stroke: ink, 'stroke-width': 1.8, opacity: 0.35 });
  s += el('rect', { x: x - w * 0.8, y: y - h - w * 0.35, width: w * 1.6, height: w * 0.35, fill: col(o.fill || '#e8dcc0'), ...INK(3.5) });
  s += el('rect', { x: x - w * 0.75, y: y - w * 0.3, width: w * 1.5, height: w * 0.3, fill: col(o.fill || '#e8dcc0'), ...INK(3.5) });
  return s;
};
CH.temple = (x, y, w, h, o = {}) => {         // Roman temple; collapse 0..1 topples it
  const c = o.collapse || 0, r = rng(o.seed || 4);
  let s = el('rect', { x: x - w / 2 - 10, y: y - h * 0.08, width: w + 20, height: h * 0.08, fill: '#e8dcc0', ...INK(4.5) });
  const n = o.n || 6;
  for (let i = 0; i < n; i++) {
    const cx = x - w / 2 + w * (i + 0.5) / n;
    const fall = clamp(c * 1.6 - r() * 0.6), rot = (r() < 0.5 ? -1 : 1) * 80 * ease.in(fall);
    const drop = ease.bounce(fall) * h * 0.1;
    s += `<g transform="rotate(${f(rot)} ${f(cx)} ${f(y - h * 0.08)}) translate(0 ${f(drop)})">${CH.column(cx, y - h * 0.08, h * 0.66, { w: w / n * 0.42 })}</g>`;
  }
  const top = y - h * 0.08 - h * 0.66 - h * 0.05;
  const rf = ease.in(clamp(c * 1.4 - 0.2));
  const roof = `M${pt(x - w / 2 - 14, top)}L${pt(x + w / 2 + 14, top)}L${pt(x + w / 2 + 14, top - h * 0.07)}L${pt(x, top - h * 0.24)}L${pt(x - w / 2 - 14, top - h * 0.07)}Z`;
  s += `<g transform="translate(0 ${f(rf * h * 0.55)}) rotate(${f(rf * 9)} ${f(x)} ${f(top)})">${path(roof, { fill: '#efe3c8', ...INK(4.5) })}${path(`M${pt(x - w * 0.3, top - h * 0.07)}L${pt(x, top - h * 0.19)}L${pt(x + w * 0.3, top - h * 0.07)}`, { fill: 'none', ...INK(2.5), opacity: 0.6 })}</g>`;
  return s;
};
CH.cypress = (x, y, h, o = {}) => path(`M${pt(x, y - h)}C${pt(x + h * 0.16, y - h * 0.7)} ${pt(x + h * 0.14, y - h * 0.2)} ${pt(x + h * 0.05, y)}L${pt(x - h * 0.05, y)}C${pt(x - h * 0.14, y - h * 0.2)} ${pt(x - h * 0.16, y - h * 0.7)} ${pt(x, y - h)}Z`, { fill: col(o.fill || '#3f5e34'), ...INK(4) });
CH.palm = (x, y, h, t = 0) => {
  let s = path(`M${pt(x, y)}Q${pt(x + h * 0.12, y - h * 0.5)} ${pt(x + h * 0.04, y - h)}`, { fill: 'none', stroke: ink, 'stroke-width': h * 0.08 + 4, 'stroke-linecap': 'round' });
  s += path(`M${pt(x, y)}Q${pt(x + h * 0.12, y - h * 0.5)} ${pt(x + h * 0.04, y - h)}`, { fill: 'none', stroke: '#9b7148', 'stroke-width': h * 0.08 - 2, 'stroke-linecap': 'round' });
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.55 + Math.sin(t * 2 + i) * 0.04, L = h * 0.45;
    const ex = x + h * 0.04 + Math.cos(a) * L, ey = y - h + Math.sin(a) * L * 0.6 + L * 0.25;
    s += path(`M${pt(x + h * 0.04, y - h)}Q${pt((x + ex) / 2, y - h - L * 0.3)} ${pt(ex, ey)}Q${pt((x + ex) / 2 + 8, y - h - L * 0.1)} ${pt(x + h * 0.04, y - h)}Z`, { fill: PAL.green, ...INK(3) });
  }
  return s;
};
CH.tent = (x, y, s, o = {}) => {
  const c = col(o.fill || '#d8c7a0'), c2 = col(o.stripe || PAL.red);
  return path(`M${pt(x - 70 * s, y)}L${pt(x, y - 90 * s)}L${pt(x + 70 * s, y)}Z`, { fill: c, ...INK(4) }) +
    path(`M${pt(x - 18 * s, y)}L${pt(x, y - 90 * s)}L${pt(x + 18 * s, y)}Z`, { fill: c2, ...INK(3) }) +
    path(`M${pt(x, y - 90 * s)}l0,${f(-26 * s)}`, INK(3)) + path(`M${pt(x + 2, y - 116 * s)}l${f(22 * s)},${f(6 * s)}l${f(-22 * s)},${f(8 * s)}z`, { fill: c2, ...INK(2) });
};
CH.hagiaSophia = (x, y, s, o = {}) => {        // y = ground; ~620 x 420 px at s = 1
  const B = o.build === undefined ? 1 : o.build;
  const g = (k, inner) => {                     // staged build-up: each part rises in turn
    const q = clamp(B * 5 - k);
    return q <= 0 ? '' : `<g transform="translate(0 ${f((1 - ease.out(q)) * 60 * s)})" opacity="${f(clamp(q * 2))}">${inner}</g>`;
  };
  const W = 620 * s;
  let st = '';
  st += g(0, el('rect', { x: x - W * 0.5, y: y - 150 * s, width: W, height: 150 * s, fill: '#d9a98a', ...INK(5) }) +
    [...Array(9)].map((_, i) => CH.windowArch(x - W * 0.42 + i * W * 0.105, y - 30 * s, 16 * s, 46 * s)).join(''));
  st += g(1, path(`M${pt(x - W * 0.47, y - 150 * s)}C${pt(x - W * 0.47, y - 250 * s)} ${pt(x - W * 0.14, y - 250 * s)} ${pt(x - W * 0.14, y - 150 * s)}Z`, { fill: '#9aa7a5', ...INK(4.5) }) +
    path(`M${pt(x + W * 0.14, y - 150 * s)}C${pt(x + W * 0.14, y - 250 * s)} ${pt(x + W * 0.47, y - 250 * s)} ${pt(x + W * 0.47, y - 150 * s)}Z`, { fill: '#9aa7a5', ...INK(4.5) }));
  st += g(2, el('rect', { x: x - W * 0.27, y: y - 250 * s, width: W * 0.54, height: 100 * s, fill: '#d9a98a', ...INK(5) }) +
    el('rect', { x: x - W * 0.3, y: y - 262 * s, width: W * 0.08, height: 112 * s, fill: '#cf9b7c', ...INK(4) }) +
    el('rect', { x: x + W * 0.22, y: y - 262 * s, width: W * 0.08, height: 112 * s, fill: '#cf9b7c', ...INK(4) }));
  st += g(3, el('rect', { x: x - W * 0.2, y: y - 286 * s, width: W * 0.4, height: 36 * s, fill: '#d9a98a', ...INK(4.5) }) +
    [...Array(11)].map((_, i) => CH.windowArch(x - W * 0.175 + i * W * 0.035, y - 254 * s, 7 * s, 22 * s)).join(''));
  st += g(4, path(`M${pt(x - W * 0.2, y - 286 * s)}C${pt(x - W * 0.2, y - 420 * s)} ${pt(x + W * 0.2, y - 420 * s)} ${pt(x + W * 0.2, y - 286 * s)}Z`, { fill: '#9aa7a5', ...INK(5) }) +
    path(`M${pt(x - W * 0.1, y - 300 * s)}Q${pt(x - W * 0.08, y - 380 * s)} ${pt(x, y - 386 * s)}`, { fill: 'none', stroke: '#fff', 'stroke-width': 5 * s, opacity: 0.4, 'stroke-linecap': 'round' }) +
    path(`M${pt(x, y - 386 * s)}l0,${f(-34 * s)}M${pt(x - 10 * s, y - 408 * s)}l${f(20 * s)},0`, INK(4)));
  if (o.minarets) {
    for (const mx of [-0.56, -0.44, 0.44, 0.56]) {
      const X = x + W * mx, q = o.minarets === true ? 1 : o.minarets;
      if (q <= 0) continue;
      const mh = 470 * s * ease.out(clamp(q));
      st += el('rect', { x: X - 9 * s, y: y - mh, width: 18 * s, height: mh, fill: '#efe3c8', ...INK(4) }) +
        path(`M${pt(X - 12 * s, y - mh)}L${pt(X, y - mh - 46 * s)}L${pt(X + 12 * s, y - mh)}Z`, { fill: '#8a9a9a', ...INK(3.5) }) +
        el('rect', { x: X - 14 * s, y: y - mh * 0.72, width: 28 * s, height: 8 * s, fill: '#efe3c8', ...INK(3) });
    }
  }
  return st;
};
CH.onionChurch = (x, y, s) => {               // Moscow-style onion domes
  let st = el('rect', { x: x - 120 * s, y: y - 160 * s, width: 240 * s, height: 160 * s, fill: '#efe3c8', ...INK(5) });
  const cols = ['#c0392b', '#2f8f4f', PAL.gold, '#2e6fb0', '#c0392b'];
  [[-90, 210, 0.7], [-45, 270, 0.85], [0, 330, 1.1], [45, 270, 0.85], [90, 210, 0.7]].forEach(([dx, h, k], i) => {
    const X = x + dx * s, top = y - h * s;
    st += el('rect', { x: X - 18 * k * s, y: top + 40 * k * s, width: 36 * k * s, height: (h - 150) * s, fill: '#efe3c8', ...INK(4) });
    st += path(`M${pt(X, top - 46 * k * s)}C${pt(X + 6 * k * s, top - 20 * k * s)} ${pt(X + 40 * k * s, top)} ${pt(X + 24 * k * s, top + 40 * k * s)}L${pt(X - 24 * k * s, top + 40 * k * s)}C${pt(X - 40 * k * s, top)} ${pt(X - 6 * k * s, top - 20 * k * s)} ${pt(X, top - 46 * k * s)}Z`, { fill: cols[i], ...INK(4) });
    st += path(`M${pt(X, top - 46 * k * s)}l0,${f(-22 * s)}M${pt(X - 8 * s, top - 58 * k * s)}l${f(16 * s)},0`, INK(3.5));
  });
  return st;
};
CH.hippodrome = (x, y, w, h, t, o = {}) => {   // seen from above at an angle
  let s = el('ellipse', { cx: x, cy: y, rx: w / 2, ry: h / 2, fill: '#cdb487', ...INK(5) });
  s += el('ellipse', { cx: x, cy: y, rx: w / 2 - 34, ry: h / 2 - 22, fill: '#e2cf9e', ...INK(4) });
  s += el('rect', { x: x - w * 0.3, y: y - 8, width: w * 0.6, height: 16, rx: 8, fill: '#bfa77a', ...INK(3.5) });
  s += path(`M${pt(x - w * 0.15, y - 6)}L${pt(x - w * 0.15 - 8, y - 64)}L${pt(x - w * 0.15 + 8, y - 64)}Z`, { fill: '#d9c6a0', ...INK(3) });
  s += path(`M${pt(x + w * 0.12, y - 6)}l0,-50`, { stroke: ink, 'stroke-width': 9 }) + path(`M${pt(x + w * 0.12, y - 6)}l0,-50`, { stroke: '#c9a74e', 'stroke-width': 4 });
  return s;
};

// ------------------------------------------------------------------------------------------------ effects
CH.flames = (x, y, s, t, seed = 1, n = 3) => {
  let out = '';
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const ox = (i - (n - 1) / 2) * 34 * s, ph = r() * 10, k = (0.75 + r() * 0.5) * s;
    const h = (110 + Math.sin(t * 7 + ph) * 18 + Math.sin(t * 13 + ph) * 8) * k, sw = Math.sin(t * 5 + ph) * 14 * k;
    const X = x + ox;
    out += path(`M${pt(X - 34 * k, y)}C${pt(X - 46 * k, y - h * 0.45)} ${pt(X - 8 * k + sw, y - h * 0.55)} ${pt(X + sw, y - h)}C${pt(X + 12 * k + sw, y - h * 0.6)} ${pt(X + 50 * k, y - h * 0.4)} ${pt(X + 34 * k, y)}Z`, { fill: PAL.fire3, ...INK(3.5) });
    out += path(`M${pt(X - 22 * k, y)}C${pt(X - 28 * k, y - h * 0.35)} ${pt(X - 4 * k + sw * 0.7, y - h * 0.45)} ${pt(X + sw * 0.7, y - h * 0.75)}C${pt(X + 8 * k + sw * 0.7, y - h * 0.45)} ${pt(X + 30 * k, y - h * 0.3)} ${pt(X + 22 * k, y)}Z`, { fill: PAL.fire2 });
    out += path(`M${pt(X - 11 * k, y)}C${pt(X - 14 * k, y - h * 0.2)} ${pt(X + sw * 0.4, y - h * 0.3)} ${pt(X + sw * 0.4, y - h * 0.45)}C${pt(X + 6 * k, y - h * 0.25)} ${pt(X + 15 * k, y - h * 0.18)} ${pt(X + 11 * k, y)}Z`, { fill: PAL.fire1 });
  }
  return out;
};
CH.smoke = (x, y, s, t, seed = 1, n = 6, o = {}) => {
  let out = '';
  const r = rng(seed), life = o.life || 3.2;
  const puffs = [];
  for (let i = 0; i < n; i++) {
    const ph = r() * life, age = ((t + ph) % life) / life, jitter = r();
    puffs.push({ age, jitter, i });
  }
  puffs.sort((a, b) => b.age - a.age);                // old (big, faint) puffs behind young ones
  for (const { age, jitter, i } of puffs) {
    const X = x + Math.sin(age * 3 + i) * 18 * s + age * (o.wind || 60) * s, Y = y - age * (o.rise || 260) * s;
    const R = (26 + age * 72) * s * (0.85 + jitter * 0.3);
    const op = Math.min(1, age * 6) * (1 - age);
    const c = col(o.fill || PAL.smoke);
    out += el('circle', { cx: X, cy: Y, r: R, fill: c, opacity: f(0.82 * op) });
    out += path(`M${pt(X - R * 0.7, Y - R * 0.35)}A${f(R)},${f(R)} 0 0 1 ${pt(X + R * 0.6, Y - R * 0.55)}`, { fill: 'none', stroke: ink, 'stroke-width': 2.5, opacity: f(0.45 * op), 'stroke-linecap': 'round' });
    out += el('circle', { cx: X - R * 0.3, cy: Y - R * 0.3, r: R * 0.35, fill: '#ffffff', opacity: f(0.12 * op) });
  }
  return out;
};
CH.embers = (x, y, w, h, t, seed = 1, n = 30, o = {}) => {
  let out = '';
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const life = 1.8 + r() * 2.2, ph = r() * life, age = ((t + ph) % life) / life;
    const X = x + r() * w + Math.sin(age * 6 + i) * 18, Y = y + h - age * h;
    out += el('circle', { cx: X, cy: Y, r: (1.5 + r() * 3) * (o.k || 1), fill: col(o.fill || '#ffb347'), opacity: f(Math.sin(age * Math.PI)) });
  }
  return out;
};
CH.dust = (W, H, t, seed = 2, n = 40) => {          // floating motes in light
  let out = '';
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const X = (r() * W + t * (6 + r() * 10)) % W, Y = (r() * H + Math.sin(t * 0.6 + i) * 20 + H) % H;
    out += el('circle', { cx: X, cy: Y, r: 1.4 + r() * 2.4, fill: '#fff6d8', opacity: f(0.25 + 0.5 * Math.abs(Math.sin(t * 0.9 + i))) });
  }
  return out;
};
CH.rays = (x, y, r0, r1, t, o = {}) => {
  const n = o.n || 16, rot = t * (o.spin || 5) * Math.PI / 180;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2, w = Math.PI / n * (o.width || 0.55);
    d += `M${pt(x + Math.cos(a - w) * r0, y + Math.sin(a - w) * r0)}L${pt(x + Math.cos(a - w) * r1, y + Math.sin(a - w) * r1)}L${pt(x + Math.cos(a + w) * r1, y + Math.sin(a + w) * r1)}L${pt(x + Math.cos(a + w) * r0, y + Math.sin(a + w) * r0)}Z`;
  }
  return path(d, { fill: col(o.fill || '#fff1c4'), opacity: o.opacity || 0.5 });
};
CH.lightShafts = (x, y, W, H, t, o = {}) => {
  let s = '';
  for (let i = 0; i < (o.n || 5); i++) {
    const a = (o.angle || 18) * Math.PI / 180, ox = x + (i - 2) * W * 0.09, w = W * (0.035 + 0.02 * ((i * 7) % 3));
    const op = 0.12 + 0.08 * Math.sin(t * 1.3 + i * 1.7);
    s += path(`M${pt(ox - w, y)}L${pt(ox + w, y)}L${pt(ox + w + Math.tan(a) * H, y + H)}L${pt(ox - w + Math.tan(a) * H, y + H)}Z`, { fill: '#fff4cf', opacity: f(op) });
  }
  return s;
};
CH.sparkles = (x, y, R, t, seed = 1, n = 8, o = {}) => {
  let s = '';
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = R * (0.4 + r() * 0.7), ph = r() * 6;
    const k = Math.max(0, Math.sin(t * 3 + ph)) * (o.k || 1) * (10 + r() * 10);
    if (k < 1) continue;
    const X = x + Math.cos(a) * d, Y = y + Math.sin(a) * d;
    s += path(`M${pt(X, Y - k)}Q${pt(X, Y)} ${pt(X + k, Y)}Q${pt(X, Y)} ${pt(X, Y + k)}Q${pt(X, Y)} ${pt(X - k, Y)}Q${pt(X, Y)} ${pt(X, Y - k)}Z`, { fill: col(o.fill || '#fff6c8'), stroke: ink, 'stroke-width': 2 });
  }
  return s;
};
CH.fightCloud = (x, y, s, t, seed = 3) => {          // the cartoon brawl cloud
  const r = rng(seed);
  let pts = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, rr = (120 + Math.sin(t * 9 + i * 2.1) * 14 + r() * 26) * s;
    pts.push([x + Math.cos(a) * rr * 1.35, y + Math.sin(a) * rr * 0.8]);
  }
  let out = path(smooth(pts), { fill: '#e9dcc0', ...INK(5) });
  out += path(smooth(pts.map(([px, py]) => [x + (px - x) * 0.7, y + (py - y) * 0.7])), { fill: 'none', ...INK(2.5), opacity: 0.4 });
  for (let i = 0; i < 4; i++) {                       // limbs, swords and stars popping out
    const a = t * 3 + i * 1.7, ex = x + Math.cos(a) * 170 * s, ey = y + Math.sin(a) * 100 * s;
    out += i % 2 ? path(`M${pt(x + Math.cos(a) * 120 * s, y + Math.sin(a) * 70 * s)}L${pt(ex, ey)}`, { stroke: '#e6ebeb', 'stroke-width': 7 * s, 'stroke-linecap': 'round' }) + path(`M${pt(x + Math.cos(a) * 120 * s, y + Math.sin(a) * 70 * s)}L${pt(ex, ey)}`, { fill: 'none', ...INK(2) }) :
      el('circle', { cx: ex, cy: ey, r: 13 * s, fill: PAL.skin, ...INK(3.5) });
  }
  out += CH.sparkles(x, y - 40 * s, 160 * s, t * 2, seed, 6, { fill: PAL.yellow });
  return out;
};
CH.snow = (W, H, t, seed = 4, n = 60) => {
  let s = '';
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const sp = 40 + r() * 60, X = (r() * W + Math.sin(t + i) * 30), Y = (r() * H + t * sp) % (H + 40) - 20;
    s += el('circle', { cx: X, cy: Y, r: 3 + r() * 4, fill: '#fff', stroke: ink, 'stroke-width': 1.5, opacity: 0.9 });
  }
  return s;
};
CH.crack = (x, y, len, ang, p, seed = 1, o = {}) => {
  const r = rng(seed);
  const pts = [[x, y]];
  let cx = x, cy = y;
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = ang + (r() - 0.5) * 1.1;
    cx += Math.cos(a) * len / n; cy += Math.sin(a) * len / n;
    pts.push([cx, cy]);
  }
  const k = Math.max(1, Math.floor(clamp(p) * n) + 1);
  return path(poly(pts.slice(0, k + 1), false), { fill: 'none', ...INK(o.w || 6) });
};
CH.burst = (x, y, R, t0, t, o = {}) => {             // explosion star, fades after ~0.5 s
  const q = seg(t, t0, t0 + 0.5);
  if (q <= 0 || q >= 1) return '';
  const k = ease.out(q), n = 12;
  const pts = [...Array(n * 2)].map((_, i) => { const a = (i / (n * 2)) * Math.PI * 2, rr = (i % 2 ? 0.45 : 1) * R * k; return [x + Math.cos(a) * rr, y + Math.sin(a) * rr]; });
  return path(poly(pts), { fill: col(o.fill || PAL.fire1), ...INK(4), opacity: f(1 - q * q) });
};

// ------------------------------------------------------------------------------------------------ vehicles & machines
/* Byzantine dromon: oared galley with lateen sails; siphon=true adds the Greek-fire nozzle */
CH.ship = (x, y, s, t, o = {}) => {
  const fx = o.f === -1 ? -1 : 1, bob = Math.sin(t * 1.6 + (o.seed || 0)) * 5 * s, roll = Math.sin(t * 1.2 + (o.seed || 0)) * 2;
  const hull = col(o.hull || '#8a5a33'), sail = col(o.sail || '#efe0bd');
  let g = '';
  if (o.oars !== false) {
    for (let i = 0; i < 7; i++) {
      const ox = -130 + i * 40, a = Math.sin(t * 3 + i * 0.4) * 10;
      g += `<g transform="translate(${ox} -6) rotate(${f(30 + a)})">${path('M0,0L0,62', { stroke: ink, 'stroke-width': 7, 'stroke-linecap': 'round' })}${path('M0,0L0,62', { stroke: '#c9a26a', 'stroke-width': 3, 'stroke-linecap': 'round' })}</g>`;
    }
  }
  g += path('M-190,-40Q-170,24 -100,26L120,26Q180,20 210,-50L170,-30L-160,-30Z', { fill: hull, ...INK(5) });
  g += path('M-170,-12L180,-12', { stroke: CH.shade(hull, -0.3), 'stroke-width': 4 });
  for (let i = 0; i < 7; i++) g += el('circle', { cx: -130 + i * 40, cy: -4, r: 5, fill: '#3a2a20' });
  if (o.siphon) g += path('M150,-40L214,-62L218,-50L156,-28Z', { fill: '#b98a2e', ...INK(3.5) }) + el('circle', { cx: 216, cy: -56, r: 9, fill: PAL.gold, ...INK(3) });
  const mast = (mx, h, w) => path(`M${mx},-30L${mx},${-30 - h}`, { stroke: ink, 'stroke-width': 9, 'stroke-linecap': 'round' }) + path(`M${mx},-30L${mx},${-30 - h}`, { stroke: '#9b7148', 'stroke-width': 4 }) +
    path(`M${mx - w},${-40}L${mx + w * 0.2},${-30 - h}Q${mx + w * 0.6},${-30 - h * 0.45} ${mx + w * 0.55},-44Z`, { fill: sail, ...INK(4) });
  g += mast(-40, 200, 110) + mast(90, 150, 80);
  if (o.flag) g += path(`M-40,-230q24,-8 48,4l0,26q-24,-10 -48,-2z`, { fill: col(o.flag), ...INK(3) });
  if (o.emblem) g += CH.emblem(o.emblem, -10, -120, 0.45);
  if (o.burning) g += CH.flames(-20, -30, 0.8, t, o.seed || 3, 3) + CH.smoke(-20, -140, 0.8, t, (o.seed || 3) + 1, 5);
  let fire = '';
  if (o.siphon && o.fire) {                         // Greek fire jet
    const q = clamp(o.fire), L = 420 * q;
    for (let k = 0; k < 3; k++) {
      const w = (22 - k * 6) + Math.sin(t * 20 + k) * 4, c = [PAL.fire3, PAL.fire2, PAL.fire1][k];
      fire += path(`M216,-56Q${f(216 + L * 0.5)},${f(-80 - L * 0.08 + Math.sin(t * 9) * 10)} ${f(216 + L)},${f(-20 + L * 0.12)}`, { fill: 'none', stroke: c, 'stroke-width': w * (1 + q), 'stroke-linecap': 'round', opacity: 0.95 });
    }
  }
  const sink = o.sink || 0;
  return `<g transform="translate(${f(x)} ${f(y + bob + sink * 140 * s)}) scale(${f(s * fx)} ${f(s)}) rotate(${f(roll + sink * 18)})">${g}${fire}</g>`;
};
CH.cannon = (x, y, s, t, o = {}) => {       // Orban's bombard; fireAt = local time of the shot
  const fx = o.f === -1 ? -1 : 1;
  const fa = o.fireAt === undefined ? -9 : o.fireAt, since = t - fa;
  const recoil = since > 0 && since < 0.6 ? Math.sin(Math.min(1, since / 0.6) * Math.PI) * 24 : 0;
  let g = el('rect', { x: -170, y: -10, width: 320, height: 40, rx: 8, fill: '#8a5a33', ...INK(5) });
  g += el('circle', { cx: -110, cy: 34, r: 30, fill: '#6a4426', ...INK(4.5) }) + el('circle', { cx: 90, cy: 34, r: 30, fill: '#6a4426', ...INK(4.5) });
  g += `<g transform="translate(${f(-recoil)} 0) rotate(-8)">` +
    path('M-200,-80L190,-112L200,-112L200,-8L190,-8L-200,-20Z', { fill: '#b3843f', ...INK(5.5) }) +
    [-140, -60, 30, 120].map(xx => el('rect', { x: xx, y: -100 + (xx + 200) * 0.03, width: 22, height: 96 - (xx + 200) * 0.03, fill: '#9c6f31', ...INK(3.5) })).join('') +
    el('ellipse', { cx: 198, cy: -60, rx: 14, ry: 52, fill: '#3a2a20', ...INK(4) }) + '</g>';
  let fx2 = '';
  if (since > 0) {
    fx2 += CH.burst(240, -70, 120, fa, t, { fill: PAL.fire1 });
    const q = clamp(since / 2.5);
    fx2 += CH.smoke(220, -60, 1.2, since * 0.8 + 1, 7, 6, { wind: 120, rise: 120, life: 2.6 });
    if (o.ball !== false && since < 1.2) { const bx = 240 + since * 1400; fx2 += el('circle', { cx: bx, cy: -80 - since * 60, r: 26, fill: '#7d7a72', ...INK(4) }); }
  }
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s * fx)} ${f(s)})">${g}${fx2}</g>`;
};
CH.chain = (x1, y1, x2, y2, o = {}) => {
  const n = Math.max(4, Math.round(Math.hypot(x2 - x1, y2 - y1) / 34)), sag = o.sag || 40;
  let s = '';
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = x1 + (x2 - x1) * u, y = y1 + (y2 - y1) * u + Math.sin(u * Math.PI) * sag;
    s += el('ellipse', { cx: x, cy: y, rx: i % 2 ? 18 : 6, ry: i % 2 ? 9 : 12, fill: 'none', stroke: ink, 'stroke-width': 9 }) +
      el('ellipse', { cx: x, cy: y, rx: i % 2 ? 18 : 6, ry: i % 2 ? 9 : 12, fill: 'none', stroke: PAL.steel, 'stroke-width': 4 });
  }
  return s;
};
CH.horse = (x, y, s, t, o = {}) => {           // galloping cartoon horse (feet at y)
  const fx = o.f === -1 ? -1 : 1, c = col(o.fill || '#a8774f'), gal = o.gallop === false ? 0 : 1;
  const ph = t * 9 + (o.seed || 0), bob = Math.sin(ph * 2) * 5 * gal;
  let g = '';
  const leg = (lx, a) => {
    const kx = Math.sin(ph + a) * 26 * gal, ky = Math.max(0, Math.cos(ph + a)) * 14 * gal;
    return path(`M${lx},-70L${f(lx + kx * 0.5)},-34L${f(lx + kx)},${f(-4 - ky)}`, { fill: 'none', stroke: ink, 'stroke-width': 17, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }) +
      path(`M${lx},-70L${f(lx + kx * 0.5)},-34L${f(lx + kx)},${f(-4 - ky)}`, { fill: 'none', stroke: c, 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  };
  g += leg(-58, 0.6) + leg(48, 2.6);
  g += path(`M-86,-${f(110 - bob)}Q-130,-${f(120 - bob)} -128,-${f(70 - bob)}`, { fill: 'none', stroke: '#3a2a20', 'stroke-width': 12, 'stroke-linecap': 'round' });
  g += el('ellipse', { cx: -10, cy: -100 + bob, rx: 92, ry: 42, fill: c, ...INK(5) });
  g += path(`M50,${f(-118 + bob)}L96,${f(-176 + bob)}L118,${f(-150 + bob)}L80,${f(-96 + bob)}Z`, { fill: c, ...INK(5) });
  g += path(`M90,${f(-182 + bob)}Q140,${f(-190 + bob)} 150,${f(-156 + bob)}Q140,${f(-138 + bob)} 112,${f(-146 + bob)}Z`, { fill: c, ...INK(5) });
  g += el('circle', { cx: 118, cy: -170 + bob, r: 4.5, fill: ink });
  g += path(`M60,${f(-126 + bob)}Q76,${f(-170 + bob)} 92,${f(-186 + bob)}`, { fill: 'none', stroke: '#3a2a20', 'stroke-width': 10, 'stroke-linecap': 'round' });
  g += leg(-40, 3.2) + leg(66, 5.2);
  if (o.saddle) g += path(`M-40,${f(-140 + bob)}Q-10,${f(-120 + bob)} 26,${f(-140 + bob)}L26,${f(-120 + bob)}Q-10,${f(-104 + bob)} -40,${f(-120 + bob)}Z`, { fill: col(o.saddle), ...INK(3.5) });
  let rider = '';
  if (o.rider) rider = CH.person({ ...o.rider, x: -6, y: -116 + bob, s: 0.72, f: 1, pose: o.rider.pose || 'hold' }, t);
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s * fx)} ${f(s)})">${g}${rider}</g>`;
};
CH.chariot = (x, y, s, t, o = {}) => {
  const fx = o.f === -1 ? -1 : 1, c = col(o.color || PAL.bluesTeam);
  let g = CH.horse(150, 0, 0.8, t, { fill: o.horse || '#f2ece0', seed: o.seed });
  const wr = (t * 12) % (Math.PI * 2);
  g += path('M-10,-60L80,-80', INK(6));
  g += path('M-80,-110Q-90,-40 -40,-36L30,-36Q40,-80 20,-110Z', { fill: c, ...INK(5) });
  g += `<g transform="translate(-30 -28) rotate(${f(wr * 57.3)})">${el('circle', { r: 30, fill: '#c9a26a', ...INK(5) })}${path('M-30,0L30,0M0,-30L0,30M-21,-21L21,21M21,-21L-21,21', INK(3))}</g>`;
  g += CH.person({ x: -30, y: -70, s: 0.55, robe: c, hat: 'band', hatColor: c, expr: 'determined', pose: 'hold', seed: o.seed || 2 }, t);
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s * fx)} ${f(s)})">${g}</g>`;
};

// ------------------------------------------------------------------------------------------------ icons (~200 px box at s = 1)
const ICONS = {
  book: (t, o) => `${el('rect', { x: -78, y: -96, width: 150, height: 186, rx: 10, fill: col(o.color || PAL.red2), ...INK(6) })}${el('rect', { x: 62, y: -88, width: 22, height: 172, rx: 6, fill: '#f6ecd0', ...INK(4) })}${el('rect', { x: -48, y: -56, width: 90, height: 40, rx: 4, fill: PAL.gold, ...INK(4) })}${path('M-50,30L40,30M-50,52L20,52', { stroke: PAL.gold, 'stroke-width': 6 })}`,
  scales: (t, o) => { const a = Math.sin(t * 2) * 8; return `${path('M0,-96L0,80M-50,84L50,84', INK(9))}<g transform="rotate(${f(a)})">${path('M-90,-70L90,-70', INK(8))}${path('M-90,-70L-120,0L-60,0ZM90,-70L60,0L120,0Z', { fill: 'none', ...INK(3) })}${path('M-126,0Q-90,34 -54,0Z', { fill: PAL.gold, ...INK(4) })}${path('M54,0Q90,34 126,0Z', { fill: PAL.gold, ...INK(4) })}</g>${el('circle', { cy: -100, r: 12, fill: PAL.gold, ...INK(4) })}`; },
  coin: (t, o) => {
    const spin = o.spin ? Math.cos(t * 3) : 1, dull = o.dull || 0, c = CH.mix(PAL.gold, '#a9a59b', dull);
    let face = '';
    if (Math.abs(spin) > 0.25) face = `<g transform="scale(${f(spin)} 1)">${el('circle', { r: 64, fill: 'none', stroke: CH.shade(c, -0.25), 'stroke-width': 4 })}${CH.person({ x: 0, y: 70, s: 0.42, f: 0, hat: 'crown', body: 'imperial', robe: CH.shade(c, -0.2), skin: CH.shade(c, 0.15), beard: 'short', beardColor: CH.shade(c, -0.3), hairColor: CH.shade(c, -0.3), expr: 'neutral', shadow: false, lod: 1 }, 0)}</g>`;
    return `<g transform="scale(${f(Math.max(0.08, Math.abs(spin)))} 1)">${el('circle', { r: 92, fill: c, ...INK(6) })}${el('circle', { r: 80, fill: 'none', stroke: CH.shade(c, 0.3), 'stroke-width': 4, opacity: 0.8 })}</g>${face}`;
  },
  crown: () => `${path('M-90,50L-100,-50L-50,0L0,-80L50,0L100,-50L90,50Z', { fill: PAL.gold, ...INK(6) })}${el('rect', { x: -94, y: 40, width: 188, height: 30, rx: 8, fill: PAL.gold, ...INK(5) })}${jewelI(0, 55, 10, '#c0392b')}${jewelI(-50, 55, 8, '#2e6fb0')}${jewelI(50, 55, 8, '#2f8f4f')}${el('circle', { cx: 0, cy: -84, r: 10, fill: '#fbf6ea', ...INK(3) })}`,
  eagle: (t, o) => {                                   // heraldic double-headed eagle
    const c = col(o.mono || o.color || PAL.gold), dk = o.mono ? c : CH.shade(c, -0.25), w = Math.sin(t * 2) * 3;
    const wing = sx => {
      const P = (x, y) => `${f(x * sx)},${f(y)}`;
      let g = path(`M${P(24, -28)}C${P(56, -92 - w)} ${P(108, -142 - w)} ${P(156, -134 - w)}L${P(140, -98 - w)}L${P(160, -90 - w)}L${P(136, -58 - w)}L${P(152, -46 - w)}L${P(122, -18 - w)}L${P(134, -4 - w)}L${P(98, 16 - w)}L${P(102, 32)}L${P(58, 34)}Z`, { fill: c, ...INK(5) });
      g += path(`M${P(40, -24)}L${P(140, -98 - w)}M${P(44, -12)}L${P(136, -58 - w)}M${P(46, 2)}L${P(122, -18 - w)}M${P(48, 16)}L${P(98, 16 - w)}`, { fill: 'none', stroke: dk, 'stroke-width': 3, opacity: 0.8 });
      return g;
    };
    const head = sx => `<g transform="scale(${sx} 1)">${path('M10,-34C12,-66 30,-84 50,-90', { fill: 'none', stroke: ink, 'stroke-width': 24, 'stroke-linecap': 'round' })}${path('M10,-34C12,-66 30,-84 50,-90', { fill: 'none', stroke: c, 'stroke-width': 15, 'stroke-linecap': 'round' })}${el('circle', { cx: 58, cy: -96, r: 20, fill: c, ...INK(5) })}${path('M74,-104L100,-96L76,-86Z', { fill: o.mono ? c : '#e0a03a', ...INK(3.5) })}${el('circle', { cx: 63, cy: -100, r: 3.8, fill: ink })}${path('M42,-114L44,-132L51,-123L57,-137L63,-123L70,-132L72,-114Z', { fill: o.mono ? c : PAL.gold, ...INK(3) })}</g>`;
    let s = wing(1) + wing(-1);
    s += path('M-20,64L-46,122L-22,112L-10,132L0,114L10,132L22,112L46,122L20,64Z', { fill: c, ...INK(5) });
    s += path('M-16,58L-34,98M16,58L34,98', { fill: 'none', ...INK(9) }) + path('M-44,96L-34,98L-40,110M-34,98L-26,108M44,96L34,98L40,110M34,98L26,108', { fill: 'none', ...INK(5) });
    s += path('M-26,-38C-36,2 -26,50 0,74C26,50 36,2 26,-38Q0,-50 -26,-38Z', { fill: c, ...INK(5) });
    s += path('M-12,-10L0,0L12,-10M-12,12L0,22L12,12M-10,34L0,44L10,34', { fill: 'none', stroke: dk, 'stroke-width': 3 });
    s += head(1) + head(-1);
    s += path('M-28,-136L-32,-170L-15,-153L0,-180L15,-153L32,-170L28,-136Z', { fill: o.mono ? c : PAL.gold, ...INK(4) });
    if (!o.mono) s += el('circle', { cx: 0, cy: -150, r: 6, fill: '#c0392b', ...INK(2.5) });
    return s;
  },
  scroll: () => `${el('rect', { x: -70, y: -90, width: 140, height: 180, fill: '#f6ecd0', ...INK(6) })}${path('M-44,-50L44,-50M-44,-20L44,-20M-44,10L30,10M-44,40L44,40', INK(4))}${el('rect', { x: -86, y: -106, width: 172, height: 28, rx: 14, fill: '#e2cf9e', ...INK(5) })}${el('rect', { x: -86, y: 78, width: 172, height: 28, rx: 14, fill: '#e2cf9e', ...INK(5) })}`,
  cross: () => path('M0,-100L0,100M-60,-40L60,-40', { stroke: ink, 'stroke-width': 34, 'stroke-linecap': 'round' }) + path('M0,-100L0,100M-60,-40L60,-40', { stroke: PAL.gold, 'stroke-width': 20, 'stroke-linecap': 'round' }),
  rat: (t, o) => { const w = Math.sin(t * 6) * 8; return `${path(`M60,10Q130,${f(-10 + w)} 150,${f(40 + w)}`, { fill: 'none', ...INK(5) })}${path('M-90,20C-90,-50 70,-60 70,20Z', { fill: '#8d8478', ...INK(5) })}${path('M-90,20C-120,10 -130,-10 -110,-30C-90,-30 -80,-10 -70,0Z', { fill: '#8d8478', ...INK(5) })}${el('circle', { cx: -60, cy: -40, r: 18, fill: '#d9a5a0', ...INK(4) })}${el('circle', { cx: -100, cy: -16, r: 4, fill: ink })}${el('circle', { cx: -128, cy: -6, r: 6, fill: '#d9a5a0', ...INK(3) })}${path('M-40,20L-44,40M30,20L34,40', INK(6))}`; },
  skull: () => `${path('M-70,0C-90,-110 90,-110 70,0C70,30 50,40 40,60L-40,60C-50,40 -70,30 -70,0Z', { fill: '#f3ead6', ...INK(6) })}${el('ellipse', { cx: -30, cy: -10, rx: 20, ry: 24, fill: ink })}${el('ellipse', { cx: 30, cy: -10, rx: 20, ry: 24, fill: ink })}${path('M0,20L-10,40L10,40Z', { fill: ink })}${path('M-30,60L-30,80M-10,60L-10,82M10,60L10,82M30,60L30,80', INK(5))}`,
  flask: (t) => `${path('M-24,-100L24,-100L24,-40L80,70Q90,100 60,100L-60,100Q-90,100 -80,70L-24,-40Z', { fill: '#dfe9e8', ...INK(6) })}${path(`M-66,${f(60 + Math.sin(t * 4) * 4)}Q0,${f(40 + Math.sin(t * 4 + 1) * 6)} 66,${f(60 + Math.sin(t * 4) * 4)}L76,86Q80,96 60,96L-60,96Q-80,96 -76,86Z`, { fill: PAL.fire2 })}${el('rect', { x: -32, y: -118, width: 64, height: 22, rx: 6, fill: PAL.brown, ...INK(4) })}${CH.flames(0, -118, 0.35, t, 4, 2)}`,
  lock: () => `${path('M-50,-20L-50,-60Q-50,-110 0,-110Q50,-110 50,-60L50,-20', { fill: 'none', ...INK(16) })}${path('M-50,-20L-50,-60Q-50,-110 0,-110Q50,-110 50,-60L50,-20', { fill: 'none', stroke: PAL.steel, 'stroke-width': 8 })}${el('rect', { x: -80, y: -24, width: 160, height: 124, rx: 14, fill: PAL.gold, ...INK(6) })}${el('circle', { cx: 0, cy: 26, r: 14, fill: ink })}${path('M0,30L0,66', INK(10))}`,
  hourglass: (t) => { const q = (t * 0.3) % 1; return `${path('M-70,-100L70,-100L70,-90Q60,-20 10,0Q60,20 70,90L70,100L-70,100L-70,90Q-60,20 -10,0Q-60,-20 -70,-90Z', { fill: '#e8f0ee', ...INK(6) })}${path(`M${f(-50 + q * 40)},${f(-80 + q * 70)}L${f(50 - q * 40)},${f(-80 + q * 70)}L0,-4Z`, { fill: PAL.sand })}${path(`M${f(-56 * q)},96L${f(56 * q)},96L0,${f(96 - 70 * q)}Z`, { fill: PAL.sand })}${el('rect', { x: -86, y: -116, width: 172, height: 20, rx: 6, fill: PAL.brown, ...INK(4) })}${el('rect', { x: -86, y: 96, width: 172, height: 20, rx: 6, fill: PAL.brown, ...INK(4) })}`; },
  quill: () => `${path('M-60,100L40,-100', INK(6))}${path('M-40,60Q-60,-60 60,-120Q60,-10 -40,60Z', { fill: '#fbf6ea', ...INK(5) })}${el('circle', { cx: -70, cy: 108, r: 10, fill: ink })}`,
  dome: (t) => CH.hagiaSophia(0, 110, 0.36, { minarets: false }),
  mosque: (t) => CH.hagiaSophia(0, 110, 0.36, { minarets: true }),
  shield: (t, o) => `${path('M0,-110L90,-80Q100,40 0,110Q-100,40 -90,-80Z', { fill: col(o.color || PAL.purple), ...INK(6) })}${CH.emblem(o.emblem || 'chirho', 0, 0, 0.9)}`,
  swords: () => [-1, 1].map(sx => `<g transform="scale(${sx} 1) rotate(-45)">${path('M-12,-110L0,-128L12,-110L10,40L-10,40Z', { fill: '#e6ebeb', ...INK(5) })}${el('rect', { x: -40, y: 40, width: 80, height: 16, rx: 6, fill: PAL.gold, ...INK(4) })}${el('rect', { x: -9, y: 56, width: 18, height: 50, rx: 6, fill: PAL.brown, ...INK(4) })}</g>`).join(''),
  fire: (t) => CH.flames(0, 100, 1.1, t, 7, 3),
  ship: (t) => CH.ship(0, 40, 0.5, t, { flag: PAL.purple }),
  cannon: (t) => CH.cannon(0, 40, 0.5, t, {}),
  chain: () => CH.chain(-120, -10, 120, -10, { sag: 30 }),
  wheat: (t) => [-40, 0, 40].map((dx, i) => `<g transform="translate(${dx} 0) rotate(${f(Math.sin(t * 2 + i) * 4 + dx * 0.2)})">${path('M0,110L0,-60', INK(6))}${[...Array(5)].map((_, k) => el('ellipse', { cx: k % 2 ? 10 : -10, cy: -50 + k * 20, rx: 9, ry: 18, fill: PAL.gold, ...INK(3.5), transform: `rotate(${k % 2 ? 25 : -25} ${k % 2 ? 10 : -10} ${-50 + k * 20})` })).join('')}${el('ellipse', { cx: 0, cy: -84, rx: 9, ry: 18, fill: PAL.gold, ...INK(3.5) })}</g>`).join(''),
  letters: (t) => ['Б', 'Ж', 'Я'].map((ch, i) => `<g transform="translate(${-110 + i * 110} ${f(Math.sin(t * 3 + i) * 8)}) rotate(${(i - 1) * 8})">${el('rect', { x: -48, y: -56, width: 96, height: 112, rx: 12, fill: ['#e7c068', '#9cc3d5', '#e59a85'][i], ...INK(5) })}<text x="0" y="6" text-anchor="middle" dominant-baseline="central" font-family="Montserrat" font-weight="800" font-size="78" fill="${ink}">${ch}</text></g>`).join(''),
  onion: () => CH.onionChurch(0, 110, 0.6),
  globe: (t) => `${el('circle', { r: 100, fill: '#9cc9d8', ...INK(6) })}${path('M-60,-60Q-20,-80 0,-40Q-30,-10 -70,-20ZM20,0Q60,-20 80,20Q50,70 10,40Z', { fill: PAL.green, ...INK(4) })}${path('M-100,0L100,0M0,-100Q60,0 0,100M0,-100Q-60,0 0,100', { fill: 'none', ...INK(2.5), opacity: 0.5 })}`,
  bucket: (t) => `${path('M-80,-60L80,-60L60,90L-60,90Z', { fill: '#a07a50', ...INK(6) })}${path('M-80,-60Q0,-150 80,-60', { fill: 'none', ...INK(6) })}${el('circle', { cx: 20, cy: 50, r: 9, fill: ink })}${[0, 1, 2].map(k => { const y = 60 + ((t * 160 + k * 50) % 150); return el('ellipse', { cx: 20 + k * 2, cy: y, rx: 7, ry: 11, fill: PAL.gold, ...INK(3) }); }).join('')}`,
  dollar: () => `${el('rect', { x: -110, y: -60, width: 220, height: 120, rx: 10, fill: '#b9d3a6', ...INK(6) })}${el('ellipse', { rx: 40, ry: 46, fill: '#d6e6c8', ...INK(4) })}<text x="0" y="4" text-anchor="middle" dominant-baseline="central" font-family="Anton" font-size="70" fill="${PAL.green2}">$</text>`,
  question: (t) => `<text x="0" y="${f(Math.sin(t * 3) * 6)}" text-anchor="middle" dominant-baseline="central" font-family="LuckiestGuy" font-size="240" fill="${PAL.cream}" stroke="${ink}" stroke-width="16" paint-order="stroke">?</text>`,
  bandage: () => `${path('M-90,-20L90,-20L90,20L-90,20Z', { fill: '#fbf6ea', ...INK(5) })}${path('M-60,-20L-60,20M-30,-20L-30,20M30,-20L30,20M60,-20L60,20', INK(2))}`,
  torch: (t) => `${el('rect', { x: -12, y: -40, width: 24, height: 150, rx: 6, fill: PAL.brown, ...INK(5) })}${CH.flames(0, -36, 0.7, t, 5, 2)}`,
  helmet: () => CH.person({ x: 0, y: 260, s: 1, hat: 'helmet', body: 'armor', expr: 'determined', shadow: false }, 0),
  snowflake: (t) => `<g transform="rotate(${f(t * 20)})">${[0, 60, 120].map(a => path('M0,-100L0,100M-20,-80L0,-60L20,-80M-20,80L0,60L20,80', { fill: 'none', ...INK(9), transform: `rotate(${a})` }) + path('M0,-100L0,100', { stroke: '#e8f4ff', 'stroke-width': 4, transform: `rotate(${a})` })).join('')}</g>`,
  horseman: (t) => CH.horse(0, 100, 0.55, t, { fill: '#6a4426', rider: { hat: 'cap', hatColor: '#6a7a3a', body: 'tunic', robe: '#6a7a3a', expr: 'angry', pose: 'raise', prop: 'spear' } }),
  bomb: (t) => `${el('circle', { cx: 0, cy: 20, r: 80, fill: '#7d7a72', ...INK(6) })}${el('ellipse', { cx: -26, cy: -8, rx: 18, ry: 10, fill: '#fff', opacity: 0.4 })}`,
  press: () => `${el('rect', { x: -100, y: -100, width: 200, height: 26, fill: PAL.brown, ...INK(5) })}${el('rect', { x: -86, y: -74, width: 24, height: 180, fill: PAL.brown, ...INK(5) })}${el('rect', { x: 62, y: -74, width: 24, height: 180, fill: PAL.brown, ...INK(5) })}${path('M0,-74L0,-10', INK(10))}${el('rect', { x: -60, y: -10, width: 120, height: 30, fill: PAL.steel, ...INK(5) })}${el('rect', { x: -70, y: 30, width: 140, height: 50, fill: '#f6ecd0', ...INK(5) })}`,
  ballot: () => '',
  heart: () => path('M0,90C-120,10 -90,-90 0,-40C90,-90 120,10 0,90Z', { fill: PAL.red, ...INK(6) }),
  castle: () => CH.wall(-110, 110, 100, 120, { towerGap: 180, towerW: 60, towerH: 170 }),
  rome: (t) => CH.temple(0, 100, 220, 220, {}),
  bulb: (t) => `${CH.rays(0, -20, 100, 150, t, { n: 12, fill: '#ffe9a0', opacity: 0.6 })}${path('M-60,-30C-60,-120 60,-120 60,-30C60,0 30,20 30,50L-30,50C-30,20 -60,0 -60,-30Z', { fill: '#fff1b0', ...INK(6) })}${el('rect', { x: -32, y: 50, width: 64, height: 40, rx: 6, fill: PAL.steel, ...INK(5) })}`,
};
const jewelI = (x, y, r, c) => el('circle', { cx: x, cy: y, r, fill: c, ...INK(3) }) + el('circle', { cx: x - r * 0.3, cy: y - r * 0.3, r: r * 0.3, fill: '#fff', opacity: 0.8 });
CH.ICONS = Object.keys(ICONS);
CH.icon = (name, x, y, s, t, o = {}) => {
  const fn = ICONS[name] || ICONS.question;
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${(+s).toFixed(4)})">${fn(t, o)}</g>`;
};

// ------------------------------------------------------------------------------------------------ bubbles & arrows
CH.bubble = (txt, x, y, o = {}) => {
  const kind = o.kind || 'speech', size = o.size || 44;
  const fit = CH.fit(String(txt).toUpperCase(), 'label', size, o.maxW || 520, o.lines || 3);
  const w = Math.max(...fit.lines.map(l => CH.measure(l, 'label', fit.size))) + fit.size * 1.6;
  const h = fit.lines.length * fit.size * 1.12 + fit.size * 1.1;
  const [tx, ty] = o.tail || [x - w * 0.2, y + h * 0.9];
  let s = '';
  if (kind === 'shout') {
    const pts = [...Array(22)].map((_, i) => { const a = (i / 22) * Math.PI * 2, r = i % 2 ? 1 : 1.18; return [x + Math.cos(a) * w * 0.6 * r, y + Math.sin(a) * h * 0.75 * r]; });
    s += path(poly(pts), { fill: '#fff8e6', ...INK(5) });
  } else if (kind === 'thought') {
    s += path(smooth([...Array(12)].map((_, i) => { const a = (i / 12) * Math.PI * 2, r = 1 + (i % 2) * 0.1; return [x + Math.cos(a) * w * 0.56 * r, y + Math.sin(a) * h * 0.7 * r]; })), { fill: '#fff8e6', ...INK(5) });
    for (let k = 1; k <= 2; k++) s += el('circle', { cx: CH.lerp(x, tx, 0.5 + k * 0.2), cy: CH.lerp(y + h * 0.5, ty, 0.5 + k * 0.2), r: 14 - k * 4, fill: '#fff8e6', ...INK(4) });
  } else {
    const bx = x - w / 2, by = y - h / 2;
    const ax = CH.clamp(tx, bx + 30, bx + w - 30);
    s += path(`M${pt(bx + 24, by)}L${pt(bx + w - 24, by)}Q${pt(bx + w, by)} ${pt(bx + w, by + 24)}L${pt(bx + w, by + h - 24)}Q${pt(bx + w, by + h)} ${pt(bx + w - 24, by + h)}L${pt(ax + 18, by + h)}L${pt(tx, ty)}L${pt(ax - 14, by + h)}L${pt(bx + 24, by + h)}Q${pt(bx, by + h)} ${pt(bx, by + h - 24)}L${pt(bx, by + 24)}Q${pt(bx, by)} ${pt(bx + 24, by)}Z`, { fill: '#fff8e6', ...INK(5) });
  }
  fit.lines.forEach((l, i) => {
    s += `<text x="${f(x)}" y="${f(y + (i - (fit.lines.length - 1) / 2) * fit.size * 1.12)}" text-anchor="middle" dominant-baseline="central" font-family="Montserrat" font-weight="800" font-size="${f(fit.size)}" fill="${o.color ? col(o.color) : ink}">${CH.esc(l)}</text>`;
  });
  return s;
};
CH.arrow = (x1, y1, x2, y2, o = {}) => {
  const p = o.p === undefined ? 1 : clamp(o.p);
  if (p <= 0) return '';
  const bend = o.bend === undefined ? 0.2 : o.bend;
  const mx = (x1 + x2) / 2 - (y2 - y1) * bend, my = (y1 + y2) / 2 + (x2 - x1) * bend;
  const d = `M${pt(x1, y1)}Q${pt(mx, my)} ${pt(x2, y2)}`;
  const w = o.w || 14, c = col(o.color || PAL.red);
  let s = path(d, { fill: 'none', stroke: ink, 'stroke-width': w + 8, 'stroke-linecap': 'round', ...CH.draw(p) });
  s += path(d, { fill: 'none', stroke: c, 'stroke-width': w, 'stroke-linecap': 'round', ...CH.draw(p), ...(o.dashed ? {} : {}) });
  if (p > 0.92 && o.head !== false) {
    const tx = 2 * (1 - 0.98) * (mx - x1) + 2 * 0.98 * (x2 - mx), ty = 2 * (1 - 0.98) * (my - y1) + 2 * 0.98 * (y2 - my);
    const a = Math.atan2(ty, tx), L = w * 2.6;
    const hp = [[x2 + Math.cos(a) * L * 0.4, y2 + Math.sin(a) * L * 0.4], [x2 + Math.cos(a + 2.5) * L, y2 + Math.sin(a + 2.5) * L], [x2 + Math.cos(a - 2.5) * L, y2 + Math.sin(a - 2.5) * L]];
    s += path(poly(hp), { fill: c, ...INK(4) });
  }
  return s;
};
CH.arrowPoint = (x1, y1, x2, y2, u, bend = 0.2) => {   // point at fraction u along CH.arrow's curve
  const mx = (x1 + x2) / 2 - (y2 - y1) * bend, my = (y1 + y2) / 2 + (x2 - x1) * bend;
  const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
  return [a * x1 + b * mx + c * x2, a * y1 + b * my + c * y2, Math.atan2(2 * (1 - u) * (my - y1) + 2 * u * (y2 - my), 2 * (1 - u) * (mx - x1) + 2 * u * (x2 - mx))];
};
})();
