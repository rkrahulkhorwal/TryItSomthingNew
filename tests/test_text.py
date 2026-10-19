from chronicle.config import get_format
from chronicle.text import count_words, parse_script, plan_beats, split_clauses, split_sentences


def test_split_sentences_handles_abbreviations_initials_and_decimals():
    text = "Dr. Smith arrived in 3.5 days. It was 753 BC. Then J. R. Tolkien wrote... Nothing! Why?"
    assert split_sentences(text) == [
        "Dr. Smith arrived in 3.5 days.", "It was 753 BC.", "Then J. R. Tolkien wrote...", "Nothing!", "Why?"]


def test_directives_stay_with_their_sentence():
    text = "It took twenty years. {NUMBER: 2,000 COFFEE HOUSES} [visual: a busy room] Then it spread."
    assert split_sentences(text) == [
        "It took twenty years. {NUMBER: 2,000 COFFEE HOUSES} [visual: a busy room]", "Then it spread."]


def test_split_clauses_prefers_punctuation_near_the_middle():
    s = ("Under Emperor Justinian and his powerful wife Theodora, they even tried to reconquer the west, "
         "and they built the greatest church in the world.")
    parts = split_clauses(s, 12)
    assert len(parts) == 3
    assert all(count_words(p) <= 12 for p in parts)
    assert " ".join(parts) == s


def test_forced_split_marker():
    assert split_clauses("The last pharaoh was Cleopatra, | and Rome took Egypt.", 40) == [
        "The last pharaoh was Cleopatra,", "and Rome took Egypt."]


SCRIPT = """---
title: Test
---
# Hook
Imagine a tiny village that grew into an empire. But how did it happen?

# The Two Lands [card: 3100 BC]
Around 3100 BC, a king named Narmer united the two kingdoms. {NAME: NARMER}
The pyramid used 2,300,000 blocks.
> production note, not narrated
"""


def test_parse_script_chapters_and_cards():
    s = parse_script(SCRIPT)
    assert s["title"] == "Test"
    assert [c["title"] for c in s["chapters"]] == ["Hook", "The Two Lands"]
    assert s["chapters"][1]["card"] == "3100 BC"
    assert len(s["chapters"][1]["sentences"]) == 2


def test_plan_beats_rules():
    data = plan_beats(parse_script(SCRIPT), get_format("long_16x9"))
    beats = data["beats"]
    assert [b["break"] for b in beats] == ["start", "sentence", "chapter", "sentence"]
    assert beats[1]["shot_type"] == "SYMBOL"                       # a question
    assert beats[2]["overlay"] == {"kind": "name", "text": "NARMER"}  # explicit directive wins
    assert beats[3]["shot_type"] == "NUMBER"
    assert beats[2]["transition"] == "chapter"
