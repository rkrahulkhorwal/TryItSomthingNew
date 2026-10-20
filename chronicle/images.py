"""Image providers. One image per beat, saved as images/beat_###.png.

placeholder  offline animatic cards (no cost) - review timing and shot mix before paying for images
folder       use your own files (Midjourney, an artist, stock): images_in/beat_###.(png|jpg|webp)
openai       gpt-image models          env OPENAI_API_KEY
gemini       Gemini image models       env GEMINI_API_KEY
replicate    Flux / Ideogram / Recraft env REPLICATE_API_TOKEN
openrouter   any OpenRouter image model (Gemini, GPT image...)  env OPENROUTER_API_KEY, priced against budget_usd
"""

from __future__ import annotations

import base64
import io
import os
import shutil
import textwrap
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from chronicle.paths import FONTS_DIR

ASPECT_SIZES = {"16:9": (1536, 864), "9:16": (864, 1536), "1:1": (1080, 1080), "4:5": (1080, 1350)}
OPENAI_SIZES = {"16:9": "1536x1024", "9:16": "1024x1536", "1:1": "1024x1024", "4:5": "1024x1536"}


def _frame_margin(lines: "np.ndarray") -> int:
    """lines: per-row (or per-column) fraction of dark pixels, ordered from the image edge inward.

    A drawn frame is a thin run of rows that are dark across almost the whole edge, with a light margin
    between it and the edge. Dark *content* (a night sky, mud) has no light margin, so it is left alone.
    """
    import numpy as np

    n = len(lines)
    for r in range(2, n - 1):
        if lines[r] > 0.8 and np.all(lines[: max(1, r - 1)] < 0.25):
            end = r
            while end + 1 < n and lines[end + 1] > 0.5:
                end += 1
            if end - r <= 10:  # thin line, not a dark band
                return end + 3
    return 0


def trim_frame(path: Path) -> tuple[int, int, int, int]:
    """Crop away a drawn border that image models sometimes add despite 'no frame border'."""
    import numpy as np

    img = Image.open(path).convert("RGB")
    g = np.asarray(img.convert("L"), dtype=np.float32)
    h, w = g.shape
    band_h, band_w = int(h * 0.08), int(w * 0.08)
    dark = g < 90
    top = _frame_margin(dark[:band_h, int(w * .1):int(w * .9)].mean(axis=1))
    bottom = _frame_margin(dark[::-1][:band_h, int(w * .1):int(w * .9)].mean(axis=1))
    left = _frame_margin(dark[int(h * .1):int(h * .9), :band_w].mean(axis=0))
    right = _frame_margin(dark[int(h * .1):int(h * .9), ::-1][:, :band_w].mean(axis=0))
    if any((top, bottom, left, right)):
        img.crop((left, top, w - right, h - bottom)).save(path)
    return top, right, bottom, left


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    for candidate in (FONTS_DIR / name, Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")):
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default(size)


class PlaceholderImages:
    """Draws an animatic card: shot type, overlay text and the visual description."""

    FAMILY_COLOR = {"scene": "#2a78d6", "text": "#eb6834", "concept": "#1baf7a"}
    FAMILY = {**{t: "scene" for t in ("SCENE", "ESTABLISHING", "CROWD", "LINEUP", "CONFRONT", "LANDMARK", "REACTION")},
              **{t: "text" for t in ("MAP", "TIMELINE", "TITLE", "NUMBER", "CHARACTER_INTRO", "CALLOUT", "CTA")},
              **{t: "concept" for t in ("METAPHOR", "SYMBOL", "INFOGRAPHIC", "SPLIT", "BUBBLE", "MODERN")}}

    def __init__(self, cfg: dict | None = None):
        self.cfg = cfg or {}

    def generate(self, beat: dict, out_path: Path, aspect: str) -> Path:
        w, h = ASPECT_SIZES.get(aspect, (1536, 864))
        img = Image.new("RGB", (w, h), "#efe3c6")
        d = ImageDraw.Draw(img)
        # parchment vignette
        for i in range(0, 40):
            d.rectangle([i, i, w - 1 - i, h - 1 - i], outline=(226 - i, 208 - i, 167 - i))
        m = int(min(w, h) * 0.05)
        d.rounded_rectangle([m, m, w - m, h - m], radius=m // 2, outline="#1a1512", width=max(4, m // 8))
        shot = beat.get("shot_type", "SCENE")
        col = self.FAMILY_COLOR[self.FAMILY.get(shot, "scene")]
        f_badge = font("Montserrat-ExtraBold.ttf", int(min(w, h) * 0.045))
        badge = f"#{beat['id']}  {shot.replace('_', ' ')}"
        bw = d.textlength(badge, font=f_badge)
        d.rounded_rectangle([m * 2, m * 2, m * 2 + bw + m, m * 2 + int(min(w, h) * 0.075)], radius=m // 3, fill=col)
        d.text((m * 2 + m // 2, m * 2 + int(min(w, h) * 0.012)), badge, font=f_badge, fill="white")
        ov = (beat.get("overlay") or {}).get("text")
        y = m * 2 + int(min(w, h) * 0.12)
        if ov:  # the engine draws the real card; just note it here
            f_ov = font("Montserrat-SemiBold.ttf", int(min(w, h) * 0.032))
            d.text((w / 2, y), f"card: {ov}", font=f_ov, fill="#8a7a66", anchor="ma")
            y += int(min(w, h) * 0.07)
        f_body = font("Montserrat-SemiBold.ttf", int(min(w, h) * 0.04))
        chars = max(18, int((w - 4 * m) / (f_body.size * 0.55)))
        lines = textwrap.wrap(beat.get("visual") or beat.get("text", ""), chars)[:9]
        for line in lines:
            d.text((w / 2, y), line, font=f_body, fill="#3a3028", anchor="ma")
            y += int(f_body.size * 1.35)
        f_vo = font("Montserrat-SemiBold.ttf", int(min(w, h) * 0.03))
        vo = textwrap.shorten("VO: " + beat.get("text", ""), width=int(chars * 1.3))
        d.text((w / 2, h - m * 2), vo, font=f_vo, fill="#6b5d4f", anchor="md")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(out_path)
        return out_path


class FolderImages:
    def __init__(self, cfg: dict, project_root: Path):
        self.dir = project_root / cfg.get("dir", "images_in")

    def generate(self, beat: dict, out_path: Path, aspect: str) -> Path:
        # aspect-specific files first (beat_012_9x16.jpg), then the plain one (beat_012.jpg)
        for stem in dict.fromkeys([out_path.stem, f"beat_{beat['id']:03d}"]):
            for ext in ("png", "jpg", "jpeg", "webp"):
                src = self.dir / f"{stem}.{ext}"
                if src.exists():
                    Image.open(src).convert("RGB").save(out_path)
                    return out_path
        raise FileNotFoundError(f"no image for beat {beat['id']} in {self.dir} (expected {out_path.stem}.png)")


def _retry(fn, tries=4):
    for attempt in range(tries):
        try:
            return fn()
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(2 ** (attempt + 1))


class OpenAIImages:
    URL = "https://api.openai.com/v1/images/generations"

    def __init__(self, cfg: dict):
        import requests

        self.requests = requests
        self.key = os.environ.get("OPENAI_API_KEY")
        if not self.key:
            raise RuntimeError("set OPENAI_API_KEY")
        self.cfg = cfg

    def generate(self, beat: dict, out_path: Path, aspect: str) -> Path:
        body = {"model": self.cfg.get("model", "gpt-image-1"), "prompt": beat["image_prompt"],
                "size": OPENAI_SIZES.get(aspect, "1536x1024"), "quality": self.cfg.get("quality", "medium"), "n": 1}

        def call():
            r = self.requests.post(self.URL, json=body, headers={"Authorization": f"Bearer {self.key}"}, timeout=300)
            if r.status_code != 200:
                raise RuntimeError(f"OpenAI images HTTP {r.status_code}: {r.text[:300]}")
            return r.json()

        data = _retry(call)["data"][0]
        raw = base64.b64decode(data["b64_json"]) if data.get("b64_json") else self.requests.get(data["url"], timeout=120).content
        Image.open(io.BytesIO(raw)).convert("RGB").save(out_path)
        return out_path


class GeminiImages:
    URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    def __init__(self, cfg: dict):
        import requests

        self.requests = requests
        self.key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not self.key:
            raise RuntimeError("set GEMINI_API_KEY")
        self.cfg = cfg

    def generate(self, beat: dict, out_path: Path, aspect: str) -> Path:
        body = {"contents": [{"parts": [{"text": beat["image_prompt"]}]}],
                "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": aspect}}}

        def call():
            r = self.requests.post(self.URL.format(model=self.cfg.get("model", "gemini-2.5-flash-image")), json=body,
                                   headers={"x-goog-api-key": self.key}, timeout=300)
            if r.status_code != 200:
                raise RuntimeError(f"Gemini HTTP {r.status_code}: {r.text[:300]}")
            for part in r.json()["candidates"][0]["content"]["parts"]:
                inline = part.get("inlineData") or part.get("inline_data")
                if inline:
                    return base64.b64decode(inline["data"])
            raise RuntimeError("Gemini returned no image part")

        Image.open(io.BytesIO(_retry(call))).convert("RGB").save(out_path)
        return out_path


class ReplicateImages:
    URL = "https://api.replicate.com/v1/models/{model}/predictions"

    def __init__(self, cfg: dict):
        import requests

        self.requests = requests
        self.key = os.environ.get("REPLICATE_API_TOKEN")
        if not self.key:
            raise RuntimeError("set REPLICATE_API_TOKEN")
        self.cfg = cfg

    def generate(self, beat: dict, out_path: Path, aspect: str) -> Path:
        body = {"input": {"prompt": beat["image_prompt"], "aspect_ratio": aspect, "output_format": "png"}}
        headers = {"Authorization": f"Bearer {self.key}", "Prefer": "wait"}

        def call():
            r = self.requests.post(self.URL.format(model=self.cfg.get("model", "black-forest-labs/flux-1.1-pro")),
                                   json=body, headers=headers, timeout=300)
            if r.status_code not in (200, 201):
                raise RuntimeError(f"Replicate HTTP {r.status_code}: {r.text[:300]}")
            pred = r.json()
            while pred.get("status") not in ("succeeded", "failed", "canceled"):
                time.sleep(2)
                pred = self.requests.get(pred["urls"]["get"], headers=headers, timeout=60).json()
            if pred["status"] != "succeeded":
                raise RuntimeError(f"Replicate prediction {pred['status']}: {pred.get('error')}")
            out = pred["output"]
            return self.requests.get(out[0] if isinstance(out, list) else out, timeout=120).content

        Image.open(io.BytesIO(_retry(call))).convert("RGB").save(out_path)
        return out_path


class OpenRouterImages:
    """Image models through OpenRouter chat completions (`modalities: [image, text]`).

    `reference` (optional, path relative to the project) is sent with every prompt as a style sheet, so the
    generated stills match the look of the engine-drawn scenes around them.
    """

    def __init__(self, cfg: dict, project_root: Path, ledger=None):
        from chronicle.openrouter import OpenRouter

        self.cfg = cfg
        self.client = OpenRouter(ledger)
        self.model = cfg.get("model", "google/gemini-3.1-flash-image")
        ref = cfg.get("reference")
        self.reference = (project_root / ref) if ref else None

    def generate(self, beat: dict, out_path: Path, aspect: str) -> Path:
        from chronicle.openrouter import data_url, estimate_tokens

        prompt = beat["image_prompt"]
        content: list = [{"type": "text", "text": prompt}]
        if self.reference is not None and self.reference.exists():
            content = [{"type": "text", "text": "Style reference: match this drawing style, line work, palette and "
                                                "character design exactly. Do not copy its layout or its scene."},
                       {"type": "image_url", "image_url": {"url": data_url(self.reference)}},
                       {"type": "text", "text": prompt}]
        price = self.client.pricing(self.model)
        reserve = (estimate_tokens(prompt) * price.get("prompt", 0) + 1600 * price.get("image", 0)
                   + 2500 * price.get("image_output", price.get("completion", 0)) + 600 * price.get("completion", 0))
        body = {"model": self.model, "messages": [{"role": "user", "content": content}],
                "modalities": ["image", "text"], "image_config": {"aspect_ratio": aspect}}
        data = self.client.chat(body, stage=f"image_{beat['id']:03d}", reserve=reserve, timeout=300)
        msg = data["choices"][0]["message"]
        for im in msg.get("images") or []:
            url = (im.get("image_url") or {}).get("url", "")
            if url.startswith("data:"):
                raw = base64.b64decode(url.split(",", 1)[1])
                out_path.parent.mkdir(parents=True, exist_ok=True)
                Image.open(io.BytesIO(raw)).convert("RGB").save(out_path)
                return out_path
        raise RuntimeError(f"{self.model} returned no image for beat {beat['id']}: {str(msg.get('content'))[:200]}")


def get_image_provider(settings: dict, project_root: Path, name: str | None = None, ledger=None):
    cfg = settings.get("images", {})
    provider = name or cfg.get("provider", "placeholder")
    sub = cfg.get(provider, {}) or {}
    if provider == "placeholder":
        return PlaceholderImages(sub)
    if provider == "folder":
        return FolderImages(sub, project_root)
    if provider == "openai":
        return OpenAIImages(sub)
    if provider == "gemini":
        return GeminiImages(sub)
    if provider == "replicate":
        return ReplicateImages(sub)
    if provider == "openrouter":
        return OpenRouterImages(sub, project_root, ledger)
    raise ValueError(f"unknown image provider '{provider}'")


def export_prompt_sheet(beats: dict, out_csv: Path) -> Path:
    """CSV of every prompt, for manual generation in Midjourney / ChatGPT / an artist brief."""
    import csv

    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        wr = csv.writer(f)
        wr.writerow(["file", "shot_type", "overlay", "narration", "prompt", "negative"])
        for b in beats["beats"]:
            wr.writerow([f"beat_{b['id']:03d}.png", b["shot_type"], (b.get("overlay") or {}).get("text", ""), b["text"],
                         b.get("image_prompt", ""), beats.get("negative_prompt", "")])
    return out_csv


def copy_if_exists(src: Path, dst: Path) -> bool:
    if src.exists():
        shutil.copyfile(src, dst)
        return True
    return False
