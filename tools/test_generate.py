"""Generator gates (matrix-only, story-first): uniqueness, determinism, minimal prune,
D-in-band, manifest validates at v2, hintTrace solves, and the served-bank contract. Real
solver, real config, no mocks (CLAUDE.md #7). The legacy seating/round-table engine is
retired (Row 9d), so every gate runs against generate_story / build_story."""

import hashlib
import json
from pathlib import Path

import pytest

import generate as g
from models import PuzzleManifest

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"
DATE = "2026-06-29"
TIERS = ("easy", "standard", "sharp", "expert")


@pytest.fixture(scope="module", params=TIERS)
def built(request: pytest.FixtureRequest) -> g.StoryBuild:
    # One accepted story build per tier, reused across the gates so a tier - especially the
    # slow expert - is generated once, not once per gate. Keeps the suite fast + deterministic.
    return g.build_story(DATE, request.param, 1, CONFIG_DIR)


def test_manifest_validates(built: g.StoryBuild) -> None:
    m = built.manifest
    assert isinstance(m, PuzzleManifest) and m.puzzleId == DATE
    assert m.schemaVersion == 2 and m.shapeId == "grid"
    assert m.story and m.scenarioId and m.subjectNoun and m.variant == 1


def test_env_weights_come_from_config() -> None:
    # Holy Law #6: the difficulty ENV weights live in config/dials.json (scorer.env), not in code.
    # Isolate ENV by zeroing size/depth/indir, then pin the two tier extremes against real config.
    env = g.load_config("dials", CONFIG_DIR)["scorer"]["env"]
    tiers = g.load_config("tiers", CONFIG_DIR)
    easy, expert = tiers["easy"], tiers["expert"]
    assert g.difficulty(easy, 0, 0, 0, 0, 0, env) == 0        # unlimited/unlimited/realtime-names -> 0+0+0
    assert g.difficulty(expert, 0, 0, 0, 0, 0, env) == 34     # 1/0/submit-binary -> 12+10+12


def test_uniqueness_holds(built: g.StoryBuild) -> None:
    assert g.is_unique(built.cats, built.entities, built.clues, built.seed)


def test_prune_minimal(built: g.StoryBuild) -> None:
    # Dropping any single clue breaks uniqueness (the set is truly minimal).
    for i in range(len(built.clues)):
        assert not g.is_unique(built.cats, built.entities, built.clues[:i] + built.clues[i + 1 :], built.seed)


def test_difficulty_in_band(built: g.StoryBuild) -> None:
    lo, hi = g.load_config("tiers", CONFIG_DIR)[built.manifest.tier]["band"]
    assert lo <= built.d <= hi


def test_anchor_carries_distinct_people_avatars(built: g.StoryBuild) -> None:
    # Option B: the identity/anchor axis is auto-decorated with distinct people avatars, so faces
    # render on the person axis. Decorative only - the dedicated PRNG never perturbs the solution.
    m = built.manifest
    anchor = next(c for c in m.categories.items if c.anchor)
    glyphs = [v.glyph for v in anchor.values]
    assert all(gr.startswith("people.") for gr in glyphs), glyphs
    assert len(set(glyphs)) == len(glyphs)  # one distinct avatar per entity (no repeats)


def test_determinism_same_sha(tmp_path: Path) -> None:
    a = g.write_puzzle(DATE, "standard", tmp_path / "a", CONFIG_DIR)
    b = g.write_puzzle(DATE, "standard", tmp_path / "b", CONFIG_DIR)
    assert a["sha"] == b["sha"]
    assert (tmp_path / "a" / a["file"]).read_text("ascii") == (tmp_path / "b" / b["file"]).read_text("ascii")


def test_hinttrace_solves(built: g.StoryBuild) -> None:
    # The forced trace, applied over the anchor identity, reconstructs the full solution
    # (zero-guess): every non-anchor bijective cell is forced (story cats are all bijective).
    m = built.manifest
    anchor = g.identity_cat(built.cats)
    placed = {f"e{i}": {anchor.id: anchor.value_ids[i]} for i in range(len(m.entities))}
    for step in m.hintTrace:
        placed[step.forces.entity][step.forces.cat] = step.forces.value
    assert placed == {e: dict(cells) for e, cells in m.solution.items()}


def test_index_and_log(tmp_path: Path) -> None:
    e = g.write_puzzle(DATE, "easy", tmp_path, CONFIG_DIR)
    out = g.write_index(DATE, [e], tmp_path)
    idx = json.loads(out.read_text("ascii"))
    assert idx["schemaVersion"] == 1 and idx["puzzles"][0]["sha"] == e["sha"]


# --- past-archive backfill (never future) ---------------------------------------


def test_backfill_dates_last_n_including_end_oldest_first() -> None:
    dates = g.backfill_dates("2026-06-29", 3)
    assert dates == ["2026-06-27", "2026-06-28", "2026-06-29"]  # oldest-first, includes end
    assert dates[-1] == "2026-06-29"  # newest is the served seed (today plays)
    assert all(d <= "2026-06-29" for d in dates)  # nothing past the end
    assert g.backfill_dates("2026-07-01", 1) == ["2026-07-01"]  # n=1 is just the end


def test_backfill_clamp_never_future() -> None:
    # main clamps the range end to today via min(anchor, today); a future anchor -> today.
    today, future = "2026-07-01", "2027-01-01"
    end = min(future, today)
    assert end == today
    assert all(d <= today for d in g.backfill_dates(end, 7))


def test_backfill_index_lists_all_days_seed_is_newest(tmp_path: Path) -> None:
    end, n, tiers = "2026-06-29", 2, ("easy", "standard")
    dates = g.backfill_dates(end, n)  # 2026-06-28, 2026-06-29
    entries = [g._entry_for(d, t, tmp_path, CONFIG_DIR, False) for d in dates for t in tiers]
    out = g.write_index(dates[-1], entries, tmp_path)
    idx = json.loads(out.read_text("ascii"))
    assert idx["generatedSeed"] == end  # newest day is served for play
    assert sorted({p["date"] for p in idx["puzzles"]}) == list(dates)  # every backfilled day indexed
    assert len(idx["puzzles"]) == n * len(tiers)
    assert max(p["date"] for p in idx["puzzles"]) == end  # never past today
    # deterministic: the now-frozen files re-freeze to identical shas
    again = [g._entry_for(d, t, tmp_path, CONFIG_DIR, False) for d in dates for t in tiers]
    assert [e["sha"] for e in again] == [e["sha"] for e in entries]
    assert all(e["frozen"] for e in again)  # second pass reads the frozen files


# --- story-first served bank (row 9b: the served bank IS the story-first master) -----------------

PUZZLES_DIR = ROOT / "frontend" / "public" / "puzzles"


def _served_puzzles() -> list[Path]:
    return sorted(p for p in PUZZLES_DIR.glob("*.json") if p.name != "index.json")


def test_served_bank_is_story_first_zero_guess() -> None:
    # Every served puzzle is a story-first schemaVersion-2 grid master with no null optionals, and
    # P1 (zero-guess) holds: the hint trace visits every non-anchor bijective cell - incl. EASY.
    files = _served_puzzles()
    assert files, "no served puzzles found"
    for p in files:
        raw = p.read_text("ascii")
        assert "null" not in raw, f"{p.name}: exclude_none emit must carry no null optional"
        m = PuzzleManifest.model_validate_json(raw)
        assert m.schemaVersion == 2 and m.shapeId == "grid"
        assert m.story and m.scenarioId and m.subjectNoun and m.variant == 1  # story-first
        anchor = next(c.id for c in m.categories.items if c.anchor)
        non_anchor_bij = [c for c in m.categories.items if c.id != anchor and c.cardinality == "bijective"]
        assert len(m.hintTrace) == len(non_anchor_bij) * len(m.entities), p.name  # P1 zero-guess


def test_served_bank_covers_four_tiers_each_date() -> None:
    by_date: dict[str, set[str]] = {}
    for p in _served_puzzles():
        date, tier = p.stem.rsplit("-", 1)
        by_date.setdefault(date, set()).add(tier)
    assert by_date, "no served dates"
    for date, served_tiers in by_date.items():
        assert set(TIERS) <= served_tiers, (date, sorted(served_tiers))


def test_served_index_shas_match_files() -> None:
    # The BankIndex sha for each puzzle == sha256 of the file's canonical JSON (written as the
    # canonical text plus a trailing newline) - the determinism contract for the served bank.
    idx = json.loads((PUZZLES_DIR / "index.json").read_text("ascii"))
    assert idx["schemaVersion"] == 1 and idx["puzzles"]
    for e in idx["puzzles"]:
        assert e["shapeId"] == "grid"  # story-first served bank is grid-only
        text = (PUZZLES_DIR / e["file"]).read_text("ascii").rstrip("\n")
        assert hashlib.sha256(text.encode("ascii")).hexdigest() == e["sha"], e["file"]


def test_served_bank_rebuild_is_byte_identical(tmp_path: Path) -> None:
    # A rebuild of a committed served puzzle is byte-identical (num_search_workers=1, canonical
    # sha, exclude_none) - the served master is a deterministic function of (date, tier).
    for tier in TIERS:
        committed = (PUZZLES_DIR / f"2026-07-02-{tier}.json").read_text("ascii")
        e = g.write_puzzle("2026-07-02", tier, tmp_path, CONFIG_DIR)
        assert (tmp_path / e["file"]).read_text("ascii") == committed, tier

