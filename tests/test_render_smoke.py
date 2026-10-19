"""End to end: script -> beats -> silent voice -> placeholder images -> tiny renders in two aspect ratios."""

import json
import subprocess

import yaml

from chronicle import pipeline, writer
from chronicle.project import create_project

SCRIPT = """---
title: The ENTIRE History of Coffee in 15 Seconds
---
# Hook
Imagine a goat herder who noticed his goats dancing all night.

# The Spread [card: 1500 AD]
Coffee houses spread across the Ottoman Empire, | and rulers tried to ban them.
By 1700, London had over 2,000 coffee houses. {NUMBER: 2,000 COFFEE HOUSES}
"""


def _duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(json.loads(out)["format"]["duration"])


def test_end_to_end_render(tmp_path):
    proj = create_project("coffee", "Coffee", format_name="short_9x16", duration_s=15, base=tmp_path)
    proj.write_text("script.md", SCRIPT)
    brief = proj.brief()
    brief["providers"] = {"tts": {"provider": "silent"}, "images": {"provider": "placeholder"}, "llm": {"provider": "manual"}}
    small = {"width": 216, "height": 384, "fps": 12}
    brief["format_overrides"] = {"short_9x16": small, "long_16x9": {"width": 384, "height": 216, "fps": 12}}
    proj.save_brief(brief)

    data = writer.plan(proj, use_llm=False)
    # the Shorts preset splits sentences over 10 words at a clause: 4 sentences -> 5 pictures
    assert [b["break"] for b in data["beats"]] == ["start", "clause", "chapter", "clause", "sentence"]
    assert all(b["image_prompt"] for b in data["beats"])
    pipeline.voice(proj, log=lambda *_: None)
    pipeline.images(proj, log=lambda *_: None)
    outs = pipeline.render(proj, ["short_9x16", "long_16x9"], preset="ultrafast", crf=30, log=lambda *_: None)

    for out, fmt in zip(outs, ["short_9x16", "long_16x9"]):
        assert out.exists() and out.stat().st_size > 10_000
        tl = proj.read_json(f"out/timeline.{fmt}.json")
        assert abs(_duration(out) - tl["duration"]) < 0.5
        assert (proj.out_dir / f"coffee.{fmt}.srt").exists()
    vertical = proj.read_json("out/timeline.short_9x16.json")
    assert vertical["captions"] and vertical["header"]
    assert any(s.get("overlay") for s in vertical["shots"])
    assert yaml.safe_load(proj.brief_path.read_text())["format"] == "short_9x16"
