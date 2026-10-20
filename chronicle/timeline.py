"""From beats + voice clips to an edit decision list (timeline) for one output format.

Measured rules applied here (docs/00-teardown-report.md, section 7):
- the voice runs continuously; gaps are short (sentence ~0.25 s, clause ~0.12 s, chapter ~0.45 s)
- each picture cuts in *inside the pause*, `picture_lead_s` (~0.19 s) before its line starts
- long-form keeps every still static; shorts add camera moves and "punch" sub-shots for pace
"""

from __future__ import annotations

import math
import re

import numpy as np
import soundfile as sf

from chronicle.text import count_words

SR = 48000

# Preferred camera moves per shot type (rotated so consecutive shots differ).
MOVE_PREFS = {
    "SCENE": ["push_in", "pan_right", "pull_out", "pan_left"],
    "ESTABLISHING": ["pan_right", "pull_out", "pan_left"],
    "CROWD": ["pan_left", "pan_right"],
    "LINEUP": ["pan_right", "pan_left"],
    "CONFRONT": ["push_in"],
    "LANDMARK": ["pull_out", "tilt_up"],
    "REACTION": ["push_in"],
    "MAP": ["push_in"],
    "TIMELINE": ["pan_right"],
    "TITLE": ["push_in"],
    "NUMBER": ["pull_out"],
    "CHARACTER_INTRO": ["push_in"],
    "CALLOUT": ["push_in"],
    "CTA": ["static"],
    "METAPHOR": ["push_in", "pull_out"],
    "SYMBOL": ["push_in"],
    "INFOGRAPHIC": ["push_in"],
    "SPLIT": ["static"],
    "BUBBLE": ["push_in", "pan_left"],
    "MODERN": ["pan_left", "push_in"],
}
# Compositions that spread across the whole width: in a cropped card they pan across instead of punching in.
WIDE_TYPES = {"LINEUP", "CROWD", "ESTABLISHING", "TIMELINE", "MAP", "SPLIT", "INFOGRAPHIC", "CONFRONT"}
# zoom % per second / pan (fraction of frame width) per second, and caps
INTENSITY = {
    "subtle": {"zoom_rate": 0.012, "zoom_cap": 0.06, "zoom_min": 0.02, "pan_rate": 0.008, "pan_cap": 0.035, "pan_zoom": 1.08},
    "dynamic": {"zoom_rate": 0.035, "zoom_cap": 0.14, "zoom_min": 0.05, "pan_rate": 0.022, "pan_cap": 0.07, "pan_zoom": 1.16},
}


def assemble_voice(beats: list[dict], clips: dict, fmt: dict, lead_in: float = 0.08) -> tuple[np.ndarray, list[dict]]:
    """Concatenate per-beat clips with the format's pause rules. Returns (audio, spans)."""
    pauses = fmt.get("pauses_s", {})
    parts, spans = [], []
    cursor = lead_in
    parts.append(np.zeros(int(lead_in * SR), dtype=np.float32))
    for i, b in enumerate(beats):
        clip = clips[str(b["id"])]
        x, sr = sf.read(clip["path"], dtype="float32")
        if x.ndim == 2:
            x = x.mean(axis=1)
        if i > 0:
            gap = float(pauses.get({"clause": "clause", "chapter": "chapter"}.get(b["break"], "sentence"), 0.25))
            parts.append(np.zeros(int(gap * SR), dtype=np.float32))
            cursor += int(gap * SR) / SR
        start = cursor
        parts.append(x)
        cursor += len(x) / SR
        words = clip.get("words") or []
        spans.append({"beat": b["id"], "start": start, "end": cursor,
                      "words": [{"w": w["w"], "s": start + w["s"], "e": start + w["e"]} for w in words]})
    tail = float(fmt.get("tail_s", 0.8))
    parts.append(np.zeros(int(tail * SR), dtype=np.float32))
    return np.concatenate(parts), spans


def _pick_move(shot_type: str, explicit: str | None, prev_move: str | None, counters: dict) -> str:
    if explicit and explicit != "auto":
        return explicit
    prefs = MOVE_PREFS.get(shot_type, MOVE_PREFS["SCENE"])
    k = counters.get(shot_type, 0)
    move = prefs[k % len(prefs)]
    if move == prev_move and len(prefs) > 1:
        move = prefs[(k + 1) % len(prefs)]
        k += 1
    counters[shot_type] = k + 1
    return move


def motion_params(move: str, duration: float, intensity: str, focus: list | None) -> dict:
    """Camera path as start/end zoom and view centre (fractions of the image).

    Paths are centred on the beat's focus point. When the view window is as large as the image (zoom 1 in a
    matching aspect) the renderer clamps the centre, so this only matters for crops, cards and zooms.
    """
    fx, fy = (focus or [0.5, 0.45])
    if move == "static" or intensity == "static":
        return {"move": "static", "z0": 1.0, "z1": 1.0, "c0": [fx, fy], "c1": [fx, fy]}
    p = INTENSITY[intensity]
    dz = min(p["zoom_cap"], max(p["zoom_min"], p["zoom_rate"] * duration))
    dx = min(p["pan_cap"], p["pan_rate"] * duration)
    if move == "push_in":
        return {"move": move, "z0": 1.0, "z1": 1.0 + dz, "c0": [fx, fy], "c1": [fx, fy]}
    if move == "pull_out":
        return {"move": move, "z0": 1.0 + dz, "z1": 1.0, "c0": [fx, fy], "c1": [fx, fy]}
    z = p["pan_zoom"]
    if move in ("pan_left", "pan_right"):
        a, b = (fx + dx, fx - dx) if move == "pan_left" else (fx - dx, fx + dx)
        return {"move": move, "z0": z, "z1": z, "c0": [a, fy], "c1": [b, fy]}
    if move in ("tilt_up", "tilt_down"):
        a, b = (fy + dx, fy - dx) if move == "tilt_up" else (fy - dx, fy + dx)
        return {"move": move, "z0": z, "z1": z, "c0": [fx, a], "c1": [fx, b]}
    return {"move": "static", "z0": 1.0, "z1": 1.0, "c0": [fx, fy], "c1": [fx, fy]}


def caption_groups(words: list[dict], beat_id: int, max_words: int, max_chars: int) -> list[dict]:
    groups, cur = [], []
    for w in words:
        text = w["w"]
        if cur and (len(cur) >= max_words or len(" ".join(x["w"] for x in cur + [w])) > max_chars):
            groups.append(cur)
            cur = []
        cur.append(w)
        if re.search(r"[.!?;:,]$", text):
            groups.append(cur)
            cur = []
    if cur:
        groups.append(cur)
    return [{"beat": beat_id, "words": g, "start": g[0]["s"], "end": g[-1]["e"]} for g in groups]


def build_timeline(beats_data: dict, clips: dict, fmt: dict, brief: dict) -> tuple[dict, np.ndarray]:
    beats = beats_data["beats"]
    voice, spans = assemble_voice(beats, clips, fmt)
    total = len(voice) / SR
    lead = float(fmt.get("picture_lead_s", 0.19))
    shot_cfg = fmt.get("shot", {})
    min_s, max_s = float(shot_cfg.get("min_s", 1.0)), float(shot_cfg.get("max_s", 6.0))
    motion_mode = fmt.get("motion", "static")
    transitions = fmt.get("transitions", {"default": "cut", "chapter": "flash"})

    # 1) cut times
    cuts = [0.0]
    for i in range(1, len(spans)):
        prev_end, start = spans[i - 1]["end"], spans[i]["start"]
        gap = start - prev_end
        cuts.append(max(prev_end + min(0.05, gap / 3), start - lead))
    ends = cuts[1:] + [total]

    # 2) shots (+ punch sub-shots), motion, overlays
    shots, counters, prev_move = [], {}, None
    beat_by_id = {b["id"]: b for b in beats}
    for i, b in enumerate(beats):
        s0, s1 = cuts[i], ends[i]
        pieces = [(s0, s1, False)]
        if fmt.get("punch_cuts") and (s1 - s0) > max_s and spans[i]["words"] and b.get("shot_type") not in WIDE_TYPES:
            mid = (s0 + s1) / 2
            boundary = min((w["e"] for w in spans[i]["words"][:-1]), key=lambda t: abs(t - mid), default=None)
            if boundary and boundary - s0 >= min_s and s1 - boundary >= min_s:
                pieces = [(s0, boundary + 0.04, False), (boundary + 0.04, s1, True)]
        for (a, z, punch) in pieces:
            move = _pick_move(b.get("shot_type", "SCENE"), b.get("motion"), prev_move, counters)
            mp = motion_params(move, z - a, motion_mode, b.get("focus"))
            if punch:  # same picture, tighter framing toward the focus: reads as a new shot
                fx, fy = b.get("focus") or [0.5, 0.45]
                zoom = 1.24 if motion_mode != "static" else 1.18
                mp = {"move": "punch", "z0": zoom, "z1": zoom * (1.0 + (0.03 if motion_mode != "static" else 0.0)),
                      "c0": [0.5 + (fx - 0.5) * 0.8, 0.5 + (fy - 0.5) * 0.8], "c1": [0.5 + (fx - 0.5) * 0.85, 0.5 + (fy - 0.5) * 0.85]}
            prev_move = mp["move"]
            shot = {
                "beat": b["id"], "start": round(a, 4), "end": round(z, 4), "shot_type": b.get("shot_type", "SCENE"),
                "motion": mp, "punch": punch,
                "transition": transitions.get("chapter", "flash") if (b.get("transition") == "chapter" and not punch) else (
                    "cut" if punch else transitions.get("default", "cut")),
            }
            ov = b.get("overlay")
            if fmt.get("overlays", True) and ov and ov.get("text") and not punch:
                shot["overlay"] = {"kind": ov["kind"], "text": ov["text"], "start": round(a + 0.10, 4)}
            # chapter date stamp: a small corner tag on the first shot of a chapter that has a [card: ...]
            card = beats_data["chapters"][b["chapter"]].get("card") if b["break"] in ("chapter", "start") else None
            if fmt.get("overlays", True) and card and not punch and not (ov and ov.get("kind") == "date"):
                shot["stamp"] = {"text": str(card).upper(), "start": round(a + 0.05, 4)}
            shots.append(shot)

    # 3) captions
    cap = fmt.get("captions", {}) or {}
    groups = []
    if cap.get("enabled"):
        for sp in spans:
            groups += caption_groups(sp["words"], sp["beat"], int(cap.get("max_words", 3)), int(cap.get("max_chars", 18)))
        for k, g in enumerate(groups):
            nxt = groups[k + 1]["start"] if k + 1 < len(groups) else total
            g["show_from"] = max(0.0, g["start"] - 0.04)
            g["show_to"] = nxt - 0.02 if (nxt - g["end"]) < 0.5 else g["end"] + 0.3

    # 4) sound effects cues
    sfx = []
    for sh in shots:
        if sh["transition"] in ("flash", "dip", "whip") and sh["start"] > 0:
            sfx.append({"type": "whoosh", "t": max(0.0, sh["start"] - 0.28)})
        if sh.get("overlay"):
            sfx.append({"type": "pop", "t": sh["overlay"]["start"]})

    # 5) YouTube chapters
    chapters, seen = [], set()
    for b, sp in zip(beats, spans):
        if b["chapter"] in seen:
            continue
        seen.add(b["chapter"])
        ch = beats_data["chapters"][b["chapter"]]
        start = 0.0 if not chapters else next(s["start"] for s in shots if s["beat"] == b["id"])
        chapters.append({"title": ch["title"], "start": round(start, 2)})

    words_all = [w for sp in spans for w in sp["words"]]
    timeline = {
        "format": fmt["name"], "width": fmt["width"], "height": fmt["height"], "fps": fmt["fps"],
        "duration": round(total, 3), "shots": shots, "captions": groups, "sfx": sfx, "chapters": chapters,
        "spans": [{k: v for k, v in sp.items() if k != "words"} for sp in spans], "words": words_all,
        "header": header_text(brief, beats_data) if (fmt.get("header") or {}).get("enabled") else None,
        "stats": edit_stats(shots, words_all, total),
    }
    return timeline, voice


def header_text(brief: dict, beats_data: dict) -> str:
    text = brief.get("header_text") or brief.get("title") or beats_data.get("title") or brief.get("topic", "")
    return text.upper()


def edit_stats(shots: list[dict], words: list[dict], total: float) -> dict:
    durs = np.array([s["end"] - s["start"] for s in shots]) if shots else np.array([0.0])
    return {
        "shots": len(shots),
        "median_shot_s": round(float(np.median(durs)), 2),
        "mean_shot_s": round(float(durs.mean()), 2),
        "max_shot_s": round(float(durs.max()), 2),
        "min_shot_s": round(float(durs.min()), 2),
        "words": len(words),
        "wpm": round(len(words) / max(total, 1e-6) * 60, 1),
        "duration_s": round(total, 2),
    }


def fmt_ts(t: float) -> str:
    t = int(math.floor(t))
    h, m, s = t // 3600, (t % 3600) // 60, t % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def youtube_chapters(timeline: dict, min_len: float = 10.0) -> str:
    chs = timeline["chapters"]
    ok = len(chs) >= 3 and all((b["start"] - a["start"]) >= min_len for a, b in zip(chs, chs[1:]))
    if not ok:
        return ""
    return "\n".join(f"{fmt_ts(c['start'])} {c['title']}" for c in chs)


def srt(words: list[dict], max_chars: int = 42, max_dur: float = 5.5) -> str:
    def ts(t):
        ms = int(round(t * 1000))
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"

    cues, cur = [], []
    for w in words:
        line = " ".join(x["w"] for x in cur + [w])
        if cur and (len(line) > max_chars * 2 or w["e"] - cur[0]["s"] > max_dur):
            cues.append(cur)
            cur = []
        cur.append(w)
        if re.search(r"[.!?]$", w["w"]) and len(" ".join(x["w"] for x in cur)) > 20:
            cues.append(cur)
            cur = []
    if cur:
        cues.append(cur)
    out = []
    for i, c in enumerate(cues, 1):
        text = " ".join(x["w"] for x in c)
        if len(text) > max_chars:  # break into two balanced lines
            words_ = text.split()
            best = min(range(1, len(words_)), key=lambda k: abs(len(" ".join(words_[:k])) - len(text) / 2))
            text = " ".join(words_[:best]) + "\n" + " ".join(words_[best:])
        out.append(f"{i}\n{ts(c[0]['s'])} --> {ts(c[-1]['e'] + 0.05)}\n{text}\n")
    return "\n".join(out)


def words_estimate(beats: list[dict]) -> int:
    return sum(count_words(b["text"]) for b in beats)
