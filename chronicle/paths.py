"""Locations of the repository's shared folders (configs, prompts, fonts, models)."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"
STYLES_DIR = CONFIG_DIR / "styles"
PROMPTS_DIR = ROOT / "prompts"
FONTS_DIR = ROOT / "assets" / "fonts"
MUSIC_DIR = ROOT / "assets" / "music"
MODELS_DIR = ROOT / "models"
PROJECTS_DIR = ROOT / "projects"


def resolve(path: str | Path, base: Path = ROOT) -> Path:
    """Resolve a path from a config file: absolute paths stay, relative ones are taken from `base`."""
    p = Path(path)
    return p if p.is_absolute() else (base / p)
