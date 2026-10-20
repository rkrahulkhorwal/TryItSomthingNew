# Visual system

The reference proves that **static cartoon illustrations** hold attention when each picture shows exactly what is being
said and the picture *types* keep rotating. This document is the art bible: the house style, the 20 shot types and
how often to use them, text rules, and how to keep characters consistent.

## 1. House style: `ink_cartoon` (original design)

Defined in [`config/styles/ink_cartoon.yaml`](../config/styles/ink_cartoon.yaml). It is the same *genre* as the
reference (hand-inked cartoon, rich worlds, very simple people) with an **original character design**, so a channel
built on it has its own identity rather than being a lookalike.

| Element | Spec |
|---|---|
| Line | bold, even black ink outlines; flat cel colour; faint paper grain |
| Palette | parchment & earth (sand `#e2d0a7`, olive `#857858`, umber `#655746`) + accents: brick red `#b5452f`, ochre gold `#deac50`, sky blue `#78c3e7`; ink `#1a1512` |
| Worlds | richly detailed architecture and landscapes, so the eye has something to explore while the line plays |
| People: "pebble-heads" | large egg-shaped cream head, bead eyes, **thick eyebrows that carry all the emotion**, tiny line mouth, rosy cheek dots, no nose or ears; crowns and hair sit on top of the egg; thin limbs, mitten hands, simple period costume |
| Comedy | in expressions and props: sweat drops, X-eyes for the defeated, giant blueprints, cobwebs. Never gore |
| Composition | one obvious focal subject, readable at phone size; space for cards when a beat has one |

Alternates: `storybook_gouache` (softer, painterly, for calm or mythological topics) and `flat_vector`
(modern subjects: tech, business, science). Make your own by copying a YAML file; `extends:` inherits everything
you don't override.

## 2. The 20 shot types

Measured share in the reference (200 shots), what each is for, and how the engine treats it.

| Family | Type | Share | Use it for | Card | Motion (when enabled) |
|---|---|---|---|---|---|
| **Literal** | SCENE | 38 % | the sentence acted out (default) | — | push / pan, alternating |
| | ESTABLISHING | 6 % | new place or era | — | pan across |
| | CROWD | 5.5 % | armies, mobs, fleets | — | pan across |
| | LINEUP | 2.5 % | a row of rulers, the cast | — | pan across |
| | CONFRONT | 2 % | rivals face off | — | pan across |
| | LANDMARK | 1 % | an iconic building | — | pull out / tilt |
| | REACTION | 0.5 % | exaggerated close-up face | — | push in |
| **Text & orientation** | MAP | 5 % | territory, routes, losses | — | push in / pan |
| | TIMELINE | 4 % | date anchor | date | pan right |
| | TITLE | 5 % | era / event / concept name | title | push in |
| | NUMBER | 1.5 % | first big figure | number | pull out |
| | CHARACTER_INTRO | 3 % | first appearance of a key figure | name | push in |
| | CALLOUT | 1.5 % | naming an object or group | label | push in |
| | CTA | 0.5 % | the subscribe line | title | static |
| **Concept & explainer** | METAPHOR | 10.5 % | a figure of speech drawn literally | — | push / pull |
| | INFOGRAPHIC | 5 % | mechanisms, comparisons, cause and effect | — | pan across |
| | SPLIT | 4 % | contrasts: rich/poor, west/east, before/after | — | static / pan across |
| | BUBBLE | 2 % | what characters fear or think | — | push in |
| | MODERN | 1.5 % | present-day legacy shots | — | pan |
| | SYMBOL | 1 % | one symbolic object (a question mark, a lone figure) | — | push in |

**Placement rules**
1. Never more than 3 plain SCENEs in a row. Aim for 60 % literal and 40 % devices.
2. A date anchor opens every chapter (a TIMELINE shot or the engine's corner stamp from `[card: …]`).
3. A CHARACTER_INTRO the first time each major figure appears, and a NUMBER card the first time a striking figure is said.
4. Every metaphor in the script gets a METAPHOR shot, and every "rich vs poor" style contrast gets a SPLIT.
5. The legacy section switches family: MODERN, INFOGRAPHIC and METAPHOR shots dominate.

## 3. Text on screen

**Default: the engine draws all text** (`overlays: true`). Image prompts end with "no lettering", and the engine
adds cards with consistent fonts:

| Card | Look | Position |
|---|---|---|
| name | yellow cartoon lettering, thick ink outline, pops in | top centre |
| title | cream lettering, ink outline | top centre |
| number | tall condensed numerals | top centre |
| date / chapter stamp | serif text on a parchment plate with a red marker | bottom-left (lower third) |
| label | bold sans on a cream plate | bottom centre |

Why: image models still misspell, the text can't be edited after generation, and engine text stays identical
across 200 shots and in every language. If you prefer baked-in lettering (GPT-image and Gemini render short words
well), set `overlays: false` in the format and add the words to `visual`.

Fonts (all open-licensed, downloaded by `python -m chronicle setup --fonts`): Luckiest Guy, Anton, Cinzel,
Montserrat.

## 4. Consistency workflow

1. **Character sheet:** the beat planner lists every recurring person once with a fixed look (costume colour +
   one signature prop), e.g. `cleopatra: short black bob, thin gold cobra band, white dress with a royal-blue sash`.
   The composer pastes that description into every prompt where the key appears.
2. **Same style block, word for word** in every prompt (the composer does this).
3. **Review a contact sheet** before rendering (`images/` folder). Regenerate the outliers only:
   `python -m chronicle images <project> --only 7,12 --force`.
4. **Reference images** (optional): providers that accept image references (GPT-image edits, Gemini, Flux
   Kontext/Redux) can take a hero image of each recurring character for even tighter identity.
5. **Borders:** models sometimes draw a frame despite the prompt. The pipeline detects thin drawn frames and trims
   them automatically.

## 5. Aspect-ratio strategy

| You are making | Generate images at | Render |
|---|---|---|
| Long-form first, shorts later | 16:9 | `long_16x9` + `short_9x16_from_16x9` (a 6:5 window over a blurred copy; wide shots pan across) |
| Shorts-first channel | 9:16 | `short_9x16` (full-bleed) |
| Feed posts | 1:1 or 4:5 | `square_1x1` / `portrait_4x5` |

The image aspect is set by the project's format (`image_aspect`) and passed to the image model. The renderer's
`auto` layout fills the frame when aspects match and uses the card layout when they don't.

## 6. Image model notes

| Model family | Strengths | Watch out for |
|---|---|---|
| Gemini image ("nano banana" family) | follows long prompts, cheap, good style adherence | drifts to realistic faces in crowds: keep the "every person is a pebble-head" sentence |
| GPT-image | best text rendering and instruction following | slower and more expensive; strong default "storybook" look unless the style block is explicit |
| Flux (Replicate / fal) | crisp line art, fast | weaker at complex multi-character comedy |
| Midjourney (manual via `folder`) | most beautiful worlds | consistency across 200 images needs `--sref` / `--cref`; export prompts from `image_prompts.csv` |

Cost guide: about 200 images for a 12-minute video, about 20 for a 60-second short. Generate the animatic first
(`--provider placeholder`, free) to lock timing and shot mix before paying for images.
