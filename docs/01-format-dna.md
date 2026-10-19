# Format DNA: the spec

The measured rules of the reference video ([00-teardown-report.md](00-teardown-report.md)) written as a
production spec. Every number has a source in `analysis/data/metrics.json`. The engine's presets in
`config/formats.yaml` implement them, so you can follow them by hand or let the pipeline do it.

## The 12 laws

| # | Law | Target (long-form) | Target (Shorts) | Engine key |
|---|---|---|---|---|
| 1 | **Promise completeness in a fixed time**: "The ENTIRE history of X in N minutes" | title + chapters | title on the header | `brief.title`, `header` |
| 2 | **One sentence → one picture** | median shot 3.6 s (p10 2.3, p90 5.1) | median shot 2.2-2.6 s | `shot.target_s` |
| 3 | **Split long sentences at a clause**, not mid-phrase | split above ~17 words | split above ~10 words | `split_words` |
| 4 | **Cut on the breath**: the picture lands in the pause, just before the next line | lead 0.19 s | lead 0.12 s | `picture_lead_s` |
| 5 | **Keep the voice running**: short pauses, no dead air | pauses 0.28 / 0.14 / 0.45 s (sentence / clause / chapter) | 0.18 / 0.08 / 0.25 s | `pauses_s` |
| 6 | **Talk fast and plain** | 185-200 WPM, grade-7 words, median sentence 12 words | 195-210 WPM | `wpm` |
| 7 | **Show exactly what is said**, and draw every metaphor literally | 38 % literal scenes, 62 % device shots | same mix | `prompts/04-beats.md` |
| 8 | **Rotate devices**: name, number and date cards, maps, splits, bubbles, infographics | a device every ~2.6 shots | a device every ~2 shots | shot types |
| 9 | **Anchor time**: a date at every chapter start | date card or stamp | date stamp | `[card: ...]` in the script |
| 10 | **Never let a chapter end**: a bridge line pulls into the next one | 100 % of chapters | n/a (3 acts) | `prompts/03-script.md` |
| 11 | **Re-hook at 70-80 %** with a twist that re-opens the story | one twist | the last line loops to the first | script |
| 12 | **Pay off with meaning, then ask**: legacy → contradiction → one-idea thesis → callback → CTA | CTA in the last 2-3 % | no CTA, loop | script |

## What to copy exactly, and what to improve

| Keep exactly (the retention engine) | Improve (cheap wins the reference left on the table) |
|---|---|
| One illustration per sentence, cut on the breath | Master to **-14 LUFS / -1 dBTP** (the reference sits at -17.7 LUFS) |
| Grade-7 language, fast delivery, "But…" turns every ~40 s | **Subtle motion** on stills (A/B test `long_16x9_enhanced` against `long_16x9`) |
| Date anchors, name cards, number cards, maps, splits | A **low music bed + whoosh/pop accents** (test it; the reference had none) |
| Drawable metaphors, comic expressions | **Character sheets** so recurring people stay consistent |
| Twist at ~76 %, legacy payoff, callback ending | **Captions + a header + 2× faster cuts** for vertical |
| CTA only at the very end | **Chapter markers placed on bridge lines** |

## Cheat sheet by format

| | Short 30-60 s (9:16) | Mid 3-6 min (16:9) | Long 8-15 min (16:9) | Deep 20-40 min (16:9) |
|---|---|---|---|---|
| Preset | `short_9x16` / `short_9x16_from_16x9` | `mid_16x9` | `long_16x9` (faithful) or `long_16x9_enhanced` | `deep_16x9` |
| Words | 95-200 | 600-1,200 | 1,500-2,900 | 3,600-7,200 |
| Hook | 1 line (≤ 3 s) + header | 15-20 s | 30-40 s | 45-70 s |
| Chapters | 3 acts, no markers | 3-6 | 6-10 | 10-20 |
| Pictures | 15-30 | 60-110 | 130-250 | 300-600 |
| Median shot | 2.2-2.6 s (+ punch cuts) | 3.2 s | 3.6 s | 4.0 s |
| Motion | dynamic | subtle | static (faithful) / subtle | subtle |
| Captions | burned-in word pop | optional SRT | SRT | SRT |
| Music / SFX | bed + accents | bed + accents | none (faithful) / test | low bed |
| Ending | last line loops to the first | CTA + next video | legacy + CTA | legacy + CTA + next video |

## The one-paragraph version

Pick a big subject and promise all of it in a set number of minutes. Write it as a chain of problems, fixes and
reversals in short, plain sentences, about 190 words a minute. Give every sentence its own cartoon illustration
that shows exactly what is said. Rotate in maps, date cards, name cards, numbers, split screens and literal
metaphors so the eye never settles. Cut each picture in during the breath just before its line. Never let a
chapter end on a full stop: end on a pull into the next one. Hide a twist at three-quarters, then close on
why it still matters, call back to the opening line, and only then ask for the subscribe.
