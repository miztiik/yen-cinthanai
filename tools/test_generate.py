"""Generator gates: uniqueness, determinism, minimal prune, D-in-band, manifest
validates, hintTrace solves. Real solver, real config, no mocks (CLAUDE.md #7)."""

import json
from pathlib import Path

import pytest

import generate as g
from models import PuzzleManifest

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"
DATE = "2026-06-29"
TIERS = ("easy", "standard", "sharp", "expert")


def _clues_from(m: PuzzleManifest) -> list[g.Clue]:
    return [
        (c.type, tuple((o.cat, o.value) for o in c.operands), tuple(c.params.items()))
        for c in m.constraints
    ]


def _cats(tier: str) -> list[g.Cat]:
    ent = g.load_toml("tiers", CONFIG_DIR)[tier]["entities"]
    return g.build_categories(tier, ent, CONFIG_DIR)


@pytest.mark.parametrize("tier", TIERS)
def test_manifest_validates(tier: str) -> None:
    m, _, _ = g.generate(DATE, tier, CONFIG_DIR)
    assert isinstance(m, PuzzleManifest) and m.tier == tier and m.puzzleId == DATE


@pytest.mark.parametrize("tier", TIERS)
def test_uniqueness_holds(tier: str) -> None:
    m, _, _ = g.generate(DATE, tier, CONFIG_DIR)
    n = len(m.entities)
    seed = g.seed_int(DATE, tier, CONFIG_DIR)
    assert g.is_unique(_cats(tier), n, _clues_from(m), seed)


@pytest.mark.parametrize("tier", TIERS)
def test_prune_minimal(tier: str) -> None:
    m, _, _ = g.generate(DATE, tier, CONFIG_DIR)
    n, cats = len(m.entities), _cats(tier)
    seed = g.seed_int(DATE, tier, CONFIG_DIR)
    clues = _clues_from(m)
    for i in range(len(clues)):
        assert not g.is_unique(cats, n, clues[:i] + clues[i + 1 :], seed)


@pytest.mark.parametrize("tier", TIERS)
def test_difficulty_in_band(tier: str) -> None:
    lo, hi = g.load_toml("tiers", CONFIG_DIR)[tier]["band"]
    _, d, _ = g.generate(DATE, tier, CONFIG_DIR)
    assert lo <= d <= hi


def test_determinism_same_sha(tmp_path: Path) -> None:
    a = g.write_puzzle(DATE, "standard", tmp_path / "a", CONFIG_DIR)
    b = g.write_puzzle(DATE, "standard", tmp_path / "b", CONFIG_DIR)
    assert a["sha"] == b["sha"]
    assert (tmp_path / "a" / a["file"]).read_text("ascii") == (tmp_path / "b" / b["file"]).read_text("ascii")


@pytest.mark.parametrize("tier", TIERS)
def test_hinttrace_solves(tier: str) -> None:
    m, _, _ = g.generate(DATE, tier, CONFIG_DIR)
    cats = _cats(tier)
    anchor = g.identity_cat(cats)
    placed = {f"e{i}": {anchor.id: anchor.value_ids[i]} for i in range(len(m.entities))}
    for step in m.hintTrace:
        placed[step.forces.entity][step.forces.cat] = step.forces.value
    assert placed == m.solution


def test_index_and_log(tmp_path: Path) -> None:
    e = g.write_puzzle(DATE, "easy", tmp_path, CONFIG_DIR)
    out = g.write_index(DATE, [e], tmp_path)
    idx = json.loads(out.read_text("ascii"))
    assert idx["schemaVersion"] == 1 and idx["puzzles"][0]["sha"] == e["sha"]
