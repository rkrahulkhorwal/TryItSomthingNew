"""Data-driven voice casting: rank local TTS voices against a target narrator profile.

The default target is the reference video's narrator (docs/00-teardown-report.md, section 8):
median F0 117 Hz, pitch SD 4.1 semitones, ~193 words per minute.
Each candidate reads the same passage; we measure pitch, expressiveness, pace and clarity (word error rate
of a Whisper transcription), pick the speed that hits the target pace, and save samples to listen to.
"""

from __future__ import annotations

import difflib
import re
from pathlib import Path

import numpy as np
import soundfile as sf

TARGET = {"f0_hz": 116.6, "pitch_sd_st": 4.14, "wpm": 193.0}
PASSAGE = ("Then foreign kings seized the north, riding a terrifying new weapon: the horse-drawn chariot. "
           "So Egypt copied the chariots, kicked the invaders out, and built an empire. But empires get tired.")


def _norm_words(text: str) -> list[str]:
    return [re.sub(r"[^a-z0-9]", "", w.lower()) for w in text.split() if re.sub(r"[^a-z0-9]", "", w.lower())]


def wer(ref: str, hyp: str) -> float:
    a, b = _norm_words(ref), _norm_words(hyp)
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    matched = sum(blk.size for blk in sm.get_matching_blocks())
    return round(1 - matched / max(len(a), 1), 3)


def profile(samples: np.ndarray, sr: int, text: str) -> dict:
    import librosa

    y = librosa.resample(np.asarray(samples, dtype=np.float32), orig_sr=sr, target_sr=16000)
    f0, vflag, _ = librosa.pyin(y, fmin=60, fmax=400, sr=16000, frame_length=1024, hop_length=320)
    f0v = f0[vflag & ~np.isnan(f0)]
    st = 12 * np.log2(f0v / np.median(f0v))
    dur = len(samples) / sr
    return {"f0_hz": round(float(np.median(f0v)), 1), "pitch_sd_st": round(float(st.std()), 2),
            "wpm": round(len(text.split()) / dur * 60, 1), "duration_s": round(dur, 2), "y16": y}


def cast(model_dir: Path, out_dir: Path, voices: list[str] | None = None, target: dict | None = None,
         passage: str = PASSAGE, whisper_model: str = "base.en", log=print) -> list[dict]:
    from kokoro_onnx import Kokoro

    target = {**TARGET, **(target or {})}
    k = Kokoro(str(model_dir / "kokoro-v1.0.onnx"), str(model_dir / "voices-v1.0.bin"))
    voices = voices or sorted(v for v in k.get_voices() if v[:2] in ("am", "bm"))
    try:
        from faster_whisper import WhisperModel

        asr = WhisperModel(whisper_model, device="cpu", compute_type="int8")
    except ImportError:
        asr = None
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for v in voices:
        s, sr = k.create(passage, voice=v, speed=1.0, lang="en-us")
        base = profile(s, sr, passage)
        speed = float(np.clip(target["wpm"] / base["wpm"], 0.8, 1.45))
        s, sr = k.create(passage, voice=v, speed=speed, lang="en-us")
        p = profile(s, sr, passage)
        sf.write(out_dir / f"{v}.wav", np.asarray(s, dtype=np.float32), sr)
        err = None
        if asr is not None:
            segs, _ = asr.transcribe(p["y16"], language="en", beam_size=1)
            err = wer(passage, " ".join(x.text for x in segs))
        pitch_dist = abs(12 * np.log2(p["f0_hz"] / target["f0_hz"])) / 3.0      # 3 semitones = 1 point
        expr_dist = abs(p["pitch_sd_st"] - target["pitch_sd_st"]) / 1.0         # 1 semitone SD = 1 point
        clarity = (err or 0.0) * 10                                             # 10 % WER = 1 point
        score = round(pitch_dist + expr_dist + clarity, 3)
        rows.append({"voice": v, "speed": round(speed, 2), "f0_hz": p["f0_hz"], "pitch_sd_st": p["pitch_sd_st"],
                     "wpm": p["wpm"], "wer": err, "score": score, "sample": str(out_dir / f"{v}.wav")})
        log(f"  {v:12s} speed {speed:.2f}  F0 {p['f0_hz']:6.1f} Hz  pitch SD {p['pitch_sd_st']:.2f} st  "
            f"{p['wpm']:6.1f} wpm  WER {err}  score {score}")
    rows.sort(key=lambda r: r["score"])
    log("best matches (lower is better): " + ", ".join(f"{r['voice']}@{r['speed']}" for r in rows[:3]))
    return rows
