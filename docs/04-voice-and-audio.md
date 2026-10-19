# Voice & audio

## 1. The narrator profile (measured)

| Trait | Reference | Why it works |
|---|---|---|
| Voice | adult male baritone, median F0 **117 Hz** | authority without heaviness |
| Expressiveness | pitch SD **4.1 semitones** (p5-p95 range 13.6 st) | animated storytelling; a flat read sits near 2-3 st |
| Pace | **193 WPM**, voiced 86 % of the time | fast enough that the mind never wanders |
| Pauses | median 0.25 s, p90 0.43 s, none longer than ~0.6 s | no dead air |
| Mix | voice only, no music, no SFX | nothing competes with the words |
| Loudness | -17.7 LUFS (quiet) | **don't copy this.** Master to -14 LUFS |

The digital silence between phrases (about 22 s in total) shows the reference was assembled from TTS clips. A
synthetic voice is fine for this format when it is energetic and well paced.

## 2. Casting a voice (data-driven)

```bash
python -m chronicle cast                       # rank local Kokoro voices against the reference profile
python -m chronicle cast --f0 180 --wpm 175    # or against your own target (e.g. a female narrator)
```

Every male Kokoro voice reads the same passage. The command measures pitch, expressiveness, pace and clarity
(the word-error rate of a Whisper transcription), picks the speed that hits the target WPM, ranks the voices,
and saves a WAV of each so you can listen before choosing. On the reference profile, **`am_adam` at speed
1.15-1.2** scored best (pitch SD 4.13 st vs 4.14, 0 % word errors). The demo uses it.

## 3. Providers and settings

| Provider | Cost | Quality | Word timings | Settings to start with |
|---|---|---|---|---|
| **ElevenLabs** | paid | best, most human | yes (character-level) | `eleven_multilingual_v2`, stability 0.40, similarity 0.75, style 0.35, speaker boost on, speed 1.05-1.10; pick a deep "documentary storyteller" voice |
| **OpenAI** `gpt-4o-mini-tts` | paid (cheap) | very good, steerable | via Whisper | voice `onyx` or `ash`; the `instructions` in `config/defaults.yaml` describe the delivery |
| **Kokoro** (local) | free | good | via Whisper | voice from `chronicle cast`, speed 1.12-1.2 |
| **Edge TTS** | free (needs internet) | decent | yes | `en-US-ChristopherNeural`, rate +10-15 % |

Set the provider per project in `brief.yaml`:

```yaml
providers:
  tts:
    provider: elevenlabs
    elevenlabs: {voice_id: "YOUR_VOICE_ID", speed: 1.08}
```

## 4. How the voice is produced

- **One clip per beat** (one sentence or clause). The edit then controls every pause exactly, and changing one
  line re-synthesises only that line (clips are cached by text hash).
- ElevenLabs gets the previous and next lines as context, so intonation flows across clip boundaries.
- Each clip's leading and trailing silence is trimmed (-45 dB), with 4 ms fades so butted clips never click.
- Gaps are re-inserted by rule: sentence 0.28 s, clause 0.14 s, chapter 0.45 s for long-form; about 35 % tighter for Shorts.
- Word timings come from the provider when available, otherwise from Whisper forced onto the script words. These
  drive captions and subtitles.

**Delivery tips** (put them in the provider's style or instructions field):
- Punch the first word after a pause. Land names and numbers clearly.
- Smile on the ironic lines; drop the pitch on dark turns ("…and Rome took Egypt.").
- Spell tricky names phonetically in the script if the voice stumbles (e.g. "Ramesses" → "RAM-uh-seez" for
  synthesis only; keep the real spelling for captions by fixing the caption words afterwards).

## 5. Mix

| Layer | Faithful long-form | Enhanced / Shorts |
|---|---|---|
| Voice | 100 % | 100 % |
| Music bed | none | one track ~24-26 dB under the voice, ducked a further ~10 dB while speaking, 1.5 s fades |
| SFX | none | whoosh into chapter cuts (-16 to -18 dB), soft pop on cards (-20 to -22 dB), synthesised by the engine |
| Loudness | **-14 LUFS integrated, ≤ -1 dBTP** | same |

Music: drop licensed tracks into `assets/music/` (YouTube Audio Library, Pixabay Music, Epidemic Sound,
Artlist) or set `music: path/to/track.mp3` in `brief.yaml`. Pick low-tempo cinematic or "documentary" beds
without vocals. The engine loops, ducks and fades them automatically. SFX are generated procedurally, so there is
no licensing risk.

The renderer measures loudness on the delivered stereo file, normalises to the target, and runs a limiter with
0.5 dB of codec headroom. The demo renders measure -14.2 LUFS with true peaks of -1.0 to -1.3 dBFS.
