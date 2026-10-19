"""Voice-over providers. Each beat is synthesised as its own clip, so the edit controls every pause.

Every provider returns {"path", "duration", "words" (list of {"w","s","e"} or None)} for a 48 kHz mono WAV whose
leading and trailing silence has been trimmed.
"""

from __future__ import annotations

import base64
import io
import os
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

from chronicle.paths import resolve
from chronicle.text import count_words

SR = 48000


def to_mono_48k(samples: np.ndarray, sr: int) -> np.ndarray:
    x = np.asarray(samples, dtype=np.float32)
    if x.ndim == 2:
        x = x.mean(axis=1)
    if sr != SR:
        import soxr
        x = soxr.resample(x, sr, SR).astype(np.float32)
    return x


def decode_any(data: bytes) -> tuple[np.ndarray, int]:
    """Decode wav/flac/ogg with soundfile, anything else (mp3) through ffmpeg."""
    try:
        x, sr = sf.read(io.BytesIO(data), dtype="float32")
        return x, sr
    except Exception:
        with tempfile.NamedTemporaryFile(suffix=".bin", delete=False) as f:
            f.write(data)
            src = f.name
        try:
            raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                                 check=True, capture_output=True).stdout
        finally:
            os.unlink(src)
        return np.frombuffer(raw, dtype=np.float32).copy(), SR


def trim_silence(x: np.ndarray, threshold_db: float = -45.0, pad_s: float = 0.02) -> tuple[np.ndarray, float]:
    """Trim leading/trailing silence. Returns (trimmed, seconds removed at the start)."""
    if len(x) == 0:
        return x, 0.0
    win = int(0.01 * SR)
    n = len(x) // win
    if n == 0:
        return x, 0.0
    rms = np.sqrt((x[: n * win].reshape(n, win) ** 2).mean(axis=1) + 1e-12)
    loud = np.nonzero(20 * np.log10(rms) > threshold_db)[0]
    if len(loud) == 0:
        return x, 0.0
    start = max(0, loud[0] * win - int(pad_s * SR))
    end = min(len(x), (loud[-1] + 1) * win + int(pad_s * SR))
    return x[start:end], start / SR


def _finish(x: np.ndarray, out_path: Path, words: list | None, trim_db: float) -> dict:
    y, removed = trim_silence(x, trim_db)
    # gentle 4 ms fades so clips never click when butted together
    f = min(len(y) // 2, int(0.004 * SR))
    if f > 0:
        ramp = np.linspace(0, 1, f, dtype=np.float32)
        y[:f] *= ramp
        y[-f:] *= ramp[::-1]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(out_path, y, SR, subtype="PCM_16")
    dur = len(y) / SR
    if words:
        words = [{"w": w["w"], "s": max(0.0, w["s"] - removed), "e": min(dur, max(0.0, w["e"] - removed))} for w in words]
    return {"path": str(out_path), "duration": dur, "words": words}


class KokoroTTS:
    """Local, free, CPU-friendly neural TTS (Kokoro-82M via kokoro-onnx)."""

    def __init__(self, cfg: dict, trim_db: float = -45.0):
        from kokoro_onnx import Kokoro

        model_dir = resolve(cfg.get("model_dir", "models/kokoro"))
        model = model_dir / "kokoro-v1.0.onnx"
        voices = model_dir / "voices-v1.0.bin"
        if not model.exists() or not voices.exists():
            raise FileNotFoundError(f"Kokoro model files missing in {model_dir} - run `python -m chronicle setup --kokoro`")
        self.k = Kokoro(str(model), str(voices))
        self.voice = cfg.get("voice", "am_michael")
        self.speed = float(cfg.get("speed", 1.1))
        self.lang = cfg.get("lang", "en-us")
        self.trim_db = trim_db

    def synthesize(self, text: str, out_path: Path, prev_text: str | None = None, next_text: str | None = None) -> dict:
        samples, sr = self.k.create(text, voice=self.voice, speed=self.speed, lang=self.lang)
        return _finish(to_mono_48k(samples, sr), out_path, None, self.trim_db)


class ElevenLabsTTS:
    """ElevenLabs with character-level timestamps (best quality; word timings come for free)."""

    URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_128"

    def __init__(self, cfg: dict, trim_db: float = -45.0):
        import requests

        self.requests = requests
        self.key = os.environ.get("ELEVENLABS_API_KEY")
        if not self.key:
            raise RuntimeError("set ELEVENLABS_API_KEY")
        if not cfg.get("voice_id"):
            raise RuntimeError("set providers.tts.elevenlabs.voice_id in brief.yaml (or config/defaults.yaml)")
        self.cfg = cfg
        self.trim_db = trim_db

    def synthesize(self, text: str, out_path: Path, prev_text: str | None = None, next_text: str | None = None) -> dict:
        c = self.cfg
        body = {
            "text": text,
            "model_id": c.get("model_id", "eleven_multilingual_v2"),
            "voice_settings": {k: c[k] for k in ("stability", "similarity_boost", "style", "use_speaker_boost", "speed") if k in c},
        }
        if prev_text:
            body["previous_text"] = prev_text
        if next_text:
            body["next_text"] = next_text
        r = _post_with_retry(self.requests, self.URL.format(voice=c["voice_id"]), json=body,
                             headers={"xi-api-key": self.key, "Content-Type": "application/json"})
        data = r.json()
        x, sr = decode_any(base64.b64decode(data["audio_base64"]))
        words = _words_from_chars(data.get("alignment") or {})
        return _finish(to_mono_48k(x, sr), out_path, words, self.trim_db)


class OpenAITTS:
    URL = "https://api.openai.com/v1/audio/speech"

    def __init__(self, cfg: dict, trim_db: float = -45.0):
        import requests

        self.requests = requests
        self.key = os.environ.get("OPENAI_API_KEY")
        if not self.key:
            raise RuntimeError("set OPENAI_API_KEY")
        self.cfg = cfg
        self.trim_db = trim_db

    def synthesize(self, text: str, out_path: Path, prev_text: str | None = None, next_text: str | None = None) -> dict:
        c = self.cfg
        body = {"model": c.get("model", "gpt-4o-mini-tts"), "voice": c.get("voice", "onyx"), "input": text,
                "response_format": "wav"}
        if c.get("instructions"):
            body["instructions"] = c["instructions"]
        if c.get("speed"):
            body["speed"] = float(c["speed"])
        r = _post_with_retry(self.requests, self.URL, json=body, headers={"Authorization": f"Bearer {self.key}"})
        x, sr = decode_any(r.content)
        return _finish(to_mono_48k(x, sr), out_path, None, self.trim_db)


class EdgeTTS:
    """Free Microsoft neural voices through the `edge-tts` package (returns word boundaries)."""

    def __init__(self, cfg: dict, trim_db: float = -45.0):
        import edge_tts  # noqa: F401

        self.cfg = cfg
        self.trim_db = trim_db

    def synthesize(self, text: str, out_path: Path, prev_text: str | None = None, next_text: str | None = None) -> dict:
        import asyncio

        import edge_tts

        async def run():
            comm = edge_tts.Communicate(text, self.cfg.get("voice", "en-US-ChristopherNeural"),
                                        rate=self.cfg.get("rate", "+0%"), boundary="WordBoundary")
            audio, words = bytearray(), []
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    audio.extend(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    s = chunk["offset"] / 1e7
                    words.append({"w": chunk["text"], "s": s, "e": s + chunk["duration"] / 1e7})
            return bytes(audio), words

        data, words = asyncio.run(run())
        x, sr = decode_any(data)
        return _finish(to_mono_48k(x, sr), out_path, words or None, self.trim_db)


class SilentTTS:
    """No voice: silence of the estimated reading time. For animatics and tests."""

    def __init__(self, cfg: dict, trim_db: float = -45.0, wpm: float = 190.0):
        self.wpm = wpm

    def synthesize(self, text: str, out_path: Path, prev_text: str | None = None, next_text: str | None = None) -> dict:
        dur = max(0.6, count_words(text) / self.wpm * 60)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        sf.write(out_path, np.zeros(int(dur * SR), dtype=np.float32), SR, subtype="PCM_16")
        return {"path": str(out_path), "duration": dur, "words": None}


def _words_from_chars(al: dict) -> list | None:
    chars = al.get("characters") or []
    starts = al.get("character_start_times_seconds") or []
    ends = al.get("character_end_times_seconds") or []
    if not chars:
        return None
    words, cur, s, e = [], "", None, None
    for ch, cs, ce in zip(chars, starts, ends):
        if ch.isspace():
            if cur:
                words.append({"w": cur, "s": s, "e": e})
            cur, s = "", None
            continue
        if s is None:
            s = cs
        cur += ch
        e = ce
    if cur:
        words.append({"w": cur, "s": s, "e": e})
    return words


def _post_with_retry(requests, url, *, json, headers, tries=4):
    import time

    for attempt in range(tries):
        r = requests.post(url, json=json, headers=headers, timeout=180)
        if r.status_code == 200:
            return r
        if r.status_code in (429, 500, 502, 503, 504) and attempt < tries - 1:
            time.sleep(2 ** (attempt + 1))
            continue
        raise RuntimeError(f"{url} -> HTTP {r.status_code}: {r.text[:300]}")


def get_tts(settings: dict, wpm: float = 190.0):
    cfg = settings.get("tts", {})
    provider = cfg.get("provider", "kokoro")
    trim_db = float(cfg.get("trim_db", -45))
    sub = cfg.get(provider, {}) or {}
    if provider == "kokoro":
        return KokoroTTS(sub, trim_db)
    if provider == "elevenlabs":
        return ElevenLabsTTS(sub, trim_db)
    if provider == "openai":
        return OpenAITTS(sub, trim_db)
    if provider == "edge":
        return EdgeTTS(sub, trim_db)
    if provider == "silent":
        return SilentTTS(sub, trim_db, wpm)
    raise ValueError(f"unknown tts provider '{provider}'")
