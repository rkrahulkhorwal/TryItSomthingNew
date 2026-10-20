# Chronicle: a reusable system for "ENTIRE history of X" explainer videos

A frame-by-frame teardown of a high-performing YouTube video, ["The ENTIRE History of ROME in 12 Minutes"](https://youtu.be/kHCamT4zfH4)
(262k views on a 21.5k-subscriber channel, 12× views per subscriber). It is turned into a **playbook** and a
**working pipeline** that makes videos of this kind in any length (30 s to 40 min) and any aspect ratio
(16:9, 9:16, 1:1, 4:5).

```
topic ─► research ─► outline ─► script ─► beat plan ─► voice ─► illustrations ─► edit + render ─► packaging
           (LLM)       (LLM)     (LLM)    (rules+LLM)   (TTS)    (image model)    (this engine)      (LLM)
                                              └──► scene plan ─► hand-inked animation engine (code, no image model)
```

Two ways to make the pictures:

- **Stills mode**: one AI illustration per sentence, cut on the breath (the reference video's method).
- **Animated mode** (`render: {engine: anim}`): every sentence becomes a *living illustration* drawn in code.
  Pebble-head characters blink, gesture and talk. Maps fill and arrows travel. Numbers count up, cities burn,
  walls crumble, and the camera drifts. Everything has a wobbling ink line on paper. A handful of AI stills are
  kept for scenes code can't draw well. See [docs/09-animation-engine.md](docs/09-animation-engine.md).

## What the analysis found

| | Measured in the reference | What the system does |
|---|---|---|
| Pictures | 200 AI cartoon stills, **one per sentence**, median 3.58 s | one beat per sentence, long ones split at a clause |
| Motion | **none**: every shot is static, 198 hard cuts | `static` (faithful) or `subtle`/`dynamic` (enhanced) |
| Cut timing | 88 % of cuts inside a pause, picture leads the next word by **0.19 s** | same rule, per format |
| Narration | male baritone, 117 Hz, expressive (4.1 st SD), **193 WPM**, grade-7 words | voice casting to that profile, WPM targets |
| Script | 5 % hook → 8 acts → 13 % payoff; bridge lines; twist at 76 % | prompt library that writes to this shape |
| Shot mix | 38 % literal scenes, 62 % "devices" (maps, date/name/number cards, splits, metaphors…) | 20 shot types, planner + image prompts |
| Audio | voice only, -17.7 LUFS | -14 LUFS master, optional ducked bed + SFX |

Read the full teardown in **[docs/00-teardown-report.md](docs/00-teardown-report.md)**.

## Demos (made end to end with this system)

### The ENTIRE History of the Byzantine Empire in 3 Minutes (animated mode, $1.71 of API spend)

[`examples/byzantium-3min`](examples/byzantium-3min) is the hybrid workflow:

- **Writing:** research, outline and script by Claude Opus 5.5 through OpenRouter, then fact-checked and trimmed by hand.
- **Pictures:** 65 scenes drawn in code. Five are painted stills from Gemini 3.1 Flash Image, made in both 16:9 and 9:16,
  each sent with a style sheet rendered by the engine so the paintings match the code-drawn cast.
- **Voice and budget:** Kokoro reads at 188 WPM, and a $2 hard budget cap is enforced on every call.

| Output | Length |
|---|---|
| `out/byzantium-3min.mid_16x9.mp4`: 1920×1080, chapter flashes and date stamps | 3:04 |
| `out/byzantium-3min.short_9x16.mp4`: 1080×1920, native vertical layouts, word captions, header, progress bar, punch-ins | 3:02 |

### The ENTIRE History of Ancient Egypt in 60 Seconds (stills mode)

[`examples/egypt-60s`](examples/egypt-60s) is an original 60-second script, *The ENTIRE History of Ancient Egypt in
60 Seconds*: 18 AI illustrations in the original house style, a free local voice cast to match the reference
narrator, rendered three ways:

| Output | File |
|---|---|
| Vertical Short (card layout, word captions, header, motion, punch cuts, SFX) | `out/egypt-60s.short_9x16_from_16x9.mp4` |
| Horizontal, enhanced (subtle motion, SFX) | `out/egypt-60s.long_16x9_enhanced.mp4` |
| Horizontal, faithful to the reference (static stills, hard cuts) | `out/egypt-60s.long_16x9.mp4` |

Verified on the renders: -14.2 LUFS / ≤ -1.0 dBTP; narration matches the script (4 % word error rate from an
independent Whisper transcription); captions within a median 60 ms of the speech; 188 WPM.

## What's in the repo

| Path | What it is |
|---|---|
| [`docs/00-teardown-report.md`](docs/00-teardown-report.md) | the measured breakdown (structure, hook, script, shots, edit, audio, retention model) |
| [`docs/01-format-dna.md`](docs/01-format-dna.md) | the spec: 12 laws with numbers, what to copy and what to improve, a cheat sheet per format |
| [`docs/02-script-system.md`](docs/02-script-system.md) | word budgets, act structure for every length, hook formula, device library, script file format |
| [`docs/03-visual-system.md`](docs/03-visual-system.md) | house style, 20 shot types and their ratios, text rules, consistency workflow |
| [`docs/04-voice-and-audio.md`](docs/04-voice-and-audio.md) | narrator profile, data-driven casting, provider settings, mix and loudness |
| [`docs/05-edit-and-motion.md`](docs/05-edit-and-motion.md) | cut rules, motion modes, punch cuts, transitions, cards, captions, rendering |
| [`docs/06-formats-playbook.md`](docs/06-formats-playbook.md) | all presets, three production workflows, cost per video |
| [`docs/07-packaging.md`](docs/07-packaging.md) | titles, thumbnail system, description template, upload checklist |
| [`docs/08-qa-checklist.md`](docs/08-qa-checklist.md) | pre-publish retention QA and what to watch after publishing |
| [`prompts/`](prompts) | LLM prompt library: research, outline, script, beat plan + image prompts, packaging, retention review |
| [`chronicle/`](chronicle) | the pipeline (Python) |
| [`config/`](config) | format presets, visual styles, provider defaults |
| [`analysis/`](analysis) | derived data from the teardown + the chart script |
| [`docs/09-animation-engine.md`](docs/09-animation-engine.md) | the animated mode: architecture, scene templates, cast, maps, adding your own |
| [`chronicle/anim/`](chronicle/anim) | the animation engine: SVG runtime (JS) + parallel headless-Chromium renderer |
| [`examples/egypt-60s/`](examples/egypt-60s) | stills-mode demo, every intermediate file included |
| [`examples/byzantium-3min/`](examples/byzantium-3min) | animated-mode demo: script, scene plan, paid stills, spend ledger |

## Quick start

```bash
pip install -e ".[all]"                       # Python 3.10+, ffmpeg on PATH
python -m chronicle setup --fonts --kokoro    # open-licensed fonts + free local voice model (~350 MB)

# 1. create a project (any preset: python -m chronicle formats)
python -m chronicle new mongols --topic "The Mongol Empire" --format long_16x9 --duration 720

# 2a. with an Anthropic API key (ANTHROPIC_API_KEY): research, outline, script, beat plan, all written for you
python -m chronicle run projects/mongols --start research --formats long_16x9,short_9x16_from_16x9

# 2b. without any API key: providers.llm.provider = manual in brief.yaml. Each LLM stage writes a prompt file;
#     paste it into any chat model and save the answer next to it, then re-run the same command.
```

Step by step (each stage writes plain files you can edit before the next):

```bash
python -m chronicle research projects/mongols   # research.md   - fact sheet with (verify) flags
python -m chronicle outline  projects/mongols   # outline.md    - act plan, bridge lines, twist placement
python -m chronicle write    projects/mongols   # script.md     - narration with chapter/date/name/number tags
python -m chronicle review   projects/mongols   # review.md     - optional retention critique
python -m chronicle plan     projects/mongols   # beats.json    - one picture per beat + full image prompts
python -m chronicle voice    projects/mongols   # audio/        - one clip per beat (cached)
python -m chronicle images   projects/mongols --provider placeholder   # free animatic first...
python -m chronicle render   projects/mongols --fast                   # ...check timing and the shot mix
python -m chronicle images   projects/mongols --provider openai --force   # ...then real art (or gemini / replicate / folder)
python -m chronicle render   projects/mongols --formats long_16x9,short_9x16_from_16x9
python -m chronicle package  projects/mongols   # titles, thumbnail prompts, description, chapters, shorts ideas
```

Animated mode (set `render: {engine: anim}` in brief.yaml; `pip install -e ".[anim]"` and
`python -m chronicle setup --anim` for d3, topojson and Natural Earth coastlines):

```bash
python -m chronicle plan   projects/mongols --rules          # segment the script into beats
python -m chronicle scenes projects/mongols                  # LLM picks a template + parameters per beat
python -m chronicle voice  projects/mongols
python -m chronicle still  projects/mongols --formats mid_16x9,short_9x16 --at 0.6   # review stills of every scene
python -m chronicle images projects/mongols                  # only the beats planned as painted stills, per aspect
python -m chronicle render projects/mongols --formats mid_16x9,short_9x16 --workers 3
```

Other tools:

```bash
python -m chronicle analyze reference.mp4 --audio reference.mp3 --out analysis/my_ref   # tear down any other video
python -m chronicle cast                                                                # rank voices vs a narrator profile
python -m chronicle status projects/mongols
```

## Providers (plug in what you have)

| Stage | Built in | Needs |
|---|---|---|
| Writing | Claude via the official SDK (model and effort in `config/defaults.yaml`; server-side refusal fallback), **OpenRouter** (any model, per-stage models) or **manual** copy/paste | `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY` or nothing |
| Voice | **Kokoro** (local, free), ElevenLabs (word timestamps), OpenAI TTS, Edge TTS, silent | none / API key |
| Word timings | provider timestamps → faster-whisper forced alignment → proportional | none |
| Images | **placeholder** animatic, **folder** (Midjourney / artist / any tool), OpenAI, Gemini, Replicate, **OpenRouter** (with a style-sheet reference image) | none / API key |
| Animation | the built-in SVG engine in headless Chromium (Playwright) | none |
| Budget | `budget_usd` in brief.yaml: every paid call is priced worst-case first, refused if it could break the cap, logged to `spend.json` and checked against the account's real usage | none |
| Music | any licensed tracks in `assets/music/` (ducked automatically) | your library |
| SFX | procedurally synthesised whoosh / pop | none |

## Notes and limits

- **Tested here:**
  - The offline path end to end: placeholder images, silent and Kokoro voices, Whisper alignment, all render formats,
    and the animated engine in both aspects, with 19 automated tests.
  - The OpenRouter writing and image providers, with real paid calls.
  - The Egypt demo's illustrations, generated with Gemini image models through Figma and imported with the `folder`
    provider.
- **Not tested:** the Claude SDK, ElevenLabs, OpenAI, Gemini and Replicate adapters. They follow each provider's
  documented interface but couldn't be called without keys. Run a single beat first (`images --only 1`, or `voice` on
  a short project) when you add a key.
- The reference video, its narration and its frames are **not** included. Only measurements and short descriptive
  quotes are, for analysis. The house style uses an original character design.
- AI images drift: review the contact sheet and regenerate outliers (`--only 7,12 --force`).
