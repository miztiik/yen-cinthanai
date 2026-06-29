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
    shared = {c.id for c in cats if c.shared}  # shared cells are not forced to one seat
    placed = {f"e{i}": {anchor.id: anchor.value_ids[i]} for i in range(len(m.entities))}
    for step in m.hintTrace:
        placed[step.forces.entity][step.forces.cat] = step.forces.value
    expect = {e: {k: v for k, v in cells.items() if k not in shared} for e, cells in m.solution.items()}
    assert placed == expect


def test_index_and_log(tmp_path: Path) -> None:
    e = g.write_puzzle(DATE, "easy", tmp_path, CONFIG_DIR)
    out = g.write_index(DATE, [e], tmp_path)
    idx = json.loads(out.read_text("ascii"))
    assert idx["schemaVersion"] == 1 and idx["puzzles"][0]["sha"] == e["sha"]


# --- shape registry seam (grid + seating-row) -----------------------------------


def test_registry_has_three_entries() -> None:
    reg = g.load_toml("shapes", CONFIG_DIR)
    assert set(reg) == {"grid", "seating-row", "round-table"}
    assert reg["grid"]["topology"] == "matrix" and reg["grid"]["ordinal_axis"] is False
    assert reg["seating-row"]["topology"] == "linear" and reg["seating-row"]["ordinal_axis"] is True
    assert reg["round-table"]["topology"] == "circular" and reg["round-table"]["ordinal_axis"] is True


def test_resolve_shape_rejects_unknown() -> None:
    with pytest.raises(KeyError):
        g.resolve_shape("hex-spiral", CONFIG_DIR)


@pytest.mark.parametrize("tier", TIERS)
def test_clues_stay_within_shape_rules(tier: str) -> None:
    m, _, _ = g.generate(DATE, tier, CONFIG_DIR)
    shape = g.resolve_shape(m.shapeId, CONFIG_DIR)
    assert len(m.entities) <= shape.max_entities
    assert {k.type for k in m.constraints} <= set(shape.slot_rules)


def test_seating_uses_an_ordinal_clue_grid_does_not() -> None:
    grid, _, _ = g.generate(DATE, "easy", CONFIG_DIR)
    assert {k.type for k in grid.constraints} <= {"eq", "neq"} and grid.shapeId == "grid"
    seat_rules = set(g.resolve_shape("seating-row", CONFIG_DIR).slot_rules)
    assert {"ends", "adjacent", "distance", "before"} <= seat_rules  # ordinal unlocked
    for tier in ("standard", "sharp"):
        m, _, _ = g.generate(DATE, tier, CONFIG_DIR)
        assert m.shapeId == "seating-row" and {k.type for k in m.constraints} <= seat_rules


# --- round-table (v2: circular topology, wrap clue types) -----------------------


def test_expert_is_round_table_with_wrap_clues() -> None:
    m, _, _ = g.generate(DATE, "expert", CONFIG_DIR)
    assert m.shapeId == "round-table"
    rules = set(g.resolve_shape("round-table", CONFIG_DIR).slot_rules)
    assert "ends" not in rules  # a ring has no first/last
    assert {k.type for k in m.constraints} <= rules
    assert {k.type for k in m.constraints} & {"opposite", "between", "adjacent"}  # wraps used


def test_round_table_unique_and_minimal() -> None:
    m, _, _ = g.generate(DATE, "expert", CONFIG_DIR)
    cats, n = _cats("expert"), len(m.entities)
    seed = g.seed_int(DATE, "expert", CONFIG_DIR)
    clues = _clues_from(m)
    assert g.is_unique(cats, n, clues, seed, circular=True)
    for i in range(len(clues)):
        assert not g.is_unique(cats, n, clues[:i] + clues[i + 1 :], seed, circular=True)


# --- shared cardinality (binary team on standard) -------------------------------


def test_standard_has_one_shared_category() -> None:
    m, _, _ = g.generate(DATE, "standard", CONFIG_DIR)
    shared = [c for c in m.categories.items if c.cardinality == "shared"]
    assert len(shared) == 1 and len(shared[0].values) < len(m.entities)  # repeats
    counts = {}
    for cells in m.solution.values():
        counts[cells[shared[0].id]] = counts.get(cells[shared[0].id], 0) + 1
    assert max(counts.values()) > 1  # a value really repeats across seats


# --- bigger grids (sharp 5x4, expert 6x5; D17) ----------------------------------


def test_sharp_is_five_by_four() -> None:
    m, _, _ = g.generate(DATE, "sharp", CONFIG_DIR)
    assert m.shapeId == "seating-row" and len(m.entities) == 5
    bij = [c for c in m.categories.items if c.cardinality != "shared"]
    assert len(bij) == 4  # 5x4: four bijective categories
    for c in bij:
        assert len(c.values) == 5  # each value pack supplies one value per seat


def test_expert_is_six_by_five() -> None:
    m, _, _ = g.generate(DATE, "expert", CONFIG_DIR)
    assert m.shapeId == "round-table" and len(m.entities) == 6
    cats = m.categories.items
    assert len(cats) == 5  # 6x5: five categories on the ring
    for c in cats:
        assert len(c.values) == 6  # six seats -> six distinct values per category
    assert {"food", "color"} <= {c.id for c in cats}  # the two new packs are in play


def test_bigger_grids_stay_in_band() -> None:
    for tier in ("sharp", "expert"):
        lo, hi = g.load_toml("tiers", CONFIG_DIR)[tier]["band"]
        _, d, _ = g.generate(DATE, tier, CONFIG_DIR)
        assert lo <= d <= hi

