import numpy as np
import soundfile as sf

from chronicle.config import get_format
from chronicle.timeline import build_timeline, caption_groups, srt, youtube_chapters

SR = 48000


def _clips(tmp_path, durations, texts):
    clips = {}
    for i, (d, t) in enumerate(zip(durations, texts), 1):
        p = tmp_path / f"beat_{i:03d}.wav"
        sf.write(p, np.full(int(d * SR), 0.1, dtype=np.float32), SR)
        words = t.split()
        step = d / len(words)
        clips[str(i)] = {"path": str(p), "duration": d,
                         "words": [{"w": w, "s": k * step, "e": (k + 1) * step} for k, w in enumerate(words)]}
    return clips


def _beats(texts, breaks, shot_types=None):
    shot_types = shot_types or ["SCENE"] * len(texts)
    chapters, ch = [], -1
    beats = []
    for i, (t, b, s) in enumerate(zip(texts, breaks, shot_types), 1):
        if b in ("start", "chapter"):
            ch += 1
            chapters.append({"index": ch, "title": f"Chapter {ch + 1}", "card": "1500 AD" if ch == 1 else None})
        beats.append({"id": i, "chapter": ch, "text": t, "break": b, "shot_type": s, "overlay": None,
                      "motion": "auto", "focus": [0.5, 0.45], "transition": "chapter" if b == "chapter" else "cut"})
    return {"chapters": chapters, "beats": beats}


def test_cuts_sit_in_the_pause_and_lead_the_voice(tmp_path):
    texts = ["One two three four.", "Five six seven eight nine.", "Ten eleven twelve."]
    data = _beats(texts, ["start", "sentence", "chapter"])
    fmt = get_format("long_16x9")
    tl, voice = build_timeline(data, _clips(tmp_path, [1.5, 2.0, 1.2], texts), fmt, {"topic": "t"})
    spans = tl["spans"]
    for shot, prev, cur in zip(tl["shots"][1:], spans[:-1], spans[1:]):
        assert prev["end"] <= shot["start"] <= cur["start"]                       # inside the pause
        assert abs((cur["start"] - shot["start"]) - fmt["picture_lead_s"]) < 1e-6  # leads by the measured 0.19 s
    # pauses follow the rules: sentence gap, then the longer chapter gap
    assert abs((spans[1]["start"] - spans[0]["end"]) - fmt["pauses_s"]["sentence"]) < 1e-3
    assert abs((spans[2]["start"] - spans[1]["end"]) - fmt["pauses_s"]["chapter"]) < 1e-3
    assert tl["shots"][2]["transition"] == "flash"
    assert tl["shots"][2]["stamp"]["text"] == "1500 AD"
    assert len(voice) / SR == tl["duration"]


def test_punch_cuts_split_long_shots_but_not_wide_ones(tmp_path):
    texts = ["a b c d e f g h i j k l", "m n o p q r s t u v w x"]
    fmt = get_format("short_9x16")
    data = _beats(texts, ["start", "sentence"], ["SCENE", "LINEUP"])
    tl, _ = build_timeline(data, _clips(tmp_path, [5.0, 5.0], texts), fmt, {"topic": "t"})
    by_beat = {}
    for s in tl["shots"]:
        by_beat.setdefault(s["beat"], []).append(s)
    assert len(by_beat[1]) == 2 and by_beat[1][1]["punch"]      # long SCENE -> two framings
    assert len(by_beat[2]) == 1                                  # wide LINEUP pans instead


def test_caption_groups_respect_limits_and_punctuation():
    words = [{"w": w, "s": i * 0.3, "e": i * 0.3 + 0.25} for i, w in enumerate("Rome fell, and the empire split in two".split())]
    groups = caption_groups(words, 1, max_words=3, max_chars=18)
    assert [" ".join(x["w"] for x in g["words"]) for g in groups] == ["Rome fell,", "and the empire", "split in two"]


def test_srt_and_chapters():
    words = [{"w": w, "s": i * 0.4, "e": i * 0.4 + 0.3} for i, w in enumerate("This is a short line. Another one here.".split())]
    out = srt(words)
    assert out.startswith("1\n00:00:00,000 -->")
    tl = {"chapters": [{"title": "A", "start": 0.0}, {"title": "B", "start": 35.2}, {"title": "C", "start": 95.0}]}
    assert youtube_chapters(tl) == "0:00 A\n0:35 B\n1:35 C"
    tl["chapters"][1]["start"] = 5.0
    assert youtube_chapters(tl) == ""  # chapters shorter than 10 s are not valid on YouTube
