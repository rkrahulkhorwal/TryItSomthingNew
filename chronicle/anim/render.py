"""Animated renderer: headless Chromium draws every frame with the SVG runtime in ./runtime, ffmpeg encodes.

The runtime is deterministic (CH.renderAt(T) depends only on T), so the frame range is split into contiguous
chunks rendered by parallel browser processes; their H.264 segments are concatenated and muxed with the mixed,
loudness-normalised audio from chronicle.render.audio.
"""

from __future__ import annotations

import base64
import glob
import json
import math
import shutil
import sys
import os
import subprocess
import tempfile
import threading
import time
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from chronicle.paths import FONTS_DIR

RUNTIME = Path(__file__).parent / "runtime"


# ------------------------------------------------------------------------------------------------ local server
class _Handler(SimpleHTTPRequestHandler):
    roots: dict = {}

    def translate_path(self, path):
        path = urllib.parse.unquote(path.split("?", 1)[0].split("#", 1)[0])
        for prefix, root in self.roots.items():
            if path.startswith(prefix):
                root = Path(root).resolve()
                p = (root / path[len(prefix):]).resolve()
                if p == root or root in p.parents:
                    return str(p)
        return str(RUNTIME / "__missing__")

    def end_headers(self):
        self.send_header("Cache-Control", "max-age=3600")
        super().end_headers()

    def log_message(self, *args):  # quiet
        pass


class Server:
    """Serves the runtime, the fonts and the project folder on 127.0.0.1 (fonts and fetch() need http://)."""

    def __init__(self, project_root: Path):
        handler = type("Handler", (_Handler,), {"roots": {"/runtime/": RUNTIME, "/fonts/": FONTS_DIR,
                                                          "/project/": Path(project_root)}})
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def close(self):
        self.httpd.shutdown()


# ------------------------------------------------------------------------------------------------ browser
def chromium_path() -> str | None:
    if os.environ.get("CHRONICLE_CHROMIUM"):
        return os.environ["CHRONICLE_CHROMIUM"]
    roots = [os.environ.get("PLAYWRIGHT_BROWSERS_PATH", ""), "/opt/pw-browsers", str(Path.home() / ".cache/ms-playwright")]
    for root in filter(None, roots):
        for pattern in ("chromium_headless_shell-*/chrome-linux/headless_shell",
                        "chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell",
                        "chromium-*/chrome-linux/chrome", "chromium-*/chrome-linux64/chrome"):
            hits = sorted(glob.glob(os.path.join(root, pattern)))
            if hits:
                return hits[-1]
    return None


def launch(pw):
    args = ["--disable-gpu", "--font-render-hinting=none", "--disable-lcd-text", "--force-color-profile=srgb"]
    try:
        return pw.chromium.launch(args=args)
    except Exception:
        exe = chromium_path()
        if not exe:
            raise
        return pw.chromium.launch(executable_path=exe, args=args)


class RuntimePage:
    def __init__(self, browser, port: int, payload: dict):
        self.page = browser.new_page(viewport={"width": int(payload["width"]), "height": int(payload["height"])},
                                     device_scale_factor=1)
        self.errors: list[str] = []
        self.page.on("pageerror", lambda e: self.errors.append(f"pageerror: {e}"))
        self.page.on("console", lambda m: self.errors.append(f"console: {m.text}") if m.type == "error" else None)
        self.page.goto(f"http://127.0.0.1:{port}/runtime/index.html")
        self.page.evaluate("p => CH.init(p)", payload)
        info = self.page.evaluate("CH.prepare()")
        self.errors += info.get("errors", [])
        self.cdp = self.page.context.new_cdp_session(self.page)

    def frame(self, T: float, fmt: str = "jpeg", quality: int = 92) -> bytes:
        self.page.evaluate(f"CH.renderAt({T:.6f})")
        params = {"format": fmt, "optimizeForSpeed": True}
        if fmt == "jpeg":
            params["quality"] = quality
        return base64.b64decode(self.cdp.send("Page.captureScreenshot", params)["data"])

    def runtime_errors(self) -> list[str]:
        return self.errors + self.page.evaluate("CH.errors")


# ------------------------------------------------------------------------------------------------ payload
def build_payload(proj, fmt: dict, timeline: dict) -> dict:
    W, H = int(timeline["width"]), int(timeline["height"])
    beats = proj.beats()
    tag = "9x16" if H > W else ("1x1" if H == W else "16x9")
    out_beats = []
    for b in beats["beats"]:
        img = None
        for cand in (proj.images_dir / f"beat_{b['id']:03d}_{tag}.png", proj.image_path(b["id"])):
            if cand.exists():
                img = "/project/" + cand.relative_to(proj.root).as_posix() + f"?v={int(cand.stat().st_mtime)}"
                break
        scene = b.get("scene") or {}
        out_beats.append({"id": b["id"], "text": b["text"], "chapter": b["chapter"], "shot_type": b.get("shot_type"),
                          "scene": scene, "image": img if scene.get("template") == "image" else None,
                          "focus": b.get("focus")})
    cap = fmt.get("captions") or {}
    hdr = fmt.get("header") or {}
    return {
        "width": W, "height": H, "fps": int(timeline["fps"]), "duration": float(timeline["duration"]),
        "shots": [{k: s.get(k) for k in ("start", "end", "beat", "transition", "punch", "stamp", "shot_type")}
                  for s in timeline["shots"]],
        "beats": out_beats,
        "chapters": beats.get("chapters", []),
        "captions": timeline.get("captions") if cap.get("enabled") else [],
        "caption_y": float(cap.get("y", 0.75)), "caption_upper": bool(cap.get("uppercase", True)),
        "header": ({"text": timeline.get("header"), "until_s": float(hdr.get("until_s", 3.2)),
                    "persist": bool(hdr.get("persist"))} if hdr.get("enabled") and timeline.get("header") else None),
        "progress_bar": bool(fmt.get("progress_bar")),
    }


def preview_timeline(beats_data: dict, fmt: dict, words_per_s: float = 3.2) -> dict:
    """A timeline without voice: each beat lasts as long as its words would take (for previews)."""
    t, shots = 0.0, []
    for b in beats_data["beats"]:
        d = max(1.2, len(b["text"].split()) / words_per_s)
        shots.append({"start": t, "end": t + d, "beat": b["id"], "transition": b.get("transition", "cut"),
                      "shot_type": b.get("shot_type")})
        t += d
    return {"width": fmt["width"], "height": fmt["height"], "fps": fmt["fps"], "duration": t, "shots": shots,
            "captions": [], "header": None}


# ------------------------------------------------------------------------------------------------ workers
def _worker(job: dict) -> dict:
    from playwright.sync_api import sync_playwright

    payload = json.loads(Path(job["payload"]).read_text(encoding="utf-8"))
    fps = int(payload["fps"])
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", str(fps), "-i", "-",
           "-c:v", "libx264", "-preset", job["preset"], "-crf", str(job["crf"]), "-pix_fmt", "yuv420p",
           "-r", str(fps), "-g", str(fps * 4), job["out"]]
    t0 = time.time()
    with sync_playwright() as pw:
        browser = launch(pw)
        rp = RuntimePage(browser, job["port"], payload)
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        try:
            for i in range(job["start"], job["end"]):
                proc.stdin.write(rp.frame(i / fps, quality=job["quality"]))
                if job.get("progress") and (i - job["start"]) % (fps * 10) == 0:
                    print(f"    worker {job['k']}: {i / fps:6.1f}s", flush=True)
        finally:
            proc.stdin.close()
            rc = proc.wait()
        errors = rp.runtime_errors()
        browser.close()
    if rc != 0:
        raise RuntimeError(f"ffmpeg failed on segment {job['out']}")
    return {"k": job["k"], "frames": job["end"] - job["start"], "seconds": round(time.time() - t0, 1), "errors": errors}


def render_animated(proj, fmt: dict, timeline: dict, voice, style: dict, out_path: Path, *, music_path=None,
                    workers: int | None = None, crf: int = 18, preset: str = "medium", quality: int = 92,
                    log=print) -> dict:
    import numpy as np
    import soundfile as sf

    from chronicle.render.audio import SR, mix

    payload = build_payload(proj, fmt, timeline)
    fps = int(payload["fps"])
    n_frames = int(math.ceil(payload["duration"] * fps))
    workers = workers or max(1, min(6, (os.cpu_count() or 2) - 1))
    tmp = Path(tempfile.mkdtemp(prefix="chronicle_anim_"))
    (tmp / "payload.json").write_text(json.dumps(payload), encoding="utf-8")
    server = Server(proj.root)
    t0 = time.time()
    try:
        bounds = [round(k * n_frames / workers) for k in range(workers + 1)]
        jobs = [{"k": k, "port": server.port, "payload": str(tmp / "payload.json"), "start": bounds[k],
                 "end": bounds[k + 1], "out": str(tmp / f"seg_{k:02d}.mp4"), "crf": crf, "preset": preset,
                 "quality": quality, "progress": k == 0} for k in range(workers) if bounds[k + 1] > bounds[k]]
        log(f"  rendering {n_frames} frames ({payload['width']}x{payload['height']} @ {fps} fps) on {len(jobs)} browsers")
        procs = []
        for j in jobs:  # plain subprocesses: robust however the parent process was started
            jf = tmp / f"job_{j['k']:02d}.json"
            jf.write_text(json.dumps(j), encoding="utf-8")
            procs.append(subprocess.Popen([sys.executable, "-m", "chronicle.anim.render", str(jf)]))
        codes = [pr.wait() for pr in procs]
        if any(codes):
            raise RuntimeError(f"render workers failed with exit codes {codes}")
        results = [json.loads((tmp / f"job_{j['k']:02d}.json.result").read_text(encoding="utf-8")) for j in jobs]
    finally:
        server.close()
    errors = sorted({e for r in results for e in r["errors"]})
    for e in errors[:20]:
        log(f"  ! {e}")

    audio, audio_info = mix(voice, timeline, fmt, music_path)
    wav = tmp / "audio.wav"
    sf.write(wav, np.stack([audio, audio], axis=1), SR, subtype="FLOAT")
    tp = float((fmt.get("loudness") or {}).get("true_peak_db", -1.0))
    limit = 10 ** ((tp - 0.5) / 20)
    (tmp / "list.txt").write_text("".join(f"file '{j['out']}'\n" for j in jobs), encoding="utf-8")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(tmp / "list.txt"),
                    "-i", str(wav), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                    "-af", f"alimiter=limit={limit:.4f}:attack=5:release=60:level=0",
                    "-movflags", "+faststart", "-shortest", str(out_path)], check=True)
    shutil.rmtree(tmp, ignore_errors=True)
    return {"frames": n_frames, "workers": len(jobs), "seconds": round(time.time() - t0, 1),
            "errors": errors, "audio": audio_info}


# ------------------------------------------------------------------------------------------------ stills
def render_stills(proj, fmt: dict, timeline: dict, times: list[float], out_dir: Path, log=print) -> list[Path]:
    """PNG stills at the given global times (previews, thumbnails, style sheets)."""
    from playwright.sync_api import sync_playwright

    payload = build_payload(proj, fmt, timeline)
    out_dir.mkdir(parents=True, exist_ok=True)
    server = Server(proj.root)
    paths = []
    try:
        with sync_playwright() as pw:
            browser = launch(pw)
            rp = RuntimePage(browser, server.port, payload)
            for T in times:
                p = out_dir / f"still_{payload['width']}x{payload['height']}_{T:07.2f}.png"
                p.write_bytes(rp.frame(T, fmt="png"))
                paths.append(p)
            for e in rp.runtime_errors()[:20]:
                log(f"  ! {e}")
            browser.close()
    finally:
        server.close()
    return paths


if __name__ == "__main__":  # worker entry: python -m chronicle.anim.render job.json
    job_file = Path(sys.argv[1])
    res = _worker(json.loads(job_file.read_text(encoding="utf-8")))
    Path(str(job_file) + ".result").write_text(json.dumps(res), encoding="utf-8")
