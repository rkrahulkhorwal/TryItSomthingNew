"""Final audio: voice + optional ducked music bed + SFX, normalised to the format's loudness target."""

from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np

from chronicle.render import sfx as sfxlib

SR = 48000


def decode_to_mono(path: Path) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def envelope(x: np.ndarray, win_s: float = 0.05) -> np.ndarray:
    win = max(1, int(win_s * SR))
    n = len(x) // win + 1
    pad = np.zeros(n * win, dtype=np.float32)
    pad[: len(x)] = x
    rms = np.sqrt((pad.reshape(n, win) ** 2).mean(axis=1))
    return np.repeat(rms, win)[: len(x)]


def smooth(x: np.ndarray, attack_s: float, release_s: float, step: int = 480) -> np.ndarray:
    """Attack/release smoothing of a 0..1 control signal (computed on a decimated grid, then expanded)."""
    xs = x[::step]
    out = np.empty_like(xs)
    a_up = 1 - np.exp(-step / (attack_s * SR))
    a_dn = 1 - np.exp(-step / (release_s * SR))
    y = 0.0
    for i, v in enumerate(xs):
        y += (v - y) * (a_up if v > y else a_dn)
        out[i] = y
    return np.repeat(out, step)[: len(x)]


def find_music(fmt: dict, brief: dict, project_root: Path, music_dir: Path) -> Path | None:
    cand = brief.get("music") or (fmt.get("music") or {}).get("file")
    if cand:
        p = Path(cand)
        p = p if p.is_absolute() else project_root / p
        return p if p.exists() else None
    files = sorted([p for p in music_dir.glob("*") if p.suffix.lower() in (".mp3", ".wav", ".ogg", ".flac", ".m4a")])
    return files[0] if files else None


def mix(voice: np.ndarray, timeline: dict, fmt: dict, music_path: Path | None) -> tuple[np.ndarray, dict]:
    out = voice.astype(np.float32).copy()
    info = {"music": None, "sfx_events": 0}
    sfx_cfg = fmt.get("sfx") or {}
    if sfx_cfg.get("enabled"):
        w, p = sfxlib.whoosh(), sfxlib.pop()
        for ev in timeline.get("sfx", []):
            if ev["type"] == "whoosh":
                sfxlib.place(out, w, ev["t"], float(sfx_cfg.get("whoosh_db", -16)))
            elif ev["type"] == "pop":
                sfxlib.place(out, p, ev["t"], float(sfx_cfg.get("pop_db", -20)))
            info["sfx_events"] += 1
    mcfg = fmt.get("music") or {}
    if mcfg.get("enabled") and music_path:
        m = decode_to_mono(music_path)
        if len(m) > 0:
            reps = int(np.ceil(len(out) / len(m)))
            m = np.tile(m, reps)[: len(out)]
            m *= 10 ** (float(mcfg.get("gain_db", -24)) / 20) / (np.sqrt(np.mean(m ** 2)) * 4 + 1e-9)
            speaking = (envelope(voice) > 0.01).astype(np.float32)
            duck = smooth(speaking, 0.08, 0.6)
            m *= 10 ** (-float(mcfg.get("duck_db", 10)) * duck / 20)
            fade = int(1.5 * SR)
            m[:fade] *= np.linspace(0, 1, fade)
            m[-fade:] *= np.linspace(1, 0, fade)
            out += m
            info["music"] = str(music_path)
    target = float((fmt.get("loudness") or {}).get("lufs", -14.0))
    try:
        import pyloudnorm as pyln

        # measured as the dual-mono stereo file we deliver (2 identical channels read +3 dB vs mono)
        loud = pyln.Meter(SR).integrated_loudness(np.stack([out, out], axis=1))
        if np.isfinite(loud):
            out *= 10 ** ((target - loud) / 20)
            info["measured_lufs_before"] = round(float(loud), 2)
    except ImportError:
        peak = np.abs(out).max() + 1e-9
        out *= 0.7 / peak
    info["target_lufs"] = target
    return out, info
