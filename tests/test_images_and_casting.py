import numpy as np
from PIL import Image

from chronicle.casting import wer
from chronicle.images import trim_frame


def test_trim_frame_removes_drawn_border(tmp_path):
    a = np.full((400, 700, 3), 230, np.uint8)       # light parchment
    a[20:24, 20:680] = 10                            # top frame line, inset 20 px
    a[376:380, 20:680] = 10                          # bottom
    a[20:380, 20:24] = 10                            # left
    a[20:380, 676:680] = 10                          # right
    a[150:250, 200:500] = 60                         # dark content in the middle must not matter
    p = tmp_path / "framed.png"
    Image.fromarray(a).save(p)
    top, right, bottom, left = trim_frame(p)
    assert all(m >= 24 for m in (top, right, bottom, left))
    assert Image.open(p).size[0] < 700


def test_trim_frame_keeps_dark_content(tmp_path):
    a = np.full((400, 700, 3), 20, np.uint8)         # a night sky running to the edge: no light margin
    a[300:, :] = 200                                 # sand
    p = tmp_path / "night.png"
    Image.fromarray(a).save(p)
    assert trim_frame(p)[0] == 0
    assert Image.open(p).size == (700, 400)


def test_wer():
    assert wer("the horse-drawn chariot", "the horse drawn chariot") > 0
    assert wer("Rome took Egypt.", "rome took egypt") == 0
