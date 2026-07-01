"""Row-3 story-first quality gates on the corpus-driven standard matrix: zero-guess (P1), a
single-clue eq opener (P2), difficulty in the tier band (P4), variety with eq present (P5), no
non-anchor value leaked into the story (P7), and every clue rendered to brace-free ASCII (T1).
Real solver + real corpus, deterministic, no mocks (CLAUDE.md #7, #13)."""

from pathlib import Path

import pytest

import generate as g

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"
DATE, TIER, VARIANT = "2026-07-01", "standard", 1


@pytest.fixture(scope="module")
def story() -> tuple:
    m, d, _ = g.generate_story(DATE, TIER, VARIANT, CONFIG_DIR)
    return m, d


def _anchor_id(m) -> str:
    return next(c.id for c in m.categories.items if c.anchor)


def test_p1_zero_guess_full_depth(story: tuple) -> None:
    # The forced-deduction trace visits every non-anchor bijective cell exactly once: the
    # solver never leaves a guess (len(hintTrace) == non-anchor bijective categories * entities).
    m, _ = story
    anchor = _anchor_id(m)
    non_anchor_bijective = [c for c in m.categories.items if c.id != anchor and c.cardinality == "bijective"]
    assert len(m.hintTrace) == len(non_anchor_bijective) * len(m.entities)


def test_p2_single_clue_eq_opener(story: tuple) -> None:
    # At least one eq clue, by itself, forces a cell (a single-clue opener) - the toehold a
    # solver needs to start without guessing.
    m, _ = story
    ctype = {c.id: c.type for c in m.constraints}
    openers = [s for s in m.hintTrace if len(s.fromClues) == 1 and ctype.get(s.fromClues[0]) == "eq"]
    assert openers


def test_p4_difficulty_in_band(story: tuple) -> None:
    m, d = story
    tiers = g.load_config("tiers", CONFIG_DIR)[TIER]
    lo, hi = tiers["band"]
    indirect = sum(1 for c in m.constraints if c.type in g.INDIRECT_TYPES)
    recomputed = g.difficulty(tiers, len(m.entities), m.categories.n, len(m.constraints), indirect, len(m.hintTrace))
    assert recomputed == d
    assert lo <= recomputed <= hi


def test_p5_variety_no_type_dominates(story: tuple) -> None:
    # eq is present and no single clue type exceeds the config share cap (variety guard).
    m, _ = story
    cap = g.load_config("dials", CONFIG_DIR)["story"]["share_cap"]
    types = [c.type for c in m.constraints]
    assert "eq" in types
    assert max(types.count(t) for t in set(types)) / len(types) <= cap


def test_p7_story_hides_non_anchor_values(story: tuple) -> None:
    # The narrative may name the subject (anchor) but must never spoil a non-anchor value.
    m, _ = story
    anchor = _anchor_id(m)
    for c in m.categories.items:
        if c.id == anchor:
            continue
        for v in c.values:
            assert v.label not in m.story


def test_t1_cluetext_is_ascii_without_slots(story: tuple) -> None:
    m, _ = story
    for c in m.constraints:
        assert c.clueText  # non-empty
        assert "{" not in c.clueText and "}" not in c.clueText  # every slot filled
        assert c.clueText.isascii()


def test_rebuild_is_byte_identical() -> None:
    # Determinism: same (date, tier, variant) -> identical manifest (num_search_workers=1,
    # fixed seed, fixed clue order, date-seeded narrative + variants).
    a = g.generate_story(DATE, TIER, VARIANT, CONFIG_DIR)[0]
    b = g.generate_story(DATE, TIER, VARIANT, CONFIG_DIR)[0]
    assert a.model_dump(by_alias=True) == b.model_dump(by_alias=True)
