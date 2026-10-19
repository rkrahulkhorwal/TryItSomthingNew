"""A project is a folder. Every stage reads and writes plain files, so any step can be edited by hand.

projects/<slug>/
  brief.yaml          topic, format, style, providers, overrides
  research.md         (optional) fact sheet
  outline.md          (optional) act plan
  script.md           narration with chapter headings and optional directives
  beats.json          one entry per picture: text, shot type, visual, overlay, prompt
  audio/              per-beat TTS clips (beat_001.wav ...) + clips.json
  images/             per-beat illustrations (beat_001.png ...)
  out/                renders, subtitles, chapters, packaging
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

from chronicle.config import deep_merge, get_defaults, get_format, get_style
from chronicle.paths import PROJECTS_DIR


def slugify(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower()).strip("-")
    return s[:60] or "project"


class Project:
    def __init__(self, root: str | Path):
        root = Path(root)
        if not root.exists() and (PROJECTS_DIR / str(root)).exists():
            root = PROJECTS_DIR / str(root)
        self.root = root.resolve()

    # ------------------------------------------------------------------ paths
    @property
    def brief_path(self) -> Path:
        return self.root / "brief.yaml"

    @property
    def script_path(self) -> Path:
        return self.root / "script.md"

    @property
    def beats_path(self) -> Path:
        return self.root / "beats.json"

    @property
    def audio_dir(self) -> Path:
        return self.root / "audio"

    @property
    def images_dir(self) -> Path:
        return self.root / "images"

    @property
    def out_dir(self) -> Path:
        return self.root / "out"

    @property
    def llm_dir(self) -> Path:
        return self.root / "llm"

    def path(self, name: str) -> Path:
        return self.root / name

    def ensure_dirs(self) -> None:
        for d in (self.root, self.audio_dir, self.images_dir, self.out_dir):
            d.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------ brief
    def brief(self) -> dict:
        if not self.brief_path.exists():
            raise FileNotFoundError(f"{self.brief_path} not found - create the project with `chronicle new`")
        with open(self.brief_path, encoding="utf-8") as f:
            return yaml.safe_load(f) or {}

    def save_brief(self, brief: dict) -> None:
        self.ensure_dirs()
        with open(self.brief_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(brief, f, sort_keys=False, allow_unicode=True, width=110)

    def format(self, name: str | None = None) -> dict:
        b = self.brief()
        fmt_name = name or b.get("format", "long_16x9")
        overrides = (b.get("format_overrides") or {}).get(fmt_name, {})
        fmt = get_format(fmt_name, overrides)
        if name is None and b.get("duration_s"):
            fmt["duration_s"] = float(b["duration_s"])
        return fmt

    def style(self) -> dict:
        b = self.brief()
        style = get_style(b.get("style", "ink_cartoon"))
        return deep_merge(style, b.get("style_overrides") or {})

    def settings(self) -> dict:
        """Provider settings: config/defaults.yaml merged with the brief's `providers:` block."""
        return get_defaults(self.brief().get("providers") or {})

    # ------------------------------------------------------------------ text files
    def read_text(self, name: str) -> str | None:
        p = self.root / name
        return p.read_text(encoding="utf-8") if p.exists() else None

    def write_text(self, name: str, text: str) -> Path:
        p = self.root / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
        return p

    # ------------------------------------------------------------------ json files
    def read_json(self, name: str):
        p = self.root / name
        if not p.exists():
            return None
        with open(p, encoding="utf-8") as f:
            return json.load(f)

    def write_json(self, name: str, data) -> Path:
        p = self.root / name
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return p

    def beats(self) -> dict:
        data = self.read_json("beats.json")
        if not data:
            raise FileNotFoundError(f"{self.beats_path} not found - run `chronicle plan` first")
        return data

    def save_beats(self, data: dict) -> None:
        self.write_json("beats.json", data)

    def image_path(self, beat_id: int) -> Path:
        return self.images_dir / f"beat_{beat_id:03d}.png"

    def audio_path(self, beat_id: int) -> Path:
        return self.audio_dir / f"beat_{beat_id:03d}.wav"


def create_project(slug: str, topic: str, *, format_name: str = "long_16x9", style: str = "ink_cartoon",
                   duration_s: float | None = None, title: str | None = None, audience: str = "",
                   angle: str = "", base: Path | None = None) -> Project:
    root = (base or PROJECTS_DIR) / slugify(slug)
    proj = Project(root)
    if proj.brief_path.exists():
        raise FileExistsError(f"{proj.brief_path} already exists")
    fmt = get_format(format_name)
    brief = {
        "topic": topic,
        "title": title or "",
        "format": format_name,
        "duration_s": duration_s or fmt["duration_s"],
        "style": style,
        "audience": audience or "curious general audience, 16-45, watching on a phone or TV",
        "angle": angle,
        "language": "en",
        "notes": "",
        "providers": {},
        "format_overrides": {},
        "style_overrides": {},
        "characters": {},
    }
    proj.save_brief(brief)
    return proj
