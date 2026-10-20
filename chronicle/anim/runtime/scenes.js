/* Chronicle animation runtime - scene templates.
 *
 * Each template turns a small JSON spec (written by the scene planner) into a living illustration:
 *   CH.T.<name>(spec, env) -> { static() -> {ink, flat}, draw(ctx) -> {ink, flat, hud} | string, camera?(ctx), focus?, drift? }
 * Times inside specs ("at", "delay") are fractions of the beat when <= 1, seconds otherwise.
 * Layout adapts to the frame: 16:9 spreads sideways, 9:16 stacks inside the stage between header and captions.
 */
(() => {
'use strict';
const { PAL, col, f, pt, clamp, seg, ease, rng, hash, el, path, INK, smooth, poly } = CH;
const ink = PAL.ink;
const tAt = (x, dur, def = 0) => (x === undefined || x === null ? def : (x <= 1 ? x * dur : x));

// ------------------------------------------------------------------------------------------------ cast presets
CH.CAST = {
  constantine: { hat: 'diadem', body: 'imperial', robe: PAL.purple, hair: 'short', expr: 'proud', prop: 'banner', propColor: PAL.purple, emblem: 'chirho' },
  constantine1: { hat: 'diadem', body: 'imperial', robe: PAL.purple, hair: 'short', expr: 'proud', prop: 'banner', propColor: PAL.purple, emblem: 'chirho' },
  helena: { hat: 'veil', hatColor: '#3d5f8f', body: 'dress', robe: '#3d5f8f', trim: PAL.gold, expr: 'happy' },
  theodosius: { hat: 'diadem', body: 'imperial', robe: PAL.purple, beard: 'short', expr: 'neutral' },
  arcadius: { hat: 'diadem', body: 'imperial', robe: PAL.purple, hair: 'short', expr: 'smug', s: 0.85 },
  honorius: { hat: 'diadem', body: 'imperial', robe: '#8a3a3a', hair: 'curly', expr: 'worried', s: 0.85 },
  romulus: { hat: 'crown', body: 'imperial', robe: '#8a3a3a', hair: 'short', expr: 'scared', s: 0.72 },
  odoacer: { hat: 'none', hair: 'long', hairColor: '#b07a3a', beard: 'long', beardColor: '#b07a3a', body: 'tunic', robe: '#6a5a3a', cape: true, capeColor: '#7a4a2a', expr: 'smug', prop: 'axe' },
  justinian: { hat: 'crown', body: 'imperial', robe: PAL.purple, hair: 'short', expr: 'determined' },
  theodora: { hat: 'crown', body: 'dress', robe: PAL.purple, trim: PAL.gold, hair: 'long', hairColor: '#2a1f1a', expr: 'determined' },
  belisarius: { hat: 'helmet', body: 'armor', beard: 'short', expr: 'determined', prop: 'sword' },
  procopius: { hat: 'none', hair: 'bald', beard: 'short', beardColor: '#8a8a80', body: 'long', robe: '#7c5433', expr: 'sly', prop: 'quill' },
  arab: { hat: 'keffiyeh', body: 'thobe', robe: '#f2ece0', beard: 'short', expr: 'determined', prop: 'spear' },
  caliph: { hat: 'keffiyeh', body: 'thobe', robe: '#f2ece0', beard: 'long', expr: 'smug', cape: true, capeColor: '#2f6f4f' },
  basil: { hat: 'crown', body: 'armor', cape: true, capeColor: PAL.purple, beard: 'short', expr: 'angry', prop: 'sword' },
  basil2: { hat: 'crown', body: 'armor', cape: true, capeColor: PAL.purple, beard: 'short', expr: 'angry', prop: 'sword' },
  bulgar: { hat: 'fur', body: 'tunic', robe: '#5f7a3a', beard: 'moustache', expr: 'worried', prop: 'shield', propColor: '#5f7a3a', emblem: 'lion' },
  seljuk: { hat: 'kufi', hatColor: '#d9c9a0', body: 'tunic', robe: '#4f6a3a', beard: 'short', expr: 'determined', prop: 'spear' },
  alparslan: { hat: 'turban', body: 'kaftan', robe: '#4f6a3a', beard: 'moustache', expr: 'smug', royal: true },
  romanos: { hat: 'crown', body: 'armor', cape: true, capeColor: PAL.purple, beard: 'short', expr: 'shock' },
  dandolo: { hat: 'doge', body: 'long', robe: '#b5452f', trim: PAL.gold, beard: 'long', beardColor: '#e8e2d4', hair: 'none', expr: 'sly', blind: true },
  crusader: { hat: 'crusader', body: 'crusader', robe: '#fbf6ea', expr: 'evil', prop: 'sword' },
  venetian: { hat: 'cap', hatColor: '#b5452f', body: 'tunic', robe: '#b5452f', expr: 'smug', prop: 'bag' },
  michael8: { hat: 'crown', body: 'imperial', robe: PAL.purple, beard: 'short', expr: 'happy', prop: 'banner', propColor: PAL.purple, emblem: 'eagle' },
  mehmed: { hat: 'turban', royal: true, body: 'kaftan', robe: '#a83a2a', trim: PAL.gold, beard: 'short', expr: 'evil' },
  orban: { hat: 'cap', hatColor: '#5a3a22', body: 'peasant', robe: '#7c5433', beard: 'moustache', expr: 'smug', prop: 'hammer' },
  constantine11: { hat: 'crown', body: 'armor', cape: true, capeColor: PAL.purple, beard: 'short', expr: 'determined', prop: 'sword' },
  janissary: { hat: 'bork', body: 'kaftan', robe: '#2e5f9e', trim: PAL.gold, beard: 'moustache', expr: 'angry', prop: 'spear' },
  ottoman: { hat: 'turban', hatColor: '#f6f1e6', body: 'kaftan', robe: '#3f7a4f', beard: 'short', expr: 'angry', prop: 'sword' },
  defender: { hat: 'helmet', body: 'armor', beard: 'short', expr: 'determined', prop: 'spear' },
  soldier: { hat: 'helmet', body: 'armor', expr: 'determined', prop: 'spear' },
  wolf: { hat: 'scholar', hatColor: '#2a2522', body: 'long', robe: '#2a2522', beard: 'short', expr: 'sly', prop: 'quill' },
  scholar: { hat: 'scholar', hatColor: '#6e2f66', body: 'long', robe: '#4e5d7a', beard: 'long', beardColor: '#ddd8cc', expr: 'worried', prop: 'book' },
  monk: { hat: 'hood', body: 'monk', robe: '#4a3328', beard: 'short', expr: 'neutral', prop: 'book' },
  patriarch: { hat: 'mitre', body: 'long', robe: '#2f4f7f', beard: 'long', beardColor: '#e8e2d4', expr: 'neutral', prop: 'staff' },
  pope: { hat: 'papal', body: 'long', robe: '#fbf6ea', trim: PAL.gold, expr: 'smug', prop: 'staff' },
  tsar: { hat: 'monomakh', body: 'imperial', robe: '#8a2f2f', beard: 'long', expr: 'proud' },
  artist: { hat: 'scholar', hatColor: '#b5452f', body: 'tunic', robe: '#3d6f8f', hair: 'curly', expr: 'happy', prop: 'quill' },
  citizen: { hat: 'none', body: 'tunic', robe: '#4e7da0', expr: 'neutral' },
  blues: { hat: 'band', hatColor: PAL.bluesTeam, body: 'tunic', robe: PAL.bluesTeam, expr: 'furious', prop: 'torch' },
  greens: { hat: 'band', hatColor: PAL.greensTeam, body: 'tunic', robe: PAL.greensTeam, expr: 'furious', prop: 'pitchfork' },
  emperor: { hat: 'crown', body: 'imperial', robe: PAL.purple, beard: 'short', expr: 'proud' },
  roman: { hat: 'wreath', body: 'toga', robe: '#efe6d2', expr: 'proud' },
  builder: { hat: 'cap', hatColor: '#c9a26a', body: 'peasant', robe: '#a07a50', expr: 'determined', prop: 'hammer' },
};
CH.castMember = m => {
  const base = CH.CAST[String(m.who || '').toLowerCase().replace(/[^a-z0-9]/g, '')] || {};
  const o = { ...base, ...m };
  if (o.blind || base.blind) o.expr = o.expr === 'evil' ? 'evil' : 'sleep';
  return o;
};

// ------------------------------------------------------------------------------------------------ settings
const SETTINGS = ['plain', 'palace', 'city', 'field', 'desert', 'church', 'harbour', 'night', 'fire', 'study', 'walls', 'hippodrome', 'workshop', 'camp', 'ruins', 'sea', 'throne'];
CH.SETTINGS = SETTINGS;
function settingStatic(name, env, L) {
  const W = env.W, H = env.H, gy = L.gy;
  let s = '';
  switch (name) {
    case 'palace': case 'throne': {
      s += el('rect', { x: -60, y: -60, width: W + 120, height: gy + 60, fill: '#d9a441' });
      for (let y = 0; y < gy; y += 26) for (let x = (y / 26) % 2 * 13; x < W; x += 26) s += el('rect', { x, y, width: 22, height: 22, fill: '#e8b955', opacity: 0.6 });
      const n = env.V ? 3 : 5;
      for (let i = 0; i < n; i++) {
        const x = W * (i + 0.5) / n;
        s += path(`M${pt(x - W / n * 0.45, gy)}L${pt(x - W / n * 0.45, gy * 0.32)}A${f(W / n * 0.45)},${f(W / n * 0.45)} 0 0 1 ${pt(x + W / n * 0.45, gy * 0.32)}L${pt(x + W / n * 0.45, gy)}Z`, { fill: '#7a2f5a', opacity: 0.5 });
        s += CH.column(x - W / n * 0.5, gy, gy * 0.8, { w: 46, fill: '#e8dcc0' });
      }
      s += CH.column(W - 8, gy, gy * 0.8, { w: 46, fill: '#e8dcc0' });
      s += path(`M-60,-60L${f(W * 0.2)},-60Q${f(W * 0.12)},${f(gy * 0.4)} ${f(W * 0.18)},${f(gy)}L-60,${f(gy)}Z`, { fill: PAL.purple, ...INK(5) });
      s += path(`M${W + 60},-60L${f(W * 0.8)},-60Q${f(W * 0.88)},${f(gy * 0.4)} ${f(W * 0.82)},${f(gy)}L${W + 60},${f(gy)}Z`, { fill: PAL.purple, ...INK(5) });
      s += CH.floor(W, H, gy, { fill: '#b8a27a' });
      if (name === 'throne') {
        const x = W / 2;
        s += path(`M${pt(x - 120, gy)}L${pt(x - 110, gy - 330)}Q${pt(x, gy - 420)} ${pt(x + 110, gy - 330)}L${pt(x + 120, gy)}Z`, { fill: PAL.gold, ...INK(6) });
        s += path(`M${pt(x - 80, gy)}L${pt(x - 76, gy - 280)}Q${pt(x, gy - 350)} ${pt(x + 76, gy - 280)}L${pt(x + 80, gy)}Z`, { fill: '#7a2f5a', ...INK(4) });
      }
      break;
    }
    case 'church': {
      s += el('rect', { x: -60, y: -60, width: W + 120, height: H + 120, fill: '#caa04a' });
      for (let y = 0; y < gy; y += 22) for (let x = (y / 22) % 2 * 11; x < W; x += 22) s += el('rect', { x, y, width: 18, height: 18, fill: '#e2b95a', opacity: 0.55 });
      s += path(`M${f(W * 0.18)},${f(gy)}L${f(W * 0.18)},${f(gy * 0.45)}A${f(W * 0.32)},${f(W * 0.32)} 0 0 1 ${f(W * 0.82)},${f(gy * 0.45)}L${f(W * 0.82)},${f(gy)}`, { fill: '#7a5a2a', opacity: 0.35, ...INK(6) });
      s += CH.icon('cross', W / 2, gy * 0.42, 0.7, 0);
      s += CH.floor(W, H, gy, { fill: '#a89470' });
      break;
    }
    case 'study': {
      s += el('rect', { x: -60, y: -60, width: W + 120, height: gy + 60, fill: '#b99a6e' });
      s += el('rect', { x: W * 0.06, y: gy * 0.25, width: W * 0.22, height: gy * 0.75, fill: '#6a4426', ...INK(5) });
      const r = rng(3);
      for (let row = 0; row < 4; row++) for (let i = 0; i < 7; i++) s += el('rect', { x: W * 0.07 + i * W * 0.029, y: gy * (0.3 + row * 0.18), width: W * 0.024, height: gy * 0.14, fill: ['#8a2f2f', '#2f5f7f', '#5f7a3a', '#c9a26a'][Math.floor(r() * 4)], ...INK(2.5) });
      s += el('rect', { x: W * 0.68, y: gy * 0.18, width: W * 0.2, height: gy * 0.36, fill: '#cfe3e8', ...INK(6) }) + path(`M${f(W * 0.78)},${f(gy * 0.18)}L${f(W * 0.78)},${f(gy * 0.54)}M${f(W * 0.68)},${f(gy * 0.36)}L${f(W * 0.88)},${f(gy * 0.36)}`, INK(5));
      s += CH.floor(W, H, gy, { fill: '#8a6a44' });
      break;
    }
    case 'workshop': {
      s += el('rect', { x: -60, y: -60, width: W + 120, height: gy + 60, fill: '#4a3a32' });
      s += el('circle', { cx: W * 0.82, cy: gy * 0.62, r: gy * 0.3, fill: 'url(#glowFire)' });
      s += path(`M${f(W * 0.72)},${f(gy)}L${f(W * 0.74)},${f(gy * 0.45)}Q${f(W * 0.82)},${f(gy * 0.3)} ${f(W * 0.9)},${f(gy * 0.45)}L${f(W * 0.92)},${f(gy)}Z`, { fill: '#7a5a4a', ...INK(5) });
      s += el('ellipse', { cx: W * 0.82, cy: gy * 0.78, rx: W * 0.05, ry: gy * 0.08, fill: PAL.fire2, ...INK(4) });
      s += CH.floor(W, H, gy, { fill: '#5a4a3a' });
      break;
    }
    case 'plain': {
      s += el('circle', { cx: W / 2, cy: L.cy, r: Math.max(W, H) * 0.7, fill: 'url(#glowGold)', opacity: 0.25 });
      s += path(`M-60,${f(gy)}L${W + 60},${f(gy)}`, INK(5)) + el('rect', { x: -60, y: gy, width: W + 120, height: H, fill: '#e4d2a9' });
      break;
    }
    default: {
      const sky = { city: 'day', field: 'day', desert: 'desert', harbour: 'day', night: 'night', fire: 'fire', walls: 'dusk', hippodrome: 'day', camp: 'dusk', ruins: 'storm', sea: 'day' }[name] || 'day';
      s += CH.skyStatic(W, H, sky, 'sky' + env.beat.id);
      if (name === 'night') s += CH.sun(W * 0.8, H * 0.15, 46, 0, { moon: true });
      if (name === 'city' || name === 'fire' || name === 'camp') {
        const r = rng(env.seed);
        for (let i = 0; i < 26; i++) { const x = r() * W, w = 50 + r() * 70; s += CH.house(x, gy - 40, w, 40 + r() * 70, { fill: name === 'fire' ? '#9a7a6a' : '#e2cfaa' }); }
        s += CH.dome(W * 0.3, gy - 60, 150, 140, { domeFill: name === 'fire' ? '#7a7a7a' : undefined }) + CH.dome(W * 0.72, gy - 50, 120, 110, {});
        for (let i = 0; i < 4; i++) s += CH.cypress(W * (0.1 + i * 0.27), gy - 30, 140 + (i % 2) * 40);
        s += CH.hills(W, H, gy - 30, env.seed + 1, { amp: 10, fill: '#d8c08c' });
      }
      if (name === 'camp') { const r = rng(5); for (let i = 0; i < 9; i++) s += CH.tent(W * (0.05 + i * 0.115), gy - 4, 0.9 + r() * 0.3, { stripe: i % 2 ? PAL.red : PAL.green }); }
      if (name === 'field') s += CH.hills(W, H, gy - 60, env.seed, { amp: 70, fill: '#a8b878' }) + CH.hills(W, H, gy - 10, env.seed + 2, { amp: 30, fill: '#98ad68' });
      if (name === 'desert') s += CH.hills(W, H, gy - 40, env.seed, { amp: 80, fill: '#e8c27a' }) + CH.palm(W * 0.12, gy, 220) + CH.palm(W * 0.88, gy, 180);
      if (name === 'ruins') { s += CH.temple(W * 0.75, gy, 380, 300, { collapse: 0.85, seed: 3 }); }
      if (name === 'harbour' || name === 'sea') s += CH.seaStatic(W, H, gy - H * (name === 'sea' ? 0.25 : 0.2), {});
      if (name === 'walls') {
        s += CH.hills(W, H, gy - 160, env.seed, { amp: 40, fill: '#b9a880' });
        s += el('rect', { x: -60, y: gy - 60, width: W + 120, height: H, fill: PAL.stone, ...INK(6) });
        s += CH.crenels(-60, W + 60, gy - 60, 70, {});
        return s;
      }
      if (name === 'hippodrome') {
        for (let row = 0; row < 3; row++) s += el('rect', { x: -60, y: gy * (0.35 + row * 0.12), width: W + 120, height: gy * 0.12, fill: ['#c9b48a', '#bfa77a', '#b39b6e'][row], ...INK(3.5) });
        const r = rng(9);
        for (let i = 0; i < 90; i++) { const row = i % 3, x = r() * W; s += el('circle', { cx: x, cy: gy * (0.38 + row * 0.12), r: 13, fill: r() < 0.5 ? PAL.bluesTeam : PAL.greensTeam, ...INK(2.5) }); }
        s += CH.ground(W, H, gy, { fill: '#e2cf9e', tufts: false });
        return s;
      }
      if (name !== 'harbour' && name !== 'sea') s += CH.ground(W, H, gy, { fill: name === 'desert' ? '#ecd09a' : name === 'fire' ? '#9a7a5a' : name === 'night' ? '#5a6a5a' : name === 'ruins' ? '#b8a888' : '#d8c08c', seed: env.seed });
      else s += el('rect', { x: -60, y: gy, width: W + 120, height: H, fill: '#b48a5a' }) + path(`M-60,${f(gy)}L${W + 60},${f(gy)}`, INK(5));
    }
  }
  return s;
}
function settingDynamic(name, env, L, t) {
  const W = env.W, H = env.H, gy = L.gy;
  let s = '';
  if (['city', 'field', 'desert', 'harbour', 'hippodrome', 'sea', 'walls', 'camp'].includes(name)) s += CH.clouds(W, H, t, env.seed, 3, 0.05, 0.22);
  if (name === 'harbour' || name === 'sea') s += CH.waves(W, H, gy - H * (name === 'sea' ? 0.25 : 0.2), t, env.seed, { rows: 3 });
  if (name === 'fire') {
    for (let i = 0; i < 6; i++) s += CH.flames(W * (0.08 + i * 0.17), gy - 30, 0.9, t, env.seed + i, 2);
    s += CH.smoke(W * 0.3, gy - 160, 1.1, t, 4, 5, { wind: 40 }) + CH.smoke(W * 0.75, gy - 160, 1.1, t + 1, 6, 5, { wind: 40 });
    s += CH.embers(0, 0, W, gy, t, env.seed, 40);
  }
  if (name === 'church') s += CH.lightShafts(W * 0.5, -40, W, H, t, { n: 5, angle: 14 }) + CH.dust(W, gy, t, 3, 30);
  if (name === 'workshop') s += CH.embers(W * 0.75, gy * 0.4, W * 0.15, gy * 0.4, t, 5, 16);
  return s;
}

// ------------------------------------------------------------------------------------------------ shared pieces
const nameCard = (spec, env, L, t) => {
  if (!spec.label) return '';
  const pq = CH.pop(t, tAt(spec.labelAt, env.dur, 0.15), 0.4);
  if (pq.q <= 0) return '';
  const y = env.V ? env.H * 0.19 : env.H * 0.13;
  let s = CH.text(spec.label, { kind: 'title', size: env.V ? 92 : 96, fill: '#ffcf3f', x: env.W / 2, y, s: pq.s, opacity: pq.o, maxW: env.W * 0.9, lines: 2, upper: true });
  if (spec.sub) s += CH.plate(spec.sub, { size: env.V ? 34 : 34, x: env.W / 2, y: y + (env.V ? 92 : 88), s: pq.s, opacity: pq.o });
  return s;
};
const layoutCast = (cast, env, L) => {
  const n = cast.length, V = env.V;
  const xs = V ? ({ 1: [0.5], 2: [0.29, 0.71], 3: [0.2, 0.5, 0.8], 4: [0.15, 0.38, 0.62, 0.85] }[n] || cast.map((_, i) => (i + 0.5) / n))
    : ({ 1: [0.5], 2: [0.33, 0.67], 3: [0.24, 0.5, 0.76], 4: [0.17, 0.39, 0.61, 0.83], 5: [0.12, 0.31, 0.5, 0.69, 0.88] }[n] || cast.map((_, i) => (i + 0.5) / n));
  const sBase = V ? ({ 1: 1.7, 2: 1.32, 3: 1.0, 4: 0.82 }[n] || 0.7) : ({ 1: 1.6, 2: 1.45, 3: 1.25, 4: 1.05, 5: 0.92 }[n] || 0.8);
  return cast.map((m, i) => {
    const o = CH.castMember(m);
    const x = (o.x !== undefined ? o.x : xs[i]) * env.W;
    const fDefault = n === 1 ? (o.f !== undefined ? o.f : 1) : (xs[i] < 0.5 ? 1 : -1);
    return { ...o, x, y: o.y !== undefined ? o.y * env.H : L.gy, s: sBase * (o.s || 1), f: o.f !== undefined ? o.f : fDefault, seed: o.seed !== undefined ? o.seed : hash(String(o.who) + i) % 9973 };
  });
};
/* extra objects inside a scene: {kind: ship|cannon|icon|horse|chariot|temple|tent|fire|smoke, x, y (0..1), s, name, move:[dx,dy], at, f} */
const drawExtras = (extras, env, L, t) => {
  let s = '';
  (extras || []).forEach((e, i) => {
    const at = tAt(e.at, env.dur, 0);
    if (t < at) return;
    const u = ease.inOut(seg(t, at, at + (e.dur ? tAt(e.dur, env.dur) : env.dur * 0.8)));
    const mv = e.move || [0, 0];
    const x = env.W * ((e.x === undefined ? 0.5 : e.x) + mv[0] * u), y = e.y === undefined ? L.gy : L.gy + (e.y + mv[1] * u - 0.84) * env.H * (env.V ? 0.5 : 1);
    const sc = (e.s || 1) * (env.V ? 1.15 : 1);
    const lt = t - at;
    switch (e.kind) {
      case 'ship': s += CH.ship(x, y, sc * 0.8, lt, { f: e.f || 1, flag: col(e.flag || PAL.purple), seed: i, siphon: e.siphon, burning: e.burning }); break;
      case 'cannon': s += CH.cannon(x, y - 40 * sc, sc * 0.8, lt, { f: e.f || 1, fireAt: e.fireAt === undefined ? -9 : tAt(e.fireAt, env.dur) - at }); break;
      case 'horse': s += CH.horse(x, y, sc * 0.9, lt, { f: e.f || 1, fill: e.fill, rider: e.rider ? CH.castMember(e.rider) : undefined }); break;
      case 'chariot': s += CH.chariot(x, y, sc * 0.8, lt, { f: e.f || 1, color: e.color, seed: i }); break;
      case 'temple': s += CH.temple(x, y, 380 * sc, 300 * sc, { collapse: e.collapse ? u : 0, seed: i + 2 }); break;
      case 'tent': s += CH.tent(x, y, sc, { stripe: col(e.color || PAL.red) }); break;
      case 'fire': s += CH.flames(x, y, sc, lt, i + 3, 3); break;
      case 'smoke': s += CH.smoke(x, y, sc, lt, i + 5, 5); break;
      default: s += CH.wrapPop(t, at, x, y, CH.icon(e.name || 'question', 0, 0, sc * 0.6, lt, { spin: e.name === 'coin' }), 0.35);
    }
  });
  return s;
};
CH.drawExtras = drawExtras;
const titlePlate = (spec, env, t) => {
  if (!spec.title) return '';
  const pq = CH.pop(t, 0.05, 0.35);
  return pq.q > 0 ? CH.plate(spec.title, { size: env.V ? 42 : 44, x: env.W / 2, y: env.V ? env.H * 0.135 : env.H * 0.07, s: pq.s, opacity: pq.o, accent: PAL.red }) : '';
};
const sideBubble = (m, text, t, env, at) => {
  const pq = CH.pop(t, at, 0.3);
  if (pq.q <= 0) return '';
  const side = m.x < env.W / 2 ? 1 : -1, headY = m.y - 250 * m.s;
  const bx = m.x + side * 300, by = headY;
  return `<g transform="translate(${f(bx)} ${f(by)}) scale(${f(pq.s)}) translate(${f(-bx)} ${f(-by)})" opacity="${f(pq.o)}">${CH.bubble(text, bx, by, { size: 40, maxW: env.W * 0.42, tail: [m.x + side * 70 * m.s, headY + 20] })}</g>`;
};
const sayBubble = (m, text, t, env, at, kind = 'speech') => {
  const pq = CH.pop(t, at, 0.3);
  if (pq.q <= 0) return '';
  const headY = m.y - 300 * m.s;
  const side = m.x < env.W / 2 ? 1 : -1;
  const bx = clamp(m.x + side * 150 * Math.min(1.2, m.s), env.W * 0.2, env.W * 0.8), by = Math.max(env.V ? env.H * 0.2 : env.H * 0.16, headY - 90);
  return `<g transform="translate(${f(bx)} ${f(by)}) scale(${f(pq.s)}) translate(${f(-bx)} ${f(-by)})" opacity="${f(pq.o)}">${CH.bubble(text, bx, by, { kind, size: env.V ? 46 : 42, maxW: env.V ? env.W * 0.7 : env.W * 0.34, tail: [m.x + side * 30 * m.s, headY + 40 * m.s] })}</g>`;
};

// ------------------------------------------------------------------------------------------------ templates
/* character: {cast:[{who, pose, expr, prop, say, f, x, enter, delay}], setting, label, sub, bubble:{who:index, text, kind, at}} */
CH.T.character = (spec, env) => {
  const L = CH.L(env);
  const setting = SETTINGS.includes(spec.setting) ? spec.setting : 'plain';
  const cast = layoutCast((spec.cast && spec.cast.length ? spec.cast : [{ who: 'citizen' }]).slice(0, 5), env, L);
  const stat = settingStatic(setting, env, L);
  const focusX = cast.length === 1 ? cast[0].x / env.W : 0.5;
  return {
    focus: [focusX, env.V ? 0.42 : 0.5], drift: 0.06,
    static: () => ({ ink: stat }),
    draw: ctx => {
      const t = ctx.t;
      let s = settingDynamic(setting, env, L, t);
      s += drawExtras((spec.extras || []).filter(e => e.behind), env, L, t);
      cast.forEach((m, i) => {
        const d = tAt(m.delay, env.dur, 0);
        s += CH.person({ ...m, delay: d, enter: m.enter || (i > 0 && spec.stagger !== false ? 'pop' : m.enter || 'none') }, t);
        if (m.cage) s += path([...Array(7)].map((_, k) => `M${pt(m.x - 110 * m.s + k * 36 * m.s, m.y)}L${pt(m.x - 110 * m.s + k * 36 * m.s, m.y - 420 * m.s)}`).join('') + `M${pt(m.x - 120 * m.s, m.y - 420 * m.s)}L${pt(m.x + 120 * m.s, m.y - 420 * m.s)}`, { stroke: '#6a4426', 'stroke-width': 14 * m.s, 'stroke-linecap': 'round' });
      });
      cast.forEach((m, i) => { if (m.say) s += sayBubble(m, m.say, t, env, tAt(m.sayAt, env.dur, 0.25 * env.dur), m.sayKind || 'speech'); });
      if (spec.fx === 'sparkle') s += CH.sparkles(env.W / 2, L.gy - 250, 380, t, 3, 10);
      if (spec.fx === 'rays') s = CH.rays(env.W / 2, L.gy - 200, 80, 1400, t, { n: 18, opacity: 0.35 }) + s;
      if (spec.fx === 'snow') s += CH.snow(env.W, env.H, t, 3, 50);
      if (spec.fx === 'embers') s += CH.embers(0, 0, env.W, env.H, t, 2, 40);
      s += drawExtras((spec.extras || []).filter(e => !e.behind), env, L, t);
      return { ink: s, hud: nameCard(spec, env, L, t) + titlePlate(spec, env, t) };
    },
  };
};

/* crowd: {teams:[{color, hat, label, side:'left|right'}], mood:'riot|cheer|march|flee|pray|mourn|panic', n, setting, chant, fire} */
CH.T.crowd = (spec, env) => {
  const L = CH.L(env), W = env.W, H = env.H, V = env.V;
  const setting = SETTINGS.includes(spec.setting) ? spec.setting : (spec.fire ? 'fire' : 'city');
  const mood = spec.mood || 'cheer';
  const teams = spec.teams && spec.teams.length ? spec.teams : [{ color: PAL.blue }];
  const r = rng(env.seed);
  const rows = env.V ? 4 : 3, per = env.V ? 6 : 10;
  const people = [];
  for (let row = 0; row < rows; row++) {
    const k = 0.62 + row * 0.16;
    for (let i = 0; i < per + (rows - row); i++) {
      const u = (i + 0.5 + (row % 2) * 0.5) / (per + (rows - row));
      const team = teams.length === 2 ? teams[u < 0.5 ? 0 : 1] : teams[Math.floor(r() * teams.length)];
      const base = CH.randomPerson(r, { robes: [col(team.color || PAL.blue)], hats: team.hat ? [team.hat] : ['none', 'band', 'cap'], over: { hatColor: col(team.color || PAL.blue) } });
      const pose = { riot: ['fist', 'cheer', 'raise'], cheer: ['cheer', 'wave', 'hands_up'], march: ['walk'], flee: ['run'], pray: ['pray'], mourn: ['idle', 'facepalm'], panic: ['scared', 'run'] }[mood] || ['idle'];
      const expr = { riot: ['furious', 'angry', 'angry'], cheer: ['laugh', 'happy'], march: ['determined'], flee: ['scared', 'shock'], pray: ['sad', 'worried'], mourn: ['sad'], panic: ['scared', 'shock'] }[mood] || ['neutral'];
      const props = mood === 'riot' ? ['torch', 'pitchfork', 'none', 'none', 'flag'] : (mood === 'march' ? ['spear', 'banner'] : ['none']);
      people.push({ ...base, x: u * W + (r() - 0.5) * 30, y: L.gy - (rows - 1 - row) * (env.V ? 70 : 52), s: k * (env.V ? 1.0 : 0.9), f: teams.length === 2 ? (u < 0.5 ? 1 : -1) : (r() < 0.5 ? 1 : -1),
        pose: pose[Math.floor(r() * pose.length)], expr: expr[Math.floor(r() * expr.length)], prop: props[Math.floor(r() * props.length)], propColor: col(team.color), lod: row === rows - 1 ? 2 : 1, delay: r() * 0.4, seed: Math.floor(r() * 1e5) });
    }
  }
  if (mood === 'flee') people.forEach(p => { p.f = spec.direction === 'left' ? -1 : 1; });
  const stat = settingStatic(setting, env, L);
  return {
    focus: [0.5, 0.55], drift: 0.05,
    static: () => ({ ink: stat }),
    draw: ctx => {
      const t = ctx.t;
      let s = settingDynamic(setting, env, L, t);
      if (spec.fire && setting !== 'fire') { for (let i = 0; i < 5; i++) s += CH.flames(W * (0.1 + i * 0.2), L.gy - 140, 1.2, t, i + 2, 3); s += CH.smoke(W * 0.5, L.gy - 300, 1.4, t, 3, 6); }
      const shift = mood === 'flee' ? (spec.direction === 'left' ? -1 : 1) * t * 120 : mood === 'march' ? t * 50 : 0;
      for (const p of people) s += CH.person({ ...p, x: p.x + shift }, t);
      if (spec.chariots) {
        const n = spec.chariots === true ? 2 : spec.chariots;
        for (let i = 0; i < n; i++) {
          const span = W + 1100, x = ((t * (560 + i * 80) + i * 520) % span) - 550;
          s += CH.chariot(x, L.gy + (V ? 175 : 125) + i * 34, V ? 1.1 : 1.0, t, { color: i % 2 ? PAL.greensTeam : PAL.bluesTeam, seed: i });
        }
      }
      if (spec.chant) {
        const at = tAt(spec.chantAt, env.dur, 0.2 * env.dur);
        for (let k = 0; k < 2; k++) {
          const tk = at + k * 0.7;
          const pq = CH.pop(t, tk, 0.25);
          if (pq.q > 0) { const x = W * (k ? 0.72 : 0.3), y = env.V ? H * 0.24 : H * 0.2; s += `<g transform="translate(${f(x)} ${f(y)}) scale(${f(pq.s)}) rotate(${k ? 6 : -6}) translate(${f(-x)} ${f(-y)})">${CH.bubble(spec.chant, x, y, { kind: 'shout', size: env.V ? 64 : 58 })}</g>`; }
        }
      }
      (spec.teams || []).forEach((tm, i) => {
        if (!tm.label) return;
        const pq = CH.pop(t, 0.3 + i * 0.25, 0.35);
        if (pq.q > 0) s += CH.plate(tm.label, { size: env.V ? 44 : 40, x: W * (teams.length === 2 ? (i ? 0.75 : 0.25) : 0.5), y: env.V ? H * 0.34 : H * 0.36, plate: CH.shade(col(tm.color), 0.55), s: pq.s, opacity: pq.o });
      });
      return { ink: s, hud: nameCard(spec, env, L, t) + titlePlate(spec, env, t) };
    },
  };
};

/* city: Constantinople skyline. {state:'town|grow|normal|golden|fire|siege|sack|night|dawn', minarets, label, ships} */
CH.T.city = (spec, env) => {
  const L = CH.L(env), W = env.W, H = env.H, V = env.V;
  const state = spec.state || 'normal';
  const sky = { fire: 'fire', sack: 'fire', siege: 'dusk', night: 'night', dawn: 'dawn', golden: 'gold', town: 'day', grow: 'day' }[state] || 'day';
  const seaY = V ? H * 0.56 : H * 0.74, cityY = seaY - (V ? 10 : 12);
  const r = rng(env.seed);
  const houses = [];
  for (let i = 0; i < (V ? 22 : 34); i++) houses.push({ x: r() * W, w: 40 + r() * 60, h: 30 + r() * 70, d: r(), roof: r() < 0.5 ? '#b5532f' : '#c9703f' });
  const stat = CH.skyStatic(W, H, sky, 'csky' + env.beat.id) + (state === 'night' ? CH.sun(W * 0.82, H * 0.14, 44, 0, { moon: true }) : '') +
    CH.hills(W, H, cityY - (V ? 120 : 100), env.seed, { amp: 50, fill: state === 'fire' || state === 'sack' ? '#a07a5a' : '#c9b07a' }) +
    CH.seaStatic(W, H, seaY, { fill: state === 'night' ? '#3f5a6a' : PAL.sea });
  const town = state === 'town';
  return {
    focus: [0.5, V ? 0.42 : 0.55], drift: 0.05,
    static: () => ({ ink: stat }),
    draw: ctx => {
      const t = ctx.t;
      let s = '';
      if (state === 'golden') s += CH.rays(W / 2, cityY - 300, 100, 1500, t, { n: 20, opacity: 0.35 });
      if (sky !== 'night') s += CH.sun(W * 0.85, H * (V ? 0.2 : 0.17), 52, t);
      s += CH.clouds(W, H, t, env.seed, 3, 0.05, 0.22);
      const grow = state === 'grow' ? ease.inOut(seg(t, 0.15 * env.dur, 0.85 * env.dur)) : 1;
      houses.forEach((h, i) => {
        if (town && i % 3) return;
        const q = state === 'grow' ? clamp(grow * 2.2 - h.d * 1.2) : 1;
        if (q <= 0) return;
        s += `<g transform="translate(0 ${f((1 - ease.out(q)) * 120)})">${CH.house(h.x, cityY, h.w, h.h, { roof: h.roof, fill: state === 'sack' || state === 'fire' ? '#b09a86' : '#ecdcb6' })}</g>`;
      });
      if (!town) {
        const q = state === 'grow' ? grow : 1;
        if (spec.hagia !== false) s += CH.hagiaSophia(W * 0.5, cityY, (V ? 0.95 : 0.9) * (spec.scale || 1), { build: q, minarets: spec.minarets ? 1 : 0 });
        else s += CH.dome(W * 0.5, cityY, 200, 190, {}) + CH.house(W * 0.42, cityY, 120, 110, {}) + CH.house(W * 0.58, cityY, 130, 90, {});
        s += CH.dome(W * (V ? 0.13 : 0.2), cityY, 130, 130, {}) + CH.dome(W * (V ? 0.87 : 0.8), cityY, 120, 110, {});
        s += CH.column(W * (V ? 0.3 : 0.33), cityY, 280 * clamp(q * 1.5), { w: 26 });
        for (let i = 0; i < 6; i++) s += CH.cypress(W * (0.06 + i * 0.18), cityY, 110 + (i % 3) * 30);
        s += CH.wall(-40, W + 40, cityY + 8, 46, { build: clamp(q * 1.4), towerGap: 230, towerW: 40, towerH: 76, seed: 3 });
      } else {
        s += CH.temple(W * 0.5, cityY, 260, 190, { n: 4 });
      }
      s += CH.waves(W, H, seaY, t, env.seed, { rows: 4 });
      const nShips = spec.ships === undefined ? (town ? 2 : 3) : spec.ships;
      for (let i = 0; i < nShips; i++) {
        const x = ((W * (0.2 + i * 0.33) + t * (i % 2 ? -22 : 26)) % (W + 400) + W + 400) % (W + 400) - 200;
        s += CH.ship(x, seaY + (V ? 120 : 70) + i * 30, V ? 0.55 : 0.45, t, { f: i % 2 ? -1 : 1, flag: state === 'siege' && i ? PAL.red : PAL.purple, seed: i, burning: state === 'sack' && i === 1 });
      }
      if (state === 'fire' || state === 'sack') {
        for (let i = 0; i < 5; i++) s += CH.flames(W * (0.1 + i * 0.2), cityY - 20, 0.9, t, i + 1, 2);
        s += CH.smoke(W * 0.25, cityY - 140, 1.2, t, 2, 6, { wind: 50 }) + CH.smoke(W * 0.7, cityY - 160, 1.3, t + 1.5, 5, 6, { wind: 50 });
        s += CH.embers(0, 0, W, cityY, t, 3, 50);
      }
      if (state === 'siege') { for (let i = 0; i < 8; i++) s += CH.tent(W * (0.05 + i * 0.13), seaY + (V ? 260 : 150), 0.7, { stripe: i % 2 ? PAL.red : PAL.green }); }
      if (state === 'sack') { s += CH.person({ ...CH.castMember({ who: 'crusader' }), x: W * 0.22, y: seaY + (V ? 330 : 250), s: V ? 1.1 : 0.9, pose: 'carry', prop: 'none', expr: 'laugh' }, t); s += CH.icon('crown', W * 0.22, seaY + (V ? 330 : 250) - 360 * (V ? 1.1 : 0.9), 0.4, t); }
      if (state === 'golden') s += CH.sparkles(W * 0.5, cityY - 250, 420, t, 2, 12);
      return { ink: s, hud: nameCard(spec, env, L, t) + (spec.title ? CH.plate(spec.title, { size: V ? 46 : 42, x: W / 2, y: V ? H * 0.16 : H * 0.09, accent: PAL.red }) : '') };
    },
  };
};

/* walls: side view of the Theodosian walls. {mode:'build|defend|bombard|breach', labels:[...], numbers:[{value, label}]} */
CH.T.walls = (spec, env) => {
  const L = CH.L(env), W = env.W, H = env.H, V = env.V;
  const mode = spec.mode || 'build';
  const gy = L.gy;
  const stat = CH.skyStatic(W, H, mode === 'breach' ? 'fire' : mode === 'bombard' ? 'dusk' : 'day', 'wsky' + env.beat.id) +
    CH.hills(W, H, gy - (V ? 300 : 220), env.seed, { amp: 40, fill: '#b9a880' }) + CH.ground(W, H, gy, { fill: '#cdb487', seed: env.seed });
  const wx0 = V ? W * 0.3 : W * 0.42, scale = V ? 1.25 : 1;
  return {
    focus: [V ? 0.55 : 0.62, 0.5], drift: 0.05,
    static: () => ({ ink: stat }),
    draw: ctx => {
      const t = ctx.t, dur = env.dur;
      let s = CH.clouds(W, H, t, env.seed, 3, 0.05, 0.2);
      const bq = mode === 'build' ? seg(t, 0.05 * dur, 0.75 * dur) : 1;
      // moat, outer wall, inner wall (the triple line)
      const dmg = mode === 'bombard' ? clamp(seg(t, 0.35 * dur, 0.9 * dur) * 1.2) : mode === 'breach' ? 1 : 0;
      s += CH.wall(wx0, W + 60, gy, 150 * scale, { build: clamp(bq * 2), towerGap: 200 * scale, towerW: 64 * scale, towerH: 200 * scale, seed: 2, damage: dmg * 0.6 });
      s += CH.wall(wx0 + 140 * scale, W + 60, gy - 150 * scale, 210 * scale, { build: clamp(bq * 2 - 1), towerGap: 260 * scale, towerW: 90 * scale, towerH: 280 * scale, seed: 5, damage: dmg });
      if (mode === 'breach') {
        const bx = wx0 + 90 * scale;
        s += path(`M${pt(bx - 70, gy)}L${pt(bx - 40, gy - 160 * scale)}L${pt(bx + 10, gy - 110 * scale)}L${pt(bx + 50, gy - 180 * scale)}L${pt(bx + 90, gy)}Z`, { fill: '#3a2f2a', ...INK(5) });
        for (let i = 0; i < 7; i++) s += CH.person({ ...CH.castMember({ who: i % 3 ? 'ottoman' : 'janissary' }), x: bx - 260 + ((t * 160 + i * 90) % 420), y: gy + 10 + (i % 2) * 18, s: 0.62 * scale, pose: 'run', f: 1, expr: 'furious', lod: 1, seed: i }, t);
        s += CH.smoke(bx, gy - 120, 1.2, t, 3, 6) + CH.embers(bx - 200, gy - 400, 400, 400, t, 2, 20);
      }
      if (mode === 'defend') {
        for (let i = 0; i < 5; i++) {                             // ladders and bouncing attackers
          const x = wx0 - 30 + i * 18, ph = (t * 0.8 + i * 0.37) % 1;
          s += path(`M${pt(x - 60, gy)}L${pt(x + 20, gy - 160 * scale)}M${pt(x - 30, gy)}L${pt(x + 50, gy - 160 * scale)}`, { stroke: '#8a5a33', 'stroke-width': 8 });
          const yy = gy - ph * 140 * scale, fall = ph > 0.75;
          s += CH.person({ ...CH.castMember({ who: spec.attacker || 'arab' }), x: x - 40 + ph * 40, y: fall ? gy - (1 - (ph - 0.75) * 4) * 140 * scale : yy, s: 0.42 * scale, pose: fall ? 'scared' : 'carry', expr: fall ? 'shock' : 'angry', lod: 1, seed: i, f: 1 }, t);
        }
        for (let i = 0; i < 4; i++) s += CH.person({ ...CH.castMember({ who: 'defender' }), x: wx0 + 60 * scale + i * 110 * scale, y: gy - 150 * scale + 4, s: 0.42 * scale, pose: i % 2 ? 'fight' : 'point', f: -1, lod: 1, seed: i + 9 }, t);
      }
      if (mode === 'bombard') {
        const fa = [0.15, 0.45, 0.75].map(u => u * dur);
        s += CH.cannon(V ? W * 0.12 : W * 0.14, gy - 30, V ? 0.55 : 0.62, t, { fireAt: fa[0] });
        fa.forEach((a, i) => { const hitT = a + 0.35; s += CH.burst(wx0 + 40 + i * 40, gy - (90 + i * 30) * scale, 110, hitT, t, { fill: PAL.fire1 }); });
        s += CH.smoke(wx0 + 60, gy - 150 * scale, 1, t, 9, 5, { wind: -30 });
      }
      if (mode === 'build') {
        for (let i = 0; i < 3; i++) s += CH.person({ ...CH.castMember({ who: 'builder' }), x: wx0 - (V ? 250 : 420) + i * (V ? 85 : 110), y: gy, s: 0.55 * scale, pose: i % 2 ? 'fight' : 'carry', prop: i % 2 ? 'hammer' : 'brick', expr: 'determined', seed: i + 2, f: 1 }, t);
      }
      (spec.numbers || []).forEach((n, i) => {
        const at = tAt(n.at, dur, (0.35 + i * 0.22) * dur);
        const pq = CH.pop(t, at, 0.4);
        if (pq.q <= 0) return;
        const x = V ? W * (i % 2 ? 0.72 : 0.28) : W * (0.18 + i * 0.22), y = V ? H * (0.29 + Math.floor(i / 2) * 0.12) : H * 0.22;
        s += CH.text(n.value, { kind: 'number', size: V ? 110 : 120, x, y, s: pq.s, opacity: pq.o }) + CH.plate(n.label, { size: V ? 30 : 30, x, y: y + (V ? 82 : 86), s: pq.s, opacity: pq.o });
      });
      return { ink: s, hud: nameCard(spec, env, L, t) + (spec.title ? CH.plate(spec.title, { size: V ? 46 : 44, x: W / 2, y: V ? H * 0.16 : H * 0.085, accent: PAL.red }) : '') };
    },
  };
};

/* battle: {left:{who, color, n, label, banner}, right:{...}, mode:'charge|clash|rout_left|rout_right', setting, captured} */
CH.T.battle = (spec, env) => {
  const L = CH.L(env), W = env.W, H = env.H, V = env.V;
  const setting = SETTINGS.includes(spec.setting) ? spec.setting : 'field';
  const mode = spec.mode || 'clash';
  const sides = [spec.left || { who: 'soldier' }, spec.right || { who: 'arab' }];
  const army = (side, k) => {
    const n = side.n || (V ? 5 : 8), out = [];
    const r = rng(env.seed + k);
    for (let i = 0; i < n; i++) {
      const row = i % 2, u = Math.floor(i / 2) / Math.ceil(n / 2);
      out.push({ ...CH.castMember({ who: side.who || 'soldier' }), robe: side.color ? col(side.color) : undefined, pose: 'run', expr: 'furious', lod: row ? 1 : 2, seed: Math.floor(r() * 1e5),
        bx: (k ? 1 - (0.04 + u * 0.36) : 0.04 + u * 0.36), row, s: (V ? 0.78 : 0.82) * (row ? 0.85 : 1), f: k ? -1 : 1 });
    }
    return out;
  };
  const armies = [army(sides[0], 0), army(sides[1], 1)];
  const stat = settingStatic(setting, env, L);
  return {
    focus: [0.5, 0.55], drift: 0.06,
    static: () => ({ ink: stat }),
    draw: ctx => {
      const t = ctx.t, dur = env.dur;
      let s = settingDynamic(setting, env, L, t);
      const meet = mode === 'charge' ? 0.85 * dur : 0.35 * dur;
      const adv = ease.inOut(seg(t, 0, meet));
      armies.forEach((a, k) => {
        const routed = (mode === 'rout_left' && k === 0) || (mode === 'rout_right' && k === 1);
        for (const m of a) {
          let x = m.bx * W + (k ? -1 : 1) * adv * W * 0.18;
          let ff = m.f, pose = m.pose, expr = m.expr;
          if (routed && t > meet) { const back = (t - meet) * 260; x += (k ? 1 : -1) * back; ff = -m.f; pose = 'run'; expr = 'scared'; }
          else if (t > meet && mode !== 'charge') pose = 'fight';
          s += CH.person({ ...m, x, y: L.gy - m.row * (V ? 80 : 60), f: ff, pose, expr, prop: m.prop === 'none' ? 'sword' : m.prop || 'spear' }, t);
        }
        const side = sides[k];
        if (side.banner !== false) { const bx = (k ? 0.88 : 0.12) * W + (k ? -1 : 1) * adv * W * 0.1; s += CH.person({ x: bx, y: L.gy - (V ? 150 : 110), s: V ? 0.5 : 0.46, f: k ? -1 : 1, hat: 'none', body: 'tunic', robe: side.color ? col(side.color) : PAL.red, pose: 'walk', prop: 'banner', propColor: side.color ? col(side.color) : (k ? PAL.green : PAL.purple), emblem: side.emblem || (k ? 'crescent' : 'chirho'), lod: 1, seed: k + 40 }, t); }
      });
      if (t > meet - 0.1 && mode !== 'charge' && !(spec.captured && t > 0.62 * dur)) s += CH.fightCloud(W / 2, L.gy - (V ? 210 : 190), V ? 1.15 : 1.15, t, env.seed);
      s += CH.smoke(W * 0.3, L.gy, 0.7, t, 21, 4, { fill: '#c9b48a', rise: 60, wind: 40 }) + CH.smoke(W * 0.7, L.gy, 0.7, t + 1, 22, 4, { fill: '#c9b48a', rise: 60, wind: -40 });
      if (spec.captured) {
        const q = seg(t, 0.6 * dur, 0.8 * dur);
        if (q > 0) s += CH.wrapPop(t, 0.6 * dur, W * (V ? 0.5 : 0.78), L.gy, CH.person({ ...CH.castMember({ who: spec.captured }), x: 0, y: 0, s: V ? 0.9 : 0.8, expr: 'shock', pose: 'scared', cage: true }, t) +
          path([...Array(6)].map((_, i) => `M${pt(-100 + i * 40, 0)}L${pt(-100 + i * 40, -320)}`).join('') + 'M-110,-320L110,-320', { stroke: '#6a4426', 'stroke-width': 13, 'stroke-linecap': 'round' }), 0.4);
      }
      let hud = nameCard(spec, env, L, t);
      sides.forEach((sd, k) => { if (sd.label) { const pq = CH.pop(t, 0.2 + k * 0.2, 0.35); if (pq.q > 0) hud += CH.plate(sd.label, { size: V ? 40 : 38, x: W * (k ? 0.78 : 0.22), y: V ? H * 0.3 : H * 0.3, s: pq.s, opacity: pq.o, plate: CH.shade(col(sd.color || (k ? PAL.green : PAL.purple)), 0.6) }); } });
      if (spec.title) hud += CH.plate(spec.title, { size: V ? 46 : 44, x: W / 2, y: V ? H * 0.16 : H * 0.085, accent: PAL.red });
      return { ink: s, hud };
    },
  };
};

/* naval: {greekfire:true, enemy:'arab|ottoman|crusader', label} */
CH.T.naval = (spec, env) => {
  const L = CH.L(env), W = env.W, H = env.H, V = env.V;
  const seaY = V ? H * 0.42 : H * 0.5;
  const stat = CH.skyStatic(W, H, spec.sky || 'dusk', 'nsky' + env.beat.id) + CH.seaStatic(W, H, seaY, {});
  const enemyFlag = { arab: PAL.green, ottoman: PAL.red, crusader: '#fbf6ea' }[spec.enemy || 'arab'];
  return {
    focus: [0.55, 0.55], drift: 0.06,
    static: () => ({ ink: stat }),
    draw: ctx => {
      const t = ctx.t, dur = env.dur;
      let s = CH.clouds(W, H, t, env.seed, 3, 0.05, 0.2) + CH.waves(W, H, seaY, t, env.seed, { rows: 6 });
      const fire = spec.greekfire === false ? 0 : seg(t, 0.15 * dur, 0.45 * dur);
      const burn = t > 0.45 * dur;
      // enemy fleet (right) and dromon (left)
      for (let i = 0; i < 3; i++) s += CH.ship(W * (V ? 0.62 + i * 0.16 : 0.66 + i * 0.12), seaY + (V ? 210 : 120) + (i % 2) * 70, V ? 0.6 : 0.55, t, { f: -1, flag: enemyFlag, seed: i + 5, burning: burn && i < 2, sink: burn && i === 0 ? seg(t, 0.7 * dur, dur) * 0.5 : 0 });
      s += CH.ship(V ? W * 0.28 : W * 0.24, seaY + (V ? 300 : 190), V ? 0.85 : 0.8, t, { siphon: true, fire: fire > 0 ? 0.4 + 0.6 * fire : 0, flag: PAL.purple, emblem: 'chirho', seed: 1 });
      if (burn) {                                                   // fire spreading on the water
        for (let i = 0; i < 6; i++) s += CH.flames(W * (V ? 0.45 + i * 0.09 : 0.5 + i * 0.08), seaY + (V ? 330 : 230) + (i % 2) * 30, 0.55, t, i + 11, 2);
        s += CH.smoke(W * 0.7, seaY + 40, 1.2, t, 7, 6, { wind: 30 });
      }
      let hud = nameCard(spec, env, L, t);
      if (spec.title) hud += CH.plate(spec.title, { size: V ? 46 : 44, x: W / 2, y: V ? H * 0.16 : H * 0.085, accent: PAL.red });
      return { ink: s, hud };
    },
  };
};

/* number: {value, from, prefix, suffix, label, icon, people, color, decimals, bg:'rays|plain', sub} */
CH.T.number = (spec, env) => {
  const L = CH.L(env), W = env.W, H = env.H, V = env.V;
  const value = Number(spec.value) || 0, from = Number(spec.from || 0);
  const stat = el('rect', { x: -60, y: -60, width: W + 120, height: H + 120, fill: spec.dark ? '#3a2f3a' : '#efe2c4' });
  const people = Math.min(140, spec.people || 0);
  const r = rng(env.seed);
  const crowd = [];
  const gcols = V ? 12 : 20, grows = Math.ceil(people / gcols);
  for (let i = 0; i < people; i++) crowd.push({ x: (i % gcols + 0.5 + (Math.floor(i / gcols) % 2) * 0.35) / gcols, y: (Math.floor(i / gcols) + 0.5) / Math.max(1, grows), d: r() * 0.9, robe: ['#4e7da0', '#b5452f', '#857858', '#6e8f4a', '#c9a26a'][Math.floor(r() * 5)] });
  return {
    focus: [0.5, 0.45], drift: 0.05,
    static: () => ({ ink: stat }),
    draw: ctx => {
      const t = ctx.t, dur = env.dur;
      let s = '';
      if (spec.bg !== 'plain') s += CH.rays(W / 2, L.cy, 60, Math.max(W, H), t, { n: 20, opacity: spec.dark ? 0.08 : 0.4, fill: spec.dark ? '#ffffff' : '#fff1c4' });
      const cq = ease.out(seg(t, 0.08 * dur, (spec.countDur ? tAt(spec.countDur, dur) : 0.6 * dur)));
      if (people) {
        const fade = spec.fade ? seg(t, 0.55 * dur, 0.9 * dur) : 0;
        crowd.forEach((c, i) => {
          if (c.d > cq) return;
          const x = W * (0.05 + c.x * 0.9), y = (V ? H * (0.45 + c.y * 0.2) : H * (0.6 + c.y * 0.34));
          s += CH.person({ x, y, s: V ? 0.22 : 0.19, robe: fade > c.d ? '#7a746c' : c.robe, skin: fade > c.d ? '#a9a39a' : PAL.skin, hat: 'none', hair: 'short', expr: fade > c.d ? 'sad' : 'neutral', lod: 0, shadow: false, seed: i }, t);
        });
      }
      if (spec.icon) s += CH.icon(spec.icon, W / 2, V ? H * 0.5 : H * 0.66, V ? 1.1 : 0.9, t, { spin: spec.icon === 'coin' });
      const v = from + (value - from) * cq;
      const dec = spec.decimals || (String(spec.value).includes('.') ? String(spec.value).split('.')[1].length : 0);
      const txt = (spec.prefix || '') + (dec ? v.toFixed(dec) : CH.fmtNum(v)) + (spec.suffix || '');
      const pq = CH.pop(t, 0.02, 0.35);
      const ny = people || spec.icon ? (V ? H * 0.22 : H * 0.17) : L.cy - (V ? 40 : 30);
      s += CH.text(txt, { kind: 'number', size: V ? 210 : 230, x: W / 2, y: ny, s: pq.s * (1 + 0.04 * Math.sin(Math.min(1, cq) * Math.PI)), opacity: pq.o, fill: col(spec.color || '#fff4dc'), maxW: W * 0.92, lines: 1 });
      if (spec.label) { const lq = CH.pop(t, 0.25 * dur, 0.35); if (lq.q > 0) s += CH.plate(spec.label, { size: V ? 46 : 46, x: W / 2, y: ny + (V ? 160 : 165), s: lq.s, opacity: lq.o, maxW: W * 0.9 }); }
      if (spec.sub) { const lq = CH.pop(t, 0.45 * dur, 0.35); if (lq.q > 0) s += CH.text(spec.sub, { kind: 'hand', size: V ? 46 : 44, x: W / 2, y: ny + (V ? 240 : 240), s: lq.s, opacity: lq.o, fill: spec.dark ? '#efe2c4' : ink, stroke: null, maxW: W * 0.85, upper: false }); }
      return s;
    },
  };
};

/* versus: two numbers with proportional figure grids. {left:{value,label,color,who}, right:{...}, unit, title} */
CH.T.versus = (spec, env) => {
  const W = env.W, H = env.H, V = env.V;
  const sides = [spec.left || {}, spec.right || {}];
  const vals = sides.map(sd => Number(sd.value) || 1);
  const unit = Number(spec.unit) || Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(...vals))) - 1));
  const counts = vals.map(v => Math.max(1, Math.min(120, Math.round(v / unit))));
  return {
    focus: [0.5, 0.5], drift: 0.035,
    static: () => ({ ink: el('rect', { x: -60, y: -60, width: W + 120, height: H + 120, fill: '#efe2c4' }) + (V ? '' : path(`M${f(W / 2)},${f(H * 0.08)}L${f(W / 2)},${f(H * 0.92)}`, { ...INK(4), 'stroke-dasharray': '10 14', opacity: 0.5 })) }),
    draw: ctx => {
      const t = ctx.t, dur = env.dur;
      let s = '';
      sides.forEach((sd, k) => {
        const c = col(sd.color || (k ? PAL.red : PAL.purple));
        const who = CH.castMember({ who: sd.who || (k ? 'janissary' : 'defender') });
        const cx = V ? W / 2 : W * (k ? 0.75 : 0.25);
        const top = V ? H * (k ? 0.3 : 0.1) : H * 0.1;
        const at = (0.08 + k * 0.28) * dur, q = ease.out(seg(t, at, at + 0.45 * dur));
        const n = counts[k], cols = V ? 13 : 10, cell = V ? 62 : 76;
        const rows = Math.ceil(n / cols), gw = Math.min(n, cols) * cell;
        const gy0 = top + (V ? 165 : 250);
        const shown = Math.floor(n * q);
        for (let i = 0; i < shown; i++) {
          const bx = cx - gw / 2 + (i % cols + 0.5) * cell, by = gy0 + Math.floor(i / cols) * cell * 0.95 + cell * 0.9;
          s += CH.person({ ...who, x: bx, y: by, s: cell / 330, robe: c, prop: 'none', expr: who.expr, lod: 0, shadow: false, seed: i + k * 100 }, t);
        }
        const pq = CH.pop(t, at, 0.35);
        if (pq.q > 0) {
          s += CH.text(CH.fmtNum(vals[k] * q), { kind: 'number', size: V ? 110 : 150, x: cx, y: top + (V ? 45 : 80), s: pq.s, opacity: pq.o, fill: '#fff4dc' });
          if (sd.label) s += CH.plate(sd.label, { size: V ? 32 : 38, x: cx, y: top + (V ? 118 : 185), s: pq.s, opacity: pq.o, plate: CH.shade(c, 0.65) });
        }
      });
      const note = spec.note || (unit > 1 ? `1 FIGURE = ${CH.fmtNum(unit)}` : '');
      if (note) { const pq = CH.pop(t, 0.6 * dur, 0.3); if (pq.q > 0) s += CH.text(note, { kind: 'hand', size: V ? 40 : 40, x: W / 2, y: V ? H * 0.655 : H * 0.95, stroke: null, fill: ink, upper: false, opacity: pq.o }); }
      return { ink: s, hud: spec.title ? CH.plate(spec.title, { size: V ? 40 : 44, x: W / 2, y: V ? H * 0.085 + 40 : H * 0.05, accent: PAL.red }) : '' };
    },
  };
};

/* split: two panels. {left:{cast:[...], icon, label, sub, bg}, right:{...}, divider:'crack|line', vs, title} */
CH.T.split = (spec, env) => {
  const W = env.W, H = env.H, V = env.V;
  const panels = [spec.left || {}, spec.right || {}];
  const bgs = panels.map((p, k) => col(p.bg || (k ? '#e9cfa9' : '#d7d9c0')));
  const mid = V ? H * 0.39 : W / 2;
  const stat = V
    ? el('rect', { x: -60, y: -60, width: W + 120, height: mid + 60, fill: bgs[0] }) + el('rect', { x: -60, y: mid, width: W + 120, height: H, fill: bgs[1] })
    : el('rect', { x: -60, y: -60, width: mid + 60, height: H + 120, fill: bgs[0] }) + el('rect', { x: mid, y: -60, width: W / 2 + 60, height: H + 120, fill: bgs[1] });
  // panel boxes: [x0, y0, w, h]
  const box = k => (V ? [0, k ? mid : H * 0.11, W, k ? H * 0.665 - mid : mid - H * 0.11] : [k ? mid : 0, 0, W / 2, H]);
  const casts = panels.map((p, k) => (p.cast || []).slice(0, 3).map((m, i) => {
    const o = CH.castMember(m), n = Math.min(3, (p.cast || []).length);
    const [x0, y0, bw, bh] = box(k);
    const xs = { 1: [0.5], 2: [0.3, 0.7], 3: [0.2, 0.5, 0.8] }[n];
    const sc = V ? ({ 1: 1.05, 2: 0.95, 3: 0.78 }[n]) : ({ 1: 1.5, 2: 1.3, 3: 1.0 }[n]);
    return { ...o, x: x0 + bw * xs[i], y: y0 + bh * (V ? 0.95 : 0.86), s: sc * (o.s || 1), f: o.f !== undefined ? o.f : (n === 1 ? (k ? -1 : 1) : (i < n / 2 ? 1 : -1)), seed: hash(o.who + k + i) % 9973 };
  }));
  return {
    focus: [0.5, 0.45], drift: 0.035,
    static: () => ({ ink: stat }),
    draw: ctx => {
      const t = ctx.t, dur = env.dur;
      let s = '';
      panels.forEach((p, k) => {
        const at = tAt(p.at, dur, (k ? 0.18 : 0) * dur);
        const [x0, y0, bw, bh] = box(k);
        const cx = x0 + bw / 2;
        if (p.icon) s += CH.wrapPop(t, at, cx, y0 + bh * (V ? 0.6 : 0.52), CH.icon(p.icon, 0, 0, V ? 1.35 : 1.9, t, { spin: p.icon === 'coin', dull: p.dull, color: p.iconColor }), 0.4);
        casts[k].forEach((m, i) => { s += CH.person({ ...m, enter: 'pop', delay: at + i * 0.15 }, t); if (m.say) s += V ? sideBubble(m, m.say, t, env, at + 0.4) : sayBubble(m, m.say, t, env, at + 0.4); });
        if (p.label) { const pq = CH.pop(t, at + 0.15, 0.35); if (pq.q > 0) s += CH.text(p.label, { kind: 'title', size: V ? 64 : 70, x: cx, y: y0 + (V ? 62 : H * 0.12), s: pq.s, opacity: pq.o, fill: p.labelColor ? col(p.labelColor) : '#ffcf3f', maxW: bw * 0.9, lines: 2 }); }
        if (p.sub) { const pq = CH.pop(t, at + 0.3, 0.35); if (pq.q > 0) s += CH.plate(p.sub, { size: V ? 30 : 34, x: cx, y: y0 + (V ? 128 : H * 0.215), s: pq.s, opacity: pq.o, maxW: bw * 0.92 }); }
      });
      const dq = seg(t, 0.05 * dur, 0.4 * dur);
      if (spec.divider === 'crack') s += V ? CH.crack(-20, mid, W + 40, 0, dq, 4, { w: 10 }) : CH.crack(mid, -20, H + 40, Math.PI / 2, dq, 4, { w: 10 });
      else s += V ? path(`M-60,${f(mid)}L${W + 60},${f(mid)}`, INK(8)) : path(`M${f(mid)},-60L${f(mid)},${H + 60}`, INK(8));
      if (spec.vs) { const pq = CH.pop(t, 0.3 * dur, 0.3); if (pq.q > 0) s += CH.text(spec.vs, { kind: 'title', size: V ? 80 : 100, x: W / 2, y: V ? mid : H * 0.5, fill: PAL.red, s: pq.s, opacity: pq.o }); }
      return { ink: s, hud: spec.title ? CH.plate(spec.title, { size: V ? 40 : 44, x: W / 2, y: V ? H * 0.085 + 40 : H * 0.07, accent: PAL.red }) : '' };
    },
  };
};

/* symbol: one big icon. {icon, label, sub, anim:'pop|spin|float|dip|squeeze|shake|draw', bg:'rays|plain|dark', extra:[{icon, x, y, s}]} */
CH.T.symbol = (spec, env) => {
  const L = CH.L(env), W = env.W, H = env.H, V = env.V;
  const dark = spec.bg === 'dark';
  const stat = el('rect', { x: -60, y: -60, width: W + 120, height: H + 120, fill: dark ? '#3a2f3a' : spec.bg === 'water' ? '#a9c7c4' : '#efe2c4' });
  return {
    focus: [0.5, 0.45], drift: 0.06,
    static: () => ({ ink: stat }),
    draw: ctx => {
      const t = ctx.t, dur = env.dur;
      let s = '';
      if (spec.bg === 'rays' || spec.bg === undefined) s += CH.rays(W / 2, L.cy, 60, Math.max(W, H), t, { n: 18, opacity: 0.45 });
      if (spec.bg === 'water') s += CH.waves(W, H, H * 0.55, t, 3, { rows: 5 });
      const anim = spec.anim || 'pop';
      const cx = W / 2, cy = L.cy + (V ? -20 : 0);
      const sc = (spec.scale || 1) * (V ? 2.0 : 2.3);
      let inner, extraT = '';
      const o = { spin: anim === 'spin', dull: anim === 'dip' ? seg(t, 0.35 * dur, 0.8 * dur) : 0, color: spec.color, emblem: spec.emblem };
      if (anim === 'dip') {                                       // dunk into water and come out duller
        const dq = Math.sin(clamp(seg(t, 0.25 * dur, 0.85 * dur)) * Math.PI);
        inner = CH.icon(spec.icon, 0, dq * 260, sc, t, o);
        extraT = path(`M-60,${f(cy + 120)}Q${f(W * 0.25)},${f(cy + 100 + Math.sin(t * 3) * 10)} ${f(W / 2)},${f(cy + 120)}T${W + 60},${f(cy + 120)}L${W + 60},${H + 60}L-60,${H + 60}Z`, { fill: '#7fb0c4', opacity: 0.85, ...INK(5) });
      } else if (anim === 'squeeze') {
        const q = Math.sin(clamp(seg(t, 0.2 * dur, 0.6 * dur)) * Math.PI);
        inner = `<g transform="scale(${f(1 + 0.25 * q)} ${f(1 - 0.2 * q)})">${CH.icon(spec.icon, 0, 0, sc, t, o)}</g>`;
      } else if (anim === 'shake') {
        inner = `<g transform="rotate(${f(Math.sin(t * 30) * 4 * seg(t, 0.2 * dur, 0.4 * dur))})">${CH.icon(spec.icon, 0, 0, sc, t, o)}</g>`;
      } else if (anim === 'fall') {
        const q = seg(t, 0.05 * dur, 0.6 * dur);
        const yy = -(1 - ease.bounce(q)) * H * 0.7, rot = ease.out(seg(t, 0.45 * dur, 0.9 * dur)) * (spec.tilt || 24);
        inner = `<g transform="translate(0 ${f(yy)}) rotate(${f(rot)} 0 100)">${CH.icon(spec.icon, 0, 0, sc, t, o)}</g>`;
      } else if (anim === 'float') {
        inner = CH.icon(spec.icon, 0, Math.sin(t * 2) * 14, sc, t, o);
      } else inner = CH.icon(spec.icon, 0, 0, sc, t, o);
      if (spec.gather) spec.gather.forEach((ic, i) => {          // icons fly into the main one
        const a = (i / spec.gather.length) * Math.PI * 2 + 0.6, R = Math.max(W, H) * 0.42;
        const q = ease.in(seg(t, (0.08 + i * 0.07) * dur, (0.38 + i * 0.07) * dur));
        if (q >= 1) return;
        s += CH.icon(ic, cx + Math.cos(a) * R * (1 - q), cy + Math.sin(a) * R * 0.75 * (1 - q), 0.55 * (1 - q * 0.7), t, {});
      });
      s += anim === 'fall' ? `<g transform="translate(${f(cx)} ${f(cy)})">${inner}</g>` : CH.wrapPop(t, 0.02, cx, cy, inner, 0.45);
      s += extraT;
      if (spec.sparkle !== false && !dark) s += CH.sparkles(cx, cy, 260, t, env.seed, 8);
      (spec.extra || []).forEach((e, i) => {
        const at = tAt(e.at, dur, (0.3 + i * 0.15) * dur);
        s += CH.wrapPop(t, at, W * (e.x !== undefined ? e.x : (i % 2 ? 0.8 : 0.2)), H * (e.y !== undefined ? e.y : (V ? 0.25 : 0.3)), CH.icon(e.icon, 0, 0, e.s || 0.6, t, {}), 0.35);
      });
      if (spec.stamp) {                                           // a rubber stamp slams a word across the icon
        const at = tAt(spec.stampAt, dur, 0.4 * dur), q = seg(t, at, at + 0.18);
        if (q > 0) s += `<g transform="translate(${f(cx)} ${f(cy)}) rotate(-12) scale(${f(1 + (1 - ease.out(q)) * 1.2)})" opacity="${f(clamp(q * 2))}">${el('rect', { x: -330, y: -70, width: 660, height: 140, rx: 14, fill: 'none', stroke: PAL.red, 'stroke-width': 14 })}${CH.text(spec.stamp, { kind: 'title', size: 110, fill: PAL.red, stroke: null, shadow: false, maxW: 600, lines: 1 })}</g>`;
      }
      if (spec.cross) { const q = seg(t, tAt(spec.crossAt, dur, 0.5 * dur), tAt(spec.crossAt, dur, 0.5 * dur) + 0.4); if (q > 0) s += path(`M${f(cx - 260)},${f(cy - 260)}L${f(cx + 260)},${f(cy + 260)}M${f(cx + 260)},${f(cy - 260)}L${f(cx - 260)},${f(cy + 260)}`, { fill: 'none', stroke: PAL.red, 'stroke-width': 40, 'stroke-linecap': 'round', ...CH.draw(q) }); }
      let hud = '';
      if (spec.label) { const pq = CH.pop(t, 0.2 * dur, 0.35); if (pq.q > 0) hud += CH.text(spec.label, { kind: 'title', size: V ? 84 : 90, x: W / 2, y: V ? H * 0.2 : H * 0.14, s: pq.s, opacity: pq.o, maxW: W * 0.9, lines: 2, fill: dark ? '#ffcf3f' : '#fff4dc' }); }
      if (spec.sub) { const pq = CH.pop(t, 0.35 * dur, 0.35); if (pq.q > 0) hud += CH.plate(spec.sub, { size: V ? 38 : 38, x: W / 2, y: V ? H * 0.61 : H * 0.88, s: pq.s, opacity: pq.o, maxW: W * 0.9 }); }
      return { ink: s, hud };
    },
  };
};

/* icons: a row/grid of icons popping in one by one. {items:[{icon,label}], title} */
CH.T.icons = (spec, env) => {
  const W = env.W, H = env.H, V = env.V;
  const items = (spec.items || []).slice(0, 6);
  return {
    focus: [0.5, 0.5], drift: 0.04,
    static: () => ({ ink: el('rect', { x: -60, y: -60, width: W + 120, height: H + 120, fill: '#efe2c4' }) }),
    draw: ctx => {
      const t = ctx.t, dur = env.dur, n = items.length;
      let s = CH.rays(W / 2, H * 0.5, 60, Math.max(W, H), t, { n: 18, opacity: 0.3 });
      items.forEach((it, i) => {
        const at = tAt(it.at, dur, (0.08 + i * (0.7 / Math.max(1, n))) * dur);
        let x, y;
        if (V) { const cols = n > 3 ? 2 : 1; x = W * (cols === 1 ? 0.5 : (i % 2 ? 0.73 : 0.27)); y = H * (cols === 1 ? 0.25 + i * 0.145 : 0.26 + Math.floor(i / cols) * 0.19); }
        else { x = W * (i + 0.5) / n; y = H * 0.52; }
        const sc = V ? (n > 3 ? 0.75 : 0.72) : Math.min(1.25, 3.4 / n);
        s += CH.wrapPop(t, at, x, y, CH.icon(it.icon, 0, -20, sc, t, { spin: it.icon === 'coin' }) + (it.label ? CH.plate(it.label, { size: V ? 36 : 38, x: 0, y: 150 * sc + 30, maxW: V ? W * 0.9 : W / n * 0.95 }) : ''), 0.4);
      });
      return { ink: s, hud: spec.title ? CH.text(spec.title, { kind: 'title', size: V ? 70 : 84, x: W / 2, y: V ? H * 0.155 : H * 0.14, maxW: W * 0.9, s: CH.pop(t, 0.02, 0.35).s }) : '' };
    },
  };
};

/* title: {text, sub, icons:[...], bg:'rays|city|plain', date} */
CH.T.title = (spec, env) => {
  const L = CH.L(env), W = env.W, H = env.H, V = env.V;
  const stat = spec.bg === 'city' ? CH.T.city({ state: 'golden' }, env).static().ink : el('rect', { x: -60, y: -60, width: W + 120, height: H + 120, fill: spec.dark ? '#3a2f3a' : '#efe2c4' });
  const cityDraw = spec.bg === 'city' ? CH.T.city({ state: 'golden', ships: 2 }, env).draw : null;
  return {
    focus: [0.5, 0.45], drift: 0.05,
    static: () => ({ ink: stat }),
    draw: ctx => {
      const t = ctx.t, dur = env.dur;
      let s = cityDraw ? cityDraw(ctx).ink : CH.rays(W / 2, L.cy, 60, Math.max(W, H), t, { n: 22, opacity: spec.dark ? 0.08 : 0.5 });
      const icons = spec.icons || [];
      const spots = V ? [[0.24, 0.2], [0.76, 0.2], [0.24, 0.58], [0.76, 0.58], [0.5, 0.15], [0.5, 0.63]] : [[0.13, 0.2], [0.87, 0.2], [0.13, 0.8], [0.87, 0.8], [0.5, 0.12], [0.5, 0.88]];
      icons.slice(0, 6).forEach((ic, i) => {
        const [ux, uy] = spots[i];
        s += CH.wrapPop(t, (0.2 + i * 0.1) * dur, W * ux, H * uy + Math.sin(t * 2 + i) * 8, CH.icon(ic, 0, 0, V ? 0.85 : 0.9, t, {}), 0.35);
      });
      const pq = CH.pop(t, 0.05, 0.45);
      let hud = '';
      if (pq.q > 0) {
        const plateW = V ? W * 0.9 : W * 0.66;
        hud += `<g transform="${CH.tr(W / 2, L.cy, pq.s)}" opacity="${f(pq.o)}">${el('rect', { x: -plateW / 2, y: -150, width: plateW, height: 300, rx: 30, fill: spec.dark ? '#5a2f55' : PAL.purple, ...INK(8) })}${el('rect', { x: -plateW / 2 + 18, y: -132, width: plateW - 36, height: 264, rx: 22, fill: 'none', stroke: PAL.gold, 'stroke-width': 6 })}` +
          CH.text(spec.text || '', { kind: 'title', size: V ? 96 : 104, maxW: plateW - 80, lines: 2, fill: '#ffcf3f' }) + '</g>';
        if (spec.sub) hud += CH.plate(spec.sub, { size: V ? 40 : 40, x: W / 2, y: L.cy + 190, s: CH.pop(t, 0.3 * dur, 0.35).s, accent: spec.date ? PAL.red : null });
      }
      return { ink: s, hud };
    },
  };
};

/* timeline: {from, to, marks:[{year,label}], current, label} */
CH.T.timeline = (spec, env) => {
  const W = env.W, H = env.H, V = env.V;
  const a = Number(spec.from || 300), b = Number(spec.to || 1500);
  const marks = spec.marks || [];
  return {
    focus: [0.5, 0.5], drift: 0.04,
    static: () => ({ ink: el('rect', { x: -60, y: -60, width: W + 120, height: H + 120, fill: '#efe2c4' }) }),
    draw: ctx => {
      const t = ctx.t, dur = env.dur;
      let s = '';
      const x0 = V ? W * 0.5 : W * 0.08, x1 = V ? W * 0.5 : W * 0.92, y0 = V ? H * 0.16 : H * 0.55, y1 = V ? H * 0.64 : H * 0.55;
      const P = yr => { const u = (yr - a) / (b - a); return [CH.lerp(x0, x1, u), CH.lerp(y0, y1, u)]; };
      const dq = ease.out(seg(t, 0, 0.35 * dur));
      s += path(`M${pt(x0, y0)}L${pt(CH.lerp(x0, x1, dq), CH.lerp(y0, y1, dq))}`, { stroke: ink, 'stroke-width': 30, 'stroke-linecap': 'round' }) +
        path(`M${pt(x0, y0)}L${pt(CH.lerp(x0, x1, dq), CH.lerp(y0, y1, dq))}`, { stroke: PAL.gold, 'stroke-width': 18, 'stroke-linecap': 'round' });
      marks.forEach((m, i) => {
        const [x, y] = P(Number(m.year));
        const at = tAt(m.at, dur, (0.15 + i * 0.6 / Math.max(1, marks.length)) * dur);
        const pq = CH.pop(t, at, 0.35);
        if (pq.q <= 0) return;
        s += el('circle', { cx: x, cy: y, r: 18 * pq.s, fill: m.color ? col(m.color) : PAL.red, ...INK(5) });
        const off = V ? (i % 2 ? 1 : -1) * 250 : (i % 2 ? 1 : -1) * 120;
        s += CH.text(String(m.year), { kind: 'date', size: V ? 52 : 48, x: V ? x + off : x, y: V ? y - 26 : y + off * 0.75 - 26, s: pq.s, opacity: pq.o, fill: ink, stroke: null }) +
          (m.label ? CH.plate(m.label, { size: V ? 30 : 28, x: V ? x + off : x, y: V ? y + 34 : y + off * 0.75 + 34, s: pq.s, opacity: pq.o, maxW: V ? W * 0.42 : W * 0.24 }) : '');
      });
      if (spec.current !== undefined) {
        const cq = ease.inOut(seg(t, 0.3 * dur, 0.85 * dur));
        const yr = a + (Number(spec.current) - a) * cq;
        const [x, y] = P(yr);
        s += `<g transform="translate(${f(x)} ${f(y)})">${path(V ? 'M-60,-30L-20,0L-60,30Z' : 'M-30,-80L30,-80L0,-34Z', { fill: PAL.red, ...INK(4) })}</g>`;
        s += CH.text(String(Math.round(yr)), { kind: 'number', size: V ? 100 : 130, x: V ? W * 0.5 - 250 : x, y: V ? y : H * 0.3, fill: '#fff4dc' });
      }
      return { ink: s, hud: spec.label ? CH.plate(spec.label, { size: V ? 44 : 44, x: W / 2, y: V ? H * 0.69 : H * 0.15, accent: PAL.red }) : '' };
    },
  };
};

/* construction: Hagia Sophia (or walls) rising with builders. {building:'hagia_sophia|walls', label, sub} */
CH.T.construction = (spec, env) => {
  const L = CH.L(env), W = env.W, H = env.H, V = env.V;
  const stat = CH.skyStatic(W, H, 'day', 'bsky' + env.beat.id) + CH.hills(W, H, L.gy - 120, env.seed, { amp: 40, fill: '#c9b07a' }) + CH.ground(W, H, L.gy, { fill: '#d8c08c', seed: env.seed });
  const builders = [0.12, 0.28, 0.72, 0.88].map((x, i) => ({ ...CH.castMember({ who: 'builder' }), x: W * (V ? [0.12, 0.3, 0.7, 0.88][i] : x), y: L.gy, s: V ? 0.62 : 0.6, pose: i % 2 ? 'fight' : 'carry', prop: i % 2 ? 'hammer' : 'brick', f: x < 0.5 ? 1 : -1, seed: i + 3 }));
  return {
    focus: [0.5, 0.45], drift: 0.05,
    static: () => ({ ink: stat }),
    draw: ctx => {
      const t = ctx.t, dur = env.dur;
      let s = CH.clouds(W, H, t, env.seed, 3, 0.05, 0.2);
      const q0 = spec.start || 0;
      const q = q0 + (1 - q0) * ease.inOut(seg(t, tAt(spec.from, dur, 0.05 * dur), tAt(spec.to, dur, 0.9 * dur)));
      const hs = (V ? 1.4 : 1.35) * (spec.scale || 1);
      s += CH.hagiaSophia(W / 2, L.gy, hs, { build: q * (spec.max || 1) });
      if (spec.measure) {
        const mq = ease.out(seg(t, 0.25 * dur, 0.6 * dur)), y = L.gy - 440 * hs, half = 0.2 * 620 * hs;
        if (mq > 0) {
          s += path(`M${pt(W / 2 - half * mq, y)}L${pt(W / 2 + half * mq, y)}`, { stroke: PAL.red, 'stroke-width': 8, 'stroke-linecap': 'round' });
          s += path(`M${pt(W / 2 - half, y - 22)}l0,44M${pt(W / 2 + half, y - 22)}l0,44`, { stroke: PAL.red, 'stroke-width': 7, opacity: f(mq) });
          s += CH.plate(spec.measure, { size: V ? 44 : 42, x: W / 2, y: y - 64, s: CH.pop(t, 0.45 * dur, 0.3).s, accent: PAL.red });
        }
      }
      // scaffolding
      if (q < 0.98 && !spec.noScaffold) s += path([...Array(7)].map((_, i) => `M${pt(W / 2 - 330 * hs + i * 110 * hs, L.gy)}L${pt(W / 2 - 330 * hs + i * 110 * hs, L.gy - 440 * hs)}`).join('') + [...Array(4)].map((_, k) => `M${pt(W / 2 - 340 * hs, L.gy - 110 * hs * (k + 1))}L${pt(W / 2 + 340 * hs, L.gy - 110 * hs * (k + 1))}`).join(''), { stroke: '#8a5a33', 'stroke-width': 7, opacity: f(0.9 - q * 0.6) });
      if (q < 0.999) { for (const b of builders) s += CH.person(b, t); s += CH.smoke(W * 0.3, L.gy - 40, 0.4, t, 4, 3, { rise: 80 }); }
      else { s += CH.sparkles(W / 2, L.gy - 300 * hs, 360 * hs, t, 5, 9); for (const b of builders) s += CH.person({ ...b, pose: 'cheer', prop: 'none', expr: 'laugh' }, t); }
      return { ink: s, hud: nameCard(spec, env, L, t) };
    },
  };
};

/* image: an AI still (flat layer) with Ken Burns and atmosphere. {kb:'in|out|left|right', fx:['embers','smoke','dust','rays','snow','fire','rain'], label, sub} */
CH.T.image = (spec, env) => {
  const W = env.W, H = env.H, V = env.V;
  const url = env.image;
  const kb = spec.kb || 'in';
  const fx = spec.fx || [];
  return {
    focus: spec.focus || [0.5, 0.5], drift: 0,
    camera: ctx => ({ x: W / 2, y: H / 2, z: 1 }),
    static: () => ({ ink: '' }),
    draw: ctx => {
      const t = ctx.t, p = ease.sine(ctx.p);
      let flat = '';
      if (url) {
        const z = kb === 'out' ? 1.12 - 0.1 * p : 1.02 + 0.1 * p;
        const fx0 = (spec.focus || [0.5, 0.5])[0], fy0 = (spec.focus || [0.5, 0.5])[1];
        let dx = (fx0 - 0.5) * W * (z - 1) * -1.6, dy = (fy0 - 0.5) * H * (z - 1) * -1.6;
        if (kb === 'left') dx += (0.5 - p) * W * 0.06;
        if (kb === 'right') dx -= (0.5 - p) * W * 0.06;
        flat += `<image href="${url}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" transform="translate(${f(W / 2 + dx)} ${f(H / 2 + dy)}) scale(${z.toFixed(4)}) translate(${f(-W / 2)} ${f(-H / 2)})"/>`;
      } else {
        flat += el('rect', { width: W, height: H, fill: '#d8c8a8' });
        flat += `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-family="Montserrat" font-weight="600" font-size="34" fill="#6b5d4f">[illustration: beat ${env.beat.id}]</text>`;
      }
      let s = '';
      if (fx.includes('rays')) s += CH.lightShafts(W * 0.5, -60, W, H, t, { n: 6 });
      if (fx.includes('dust')) s += CH.dust(W, H, t, 3, 50);
      if (fx.includes('embers')) s += CH.embers(0, 0, W, H, t, 3, 60);
      if (fx.includes('smoke')) s += CH.smoke(W * 0.2, H * 0.5, 1.4, t, 2, 5, { fill: '#6f665e' }) + CH.smoke(W * 0.8, H * 0.55, 1.4, t + 1.3, 5, 5, { fill: '#6f665e' });
      if (fx.includes('snow')) s += CH.snow(W, H, t, 3, 70);
      if (fx.includes('fire')) for (let i = 0; i < 4; i++) s += CH.flames(W * (0.1 + i * 0.27), H + 10, 1.1, t, i + 3, 2);
      let hud = '';
      if (spec.label) { const pq = CH.pop(t, tAt(spec.labelAt, env.dur, 0.2 * env.dur), 0.35); if (pq.q > 0) hud += CH.text(spec.label, { kind: 'title', size: V ? 88 : 92, x: W / 2, y: V ? H * 0.2 : H * 0.13, s: pq.s, opacity: pq.o, fill: '#ffcf3f', maxW: W * 0.9, lines: 2 }); }
      if (spec.sub) { const pq = CH.pop(t, tAt(spec.subAt, env.dur, 0.35 * env.dur), 0.35); if (pq.q > 0) hud += CH.plate(spec.sub, { size: V ? 38 : 38, x: W / 2, y: V ? H * 0.6 : H * 0.88, s: pq.s, opacity: pq.o, maxW: W * 0.9 }); }
      return { flat, ink: s, hud };
    },
  };
};

/* stamp: a scholar stamps a word onto a book (renaming). {who, word, onto:'book|scroll', old} */
CH.T.stamp = (spec, env) => {
  const L = CH.L(env), W = env.W, H = env.H, V = env.V;
  const stat = settingStatic('study', env, L);
  const m = { ...CH.castMember({ who: spec.who || 'wolf' }), x: W * (V ? 0.26 : 0.24), y: L.gy, s: V ? 1.25 : 1.3, f: 1, seed: 5 };
  return {
    focus: [0.55, 0.55], drift: 0.05,
    static: () => ({ ink: stat }),
    draw: ctx => {
      const t = ctx.t, dur = env.dur;
      let s = '';
      const dx = V ? W * 0.62 : W * 0.6, dy = L.gy - (V ? 190 : 170);
      s += el('rect', { x: dx - (V ? 260 : 330), y: dy, width: V ? 520 : 660, height: 40, fill: '#7a5232', ...INK(5) }) + el('rect', { x: dx - (V ? 230 : 300), y: dy + 40, width: 30, height: L.gy - dy - 40, fill: '#6a4426', ...INK(4) }) + el('rect', { x: dx + (V ? 200 : 270), y: dy + 40, width: 30, height: L.gy - dy - 40, fill: '#6a4426', ...INK(4) });
      s += `<g transform="translate(${f(dx)} ${f(dy - 6)})">${el('rect', { x: -220, y: -150, width: 440, height: 150, rx: 8, fill: '#f6ecd0', ...INK(5) })}${path('M0,-150L0,0', INK(3))}${path('M-190,-110L-30,-110M-190,-80L-40,-80M30,-110L190,-110M30,-80L170,-80', INK(2.5))}</g>`;
      if (spec.old) s += CH.text(spec.old, { kind: 'title', size: 54, x: dx, y: dy - 40, fill: PAL.purple, stroke: null, shadow: false, opacity: 1 - seg(t, 0.5 * dur, 0.6 * dur) * 0.6 });
      const at = 0.35 * dur, q = seg(t, at, at + 0.25);
      const lift = q < 1 ? (1 - ease.in(q)) * 260 : seg(t, at + 0.5, at + 0.9) * 200;
      if (q >= 1) s += `<g transform="translate(${f(dx)} ${f(dy - 70)}) rotate(-8)">${el('rect', { x: -200, y: -50, width: 400, height: 100, rx: 10, fill: 'none', stroke: PAL.red, 'stroke-width': 10 })}${CH.text(spec.word || 'BYZANTINE', { kind: 'title', size: 70, fill: PAL.red, stroke: null, shadow: false, maxW: 380, lines: 1 })}</g>`;
      s += CH.burst(dx, dy - 70, 220, at + 0.25, t, { fill: '#fff1c4' });
      s += `<g transform="translate(${f(dx)} ${f(dy - 120 - lift)})">${el('rect', { x: -150, y: -20, width: 300, height: 50, rx: 8, fill: '#8a2f20', ...INK(5) })}${el('rect', { x: -30, y: -150, width: 60, height: 130, rx: 10, fill: '#6a4426', ...INK(5) })}${el('circle', { cx: 0, cy: -170, r: 44, fill: '#6a4426', ...INK(5) })}</g>`;
      s += CH.person({ ...m, pose: q > 0 && q < 1 ? 'point' : 'present', expr: q >= 1 ? 'smug' : 'sly' }, t);
      return { ink: s, hud: nameCard(spec, env, L, t) };
    },
  };
};

/* collapse: a Roman temple topples. {label, date, setting} */
CH.T.collapse = (spec, env) => {
  const L = CH.L(env), W = env.W, H = env.H, V = env.V;
  const stat = CH.skyStatic(W, H, spec.sky || 'storm', 'rsky' + env.beat.id) + CH.hills(W, H, L.gy - 90, env.seed, { amp: 40, fill: '#a9a07a' }) + CH.ground(W, H, L.gy, { fill: '#b8a888', seed: env.seed });
  return {
    focus: [0.5, 0.55], drift: 0.07,
    static: () => ({ ink: stat }),
    draw: ctx => {
      const t = ctx.t, dur = env.dur;
      const q = ease.inOut(seg(t, 0.12 * dur, 0.85 * dur));
      const shake = q > 0 && q < 1 ? Math.sin(t * 50) * 6 * (1 - q) : 0;
      let s = CH.clouds(W, H, t * 2, env.seed, 4, 0.03, 0.2, { fill: '#cfd2cc' });
      s += `<g transform="translate(${f(shake)} 0)">${CH.temple(W / 2, L.gy, V ? 640 : 760, V ? 560 : 620, { collapse: q, seed: 7, n: 6 })}</g>`;
      if (q > 0.35) s += CH.smoke(W * 0.38, L.gy - 20, 1.3, t, 4, 7, { fill: '#c9b89a', rise: 160, wind: -50 }) + CH.smoke(W * 0.62, L.gy - 20, 1.3, t + 1, 6, 7, { fill: '#c9b89a', rise: 160, wind: 50 });
      let hud = '';
      if (spec.label) { const pq = CH.pop(t, 0.05, 0.35); if (pq.q > 0) hud += CH.text(spec.label, { kind: 'title', size: V ? 120 : 130, x: W / 2, y: V ? H * 0.31 : H * 0.14, s: pq.s, opacity: pq.o, fill: '#fff4dc' }); }
      if (spec.date) { const pq = CH.pop(t, 0.3 * dur, 0.35); if (pq.q > 0) hud += CH.plate(spec.date, { kind: 'date', size: V ? 60 : 58, x: W / 2, y: V ? H * 0.385 : H * 0.27, s: pq.s, opacity: pq.o, accent: PAL.red }); }
      return { ink: s, hud };
    },
  };
};

/* question: big question mark, optional character and text. {text, cast} */
CH.T.question = (spec, env) => {
  const L = CH.L(env), W = env.W, H = env.H, V = env.V;
  const cast = spec.cast ? layoutCast(spec.cast, env, L) : [];
  return {
    focus: [0.5, 0.45], drift: 0.06,
    static: () => ({ ink: settingStatic(spec.setting || 'plain', env, L) }),
    draw: ctx => {
      const t = ctx.t, dur = env.dur;
      let s = CH.rays(W / 2, L.cy, 60, Math.max(W, H), t, { n: 18, opacity: 0.4 });
      s += CH.wrapPop(t, 0.05, cast.length ? W * (V ? 0.5 : 0.72) : W / 2, cast.length && V ? H * 0.27 : L.cy - 30, CH.icon('question', 0, 0, V ? 1.3 : 1.5, t), 0.45);
      cast.forEach(m => { s += CH.person({ ...m, x: cast.length === 1 && !V ? W * 0.32 : m.x }, t); });
      let hud = '';
      if (spec.text) { const pq = CH.pop(t, 0.25 * dur, 0.35); if (pq.q > 0) hud += CH.plate(spec.text, { size: V ? 44 : 46, x: W / 2, y: V ? H * 0.6 : H * 0.9, s: pq.s, opacity: pq.o, maxW: W * 0.9 }); }
      return { ink: s, hud };
    },
  };
};

/* cta: {text, sub, who} */
CH.T.cta = (spec, env) => {
  const L = CH.L(env), W = env.W, H = env.H, V = env.V;
  const m = { ...CH.castMember({ who: spec.who || 'constantine11' }), x: W * (V ? 0.5 : 0.27), y: L.gy, s: V ? 1.4 : 1.5, f: 1, pose: 'wave', expr: 'happy', prop: 'none', seed: 4 };
  return {
    focus: [0.5, 0.5], drift: 0.04,
    static: () => ({ ink: settingStatic('city', env, L) }),
    draw: ctx => {
      const t = ctx.t, dur = env.dur;
      let s = settingDynamic('city', env, L, t);
      s += CH.person(m, t);
      const bx = V ? W / 2 : W * 0.66, by = V ? H * 0.24 : H * 0.42;
      const pq = CH.pop(t, 0.15 * dur, 0.4);
      if (pq.q > 0) s += `<g transform="${CH.tr(bx, by, pq.s * (1 + 0.03 * Math.sin(t * 5)))}" opacity="${f(pq.o)}">${el('rect', { x: -260, y: -70, width: 520, height: 140, rx: 40, fill: '#c4302b', ...INK(8) })}${CH.text(spec.text || 'SUBSCRIBE', { kind: 'title', size: 76, fill: '#ffffff', maxW: 460, lines: 1 })}</g>`;
      if (spec.sub) { const sq = CH.pop(t, 0.35 * dur, 0.35); if (sq.q > 0) s += CH.plate(spec.sub, { size: V ? 34 : 34, x: bx, y: by + 130, s: sq.s, opacity: sq.o, maxW: V ? W * 0.9 : W * 0.6 }); }
      return s;
    },
  };
};
})();
