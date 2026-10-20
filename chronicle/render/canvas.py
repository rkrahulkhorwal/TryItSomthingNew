"""Image layout (fill / card) and camera motion for one shot."""

from __future__ import annotations

import math

import cv2
import numpy as np
from PIL import Image


def load_rgb(path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"))


def ease_in_out(p: float) -> float:
    p = min(max(p, 0.0), 1.0)
    return 0.5 - 0.5 * math.cos(math.pi * p)


def resolve_layout(layout: str, img_w: int, img_h: int, W: int, H: int) -> str:
    if layout in ("fill", "card"):
        return layout
    # auto: fill when the aspects are close (crop loses < ~17 %), otherwise a centred card
    return "fill" if abs(math.log((img_w / img_h) / (W / H))) < 0.18 else "card"


def card_box(img_w: int, img_h: int, W: int, H: int, card_aspect: float | None = None,
             center_y: float | None = None) -> tuple[int, int, int, int]:
    """Where a card sits on the canvas: full width (minus margin) on tall canvases, a bit above centre.

    `card_aspect` (width / height) narrows a wide image to a taller window so it fills more of a vertical
    frame; the camera then frames the beat's focus point inside it.
    """
    m = int(round(0.04 * min(W, H)))
    max_w, max_h = W - 2 * m, H - 2 * m
    aspect = img_w / img_h
    if card_aspect and card_aspect < aspect:
        aspect = card_aspect
    bw = max_w
    bh = int(round(bw / aspect))
    if bh > max_h:
        bh = max_h
        bw = int(round(bh * aspect))
    x = (W - bw) // 2
    cy = (center_y if center_y is not None else (0.45 if H > W else 0.5)) * H
    y = int(round(cy - bh / 2))
    y = max(m, min(H - m - bh, y))
    return x, y, bw, bh


def rounded_mask(w: int, h: int, r: int) -> np.ndarray:
    mask = np.zeros((h, w), np.uint8)
    cv2.rectangle(mask, (r, 0), (w - r - 1, h - 1), 255, -1)
    cv2.rectangle(mask, (0, r), (w - 1, h - r - 1), 255, -1)
    for cx, cy in ((r, r), (w - r - 1, r), (r, h - r - 1), (w - r - 1, h - r - 1)):
        cv2.circle(mask, (cx, cy), r, 255, -1, lineType=cv2.LINE_AA)
    return mask


class ShotPainter:
    """Produces frames for one shot: the image placed by layout and moved by its camera path."""

    WIDE_TYPES = {"LINEUP", "CROWD", "ESTABLISHING", "TIMELINE", "MAP", "SPLIT", "INFOGRAPHIC", "CONFRONT"}

    def __init__(self, img: np.ndarray, W: int, H: int, layout: str, motion: dict, card: dict | None = None,
                 shot_type: str = "SCENE"):
        self.W, self.H = W, H
        ih, iw = img.shape[:2]
        self.layout = resolve_layout(layout, iw, ih, W, H)
        self.motion = motion
        card = card or {}
        if self.layout == "fill":
            self.box = (0, 0, W, H)
            self.bg = None
            self.mask = None
        else:
            self.box = card_box(iw, ih, W, H, card.get("aspect"), card.get("y"))
        # A cropped window would cut wide compositions in half: pan across the whole image instead.
        bw, bh = self.box[2], self.box[3]
        if shot_type in self.WIDE_TYPES and motion.get("move") not in ("static", "punch") and bw / bh < (iw / ih) * 0.9:
            fy = motion.get("c0", [0.5, 0.5])[1]
            a, b = (1.0, 0.0) if motion.get("move") == "pan_left" else (0.0, 1.0)
            motion = self.motion = {"move": "pan_across", "z0": 1.0, "z1": 1.0, "c0": [a, fy], "c1": [b, fy]}
        if self.layout != "fill":
            self.bg = self._card_background(img)
            x, y, bw, bh = self.box
            r = int(round(0.035 * min(W, H)))
            self.mask = (rounded_mask(bw, bh, r).astype(np.float32) / 255.0)[..., None]
        bx, by, bw, bh = self.box
        s_cover = max(bw / iw, bh / ih)
        zmax = max(float(motion.get("z0", 1.0)), float(motion.get("z1", 1.0)))
        s_pre = s_cover * zmax * 1.02
        interp = cv2.INTER_AREA if s_pre < 1 else cv2.INTER_CUBIC
        self.src = cv2.resize(img, (max(2, int(round(iw * s_pre))), max(2, int(round(ih * s_pre)))), interpolation=interp)
        self.s_base = s_cover / s_pre
        self.static = motion.get("move") == "static" or (
            motion.get("z0") == motion.get("z1") and motion.get("c0") == motion.get("c1"))
        self._static_frame = None

    def _card_background(self, img: np.ndarray) -> np.ndarray:
        W, H = self.W, self.H
        ih, iw = img.shape[:2]
        s = max(W / iw, H / ih)
        small = cv2.resize(img, (max(2, int(iw * s / 8)), max(2, int(ih * s / 8))), interpolation=cv2.INTER_AREA)
        small = cv2.GaussianBlur(small, (0, 0), 6)
        big = cv2.resize(small, (int(iw * s) + 2, int(ih * s) + 2), interpolation=cv2.INTER_LINEAR)
        ox, oy = (big.shape[1] - W) // 2, (big.shape[0] - H) // 2
        bg = big[oy:oy + H, ox:ox + W].astype(np.float32) * 0.5
        # soft shadow under the card
        x, y, bw, bh = self.box
        shadow = np.zeros((H, W), np.float32)
        off = int(0.012 * min(W, H))
        cv2.rectangle(shadow, (x + off, y + off * 2), (x + bw + off, y + bh + off * 2), 1.0, -1)
        shadow = cv2.GaussianBlur(shadow, (0, 0), 0.02 * min(W, H))
        bg *= (1.0 - 0.55 * shadow)[..., None]
        return np.clip(bg, 0, 255).astype(np.uint8)

    def _view(self, p: float) -> np.ndarray:
        m = self.motion
        e = ease_in_out(p) if m.get("move") != "punch" else p
        z = m["z0"] + (m["z1"] - m["z0"]) * e
        cx = m["c0"][0] + (m["c1"][0] - m["c0"][0]) * e
        cy = m["c0"][1] + (m["c1"][1] - m["c0"][1]) * e
        bx, by, bw, bh = self.box
        sh, sw = self.src.shape[:2]
        s = self.s_base * z
        half_w, half_h = bw / (2 * s), bh / (2 * s)
        cxp = min(max(cx * sw, half_w), sw - half_w)
        cyp = min(max(cy * sh, half_h), sh - half_h)
        M = np.float32([[s, 0, bw / 2 - s * cxp], [0, s, bh / 2 - s * cyp]])
        return cv2.warpAffine(self.src, M, (bw, bh), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)

    def frame(self, p: float) -> np.ndarray:
        if self.static and self._static_frame is not None:
            return self._static_frame
        view = self._view(p)
        if self.layout == "fill":
            out = view
        else:
            out = self.bg.copy()
            x, y, bw, bh = self.box
            region = out[y:y + bh, x:x + bw].astype(np.float32)
            out[y:y + bh, x:x + bw] = (region * (1 - self.mask) + view.astype(np.float32) * self.mask).astype(np.uint8)
        if self.static:
            self._static_frame = out
        return out
