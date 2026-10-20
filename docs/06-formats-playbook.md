# Formats playbook: short to long, horizontal to vertical

One topic can feed several outputs. Every preset lives in [`config/formats.yaml`](../config/formats.yaml) and
can be overridden per project (`format_overrides:` in `brief.yaml`).

## Presets

| Preset | Canvas | Length | Motion | Captions | Music/SFX | Use |
|---|---|---|---|---|---|---|
| `long_16x9` | 1920×1080 | 8-15 min | static | SRT only | none | faithful clone of the reference |
| `long_16x9_enhanced` | 1920×1080 | 8-15 min | subtle | SRT only | bed + accents | A/B test against the faithful cut |
| `mid_16x9` | 1920×1080 | 3-6 min | subtle | SRT only | bed + accents | explainers, topical videos |
| `deep_16x9` | 1920×1080 | 20-40 min | subtle | SRT only | none | deep dives, compilations |
| `short_9x16` | 1080×1920 | 30-60 s | dynamic + punch | burned-in | bed + accents | vertical-first, 9:16 images |
| `short_9x16_from_16x9` | 1080×1920 | 30-60 s | dynamic + punch | burned-in | bed + accents | vertical render of 16:9 art (card layout) |
| `square_1x1` | 1080×1080 | 30-90 s | dynamic | burned-in | bed + accents | feed posts |
| `portrait_4x5` | 1080×1350 | 30-90 s | dynamic | burned-in | bed + accents | Instagram / Facebook feed |
| `preview_16x9` | 960×540 @ 24 | any | static | — | — | fast proof renders |

## Three production workflows

### A. Long-form master + Shorts spin-offs (recommended)
1. `chronicle new rome-12m --format long_16x9 --duration 720` → research → outline → write → plan → voice → images (16:9).
2. Render `long_16x9` **and** `long_16x9_enhanced`; upload one, and test the other later with YouTube's thumbnail/title testing on similar videos.
3. Use the packaging prompt's "Shorts spin-offs" section. Make each spin-off a **new project** with a 150-190-word
   script (a Short has its own hook and loop), and reuse existing 16:9 images through the `folder` provider
   (`images_in/beat_###.png`), rendering with `short_9x16_from_16x9`. Generate new art only where a beat needs it.
4. Publish the Shorts over the following week, each pinning a comment that links the long video.

### B. Shorts-first channel
`chronicle new <slug> --format short_9x16 --duration 55`. The images are generated natively at 9:16 and fill
the frame. Budget: ~18-25 images per Short; batch 5-10 Shorts per session for consistent characters.

### C. Series and marathons
Make each episode a long-form project with the same style and character sheet (copy `characters:` into each
`brief.yaml`). A 1-2 h "marathon" is the episodes concatenated with ffmpeg (`-f concat`), which needs no re-rendering.

## Adapting the format to the length

| Knob | Short | Mid | Long | Deep |
|---|---|---|---|---|
| `duration_s` | 30-60 | 180-360 | 480-900 | 1200-2400 |
| `wpm` | 200 | 195 | 190 | 180 |
| `hook_share` | 0.05 (1 line) | 0.07 | 0.05 | 0.035 |
| `split_words` | 10 (16 to save images) | 15 | 17 | 17 |
| `shot.target_s` | 2.4 | 3.2 | 3.6 | 4.0 |
| `chapters` | 3 acts | 3-6 | 6-10 | 10-20 |
| ending | loop | CTA | legacy + CTA | legacy + CTA |

## Cost per video (rough)

| | 60 s Short | 12 min long-form |
|---|---|---|
| Script (Claude, high effort) | a few cents | well under $1 |
| Voice | free (Kokoro) / ~$0.10-0.30 (ElevenLabs) | free / ~$2-5 |
| Images | ~20 × model price | ~200 × model price |
| Render | free (local CPU) | free (local CPU) |

Generate a free placeholder animatic first (`chronicle images --provider placeholder`, then `render --fast`) to
check timing and shot mix before paying for images.
