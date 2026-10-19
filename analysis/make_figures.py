"""Regenerate the teardown charts in docs/assets from analysis/data (python analysis/make_figures.py)."""
import csv
import json
import sys
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyBboxPatch
REPO = sys.argv[1] if len(sys.argv) > 1 else str(Path(__file__).resolve().parent.parent)
OUT = f"{REPO}/docs/assets"
SURF, INK, INK2, MUTED, GRID, BASE = "#fcfcfb", "#0b0b0b", "#52514e", "#898781", "#e1e0d9", "#c3c2b7"
FAM_COL = {"Literal scene": "#2a78d6", "Text & orientation": "#eb6834", "Concept & explainer": "#1baf7a"}
plt.rcParams.update({"font.family": "Inter", "font.size": 10, "axes.edgecolor": BASE, "axes.labelcolor": INK2,
                     "xtick.color": MUTED, "ytick.color": MUTED, "text.color": INK, "axes.facecolor": SURF,
                     "figure.facecolor": SURF, "savefig.facecolor": SURF, "axes.titleweight": "semibold",
                     "axes.titlesize": 12, "axes.titlecolor": INK, "axes.titlelocation": "left"})
shots = list(csv.DictReader(open(f"{REPO}/analysis/data/shots.csv")))
for s in shots:
    for k in ("start_s", "end_s", "dur_s"): s[k] = float(s[k])
chap = list(csv.DictReader(open(f"{REPO}/analysis/data/chapters.csv")))
au = json.load(open(f"{REPO}/analysis/data/audio_profile.json"))
au["pauses"] = au["pauses_s"]
def clean(ax, grid_axis="y"):
    for sp in ("top", "right", "left"): ax.spines[sp].set_visible(False)
    ax.spines["bottom"].set_color(BASE)
    ax.grid(axis=grid_axis, color=GRID, linewidth=0.8); ax.set_axisbelow(True)
    ax.tick_params(length=0)

# ---------- Fig 1: the edit, shot by shot ----------
fig = plt.figure(figsize=(13, 5.2))
gs = fig.add_gridspec(2, 1, height_ratios=[1, 2.3], hspace=0.08)
ax0 = fig.add_subplot(gs[0]); ax1 = fig.add_subplot(gs[1], sharex=ax0)
for s in shots:
    ax0.add_patch(Rectangle((s["start_s"], 0), max(s["dur_s"] - 0.9, 0.3), 1, color=FAM_COL[s["family"]], lw=0))
ax0.set_ylim(0, 1); ax0.set_yticks([]); ax0.set_xlim(0, 733)
for sp in ax0.spines.values(): sp.set_visible(False)
ax0.tick_params(labelbottom=False, length=0)
SHORT = ["1 Hook", "2 Founding", "3 Republic", "4 Punic Wars", "5 Fall of Republic", "6 Empire", "7 3rd-c. crisis", "8 Fall of West", "9 Byzantium", "10 Legacy + CTA"]
for i, c in enumerate(chap):
    a = float(c["start"]); lvl = 1.04 if i % 2 == 0 else 1.24
    ax0.axvline(a, color=INK, lw=0.8, ymin=0, ymax=lvl + 0.1, clip_on=False)
    ax0.text(a + 3, lvl, SHORT[i], fontsize=7.8, color=INK2, va="bottom", ha="left", clip_on=False)
ax0.set_title("The edit, shot by shot: 200 static illustrations, a new one every 3.66 s", pad=58)
# durations
x = [s["start_s"] + s["dur_s"] / 2 for s in shots]; y = [s["dur_s"] for s in shots]
cols = [FAM_COL[s["family"]] for s in shots]
ax1.vlines(x, 0, y, colors=cols, lw=2.2)
ax1.scatter(x, y, s=16, c=cols, edgecolors=SURF, linewidths=1.2, zorder=3)
med = float(np.median(y)); ax1.axhline(med, color=INK2, lw=1)
ax1.text(735, med, f"  median {med:.2f} s", va="center", fontsize=8.5, color=INK2)
clean(ax1); ax1.set_ylabel("Shot length (s)"); ax1.set_xlabel("Video time (s)"); ax1.set_ylim(0, 7.2)
for c in chap: ax1.axvline(float(c["start"]), color=GRID, lw=0.8, zorder=0)
notes = [(35.2, "flash transition\n+ first date card"), (557, "\"twist\": the\nstory continues"), (721, "CTA card")]
for t, lab in notes:
    ax1.annotate(lab, xy=(t, 0.15), xytext=(t, 6.55), fontsize=7.5, color=INK2, ha="center", va="top",
                 arrowprops=dict(arrowstyle="-", color=MUTED, lw=0.7))
handles = [Rectangle((0, 0), 1, 1, color=v) for v in FAM_COL.values()]
ax1.legend(handles, [f"{k} ({sum(s['family']==k for s in shots)})" for k in FAM_COL], loc="upper center", ncol=3, frameon=False,
           bbox_to_anchor=(0.5, -0.2), fontsize=9)
fig.savefig(f"{OUT}/fig1-edit-timeline.png", dpi=160, bbox_inches="tight"); plt.close(fig)

# ---------- Fig 2: shot types ----------
from collections import Counter, OrderedDict
cnt = Counter(s["shot_type"] for s in shots); fam_of = {s["shot_type"]: s["family"] for s in shots}
items = sorted(cnt.items(), key=lambda kv: kv[1])
fig, ax = plt.subplots(figsize=(8.6, 6.6))
yy = np.arange(len(items))
ax.barh(yy, [v for _, v in items], height=0.62, color=[FAM_COL[fam_of[k]] for k, _ in items])
for i, (k, v) in enumerate(items):
    ax.text(v + 0.8, i, f"{v}  ({100*v/200:.1f}%)", va="center", fontsize=8.5, color=INK2)
ax.set_yticks(yy); ax.set_yticklabels([("CTA" if k == "CTA" else k.replace("_", " ").title()) for k, _ in items], fontsize=9, color=INK2)
clean(ax, "x"); ax.set_xlabel("Number of shots (of 200)"); ax.set_xlim(0, 90)
ax.set_title("What each shot shows: 38% plain story scenes, 62% spread over 19 other shot types")
ax.legend([Rectangle((0, 0), 1, 1, color=v) for v in FAM_COL.values()], list(FAM_COL), loc="lower right", frameon=False, fontsize=9)
fig.savefig(f"{OUT}/fig2-shot-types.png", dpi=160, bbox_inches="tight"); plt.close(fig)

# ---------- Fig 3: cuts sit in the pauses (zoom 35-65 s) ----------
db = np.array(au["envelope_dbfs"]); tt = np.arange(len(db)) * au["envelope_hop_s"] + au["envelope_hop_s"] / 2
a, b = 35, 65
m = (tt >= a) & (tt <= b)
fig, ax = plt.subplots(figsize=(13, 3.6))
for p0, p1 in au["pauses"]:
    if p1 >= a and p0 <= b: ax.axvspan(max(p0, a), min(p1, b), color="#e9e7df", lw=0)
ax.plot(tt[m], np.maximum(db[m], -60), color=INK2, lw=1.2)
first = True
for s in shots:
    if a < s["start_s"] < b:
        ax.axvline(s["start_s"], color="#eb6834", lw=2)
clean(ax); ax.set_xlim(a, b); ax.set_ylim(-62, 0); ax.set_ylabel("Voice level (dBFS)"); ax.set_xlabel("Video time (s)")
ax.set_title("Cut on the breath: 88% of cuts fall inside a pause, about 0.19 s before the next word")
from matplotlib.lines import Line2D
ax.legend([Line2D([0], [0], color=INK2, lw=1.2), Rectangle((0, 0), 1, 1, color="#e9e7df"), Line2D([0], [0], color="#eb6834", lw=2)],
          ["voice-over level (50 ms RMS)", "pause (< -50 dBFS)", "picture cut"], loc="lower center", ncol=3, frameon=False,
          bbox_to_anchor=(0.5, -0.42), fontsize=9)
fig.savefig(f"{OUT}/fig3-cuts-in-pauses.png", dpi=160, bbox_inches="tight"); plt.close(fig)

# ---------- Fig 4: small multiples of timing distributions ----------
leads = np.array([float(s["next_word_lead_s"]) for s in shots if s["next_word_lead_s"] not in ("", None)])
pauses = np.array([p1 - p0 for p0, p1 in au["pauses"]])
fig, axs = plt.subplots(1, 3, figsize=(13, 3.4))
specs = [(np.array([s["dur_s"] for s in shots]), np.arange(0.5, 7.01, 0.25), "Shot length (s)", "How long each picture stays up"),
         (pauses, np.arange(0.05, 0.9, 0.05), "Pause length (s)", "Pauses between phrases are short"),
         (leads[(leads >= -0.1) & (leads <= 0.6)], np.arange(-0.1, 0.61, 0.025), "Next word starts after the cut (s)", "Picture leads the voice")]
for ax, (data, bins, xl, title) in zip(axs, specs):
    ax.hist(data, bins=bins, color="#2a78d6", rwidth=0.82)
    md = float(np.median(data)); ax.axvline(md, color=INK, lw=1)
    clean(ax); ax.set_xlabel(xl); ax.set_title(f"{title}  (median {md:.2f} s)", fontsize=10.5)
axs[0].set_ylabel("Count")
fig.tight_layout(); fig.savefig(f"{OUT}/fig4-timing-distributions.png", dpi=160, bbox_inches="tight"); plt.close(fig)

# ---------- Fig 5: chapter map (time share) ----------
fig, ax = plt.subplots(figsize=(13, 1.6))
for i, c in enumerate(chap):
    s0, d = float(c["start"]), float(c["dur"])
    ax.add_patch(Rectangle((s0, 0), d - 2, 1, color="#2a78d6" if i % 2 == 0 else "#86b6ef", lw=0))
    ax.text(s0 + d / 2, 0.5, f"{SHORT[i]}\n{int(d)} s", ha="center", va="center", fontsize=7.4,
            color="white" if i % 2 == 0 else INK)
ax.set_xlim(0, 733); ax.set_ylim(0, 1); ax.set_yticks([])
for sp in ("top", "right", "left"): ax.spines[sp].set_visible(False)
ax.tick_params(length=0); ax.set_xlabel("Video time (s)")
ax.set_title("Chapter map: a 35 s hook, eight story acts, a 99 s 'why it matters' payoff")
fig.savefig(f"{OUT}/fig5-chapter-map.png", dpi=160, bbox_inches="tight"); plt.close(fig)
print("ok")
