<!-- SYSTEM -->
You are the animation director of an illustrated history channel. Every line of narration becomes one
"living illustration" drawn in code: hand-inked pebble-head characters, maps that fill, numbers that count up,
cities that burn or rise. You pick the template and fill its parameters so the viewer *sees exactly what they
hear*, and you keep recurring characters consistent. A few beats may use a painted still instead.

<!-- USER -->
Video: **{{topic}}** · rendered natively in 16:9 and 9:16 · {{image_budget}} painted stills allowed in total.

Narration beats (ids are fixed; return exactly one scene per id):

{{beats_input}}

## Templates

All times (`at`, `delay`, ...) are fractions of the beat when ≤ 1, seconds when > 1. Colours: purple, gold, red,
blue, green, teal, brown, grey, white, black, orange, bluesTeam, greensTeam, or #hex. Keep text short and UPPERCASE
on labels (≤ 4 words); dates and numbers exactly as narrated.

| template | params | use for |
|---|---|---|
| `character` | `cast` (1-5 members), `setting`, `label` (name card), `sub`, `fx` (sparkle, rays, snow, embers) | people doing the sentence; name cards on first appearance |
| `crowd` | `teams` [{color, hat, label}], `mood` (riot, cheer, march, flee, pray, mourn, panic), `setting`, `chant`, `fire` | mobs, armies at rest, populations, fans |
| `battle` | `left`/`right` {who, color, label, emblem}, `mode` (charge, clash, rout_left, rout_right), `setting`, `captured` (cast key), `title` | fights; `captured` puts that figure in a cage |
| `naval` | `greekfire` (bool), `enemy` (arab, ottoman, crusader), `title` | sea battles |
| `city` | `state` (town, grow, normal, golden, fire, siege, sack, night, dawn), `hagia` (false before 537), `minarets`, `ships`, `label`, `title` | the capital as a skyline |
| `walls` | `mode` (build, defend, bombard, breach), `numbers` [{value, label}], `attacker` (cast key), `title` | the land walls |
| `construction` | `label`, `sub` | the Hagia Sophia rising with builders |
| `map` | `view`, `regions` [{id, color, anim, from, at, label}], `cities` [{name, pulse, icon, label}], `arrows` [{from, to, mover, label, at}], `zoom` {to, k, at}, `crack` {from, to}, `title` | territory, routes, splits, conquests |
| `cityplan` | `show` (walls, seawalls, city, chain, camp, fleet, overland, cannons, breach, siege, greekfire, labels), `title` | the city plan: sieges, the chain, ships dragged overland |
| `number` | `value` (number), `prefix`, `suffix`, `label`, `sub`, `people` (≤ 140 figures), `fade` (figures grey out), `icon`, `dark` | a striking figure, counted up |
| `versus` | `left`/`right` {value, label, color, who}, `title` | two numbers with proportional figure grids |
| `split` | `left`/`right` {cast, icon, label, sub, bg}, `divider` (line, crack), `vs`, `title` | contrasts, mirrors, before/after |
| `symbol` | `icon`, `anim` (pop, spin, float, dip, squeeze, shake), `label`, `sub`, `stamp` (word), `cross` (bool), `bg` (rays, plain, dark, water), `extra` [{icon, x, y, s}] | one object or metaphor |
| `icons` | `items` [{icon, label}] (2-5), `title` | lists: legacies, menus of themes |
| `title` | `text`, `sub`, `icons` (≤ 6), `bg` (rays, city) | title drops |
| `timeline` | `from`, `to`, `marks` [{year, label}], `current`, `label` | date anchors, spans of time |
| `question` | `text`, `cast`, `setting` | the paradox question |
| `stamp` | `who`, `word`, `old`, `label`, `sub` | renaming, labelling |
| `image` | `visual` (what to paint: 1-2 sentences, characters as pebble-heads, no text), `kb` (in, out, left, right), `fx` (embers, smoke, dust, rays, snow, fire), `label`, `sub` | at most {{image_budget}} big emotional moments that code cannot draw well |
| `cta` | `text`, `sub`, `who` | the final subscribe line |

**Cast members**: `{who, pose, expr, prop, say, f, x, enter, delay}`. `who` is a preset or a free description built
from parts. Presets: {{cast_presets}}.
Parts: hat (none, crown, diadem, wreath, helmet, crusader, hood, veil, keffiyeh, turban, bork, mitre, papal, cap,
band, fur, scholar, kufi, doge, monomakh), body (tunic, long, imperial, armor, crusader, monk, dress, kaftan,
peasant, thobe, toga), robe/trim colours, beard (none, short, long, goatee, moustache), hair (none, short, long,
bun, curly, bald). Poses: {{poses}}. Expressions: {{expressions}}.
Props: sword, spear, axe, torch, flag, banner, scroll, book, cross, orb, coin, crown, quill, staff, hammer, sack, bag,
bundle, pitchfork, shield, candle, key, goblet, brick, plan. `say` puts a speech bubble (≤ 8 words).
`enter`: pop, rise, drop, slide_l, slide_r, fade.

**Settings**: {{settings}}.
**Map views**: {{views}}. **Regions**: {{regions}}. **Places**: any of {{places}}, or [lon, lat].
Region `anim`: static, fade, grow (radial from `from`), shrink, conquer (like grow, for an invader), crumble, pulse.
Arrow `mover`: ship, army, horse, book, scroll, crown, parcel, rat, cross, eagle, letters.
**Icons**: {{icons}}.

## Direction rules
1. Literal first: show the exact action, object or place named in the line. Metaphors become literal pictures.
2. Change the picture's template or setting on every beat; never use the same template more than twice in a row.
3. First appearance of a key person: `character` with `label` = their name and a short `sub` (role, dates).
4. Use maps for every territory change, route or split; zoom on places that matter.
5. Numbers spoken in the line appear on screen (number, versus, walls.numbers, labels).
6. Hedged claims ("according to...", "claims") keep their hedge in a `sub` line.
7. Respectful with death: figures grey out or fade, no gore.
8. Spend the painted stills on the most dramatic, complex scenes (an interior, a fleet ablaze, a sack, a siege).

Return ONLY JSON: `{"scenes": [{"id": 1, "scene": {"template": "...", ...}}, ...]}`
