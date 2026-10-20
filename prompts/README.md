# Prompt library

The writing brain of the system. Each template encodes the measured rules from `docs/`. The engine fills the
`{{variables}}` from the project (`brief.yaml`, format preset, style, earlier stages) and sends it to Claude or any OpenRouter model, or
writes it to `projects/<slug>/llm/<stage>.prompt.md` in manual mode.

| Template | Stage | Output |
|---|---|---|
| `01-research.md` | `chronicle research` | `research.md`: arc, paradox, timeline, cast, numbers, legends vs evidence, twists, legacies, visual inventory |
| `02-outline.md` | `chronicle outline` | `outline.md`: titles, paradox, chapter table with seconds, words, date cards, beats and bridge lines, twist placement |
| `03-script.md` | `chronicle write` | `script.md`: the narration in the script format, at the word budget |
| `04-beats.md` | `chronicle plan` | JSON art direction per beat (shot type, visual, card text, characters, focus) → `beats.json` |
| `05-packaging.md` | `chronicle package` | `out/packaging.md`: 10 titles, thumbnail concepts + prompts, description, tags, pinned comment, Shorts spin-offs |
| `06-retention-review.md` | `chronicle review` | `review.md`: 12-point score, top 5 fixes, revised script if needed |
| `07-scenes.md` | `chronicle scenes` | animated mode: one scene spec per beat (template + parameters) → `beats.json`. Template, cast, map and icon lists are filled from the runtime's code |

A template may contain `<!-- SYSTEM -->` and `<!-- USER -->` markers; the part between them is the system prompt.

Using them without the engine: open a template, replace each `{{variable}}` by hand (topic, duration_label,
target_words, wpm, hook_seconds, …) and paste it into any chat model.
