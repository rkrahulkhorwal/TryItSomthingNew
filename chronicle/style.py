"""Compose a full image prompt per beat: house style + shot template + characters + composition hints."""

from __future__ import annotations

NO_PEOPLE_TYPES = {"MAP", "TIMELINE", "SYMBOL", "LANDMARK"}

ASPECT_HINT = {
    "16:9": "Wide 16:9 landscape composition.",
    "9:16": "Tall 9:16 vertical composition: stack the subject vertically, keep the key action in the middle third, "
            "leave calm space at the top and bottom for captions.",
    "1:1": "Square composition with the subject centred.",
    "4:5": "Portrait 4:5 composition with the subject centred.",
}

OVERLAY_HINT = {
    "title": "Leave a calm, uncluttered band across the top third for a large title.",
    "name": "Leave calm empty space above the character's head for a name.",
    "number": "Leave a calm empty band across the top third for a big number.",
    "date": "Keep the area just below the marker empty for a date.",
    "label": "Make the key object large and clear so a label can sit next to it.",
}


def compose_prompt(beat: dict, style: dict, fmt: dict, characters: dict) -> str:
    shot = beat.get("shot_type", "SCENE")
    template = (style.get("shot_templates") or {}).get(shot, "{visual}")
    visual = (beat.get("visual") or beat.get("text") or "").strip().rstrip(".")
    parts = [style.get("style_prompt", "").strip(), template.replace("{visual}", visual)]
    if shot not in NO_PEOPLE_TYPES:
        parts.append(style.get("character_recipe", "").strip())
    for key in beat.get("characters") or []:
        desc = characters.get(key)
        if desc:
            parts.append(f"{key.replace('_', ' ').title()}: {desc}.")
    overlay = beat.get("overlay") or {}
    if fmt.get("overlays", True) and overlay.get("kind") in OVERLAY_HINT:
        parts.append(OVERLAY_HINT[overlay["kind"]])
    parts.append(ASPECT_HINT.get(str(fmt.get("image_aspect", "16:9")), ""))
    parts.append(style.get("suffix", "").strip())
    return " ".join(p for p in parts if p)


def compose_all_prompts(data: dict, style: dict, fmt: dict) -> dict:
    chars = data.get("characters") or {}
    for beat in data["beats"]:
        beat["image_prompt"] = compose_prompt(beat, style, fmt, chars)
    data["negative_prompt"] = style.get("negative", "")
    data["image_aspect"] = fmt.get("image_aspect", "16:9")
    return data
