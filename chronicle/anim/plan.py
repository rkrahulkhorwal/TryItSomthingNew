"""Scene planning for animated projects: one template spec per beat, written by the LLM (or by hand)."""

from __future__ import annotations

import json
import re

from chronicle.anim import catalog
from chronicle.llm import extract_json, get_llm, render_template
from chronicle.project import Project

TEMPLATES = {"character", "crowd", "battle", "naval", "city", "walls", "construction", "map", "cityplan", "number",
             "versus", "split", "symbol", "icons", "title", "timeline", "question", "stamp", "image", "cta", "collapse"}


def _beats_input(data: dict) -> str:
    chapters = {c["index"]: c for c in data["chapters"]}
    lines = []
    for b in data["beats"]:
        ch = chapters[b["chapter"]]
        card = f" [date card {ch['card']}]" if ch.get("card") and b["break"] == "chapter" else ""
        hint = f" (hint: {b['overlay']['kind']} {b['overlay']['text']})" if b.get("overlay") else ""
        lines.append(f"[{b['id']}] ch{b['chapter'] + 1} {ch['title']}{card}: {b['text']}{hint}")
    return "\n".join(lines)


def validate(scenes: dict, data: dict) -> list[str]:
    """Light checks; the runtime is tolerant, but unknown templates or missing beats are worth a warning."""
    warn = []
    ids = {b["id"] for b in data["beats"]}
    for bid in sorted(ids - set(scenes)):
        warn.append(f"beat {bid}: no scene")
    for bid, sc in scenes.items():
        if sc.get("template") not in TEMPLATES:
            warn.append(f"beat {bid}: unknown template {sc.get('template')!r}")
        for r in sc.get("regions", []) or []:
            if r.get("id") not in catalog.REGIONS:
                warn.append(f"beat {bid}: unknown region {r.get('id')!r}")
    imgs = [b for b, s in scenes.items() if s.get("template") == "image"]
    if len(imgs) > 12:
        warn.append(f"{len(imgs)} painted stills planned - that is a lot of paid images")
    return warn


def apply(proj: Project, scenes: dict) -> dict:
    data = proj.beats()
    for b in data["beats"]:
        sc = scenes.get(b["id"])
        if sc is None:
            continue
        b["scene"] = sc
        if sc.get("template") == "image":
            b["visual"] = sc.get("visual") or b.get("visual") or b["text"]
            b["shot_type"] = "SCENE" if b.get("shot_type") in ("NUMBER", "TITLE", "MAP", "TIMELINE") else b["shot_type"]
    from chronicle.style import compose_all_prompts

    compose_all_prompts(data, proj.style(), proj.format())
    data["planner_scenes"] = "llm"
    proj.save_beats(data)
    return data


def plan_scenes(proj: Project, image_budget: int = 6) -> tuple[dict, list[str]]:
    data = proj.beats()
    variables = {
        "topic": proj.brief().get("topic", ""),
        "image_budget": str(image_budget),
        "beats_input": _beats_input(data),
        **catalog.prompt_vars(),
    }
    system, user = render_template("07-scenes", variables)
    llm = get_llm(proj.settings(), proj.llm_dir, ledger=proj.ledger())
    raw = llm.complete(system, user, stage="scenes")
    answer = extract_json(raw)
    scenes = {int(s["id"]): s["scene"] for s in answer.get("scenes", [])}
    warn = validate(scenes, data)
    apply(proj, scenes)
    return scenes, warn


def load_scene_file(proj: Project, path) -> tuple[dict, list[str]]:
    """Apply a hand-written scene plan ({"scenes": [...]}) - the same format the LLM returns."""
    answer = json.loads(re.sub(r"^\s*//.*$", "", open(path, encoding="utf-8").read(), flags=re.M))
    scenes = {int(s["id"]): s["scene"] for s in answer.get("scenes", [])}
    warn = validate(scenes, proj.beats())
    apply(proj, scenes)
    return scenes, warn
