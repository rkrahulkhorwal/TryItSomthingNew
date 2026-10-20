"""Stage orchestration: voice -> images -> timeline -> render -> package. Every stage is resumable."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from chronicle.align import align
from chronicle.images import export_prompt_sheet, get_image_provider, trim_frame
from chronicle.paths import MUSIC_DIR
from chronicle.project import Project
from chronicle.render.audio import find_music
from chronicle.render.video import render_video
from chronicle.timeline import build_timeline, srt, youtube_chapters
from chronicle.tts import get_tts


def _hash(*parts: str) -> str:
    return hashlib.sha1("␟".join(parts).encode()).hexdigest()[:12]


def voice(proj: Project, *, force: bool = False, log=print) -> dict:
    data = proj.beats()
    settings = proj.settings()
    fmt = proj.format()
    tts_cfg = settings.get("tts", {})
    provider_key = json.dumps({k: tts_cfg.get(k) for k in ("provider", tts_cfg.get("provider", ""))}, sort_keys=True)
    clips = proj.read_json("audio/clips.json") or {}
    tts = None
    beats = data["beats"]
    align_cfg = settings.get("align", {})
    for i, b in enumerate(beats):
        key = _hash(b["text"], provider_key)
        cur = clips.get(str(b["id"]))
        if cur and cur.get("hash") == key and (proj.root / cur["path"]).exists() and not force:
            continue
        if tts is None:
            tts = get_tts(settings, wpm=float(fmt.get("wpm", 190)))
        prev_t = beats[i - 1]["text"] if i > 0 else None
        next_t = beats[i + 1]["text"] if i + 1 < len(beats) else None
        res = tts.synthesize(b["text"], proj.audio_path(b["id"]), prev_t, next_t)
        if not res.get("words"):
            if tts_cfg.get("provider") == "silent":
                from chronicle.align import proportional
                res["words"] = proportional(b["text"], res["duration"])
            else:
                res["words"] = align(res["path"], b["text"], res["duration"], method=align_cfg.get("method", "whisper"),
                                     model=align_cfg.get("whisper_model", "base.en"))
        res["hash"] = key
        res["text"] = b["text"]
        res["path"] = str(Path(res["path"]).resolve().relative_to(proj.root))  # portable: relative to the project
        clips[str(b["id"])] = res
        log(f"  voice beat {b['id']:3d}: {res['duration']:.2f}s  {b['text'][:60]}")
        proj.write_json("audio/clips.json", clips)
    proj.write_json("audio/clips.json", clips)
    total = sum(c["duration"] for c in clips.values())
    log(f"voice: {len(clips)} clips, {total:.1f}s of speech")
    return clips


def images(proj: Project, *, provider: str | None = None, only: list[int] | None = None, force: bool = False,
           log=print) -> list[Path]:
    data = proj.beats()
    settings = proj.settings()
    active = provider or settings.get("images", {}).get("provider", "placeholder")
    gen = get_image_provider(settings, proj.root, active)
    aspect = data.get("image_aspect") or proj.format().get("image_aspect", "16:9")
    export_prompt_sheet(data, proj.root / "image_prompts.csv")
    done = []
    for b in data["beats"]:
        if only and b["id"] not in only:
            continue
        out = proj.image_path(b["id"])
        if out.exists() and not force:
            continue
        gen.generate(b, out, aspect)
        trimmed = trim_frame(out) if active != "placeholder" else (0, 0, 0, 0)
        done.append(out)
        note = f"  (trimmed drawn border {trimmed})" if any(trimmed) else ""
        log(f"  image beat {b['id']:3d} [{b['shot_type']}] -> {out.name}{note}")
    log(f"images: {len(done)} generated ({active})")
    return done


def timeline(proj: Project, fmt_name: str | None = None) -> tuple[dict, object]:
    data = proj.beats()
    clips = proj.read_json("audio/clips.json")
    if not clips:
        raise FileNotFoundError("no voice clips - run `chronicle voice` first")
    missing = [b["id"] for b in data["beats"] if str(b["id"]) not in clips
               or not (proj.root / clips[str(b["id"])]["path"]).exists()]
    if missing:
        raise RuntimeError(f"voice clips missing for beats {missing[:10]} - run `chronicle voice`")
    clips = {k: {**c, "path": str(proj.root / c["path"])} for k, c in clips.items()}
    fmt = proj.format(fmt_name)
    tl, vo = build_timeline(data, clips, fmt, proj.brief())
    proj.write_json(f"out/timeline.{fmt['name']}.json", tl)
    return tl, vo


def render(proj: Project, formats: list[str] | None = None, *, preset: str = "medium", crf: int = 19, log=print) -> list[Path]:
    brief = proj.brief()
    formats = formats or [brief.get("format", "long_16x9")]
    data = proj.beats()
    images_map = {}
    for b in data["beats"]:
        p = proj.image_path(b["id"])
        if not p.exists():
            raise FileNotFoundError(f"missing {p} - run `chronicle images`")
        images_map[b["id"]] = p
    outputs = []
    style = proj.style()
    for name in formats:
        fmt = proj.format(name)
        tl, vo = timeline(proj, name)
        music = find_music(fmt, brief, proj.root, MUSIC_DIR) if (fmt.get("music") or {}).get("enabled") else None
        out = proj.out_dir / f"{proj.root.name}.{name}.mp4"
        log(f"render {name}: {fmt['width']}x{fmt['height']} @ {fmt['fps']} fps, {tl['duration']:.1f}s, "
            f"{tl['stats']['shots']} shots (median {tl['stats']['median_shot_s']}s), music={'yes' if music else 'no'}")
        info = render_video(tl, vo, fmt, style, images_map, out, music_path=music, crf=crf, preset=preset, log=log)
        (proj.out_dir / f"{proj.root.name}.{name}.srt").write_text(srt(tl["words"]), encoding="utf-8")
        chapters = youtube_chapters(tl)
        if chapters:
            (proj.out_dir / f"{proj.root.name}.{name}.chapters.txt").write_text(chapters + "\n", encoding="utf-8")
        proj.write_json(f"out/render.{name}.json", {"stats": tl["stats"], "render": info})
        log(f"  -> {out}  ({info['computed_frames']}/{info['frames']} frames computed in {info['seconds']}s)")
        outputs.append(out)
    return outputs


def package(proj: Project, fmt_name: str | None = None, *, use_llm: bool = True) -> Path:
    """Write description/chapters/title options. Uses the LLM when available, otherwise a template."""
    fmt = proj.format(fmt_name)
    tl = proj.read_json(f"out/timeline.{fmt['name']}.json")
    chapters = youtube_chapters(tl) if tl else ""
    if use_llm:
        from chronicle import writer

        writer.package(proj, chapters or "(no chapters)")
        return proj.out_dir / "packaging.md"
    b = proj.brief()
    topic = b.get("topic", "")
    minutes = max(1, int((tl or {}).get("duration", fmt["duration_s"]) // 60))
    title = b.get("title") or f"The ENTIRE History of {topic} in {minutes} Minutes"
    md = [f"# Packaging - {topic}", "", "## Title options",
          f"1. {title}", f"2. The ENTIRE History of {topic} in {minutes} Minutes",
          f"3. {topic}: The Complete Story", f"4. How {topic} Changed the World", "",
          "## Description", "", f"{title}.", "",
          "This documentary is based on archaeological discoveries, historical sources and academic research.", ""]
    if chapters:
        md += ["Chapters:", chapters, ""]
    md += ["## Thumbnail", "", "Illustrated panorama of the most iconic place (left 55 %), the topic name in huge dark serif "
           "capitals on the right, a date range underneath, plain light sky behind the text.", ""]
    out = proj.write_text("out/packaging.md", "\n".join(md))
    return out
