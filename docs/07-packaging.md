# Packaging: title, thumbnail, description

The reference's packaging is part of why it reached 12× views per subscriber. The promise is concrete
(*everything*, *in 12 minutes*), the thumbnail is a calm, beautiful illustration rather than a shouting face, and
the description is written for search.

`python -m chronicle package <project>` writes `out/packaging.md` (LLM version) or a template version with
`--no-llm`.

## Titles

Proven pattern: **The ENTIRE History of {Topic} in {N} Minutes**
- "ENTIRE" in capitals is the only shouted word. It signals completeness.
- N is the real runtime rounded down (a 12:13 video says 12). Never round up.
- Variants worth testing:
  - curiosity/paradox: "How a Village of Outlaws Ended Up Ruling the World"
  - stakes: "Why Rome Refused to Die"
  - short: "Rome: The Whole Story"

## Thumbnail system

| Element | Spec |
|---|---|
| Illustration | the topic's most iconic place, drawn in the house style as a richly detailed panorama, filling the left ~55 % |
| Text | the topic name in huge, dark, classical serif capitals on the right (e.g. Cinzel ExtraBold) |
| Sub-text | the date range under the name (e.g. "753 BC – 476 AD"). It frames the story's scope and sets up the twist when the video runs past the end date |
| Background | plain light sky behind the text for contrast |
| Faces | none needed; the subject is the hero |

Generate the illustration with the packaging prompt's thumbnail prompt (no text in the image), then add the
lettering in Figma, Canva or Photoshop. Make 2-3 variants and use YouTube's built-in title/thumbnail testing.

## Description template

```
{2-3 vivid sentences: from humble start to huge end state, the scale.}

{"But the story is stranger than…" + 3 teaser facts.}

{One sentence listing every era and key figure covered, for search.}

This documentary is based on archaeological discoveries, historical sources and academic research.

0:00 {Hook chapter}
0:35 {Chapter 2}
...

#{Topic} #{Era} #History #Documentary ... (15-20 hashtags)
```

Chapters come from the timeline (`out/<slug>.<format>.chapters.txt`). YouTube needs ≥ 3 chapters, the first at
0:00, each ≥ 10 s. Name chapters after their *content*, not after the act (e.g. "The fall of the west", not "Fall").

## Upload checklist
- Title ≤ 70 characters, the promise word capitalised, true runtime.
- Thumbnail readable at 168×94 px (check it small).
- Description first 2 lines contain the hook and the main keyword.
- Chapters pasted; subtitles (`.srt`) uploaded; language set.
- Pinned comment: one debate question ("Which ruler would you have followed?").
- End screen pointing to the next video in the series; a Short linking back to the long video.
