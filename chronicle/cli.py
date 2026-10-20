"""Command line: python -m chronicle <command> ...

  setup     download fonts / local voice model / whisper model
  formats   list output presets          styles    list visual styles
  new       create a project             research  outline  write  review   (LLM writing stages)
  plan      script.md -> beats.json      voice     beats -> voice clips
  images    beats -> illustrations       render    timeline + mp4 per format
  package   titles/description/chapters  run       every stage in order
  analyze   reverse-engineer a reference video
  status    what is done / missing in a project
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from chronicle import __version__


def _proj(arg: str):
    from chronicle.project import Project

    return Project(arg)


def cmd_setup(a):
    import subprocess

    from chronicle.paths import FONTS_DIR, MODELS_DIR

    if a.fonts or a.all:
        import re
        import urllib.request

        FONTS_DIR.mkdir(parents=True, exist_ok=True)
        fonts = {"LuckiestGuy-Regular": "Luckiest+Guy", "Bangers-Regular": "Bangers", "Anton-Regular": "Anton",
                 "Montserrat-ExtraBold": "Montserrat:wght@800", "Montserrat-SemiBold": "Montserrat:wght@600",
                 "Cinzel-ExtraBold": "Cinzel:wght@800", "PatrickHand-Regular": "Patrick+Hand"}
        for fname, family in fonts.items():
            dst = FONTS_DIR / f"{fname}.ttf"
            if dst.exists():
                continue
            css = urllib.request.urlopen(f"https://fonts.googleapis.com/css2?family={family}", timeout=30).read().decode()
            url = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", css).group(1)
            dst.write_bytes(urllib.request.urlopen(url, timeout=60).read())
            print(f"font: {dst.name}")
        print(f"fonts ready in {FONTS_DIR} (SIL Open Font License / Apache 2.0, from Google Fonts)")
    if a.kokoro or a.all:
        d = MODELS_DIR / "kokoro"
        d.mkdir(parents=True, exist_ok=True)
        base = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
        for name in ("kokoro-v1.0.onnx", "voices-v1.0.bin"):
            if not (d / name).exists():
                print(f"downloading {name} ...")
                subprocess.run(["curl", "-sSL", "-o", str(d / name), base + name], check=True)
        print(f"kokoro voice model ready in {d}")
    if a.anim or a.all:
        import io
        import tarfile
        import urllib.request

        from chronicle.paths import ROOT

        vendor = ROOT / "chronicle" / "anim" / "runtime" / "vendor"
        vendor.mkdir(parents=True, exist_ok=True)
        wanted = {  # npm package -> files to keep (all ISC; Natural Earth data is public domain)
            "d3@7.9.0": ["package/dist/d3.min.js", "package/LICENSE"],
            "topojson-client@3.1.0": ["package/dist/topojson-client.min.js", "package/LICENSE"],
            "world-atlas@2.0.2": ["package/land-50m.json", "package/LICENSE"],
        }
        for spec, files in wanted.items():
            name, ver = spec.split("@")
            if all((vendor / f"{name}-{Path(f).name}").exists() for f in files):
                continue
            url = f"https://registry.npmjs.org/{name}/-/{name}-{ver}.tgz"
            data = urllib.request.urlopen(url, timeout=60).read()
            with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
                for f in files:
                    (vendor / f"{name}-{Path(f).name}").write_bytes(tar.extractfile(f).read())
            print(f"anim vendor: {spec}")
        print(f"animation libraries ready in {vendor}")
    if a.whisper or a.all:
        from faster_whisper import WhisperModel

        WhisperModel("base.en", device="cpu", compute_type="int8")
        print("whisper base.en ready")


def cmd_formats(a):
    from chronicle.config import list_formats

    for k, v in list_formats().items():
        print(f"{k:24s} {v}")


def cmd_styles(a):
    from chronicle.config import get_style, list_styles

    for s in list_styles():
        print(f"{s:20s} {get_style(s).get('label', '')}")


def cmd_new(a):
    from chronicle.project import create_project

    p = create_project(a.slug, a.topic, format_name=a.format, style=a.style, duration_s=a.duration,
                       title=a.title, angle=a.angle or "", base=Path(a.dir) if a.dir else None)
    if a.script:
        p.write_text("script.md", Path(a.script).read_text(encoding="utf-8"))
    print(f"created {p.root}\n  next: edit brief.yaml, then `python -m chronicle run {p.root}` "
          f"(or write script.md yourself and run `plan`)")


def cmd_research(a):
    from chronicle import writer

    writer.research(_proj(a.project))
    print("wrote research.md")


def cmd_outline(a):
    from chronicle import writer

    writer.outline(_proj(a.project))
    print("wrote outline.md")


def cmd_write(a):
    from chronicle import writer
    from chronicle.text import parse_script, script_stats

    p = _proj(a.project)
    writer.write_script(p)
    st = script_stats(parse_script(p.read_text("script.md")), float(p.format()["wpm"]))
    print(f"wrote script.md: {st}")


def cmd_review(a):
    from chronicle import writer

    writer.review(_proj(a.project))
    print("wrote review.md")


def cmd_plan(a):
    from chronicle import writer
    from chronicle.text import SHOT_TYPES

    p = _proj(a.project)
    data = writer.plan(p, use_llm=not a.rules)
    from collections import Counter

    mix = Counter(b["shot_type"] for b in data["beats"])
    print(f"beats.json: {len(data['beats'])} beats ({data['planner']}); shot mix: "
          + ", ".join(f"{k} {mix[k]}" for k in SHOT_TYPES if mix.get(k)))


def cmd_scenes(a):
    from chronicle.anim import plan

    p = _proj(a.project)
    if a.file:
        scenes, warn = plan.load_scene_file(p, a.file)
    else:
        scenes, warn = plan.plan_scenes(p, image_budget=a.images)
    for w in warn:
        print(f"  ! {w}")
    from collections import Counter

    mix = Counter(s.get("template") for s in scenes.values())
    print(f"scenes: {len(scenes)} planned; " + ", ".join(f"{k} {v}" for k, v in mix.most_common()))


def cmd_still(a):
    from chronicle import pipeline
    from chronicle.anim.render import preview_timeline, render_stills

    p = _proj(a.project)
    data = p.beats()
    ids = [int(x) for x in a.beats.split(",")] if a.beats else [b["id"] for b in data["beats"]]
    for name in (a.formats.split(",") if a.formats else [p.brief().get("format", "long_16x9")]):
        fmt = p.format(name)
        try:
            tl, _ = pipeline.timeline(p, name)
        except (FileNotFoundError, RuntimeError):
            tl = preview_timeline(data, fmt)
        spans = {}
        for s in tl["shots"]:
            sp = spans.setdefault(s["beat"], [s["start"], s["end"]])
            sp[0], sp[1] = min(sp[0], s["start"]), max(sp[1], s["end"])
        times = [spans[i][0] + (spans[i][1] - spans[i][0]) * a.at for i in ids if i in spans]
        out = Path(a.out) if a.out else p.out_dir / "stills"
        paths = render_stills(p, fmt, tl, times, out)
        print(f"{name}: {len(paths)} stills in {out}")


def cmd_voice(a):
    from chronicle import pipeline

    p = _proj(a.project)
    if a.provider:
        _override(p, "tts", a.provider)
    pipeline.voice(p, force=a.force)


def cmd_images(a):
    from chronicle import pipeline

    only = [int(x) for x in a.only.split(",")] if a.only else None
    pipeline.images(_proj(a.project), provider=a.provider, only=only, force=a.force)


def cmd_render(a):
    from chronicle import pipeline

    p = _proj(a.project)
    formats = a.formats.split(",") if a.formats else None
    preset = a.preset or ("veryfast" if a.fast else "medium")
    crf = a.crf if a.crf is not None else (23 if a.fast else 19)
    pipeline.render(p, formats, preset=preset, crf=crf, workers=a.workers)


def cmd_package(a):
    from chronicle import pipeline

    out = pipeline.package(_proj(a.project), a.format, use_llm=not a.no_llm)
    print(f"wrote {out}")


def cmd_run(a):
    from chronicle import pipeline, writer
    from chronicle.llm import ManualStepRequired

    p = _proj(a.project)
    stages = ["research", "outline", "write", "plan", "voice", "images", "render", "package"]
    start = stages.index(a.start) if a.start else 0
    try:
        for st in stages[start:]:
            print(f"== {st}")
            if st == "research" and not p.read_text("research.md") and not a.no_llm:
                writer.research(p)
            elif st == "outline" and not p.read_text("outline.md") and not a.no_llm:
                writer.outline(p)
            elif st == "write" and not p.read_text("script.md"):
                if a.no_llm:
                    raise SystemExit("script.md is missing and --no-llm was given: write script.md by hand first")
                writer.write_script(p)
            elif st == "plan" and (not p.beats_path.exists() or a.replan):
                writer.plan(p, use_llm=not a.no_llm)
            elif st == "voice":
                pipeline.voice(p)
            elif st == "images":
                pipeline.images(p)
            elif st == "render":
                pipeline.render(p, a.formats.split(",") if a.formats else None)
            elif st == "package":
                pipeline.package(p, use_llm=not a.no_llm)
    except ManualStepRequired as e:
        print(f"\n{e}")
        sys.exit(2)


def cmd_analyze(a):
    from chronicle.analyze import analyze

    analyze(Path(a.video), Path(a.audio) if a.audio else None, Path(a.out), whisper_model=None if a.no_speech else a.whisper)


def cmd_cast(a):
    import json

    from chronicle.casting import cast
    from chronicle.paths import MODELS_DIR

    target = {}
    if a.f0:
        target["f0_hz"] = a.f0
    if a.pitch_sd:
        target["pitch_sd_st"] = a.pitch_sd
    if a.wpm:
        target["wpm"] = a.wpm
    rows = cast(MODELS_DIR / "kokoro", Path(a.out), voices=a.voices.split(",") if a.voices else None, target=target)
    (Path(a.out) / "casting.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
    best = rows[0]
    print(f"\nput this in brief.yaml -> providers: {{tts: {{provider: kokoro, kokoro: {{voice: {best['voice']}, "
          f"speed: {best['speed']}}}}}}}  (listen to the samples in {a.out} first)")


def cmd_status(a):
    p = _proj(a.project)
    b = p.brief()
    print(f"project: {p.root}\n  topic: {b.get('topic')}\n  format: {b.get('format')}  style: {b.get('style')}")
    for name in ("research.md", "outline.md", "script.md", "beats.json", "audio/clips.json"):
        print(f"  {'✓' if (p.root / name).exists() else '·'} {name}")
    if p.beats_path.exists():
        beats = p.beats()["beats"]
        have = sum(p.image_path(x["id"]).exists() for x in beats)
        print(f"  images: {have}/{len(beats)}")
    for f in sorted(p.out_dir.glob("*.mp4")):
        print(f"  ✓ {f.relative_to(p.root)}")
    ledger = p.ledger()
    if ledger.data["calls"]:
        print("  spend (paid API calls):")
        print(ledger.summary())


def _override(p, section: str, provider: str):
    b = p.brief()
    b.setdefault("providers", {}).setdefault(section, {})["provider"] = provider
    p.save_brief(b)


def main(argv=None):
    ap = argparse.ArgumentParser(prog="chronicle", description="Illustrated explainer video pipeline")
    ap.add_argument("--version", action="version", version=__version__)
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("setup", help="download fonts / models")
    s.add_argument("--fonts", action="store_true")
    s.add_argument("--kokoro", action="store_true")
    s.add_argument("--whisper", action="store_true")
    s.add_argument("--anim", action="store_true", help="d3 + topojson + Natural Earth for the animation engine")
    s.add_argument("--all", action="store_true")
    s.set_defaults(fn=cmd_setup)

    sub.add_parser("formats", help="list format presets").set_defaults(fn=cmd_formats)
    sub.add_parser("styles", help="list visual styles").set_defaults(fn=cmd_styles)

    s = sub.add_parser("new", help="create a project")
    s.add_argument("slug")
    s.add_argument("--topic", required=True)
    s.add_argument("--format", default="long_16x9")
    s.add_argument("--style", default="ink_cartoon")
    s.add_argument("--duration", type=float, help="target seconds (default: the format's)")
    s.add_argument("--title")
    s.add_argument("--angle")
    s.add_argument("--script", help="start from an existing script.md")
    s.add_argument("--dir", help="parent folder for the project (default: projects/)")
    s.set_defaults(fn=cmd_new)

    for name, fn, hlp in (("research", cmd_research, "LLM fact sheet"), ("outline", cmd_outline, "LLM act plan"),
                          ("write", cmd_write, "LLM script"), ("review", cmd_review, "LLM retention review")):
        s = sub.add_parser(name, help=hlp)
        s.add_argument("project")
        s.set_defaults(fn=fn)

    s = sub.add_parser("plan", help="script.md -> beats.json")
    s.add_argument("project")
    s.add_argument("--rules", action="store_true", help="no LLM: rule-based shot types")
    s.set_defaults(fn=cmd_plan)

    s = sub.add_parser("scenes", help="animated projects: plan one living illustration per beat (LLM or --file)")
    s.add_argument("project")
    s.add_argument("--file", help="apply a hand-written scene plan (same JSON the LLM returns)")
    s.add_argument("--images", type=int, default=6, help="painted stills the planner may use")
    s.set_defaults(fn=cmd_scenes)

    s = sub.add_parser("still", help="animated projects: render preview stills")
    s.add_argument("project")
    s.add_argument("--beats", help="comma-separated beat ids (default: all)")
    s.add_argument("--formats")
    s.add_argument("--at", type=float, default=0.6, help="position inside each beat, 0..1")
    s.add_argument("--out")
    s.set_defaults(fn=cmd_still)

    s = sub.add_parser("voice", help="synthesise the voice-over")
    s.add_argument("project")
    s.add_argument("--provider", choices=["kokoro", "elevenlabs", "openai", "edge", "silent"])
    s.add_argument("--force", action="store_true")
    s.set_defaults(fn=cmd_voice)

    s = sub.add_parser("images", help="generate illustrations")
    s.add_argument("project")
    s.add_argument("--provider", choices=["placeholder", "folder", "openai", "gemini", "replicate"])
    s.add_argument("--only", help="comma-separated beat ids")
    s.add_argument("--force", action="store_true")
    s.set_defaults(fn=cmd_images)

    s = sub.add_parser("render", help="render one or more formats")
    s.add_argument("project")
    s.add_argument("--formats", help="comma-separated presets (default: the brief's format)")
    s.add_argument("--fast", action="store_true", help="faster, lower-quality encode for proofs")
    s.add_argument("--crf", type=int, help="x264 quality (lower = better/bigger; default 19)")
    s.add_argument("--preset", help="x264 preset (ultrafast ... veryslow; default medium)")
    s.add_argument("--workers", type=int, help="animated projects: parallel browser renderers (default: CPUs - 1)")
    s.set_defaults(fn=cmd_render)

    s = sub.add_parser("package", help="titles, description, chapters")
    s.add_argument("project")
    s.add_argument("--format")
    s.add_argument("--no-llm", action="store_true")
    s.set_defaults(fn=cmd_package)

    s = sub.add_parser("run", help="run every stage")
    s.add_argument("project")
    s.add_argument("--start", choices=["research", "outline", "write", "plan", "voice", "images", "render", "package"])
    s.add_argument("--formats")
    s.add_argument("--no-llm", action="store_true")
    s.add_argument("--replan", action="store_true")
    s.set_defaults(fn=cmd_run)

    s = sub.add_parser("analyze", help="measure a reference video")
    s.add_argument("video")
    s.add_argument("--audio")
    s.add_argument("--out", default="analysis/reference")
    s.add_argument("--whisper", default="small.en")
    s.add_argument("--no-speech", action="store_true")
    s.set_defaults(fn=cmd_analyze)

    s = sub.add_parser("cast", help="rank local voices against a narrator profile (default: the reference's)")
    s.add_argument("--out", default="analysis/casting")
    s.add_argument("--voices", help="comma-separated Kokoro voices (default: all male voices)")
    s.add_argument("--f0", type=float, help="target median pitch in Hz (reference: 116.6)")
    s.add_argument("--pitch-sd", type=float, help="target pitch SD in semitones (reference: 4.14)")
    s.add_argument("--wpm", type=float, help="target words per minute (reference: 193)")
    s.set_defaults(fn=cmd_cast)

    s = sub.add_parser("status", help="project status")
    s.add_argument("project")
    s.set_defaults(fn=cmd_status)

    a = ap.parse_args(argv)
    from chronicle.llm import LLMRefusal, ManualStepRequired

    try:
        a.fn(a)
    except ManualStepRequired as e:
        print(f"\n{e}")
        sys.exit(2)
    except (FileNotFoundError, LLMRefusal) as e:
        print(f"error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
