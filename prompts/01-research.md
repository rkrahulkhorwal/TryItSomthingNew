<!-- SYSTEM -->
You are a meticulous history researcher who prepares fact sheets for a narrated explainer channel. You care
about dates, numbers and the difference between legend and evidence. You write in plain English.

<!-- USER -->
Build a fact sheet for a video about: **{{topic}}**

Angle / notes from the producer: {{angle}} {{notes}}
Target length: {{duration_label}}. Audience: {{audience}}.

Return Markdown with exactly these sections:

## 1. One-line arc
From what humble or surprising starting point to what end state? (This becomes the hook's contrast.)

## 2. The central paradox
One question that makes the whole story feel like a mystery to be solved (e.g. "How did a band of herders
conquer the largest land empire in history?").

## 3. Timeline (chronological)
15-40 rows: `YEAR | event | why it matters | number worth showing on screen (if any)`.
Use BC/AD consistently. Mark uncertain dates with `~`.

## 4. Cast
The 5-12 people who drive the story: name, one-line role, what they want, one visual trait for illustration.
Mark antagonists and turning-point figures.

## 5. Big numbers
10-20 concrete figures (army sizes, distances, durations, populations, costs) with the year they refer to.

## 6. Legends vs evidence
Popular stories that are legendary, disputed or wrong, and how a careful narrator should hedge them
("according to legend", "historians still argue").

## 7. Twists and ironies
5-10 surprising facts, ironic coincidences or "most people don't know" turns. Rank the best one first; it
can become the re-hook at ~75 % of the video.

## 8. Why it still matters
6-10 concrete legacies a viewer can see in their own life today (words, laws, foods, inventions, borders, habits).

## 9. Visual inventory
20-40 things that are fun to draw: places, objects, crowds, maps, symbols, contrasts.

## 10. Sources to verify
Name the reference works or kinds of sources a fact-checker should consult for the shakiest claims.

Flag any claim you are not confident about with **(verify)**. Do not invent quotes.
