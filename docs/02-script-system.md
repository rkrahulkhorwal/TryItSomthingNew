# Script system

The script carries the retention. The pictures only follow it. This system turns any subject into a narration
that keeps people watching. The LLM prompts in [`prompts/`](../prompts) encode every rule here, so you can write by
hand or run `python -m chronicle write <project>`.

## 1. Word budget

`words = minutes × WPM`. With the reference's 193 WPM:

| Runtime | Words | Sentences (≈12 words) | Pictures |
|---|---|---|---|
| 45 s | 140 | 12 | 14-20 |
| 60 s | 185 | 15-16 | 18-26 |
| 3 min | 570 | 45 | 50-55 |
| 8 min | 1,520 | 125 | 135 |
| 12 min | 2,300 | 175-190 | 200 |
| 20 min | 3,700 | 300 | 320 |
| 30 min | 5,400 | 440 | 460 |

Going over the length is the most common failure: cut, don't speed up. `chronicle write` prints the word count and
the estimated duration of every script.

## 2. Architecture

### Long-form (8-15 min): the reference's shape

| Block | Share | What happens | Exit line (bridge) |
|---|---|---|---|
| **Hook** | 5 % | contrast → 3 proofs → title drop → emotional menu → paradox question | the question itself |
| **Origin** | 8 % | "Our story starts in [year]…", world context, founding event (hedged if legend), first flaw | the flaw's consequence |
| **Formation** | 10 % | the idea or institution that made them different, defined in one plain sentence | "…this turned them into a [machine]." |
| **Rise** | 16 % | escalating rivals, clever moves, **the great rival ("boss fight")** with numbers, total victory | "But this success was a curse." |
| **Crisis within** | 11 % | success rots; the "final boss" figure; the turning-point act; an irony | the act's consequence |
| **Golden age** | 9 % | achievements with numbers; "If you lived here then…" | a metaphor that foreshadows decline |
| **Decline** | 8 % | problems with stats; a radical fix | "Then came [next figure]…" |
| **Fall** | 11 % | outside pressure; shock event; the official end, ideally ironic | "But here's the twist…" |
| **Twist / afterlife** | 10 % | the story continues past the expected end | "So why does any of this matter today?" |
| **Legacy + CTA** | 13 % | 4-6 concrete legacies → contradictions → one-idea thesis → callback → CTA | (end) |

The blocks are roles, not fixed chapters. Here is how they map onto other subjects:

| Subject | Origin | Rise | Boss fight | Crisis within | Golden age | Fall | Twist / afterlife |
|---|---|---|---|---|---|---|---|
| Person | childhood | first break | the rival | the scandal | the peak | the downfall | the legend after death |
| Company | the garage | product-market fit | the incumbent | the bloat | market dominance | disruption | the brand lives on |
| Invention | the accident | first adopters | the competing standard | the safety scare | everywhere | replaced | it's inside today's tech |
| War | the spark | early victories | the decisive battle | the home front | the turning point | the surrender | the borders we still have |
| City | the river crossing | trade | the siege | the plague | the boom | decline | the comeback |

### Mid-form (3-6 min)
Hook (15-20 s) → 3-5 chapters (origin, rise, crisis, fall/turn) → twist → 2-3 legacies → callback → short CTA.

### Short (30-60 s)
1. **Line 1 (≤ 3 s):** the most surprising true fact or the paradox. No "In this video".
2. **Three acts** of 3-5 sentences each, every act opening with a date or place.
3. **One "But…"** turn in the middle act.
4. **Last line loops into the first**: the final sentence should make the opening line feel like the next sentence.
   The demo ends "…how old Egypt really is." which flows straight back into its first line about Cleopatra.
5. No CTA. The loop is the CTA.

### Deep / marathon (20-60 min)
Chain 2-4 long-form arcs ("parts") under one umbrella promise. Each part gets its own mini-hook and paradox
question, and the twist at 75 % is mandatory in each part. Lower WPM slightly (175-185) and allow 4-5 s shots.

## 3. The hook formula (first 5 %)

```
1. Imagine / startling fact      Humble start (or a mind-bending comparison)
2. Contrast                      …that ended up as [huge end state]
3. Three proofs it matters now   things the viewer touches today, one per sentence, one picture each
4. Title drop                    "This is [X]."  (2-4 words, gets a TITLE card)
5. Emotional menu                "Its story is a [metaphor] of A, B, C and D."  (drawn literally)
6. Paradox question              "But how did [underdog] become [giant] / survive [N] years?"
```

Five interchangeable openers (original examples):

| Opener | Example |
|---|---|
| Imagine | "Imagine a band of horse herders with no cities, no farms and no writing…" |
| Mind-bending comparison | "Cleopatra lived closer to the Moon landing than to the building of the Great Pyramid." |
| Number shock | "One man's army conquered more land in 25 years than Rome did in 400." |
| Myth-buster | "Vikings never wore horned helmets. The truth is stranger." |
| Present-day hook | "Every time you say 'Thursday', you're naming a Norse god." |

## 4. Sentence rules

- One idea per sentence, because one sentence is one picture. Median 12 words, range 5-22.
- About 1 in 7 sentences is a punch line of 6 words or fewer ("That is how old Egypt is.").
- Grade-7 vocabulary. Define any term in five words or fewer ("…the Senate, a council of rich old men.").
- Active verbs: *smashed, chopped, flooded, seized* (not *experienced, underwent, witnessed*).
- 2-3 concrete numbers per minute. Years as "in 1206", "around 3100 BC".
- Hedge legends: "according to legend", "supposedly", "historians still argue".
- Questions only at the hook, an optional midpoint and the legacy pivot.

## 5. The device library

| Device | Rule of thumb | Original example |
|---|---|---|
| Problem → fix → new problem | every 20-40 s | "The kingdom had a problem: no army. So the king hired the pirates who'd been robbing him." |
| "But…" reversal | ≈ 1 per 40 s | "But the gold that built the empire also bankrupted it." |
| Boss intro | every major antagonist | "Then the final boss walked in: a 19-year-old with a borrowed army." |
| Modern idiom | ≈ 1 per minute | "They basically speed-ran the conquest of Persia." |
| Drawable metaphor | 1-2 per chapter | "The treasury was a bucket with a hole in it." |
| Number at first mention | every big figure | "…with 2.3 million stone blocks." (+ NUMBER card) |
| Micro-definition | every term | "…a pharaoh, a king who was also a god." |
| Irony beat | 2-4 per video | "The last emperor was named after the first king." |
| Immersion aside | golden age | "If you lived there then, you'd have had running water." |
| Bridge line | end of every chapter | "And that's when the river stopped flooding." |
| False ending → twist | 70-80 % | "That should be the end of the story. It isn't." |
| Legacy list | final 13 % | "If you've ever used a calendar, signed a contract or…" |
| Thesis + callback | last 20 s | restate the hook's key word |

## 6. Script file format (`script.md`)

```markdown
---
title: The ENTIRE History of Ancient Egypt in 60 Seconds
---

# Hook
Cleopatra lived closer to the Moon landing than to the building of the Great Pyramid.

# Two Lands, One King [card: 3100 BC]
Around 3100 BC, a king named Narmer united Upper and Lower Egypt into one kingdom. {NAME: NARMER}
The Great Pyramid used about 2.3 million stone blocks. {NUMBER: 2.3 MILLION BLOCKS}
The last ruling pharaoh was Cleopatra, | and when she died, Rome took Egypt.
```

- `# Heading [card: DATE]` starts a chapter (YouTube chapter title) and shows a date stamp on its first picture.
- `{NAME: …}`, `{NUMBER: …}`, `{DATE: …}`, `{TITLE: …}`, `{LABEL: …}`, `{MAP}`, `{SPLIT}`, `{METAPHOR}` force a shot type and card.
- `|` forces a picture change inside a sentence. `[visual: …]` describes the picture yourself.
- Lines starting with `>` are notes and are not narrated.

## 7. Fact-checking protocol

1. `chronicle research` produces a fact sheet that flags shaky claims with **(verify)**.
2. Check every date and number in the final script against two independent sources (encyclopaedia + a specialist source).
3. Legends must be hedged in the narration, and numbers rounded honestly ("about", "over").
4. Keep `research.md` in the project: it is your citation trail if a comment challenges a fact.
