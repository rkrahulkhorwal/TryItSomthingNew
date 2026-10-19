# Edit & motion

## 1. The edit in three rules (all automatic)

1. **One picture per beat.** A beat is a sentence, or a clause when a sentence is longer than `split_words`.
2. **Cut on the breath.** Each picture starts `picture_lead_s` before its line (0.19 s long-form, 0.12 s
   Shorts) but never before the previous line has finished. That puts the cut inside the pause, where the
   reference put 88 % of its cuts.
3. **The voice never waits for the picture.** Shot length is whatever the line takes. If a shot runs long, split
   the sentence (`|` in the script) or let punch cuts handle it.

Reference numbers to sanity-check a render (`out/render.<format>.json` → `stats`):

| Metric | Long-form target | Shorts target |
|---|---|---|
| median shot | 3.3-3.8 s | 2.0-2.6 s |
| max shot | ≤ 6.5 s | ≤ 4.2 s |
| min shot | ≥ 1.1 s | ≥ 0.9 s |
| WPM | 180-200 | 185-210 |

## 2. Motion modes

| Mode | Used by | What it does |
|---|---|---|
| `static` | `long_16x9` (faithful) | exactly the reference: stills and hard cuts. Fastest to render (identical frames are reused) |
| `subtle` | `long_16x9_enhanced`, `mid_16x9`, `deep_16x9` | 2-6 % push/pull or a slow pan per shot, eased, alternating direction so neighbouring shots differ |
| `dynamic` | Shorts presets | 5-14 % moves, faster pans, punch cuts |

Moves are chosen per shot type (see the table in [03-visual-system.md](03-visual-system.md)) and centred on the
beat's **focus point** (`focus_x`, `focus_y` from the beat plan). Override any beat with `[motion: push_in]` in the
script or `"motion"` in `beats.json`.

**Punch cuts** (`punch_cuts: true`): a shot longer than `shot.max_s` is split at the word boundary nearest its
middle. The second half shows the same picture punched in about 24 % toward the focus point, so the eye gets a new
frame without a new image.

**Wide-composition pans:** in a cropped vertical card, LINEUP, CROWD, ESTABLISHING, MAP, TIMELINE, SPLIT,
INFOGRAPHIC and CONFRONT shots pan across the full image instead of cropping it. In the demo's hook the camera
travels from the pyramid to Cleopatra and the astronaut in step with the line.

## 3. Transitions

- **Hard cut** everywhere (the reference: 198 of 199).
- **Chapter flash** on the first shot of each chapter: a 70 ms rise to warm white and a ~0.3 s decay, matching the
  one stylised transition in the reference. Set `transitions.chapter: dip` for a dip-to-black, or `cut` to disable.
- With SFX on, a whoosh starts 0.28 s before each chapter cut.

## 4. Cards and captions

| Element | When | Animation |
|---|---|---|
| Name / title / number card | beats with an overlay (`{NAME: …}` etc.) | pop-in with overshoot over 0.22 s (+ pop SFX) |
| Chapter date stamp | first shot of a chapter with `[card: …]` | slides in from the left, 0.18 s |
| Label | CALLOUT beats | pop-in, bottom centre |
| Word captions | vertical presets | groups of up to 3 words / 18 characters, never across sentences; the current word turns yellow; each group pops in |
| Header | vertical presets | big title for 3.2 s, then a small persistent title at the top |
| Progress bar | vertical presets | thin yellow bar at the top edge |

Safe zones: vertical captions sit at 75 % of the height and the bottom ~20 % stays clear for the platform UI.
Cards and stamps stay inside the card or frame margins.

## 5. Rendering

```bash
python -m chronicle render examples/egypt-60s --formats short_9x16_from_16x9,long_16x9_enhanced,long_16x9 --crf 22 --preset slow
```

- H.264 (yuv420p, `+faststart`) and AAC 192 kbps stereo, 30 fps (set `fps: 60` in a format if you want it).
- `--fast` gives quick proofs (veryfast, CRF 23). Final masters: CRF 18-22, preset `slow`.
- Output per format: `out/<slug>.<format>.mp4`, `.srt` subtitles, `.chapters.txt` (when the video qualifies for
  YouTube chapters: ≥ 3 chapters of ≥ 10 s), `timeline.<format>.json` (the full edit decision list) and
  `render.<format>.json` (stats).
- Speed on a 4-core CPU: about 70 s for a 60 s 1080×1920 Short with full motion; static long-form renders mostly
  reuse identical frames.
