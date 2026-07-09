"""Contract: Pydantic models load the real frontend fixtures; stars from config."""

import json
from pathlib import Path

import pytest

from models import BankIndex, PuzzleManifest, Save, ShareCard, compute_stars, par_seconds

ROOT = Path(__file__).resolve().parent.parent
FIX = ROOT / "frontend" / "tests" / "fixtures"


def _load(name: str) -> dict:
    return json.loads((FIX / name).read_text(encoding="ascii"))


DATASETS = ROOT / "datasets"
PUZZLES = ROOT / "frontend" / "public" / "puzzles"


def _load_abs(p: Path) -> dict:
    return json.loads(p.read_text(encoding="ascii"))


def test_manifest_fixture_validates() -> None:
    m = PuzzleManifest.model_validate(_load("manifest-4x3.json"))
    assert m.schemaVersion == 2 and m.shapeId == "grid"
    assert len(m.entities) == 4
    assert m.categories.n == 3 == len(m.categories.items)
    assert m.story and m.scenarioId and m.subjectNoun and m.variant == 1  # story-first required at v2
    assert all(c.kind for c in m.categories.items)  # kind required on every category
    assert sum(1 for c in m.categories.items if c.anchor) == 1  # exactly one anchor axis
    for cat in m.categories.items:
        if cat.cardinality == "bijective":
            assert len(cat.values) == len(m.entities)
    for ent in m.entities:
        assert m.solution[ent].keys() == {"drink", "animal", "position"}


def test_story_first_sample_manifests_validate() -> None:
    """Story-first samples validate + new optional fields read (standard = generated eq/neq matrix)."""
    for tier in ("standard", "easy"):
        p = DATASETS / "2026" / "07" / "01" / tier / "2026-07-01-001.json"
        m = PuzzleManifest.model_validate(_load_abs(p))
        assert m.schemaVersion == 2
        assert m.story and m.scenarioId and m.subjectNoun and m.variant == 1
        # story-first categories all carry a kind; an anchor + phrase are present
        assert all(c.kind is not None for c in m.categories.items)
        assert any(c.anchor for c in m.categories.items)
        assert any(v.phrase for c in m.categories.items for v in c.values)
    # the standard sample carries a numeric axis (unit + magnitude as metadata)
    std = PuzzleManifest.model_validate(
        _load_abs(DATASETS / "2026" / "07" / "01" / "standard" / "2026-07-01-001.json")
    )
    numeric = [c for c in std.categories.items if c.kind == "numeric"]
    assert numeric and numeric[0].unit == "dollars"
    assert any(v.magnitude is not None for v in numeric[0].values)
    # Row 5 restores numeric clues: the standard sample carries numDiff (Standard+) alongside eq/neq
    assert {k.type for k in std.constraints} <= {"eq", "neq", "numDiff", "threshold"}
    assert any(k.type == "eq" for k in std.constraints)
    assert any(k.type == "numDiff" for k in std.constraints)


def test_save_and_bank_fixtures_validate() -> None:
    s = Save.model_validate(_load("save-v1.json"))
    assert len(s.days) == 2 and s.hero.bestMs == 41000
    b = BankIndex.model_validate(_load("bank-index.json"))
    assert b.schemaVersion == 1 and len(b.puzzles) == 2


def test_sharecard_carries_only_stats() -> None:
    card = ShareCard.model_validate(
        {
            "schemaVersion": 1, "date": "2026-06-29", "tier": "standard",
            "shapeGlyph": "abstract.seating", "status": "won", "moves": 12,
            "wrong": 0, "solveMs": 1, "hintsUsed": 0, "streak": 3,
        }
    )
    assert set(card.model_dump()) == {
        "schemaVersion", "date", "tier", "shapeGlyph", "status",
        "moves", "wrong", "solveMs", "hintsUsed", "streak",
    }


def test_strict_rejects_extra_field() -> None:
    with pytest.raises(Exception):
        Save.model_validate({**_load("save-v1.json"), "bogus": 1})


def test_par_and_stars_from_config() -> None:
    assert par_seconds("easy") == 150 and par_seconds("standard") == 240
    assert compute_stars("standard", 200_000, 0, 0) == 3  # under par, no hints/wrong
    assert compute_stars("standard", 200_000, 1, 0) == 1  # hint kills 2/3
    assert compute_stars("standard", 999_000, 0, 0) == 2  # no hint, over par
