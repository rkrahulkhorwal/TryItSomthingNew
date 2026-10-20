# 09 · The animation engine (animated mode)

The reference video uses 200 still illustrations and no motion. Animated mode keeps its editing rules: one picture
per sentence, cuts on the breath, and the picture leading the voice. But it draws every picture in code, so pictures
*move*. A video needs no image model at all, or only a handful of painted stills for scenes code can't draw well.

## How it works

```
beats.json (one scene spec per beat)         timeline (voice, pauses, cuts, captions)
            └───────────────┬──────────────────────────┘
                            ▼
      payload.json ──► N headless Chromium pages (Playwright), each rendering a contiguous frame range
                            │   CH.renderAt(T) rebuilds the SVG for time T, deterministically
                            ▼
      JPEG frames ──► ffmpeg segment per worker ──► concat ──► mux with the mixed, loudness-normalised audio
```

- **Deterministic:** `CH.renderAt(T)` depends only on `T`. Workers render disjoint frame ranges in parallel and their
  segments join seamlessly. On 4 CPU cores, 3 workers render 1080p at about 7-8 frames per second, so a 3-minute
  video takes about 12 minutes per format.
- **Layers:**
  - paper colour
  - flat layer: painted stills with Ken Burns
  - ink layer: all line art, passed through an SVG displacement filter whose noise seed changes about 10 times a
    second. That gives the hand-drawn "line boil".
  - paper texture, multiplied over everything
  - UI layer: word captions, header, progress bar, chapter date stamps
  - chapter flash
- **Camera:** every scene drifts slowly toward its focus point. Punch shots, which vertical formats get from the
  timeline, frame about 16% tighter. Maps can zoom to a city.
- **Native layouts:** templates lay themselves out from the frame size.
  - In 16:9, casts spread sideways.
  - In 9:16, the stage sits between the header (top 11%) and the captions (69-82%). Panels stack and maps use a
    tighter box.

Code lives in `chronicle/anim/`:

| File | What it does |
|---|---|
| `runtime/core.js` | math, easing, seeded RNG, palette, SVG and text helpers, paper texture, stage, camera, `renderAt`, captions, header, stamps |
| `runtime/people.js` | the original **pebble-head** rig: 17 expressions, 25 poses, 20 hats, 11 bodies, hair, beards, 25 props, blinking, breathing, talking, entrances |
| `runtime/world.js` | skies, hills, sea and waves, architecture (domes, the Hagia Sophia, walls with damage, temples that collapse, onion domes), fire, smoke, embers, light shafts, fight clouds, ships with Greek-fire siphons, the bombard, horses, chariots, about 40 icons, speech bubbles, arrows |
| `runtime/maps.js` | d3-geo maps on Natural Earth coastlines; hand-traced historical territories clipped to land; animated regions; arrows with movers; the stylised Constantinople city plan |
| `runtime/scenes.js` | the scene templates and the cast presets |
| `render.py` | local server, browser launch, parallel workers, stills, payload |
| `plan.py`, `catalog.py` | scene planning (LLM or hand-written JSON); the catalog is read from the JS so prompts never drift from the code |

## Scene templates

Each beat gets `{"template": ..., params}`. Times inside a spec are fractions of the beat when ≤ 1, otherwise
seconds.

| template | use it for | key params |
|---|---|---|
| `character` | people acting out the line, name cards | `cast`, `setting`, `label`, `sub`, `title`, `fx`, `extras` |
| `crowd` | mobs, fans, populations | `teams`, `mood`, `chant`, `fire`, `chariots` |
| `battle` | clashes, routs, captures | `left`, `right`, `mode`, `captured`, `title` |
| `naval` | sea battles, Greek fire | `greekfire`, `enemy` |
| `city` | the capital as a skyline: town, growing, golden, burning, besieged, sacked | `state`, `hagia`, `minarets` |
| `walls` | building, defending, bombarding, breaching | `mode`, `numbers`, `attacker` |
| `construction` | a building rising, with a dimension line | `start`, `max`, `measure` |
| `map` | territory, routes, splits, conquests | `view`, `regions`, `cities`, `arrows`, `zoom`, `crack` |
| `cityplan` | the walls, the chain, ships dragged overland | `show`, `fleetColor`, `besieger` |
| `number` / `versus` | striking figures counted up, proportional crowds | `value`, `people`, `fade`, `unit` |
| `split` | contrasts and mirrors | `left`, `right`, `divider`, `vs` |
| `symbol` / `icons` | one object or metaphor (dip, squeeze, fall, gather) / lists | `icon`, `anim`, `gather`, `stamp` |
| `title`, `timeline`, `question`, `stamp`, `collapse`, `cta` | devices | see `prompts/07-scenes.md` |
| `image` | a painted still with Ken Burns and atmosphere | `visual`, `kb`, `fx`, `label`, `sub` |

The full parameter catalogue the planner sees is [prompts/07-scenes.md](../prompts/07-scenes.md). Cast presets,
map views, regions, places and icons are listed straight from the runtime.

## Workflow

```bash
python -m chronicle setup --anim                   # d3, topojson-client, world-atlas (Natural Earth 1:50m)
python -m chronicle plan    PROJECT --rules        # beats
python -m chronicle scenes  PROJECT                # LLM scene plan (or: --file scenes.json, hand-written)
python -m chronicle voice   PROJECT
python -m chronicle still   PROJECT --formats mid_16x9,short_9x16 --at 0.6   # contact sheet of every scene
python -m chronicle images  PROJECT                # only `image` beats, once per aspect in render.image_aspects
python -m chronicle render  PROJECT --formats mid_16x9,short_9x16
```

`brief.yaml`:

```yaml
render:
  engine: anim
  image_aspects: ["16:9", "9:16"]     # painted stills per aspect (beat_024.png, beat_024_9x16.png)
budget_usd: 2.0                        # hard cap for paid API calls (see chronicle/budget.py)
providers:
  images: {provider: openrouter, openrouter: {model: google/gemini-3.1-flash-image, reference: style_sheet.png}}
```

**Style consistency for painted stills.** Render a frame of your cast with the engine, save it as
`style_sheet.png`, and set it as the image provider's `reference`. Every prompt then includes it as a style sheet,
so the painted stills come back with the same pebble-head characters.

**Review painted stills for history.** Image models drift toward the modern look of famous places. In the
Byzantium demo they kept adding the Hagia Sophia's Ottoman minarets, a 19th-century calligraphy medallion, and the
modern Turkish flag to 1453. They also put horned helmets on crusaders. Put the period constraints in the `visual`
text ("as it looked in 537: no minarets"), check every still, and fix small details locally rather than paying
for another roll.

## Extending

- **A new template:** add `CH.T.mytemplate = (spec, env) => ({ static, draw, camera?, focus, drift })` in
  `scenes.js`, then add its name to `TEMPLATES` in `plan.py` and a row in `prompts/07-scenes.md`.
- **A new character:** add a preset to `CH.CAST` from existing parts. New hats or props go in `people.js`.
- **A new region:** add `R.my_region = [[[lon, lat], ...]]` in `maps.js`. Trace coasts generously over the sea; only
  inland borders need care, because the region is clipped to land.
- **Preview** with `chronicle still`. Runtime errors are printed with the beat id, and a broken scene falls back to
  a text card instead of crashing the render.
