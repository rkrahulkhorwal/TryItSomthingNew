/* Chronicle animation runtime - core.
 *
 * Every frame is a pure function of time: CH.renderAt(T) rebuilds the SVG for global time T, so any number of
 * browser pages can render disjoint frame ranges in parallel and get identical results.
 *
 * Layers (bottom to top):  paper colour | flat (AI stills, no wobble) | ink (all line art, wobbled by an SVG
 * displacement filter whose seed "boils" ~10x per second) | paper texture (multiply) | ui (captions, header,
 * progress bar) | flash.
 */
'use strict';
const CH = window.CH = {};

// ------------------------------------------------------------------------------------------------ math
CH.clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
CH.lerp = (a, b, t) => a + (b - a) * t;
CH.seg = (t, a, b) => CH.clamp((t - a) / Math.max(1e-6, b - a));
CH.ease = {
  lin: x => x,
  in: x => x * x * x,
  out: x => 1 - Math.pow(1 - x, 3),
  inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  sine: x => 0.5 - 0.5 * Math.cos(Math.PI * x),
  back: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  elastic: x => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
  bounce: x => {
    const n1 = 7.5625, d1 = 2.75;
    if (x < 1 / d1) return n1 * x * x;
    if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
    if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
    return n1 * (x -= 2.625 / d1) * x + 0.984375;
  },
};
CH.rng = seed => {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
CH.hash = s => {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
// smooth 1-D value noise in [-1, 1]
CH.noise = (x, seed = 0) => {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  const h = n => { const v = Math.sin((n + seed * 131.7) * 127.1) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };
  return h(i) * (1 - u) + h(i + 1) * u;
};
CH.f = n => (Math.round(n * 10) / 10);           // compact numbers in SVG strings
CH.pt = (x, y) => `${CH.f(x)},${CH.f(y)}`;

// ------------------------------------------------------------------------------------------------ palette
CH.PAL = {
  ink: '#1f1a17', paper: '#efe2c4', paper2: '#e4d2a9', cream: '#fff4dc', white: '#fbf6ea',
  skin: '#f7e4c4', cheek: '#e98c78',
  purple: '#6e2f66', purple2: '#94588a', gold: '#e0ae4f', gold2: '#b8862c', red: '#b5452f', red2: '#86301f',
  orange: '#e07b39', yellow: '#f2c94c', blue: '#4e7da0', blue2: '#355d7d', sky: '#bcdfe8', sky2: '#eef0dc',
  sea: '#6b9db3', sea2: '#4b7f98', green: '#6e8f4a', green2: '#4d6a34', teal: '#3d8a83', olive: '#857858',
  umber: '#655746', brown: '#7c5433', brown2: '#5a3a22', stone: '#d4c3a0', stone2: '#ab976f', sand: '#e5cf98',
  grey: '#8f8b82', grey2: '#6a675f', steel: '#a3acae', steel2: '#7a8487', black: '#2a2522', night: '#2c3448',
  fire1: '#ffd65c', fire2: '#f48c2f', fire3: '#d4452a', smoke: '#8d847b', smoke2: '#5f5852',
  bluesTeam: '#3e6fb8', greensTeam: '#3f9b50', pink: '#d97a8a', land: '#ecdcb3', land2: '#dcc896',
};
CH._palLower = null;
CH.col = c => {
  if (!c) return null;
  if (c[0] === '#' || c.startsWith('url(') || c === 'none') return c;
  if (!CH._palLower) CH._palLower = Object.fromEntries(Object.entries(CH.PAL).map(([k, v]) => [k.toLowerCase(), v]));
  const k = String(c).toLowerCase().replace(/[^a-z0-9]/g, '');
  return CH._palLower[k] || CH._palLower[k.replace(/s$/, '')] || c;
};
CH.mix = (a, b, t) => {
  const pa = parseInt(CH.col(a).slice(1), 16), pb = parseInt(CH.col(b).slice(1), 16);
  const ch = s => [(s >> 16) & 255, (s >> 8) & 255, s & 255];
  const A = ch(pa), B = ch(pb);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
CH.shade = (c, k) => (k < 0 ? CH.mix(c, '#1f1a17', -k) : CH.mix(c, '#ffffff', k));

// ------------------------------------------------------------------------------------------------ svg helpers
CH.esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
CH.attrs = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false)
  .map(([k, v]) => `${k}="${typeof v === 'number' ? CH.f(v) : v}"`).join(' ');
CH.el = (tag, o = {}, inner) => (inner === undefined ? `<${tag} ${CH.attrs(o)}/>` : `<${tag} ${CH.attrs(o)}>${inner}</${tag}>`);
CH.g = (o, inner) => `<g ${CH.attrs(o)}>${inner}</g>`;
CH.tr = (x, y, s = 1, r = 0) => `translate(${CH.f(x)} ${CH.f(y)})${r ? ` rotate(${CH.f(r)})` : ''}${s !== 1 ? ` scale(${+s.toFixed(4)})` : ''}`;
CH.INK = (w = 5, extra = {}) => ({ stroke: CH.PAL.ink, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...extra });
CH.path = (d, o = {}) => CH.el('path', { d, ...o });
CH.poly = (pts, close = true) => 'M' + pts.map(p => CH.pt(p[0], p[1])).join('L') + (close ? 'Z' : '');
// smooth closed/open curve through points (Catmull-Rom -> cubic Bezier)
CH.smooth = (pts, close = true, k = 1) => {
  const n = pts.length;
  if (n < 3) return CH.poly(pts, close);
  const P = i => (close ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${CH.pt(...pts[0])}`;
  const last = close ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6 * k, p1[1] + (p2[1] - p0[1]) / 6 * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6 * k, p2[1] - (p3[1] - p1[1]) / 6 * k];
    d += `C${CH.pt(...c1)} ${CH.pt(...c2)} ${CH.pt(...p2)}`;
  }
  return d + (close ? 'Z' : '');
};
// stroke draw-in: visible fraction p of a path (use with pathLength=1)
CH.draw = p => (p >= 1 ? {} : { pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': CH.f(1 - CH.clamp(p)) === 1 ? 1 : +(1 - CH.clamp(p)).toFixed(4) });
// pop-in transform: scale with overshoot from an anchor
CH.pop = (t, delay = 0, dur = 0.35) => {
  const q = CH.seg(t, delay, delay + dur);
  return { s: q <= 0 ? 0 : CH.ease.back(q), o: CH.clamp(q * 3), q };
};
CH.wrapPop = (t, delay, x, y, inner, dur = 0.35) => {
  const p = CH.pop(t, delay, dur);
  if (p.q <= 0) return '';
  return `<g transform="${CH.tr(x, y, Math.max(0.001, p.s))}" opacity="${CH.f(p.o)}">${inner}</g>`;
};

// ------------------------------------------------------------------------------------------------ text
CH.FONTS = {
  title: ['LuckiestGuy', 400], number: ['Anton', 400], date: ['Cinzel', 800], label: ['Montserrat', 800],
  body: ['Montserrat', 600], hand: ['PatrickHand', 400],
};
const _mctx = document.createElement('canvas').getContext('2d');
CH.measure = (txt, kind = 'title', size = 100) => {
  const [fam, w] = CH.FONTS[kind] || CH.FONTS.title;
  _mctx.font = `${w} ${size}px ${fam}`;
  return _mctx.measureText(String(txt)).width;
};
CH.wrapLines = (txt, kind, size, maxW, maxLines = 2) => {
  const words = String(txt).split(/\s+/).filter(Boolean);
  for (let n = 1; n <= maxLines; n++) {
    const lines = []; let cur = '';
    const target = CH.measure(txt, kind, size) / n;
    for (const w of words) {
      const cand = cur ? cur + ' ' + w : w;
      if (cur && CH.measure(cand, kind, size) > Math.max(target * 1.15, maxW * (n === maxLines ? 1 : 0.0))) {
        lines.push(cur); cur = w;
      } else cur = cand;
    }
    if (cur) lines.push(cur);
    if (lines.length <= n && lines.every(l => CH.measure(l, kind, size) <= maxW)) return { lines, size };
  }
  return null;
};
// fit text into maxW (wrapping up to maxLines, then shrinking)
CH.fit = (txt, kind, size, maxW, maxLines = 2) => {
  let s = size;
  while (s > 12) {
    const r = CH.wrapLines(txt, kind, s, maxW, maxLines);
    if (r) return r;
    s *= 0.93;
  }
  return { lines: [String(txt)], size: s };
};
/* Outlined cartoon lettering. kind: title|number|date|label|body|hand */
CH.text = (txt, o = {}) => {
  const kind = o.kind || 'title';
  const [fam, wt] = CH.FONTS[kind] || CH.FONTS.title;
  const maxW = o.maxW || 1e9;
  const fit = CH.fit(String(txt), kind, o.size || 80, maxW, o.lines || 2);
  const size = fit.size;
  const fill = CH.col(o.fill || (kind === 'label' || kind === 'date' || kind === 'hand' || kind === 'body' ? CH.PAL.ink : CH.PAL.cream));
  const stroke = o.stroke === undefined ? (kind === 'label' || kind === 'date' || kind === 'hand' || kind === 'body' ? null : CH.PAL.ink) : CH.col(o.stroke);
  const sw = o.sw !== undefined ? o.sw : size * (kind === 'number' ? 0.07 : 0.085);
  const lh = size * (o.lh || 1.04);
  const n = fit.lines.length;
  const anchor = o.anchor || 'middle';
  const base = { 'font-family': fam, 'font-weight': wt, 'font-size': CH.f(size), 'text-anchor': anchor,
    'dominant-baseline': 'central', 'letter-spacing': o.ls ? CH.f(o.ls * size) : undefined };
  let out = '';
  fit.lines.forEach((line, i) => {
    const y = (i - (n - 1) / 2) * lh;
    const t = CH.esc(o.upper === false ? line : (o.upper ? line.toUpperCase() : line));
    if (o.shadow !== false && stroke) {
      out += CH.el('text', { ...base, x: size * 0.035, y: y + size * 0.07, fill: CH.PAL.ink, opacity: 0.35,
        stroke: CH.PAL.ink, 'stroke-width': sw, 'stroke-linejoin': 'round' }, t);
    }
    out += CH.el('text', { ...base, x: 0, y, fill, stroke: stroke || undefined, 'stroke-width': stroke ? sw : undefined,
      'stroke-linejoin': 'round', 'paint-order': 'stroke' }, t);
  });
  const box = { w: Math.max(...fit.lines.map(l => CH.measure(o.upper ? l.toUpperCase() : l, kind, size))), h: lh * n, size, lines: n };
  const tr = `translate(${CH.f(o.x || 0)} ${CH.f(o.y || 0)})${o.rot ? ` rotate(${CH.f(o.rot)})` : ''}${o.s !== undefined && o.s !== 1 ? ` scale(${(+o.s).toFixed(4)})` : ''}`;
  const svg = `<g transform="${tr}"${o.opacity !== undefined ? ` opacity="${CH.f(o.opacity)}"` : ''}>${out}</g>`;
  return o.withBox ? { svg, box } : svg;
};
/* Text on a rounded parchment plate (labels, dates, name tags). */
CH.plate = (txt, o = {}) => {
  const kind = o.kind || 'label';
  const size0 = o.size || 46;
  const up = o.upper !== false;
  const T = up ? String(txt).toUpperCase() : String(txt);
  const fit = CH.fit(T, kind, size0, o.maxW ? o.maxW * 0.88 : 1e9, 1);
  const size = fit.size;
  const tw = CH.measure(T, kind, size);
  const accent = o.accent ? CH.col(o.accent) : null;
  const mk = accent ? size * 0.5 : 0, gap = accent ? size * 0.3 : 0;
  const px = size * 0.55, py = size * 0.36;
  const w = tw + 2 * px + mk + gap, h = size * 1.05 + 2 * py;
  const sw = Math.max(3, size * 0.08);
  const x0 = -w / 2, y0 = -h / 2;
  let s = CH.el('rect', { x: x0 + size * 0.08, y: y0 + size * 0.12, width: w, height: h, rx: h * 0.28, fill: CH.PAL.ink, opacity: 0.3 });
  s += CH.el('rect', { x: x0, y: y0, width: w, height: h, rx: h * 0.28, fill: CH.col(o.plate || CH.PAL.cream), ...CH.INK(sw) });
  let tx = x0 + px;
  if (accent) {
    const r = mk / 2, cy = 0;
    s += CH.path(CH.poly([[tx + r, cy - r], [tx + 2 * r, cy], [tx + r, cy + r], [tx, cy]]), { fill: accent });
    tx += mk + gap;
  }
  const [fam, wt] = CH.FONTS[kind];
  s += CH.el('text', { x: tx, y: size * 0.04, 'font-family': fam, 'font-weight': wt, 'font-size': CH.f(size),
    'dominant-baseline': 'central', fill: CH.col(o.fill || CH.PAL.ink) }, CH.esc(T));
  const tr = CH.tr(o.x || 0, o.y || 0, o.s === undefined ? 1 : Math.max(0.001, o.s), o.rot || 0);
  return `<g transform="${tr}"${o.opacity !== undefined ? ` opacity="${CH.f(o.opacity)}"` : ''}>${s}</g>`;
};

// ------------------------------------------------------------------------------------------------ paper
CH.makePaper = (W, H, seed = 7) => {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = CH.rng(seed);
  const grid = (cell) => {
    const gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2;
    const a = new Float32Array(gw * gh);
    for (let i = 0; i < a.length; i++) a[i] = r();
    return { a, gw, cell };
  };
  const sample = (G, x, y) => {
    const fx = x / G.cell, fy = y / G.cell, ix = Math.floor(fx), iy = Math.floor(fy);
    let u = fx - ix, v = fy - iy; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    const A = G.a, w = G.gw, i = iy * w + ix;
    return (A[i] * (1 - u) + A[i + 1] * u) * (1 - v) + (A[i + w] * (1 - u) + A[i + w + 1] * u) * v;
  };
  const G1 = grid(210), G2 = grid(55), G3 = grid(13);
  const img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) {
    const dy = y / H - 0.5;
    for (let x = 0; x < W; x++) {
      const dx = x / W - 0.5;
      const vig = 1 - 0.30 * Math.pow(dx * dx * 1.6 + dy * dy * 1.6, 1.25);
      const n = 1 - 0.055 * sample(G1, x, y) - 0.03 * sample(G2, x, y) - 0.025 * sample(G3, x, y) - 0.03 * r() * r();
      const v = 255 * n * vig, i = (y * W + x) * 4;
      d[i] = v; d[i + 1] = v * 0.984; d[i + 2] = v * 0.945; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  g.lineCap = 'round';
  for (let i = 0; i < Math.round(W * H / 4500); i++) {           // paper fibres
    const x = r() * W, y = r() * H, a = r() * Math.PI * 2, l = 6 + r() * 26;
    g.strokeStyle = `rgba(120,95,60,${0.035 + r() * 0.05})`;
    g.lineWidth = 0.6 + r() * 0.9;
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  for (let i = 0; i < 9; i++) {                                     // faint stains
    const x = r() * W, y = r() * H, rad = 40 + r() * 160;
    const gr = g.createRadialGradient(x, y, rad * 0.2, x, y, rad);
    gr.addColorStop(0, 'rgba(160,120,70,0)'); gr.addColorStop(0.85, `rgba(160,120,70,${0.025 + r() * 0.03})`); gr.addColorStop(1, 'rgba(160,120,70,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return c.toDataURL('image/jpeg', 0.93);
};

// ------------------------------------------------------------------------------------------------ stage
CH.T = {};            // scene templates, filled by scenes.js / maps.js
CH.errors = [];
CH.BOIL = 10;         // line-boil redraws per second

CH.init = payload => {
  const TL = CH.TL = payload;
  const W = TL.width, H = TL.height;
  CH.W = W; CH.H = H; CH.V = H > W;
  TL.beatsById = {};
  for (const b of TL.beats) TL.beatsById[b.id] = b;
  TL.span = {};
  for (const s of TL.shots) {
    const sp = TL.span[s.beat] || (TL.span[s.beat] = { start: s.start, end: s.end });
    sp.start = Math.min(sp.start, s.start); sp.end = Math.max(sp.end, s.end);
  }
  const m = 40;
  document.getElementById('stage').innerHTML = `
  <svg id="svg" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <filter id="ink" filterUnits="userSpaceOnUse" x="${-m}" y="${-m}" width="${W + 2 * m}" height="${H + 2 * m}" color-interpolation-filters="sRGB">
        <feTurbulence id="inkTurb" type="fractalNoise" baseFrequency="0.032" numOctaves="2" seed="1" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="${CH.f(4.5 * Math.min(W, H) / 1080)}" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <pattern id="hatch" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(35)">
        <line x1="0" y1="0" x2="0" y2="14" stroke="${CH.PAL.ink}" stroke-width="3" opacity="0.55"/></pattern>
      <pattern id="hatchLight" patternUnits="userSpaceOnUse" width="18" height="18" patternTransform="rotate(-35)">
        <line x1="0" y1="0" x2="0" y2="18" stroke="${CH.PAL.ink}" stroke-width="2" opacity="0.22"/></pattern>
      <radialGradient id="glowGold"><stop offset="0" stop-color="#fff2b8" stop-opacity="0.95"/><stop offset="1" stop-color="#ffd25a" stop-opacity="0"/></radialGradient>
      <radialGradient id="glowFire"><stop offset="0" stop-color="#ffcf6a" stop-opacity="0.85"/><stop offset="1" stop-color="#e2562c" stop-opacity="0"/></radialGradient>
      <radialGradient id="shadowGrad"><stop offset="0" stop-color="#1f1a17" stop-opacity="0.35"/><stop offset="1" stop-color="#1f1a17" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="${CH.PAL.paper}"/>
    <g id="flatCam"><g id="flatS"></g><g id="flatD"></g></g>
    <g id="inkLayer" filter="url(#ink)"><g id="inkCam"><g id="inkS"></g><g id="inkD"></g></g><g id="hud"></g></g>
    <image id="paperTex" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none" style="mix-blend-mode:multiply"/>
    <g id="ui"></g>
    <rect id="flash" width="${W}" height="${H}" fill="#fff6e4" opacity="0"/>
  </svg>`;
  CH.$ = id => document.getElementById(id);
  CH.cur = null;
  CH.scenes = {};
};

CH.prepare = async () => {
  await document.fonts.ready;
  for (const [fam, wt] of Object.values(CH.FONTS)) await document.fonts.load(`${wt} 40px ${fam}`);
  CH.$('paperTex').setAttribute('href', CH.makePaper(CH.W, CH.H, 11));
  const urls = [...new Set(CH.TL.beats.map(b => b.image).filter(Boolean))];
  await Promise.all(urls.map(u => new Promise(res => { const im = new Image(); im.onload = im.onerror = res; im.src = u; })));
  if (window.CH_MAP_READY) await window.CH_MAP_READY;
  return { images: urls.length, errors: CH.errors };
};

CH.env = beat => ({ W: CH.W, H: CH.H, V: CH.V, beat, seed: CH.hash(`${beat.id}:${beat.text}`),
  dur: (CH.TL.span[beat.id].end - CH.TL.span[beat.id].start), image: beat.image, chapter: beat.chapter });

CH.sceneFor = beat => {
  if (CH.scenes[beat.id]) return CH.scenes[beat.id];
  const spec = beat.scene || {};
  let sc;
  try {
    const make = CH.T[spec.template] || CH.T.fallback;
    sc = make(spec, CH.env(beat));
  } catch (e) {
    CH.errors.push(`beat ${beat.id} (${spec.template}): ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`);
    sc = CH.T.fallback({ text: beat.text }, CH.env(beat));
  }
  CH.scenes[beat.id] = sc;
  return sc;
};

// default camera: a slow drift toward the scene's focus point; punch shots frame tighter
CH.defaultCamera = (sc, ctx) => {
  const W = ctx.W, H = ctx.H;
  const fx = (sc.focus || [0.5, 0.5])[0], fy = (sc.focus || [0.5, 0.5])[1];
  const drift = sc.drift === undefined ? 0.055 : sc.drift;
  const q = CH.ease.sine(ctx.p);
  let z = 1 + drift * q, x = CH.lerp(W / 2, fx * W, q * 0.6), y = CH.lerp(H / 2, fy * H, q * 0.6);
  if (ctx.punch) { z *= 1.16; x = CH.lerp(x, fx * W, 0.7); y = CH.lerp(y, fy * H, 0.7); }
  return { x, y, z };
};
CH.camTransform = (c, W, H) => {
  const z = Math.max(1, c.z);
  const hw = W / (2 * z), hh = H / (2 * z);
  const x = CH.clamp(c.x, hw, W - hw), y = CH.clamp(c.y, hh, H - hh);
  return `translate(${CH.f(W / 2)} ${CH.f(H / 2)}) scale(${z.toFixed(4)}) translate(${CH.f(-x)} ${CH.f(-y)})`;
};

CH.shotIndex = T => {
  const S = CH.TL.shots;
  let lo = 0, hi = S.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (S[mid].start <= T) lo = mid; else hi = mid - 1; }
  return lo;
};

const flashAlpha = (t, tc) => {
  if (t >= tc - 0.07 && t < tc) return 0.85 * (t - (tc - 0.07)) / 0.07;
  if (t >= tc && t < tc + 0.45) return 0.85 * Math.exp(-(t - tc) / 0.09);
  return 0;
};

CH.renderAt = T => {
  const TL = CH.TL, W = CH.W, H = CH.H;
  const si = CH.shotIndex(T), shot = TL.shots[si];
  const beat = TL.beatsById[shot.beat], span = TL.span[shot.beat];
  const sc = CH.sceneFor(beat);
  if (CH.cur !== sc) {
    const st = sc.static ? sc.static() : {};
    CH.$('flatS').innerHTML = st.flat || '';
    CH.$('inkS').innerHTML = st.ink || '';
    CH.cur = sc;
  }
  const t = Math.max(0, T - span.start), dur = span.end - span.start;
  const ctx = { T, t, dur, p: CH.clamp(t / dur), W, H, V: CH.V, punch: !!shot.punch, shot, beat };
  let out;
  try { out = sc.draw(ctx); } catch (e) {
    CH.errors.push(`beat ${beat.id} draw: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`);
    out = '';
  }
  if (typeof out === 'string') out = { ink: out };
  CH.$('flatD').innerHTML = out.flat || '';
  CH.$('inkD').innerHTML = out.ink || '';
  CH.$('hud').innerHTML = out.hud || '';
  const cam = CH.camTransform(sc.camera ? sc.camera(ctx) : CH.defaultCamera(sc, ctx), W, H);
  CH.$('flatCam').setAttribute('transform', cam);
  CH.$('inkCam').setAttribute('transform', cam);
  CH.$('inkTurb').setAttribute('seed', String(1 + (Math.floor(T * CH.BOIL) % 4)));
  CH.$('ui').innerHTML = CH.ui(T, shot);
  let fa = 0;
  for (const k of [si, si + 1]) {
    const s = TL.shots[k];
    if (s && s.transition === 'flash' && s.start > 0) fa = Math.max(fa, flashAlpha(T, s.start));
  }
  CH.$('flash').setAttribute('opacity', fa.toFixed(3));
  return si;
};

// ------------------------------------------------------------------------------------------------ ui layer
CH.ui = (T, shot) => {
  const TL = CH.TL, W = CH.W, H = CH.H, base = Math.min(W, H);
  let s = '';
  // chapter date stamp
  const st = shot.stamp;
  if (st) {
    const q = (T - st.start) / 0.22;
    if (q > 0) {
      const size = base * 0.05;
      const slide = (1 - CH.ease.back(CH.clamp(q))) * base * 0.12;
      const x = CH.V ? W * 0.5 : base * 0.04 + CH.measure(st.text.toUpperCase(), 'date', size) / 2 + size * 1.2;
      const y = CH.V ? H * 0.655 : H - base * 0.075;
      s += CH.plate(st.text, { kind: 'date', size, accent: CH.PAL.red, plate: '#f3e3bd', x: x - slide, y, opacity: CH.clamp(q * 2) });
    }
  }
  // captions
  const cap = TL.captions || [];
  if (cap.length) {
    let lo = 0, hi = cap.length - 1, gi = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (cap[mid].show_from <= T) { gi = mid; lo = mid + 1; } else hi = mid - 1; }
    const g = gi >= 0 ? cap[gi] : null;
    if (g && T <= g.show_to) {
      const words = g.words.map(w => (TL.caption_upper ? w.w.toUpperCase() : w.w).trim());
      let active = -1;
      g.words.forEach((w, i) => { if (T >= w.s - 0.02) active = i; });
      let size = base * 0.078;
      const line = words.join(' ');
      while (CH.measure(line, 'label', size) > W * 0.86 && size > 20) size *= 0.92;
      const q = CH.clamp((T - g.show_from) / 0.09);
      const sc = 0.86 + 0.14 * CH.ease.back(q);
      const spans = words.map((w, i) => `<tspan fill="${i === active ? '#ffcf3f' : '#ffffff'}">${CH.esc(w)}</tspan>`).join(' ');
      const y = H * (TL.caption_y || 0.75);
      s += `<g transform="${CH.tr(W / 2, y, sc)}"><text x="0" y="0" text-anchor="middle" dominant-baseline="central" font-family="Montserrat" font-weight="800" font-size="${CH.f(size)}" stroke="#111111" stroke-width="${CH.f(size * 0.12 * 2)}" stroke-linejoin="round" paint-order="stroke">${spans}</text></g>`;
    }
  }
  // header (vertical formats): big title first, then a small persistent one
  const hd = TL.header;
  if (hd && hd.text) {
    const until = hd.until_s || 3.2, F = 0.25;
    const big = T < until - F ? 1 : Math.max(0, (until - T) / F);
    const small = hd.persist ? CH.clamp((T - (until - F)) / F) : 0;
    if (big > 0) s += CH.text(hd.text, { kind: 'title', size: base * 0.085, maxW: W * 0.9, lines: 3, x: W / 2, y: H * 0.15, fill: '#ffffff', stroke: '#111111', sw: base * 0.085 * 0.09 * 2, opacity: big });
    if (small > 0) s += CH.text(hd.text, { kind: 'title', size: base * 0.046, maxW: W * 0.8, lines: 1, x: W / 2, y: H * 0.058, fill: '#ffffff', stroke: '#111111', sw: base * 0.046 * 0.09 * 2, opacity: small * 0.95 });
  }
  if (TL.progress_bar) {
    const h = Math.max(6, H * 0.006);
    s += `<rect width="${W}" height="${CH.f(h)}" fill="#000" opacity="0.45"/><rect width="${CH.f(W * CH.clamp(T / TL.duration))}" height="${CH.f(h)}" fill="#ffcf3f"/>`;
  }
  return s;
};

// ------------------------------------------------------------------------------------------------ fallback scene
CH.T.fallback = (spec, env) => {
  const txt = spec.text || (env.beat && env.beat.text) || '';
  return {
    draw: ctx => CH.text(txt, { kind: 'label', size: 54, maxW: env.W * 0.8, lines: 4, x: env.W / 2, y: env.H / 2, upper: false }),
  };
};
