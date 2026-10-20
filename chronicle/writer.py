"""Writing stages: research -> outline -> script -> beat plan -> packaging (LLM), with a no-LLM fallback for beats."""

from __future__ import annotations

from chronicle.llm import extract_json, get_llm, render_template
from chronicle.project import Project
from chronicle.style import compose_all_prompts
from chronicle.text import OVERLAY_KIND, SHOT_TYPES, parse_script, plan_beats


def duration_label(seconds: float) -> str:
    if seconds < 90:
        return f"{int(round(seconds))} seconds"
    minutes = seconds / 60
    return f"{minutes:.0f} minutes" if abs(minutes - round(minutes)) < 0.1 else f"{minutes:.1f} minutes"


def template_vars(proj: Project) -> dict:
    b = proj.brief()
    fmt = proj.format()
    style = proj.style()
    dur = float(b.get("duration_s") or fmt["duration_s"])
    wpm = float(fmt["wpm"])
    hook_s = max(3, round(dur * float(fmt.get("hook_share", 0.05))))
    return {
        "topic": b.get("topic", ""),
        "title": b.get("title", ""),
        "audience": b.get("audience", ""),
        "angle": b.get("angle", "") or "(none)",
        "notes": b.get("notes", "") or "",
        "duration_s": str(int(dur)),
        "duration_label": duration_label(dur),
        "wpm": str(int(wpm)),
        "target_words": str(int(round(dur / 60 * wpm))),
        "hook_seconds": str(hook_s),
        "hook_words": str(int(round(hook_s / 60 * wpm))),
        "chapters_min": str(fmt.get("chapters", {}).get("min_count", 3)),
        "chapters_max": str(fmt.get("chapters", {}).get("max_count", 10)),
        "format_label": fmt.get("label", fmt["name"]),
        "aspect": fmt.get("image_aspect", "16:9"),
        "research": proj.read_text("research.md") or "(no research file - rely on well-established facts and flag anything uncertain)",
        "outline": proj.read_text("outline.md") or "(no outline - plan it yourself following the proven shape)",
        "script": proj.read_text("script.md") or "",
        "style_prompt": style.get("style_prompt", ""),
        "character_recipe": style.get("character_recipe", ""),
    }


def _run(proj: Project, template: str, stage: str, extra: dict | None = None, json_schema: dict | None = None) -> str:
    variables = template_vars(proj)
    variables.update(extra or {})
    system, user = render_template(template, variables)
    llm = get_llm(proj.settings(), proj.llm_dir)
    return llm.complete(system, user, json_schema=json_schema, stage=stage)


def research(proj: Project) -> str:
    out = _run(proj, "01-research", "research")
    proj.write_text("research.md", out.strip() + "\n")
    return out


def outline(proj: Project) -> str:
    out = _run(proj, "02-outline", "outline")
    proj.write_text("outline.md", out.strip() + "\n")
    return out


def write_script(proj: Project) -> str:
    out = _run(proj, "03-script", "script").strip()
    if out.startswith("```"):
        out = out.strip("`").split("\n", 1)[1] if "\n" in out else out
        out = out.rsplit("```", 1)[0]
    proj.write_text("script.md", out.strip() + "\n")
    return out


def review(proj: Project) -> str:
    out = _run(proj, "06-retention-review", "review")
    proj.write_text("review.md", out.strip() + "\n")
    return out


BEATS_SCHEMA = {
    "type": "object",
    "properties": {
        "characters": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"key": {"type": "string"}, "description": {"type": "string"}},
                "required": ["key", "description"],
                "additionalProperties": False,
            },
        },
        "beats": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "shot_type": {"type": "string", "enum": SHOT_TYPES},
                    "visual": {"type": "string"},
                    "overlay_text": {"type": "string"},
                    "characters": {"type": "array", "items": {"type": "string"}},
                    "focus_x": {"type": "number"},
                    "focus_y": {"type": "number"},
                },
                "required": ["id", "shot_type", "visual", "overlay_text", "characters", "focus_x", "focus_y"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["characters", "beats"],
    "additionalProperties": False,
}


def _beats_input(plan: dict, ids: set[int]) -> str:
    chapters = {c["index"]: c for c in plan["chapters"]}
    lines = []
    for b in plan["beats"]:
        if b["id"] not in ids:
            continue
        ch = chapters[b["chapter"]]
        card = f", date card {ch['card']}" if ch.get("card") and b["break"] == "chapter" else ""
        lines.append(f"[{b['id']}] (chapter {b['chapter'] + 1}: {ch['title']}{card}; {b['break']}) {b['text']}")
    return "\n".join(lines)


def apply_visual_plan(plan: dict, answer: dict) -> dict:
    by_id = {b["id"]: b for b in answer.get("beats", [])}
    for beat in plan["beats"]:
        a = by_id.get(beat["id"])
        if not a:
            continue
        beat["shot_type"] = a["shot_type"] if a["shot_type"] in SHOT_TYPES else beat["shot_type"]
        beat["visual"] = a.get("visual") or beat["visual"]
        kind = OVERLAY_KIND.get(beat["shot_type"])
        text = (a.get("overlay_text") or "").strip()
        beat["overlay"] = {"kind": kind, "text": text.upper()} if (kind and text) else None
        beat["characters"] = a.get("characters") or []
        fx, fy = a.get("focus_x"), a.get("focus_y")
        if isinstance(fx, (int, float)) and isinstance(fy, (int, float)):
            beat["focus"] = [min(max(float(fx), 0.0), 1.0), min(max(float(fy), 0.0), 1.0)]
    return plan


def plan(proj: Project, *, use_llm: bool = True, chunk: int = 120) -> dict:
    """Segment script.md into beats (rules), then let the LLM art-direct each beat (if enabled)."""
    script_md = proj.read_text("script.md")
    if not script_md:
        raise FileNotFoundError(f"{proj.script_path} is missing - write it by hand or run `chronicle write`")
    script = parse_script(script_md)
    fmt = proj.format()
    data = plan_beats(script, fmt)
    brief = proj.brief()
    data["characters"] = dict(brief.get("characters") or {})
    if use_llm:
        ids = [b["id"] for b in data["beats"]]
        for start in range(0, len(ids), chunk):
            part = set(ids[start:start + chunk])
            known = "\n".join(f"- {k}: {v}" for k, v in data["characters"].items())
            extra = {"beats_input": _beats_input(data, part) + (
                f"\n\nRecurring characters already defined (reuse these keys):\n{known}" if known else "")}
            raw = _run(proj, "04-beats", f"beats_{start // chunk + 1}", extra=extra, json_schema=BEATS_SCHEMA)
            answer = extract_json(raw)
            for c in answer.get("characters", []):
                data["characters"].setdefault(c["key"], c["description"])
            apply_visual_plan(data, answer)
        data["planner"] = "llm"
    compose_all_prompts(data, proj.style(), fmt)
    proj.save_beats(data)
    return data


def package(proj: Project, chapters_text: str) -> str:
    out = _run(proj, "05-packaging", "packaging", extra={"chapters": chapters_text})
    proj.write_text("out/packaging.md", out.strip() + "\n")
    return out
