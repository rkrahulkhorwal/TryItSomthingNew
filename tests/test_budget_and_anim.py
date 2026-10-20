import json
import shutil
import subprocess

import pytest

from chronicle.anim import catalog
from chronicle.anim.plan import load_scene_file, validate
from chronicle.budget import BudgetExceeded, Ledger
from chronicle.project import create_project


def test_ledger_refuses_calls_that_could_break_the_cap(tmp_path):
    led = Ledger(tmp_path / "spend.json", 1.0)
    led.check(0.4, "research")                               # fits
    led.record(stage="research", provider="openrouter", model="m", cost=0.7)
    with pytest.raises(BudgetExceeded):
        led.check(0.4, "script")                              # 0.7 spent + 0.4 worst case > 1.0
    led.check(0.25, "script")
    # real account usage that the ledger never saw also counts against the cap
    with pytest.raises(BudgetExceeded):
        led.check(0.1, "image", account_spent=0.95)
    again = Ledger(tmp_path / "spend.json", 1.0)               # persisted across runs
    assert again.spent == 0.7 and "research" in again.summary()


def test_no_cap_means_no_limit(tmp_path):
    led = Ledger(tmp_path / "spend.json", None)
    led.check(1e6, "anything")


def test_catalog_reads_the_runtime():
    c = catalog.catalog()
    for key in ("cast", "poses", "expressions", "settings", "views", "regions", "places", "icons"):
        assert c[key], key
    assert {"justinian", "theodora", "mehmed"} <= set(c["cast"])
    assert {"byz_565", "arab_642", "ottoman_1450"} <= set(c["regions"])
    assert "constantinople" in c["places"] and "eagle" in c["icons"]
    assert "byz_565" in catalog.REGIONS


SCRIPT = """---
title: Test
---
# Hook
Rome fell in 476. Except it did not.
"""


def test_scene_plan_is_validated_and_applied(tmp_path):
    proj = create_project("t", "Test", format_name="mid_16x9", base=tmp_path)
    proj.write_text("script.md", SCRIPT)
    from chronicle import writer

    writer.plan(proj, use_llm=False)
    plan = {"scenes": [{"id": 1, "scene": {"template": "collapse", "label": "ROME"}},
                       {"id": 2, "scene": {"template": "map", "regions": [{"id": "nowhere"}]}}]}
    f = tmp_path / "scenes.json"
    f.write_text(json.dumps(plan))
    scenes, warn = load_scene_file(proj, f)
    assert scenes[1]["template"] == "collapse"
    assert any("unknown region" in w for w in warn)
    assert proj.beats()["beats"][0]["scene"]["label"] == "ROME"
    warn = validate({1: {"template": "nope"}}, proj.beats())
    assert "beat 1: unknown template 'nope'" in warn and "beat 2: no scene" in warn


def _chromium_available() -> bool:
    try:
        from chronicle.anim.render import chromium_path

        import playwright  # noqa: F401
        return chromium_path() is not None and shutil.which("ffmpeg") is not None
    except ImportError:
        return False


@pytest.mark.skipif(not _chromium_available(), reason="needs playwright, chromium and ffmpeg")
def test_animated_render_smoke(tmp_path):
    """Two scenes, tiny frame, two browser workers -> a playable mp4 of the right length."""
    import numpy as np

    from chronicle.anim.render import render_animated
    from chronicle.config import get_format
    from chronicle.render.audio import SR

    proj = create_project("a", "Test", format_name="mid_16x9", base=tmp_path)
    proj.write_text("script.md", SCRIPT)
    from chronicle import writer

    writer.plan(proj, use_llm=False)
    data = proj.beats()
    data["beats"][0]["scene"] = {"template": "symbol", "icon": "crown", "label": "ROME"}
    data["beats"][1]["scene"] = {"template": "character", "cast": [{"who": "justinian", "say": "NOT SO FAST"}]}
    proj.save_beats(data)
    fmt = get_format("mid_16x9", {"width": 320, "height": 180, "fps": 10})
    tl = {"width": 320, "height": 180, "fps": 10, "duration": 2.0, "captions": [], "header": None, "sfx": [],
          "shots": [{"start": 0.0, "end": 1.0, "beat": 1, "transition": "cut"},
                    {"start": 1.0, "end": 2.0, "beat": 2, "transition": "flash"}]}
    out = tmp_path / "anim.mp4"
    info = render_animated(proj, fmt, tl, np.zeros(2 * SR, dtype=np.float32), {}, out, workers=2, preset="ultrafast",
                           log=lambda *_: None)
    assert info["errors"] == []
    dur = float(json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json",
                                           str(out)], capture_output=True, text=True).stdout)["format"]["duration"])
    assert abs(dur - 2.0) < 0.3
