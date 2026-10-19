# Retention QA checklist

Run this before publishing. Items marked ⚙ are reported automatically (`out/render.<format>.json`, the CLI log,
or `python -m chronicle review` for the LLM script review).

## Script
- [ ] Word count within ±5 % of `duration × WPM` ⚙ (`chronicle write` prints it)
- [ ] First sentence = humble-vs-huge contrast or a startling true fact; no "In this video…"
- [ ] Title drop, emotional menu and paradox question by 5 % of runtime (long-form)
- [ ] Every chapter after the hook opens with a date or place; every chapter ends on a bridge line
- [ ] A "But…" turn at least every ~40 s; a problem → fix → new problem rhythm
- [ ] Every antagonist / turning-point figure gets a punchy introduction
- [ ] At least one drawable metaphor per chapter
- [ ] 2-3 concrete numbers per minute; legends hedged; numbers and dates checked against two sources
- [ ] Twist at 70-80 %; legacy section with 4-6 concrete legacies; callback to the hook's wording
- [ ] CTA only in the final 2-3 % (long-form) / last line loops to the first (Shorts)
- [ ] Median sentence ≈ 12 words, nothing over ~24 words without a comma split ⚙ (`script_stats`)

## Pictures
- [ ] One picture per beat; no beat without an image ⚙ (`chronicle status`)
- [ ] Contact sheet reviewed: style consistent, recurring characters recognisable, no realistic faces, no stray text or borders (borders are auto-trimmed ⚙)
- [ ] Device mix: ≤ 3 plain SCENEs in a row, ~40 % device shots ⚙ (`chronicle plan` prints the mix)
- [ ] Name / number / date cards spelled correctly
- [ ] Focus points sensible on wide images (vertical crops show the subject)

## Edit
- [ ] Median shot length in range (long 3.3-3.8 s / Shorts 2.0-2.6 s), max ≤ 6.5 s / 4.2 s ⚙
- [ ] Cuts land before each line, never mid-word (lead 0.12-0.2 s) ⚙
- [ ] Captions in sync (spot-check 3 places; median offset should be within ±100 ms)
- [ ] Chapter flash/whoosh only at chapter starts

## Audio
- [ ] Integrated loudness -14 LUFS ±1, true peak ≤ -1 dBTP ⚙ (`ffmpeg -i out.mp4 -af ebur128=peak=true -f null -`)
- [ ] Voice intelligible end to end: names pronounced acceptably (fix phonetically if needed)
- [ ] Music (if any) never competes with the voice; no clicks at clip joins

## Packaging
- [ ] Title true to the runtime; thumbnail readable at small size; description + chapters + tags + pinned comment
- [ ] Subtitles uploaded (`.srt`)

## After publishing (what to watch in YouTube Studio)
| Signal | Healthy | If not |
|---|---|---|
| 30-second retention | ≥ 70 % (long-form) | rewrite the hook: stronger contrast, faster paradox question |
| Average view duration | ≥ 40-50 % of runtime | find the drop-off chapter and add a bridge line / "But…" before it |
| Dip at a chapter seam | shallow | the previous chapter ended on a summary instead of a bridge |
| Bump near the end | present | the twist works; keep the structure |
| Shorts swipe-away rate | low in the first 2 s | new first line, first picture must be the most surprising one |
