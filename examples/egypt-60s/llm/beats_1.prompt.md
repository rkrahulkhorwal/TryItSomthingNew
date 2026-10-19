# SYSTEM

You are the art director of an illustrated narration channel. For every line of narration you decide what
single cartoon illustration appears on screen, so viewers *see exactly what they hear*. You think in shot
types, visual metaphors and on-screen cards, and you keep recurring characters consistent.

# USER

Video: **Ancient Egypt** · format 9:16 render of a project whose images are 16:9 (card layout) · images are 16:9.

House style (the image model adds this automatically; do not repeat it):
Hand-inked editorial cartoon illustration. Bold, even black outlines; flat cel colours with a faint paper grain; warm parchment and earth palette (sand, olive, umber) with accents of brick red, ochre gold and sky blue. Richly detailed environments and architecture, but very simple cartoon people. One clear focal subject, readable at phone size, generous contrast between subject and background. 2D illustration.
Every person in the picture, including the ones doing the main action, is a "pebble-head" cartoon figure: a large smooth egg-shaped head in warm cream, two small black bead eyes, thick expressive eyebrows that carry the emotion, a tiny line mouth, two faint rosy cheek dots, no nose, no ears; hair, crowns and headwear are simple shapes sitting on top of the egg head; short rounded bodies and thin limbs drawn with the same black outline; clothing is simplified but period-accurate with solid colours; hands are simple mitten shapes. No realistic or anatomically drawn people anywhere.

Below are the narration beats. Each beat becomes exactly one picture held for the length of its line.
Beat ids are fixed; return one entry per id.

[1] (chapter 1: Hook; start) Cleopatra lived closer to the Moon landing than to the building of the Great Pyramid.
[2] (chapter 1: Hook; sentence) That is how old Egypt is.
[3] (chapter 2: Two Lands, One King, date card 3100 BC; chapter) Around 3100 BC, a king named Narmer united Upper and Lower Egypt into one kingdom.
[4] (chapter 2: Two Lands, One King; sentence) Every summer the Nile flooded, and the black mud it left behind fed a whole civilization.
[5] (chapter 3: The Pyramid Age, date card 2560 BC; chapter) Pharaohs were treated as living gods, and gods need very big tombs.
[6] (chapter 3: The Pyramid Age; sentence) The Great Pyramid used about 2.3 million stone blocks.
[7] (chapter 3: The Pyramid Age; sentence) And archaeologists think it was built by paid workers, not slaves.
[8] (chapter 4: Empire, date card 1550 BC; chapter) Then foreign kings seized the north, riding a terrifying new weapon: the horse-drawn chariot.
[9] (chapter 4: Empire; sentence) So Egypt copied the chariots, kicked the invaders out, and built an empire.
[10] (chapter 4: Empire; sentence) Ramesses the Great ruled for 66 years.
[11] (chapter 5: The Long Goodbye, date card 30 BC; chapter) But empires get tired.
[12] (chapter 5: The Long Goodbye; sentence) Libyans, Nubians, Persians and Greeks took turns on the throne.
[13] (chapter 5: The Long Goodbye; sentence) The last ruling pharaoh was Cleopatra,
[14] (chapter 5: The Long Goodbye; clause) and when she died, Rome took Egypt.
[15] (chapter 6: Lost and Found; chapter) Within a few centuries, nobody on Earth could read hieroglyphs.
[16] (chapter 6: Lost and Found; sentence) For fourteen centuries, Egypt's writing was a total mystery.
[17] (chapter 6: Lost and Found; sentence) Until one stone with three scripts cracked the code,
[18] (chapter 6: Lost and Found; clause) and we finally learned how old Egypt really is.

## Shot types (and how often the reference used each)

| Type | Share | Use it for |
|---|---|---|
| SCENE | ~38 % | characters acting out the sentence literally (the default) |
| ESTABLISHING | ~6 % | a new place or era, wide panorama |
| CROWD | ~5 % | armies, mobs, fleets, populations; scale and mood |
| LINEUP | ~2 % | a row of rulers, a cast, "the seven kings" |
| CONFRONT | ~2 % | two rivals face off |
| LANDMARK | ~1 % | an iconic building |
| REACTION | <1 % | a close-up of an exaggerated face |
| MAP | ~5 % | territory, routes, splits, losses |
| TIMELINE | ~4 % | a date anchor, usually at a chapter start; overlay = the date |
| TITLE | ~5 % | a new era, event or concept name; overlay = 1-4 words |
| NUMBER | ~2 % | first mention of a striking figure; overlay = number + noun ("40,000 MEN") |
| CHARACTER_INTRO | ~3 % | first appearance of a key figure; overlay = the name |
| CALLOUT | ~2 % | naming an object or group in the scene; overlay = the label |
| CTA | <1 % | the subscribe line only |
| METAPHOR | ~10 % | draw the figure of speech literally (a candle melting, a map being sliced) |
| SYMBOL | ~1 % | a single symbolic object (a question mark, a lone figure in smoke) |
| INFOGRAPHIC | ~5 % | mechanisms, comparisons, cause and effect drawn with arrows and icons |
| SPLIT | ~4 % | contrasts: rich vs poor, before vs after, west vs east |
| BUBBLE | ~2 % | what characters think or fear, shown as picture bubbles |
| MODERN | ~2 % | present-day settings in the legacy section |

Rules
1. **Literal first:** the picture shows what the line says. If the line is abstract, use a METAPHOR, INFOGRAPHIC or SPLIT instead of a vague scene.
2. **Rotate devices:** never more than 3 plain SCENEs in a row; about 60 % SCENE/ESTABLISHING/CROWD and 40 % devices.
3. Overlay text: only for TIMELINE, TITLE, NUMBER, CHARACTER_INTRO, CALLOUT, CTA. Keep it 1-4 words, uppercase; otherwise use an empty string. Never put long text in images.
4. `visual`: one or two concrete sentences an illustrator can draw with no other context: who, doing what, where, with which props, the emotion on the faces, the camera framing. Do not mention art style or colours of the style.
5. Recurring people: give each one a short key and a fixed look (costume colour + one signature prop or feature), list them in `characters`, and reference their keys in each beat where they appear.
6. `focus_x`, `focus_y` (0-1): where the most important thing sits, for camera moves and vertical crops. Use 0.5, 0.45 when unsure.
7. Keep comedy in the expressions and props (exaggerated eyebrows, sweat drops, X-eyes for the defeated), never in gore.

Return JSON only, matching the schema you were given.


Return ONLY JSON that matches this schema:

```json
{
  "type": "object",
  "properties": {
    "characters": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "key": {
            "type": "string"
          },
          "description": {
            "type": "string"
          }
        },
        "required": [
          "key",
          "description"
        ],
        "additionalProperties": false
      }
    },
    "beats": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer"
          },
          "shot_type": {
            "type": "string",
            "enum": [
              "SCENE",
              "ESTABLISHING",
              "CROWD",
              "LINEUP",
              "CONFRONT",
              "LANDMARK",
              "REACTION",
              "MAP",
              "TIMELINE",
              "TITLE",
              "NUMBER",
              "CHARACTER_INTRO",
              "CALLOUT",
              "CTA",
              "METAPHOR",
              "SYMBOL",
              "INFOGRAPHIC",
              "SPLIT",
              "BUBBLE",
              "MODERN"
            ]
          },
          "visual": {
            "type": "string"
          },
          "overlay_text": {
            "type": "string"
          },
          "characters": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "focus_x": {
            "type": "number"
          },
          "focus_y": {
            "type": "number"
          }
        },
        "required": [
          "id",
          "shot_type",
          "visual",
          "overlay_text",
          "characters",
          "focus_x",
          "focus_y"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "characters",
    "beats"
  ],
  "additionalProperties": false
}
```
