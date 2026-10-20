"""What the animation runtime can draw, read straight from its JavaScript so prompts never drift from the code."""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

RUNTIME = Path(__file__).parent / "runtime"


def _src(name: str) -> str:
    return (RUNTIME / name).read_text(encoding="utf-8")


def _block(src: str, start: str) -> str:
    i = src.index(start)
    depth, j = 0, src.index("{", i)
    for k in range(j, len(src)):
        depth += {"{": 1, "}": -1}.get(src[k], 0)
        if depth == 0:
            return src[j:k + 1]
    return src[j:]


def _keys(block: str) -> list[str]:
    # top-level keys of a JS object literal
    keys, depth = [], 0
    for m in re.finditer(r"[{}]|(?<![\w$.])([A-Za-z_]\w*)\s*:", block):
        tok = m.group(0)
        if tok == "{":
            depth += 1
        elif tok == "}":
            depth -= 1
        elif depth == 1:
            keys.append(m.group(1))
    return keys


@lru_cache(maxsize=1)
def catalog() -> dict:
    people, world, maps, scenes = _src("people.js"), _src("world.js"), _src("maps.js"), _src("scenes.js")
    return {
        "cast": _keys(_block(scenes, "CH.CAST = {")),
        "poses": _keys(_block(people, "const POSES = {")) + ["bow", "kneel", "fallen", "sit"],
        "expressions": _keys(_block(people, "const EXPR = {")),
        "settings": re.findall(r"'(\w+)'", re.search(r"const SETTINGS = \[(.*?)\];", scenes).group(1)),
        "views": _keys(_block(maps, "CH.VIEWS = {")),
        "regions": re.findall(r"^R\.(\w+) =", maps, re.M),
        "places": _keys(_block(maps, "CH.CITIES = {")),
        "icons": _keys(_block(world, "const ICONS = {")),
    }


def __getattr__(name):  # module-level lazy constants: catalog.REGIONS etc.
    if name.isupper() and name.lower() in catalog():
        return catalog()[name.lower()]
    raise AttributeError(name)


def prompt_vars() -> dict:
    c = catalog()
    return {
        "cast_presets": ", ".join(c["cast"]), "poses": ", ".join(c["poses"]), "expressions": ", ".join(c["expressions"]),
        "settings": ", ".join(c["settings"]), "views": ", ".join(c["views"]), "regions": ", ".join(c["regions"]),
        "places": ", ".join(c["places"]), "icons": ", ".join(c["icons"]),
    }
