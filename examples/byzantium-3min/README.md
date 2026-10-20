# Demo: The ENTIRE History of the Byzantine Empire in 3 Minutes

Animated mode end to end. Code draws 60 of the 65 scenes; 5 are painted stills. The whole video cost **$1.71 of
API spend** against a hard cap of $2.00, enforced by the system on every call.

| Output | |
|---|---|
| `out/byzantium-3min.mid_16x9.mp4` | 1920×1080, 30 fps, 3:04. Chapter flashes, date stamps, SFX, -14 LUFS |
| `out/byzantium-3min.short_9x16.mp4` | 1080×1920, 30 fps, 3:02. Native vertical layouts, word-pop captions, persistent header, progress bar, punch-ins |
| `out/*.srt`, `out/*.chapters.txt` | subtitles and YouTube chapters |

The videos aren't committed because of their size. Re-render them with the commands below.

## How it was made

| Step | Tool | Cost |
|---|---|---|
| Research, outline, script | Claude Opus 5.5 via OpenRouter (`providers.llm.provider: openrouter`, medium reasoning) | $0.83 |
| Fact-check and trim | by hand. Fixed the walls date (triple line finished 447, not 413), hedged legends, cut to 576 words for 3:04 | - |
| Beats | rules: 65 beats, one per sentence, long ones split at a clause | - |
| Scene plan | `scenes.json`, written by hand in the same JSON format `chronicle scenes` asks the LLM for (prompt: `prompts/07-scenes.md`) | - |
| Voice | Kokoro `am_adam` at 1.33× (188 WPM, the reference narrator's pace), Whisper word alignment | free |
| Painted stills | Gemini 3.1 Flash Image via OpenRouter, 5 scenes × 2 aspects, each sent with `style_sheet.png` (rendered by the engine) | $0.88 |
| Animation and render | `chronicle/anim`, 3 parallel Chromium workers | free |

Spend per call is in [`spend.json`](spend.json). Total: research $0.29, outline $0.19, script $0.35, 13 image calls
$0.88, and a $0.0002 smoke test.

### Fixing what the image model got wrong

The image model kept painting modern Istanbul into the Middle Ages. Five stills needed fixes.

| Problem | Fix | Cost |
|---|---|---|
| Hagia Sophia 9:16: 19th-century calligraphy medallions inside the church of 537 | regenerated with explicit period constraints in the `visual` text | $0.068 |
| 1204 sack 16:9: horned "Viking" helmets on the crusaders | regenerated with explicit constraints | $0.068 |
| Lone defender 16:9: Ottoman minarets on the Hagia Sophia before 1453 | regenerated with explicit constraints | $0.068 |
| 1204 sack 16:9 (second attempt): minarets crept back into the background | covered locally with smoke plumes (the city was burning) | free |
| Constantine XI's last stand: the modern Turkish flag | crescent and star painted out locally, leaving plain banners | free |

The final stills are archived in `images_in/` (JPEG), so a re-render costs nothing.

## Re-render without paying

```bash
pip install -e ".[all]" && python -m chronicle setup --fonts --kokoro --anim
python -m chronicle voice  examples/byzantium-3min                     # Kokoro, local
python -m chronicle images examples/byzantium-3min --provider folder   # the archived stills from images_in/
python -m chronicle still  examples/byzantium-3min --formats mid_16x9,short_9x16 --at 0.6   # optional review
python -m chronicle render examples/byzantium-3min --formats mid_16x9,short_9x16
```

## Files

| File | What it is |
|---|---|
| `brief.yaml` | topic, angle, producer notes, providers, `budget_usd: 2.0`, `render.engine: anim` |
| `research.md`, `outline.md` | LLM output, kept for reference (untouched) |
| `script.md` | the final, fact-checked narration with chapter date cards |
| `scenes.json` | the scene plan: one living illustration per beat |
| `beats.json` | beats with their scenes and composed image prompts |
| `style_sheet.png` | the engine's cast, sent to the image model as a style reference |
| `images_in/` | the 10 final painted stills (16:9 and 9:16) |
| `spend.json` | the cost ledger: every paid call, the account baseline, the cap |
| `llm/` | the raw script as the model wrote it, before fact-checking and trimming |
