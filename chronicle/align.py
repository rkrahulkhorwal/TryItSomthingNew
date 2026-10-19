"""Word timings for captions and subtitles.

Order of preference: timings returned by the TTS provider -> faster-whisper forced onto the script words ->
proportional estimate from character counts.
"""

from __future__ import annotations

import difflib
import re

import numpy as np
import soundfile as sf

_whisper_cache: dict = {}


def _norm(w: str) -> str:
    return re.sub(r"[^a-z0-9]", "", w.lower())


def proportional(text: str, duration: float) -> list[dict]:
    words = text.split()
    if not words:
        return []
    weights = np.array([len(_norm(w)) + 1.5 for w in words], dtype=float)
    edges = np.concatenate([[0], np.cumsum(weights)]) / weights.sum() * duration
    return [{"w": w, "s": float(edges[i]), "e": float(edges[i + 1])} for i, w in enumerate(words)]


def _whisper_words(path: str, model_name: str) -> list[dict]:
    from faster_whisper import WhisperModel

    if model_name not in _whisper_cache:
        _whisper_cache[model_name] = WhisperModel(model_name, device="cpu", compute_type="int8")
    model = _whisper_cache[model_name]
    audio, sr = sf.read(path, dtype="float32")
    if audio.ndim == 2:
        audio = audio.mean(axis=1)
    if sr != 16000:
        import soxr
        audio = soxr.resample(audio, sr, 16000).astype(np.float32)
    segs, _ = model.transcribe(audio, language="en", word_timestamps=True, beam_size=1, vad_filter=False)
    return [{"w": w.word.strip(), "s": float(w.start), "e": float(w.end)} for s in segs for w in (s.words or [])]


def map_onto_script(script_text: str, heard: list[dict], duration: float) -> list[dict]:
    """Give every *script* word a time, using whisper's words as anchors (keeps the script's spelling)."""
    words = script_text.split()
    if not heard:
        return proportional(script_text, duration)
    a = [_norm(w) for w in words]
    b = [_norm(w["w"]) for w in heard]
    times: list[tuple[float, float] | None] = [None] * len(words)
    for blk in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            times[blk.a + k] = (heard[blk.b + k]["s"], heard[blk.b + k]["e"])
    # interpolate gaps between anchors
    i = 0
    n = len(words)
    while i < n:
        if times[i] is not None:
            i += 1
            continue
        j = i
        while j < n and times[j] is None:
            j += 1
        t0 = times[i - 1][1] if i > 0 else 0.0
        t1 = times[j][0] if j < n else duration
        span = max(t1 - t0, 0.05 * (j - i))
        for k in range(i, j):
            s = t0 + span * (k - i) / (j - i)
            times[k] = (s, t0 + span * (k - i + 1) / (j - i))
        i = j
    return [{"w": w, "s": float(t[0]), "e": float(t[1])} for w, t in zip(words, times)]


def align(path: str, text: str, duration: float, *, method: str = "whisper", model: str = "base.en") -> list[dict]:
    if method == "whisper":
        try:
            return map_onto_script(text, _whisper_words(path, model), duration)
        except ImportError:
            pass
    return proportional(text, duration)
