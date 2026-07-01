"""Row-3 story-first quality gates on the corpus-driven standard matrix: zero-guess (P1), a
single-clue eq opener (P2), difficulty in the tier band (P4), variety with eq present (P5), no
non-anchor value leaked into the story (P7), and every clue rendered to brace-free ASCII (T1).
Row 5 adds numeric clues: magnitude round-trip (T13), numeric facts true (T14), and a DEFINITE
solver-status guard. Real solver + real corpus, deterministic, no mocks (CLAUDE.md #7, #13)."""

import json
from pathlib import Path

import pytest
from ortools.sat.python import cp_model

import generate as g
from models import PuzzleManifest

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"
DATE, TIER, VARIANT = "2026-07-01", "standard", 1


@pytest.fixture(scope="module")
def story() -> tuple:
    m, d, _ = g.generate_story(DATE, TIER, VARIANT, CONFIG_DIR)
    return m, d


@pytest.fixture(scope="module")
def build() -> g.StoryBuild:
    # The full accepted attempt, exposing the solver-internal cats/clues/solution/seed so the
    # numeric + DEFINITE-status gates can re-verify without re-running the reseed loop.
    return g.build_story(DATE, TIER, VARIANT, CONFIG_DIR)


def _mag_by_anchor(m) -> tuple:
    # (numeric-cat id, {anchor value -> the integer magnitude sharing its slot in the solution}).
    numcat = next(c for c in m.categories.items if c.kind == "numeric")
    mag = {v.id: v.magnitude for v in numcat.values}
    anchor = next(c.id for c in m.categories.items if c.anchor)
    ent_of = {cells[anchor]: e for e, cells in m.solution.items()}
    return numcat.id, {av: mag[m.solution[ent_of[av]][numcat.id]] for av in ent_of}


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


def test_standard_carries_a_numeric_clue(build: g.StoryBuild) -> None:
    # Row 5 deliverable: the regenerated standard matrix carries at least one numDiff clue.
    assert any(c.type == "numDiff" for c in build.manifest.constraints)


def test_t13_magnitude_round_trips(build: g.StoryBuild) -> None:
    # emit -> canonical JSON -> reparse: every numeric value.magnitude is an int and identical.
    m = build.manifest
    text = json.dumps(m.model_dump(by_alias=True, exclude_none=True), sort_keys=True, ensure_ascii=True)
    reparsed = PuzzleManifest.model_validate_json(text)
    seen = 0
    for c0, c1 in zip(m.categories.items, reparsed.categories.items):
        if c0.kind != "numeric":
            continue
        for v0, v1 in zip(c0.values, c1.values):
            assert isinstance(v1.magnitude, int) and not isinstance(v1.magnitude, bool)
            assert v1.magnitude == v0.magnitude
            seen += 1
    assert seen == len(m.entities)  # every numeric slot carried an int magnitude through the trip


def test_t14_numeric_facts_true(build: g.StoryBuild) -> None:
    # Every emitted numDiff and every enumerated threshold HOLDS under the solution magnitudes.
    m = build.manifest
    numcat_id, mag_at = _mag_by_anchor(m)
    diffs = [c for c in m.constraints if c.type == "numDiff"]
    assert diffs
    for c in diffs:
        p = dict(c.params)
        a, b = c.operands[0].value, c.operands[1].value
        assert p["numericCat"] == numcat_id and p["dir"] == "greater"
        assert mag_at[a] == mag_at[b] + p["delta"]  # directed: a is exactly delta more than b
    # threshold is Sharp+; enumerate it against the same solution and confirm each bound holds.
    thresholds = [
        cl for cl in g.enumerate_numeric_clues(build.cats, build.entities, build.sol, "sharp", build.scenario)
        if cl[0] == "threshold"
    ]
    assert thresholds
    for _typ, ops, params in thresholds:
        p = dict(params)
        assert p["numericCat"] == numcat_id and p["dir"] == "atleast"
        assert mag_at[ops[0][1]] >= p["bound"]


def test_uniqueness_solve_is_definite(build: g.StoryBuild) -> None:
    # The generated puzzle's uniqueness solve returns a DEFINITE status (never UNKNOWN/timeout).
    status = g.uniqueness_status(build.cats, build.entities, build.clues, build.seed)
    assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    assert g.is_unique(build.cats, build.entities, build.clues, build.seed) is True


def test_definite_guard_rejects_nondefinite() -> None:
    # The guard raises on a non-definite status rather than treating it as feasible/infeasible.
    for bad in (cp_model.UNKNOWN, cp_model.MODEL_INVALID):
        with pytest.raises(RuntimeError):
            g._definite(bad)
    for ok in (cp_model.OPTIMAL, cp_model.FEASIBLE, cp_model.INFEASIBLE):
        assert g._definite(ok) == ok


def test_numeric_modeling_undirected_and_atmost() -> None:
    # The undirected-numDiff and atmost-threshold model branches (implemented but not emitted by
    # generation) enforce the right arithmetic. Synthetic anchor + numeric magnitudes {2,5,9}.
    anchor = g.Cat("who", "Who", False, ["a", "b", "c"], ["", "", ""], ["A", "B", "C"])
    num = g.Cat("amt", "Amt", False, ["x", "y", "z"], ["", "", ""], ["2", "5", "9"],
                kind="numeric", magnitudes=[2, 5, 9])
    cats, n = [anchor, num], 3
    magmap = dict(zip(num.value_ids, num.magnitudes))

    # atmost: the entity at slot 0 charges <= 4, so it must hold magnitude 2 (the only one <= 4).
    m, x, _, _ = g.build_model(cats, n, [("threshold", (("who", "a"),),
                                          (("numericCat", "amt"), ("bound", 4), ("dir", "atmost")))])
    s = g._solver(0)
    assert g._definite(s.Solve(m)) in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    slot_val = {s.Value(x["amt"][v]): v for v in num.value_ids}
    assert magmap[slot_val[0]] <= 4

    # undirected numDiff: |slot0 - slot1| == 7, so those two slots hold {2, 9}.
    m, x, _, _ = g.build_model(cats, n, [("numDiff", (("who", "a"), ("who", "b")),
                                          (("numericCat", "amt"), ("delta", 7), ("dir", "abs")))])
    s = g._solver(0)
    assert g._definite(s.Solve(m)) in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    slot_val = {s.Value(x["amt"][v]): v for v in num.value_ids}
    assert abs(magmap[slot_val[0]] - magmap[slot_val[1]]) == 7
