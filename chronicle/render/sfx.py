"""Procedurally synthesised sound effects (no licensing to worry about)."""

from __future__ import annotations

import numpy as np
from scipy.signal import istft, stft

SR = 48000


def whoosh(dur: float = 0.6, sr: int = SR, seed: int = 7) -> np.ndarray:
    """Air whoosh: noise through a band-pass whose centre sweeps up then down, with a swelling envelope."""
    rng = np.random.default_rng(seed)
    n = int(dur * sr)
    noise = rng.standard_normal(n).astype(np.float32)
    f, t, Z = stft(noise, fs=sr, nperseg=1024, noverlap=768)
    tn = t / dur
    centre = 350 + 2600 * np.sin(np.pi * np.clip(tn, 0, 1)) ** 1.5           # Hz, rises then falls
    width = 0.9                                                               # octaves
    logf = np.log2(np.maximum(f[:, None], 20.0))
    mask = np.exp(-0.5 * ((logf - np.log2(centre[None, :])) / width) ** 2)
    _, y = istft(Z * mask, fs=sr, nperseg=1024, noverlap=768)
    y = y[:n]
    env_t = np.linspace(0, 1, len(y))
    env = np.sin(np.pi * np.clip(env_t / 0.62, 0, 1) / 2) ** 2 * np.exp(-np.clip(env_t - 0.62, 0, None) * 9)
    y = y * env
    return (y / (np.abs(y).max() + 1e-9) * 0.9).astype(np.float32)


def pop(dur: float = 0.12, sr: int = SR, seed: int = 3) -> np.ndarray:
    """Soft cartoon 'pop' for cards appearing: a falling sine blip plus a tiny click."""
    t = np.arange(int(dur * sr)) / sr
    freq = 260 + 900 * np.exp(-t / 0.018)
    phase = 2 * np.pi * np.cumsum(freq) / sr
    tone = np.sin(phase) * np.exp(-t / 0.032)
    click = np.random.default_rng(seed).standard_normal(len(t)) * np.exp(-t / 0.0018) * 0.25
    y = tone + click
    return (y / (np.abs(y).max() + 1e-9) * 0.9).astype(np.float32)


def place(track: np.ndarray, clip: np.ndarray, t: float, gain_db: float, sr: int = SR) -> None:
    i = int(t * sr)
    if i >= len(track):
        return
    j = min(len(track), i + len(clip))
    track[i:j] += clip[: j - i] * (10 ** (gain_db / 20))
