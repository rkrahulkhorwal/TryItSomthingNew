"""Loading of format presets, style presets and provider defaults (with `extends:` inheritance)."""

from __future__ import annotations

import copy
from pathlib import Path

import yaml

from chronicle.paths import CONFIG_DIR, STYLES_DIR


def deep_merge(base: dict, over: dict) -> dict:
    """Recursively merge `over` into a copy of `base` (dicts merge, everything else replaces)."""
    out = copy.deepcopy(base)
    for k, v in (over or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = copy.deepcopy(v)
    return out


def load_yaml(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _resolve_extends(name: str, table: dict, seen: tuple = ()) -> dict:
    if name not in table:
        raise KeyError(f"unknown preset '{name}'. Available: {', '.join(sorted(table))}")
    if name in seen:
        raise ValueError(f"circular 'extends' chain: {' -> '.join(seen + (name,))}")
    entry = table[name]
    parent = entry.get("extends")
    if parent:
        merged = deep_merge(_resolve_extends(parent, table, seen + (name,)), entry)
    else:
        merged = copy.deepcopy(entry)
    merged.pop("extends", None)
    return merged


def list_formats() -> dict[str, str]:
    table = load_yaml(CONFIG_DIR / "formats.yaml")["presets"]
    return {k: _resolve_extends(k, table).get("label", "") for k in table}


def get_format(name: str, overrides: dict | None = None) -> dict:
    table = load_yaml(CONFIG_DIR / "formats.yaml")["presets"]
    fmt = _resolve_extends(name, table)
    fmt = deep_merge(fmt, overrides or {})
    fmt["name"] = name
    return fmt


def list_styles() -> list[str]:
    return sorted(p.stem for p in STYLES_DIR.glob("*.yaml"))


def get_style(name: str) -> dict:
    table = {p.stem: load_yaml(p) for p in STYLES_DIR.glob("*.yaml")}
    style = _resolve_extends(name, table)
    style["name"] = name
    return style


def get_defaults(overrides: dict | None = None) -> dict:
    return deep_merge(load_yaml(CONFIG_DIR / "defaults.yaml"), overrides or {})


def aspect_ratio(fmt: dict) -> float:
    return fmt["width"] / fmt["height"]


def parse_aspect(text: str) -> float:
    a, b = str(text).split(":")
    return float(a) / float(b)
