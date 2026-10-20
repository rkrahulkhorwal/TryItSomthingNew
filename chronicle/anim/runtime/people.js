/* Chronicle animation runtime - "pebble-head" characters.
 *
 * An original, simple rig: big egg head, bead eyes, eyebrows that carry the emotion, tiny mouth, rosy cheeks,
 * short rounded body, thin outlined limbs, mitten hands. Hats, hair, beards, clothes and props make the cast.
 * Drawn facing right in local coordinates (feet at 0,0; ~300 px tall at s = 1) and mirrored for f = -1.
 */
(() => {
'use strict';
const { PAL, col, f, pt, clamp, seg, ease, rng, hash, noise, el, path, INK } = CH;
const ink = PAL.ink;

const HEAD = { x: 0, y: -224, rx: 60, ry: 72 };
const SHOULDER = { x: 35, y: -141 };

const egg = (cx, cy, rx, ry) =>
  `M${pt(cx, cy - ry)}C${pt(cx + rx * 0.6, cy - ry)} ${pt(cx + rx, cy - ry * 0.47)} ${pt(cx + rx, cy + ry * 0.08)}` +
  `C${pt(cx + rx, cy + ry * 0.66)} ${pt(cx + rx * 0.57, cy + ry)} ${pt(cx, cy + ry)}` +
  `C${pt(cx - rx * 0.57, cy + ry)} ${pt(cx - rx, cy + ry * 0.66)} ${pt(cx - rx, cy + ry * 0.08)}` +
  `C${pt(cx - rx, cy - ry * 0.47)} ${pt(cx - rx * 0.6, cy - ry)} ${pt(cx, cy - ry)}Z`;
CH.egg = egg;

// ----------------------------------------------------------------------------------------------- expressions
// brow: degrees, + = inner end down (angry), - = inner end up (sad); by: brow height offset; eye: scale or style
const EXPR = {
  neutral: { brow: 4, by: 0, eye: 1, mouth: 'line' },
  happy: { brow: -8, by: -4, eye: 1, mouth: 'smile' },
  laugh: { brow: -10, by: -7, eye: 'arc', mouth: 'open' },
  proud: { brow: -6, by: -6, eye: 'arc', mouth: 'smile' },
  angry: { brow: 24, by: 4, eye: 1, mouth: 'grit' },
  furious: { brow: 30, by: 6, eye: 1.05, mouth: 'shout' },
  sad: { brow: -22, by: -2, eye: 1, mouth: 'frown' },
  shock: { brow: -6, by: -13, eye: 1.35, mouth: 'o' },
  scared: { brow: -24, by: -8, eye: 1.25, mouth: 'wavy' },
  worried: { brow: -16, by: -4, eye: 1, mouth: 'flat' },
  smug: { brow: 8, brow2: -14, by: 0, by2: -8, eye: 'half', mouth: 'smirk' },
  determined: { brow: 15, by: 2, eye: 1, mouth: 'firm' },
  evil: { brow: 27, by: 4, eye: 'half', mouth: 'grin' },
  sly: { brow: 12, brow2: -6, by: 2, by2: -4, eye: 'half', mouth: 'smirk' },
  dead: { brow: -4, by: 0, eye: 'x', mouth: 'flat' },
  sleep: { brow: 0, by: 0, eye: 'shut', mouth: 'flat' },
  awe: { brow: -12, by: -10, eye: 1.2, mouth: 'o' },
};
CH.EXPRESSIONS = Object.keys(EXPR);

const blink = (t, seed) => {
  const r = rng(seed);
  const period = 2.6 + r() * 1.9, phase = r() * period;
  const x = (t + phase) % period;
  return x < 0.14 ? Math.sin((x / 0.14) * Math.PI) : 0;
};

function face(o, t) {
  const E = EXPR[o.expr] || EXPR.neutral;
  const fo = o.front ? 0 : 11;                          // features shift toward the facing side
  const hx = HEAD.x + fo, hy = HEAD.y;
  const lod = o.lod;
  let s = '';
  // cheeks
  if (lod > 1) {
    s += el('circle', { cx: hx - 33, cy: hy + 22, r: 8.5, fill: PAL.cheek, opacity: 0.5 });
    s += el('circle', { cx: hx + 33, cy: hy + 22, r: 8.5, fill: PAL.cheek, opacity: 0.5 });
  }
  // eyes
  const bl = (E.eye === 'arc' || E.eye === 'x' || E.eye === 'shut') ? 0 : blink(t + (o.delay || 0), o.seed);
  for (const side of [-1, 1]) {
    const ex = hx + side * 19, ey = hy + 2;
    if (E.eye === 'arc') s += path(`M${pt(ex - 7, ey + 3)}Q${pt(ex, ey - 7)} ${pt(ex + 7, ey + 3)}`, { fill: 'none', ...INK(4.5) });
    else if (E.eye === 'x') s += path(`M${pt(ex - 6, ey - 6)}L${pt(ex + 6, ey + 6)}M${pt(ex + 6, ey - 6)}L${pt(ex - 6, ey + 6)}`, INK(4));
    else if (E.eye === 'shut' || bl > 0.6) s += path(`M${pt(ex - 7, ey + 1)}Q${pt(ex, ey + 4)} ${pt(ex + 7, ey + 1)}`, { fill: 'none', ...INK(4) });
    else {
      const k = typeof E.eye === 'number' ? E.eye : 1;
      const ry = 8.5 * k * (1 - bl * 0.85), rx = 6.5 * k;
      const look = o.look || 0;
      s += el('ellipse', { cx: ex + 1.5 + look * 2, cy: ey, rx, ry, fill: ink });
      if (lod > 1 && ry > 4) s += el('circle', { cx: ex + 3.2 + look * 2, cy: ey - 3, r: 2.3 * k, fill: '#fff' });
      if (E.eye === 'half') s += path(`M${pt(ex - 9, ey - 2)}L${pt(ex + 9, ey - 2)}`, INK(4.5));
      if (E.eye === 'half') s += el('rect', { x: ex - 8, y: ey - 11, width: 16, height: 9, fill: o.skin });
    }
  }
  // eyebrows
  for (const side of [-1, 1]) {
    const a = (side < 0 ? 1 : -1) * ((side > 0 && E.brow2 !== undefined) ? E.brow2 : E.brow);
    const byy = (side > 0 && E.by2 !== undefined) ? E.by2 : E.by;
    const bx = hx + side * 20, by = hy - 21 + byy;
    const rad = (a * Math.PI) / 180, dx = Math.cos(rad) * 12, dy = Math.sin(rad) * 12;
    s += path(`M${pt(bx - dx, by - dy)}L${pt(bx + dx, by + dy)}`, INK(o.lod > 1 ? 7 : 6));
  }
  // mouth (talking alternates with an open shape)
  let m = E.mouth;
  if (o.talk && noise(t * 9, o.seed % 97) > 0.05) m = (m === 'smile' || m === 'open' || m === 'grin') ? 'open' : 'o';
  const mx = hx + fo * 0.15, my = hy + 34;
  if (o.beard && o.beard !== 'none' && o.beard !== 'goatee') s += el('ellipse', { cx: mx, cy: my + 1, rx: 15, ry: 9, fill: o.skin });
  const M = {
    line: () => path(`M${pt(mx - 8, my)}L${pt(mx + 8, my)}`, INK(4.5)),
    flat: () => path(`M${pt(mx - 6, my + 1)}L${pt(mx + 6, my + 1)}`, INK(4.5)),
    firm: () => path(`M${pt(mx - 9, my + 1)}Q${pt(mx, my - 1)} ${pt(mx + 9, my + 2)}`, { fill: 'none', ...INK(5) }),
    smile: () => path(`M${pt(mx - 11, my - 3)}Q${pt(mx, my + 9)} ${pt(mx + 11, my - 3)}`, { fill: 'none', ...INK(4.5) }),
    open: () => path(`M${pt(mx - 13, my - 4)}Q${pt(mx, my + 20)} ${pt(mx + 13, my - 4)}Z`, { fill: '#7a2a22', ...INK(4) }),
    frown: () => path(`M${pt(mx - 10, my + 5)}Q${pt(mx, my - 6)} ${pt(mx + 10, my + 5)}`, { fill: 'none', ...INK(4.5) }),
    o: () => el('ellipse', { cx: mx, cy: my + 2, rx: 6.5, ry: 8.5, fill: '#5a1f18', ...INK(3.5) }),
    shout: () => path(`M${pt(mx - 14, my - 6)}Q${pt(mx, my - 9)} ${pt(mx + 14, my - 6)}Q${pt(mx + 9, my + 16)} ${pt(mx, my + 16)}Q${pt(mx - 9, my + 16)} ${pt(mx - 14, my - 6)}Z`, { fill: '#5a1f18', ...INK(4) }),
    grit: () => el('rect', { x: mx - 12, y: my - 5, width: 24, height: 11, rx: 3, fill: '#fff', ...INK(3.5) }) + path(`M${pt(mx - 12, my + 0.5)}L${pt(mx + 12, my + 0.5)}`, INK(2)),
    wavy: () => path(`M${pt(mx - 12, my)}Q${pt(mx - 6, my - 5)} ${pt(mx, my)}Q${pt(mx + 6, my + 5)} ${pt(mx + 12, my)}`, { fill: 'none', ...INK(4) }),
    smirk: () => path(`M${pt(mx - 9, my + 1)}Q${pt(mx + 3, my + 5)} ${pt(mx + 12, my - 5)}`, { fill: 'none', ...INK(4.5) }),
    grin: () => path(`M${pt(mx - 15, my - 4)}Q${pt(mx, my + 14)} ${pt(mx + 15, my - 4)}Z`, { fill: '#fff', ...INK(4) }) + path(`M${pt(mx - 13, my - 1)}L${pt(mx + 13, my - 1)}`, INK(2)),
  };
  s += (M[m] || M.line)();
  return s;
}

// ----------------------------------------------------------------------------------------------- hair, beards, hats
function hairBack(o) {
  const hc = col(o.hairColor || '#3b2a20');
  if (o.hair === 'long') return path(`M-64,-12C-72,-74 -32,-90 0,-88C34,-90 74,-74 66,-12L72,74Q48,92 34,62L-34,62Q-48,92 -72,74Z`, { fill: hc, ...INK(4.5), transform: `translate(${HEAD.x} ${HEAD.y})` });
  if (o.hair === 'bun') return el('circle', { cx: HEAD.x - 38, cy: HEAD.y - 58, r: 24, fill: hc, ...INK(4.5) });
  return '';
}
function hairFront(o) {
  const hc = col(o.hairColor || '#3b2a20');
  const T = `translate(${HEAD.x} ${HEAD.y})`;
  switch (o.hair) {
    case 'short': case 'long': case 'bun':
      return path(`M-61,-2C-66,-62 -30,-82 0,-81C34,-82 68,-60 61,-4C52,-26 30,-36 12,-31C-8,-42 -40,-30 -61,-2Z`, { fill: hc, ...INK(4.5), transform: T });
    case 'curly': {
      let d = 'M-60,0';
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * (1.05 + i * 0.112), r1 = 1.0, x = Math.cos(a) * 64 * r1, y = Math.sin(a) * 78 * r1;
        d += `A13,13 0 0 1 ${pt(x, y)}`;
      }
      return path(d + 'C40,-30 -30,-30 -60,0Z', { fill: hc, ...INK(4.5), transform: T });
    }
    case 'bald': return el('ellipse', { cx: HEAD.x - 18, cy: HEAD.y - 50, rx: 12, ry: 6, fill: '#fff', opacity: 0.5, transform: `rotate(-25 ${HEAD.x - 18} ${HEAD.y - 50})` });
    default: return '';
  }
}
function beard(o) {
  const bc = col(o.beardColor || o.hairColor || '#3b2a20');
  const T = `translate(${HEAD.x + (o.front ? 0 : 8)} ${HEAD.y})`;
  if (o.beard === 'short') return path(`M-56,14C-54,70 -26,96 0,98C26,96 54,70 56,14C44,40 30,46 18,44C10,38 -10,38 -18,44C-30,46 -44,40 -56,14Z`, { fill: bc, ...INK(4.5), transform: T });
  if (o.beard === 'long') return path(`M-56,14C-58,80 -30,120 0,152C30,120 58,80 56,14C44,40 30,46 18,44C10,38 -10,38 -18,44C-30,46 -44,40 -56,14Z`, { fill: bc, ...INK(4.5), transform: T });
  if (o.beard === 'goatee') return path(`M-14,50Q0,86 14,50Q0,58 -14,50Z`, { fill: bc, ...INK(4), transform: T });
  if (o.beard === 'moustache') return path(`M-24,30Q-12,18 0,26Q12,18 24,30Q12,30 0,32Q-12,30 -24,30Z`, { fill: bc, ...INK(3.5), transform: T });
  return '';
}

const jewel = (x, y, r, c) => el('circle', { cx: x, cy: y, r, fill: c, ...INK(2.5) }) + el('circle', { cx: x - r * 0.3, cy: y - r * 0.3, r: r * 0.3, fill: '#fff', opacity: 0.8 });

// hats that wrap the face (hoods, mail, veils) are drawn as a ring around the face opening
const faceRing = (outerScale, color, extra = '') => {
  const o = egg(HEAD.x, HEAD.y - 4, HEAD.rx * outerScale, HEAD.ry * outerScale);
  const inner = `M${pt(HEAD.x + 52, HEAD.y + 10)}A52,57 0 1 0 ${pt(HEAD.x - 52, HEAD.y + 10)}A52,57 0 1 0 ${pt(HEAD.x + 52, HEAD.y + 10)}Z`;
  return path(o + inner, { fill: col(color), 'fill-rule': 'evenodd', ...INK(4.5) }) + extra;
};

function hat(o, t) {
  const hx = HEAD.x, hy = HEAD.y;
  const T = `translate(${hx} ${hy})`;
  const hc = col(o.hatColor);
  switch (o.hat) {
    case 'crown': {
      let s = path(`M-50,-62C-48,-108 48,-108 50,-62Z`, { fill: PAL.gold, ...INK(4.5) });
      s += path(`M-18,-100L-20,-64M18,-100L20,-64`, INK(3));
      s += path(`M0,-100L0,-128M-10,-116L10,-116`, INK(5));
      s += el('rect', { x: -56, y: -68, width: 112, height: 24, rx: 6, fill: PAL.gold, ...INK(4.5) });
      [[-38, '#c0392b'], [-13, '#2e6fb0'], [13, '#2f8f4f'], [38, '#c0392b']].forEach(([x, c]) => { s += jewel(x, -56, 5.5, c); });
      for (const sd of [-1, 1]) {                                   // pendilia: strings of pearls
        s += path(`M${pt(sd * 52, -48)}L${pt(sd * 58, 6)}`, INK(2.5));
        for (let k = 0; k < 3; k++) s += el('circle', { cx: sd * (53 + k * 1.8), cy: -36 + k * 15, r: 4.5, fill: '#fbf6ea', ...INK(2) });
        s += path(`M${pt(sd * 58, 6)}l-5,5l5,9l5,-9z`, { fill: '#c0392b', ...INK(2) });
      }
      return `<g transform="${T}">${s}</g>`;
    }
    case 'diadem': {
      let s = el('rect', { x: -55, y: -64, width: 110, height: 20, rx: 6, fill: PAL.gold, ...INK(4.5) });
      for (let k = -2; k <= 2; k++) s += path(`M${pt(k * 22 - 8, -63)}L${pt(k * 22, -82)}L${pt(k * 22 + 8, -63)}Z`, { fill: PAL.gold, ...INK(3) });
      [[-30, '#c0392b'], [0, '#2e6fb0'], [30, '#c0392b']].forEach(([x, c]) => { s += jewel(x, -54, 5, c); });
      return `<g transform="${T}">${s}</g>`;
    }
    case 'wreath': {
      let s = '';
      for (let k = 0; k <= 10; k++) {
        const a = Math.PI * (1.08 + k * 0.084), x = Math.cos(a) * 62, y = Math.sin(a) * 70 - 6;
        const rot = (a * 180) / Math.PI + 90;
        s += el('ellipse', { cx: x, cy: y, rx: 9, ry: 16, fill: PAL.green, ...INK(2.5), transform: `rotate(${f(rot + (k % 2 ? 25 : -25))} ${f(x)} ${f(y)})` });
      }
      return `<g transform="${T}">${s}</g>`;
    }
    case 'helmet': {
      let s = path(`M-30,-80C-12,-120 38,-118 46,-86`, { fill: 'none', stroke: hc || PAL.red, 'stroke-width': 18, 'stroke-linecap': 'round' });
      s += path(`M-30,-80C-12,-120 38,-118 46,-86`, { fill: 'none', ...INK(3), 'stroke-dasharray': '2 9' });
      s += path(`M-63,-20C-66,-104 66,-104 63,-20Z`, { fill: PAL.steel, ...INK(4.5) });
      s += path(`M-40,-82Q-30,-92 -16,-94`, { fill: 'none', stroke: '#fff', 'stroke-width': 5, opacity: 0.6, 'stroke-linecap': 'round' });
      s += el('rect', { x: -66, y: -30, width: 132, height: 14, rx: 6, fill: PAL.steel2, ...INK(4) });
      s += el('rect', { x: 14, y: -26, width: 10, height: 36, rx: 4, fill: PAL.steel2, ...INK(3.5) });
      return `<g transform="${T}">${s}</g>`;
    }
    case 'crusader': {
      let s = faceRing(1.16, PAL.steel);
      for (let k = 0; k < 26; k++) {
        const a = (k / 26) * Math.PI * 2, x = hx + Math.cos(a) * 62, y = hy - 4 + Math.sin(a) * 74;
        s += el('circle', { cx: x, cy: y, r: 3.2, fill: 'none', ...INK(1.6) });
      }
      return s;
    }
    case 'hood': return faceRing(1.18, hc || '#4a3328');
    case 'veil': return faceRing(1.17, hc || PAL.blue, '');
    case 'keffiyeh': return faceRing(1.16, hc || '#f2ece0') +
      el('ellipse', { cx: hx, cy: hy - 50, rx: 66, ry: 17, fill: 'none', ...INK(9) });
    case 'turban': {
      const c = hc || '#f6f1e6';
      let s = el('ellipse', { cx: 0, cy: -82, rx: 82, ry: 50, fill: c, ...INK(4.5) });
      s += path(`M-74,-70Q0,-30 76,-82M-70,-96Q0,-62 72,-108M-50,-118Q6,-90 52,-124`, { fill: 'none', ...INK(2.5), opacity: 0.55 });
      s += el('ellipse', { cx: 2, cy: -124, rx: 20, ry: 12, fill: o.hatColor2 ? col(o.hatColor2) : PAL.red, ...INK(4) });
      if (o.royal) s += jewel(6, -84, 9, '#c0392b') + path(`M6,-94C10,-130 30,-150 26,-176C16,-150 -4,-128 6,-94Z`, { fill: '#fbf6ea', ...INK(3) });
      return `<g transform="${T}">${s}</g>`;
    }
    case 'bork': {
      let s = path(`M-46,-60L-40,-150Q-10,-166 30,-150L44,-60Z`, { fill: '#f6f1e6', ...INK(4.5) });
      s += path(`M-40,-146Q-90,-120 -100,-30L-74,-30Q-70,-96 -38,-112Z`, { fill: '#f6f1e6', ...INK(4.5) });
      s += el('rect', { x: -52, y: -70, width: 104, height: 18, rx: 6, fill: PAL.gold, ...INK(4) });
      s += el('ellipse', { cx: 10, cy: -88, rx: 9, ry: 16, fill: PAL.gold, ...INK(3) });
      return `<g transform="${T}">${s}</g>`;
    }
    case 'mitre': {
      let s = path(`M-50,-60C-52,-124 52,-124 50,-60Z`, { fill: PAL.gold, ...INK(4.5) });
      s += path(`M-24,-112L-26,-62M24,-112L26,-62M-48,-86Q0,-74 48,-86`, { fill: 'none', ...INK(3) });
      s += jewel(0, -92, 7, '#c0392b');
      s += path(`M0,-118L0,-146M-11,-134L11,-134`, INK(5));
      s += el('rect', { x: -54, y: -68, width: 108, height: 16, rx: 6, fill: PAL.gold, ...INK(4) });
      return `<g transform="${T}">${s}</g>`;
    }
    case 'papal': {
      let s = path(`M-46,-60C-50,-118 -12,-158 0,-170C12,-158 50,-118 46,-60Z`, { fill: '#fbf6ea', ...INK(4.5) });
      s += path(`M-10,-158L-12,-62L12,-62L10,-158`, { fill: PAL.gold, ...INK(3) });
      s += el('rect', { x: -50, y: -70, width: 100, height: 16, rx: 6, fill: PAL.gold, ...INK(4) });
      return `<g transform="${T}">${s}</g>`;
    }
    case 'cap': return path(`M-58,-38C-64,-104 18,-118 52,-86L74,-58L58,-38Z`, { fill: hc || PAL.red, ...INK(4.5), transform: T });
    case 'band': {
      const c = hc || PAL.bluesTeam;
      return `<g transform="${T}">${path(`M-61,-34Q0,-50 61,-34L60,-18Q0,-32 -60,-18Z`, { fill: c, ...INK(4) })}${path(`M-58,-26Q-84,-12 -90,10L-74,6Q-70,-10 -58,-20Z`, { fill: c, ...INK(3.5) })}</g>`;
    }
    case 'fur': return `<g transform="${T}">${path(`M-58,-50C-64,-120 64,-120 58,-50Q0,-38 -58,-50Z`, { fill: hc || '#7a5233', ...INK(4.5) })}${path(`M-62,-52Q0,-30 62,-52L62,-70Q0,-50 -62,-70Z`, { fill: '#c9a87a', ...INK(4) })}</g>`;
    case 'scholar': return `<g transform="${T}">${path(`M-60,-40C-66,-100 60,-110 64,-46Q0,-58 -60,-40Z`, { fill: hc || PAL.red2, ...INK(4.5) })}</g>`;
    case 'kufi': return path(`M-54,-48C-52,-92 52,-92 54,-48Q0,-58 -54,-48Z`, { fill: hc || '#fbf6ea', ...INK(4), transform: T });
    case 'doge': return `<g transform="${T}">${path(`M-60,-34C-66,-100 -6,-112 24,-128C50,-140 66,-112 60,-34Q0,-48 -60,-34Z`, { fill: hc || '#b5452f', ...INK(4.5) })}${path(`M-60,-38Q0,-52 60,-38L61,-24Q0,-38 -61,-24Z`, { fill: PAL.gold, ...INK(3.5) })}${path(`M-30,-60Q0,-70 30,-64`, { fill: 'none', stroke: PAL.gold, 'stroke-width': 4 })}</g>`;
    case 'monomakh': return `<g transform="${T}">${path(`M-50,-60C-48,-120 48,-120 50,-60Z`, { fill: PAL.gold, ...INK(4.5) })}${path(`M-30,-108L-34,-64M0,-114L0,-62M30,-108L34,-64`, { fill: 'none', ...INK(2.5) })}${path(`M0,-114L0,-146M-11,-132L11,-132`, INK(5))}${path(`M-62,-46Q0,-26 62,-46L62,-72Q0,-52 -62,-72Z`, { fill: '#7a5233', ...INK(4) })}</g>`;
    default: return '';
  }
}

// ----------------------------------------------------------------------------------------------- bodies
const STYLES = ['tunic', 'long', 'imperial', 'armor', 'crusader', 'monk', 'dress', 'kaftan', 'peasant', 'thobe', 'toga'];
CH.BODY_STYLES = STYLES;
const hemOf = st => (['long', 'imperial', 'monk', 'dress', 'kaftan', 'thobe', 'toga'].includes(st) ? -6 : st === 'crusader' ? -34 : -46);

function body(o, t) {
  const st = o.body;
  const robe = col(o.robe || PAL.blue), trim = col(o.trim || PAL.gold);
  const hem = hemOf(st);
  const wide = st === 'dress' ? 66 : (hem > -10 ? 58 : 52);
  const d = `M-37,-152Q0,-162 37,-152L${wide - 2},${hem - 12}Q${wide},${hem} ${wide - 12},${hem}L${-wide + 12},${hem}Q${-wide},${hem} ${-wide + 2},${hem - 12}Z`;
  let s = '';
  if (st === 'armor' || o.cape) {                       // cape behind
    const c = col(o.capeColor || (st === 'armor' ? PAL.red : PAL.purple));
    const fl = Math.sin(t * 2.2 + o.seed) * 6;
    s += path(`M-34,-150Q-70,-60 ${f(-76 + fl)},-24L${f(-30 + fl)},-30Q-20,-90 -10,-150Z`, { fill: c, ...INK(4.5) });
  }
  s += path(d, { fill: robe, ...INK(5) });
  if (st === 'imperial') {
    s += path(`M-12,-150L-12,${hem}L12,${hem}L12,-150Z`, { fill: PAL.gold, ...INK(3.5) });
    for (let y = -138; y < hem - 6; y += 20) s += jewel(0, y, 4.5, (y / 20) % 2 ? '#c0392b' : '#2f8f4f');
    s += path(`M-40,-150Q0,-112 40,-150Q0,-130 -40,-150Z`, { fill: PAL.gold, ...INK(3.5) });
    s += path(`M${-wide + 6},${hem - 14}L${wide - 6},${hem - 14}`, { stroke: PAL.gold, 'stroke-width': 10, 'stroke-linecap': 'round' });
  } else if (st === 'armor') {
    for (let row = 0; row < 4; row++) {
      const y = -136 + row * 18;
      for (let x = -34 + (row % 2) * 9; x <= 34; x += 18) s += path(`M${pt(x - 9, y)}Q${pt(x, y + 12)} ${pt(x + 9, y)}`, { fill: 'none', ...INK(2.4), opacity: 0.7 });
    }
    s += el('rect', { x: -48, y: -70, width: 96, height: 12, rx: 4, fill: PAL.brown, ...INK(3.5) });
    for (let x = -44; x < 44; x += 15) s += el('rect', { x, y: -58, width: 13, height: 20, rx: 3, fill: PAL.brown2, ...INK(2.5) });
  } else if (st === 'crusader') {
    s += path(`M-10,-150L-10,-60L10,-60L10,-150ZM-34,-124L34,-124L34,-106L-34,-106Z`, { fill: PAL.red, ...INK(2.5) });
  } else if (st === 'monk' || st === 'peasant') {
    s += path(`M-46,-92Q0,-82 46,-92`, { fill: 'none', stroke: '#c9a874', 'stroke-width': 7, 'stroke-linecap': 'round' });
    s += path(`M-46,-92Q0,-82 46,-92`, { fill: 'none', ...INK(2), opacity: 0.6 });
    if (st === 'peasant') s += el('rect', { x: 14, y: -76, width: 18, height: 16, fill: CH.shade(robe, -0.15), ...INK(2.5), transform: 'rotate(8 23 -68)' });
  } else if (st === 'kaftan' || st === 'thobe') {
    if (st === 'kaftan') s += path(`M-6,-150L-14,${hem}L14,${hem}L6,-150Z`, { fill: trim, ...INK(3) });
    s += path(`M-48,-98Q0,-86 48,-98L49,-84Q0,-72 -49,-84Z`, { fill: st === 'kaftan' ? PAL.red : PAL.brown, ...INK(3.5) });
  } else if (st === 'dress') {
    s += path(`M-42,-104Q0,-94 42,-104`, { fill: 'none', stroke: trim, 'stroke-width': 9, 'stroke-linecap': 'round' });
    s += path(`M-40,-150Q0,-118 40,-150Q0,-134 -40,-150Z`, { fill: trim, ...INK(3) });
    for (const x of [-22, 0, 22]) s += jewel(x, -136, 4, '#c0392b');
    s += path(`M${-wide + 6},${hem - 14}L${wide - 6},${hem - 14}`, { stroke: trim, 'stroke-width': 9, 'stroke-linecap': 'round' });
  } else if (st === 'toga') {
    s += path(`M-37,-152Q10,-120 40,-60Q20,-50 10,-60Q-10,-110 -37,-152Z`, { fill: CH.shade(robe, -0.12), ...INK(3) });
  } else {                                               // tunic / long
    s += path(`M-46,-94Q0,-84 46,-94L47,-80Q0,-70 -47,-80Z`, { fill: CH.shade(robe, -0.3), ...INK(3) });
    if (o.trim) s += path(`M${-wide + 6},${hem - 10}L${wide - 6},${hem - 10}`, { stroke: trim, 'stroke-width': 8, 'stroke-linecap': 'round' });
  }
  return s;
}

// ----------------------------------------------------------------------------------------------- arms, legs, poses
// hand / elbow positions in "outward" coordinates relative to the shoulder (x away from the body, y down)
const POSES = {
  idle: { F: [[10, 92], [22, 46]], B: [[10, 92], [22, 46]] },
  point: { F: [[100, -16], [54, -8]], B: [[10, 92], [22, 46]] },
  point_up: { F: [[46, -96], [46, -40]], B: [[10, 92], [22, 46]] },
  cheer: { F: [[40, -98], [56, -42]], B: [[40, -98], [56, -42]] },
  wave: { F: [[52, -92], [64, -30]], B: [[10, 92], [22, 46]] },
  hold: { F: [[46, 34], [42, 76]], B: [[10, 92], [22, 46]] },
  raise: { F: [[32, -104], [58, -50]], B: [[10, 92], [22, 46]] },
  fight: { F: [[32, -104], [58, -50]], B: [[-8, 40], [28, 60]] },
  shrug: { F: [[76, -18], [54, 32]], B: [[76, -18], [54, 32]] },
  think: { F: [[-24, -28], [34, 14]], B: [[6, 58], [48, 34]] },
  scared: { F: [[-6, -64], [44, -8]], B: [[-6, -64], [44, -8]] },
  arms_crossed: { F: [[-46, 30], [22, 36]], B: [[-44, 22], [22, 30]] },
  present: { F: [[90, 20], [52, 38]], B: [[10, 92], [22, 46]] },
  pray: { F: [[-32, 8], [26, 44]], B: [[-32, 8], [26, 44]] },
  fist: { F: [[34, -76], [60, -14]], B: [[10, 92], [22, 46]] },
  facepalm: { F: [[-30, -92], [44, -34]], B: [[10, 92], [22, 46]] },
  carry: { F: [[16, -96], [50, -50]], B: [[16, -96], [50, -50]] },
  walk: { F: [[10, 92], [22, 46]], B: [[10, 92], [22, 46]] },
  run: { F: [[10, 92], [22, 46]], B: [[10, 92], [22, 46]] },
  hands_up: { F: [[52, -96], [66, -36]], B: [[52, -96], [66, -36]] },
  hips: { F: [[6, 58], [48, 34]], B: [[6, 58], [48, 34]] },
};
CH.POSES = Object.keys(POSES).concat(['bow', 'kneel', 'fallen', 'sit']);

function armPts(o, t, which) {
  const P = POSES[o.pose] || POSES.idle;
  let [[hx, hy], [cx, cy]] = which === 'F' ? P.F : P.B;
  const ph = t * 1.0 + (o.seed % 10);
  const breath = Math.sin(ph * 2.1) * 2;
  hy += breath;
  const pose = o.pose;
  if (pose === 'cheer' || pose === 'hands_up') { const w = Math.sin(t * 7 + (which === 'F' ? 0 : 2.4) + o.seed) * 12; hx += w; cx += w * 0.4; }
  if (pose === 'wave' && which === 'F') { const w = Math.sin(t * 9 + o.seed) * 16; hx += w; }
  if (pose === 'fight' && which === 'F') {
    const u = (Math.sin(t * 5.5 + o.seed) + 1) / 2;
    hx = CH.lerp(32, 100, u); hy = CH.lerp(-104, 10, u); cx = CH.lerp(58, 62, u); cy = CH.lerp(-50, -18, u);
  }
  if (pose === 'fist' && which === 'F') { const u = Math.max(0, Math.sin(t * 6 + o.seed)); hy -= u * 18; }
  if (pose === 'scared') { hx += Math.sin(t * 40 + (which === 'F' ? 0 : 1)) * 2; }
  if (pose === 'shrug') { const u = Math.sin(t * 3 + o.seed) * 4; hy += u; }
  if (pose === 'walk' || pose === 'run') {
    const k = pose === 'run' ? 2.6 : 1.7, a = pose === 'run' ? 34 : 22;
    const sw = Math.sin(t * Math.PI * 2 * k + o.seed) * a * (which === 'F' ? 1 : -1);
    hx = 10 + sw; cx = 22 + sw * 0.5;
    if (pose === 'run') { hy = 60; cy = 40; }
  }
  if (pose === 'point' && which === 'F') { const q = ease.back(seg(t, o.delay || 0, (o.delay || 0) + 0.35)); hx = CH.lerp(14, 100, q); hy = CH.lerp(80, -16, q); cx = CH.lerp(22, 54, q); cy = CH.lerp(46, -8, q); }
  return { h: [hx, hy], c: [cx, cy] };
}

function arm(o, t, which) {
  // facing right: front arm is the right shoulder (+x), back arm the left (-x)
  const side = which === 'F' ? 1 : -1;
  const out = o.front ? side : (which === 'F' ? 1 : -1);
  const S = [SHOULDER.x * side * (o.front ? 1 : 0.86) + (o.front ? 0 : 4), SHOULDER.y];
  const { h, c } = armPts(o, t, which);
  const H = [S[0] + h[0] * out, S[1] + h[1]], C = [S[0] + c[0] * out, S[1] + c[1]];
  const sleeve = col(o.sleeve || (o.body === 'crusader' ? PAL.steel : o.body === 'armor' ? PAL.steel2 : o.robe || PAL.blue));
  const d = `M${pt(...S)}Q${pt(...C)} ${pt(...H)}`;
  let s = path(d, { fill: 'none', stroke: ink, 'stroke-width': 17, 'stroke-linecap': 'round' });
  s += path(d, { fill: 'none', stroke: sleeve, 'stroke-width': 8.5, 'stroke-linecap': 'round' });
  return { svg: s, hand: H, elbow: C, dir: Math.atan2(H[1] - C[1], H[0] - C[0]) };
}
const handSVG = (H, skin) => el('circle', { cx: H[0], cy: H[1], r: 11.5, fill: skin, ...INK(4) });

function legs(o, t) {
  const hem = hemOf(o.body);
  const pants = col(o.pants || CH.shade(col(o.robe || PAL.blue), -0.35));
  const boots = col(o.boots || '#4a3022');
  let s = '';
  const walking = o.pose === 'walk' || o.pose === 'run' || o.walking;
  for (const side of [-1, 1]) {
    let fx = side * 19, fy = -8, lift = 0;
    if (walking) {
      const k = o.pose === 'run' ? 2.6 : 1.7, ph = Math.sin(t * Math.PI * 2 * k + o.seed + (side > 0 ? Math.PI : 0));
      fx += ph * (o.pose === 'run' ? 26 : 16);
      lift = Math.max(0, Math.cos(t * Math.PI * 2 * k + o.seed + (side > 0 ? Math.PI : 0))) * (o.pose === 'run' ? 16 : 8);
    }
    if (hem > -20) {                                   // long robes: only the boots peek out
      s += el('ellipse', { cx: fx + 6, cy: fy + 2 - lift, rx: 16, ry: 8.5, fill: boots, ...INK(4) });
      continue;
    }
    const d = `M${pt(side * 16, -52)}L${pt(fx, fy - 4 - lift)}`;
    s += path(d, { stroke: ink, 'stroke-width': 17, 'stroke-linecap': 'round' });
    s += path(d, { stroke: pants, 'stroke-width': 8.5, 'stroke-linecap': 'round' });
    s += path(`M${pt(fx - 12, fy - lift)}Q${pt(fx - 12, fy - 13 - lift)} ${pt(fx + 2, fy - 12 - lift)}Q${pt(fx + 22, fy - 11 - lift)} ${pt(fx + 22, fy - lift)}Z`, { fill: boots, ...INK(4) });
  }
  return s;
}

// ----------------------------------------------------------------------------------------------- props
function prop(o, t, A, B) {
  const p = o.prop;
  if (!p || p === 'none') return { back: '', front: '' };
  const [x, y] = A.hand;
  const pc = col(o.propColor);
  const flame = (fx, fy, k = 1) => {
    const w = Math.sin(t * 13 + o.seed) * 3 * k, h = (34 + Math.sin(t * 9) * 5) * k;
    return path(`M${pt(fx - 13 * k, fy)}Q${pt(fx - 16 * k + w, fy - h * 0.6)} ${pt(fx + w, fy - h)}Q${pt(fx + 16 * k + w, fy - h * 0.6)} ${pt(fx + 13 * k, fy)}Z`, { fill: PAL.fire2, ...INK(3) }) +
      path(`M${pt(fx - 6 * k, fy)}Q${pt(fx - 7 * k + w, fy - h * 0.4)} ${pt(fx + w * 0.6, fy - h * 0.65)}Q${pt(fx + 7 * k, fy - h * 0.4)} ${pt(fx + 6 * k, fy)}Z`, { fill: PAL.fire1 });
  };
  const ang = A.dir * 180 / Math.PI;
  let front = '', back = '';
  switch (p) {
    case 'sword': {
      const a = (o.pose === 'idle' || o.pose === 'walk') ? 100 : (o.pose === 'hold' || o.pose === 'present') ? -70 : ang - 70;
      front = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})">${path('M14,-6L118,-2L128,0L118,2L14,6Z', { fill: '#e6ebeb', ...INK(3.5) })}${el('rect', { x: 6, y: -15, width: 9, height: 30, rx: 3, fill: PAL.gold, ...INK(3) })}${el('rect', { x: -14, y: -5, width: 22, height: 10, rx: 4, fill: PAL.brown, ...INK(3) })}</g>`;
      break;
    }
    case 'spear': case 'pike': {
      const a = o.pose === 'fight' ? ang - 60 : -86;
      front = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})">${path('M-90,0L170,0', { stroke: ink, 'stroke-width': 11, 'stroke-linecap': 'round' })}${path('M-90,0L170,0', { stroke: '#9b7148', 'stroke-width': 5, 'stroke-linecap': 'round' })}${path('M168,-10L204,0L168,10Z', { fill: '#dfe5e5', ...INK(3.5) })}</g>`;
      break;
    }
    case 'axe': {
      const a = o.pose === 'fight' ? ang - 70 : -80;
      front = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})">${path('M-40,0L130,0', { stroke: ink, 'stroke-width': 12, 'stroke-linecap': 'round' })}${path('M-40,0L130,0', { stroke: '#9b7148', 'stroke-width': 6, 'stroke-linecap': 'round' })}${path('M104,-4Q118,-46 146,-40Q130,0 146,40Q118,46 104,4Z', { fill: '#dfe5e5', ...INK(3.5) })}</g>`;
      break;
    }
    case 'torch': {
      front = `<g transform="translate(${f(x)} ${f(y)}) rotate(-10)">${el('rect', { x: -6, y: -86, width: 12, height: 100, rx: 4, fill: PAL.brown, ...INK(3.5) })}${flame(0, -84, 1.1)}</g>`;
      break;
    }
    case 'flag': case 'banner': {
      const c = pc || PAL.purple, w1 = Math.sin(t * 5 + o.seed) * 10, w2 = Math.sin(t * 5 + o.seed + 1.5) * 10;
      const em = o.emblem ? CH.emblem(o.emblem, 62, -196, 0.55) : '';
      front = `<g transform="translate(${f(x)} ${f(y)})">${path('M0,30L0,-250', { stroke: ink, 'stroke-width': 11, 'stroke-linecap': 'round' })}${path('M0,30L0,-250', { stroke: '#9b7148', 'stroke-width': 5, 'stroke-linecap': 'round' })}${path(`M4,-244C40,${f(-252 + w1)} 80,${f(-236 + w2)} 120,${f(-244 + w1)}L${f(120 + w2 * 0.3)},${f(-152 + w1)}C80,${f(-144 + w2)} 40,${f(-160 + w1)} 4,-152Z`, { fill: c, ...INK(4) })}${em}</g>`;
      break;
    }
    case 'scroll': {
      front = `<g transform="translate(${f(x + 4)} ${f(y - 30)}) rotate(-6)">${el('rect', { x: -6, y: 0, width: 66, height: 84, fill: '#f7ecd2', ...INK(3.5) })}${path('M8,22L50,22M8,38L50,38M8,54L40,54', INK(2.5))}${el('rect', { x: -12, y: -8, width: 78, height: 14, rx: 7, fill: '#e4cf9e', ...INK(3.5) })}${el('rect', { x: -12, y: 78, width: 78, height: 14, rx: 7, fill: '#e4cf9e', ...INK(3.5) })}</g>`;
      break;
    }
    case 'book': {
      front = `<g transform="translate(${f(x)} ${f(y)}) rotate(-8)">${el('rect', { x: -10, y: -58, width: 60, height: 76, rx: 4, fill: pc || PAL.red2, ...INK(4) })}${el('rect', { x: 2, y: -48, width: 38, height: 22, fill: PAL.gold, ...INK(2.5) })}${path('M-10,14L50,14', { stroke: '#f7ecd2', 'stroke-width': 4 })}</g>`;
      break;
    }
    case 'cross': {
      front = `<g transform="translate(${f(x)} ${f(y)})">${path('M0,40L0,-170M-30,-130L30,-130', { stroke: ink, 'stroke-width': 13, 'stroke-linecap': 'round' })}${path('M0,40L0,-170M-30,-130L30,-130', { stroke: PAL.gold, 'stroke-width': 6, 'stroke-linecap': 'round' })}</g>`;
      break;
    }
    case 'orb': front = el('circle', { cx: x + 6, cy: y - 22, r: 18, fill: PAL.gold, ...INK(3.5) }) + path(`M${pt(x + 6, y - 40)}L${pt(x + 6, y - 60)}M${pt(x - 2, y - 52)}L${pt(x + 14, y - 52)}`, INK(4)); break;
    case 'coin': front = el('circle', { cx: x + 8, cy: y - 18, r: 20, fill: PAL.gold, ...INK(3.5) }) + el('circle', { cx: x + 8, cy: y - 18, r: 12, fill: 'none', ...INK(2) }); break;
    case 'crown': front = `<g transform="translate(${f(x + 8)} ${f(y - 22)})">${path('M-26,10L-30,-22L-14,-6L0,-28L14,-6L30,-22L26,10Z', { fill: PAL.gold, ...INK(3.5) })}${jewel(0, 0, 4, '#c0392b')}</g>`; break;
    case 'quill': front = `<g transform="translate(${f(x)} ${f(y)}) rotate(-35)">${path('M0,0L0,-80', INK(3))}${path('M0,-10Q-20,-50 0,-96Q16,-50 0,-10Z', { fill: '#fbf6ea', ...INK(3) })}</g>`; break;
    case 'staff': front = `<g transform="translate(${f(x)} ${f(y)})">${path('M0,40L0,-150', { stroke: ink, 'stroke-width': 11, 'stroke-linecap': 'round' })}${path('M0,40L0,-150', { stroke: '#9b7148', 'stroke-width': 5, 'stroke-linecap': 'round' })}${path('M0,-150Q0,-186 26,-180Q40,-168 26,-156', { fill: 'none', ...INK(8) })}</g>`; break;
    case 'hammer': {
      const a = o.pose === 'fight' ? ang - 70 : -60;
      front = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})">${path('M-10,0L70,0', { stroke: ink, 'stroke-width': 10, 'stroke-linecap': 'round' })}${path('M-10,0L70,0', { stroke: '#9b7148', 'stroke-width': 4, 'stroke-linecap': 'round' })}${el('rect', { x: 62, y: -18, width: 22, height: 36, rx: 4, fill: PAL.steel2, ...INK(3.5) })}</g>`;
      break;
    }
    case 'sack': case 'bag': front = `<g transform="translate(${f(x)} ${f(y)})">${path('M-26,4Q-40,60 0,64Q40,60 26,4Q8,-4 -26,4Z', { fill: '#c9a26a', ...INK(4) })}${path('M-16,0Q0,-14 16,0', { fill: 'none', ...INK(4) })}${p === 'bag' ? el('circle', { cx: 0, cy: 34, r: 12, fill: PAL.gold, ...INK(2.5) }) : ''}</g>`; break;
    case 'bundle': front = `<g transform="translate(${f(x)} ${f(y)}) rotate(-40)">${path('M0,0L120,0', { stroke: ink, 'stroke-width': 9, 'stroke-linecap': 'round' })}${path('M0,0L120,0', { stroke: '#9b7148', 'stroke-width': 4, 'stroke-linecap': 'round' })}${el('circle', { cx: 122, cy: 22, r: 30, fill: pc || PAL.red, ...INK(4) })}</g>`; break;
    case 'pitchfork': front = `<g transform="translate(${f(x)} ${f(y)}) rotate(-84)">${path('M-60,0L150,0', { stroke: ink, 'stroke-width': 10, 'stroke-linecap': 'round' })}${path('M-60,0L150,0', { stroke: '#9b7148', 'stroke-width': 4, 'stroke-linecap': 'round' })}${path('M150,-18L150,18M150,-18L184,-18M150,0L188,0M150,18L184,18', INK(5))}</g>`; break;
    case 'shield': {
      const c = pc || PAL.red, [bx, by] = B.hand;
      front = `<g transform="translate(${f(bx + 4)} ${f(by - 14)})">${el('circle', { r: 44, fill: c, ...INK(4.5) })}${el('circle', { r: 30, fill: 'none', stroke: CH.shade(c, -0.25), 'stroke-width': 3 })}${CH.emblem(o.emblem || 'chirho', 0, 0, 0.42)}${el('circle', { r: 7, fill: PAL.gold, ...INK(2.5) })}</g>`;
      break;
    }
    case 'candle': front = el('rect', { x: x - 6, y: y - 46, width: 12, height: 42, fill: '#fbf6ea', ...INK(3) }) + flame(x, y - 46, 0.55); break;
    case 'key': front = `<g transform="translate(${f(x)} ${f(y)}) rotate(-30)">${el('circle', { cx: 0, cy: -10, r: 12, fill: 'none', ...INK(6) })}${path('M0,2L0,50M0,40L12,40M0,30L10,30', INK(6))}</g>`; break;
    case 'goblet': front = `<g transform="translate(${f(x)} ${f(y - 16)})">${path('M-14,-24Q-14,4 0,6Q14,4 14,-24Z', { fill: PAL.gold, ...INK(3) })}${path('M0,6L0,22M-10,22L10,22', INK(4))}</g>`; break;
    case 'brick': front = el('rect', { x: x - 22, y: y - 36, width: 44, height: 24, rx: 3, fill: '#c8714a', ...INK(3.5) }); break;
    case 'plan': front = `<g transform="translate(${f(x)} ${f(y)}) rotate(-10)">${el('rect', { x: -4, y: -64, width: 74, height: 56, fill: '#d9e6ea', ...INK(3.5) })}${path('M8,-20Q34,-60 60,-20M14,-20L54,-20', { fill: 'none', stroke: PAL.blue2, 'stroke-width': 3 })}</g>`; break;
    default: break;
  }
  return { back, front };
}

// emblems for shields, flags, coins
CH.emblem = (kind, x, y, k = 1) => {
  const T = `transform="translate(${f(x)} ${f(y)}) scale(${k})"`;
  switch (kind) {
    case 'cross': return `<g ${T}>${path('M0,-50L0,50M-34,-14L34,-14', { stroke: '#fbf6ea', 'stroke-width': 16, 'stroke-linecap': 'round' })}</g>`;
    case 'redcross': return `<g ${T}>${path('M0,-50L0,50M-34,-14L34,-14', { stroke: PAL.red, 'stroke-width': 16, 'stroke-linecap': 'round' })}</g>`;
    case 'chirho': return `<g ${T}>${path('M0,-48L0,52M-30,-20L30,30M30,-20L-30,30', { stroke: '#fbf6ea', 'stroke-width': 10, 'stroke-linecap': 'round' })}${path('M0,-48Q28,-48 28,-30Q28,-12 0,-12', { fill: 'none', stroke: '#fbf6ea', 'stroke-width': 10 })}</g>`;
    case 'crescent': return `<g ${T}>${path('M14,-44A46,46 0 1 0 14,44A36,36 0 1 1 14,-44Z', { fill: '#fbf6ea' })}</g>`;
    case 'eagle': return `<g ${T}>${CH.icon ? CH.icon('eagle', 0, 0, 0.5, 0, { mono: '#fbf6ea' }) : ''}</g>`;
    case 'lion': return `<g ${T}>${path('M-30,30L-20,-10Q-30,-40 0,-44Q30,-40 24,-10L34,30Z', { fill: PAL.gold })}</g>`;
    case 'star': return `<g ${T}>${path(CH.poly([...Array(10)].map((_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 20 : 48; return [Math.cos(a) * r, Math.sin(a) * r]; })), { fill: '#fbf6ea' })}</g>`;
    default: return '';
  }
};

// ----------------------------------------------------------------------------------------------- the figure
const DEFAULTS = { x: 0, y: 0, s: 1, f: 1, skin: PAL.skin, body: 'tunic', expr: 'neutral', pose: 'idle', hat: 'none', hair: 'short', beard: 'none', prop: 'none', lod: 2, enter: 'none', delay: 0 };

CH.person = (opt, t) => {
  const o = { ...DEFAULTS, ...opt };
  o.seed = o.seed !== undefined ? o.seed : hash(JSON.stringify([o.x, o.y, o.robe, o.hat]));
  o.skin = col(o.skin);
  o.front = o.f === 0;
  if (o.hat === 'crusader' || o.hat === 'hood' || o.hat === 'veil' || o.hat === 'keffiyeh' || o.hat === 'helmet' || o.hat === 'turban' || o.hat === 'bork' || o.hat === 'papal' || o.hat === 'mitre') {
    if (o.hair === 'short' || o.hair === 'curly') o.hair = 'none';
  }
  if (o.hat === 'crown' && o.hair === 'short' && o.beard === 'none' && !opt.hair) o.hair = 'none';
  // entrance
  const tt = t - (o.delay || 0);
  let ex = 0, ey = 0, es = 1, eo = 1;
  if (o.enter !== 'none') {
    if (tt < 0) return '';
    const q = seg(tt, 0, 0.42);
    if (o.enter === 'pop') { es = Math.max(0.001, ease.back(q)); eo = clamp(q * 3); }
    else if (o.enter === 'rise') { ey = (1 - ease.out(q)) * 140; eo = clamp(q * 2.5); }
    else if (o.enter === 'drop') { const qb = seg(tt, 0, 0.6); ey = -(1 - ease.bounce(qb)) * 500; }
    else if (o.enter === 'slide_l' || o.enter === 'slide_r') { const qs = seg(tt, 0, 0.7); ex = (1 - ease.out(qs)) * 700 * (o.enter === 'slide_l' ? -1 : 1); if (qs < 1) o.walking = true; }
    else if (o.enter === 'fade') eo = clamp(q * 2);
  }
  // whole-figure poses
  let rot = 0, dy = 0;
  if (o.pose === 'bow') rot = 22;
  if (o.pose === 'kneel' || o.pose === 'sit') dy = 40;
  if (o.pose === 'fallen') { rot = -88; }
  const breathe = 1 + Math.sin(t * 2.2 + o.seed) * 0.012;
  const headTilt = Math.sin(t * 1.3 + o.seed) * 2.2 + (o.expr === 'shock' ? -4 : 0) + (o.expr === 'sad' ? 5 : 0);
  const bob = (o.pose === 'cheer' || o.pose === 'run') ? Math.abs(Math.sin(t * 7 + o.seed)) * -8 : 0;
  // assemble (facing right in local space)
  const A = arm(o, t, 'F'), B = arm(o, t, 'B');
  const P = prop(o, t, A, B);
  let s = '';
  if (o.shadow !== false && o.pose !== 'fallen') s += el('ellipse', { cx: 0, cy: 0, rx: 54, ry: 10, fill: ink, opacity: 0.16 });
  let figure = '';
  figure += B.svg + handSVG(B.hand, o.skin);
  figure += legs(o, t);
  figure += `<g transform="translate(0 ${f(-8)}) scale(1 ${breathe.toFixed(4)}) translate(0 8)">${body(o, t)}</g>`;
  const head = hairBack(o) + path(egg(HEAD.x, HEAD.y, HEAD.rx, HEAD.ry), { fill: o.skin, ...INK(5) }) +
    beard(o) + face(o, t) + hairFront(o) + hat(o, t);
  figure += `<g transform="rotate(${f(headTilt)} 0 -150)">${head}</g>`;
  figure += P.back + A.svg + handSVG(A.hand, o.skin) + P.front;
  if (o.pose === 'shrug' || o.pose === 'pray' || o.pose === 'arms_crossed' || o.pose === 'scared') figure += handSVG(B.hand, o.skin);
  s += `<g transform="translate(0 ${f(dy + bob)}) rotate(${f(rot)} 0 ${o.pose === 'fallen' ? -40 : 0})">${figure}</g>`;
  if (o.label) s += CH.plate(o.label, { kind: 'label', size: 30 / Math.max(0.4, 1), x: 0, y: 34, s: 1 });
  const mir = o.f === -1 ? -1 : 1;
  return `<g transform="translate(${f(o.x + ex)} ${f(o.y + ey)}) scale(${(o.s * es * mir).toFixed(4)} ${(o.s * es).toFixed(4)})" opacity="${f(eo)}">${s}</g>`;
};

// quick random extras for crowds and armies
CH.randomPerson = (r, base = {}) => {
  const robes = base.robes || ['#4e7da0', '#b5452f', '#857858', '#6e8f4a', '#c9a26a', '#94588a', '#7c5433'];
  const hats = base.hats || ['none', 'none', 'none', 'cap', 'kufi', 'none'];
  const hairs = ['short', 'short', 'curly', 'bald', 'long'];
  const skins = ['#f7e4c4', '#f2d6ae', '#e9c79c', '#dcb488', '#c99a6e'];
  const pick = a => a[Math.floor(r() * a.length)];
  return {
    robe: pick(robes), hat: pick(hats), hair: pick(hairs), hairColor: pick(['#3b2a20', '#5a3a22', '#2a2522', '#7a5233']),
    beard: r() < 0.3 ? pick(['short', 'moustache', 'goatee']) : 'none', skin: pick(skins), seed: Math.floor(r() * 1e6),
    ...base.over,
  };
};
})();
