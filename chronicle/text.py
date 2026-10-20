"""Sentence / clause segmentation and the rule-based beat planner.

The reference video's edit is fully described by three rules (docs/00-teardown-report.md, section 7):
  1. one picture per sentence,
  2. sentences longer than ~17 words (or ~5 s) get split at their most natural clause boundary,
  3. the cut sits in the pause, ~0.19 s before the next line starts (handled in timeline.py).
"""

from __future__ import annotations

import re

ABBREVIATIONS = {
    "mr", "mrs", "ms", "dr", "st", "vs", "etc", "e.g", "i.e", "approx", "jr", "sr", "no", "mt", "ft", "gen",
    "col", "lt", "capt", "prof", "rev", "fig", "vol", "ca", "c",
}
CONJUNCTIONS = {"but", "and", "so", "while", "which", "who", "because", "until", "then", "yet", "whereas",
                "although", "though", "where", "when", "before", "after"}
SHOT_TYPES = [
    "SCENE", "ESTABLISHING", "CROWD", "LINEUP", "CONFRONT", "LANDMARK", "REACTION",
    "MAP", "TIMELINE", "TITLE", "NUMBER", "CHARACTER_INTRO", "CALLOUT", "CTA",
    "METAPHOR", "SYMBOL", "INFOGRAPHIC", "SPLIT", "BUBBLE", "MODERN",
]
# Overlay kind drawn by the engine for each shot type that carries text.
OVERLAY_KIND = {"TITLE": "title", "CHARACTER_INTRO": "name", "NUMBER": "number", "TIMELINE": "date",
                "CALLOUT": "label", "CTA": "title"}
DIRECTIVE_ALIASES = {"NAME": "CHARACTER_INTRO", "INTRO": "CHARACTER_INTRO", "DATE": "TIMELINE", "LABEL": "CALLOUT",
                     "YEAR": "TIMELINE", "QUESTION": "SYMBOL", "COMPARE": "SPLIT", "VS": "SPLIT"}

WORD_RE = re.compile(r"[A-Za-z0-9À-ɏ]+(?:['’][A-Za-z]+)?")
YEAR_RE = re.compile(r"\b(\d{1,4}(?:,\d{3})?)\s?(BC|BCE|AD|CE)\b|\b(?:in|by|around|until)\s(\d{3,4})\b", re.I)
BIG_NUMBER_RE = re.compile(r"\b(\d{1,3}(?:,\d{3})+|\d{4,}|\d+(?:\.\d+)?\s?(?:million|billion|thousand|hundred thousand))"
                           r"(\s+[A-Za-z][a-z]+)?", re.I)
NAMED_RE = re.compile(r"\b(?:named|called|known as)\s+((?:the\s)?[A-Z][\w'’-]+(?:\s+(?:the\s)?[A-Z][\w'’-]+){0,3})")
PERSON_HINT = re.compile(r"\b(king|queen|pharaoh|emperor|empress|general|leader|ruler|prince|princess|man|woman|"
                         r"boy|girl|son|daughter|priest|sultan|khan|chief|warlord|scholar|inventor|founder)\b", re.I)


def count_words(text: str) -> int:
    return len(WORD_RE.findall(text))


TOKEN_RE = re.compile(r"\{[^}]*\}|\[(?:visual|text|focus|motion)\s*:[^\]]*\]|\S+", re.I)


def _is_directive(tok: str) -> bool:
    return tok.startswith("{") or bool(re.match(r"\[(?:visual|text|focus|motion)\s*:", tok, re.I))


def _is_sentence_end(tokens: list[str], i: int) -> bool:
    tok = tokens[i]
    core = tok.rstrip("\"'’”)]»")
    if not core.endswith((".", "!", "?")):
        return False
    j = i + 1
    while j < len(tokens) and _is_directive(tokens[j]):  # directives belong to the sentence before them
        j += 1
    nxt_tok = tokens[j] if j < len(tokens) else ""
    if core.endswith("..."):
        return bool(nxt_tok[:1].isupper())
    if core.endswith("."):
        word = core[:-1].lower().lstrip("\"'“(")
        if word in ABBREVIATIONS:
            return False
        if len(word) == 1 and word.isalpha():  # initials: "J. R. Tolkien"
            return False
        if re.fullmatch(r"(?:[a-z]\.)+[a-z]", word):  # "e.g", "u.s"
            return False
    if not nxt_tok:
        return True
    nxt = nxt_tok.lstrip("\"'“(«[")
    return bool(nxt[:1].isupper() or nxt[:1].isdigit())


def split_sentences(text: str) -> list[str]:
    """Split prose into sentences. Robust to abbreviations, initials, decimals and inline directives."""
    tokens = TOKEN_RE.findall(text)
    out, cur = [], []
    pending_end = False
    for i, tok in enumerate(tokens):
        if pending_end and not _is_directive(tok):
            out.append(" ".join(cur))
            cur = []
            pending_end = False
        cur.append(tok)
        if not _is_directive(tok) and _is_sentence_end(tokens, i):
            pending_end = True
    if cur:
        out.append(" ".join(cur))
    return [s.strip() for s in out if s.strip()]


def _clause_candidates(words: list[str]) -> list[tuple[int, int]]:
    """Return (index_after_which_to_split, cost). Punctuation breaks are cheaper than conjunction breaks."""
    cands = []
    n = len(words)
    for i in range(n - 1):
        w = words[i]
        left, right = count_words(" ".join(words[: i + 1])), count_words(" ".join(words[i + 1:]))
        if left < 4 or right < 4:
            continue
        if w.endswith((",", ";", ":", "—", "–")) or words[i + 1] in ("—", "–"):
            cands.append((i, 0))
        elif words[i + 1].lower().strip(",") in CONJUNCTIONS:
            cands.append((i, 2))
    return cands


def split_clauses(sentence: str, max_words: int) -> list[str]:
    """Split a long sentence at its most natural clause boundaries until every piece fits `max_words`.

    An explicit `|` in the text forces a split at that point and is removed.
    """
    if "|" in sentence:
        parts = [p.strip() for p in sentence.split("|") if p.strip()]
        return [q for p in parts for q in split_clauses(p, max_words)]
    words = sentence.split()
    if count_words(sentence) <= max_words:
        return [sentence]
    cands = _clause_candidates(words)
    if not cands:
        return [sentence]
    total = count_words(sentence)
    best = min(cands, key=lambda c: abs(count_words(" ".join(words[: c[0] + 1])) - total / 2) + 3 * c[1])
    i = best[0]
    left, right = " ".join(words[: i + 1]), " ".join(words[i + 1:])
    return split_clauses(left, max_words) + split_clauses(right, max_words)


def strip_directives(text: str) -> str:
    text = re.sub(r"\{[^}]*\}", "", text)
    text = re.sub(r"\[(?:visual|text|focus|motion)\s*:[^\]]*\]", "", text, flags=re.I)
    return re.sub(r"\s{2,}", " ", text).strip()


def parse_directives(text: str) -> dict:
    """Read inline directives attached to a sentence.

    {TYPE} or {TYPE: overlay text}     e.g. {NUMBER: 40,000 MEN}  {MAP}  {NAME: HANNIBAL}  {DATE: 753 BC}
    [visual: what the picture shows]
    [focus: 0.3, 0.4]                  where the camera should look (0-1 x, y)
    [motion: push_in|pull_out|pan_left|pan_right|static]
    """
    d: dict = {}
    for m in re.finditer(r"\{\s*([A-Za-z_]+)\s*(?::\s*([^}]*))?\}", text):
        t = m.group(1).upper()
        t = DIRECTIVE_ALIASES.get(t, t)
        if t in SHOT_TYPES:
            d["shot_type"] = t
            if m.group(2):
                d["overlay_text"] = m.group(2).strip()
    m = re.search(r"\[visual\s*:\s*([^\]]+)\]", text, re.I)
    if m:
        d["visual"] = m.group(1).strip()
    m = re.search(r"\[focus\s*:\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\]", text, re.I)
    if m:
        d["focus"] = [float(m.group(1)), float(m.group(2))]
    m = re.search(r"\[motion\s*:\s*([a-z_]+)\s*\]", text, re.I)
    if m:
        d["motion"] = m.group(1).lower()
    return d


def guess_shot(text: str, *, first_in_chapter: bool, chapter_card: str | None, is_first_beat: bool) -> tuple[str, str | None]:
    """Heuristic shot type + overlay text for a beat when no LLM plan is available."""
    if first_in_chapter and chapter_card:
        return "TIMELINE", chapter_card
    m = YEAR_RE.search(text)
    if first_in_chapter and m:
        year = m.group(0).split()[-2:] if m.group(1) else [m.group(3)]
        return "TIMELINE", " ".join(year).upper().replace("BCE", "BC").replace("CE", "AD")
    m = NAMED_RE.search(text)
    if m:
        name = m.group(1).upper()
        before = text[: m.start()]
        return ("CHARACTER_INTRO" if PERSON_HINT.search(before) else "CALLOUT"), name
    m = BIG_NUMBER_RE.search(text)
    if m:
        label = (m.group(1) + (m.group(2) or "")).upper().strip()
        return "NUMBER", label
    low = text.lower()
    if text.rstrip().endswith("?"):
        return "SYMBOL", None
    if " like a " in low or " is like " in low or "was like" in low:
        return "METAPHOR", None
    if re.search(r"\b(today|modern|still use|nowadays|every time you)\b", low):
        return "MODERN", None
    if re.search(r"\b(map|border|territor|stretch(?:ed|ing) from|from [A-Z]\w+ to [A-Z]\w+)", text):
        return "MAP", None
    if is_first_beat:
        return "ESTABLISHING", None
    return "SCENE", None


def plan_beats(script: dict, fmt: dict) -> dict:
    """Turn a parsed script into beats with the measured segmentation rules (no LLM needed)."""
    max_words = int(fmt.get("split_words", 17))
    beats, chapters = [], []
    bid = 0
    for ci, ch in enumerate(script["chapters"]):
        chapters.append({"index": ci, "title": ch["title"], "card": ch.get("card")})
        first_in_chapter = True
        for sent in ch["sentences"]:
            directives = parse_directives(sent)
            clean = strip_directives(sent)
            if not clean:
                continue
            pieces = split_clauses(clean, max_words)
            for pi, piece in enumerate(pieces):
                bid += 1
                if pi > 0:
                    brk = "clause"
                elif first_in_chapter and ci > 0:
                    brk = "chapter"
                elif bid == 1:
                    brk = "start"
                else:
                    brk = "sentence"
                if pi == 0 and "shot_type" in directives:
                    shot, overlay_text = directives["shot_type"], directives.get("overlay_text")
                else:
                    shot, overlay_text = guess_shot(piece, first_in_chapter=first_in_chapter and pi == 0,
                                                    chapter_card=ch.get("card"), is_first_beat=bid == 1)
                kind = OVERLAY_KIND.get(shot)
                beat = {
                    "id": bid,
                    "chapter": ci,
                    "text": piece.replace("|", "").strip(),
                    "break": brk,
                    "shot_type": shot,
                    "visual": directives.get("visual") if pi == 0 and directives.get("visual") else piece,
                    "overlay": {"kind": kind, "text": overlay_text} if (kind and overlay_text) else None,
                    "characters": [],
                    "motion": directives.get("motion", "auto") if pi == 0 else "auto",
                    "focus": directives.get("focus") if pi == 0 else None,
                    "transition": "chapter" if brk == "chapter" else "cut",
                }
                beats.append(beat)
                first_in_chapter = False
    return {"version": 1, "title": script.get("title", ""), "planner": "rules", "chapters": chapters, "beats": beats,
            "characters": {}}


def parse_script(md: str) -> dict:
    """Parse script.md.

    Optional YAML front matter (--- title: ... ---). `# Heading [card: 753 BC]` starts a chapter.
    Lines starting with `>` or `<!--` are notes and are ignored. Everything else is narration.
    """
    title = ""
    body = md
    fm = re.match(r"^---\s*\n(.*?)\n---\s*\n", md, re.S)
    if fm:
        import yaml
        meta = yaml.safe_load(fm.group(1)) or {}
        title = str(meta.get("title", ""))
        body = md[fm.end():]
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    chapters: list[dict] = []
    cur = None
    for raw in body.splitlines():
        line = raw.strip()
        if not line or line.startswith(">"):
            if cur is not None and cur["buffer"] and not line:
                cur["paragraphs"].append(" ".join(cur["buffer"]))
                cur["buffer"] = []
            continue
        h = re.match(r"^#{1,3}\s+(.*)$", line)
        if h:
            if cur is not None and cur["buffer"]:
                cur["paragraphs"].append(" ".join(cur["buffer"]))
            head = h.group(1).strip()
            card = None
            mc = re.search(r"\[card\s*:\s*([^\]]+)\]", head, re.I)
            if mc:
                card = mc.group(1).strip()
                head = (head[: mc.start()] + head[mc.end():]).strip()
            if not title and not chapters and head.lower().startswith("title:"):
                title = head.split(":", 1)[1].strip()
                cur = None
                continue
            cur = {"title": head, "card": card, "paragraphs": [], "buffer": []}
            chapters.append(cur)
            continue
        if cur is None:
            cur = {"title": "Intro", "card": None, "paragraphs": [], "buffer": []}
            chapters.append(cur)
        cur["buffer"].append(line)
    if cur is not None and cur["buffer"]:
        cur["paragraphs"].append(" ".join(cur["buffer"]))
    for ch in chapters:
        ch["sentences"] = [s for p in ch.pop("paragraphs") for s in split_sentences(p)]
        ch.pop("buffer", None)
    chapters = [c for c in chapters if c["sentences"]]
    return {"title": title, "chapters": chapters}


def script_stats(script: dict, wpm: float) -> dict:
    sents = [strip_directives(s) for ch in script["chapters"] for s in ch["sentences"]]
    words = sum(count_words(s) for s in sents)
    lens = sorted(count_words(s) for s in sents) or [0]
    return {
        "chapters": len(script["chapters"]),
        "sentences": len(sents),
        "words": words,
        "est_duration_s": round(words / wpm * 60, 1),
        "median_sentence_words": lens[len(lens) // 2],
        "max_sentence_words": lens[-1],
        "questions": sum(s.rstrip().endswith("?") for s in sents),
        "but_turns": sum(bool(re.match(r"^(but|yet|however)\b", s, re.I)) for s in sents),
    }
