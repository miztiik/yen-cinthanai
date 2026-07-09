"""Contract: the read-only clue-mix report derives the right distribution facts.

Synthetic manifests (not the shipped bank, which the daily bot advances) so the
asserted numbers are stable. Mirrors the real 2026-07-09 skate-park puzzles.
"""

import json

import pytest

from clue_mix_report import analyze_bank, analyze_puzzle, clue_pairing


def _cat(cid: str, *, anchor: bool = False, kind: str = "nominal") -> dict:
    return {"id": cid, "anchor": anchor, "kind": kind}


def _clue(ctype: str, *operands: tuple[str, str]) -> dict:
    return {"type": ctype, "operands": [{"cat": c, "value": v} for c, v in operands]}


EASY = {
    "tier": "easy",
    "categories": {"list": [_cat("skater", anchor=True), _cat("deck")]},
    "constraints": [
        _clue("eq", ("skater", "lucia"), ("deck", "green")),
        _clue("eq", ("skater", "ravi"), ("deck", "purple")),
    ],
}

# Mirrors today's standard: 2 deck+trick eq, 1 skater+deck neq, 1 skater+trick eq,
# 1 skater+skater numDiff ("Freya landed 2 more tricks than Cleo").
STANDARD = {
    "tier": "standard",
    "categories": {"list": [_cat("skater", anchor=True), _cat("deck"), _cat("trick", kind="numeric")]},
    "constraints": [
        _clue("eq", ("deck", "yellow"), ("trick", "trick7")),
        _clue("neq", ("skater", "ravi"), ("deck", "orange")),
        _clue("eq", ("deck", "red"), ("trick", "trick6")),
        _clue("eq", ("skater", "ravi"), ("trick", "trick4")),
        _clue("numDiff", ("skater", "freya"), ("skater", "cleo")),
    ],
}


def test_clue_pairing_is_sorted_unique_cats() -> None:
    assert clue_pairing(_clue("eq", ("skater", "a"), ("deck", "b"))) == ("deck", "skater")
    assert clue_pairing(_clue("numDiff", ("skater", "a"), ("skater", "b"))) == ("skater",)


def test_easy_is_all_eq_single_pairing() -> None:
    pm = analyze_puzzle(EASY)
    assert pm.n_clues == 2
    assert pm.type_counts == {"eq": 2}
    assert pm.top_pairing_share == 1.0  # only one pairing exists
    assert pm.numeric_clues == 0
    assert pm.anchor_clues == 2  # both clues name the subject


def test_standard_numeric_and_pairing_distribution() -> None:
    pm = analyze_puzzle(STANDARD)
    assert pm.n_clues == 5
    assert pm.type_counts == {"eq": 3, "neq": 1, "numDiff": 1}
    # deck+trick is the most-clued pairing: 2 of 5.
    assert pm.pairing_counts[("deck", "trick")] == 2
    assert pm.top_pairing_share == pytest.approx(2 / 5)
    # numeric axis load: c1,c3,c4 touch trick + c5 is a numDiff type = 4 of 5.
    assert pm.numeric_clues == 4
    # anchor (skater) axis: c2,c4,c5 = 3 of 5.
    assert pm.anchor_clues == 3


def test_numdiff_counts_as_numeric_even_without_a_numeric_operand() -> None:
    # A numDiff whose operands are two entities still loads the numeric axis by type.
    pm = analyze_puzzle(
        {
            "tier": "standard",
            "categories": {"list": [_cat("skater", anchor=True), _cat("trick", kind="numeric")]},
            "constraints": [_clue("numDiff", ("skater", "a"), ("skater", "b"))],
        }
    )
    assert pm.numeric_clues == 1


def test_analyze_bank_aggregates_and_skips_index(tmp_path) -> None:
    (tmp_path / "2026-07-09-easy.json").write_text(json.dumps(EASY), encoding="utf-8")
    (tmp_path / "2026-07-09-standard.json").write_text(json.dumps(STANDARD), encoding="utf-8")
    (tmp_path / "index.json").write_text(json.dumps({"puzzles": []}), encoding="utf-8")

    tiers = analyze_bank(tmp_path)
    assert tiers["easy"].days == 1
    assert tiers["standard"].days == 1
    assert tiers["sharp"].days == 0  # no file, no crash
    assert tiers["easy"].avg_clues == 2.0
    assert dict(tiers["easy"].type_shares()) == {"eq": 1.0}
    assert tiers["standard"].avg_numeric_share == pytest.approx(0.8)
    assert tiers["standard"].avg_anchor_share == pytest.approx(0.6)
    assert tiers["standard"].avg_top_pairing_share == pytest.approx(0.4)
