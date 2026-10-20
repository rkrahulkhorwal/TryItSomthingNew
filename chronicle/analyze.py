"""Reverse-engineer any reference video: the measurements behind docs/00-teardown-report.md.

    python -m chronicle analyze reference.mp4 --audio reference.mp3 --out analysis/my_reference

Outputs analysis.json (all metrics), shots.csv, analysis.md (summary) and contact sheets for visual review.
"""

from __future__ import annotations

import csv
import json
import re
import subprocess
from pathlib import Path

import cv2
import numpy as np


def detect_shots(video: Path, threshold: float = 27.0) -> list[tuple[float, float]]:
    from scenedetect import SceneManager, open_video
    from scenedetect.detectors import ContentDetector

    v = open_video(str(video))
    sm = SceneManager()
    sm.add_detector(ContentDetector(threshold=threshold, min_scene_len=8))
    sm.detect_scenes(v, show_progress=False)
    scenes = [(s.seconds, e.seconds) for s, e in sm.get_scene_list()]
    if not scenes:
        dur = v.duration.seconds
        scenes = [(0.0, dur)]
    return scenes


def frame_motion(video: Path, shots: list[tuple[float, float]], sample_fps: float = 10.0) -> list[dict]:
    """Per shot: cumulative zoom, pan (fraction of width/height) and residual local motion from optical flow."""
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    W, H = 320, 180
    ys, xs = np.mgrid[8:H - 8:8, 8:W - 8:8]
    grid = np.stack([xs.ravel(), ys.ravel()], 1).astype(np.float32)
    out = []
    step = max(1, int(round(fps / sample_fps)))
    for (a, b) in shots:
        f0, f1 = int(a * fps) + 2, int(b * fps) - 2
        frames = list(range(f0, max(f0 + 1, f1), step))
        prev = None
        zoom, px, py, local = 1.0, 0.0, 0.0, []
        diffs = []
        for f in frames:
            cap.set(cv2.CAP_PROP_POS_FRAMES, f)
            ok, im = cap.read()
            if not ok:
                break
            g = cv2.cvtColor(cv2.resize(im, (W, H), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
            if prev is not None:
                diffs.append(float(np.abs(g.astype(np.float32) - prev.astype(np.float32)).mean()))
                flow = cv2.calcOpticalFlowFarneback(prev, g, None, 0.5, 3, 15, 3, 5, 1.2, 0)
                fl = flow[grid[:, 1].astype(int), grid[:, 0].astype(int)]
                M, _ = cv2.estimateAffinePartial2D(grid, grid + fl, method=cv2.RANSAC, ransacReprojThreshold=0.6)
                if M is not None:
                    zoom *= float(np.hypot(M[0, 0], M[1, 0]))
                    c = np.array([W / 2, H / 2])
                    cc = M[:, :2] @ c + M[:, 2]
                    px += (cc[0] - c[0]) / W
                    py += (cc[1] - c[1]) / H
                    res = np.linalg.norm(grid + fl - (grid @ M[:, :2].T + M[:, 2]), axis=1)
                    local.append(float((res > 0.75).mean()))
            prev = g
        moves = []
        if zoom > 1.025:
            moves.append("zoom_in")
        elif zoom < 0.975:
            moves.append("zoom_out")
        if abs(px) > 0.03:
            moves.append("pan")
        if abs(py) > 0.03:
            moves.append("tilt")
        lm = float(np.mean(local)) if local else 0.0
        if lm > 0.08 and not moves:
            moves.append("animated")
        out.append({"zoom_total": round(zoom, 4), "pan_x": round(px, 4), "pan_y": round(py, 4),
                    "local_motion": round(lm, 4), "mean_frame_diff": round(float(np.mean(diffs)) if diffs else 0.0, 3),
                    "camera": "+".join(moves) or "static"})
    return out


def contact_sheets(video: Path, shots: list[tuple[float, float]], out_dir: Path, per_sheet: int = 20) -> list[Path]:
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    tiles = []
    for i, (a, b) in enumerate(shots):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int((a + b) / 2 * fps))
        ok, im = cap.read()
        if not ok:
            im = np.zeros((180, 320, 3), np.uint8)
        tile = cv2.resize(im, (320, 180), interpolation=cv2.INTER_AREA)
        cv2.rectangle(tile, (0, 0), (150, 18), (0, 0, 0), -1)
        cv2.putText(tile, f"#{i} {a:.1f}s {b - a:.1f}s", (3, 13), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1)
        tiles.append(tile)
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for k in range(0, len(tiles), per_sheet):
        chunk = tiles[k:k + per_sheet]
        while len(chunk) % 4:
            chunk.append(np.zeros_like(tiles[0]))
        rows = [np.hstack(chunk[r * 4:(r + 1) * 4]) for r in range(len(chunk) // 4)]
        p = out_dir / f"sheet_{k // per_sheet:02d}.jpg"
        cv2.imwrite(str(p), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 88])
        paths.append(p)
    return paths


def loudness(media: Path) -> dict:
    r = subprocess.run(["ffmpeg", "-nostats", "-hide_banner", "-i", str(media), "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    txt = r.stderr.split("Summary:")[-1]

    def grab(label):
        m = re.search(label + r":\s*(-?[\d.]+)", txt)
        return float(m.group(1)) if m else None

    return {"integrated_lufs": grab("I"), "lra_lu": grab("LRA"), "true_peak_dbfs": grab("Peak")}


def decode16k(media: Path) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(media), "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def pauses(y: np.ndarray, sr: int = 16000, thr_db: float = -50, min_s: float = 0.08) -> list[tuple[float, float]]:
    hop = 160
    n = len(y) // hop
    rms = np.sqrt((y[: n * hop].reshape(n, hop) ** 2).mean(axis=1) + 1e-12)
    silent = 20 * np.log10(rms) < thr_db
    runs, i = [], 0
    while i < n:
        if silent[i]:
            j = i
            while j < n and silent[j]:
                j += 1
            if (j - i) * hop / sr >= min_s:
                runs.append((i * hop / sr, j * hop / sr))
            i = j
        else:
            i += 1
    return runs


def transcribe(y16: np.ndarray, model_name: str) -> list[dict]:
    from faster_whisper import WhisperModel

    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segs, _ = model.transcribe(y16, language="en", word_timestamps=True, beam_size=5)
    return [{"w": w.word.strip(), "s": float(w.start), "e": float(w.end)} for s in segs for w in (s.words or [])]


def analyze(video: Path, audio: Path | None, out_dir: Path, whisper_model: str | None = "small.en",
            pitch: bool = True, log=print) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    media = audio or video
    log("shots ...")
    shots = detect_shots(video)
    log(f"  {len(shots)} shots; motion ...")
    motion = frame_motion(video, shots)
    log("contact sheets ...")
    sheets = contact_sheets(video, shots, out_dir / "sheets")
    log("audio ...")
    lo = loudness(media)
    y = decode16k(media)
    dur = len(y) / 16000
    ps = pauses(y)
    pl = np.array([b - a for a, b in ps]) if ps else np.array([0.0])
    durs = np.array([b - a for a, b in shots])
    cuts = [a for a, _ in shots[1:]]
    in_pause = sum(any(a - 0.05 <= c <= b + 0.05 for a, b in ps) for c in cuts)
    result = {
        "video": str(video), "duration_s": round(dur, 2),
        "edit": {"shots": len(shots), "asl_s": round(float(durs.mean()), 2), "median_shot_s": round(float(np.median(durs)), 2),
                 "p10_shot_s": round(float(np.percentile(durs, 10)), 2), "p90_shot_s": round(float(np.percentile(durs, 90)), 2),
                 "shots_per_min": round(len(shots) / (dur / 60), 1),
                 "static_shots": sum(m["camera"] == "static" for m in motion),
                 "cuts_inside_pause": int(in_pause), "cuts": len(cuts)},
        "audio": {**lo, "pauses": len(ps), "pause_median_s": round(float(np.median(pl)), 3),
                  "voiced_share": round(1 - float(pl.sum()) / dur, 3)},
    }
    if pitch:
        try:
            import librosa

            f0, vflag, _ = librosa.pyin(y[: 16000 * 600], fmin=60, fmax=400, sr=16000, frame_length=1024, hop_length=320)
            f0v = f0[vflag & ~np.isnan(f0)]
            st = 12 * np.log2(f0v / np.median(f0v))
            result["audio"].update({"f0_median_hz": round(float(np.median(f0v)), 1), "pitch_sd_semitones": round(float(st.std()), 2)})
        except Exception as e:  # pitch is optional
            log(f"  pitch skipped: {e}")
    words = []
    if whisper_model:
        log(f"speech ({whisper_model}) ...")
        try:
            words = transcribe(y, whisper_model)
        except ImportError:
            log("  faster-whisper not installed - speech metrics skipped")
    if words:
        leads = []
        for c in cuts:
            nxt = next((w for w in words if w["s"] >= c - 0.05), None)
            if nxt:
                leads.append(nxt["s"] - c)
        sentences = re.split(r"(?<=[.!?])\s+", " ".join(w["w"] for w in words))
        lens = [len(s.split()) for s in sentences if s.strip()]
        result["script"] = {"words": len(words), "wpm": round(len(words) / (dur / 60), 1), "sentences": len(lens),
                            "median_sentence_words": float(np.median(lens)) if lens else 0,
                            "picture_lead_median_s": round(float(np.median(leads)), 3) if leads else None}
        (out_dir / "transcript.json").write_text(json.dumps(words), encoding="utf-8")
    with open(out_dir / "shots.csv", "w", newline="") as f:
        wr = csv.writer(f)
        wr.writerow(["shot", "start_s", "end_s", "dur_s", "camera", "zoom_total", "pan_x", "pan_y", "local_motion"])
        for i, ((a, b), m) in enumerate(zip(shots, motion)):
            wr.writerow([i, round(a, 2), round(b, 2), round(b - a, 2), m["camera"], m["zoom_total"], m["pan_x"], m["pan_y"],
                         m["local_motion"]])
    result["contact_sheets"] = [str(p) for p in sheets]
    (out_dir / "analysis.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    e, a = result["edit"], result["audio"]
    md = [f"# Analysis of {video.name}", "",
          f"- **Edit:** {e['shots']} shots, median {e['median_shot_s']} s (p10 {e['p10_shot_s']}, p90 {e['p90_shot_s']}), "
          f"{e['shots_per_min']} shots/min, {e['static_shots']} static, {e['cuts_inside_pause']}/{e['cuts']} cuts inside a pause",
          f"- **Audio:** {a.get('integrated_lufs')} LUFS, LRA {a.get('lra_lu')}, {a['pauses']} pauses (median {a['pause_median_s']} s), "
          f"voiced {a['voiced_share'] * 100:.0f} %" + (f", F0 {a['f0_median_hz']} Hz, pitch SD {a['pitch_sd_semitones']} st" if 'f0_median_hz' in a else "")]
    if "script" in result:
        s = result["script"]
        md.append(f"- **Script:** {s['words']} words, {s['wpm']} WPM, median sentence {s['median_sentence_words']} words, "
                  f"picture leads voice by {s['picture_lead_median_s']} s")
    md += ["", "Review the contact sheets in `sheets/` and tag every shot with a shot type (see docs/03-visual-system.md)."]
    (out_dir / "analysis.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    log("\n".join(md))
    return result
