# Demo: *The ENTIRE History of Ancient Egypt in 60 Seconds*

An original 60-second video produced end to end with the Chronicle pipeline, to prove the system on a new topic.

| Stage | How it was done | File |
|---|---|---|
| Brief | `chronicle new egypt-60s --format short_9x16_from_16x9 --duration 60 ...` | `brief.yaml` |
| Script | written to the rules in `prompts/03-script.md`: startling-fact hook, a date at every chapter, one "But…" turn, name and number cards, a loop-back last line. 184 words, median sentence 12 words | `script.md` |
| Beat plan | rules split the script into 18 beats; art direction via the **manual LLM** workflow (prompt → answer file) | `llm/beats_1.prompt.md`, `llm/beats_1.response.json`, `beats.json` |
| Image prompts | composed automatically: house style + shot template + character sheet + card space + aspect | `beats.json` → `image_prompt` |
| Illustrations | 18 images from Gemini image models (via Figma), imported with the `folder` provider; drawn borders auto-trimmed | `images_in/` |
| Voice | `chronicle cast` picked Kokoro `am_adam` (closest to the reference narrator's pitch and expressiveness, 0 % word errors) at speed 1.2 | `audio/clips.json` |
| Render | three formats from the same beats | `out/` |

## Results (measured on the renders)

| | Vertical Short | Horizontal (enhanced) | Horizontal (faithful) |
|---|---|---|---|
| Canvas | 1080×1920 | 1920×1080 | 1920×1080 |
| Duration | 58.0 s | 60.5 s | 60.5 s |
| Shots | 24 (18 images + punch cuts), median 2.3 s | 18, median 3.3 s | 18, median 3.3 s |
| Motion | dynamic + pans across wide shots | subtle | none (like the reference) |
| Captions / header | word pop / persistent title | — | — |
| Loudness | -14.2 LUFS, -1.3 dBTP | -14.2 LUFS, -1.0 dBTP | -14.2 LUFS, -1.0 dBTP |

Narration accuracy (independent Whisper `small.en` transcription of the final Short vs the script): **4.4 % WER**.
Caption timing vs the heard speech: median **-60 ms** (captions slightly early, as intended), p90 |offset| 130 ms.

## Reproduce

```bash
python -m chronicle setup --fonts --kokoro
python -m chronicle images examples/egypt-60s --provider folder --force   # re-imports images_in/ (and trims borders)
python -m chronicle voice  examples/egypt-60s                             # re-synthesises the clips (free, local)
python -m chronicle render examples/egypt-60s --formats short_9x16_from_16x9,long_16x9_enhanced,long_16x9 --crf 22 --preset slow
```

Facts used: unification under Narmer around 3100 BC; Great Pyramid around 2560 BC with ~2.3 million blocks; the
workers' villages that point to paid labour; the chariots of the Hyksos era and the New Kingdom empire from
about 1550 BC; Ramesses II's ~66-year reign; Libyan, Nubian, Persian and Macedonian-Greek dynasties; Cleopatra
VII's death in 30 BC; the last hieroglyphic inscription in 394 AD; decipherment via the Rosetta Stone in 1822.
