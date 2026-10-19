"""Engine-drawn text: title / name / number / date / label cards, word-pop captions, header, progress bar."""

from __future__ import annotations

import textwrap
from functools import lru_cache

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from chronicle.paths import FONTS_DIR

FALLBACK_FONTS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]


@lru_cache(maxsize=64)
def get_font(name: str, size: int) -> ImageFont.FreeTypeFont:
    candidates = [FONTS_DIR / name] + [p for p in FALLBACK_FONTS]
    for c in candidates:
        try:
            return ImageFont.truetype(str(c), size)
        except OSError:
            continue
    return ImageFont.load_default(size)


def hex_rgba(h: str) -> tuple[int, int, int, int]:
    h = h.lstrip("#")
    if len(h) == 6:
        h += "ff"
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4, 6))


def _wrap_to_width(text: str, font: ImageFont.FreeTypeFont, max_w: int, max_lines: int = 2) -> list[str] | None:
    draw = ImageDraw.Draw(Image.new("L", (1, 1)))
    words = text.split()
    for n in range(1, max_lines + 1):
        lines = textwrap.wrap(text, width=max(1, int(len(text) / n + 0.999) + 2)) if n > 1 else [text]
        if len(lines) <= max_lines and all(draw.textlength(l, font=font) <= max_w for l in lines):
            return lines
    if len(words) == 1:
        return None
    return None


def outlined_text(text: str, font_name: str, size: int, fill: str, stroke: str, stroke_ratio: float,
                  max_w: int, shadow: str | None = None, max_lines: int = 2, align: str = "center") -> Image.Image:
    """Big cartoon lettering: fill + thick outline (+ soft drop shadow), auto-shrunk to fit max_w."""
    while True:
        font = get_font(font_name, size)
        lines = _wrap_to_width(text, font, max_w - int(size * stroke_ratio * 2), max_lines)
        if lines or size <= 14:
            lines = lines or [text]
            break
        size = int(size * 0.92)
    sw = max(1, int(round(size * stroke_ratio)))
    draw = ImageDraw.Draw(Image.new("L", (1, 1)))
    line_h = int(size * 1.08)
    widths = [draw.textlength(l, font=font) for l in lines]
    pad = sw + int(size * 0.12)
    w = int(max(widths)) + 2 * pad
    h = line_h * len(lines) + 2 * pad + int(size * 0.15)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    if shadow:
        sh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        for i, l in enumerate(lines):
            x = (w - widths[i]) / 2 if align == "center" else pad
            sd.text((x + size * 0.04, pad + i * line_h + size * 0.06), l, font=font, fill=hex_rgba(shadow),
                    stroke_width=sw, stroke_fill=hex_rgba(shadow))
        img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(size * 0.05)))
    d = ImageDraw.Draw(img)
    for i, l in enumerate(lines):
        x = (w - widths[i]) / 2 if align == "center" else pad
        d.text((x, pad + i * line_h), l, font=font, fill=hex_rgba(fill), stroke_width=sw, stroke_fill=hex_rgba(stroke))
    return img


def plate_text(text: str, font_name: str, size: int, fill: str, plate: str, plate_stroke: str, max_w: int,
               accent: str | None = None) -> Image.Image:
    """Text on a rounded parchment plate (date stamps, labels)."""
    while True:
        font = get_font(font_name, size)
        tw = ImageDraw.Draw(Image.new("L", (1, 1))).textlength(text, font=font)
        if tw <= max_w * 0.86 or size <= 14:
            break
        size = int(size * 0.92)
    bbox = font.getbbox(text)
    th = bbox[3] - bbox[1]
    px, py = int(size * 0.6), int(size * 0.38)
    marker = int(size * 0.5) if accent else 0
    w, h = int(tw) + 2 * px + (marker + int(size * 0.3) if accent else 0), th + 2 * py
    sw = max(2, int(size * 0.07))
    img = Image.new("RGBA", (w + 2 * sw + 8, h + 2 * sw + 10), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([sw + 6, sw + 8, sw + 6 + w, sw + 8 + h], radius=int(h * 0.28), fill=(0, 0, 0, 110))
    d.rounded_rectangle([sw, sw, sw + w, sw + h], radius=int(h * 0.28), fill=hex_rgba(plate), outline=hex_rgba(plate_stroke), width=sw)
    x = sw + px
    if accent:
        cy = sw + h / 2
        r = marker / 2
        d.polygon([(x + r, cy - r), (x + 2 * r, cy), (x + r, cy + r), (x, cy)], fill=hex_rgba(accent))
        x += marker + int(size * 0.3)
    d.text((x, sw + py - bbox[1]), text, font=font, fill=hex_rgba(fill))
    return img


def pil_to_rgba_np(img: Image.Image) -> np.ndarray:
    return np.asarray(img.convert("RGBA"))


def alpha_over(frame: np.ndarray, patch: np.ndarray, cx: float, cy: float, opacity: float = 1.0) -> None:
    """Composite an RGBA patch centred at (cx, cy) into an RGB frame, in place, clipped to the frame."""
    H, W = frame.shape[:2]
    ph, pw = patch.shape[:2]
    x0, y0 = int(round(cx - pw / 2)), int(round(cy - ph / 2))
    x1, y1 = x0 + pw, y0 + ph
    fx0, fy0, fx1, fy1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
    if fx0 >= fx1 or fy0 >= fy1:
        return
    p = patch[fy0 - y0:fy1 - y0, fx0 - x0:fx1 - x0].astype(np.float32)
    a = (p[..., 3:4] / 255.0) * opacity
    region = frame[fy0:fy1, fx0:fx1].astype(np.float32)
    frame[fy0:fy1, fx0:fx1] = (region * (1 - a) + p[..., :3] * a).astype(np.uint8)


def ease_out_back(p: float, k: float = 1.70158) -> float:
    p = min(max(p, 0.0), 1.0) - 1
    return 1 + (k + 1) * p ** 3 + k * p ** 2


class OverlayRenderer:
    """Renders the overlay card of a shot with a pop-in animation."""

    POP_S = 0.22

    def __init__(self, style: dict, W: int, H: int):
        self.typo = style.get("typography", {})
        self.W, self.H = W, H
        self.cache: dict = {}

    def patch(self, kind: str, text: str) -> np.ndarray:
        key = (kind, text)
        if key in self.cache:
            return self.cache[key]
        W, H = self.W, self.H
        base = min(W, H)
        t = self.typo.get(kind) or self.typo.get("title", {})
        if kind in ("title", "name"):
            img = outlined_text(text, t.get("font", "LuckiestGuy-Regular.ttf"), int(base * 0.115), t.get("fill", "#fff4dc"),
                                t.get("stroke", "#1a1512"), float(t.get("stroke_ratio", 0.075)), int(W * 0.88), t.get("shadow"))
        elif kind == "number":
            img = outlined_text(text, t.get("font", "Anton-Regular.ttf"), int(base * 0.15), t.get("fill", "#fff4dc"),
                                t.get("stroke", "#1a1512"), float(t.get("stroke_ratio", 0.06)), int(W * 0.9), t.get("shadow"))
        elif kind == "date":
            img = plate_text(text, t.get("font", "Cinzel-ExtraBold.ttf"), int(base * 0.085), t.get("fill", "#1a1512"),
                             t.get("plate", "#f3e3bd"), t.get("plate_stroke", "#1a1512"), int(W * 0.8), t.get("accent", "#b5452f"))
        else:  # label
            img = plate_text(text, t.get("font", "Montserrat-ExtraBold.ttf"), int(base * 0.055), t.get("fill", "#1a1512"),
                             t.get("plate", "#fff4dc"), t.get("plate_stroke", "#1a1512"), int(W * 0.8))
        arr = pil_to_rgba_np(img)
        self.cache[key] = arr
        return arr

    def anchor(self, kind: str, card_box: tuple | None, header_on: bool) -> tuple[float, float]:
        W, H = self.W, self.H
        if kind == "label":
            if card_box:
                x, y, bw, bh = card_box
                return W / 2, min(H * 0.93, y + bh + H * 0.05)
            return W / 2, H * 0.84
        if card_box:
            x, y, bw, bh = card_box
            return W / 2, max(H * (0.2 if header_on else 0.1), y - H * 0.065)
        if H > W:
            return W / 2, H * (0.25 if header_on else 0.17)
        return W / 2, H * 0.17

    def stamp_patch(self, text: str) -> np.ndarray:
        key = ("stamp", text)
        if key not in self.cache:
            t = self.typo.get("date", {})
            img = plate_text(text, t.get("font", "Cinzel-ExtraBold.ttf"), int(min(self.W, self.H) * 0.052),
                             t.get("fill", "#1a1512"), t.get("plate", "#f3e3bd"), t.get("plate_stroke", "#1a1512"),
                             int(self.W * 0.5), t.get("accent", "#b5452f"))
            self.cache[key] = pil_to_rgba_np(img)
        return self.cache[key]

    def draw_stamp(self, frame: np.ndarray, st: dict, t: float, card_box: tuple | None) -> str:
        """Chapter date stamp, bottom-left like a lower third (inside the card on card layouts)."""
        p = (t - st["start"]) / 0.18
        if p < 0:
            return "pre"
        patch = self.stamp_patch(st["text"])
        ph, pw = patch.shape[:2]
        m = 0.025 * min(self.W, self.H)
        if card_box:
            x, y, bw, bh = card_box
            cx, cy = x + m + pw / 2, y + bh - m - ph / 2
        else:
            cx, cy = 1.6 * m + pw / 2, self.H - 1.6 * m - ph / 2
        if p < 1:
            slide = (1 - ease_out_back(p)) * pw * 0.35
            alpha_over(frame, patch, cx - slide, cy, min(1.0, p * 2.0))
            return f"s{int(p * 100)}"
        alpha_over(frame, patch, cx, cy)
        return "son"

    def draw(self, frame: np.ndarray, ov: dict, t: float, card_box: tuple | None, header_on: bool) -> str:
        """Draw into frame; returns an animation-state key for frame de-duplication."""
        p = (t - ov["start"]) / self.POP_S
        if p < 0:
            return "pre"
        patch = self.patch(ov["kind"], ov["text"])
        cx, cy = self.anchor(ov["kind"], card_box, header_on)
        if p < 1:
            s = 0.55 + 0.45 * ease_out_back(p)
            ph, pw = patch.shape[:2]
            scaled = cv2.resize(patch, (max(1, int(pw * s)), max(1, int(ph * s))), interpolation=cv2.INTER_LINEAR)
            alpha_over(frame, scaled, cx, cy, min(1.0, p * 2.2))
            return f"anim{int(p * 100)}"
        alpha_over(frame, patch, cx, cy)
        return "on"


class CaptionRenderer:
    """Word-by-word captions: the current word is highlighted, each new group pops in."""

    def __init__(self, style: dict, cfg: dict, W: int, H: int):
        t = style.get("typography", {}).get("caption", {})
        self.font_name = t.get("font", "Montserrat-ExtraBold.ttf")
        self.fill, self.stroke, self.active = t.get("fill", "#ffffff"), t.get("stroke", "#111111"), t.get("active", "#ffcf3f")
        self.stroke_ratio = float(t.get("stroke_ratio", 0.12))
        self.upper = bool(cfg.get("uppercase", True))
        self.y = float(cfg.get("y", 0.72))
        self.W, self.H = W, H
        self.size = int(min(W, H) * 0.078)
        self.cache: dict = {}

    def _render(self, words: list[str], active: int) -> np.ndarray:
        key = (tuple(words), active)
        if key in self.cache:
            return self.cache[key]
        size = self.size
        while True:
            font = get_font(self.font_name, size)
            d = ImageDraw.Draw(Image.new("L", (1, 1)))
            space = d.textlength(" ", font=font)
            widths = [d.textlength(w, font=font) for w in words]
            total = sum(widths) + space * (len(words) - 1)
            if total <= self.W * 0.86 or size < 20:
                break
            size = int(size * 0.92)
        sw = max(2, int(size * self.stroke_ratio))
        pad = sw + 6
        img = Image.new("RGBA", (int(total) + 2 * pad, int(size * 1.3) + 2 * pad), (0, 0, 0, 0))
        dd = ImageDraw.Draw(img)
        x = pad
        for i, (w, wd) in enumerate(zip(words, widths)):
            col = self.active if i == active else self.fill
            dd.text((x, pad), w, font=font, fill=hex_rgba(col), stroke_width=sw, stroke_fill=hex_rgba(self.stroke))
            x += wd + space
        arr = np.asarray(img)
        self.cache[key] = arr
        return arr

    def draw(self, frame: np.ndarray, group: dict, t: float) -> str:
        words = [w["w"].upper() if self.upper else w["w"] for w in group["words"]]
        words = [w.strip() for w in words]
        active = -1
        for i, w in enumerate(group["words"]):
            if t >= w["s"] - 0.02:
                active = i
        patch = self._render(words, active)
        p = (t - group["show_from"]) / 0.09
        cy = self.H * self.y
        if p < 1:
            s = 0.86 + 0.14 * ease_out_back(max(p, 0))
            ph, pw = patch.shape[:2]
            alpha_over(frame, cv2.resize(patch, (max(1, int(pw * s)), max(1, int(ph * s)))), self.W / 2, cy)
            return f"{id(group)}:{active}:{int(p * 10)}"
        alpha_over(frame, patch, self.W / 2, cy)
        return f"{id(group)}:{active}"


class HeaderRenderer:
    """Big title for the opening seconds, then (optionally) a small persistent title at the top."""

    FADE = 0.25

    def __init__(self, style: dict, text: str, W: int, H: int, persist: bool = False):
        t = style.get("typography", {}).get("header", {})
        self.patch = pil_to_rgba_np(outlined_text(text, t.get("font", "LuckiestGuy-Regular.ttf"), int(min(W, H) * 0.085),
                                                  t.get("fill", "#ffffff"), t.get("stroke", "#111111"),
                                                  float(t.get("stroke_ratio", 0.09)), int(W * 0.9), "#00000099", 3))
        self.small = None
        if persist:
            self.small = pil_to_rgba_np(outlined_text(text, t.get("font", "LuckiestGuy-Regular.ttf"), int(min(W, H) * 0.048),
                                                      t.get("fill", "#ffffff"), t.get("stroke", "#111111"),
                                                      float(t.get("stroke_ratio", 0.09)), int(W * 0.8), "#00000099", 2))
        self.W, self.H = W, H

    def state(self, t: float, until: float):
        big = 1.0 if t < until - self.FADE else max(0.0, (until - t) / self.FADE)
        small = 0.0 if self.small is None else min(1.0, max(0.0, (t - (until - self.FADE)) / self.FADE))
        return round(big, 2), round(small, 2)

    def draw(self, frame: np.ndarray, t: float, until: float) -> None:
        big, small = self.state(t, until)
        if big > 0:
            alpha_over(frame, self.patch, self.W / 2, self.H * 0.115 + self.patch.shape[0] * 0.25, big)
        if small > 0:
            alpha_over(frame, self.small, self.W / 2, self.H * 0.045 + self.small.shape[0] / 2, small * 0.95)


def draw_progress(frame: np.ndarray, t: float, duration: float) -> int:
    H, W = frame.shape[:2]
    h = max(6, int(H * 0.006))
    frame[:h] = (frame[:h].astype(np.float32) * 0.45).astype(np.uint8)
    x = int(W * min(1.0, t / max(duration, 1e-6)))
    frame[:h, :x] = (255, 207, 63)
    return x
