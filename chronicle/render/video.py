"""Frame-by-frame compositor piping raw RGB frames into ffmpeg (H.264 + AAC)."""

from __future__ import annotations

import math
import subprocess
import tempfile
import time
from pathlib import Path

import numpy as np
import soundfile as sf

from chronicle.render.audio import SR, mix
from chronicle.render.canvas import ShotPainter, load_rgb
from chronicle.render.overlays import CaptionRenderer, HeaderRenderer, OverlayRenderer, draw_progress

FLASH_RGB = np.array([255, 246, 228], dtype=np.float32)


def _flash_alpha(t: float, tc: float) -> float:
    if tc - 0.07 <= t < tc:
        return 0.85 * (t - (tc - 0.07)) / 0.07
    if tc <= t < tc + 0.45:
        return 0.85 * math.exp(-(t - tc) / 0.09)
    return 0.0


def _dip_alpha(t: float, tc: float) -> float:
    if tc - 0.15 <= t < tc:
        return (t - (tc - 0.15)) / 0.15
    if tc <= t < tc + 0.2:
        return 1 - (t - tc) / 0.2
    return 0.0


def render_video(timeline: dict, voice: np.ndarray, fmt: dict, style: dict, images: dict, out_path: Path,
                 music_path: Path | None = None, crf: int = 19, preset: str = "medium", log=print) -> dict:
    W, H, fps = int(timeline["width"]), int(timeline["height"]), int(timeline["fps"])
    duration = float(timeline["duration"])
    n_frames = int(math.ceil(duration * fps))
    shots = timeline["shots"]
    layout = fmt.get("layout", "fill")

    audio, audio_info = mix(voice, timeline, fmt, music_path)
    tp = float((fmt.get("loudness") or {}).get("true_peak_db", -1.0))
    limit = 10 ** ((tp - 0.5) / 20)  # 0.5 dB headroom for AAC encoder overshoot
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        wav_path = f.name
    sf.write(wav_path, np.stack([audio, audio], axis=1), SR, subtype="FLOAT")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
           "-i", wav_path, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", preset, "-crf", str(crf),
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
           "-af", f"alimiter=limit={limit:.4f}:attack=5:release=60:level=0",
           "-movflags", "+faststart", "-shortest", str(out_path)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    overlays = OverlayRenderer(style, W, H)
    cap_cfg = fmt.get("captions") or {}
    captions = CaptionRenderer(style, cap_cfg, W, H) if cap_cfg.get("enabled") else None
    groups = timeline.get("captions") or []
    hdr_cfg = fmt.get("header") or {}
    header = HeaderRenderer(style, timeline["header"], W, H, bool(hdr_cfg.get("persist"))) \
        if (hdr_cfg.get("enabled") and timeline.get("header")) else None
    header_until = float(hdr_cfg.get("until_s", 3.0))
    progress = bool(fmt.get("progress_bar"))

    painters: dict[int, ShotPainter] = {}
    img_cache: dict[int, np.ndarray] = {}
    si, gi = 0, 0
    last_key, last_bytes = None, None
    computed = 0
    t0 = time.time()
    try:
        for fidx in range(n_frames):
            t = fidx / fps
            while si + 1 < len(shots) and t >= shots[si + 1]["start"]:
                painters.pop(si, None)
                si += 1
            shot = shots[si]
            if si not in painters:
                bid = shot["beat"]
                if bid not in img_cache:
                    img_cache.clear()
                    img_cache[bid] = load_rgb(images[bid])
                painters[si] = ShotPainter(img_cache[bid], W, H, layout, shot["motion"], fmt.get("card"),
                                           shot.get("shot_type", "SCENE"))
            painter = painters[si]
            dur = max(shot["end"] - shot["start"], 1e-6)
            p = (t - shot["start"]) / dur

            # transitions: the incoming shot's style decides (pre-roll happens on the outgoing shot)
            trans_alpha, trans_kind = 0.0, None
            for k in (si, si + 1):
                if 0 <= k < len(shots) and shots[k]["transition"] in ("flash", "dip") and shots[k]["start"] > 0:
                    a = (_flash_alpha if shots[k]["transition"] == "flash" else _dip_alpha)(t, shots[k]["start"])
                    if a > trans_alpha:
                        trans_alpha, trans_kind = a, shots[k]["transition"]

            while gi < len(groups) and t > groups[gi]["show_to"]:
                gi += 1
            group = groups[gi] if (gi < len(groups) and groups[gi]["show_from"] <= t <= groups[gi]["show_to"]) else None

            ov = shot.get("overlay")
            ov_state = None
            if ov:
                q = (t - ov["start"]) / OverlayRenderer.POP_S
                ov_state = "pre" if q < 0 else (f"a{int(q * 100)}" if q < 1 else "on")
            stamp = shot.get("stamp")
            if stamp:
                q = (t - stamp["start"]) / 0.18
                ov_state = (ov_state, "pre" if q < 0 else (f"s{int(q * 100)}" if q < 1 else "son"))
            cap_state = None
            if captions and group:
                active = sum(1 for w in group["words"] if t >= w["s"] - 0.02)
                popq = (t - group["show_from"]) / 0.09
                cap_state = (gi, active, int(popq * 10) if popq < 1 else "on")
            hdr_state = header.state(t, header_until) if header else None
            prog_state = int(W * min(1.0, t / duration)) if progress else None
            motion_state = None if painter.static else round(p, 5)
            key = (si, motion_state, round(trans_alpha, 3), ov_state, cap_state, hdr_state, prog_state)
            if key == last_key and last_bytes is not None:
                proc.stdin.write(last_bytes)
                continue

            frame = painter.frame(p).copy()
            if trans_alpha > 0:
                if trans_kind == "flash":
                    frame = (frame.astype(np.float32) * (1 - trans_alpha) + FLASH_RGB * trans_alpha).astype(np.uint8)
                else:
                    frame = (frame.astype(np.float32) * (1 - trans_alpha)).astype(np.uint8)
            card = painter.box if painter.layout == "card" else None
            if stamp:
                overlays.draw_stamp(frame, stamp, t, card)
            if ov:
                overlays.draw(frame, ov, t, card, header is not None and t <= header_until)
            if captions and group:
                captions.draw(frame, group, t)
            if header:
                header.draw(frame, t, header_until)
            if progress:
                draw_progress(frame, t, duration)
            last_bytes = np.ascontiguousarray(frame).tobytes()
            last_key = key
            proc.stdin.write(last_bytes)
            computed += 1
            if fidx and fidx % (fps * 30) == 0:
                log(f"  {fidx / fps:6.1f}s / {duration:.1f}s rendered ({(time.time() - t0):.0f}s elapsed)")
    finally:
        proc.stdin.close()
        rc = proc.wait()
        Path(wav_path).unlink(missing_ok=True)
    if rc != 0:
        raise RuntimeError(f"ffmpeg exited with code {rc}")
    return {"frames": n_frames, "computed_frames": computed, "seconds": round(time.time() - t0, 1), "audio": audio_info}
