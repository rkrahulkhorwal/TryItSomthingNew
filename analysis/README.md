# Analysis data

Derived measurements of the reference video (["The ENTIRE History of ROME in 12 Minutes"](https://youtu.be/kHCamT4zfH4)).
The video, its audio, its frames and its narration are not stored here. Only numbers and my own short descriptions are.

| File | Contents |
|---|---|
| `data/metrics.json` | every headline number in the teardown (edit, script, audio, visual, source stats) |
| `data/shots.csv` | all 200 shots: start/end/duration, chapter, shot type, family, a one-line description of the picture, whether the cut lands on a sentence or clause boundary, how far the picture leads the next word, words spoken during the shot, camera motion |
| `data/chapters.csv` | the 10 YouTube chapters with duration, share, words, WPM, shots and average shot length |
| `data/audio_profile.json` | pause intervals (< -50 dBFS, ≥ 80 ms) and a 50 ms loudness envelope of the narration |
| `make_figures.py` | regenerates the charts in `docs/assets/` from the files above (`python analysis/make_figures.py`) |

## Method

| Measurement | Tool |
|---|---|
| Shot boundaries | PySceneDetect content detector (threshold 27), cross-checked with the adaptive detector |
| Camera motion | Farnebäck optical flow on 320×180 frames; robust similarity fit per frame pair (zoom, pan, rotation) + residual local motion |
| Transitions | frame-difference profile ±12 frames around each cut |
| Speech | faster-whisper `medium.en`, word timestamps (2,358 words) |
| Loudness | ffmpeg `ebur128` (integrated, LRA, true peak) |
| Pauses | 10 ms RMS below -50 dBFS |
| Pitch | librosa pYIN, 60-400 Hz |
| Shot types | every shot's middle frame reviewed on contact sheets and classified by hand into 20 types |
| Palette | k-means (k = 14) over all shots |

To run the same measurements on any other video:

```bash
python -m chronicle analyze other_video.mp4 --audio other_video.mp3 --out analysis/other
```

This writes `analysis.json`, `analysis.md`, `shots.csv`, `transcript.json` and contact sheets for your own shot-type
tagging.
