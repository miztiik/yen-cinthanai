"""Contract: story-first authoring loaders parse the real datasets inputs.

Real fixtures only (the on-disk datasets), no mocks. Proves load_categories and
load_scenario_template accept the committed inputs and fail fast on malformed ones.
"""

import json
from pathlib import Path

import pytest

from corpus import (
    MANIFEST_FILENAME,
    load_categories,
    load_scenario_manifest,
    load_scenario_template,
    scenario_path_by_id,
    scenario_path_for_date,
)

ROOT = Path(__file__).resolve().parent.parent
DATASETS = ROOT / "datasets"


def test_load_categories_parses_real_file() -> None:
    cats = load_categories()
    assert cats.schemaVersion == 1
    assert "fruit" in cats.categories and "year" in cats.categories
    fruit = cats.categories["fruit"]
    assert fruit.kind == "nominal" and fruit.glyphPack == "food"
    year = cats.categories["year"]
    assert year.kind == "numeric" and year.unit == "CE"
    assert all(v.magnitude is not None for v in year.values)


def test_load_scenario_template_parses_real_file() -> None:
    tpl = load_scenario_template()
    assert tpl.id == "weekend-market"
    assert tpl.subjectCategory == "name" and tpl.minTier == "easy"
    price = next(c for c in tpl.categories if c.id == "price")
    assert price.kind == "numeric" and price.unit == "dollars"
    assert all(v.magnitude is not None for v in price.valuePool)
    craft = next(c for c in tpl.categories if c.id == "craft")
    assert all(v.phrase and v.refPhrase for v in craft.valuePool)
    assert tpl.indirection.byTier["expert"] == "attribute"
    assert tpl.clueTemplates["numDiff"].appliesTo == "price"


def test_loaders_reject_malformed(tmp_path: Path) -> None:
    # categories: a category missing the required 'kind'
    bad_cats = {"schemaVersion": 1, "categories": {"x": {"label": "X", "values": []}}}
    p1 = tmp_path / "bad-categories.json"
    p1.write_text(json.dumps(bad_cats), encoding="ascii")
    with pytest.raises(Exception):
        load_categories(p1)
    # scenario: an unexpected extra field trips extra=forbid
    good = json.loads((DATASETS / "templates" / "weekend-market.json").read_text(encoding="ascii"))
    good["unexpected"] = True
    p2 = tmp_path / "bad-scenario.json"
    p2.write_text(json.dumps(good), encoding="ascii")
    with pytest.raises(Exception):
        load_scenario_template(p2)


# --- scenario manifest (catalog index + build/live staging) ---------------------


def test_load_scenario_manifest_parses_real_catalog() -> None:
    m = load_scenario_manifest()
    ids = [e.id for e in m.scenarios]
    assert "weekend-market" in ids and len(ids) >= 4
    assert all(e.status in ("live", "build") for e in m.scenarios)
    assert all(e.file == f"{e.id}.json" for e in m.scenarios)  # file == '<id>.json' contract
    # every seeded scenario ships live, and each entry carries free-form tone/kind tags
    assert {e.id for e in m.scenarios if e.status == "live"} >= {"weekend-market", "starliner-crew"}
    wm = next(e for e in m.scenarios if e.id == "weekend-market")
    assert wm.tone and wm.kind and wm.title


def _stage(tmp: Path, entries: list[dict]) -> Path:
    """A tmp templates dir: one placeholder template file per entry + a manifest listing them.
    The selection functions resolve paths without loading template contents, so '{}' suffices."""
    for e in entries:
        (tmp / e["file"]).write_text("{}", encoding="ascii")
    (tmp / MANIFEST_FILENAME).write_text(
        json.dumps({"schemaVersion": 1, "scenarios": entries}), encoding="ascii"
    )
    return tmp


def _entry(scenario_id: str, status: str) -> dict:
    return {
        "id": scenario_id, "file": f"{scenario_id}.json", "title": scenario_id.title(),
        "tone": "cozy", "kind": "test", "status": status,
    }


def test_build_scenario_is_staged_out_of_rotation_but_resolvable(tmp_path: Path) -> None:
    # Two live + one build. The build scenario must NEVER appear in the per-date rotation, yet IS
    # resolvable by id (the --scenario authoring escape hatch). This is the staging contract: a
    # build scenario is authorable + testable without entering the served daily bank.
    _stage(tmp_path, [_entry("alpha", "live"), _entry("beta", "live"), _entry("wip", "build")])
    dates = [f"2026-07-{d:02d}" for d in range(1, 32)] + [f"2026-08-{d:02d}" for d in range(1, 32)]
    picks = {scenario_path_for_date(d, tmp_path).stem for d in dates}
    assert picks == {"alpha", "beta"}, picks              # build 'wip' never rotates in; both live vary
    assert scenario_path_by_id("wip", tmp_path).name == "wip.json"      # but IS resolvable by id
    assert scenario_path_by_id("alpha", tmp_path).name == "alpha.json"
    with pytest.raises(KeyError):
        scenario_path_by_id("nope", tmp_path)


def test_scenario_for_date_is_stable(tmp_path: Path) -> None:
    # Same date -> same live scenario on every call (deterministic hash of the date over sorted ids).
    _stage(tmp_path, [_entry("alpha", "live"), _entry("beta", "live"), _entry("gamma", "live")])
    for d in ("2026-07-01", "2026-12-25", "2027-01-01"):
        assert scenario_path_for_date(d, tmp_path) == scenario_path_for_date(d, tmp_path)


def test_manifest_coverage_fails_fast(tmp_path: Path) -> None:
    # The loader reconciles the manifest against the directory: an orphan template on disk (listed
    # nowhere) and a dangling entry (file missing) both fail fast.
    _stage(tmp_path, [_entry("alpha", "live")])
    load_scenario_manifest(tmp_path)  # baseline: consistent
    (tmp_path / "orphan.json").write_text("{}", encoding="ascii")  # unlisted template on disk
    with pytest.raises(Exception):
        load_scenario_manifest(tmp_path)
    (tmp_path / "orphan.json").unlink()
    entries = [_entry("alpha", "live"), _entry("ghost", "build")]  # 'ghost' listed but no file
    (tmp_path / MANIFEST_FILENAME).write_text(
        json.dumps({"schemaVersion": 1, "scenarios": entries}), encoding="ascii"
    )
    with pytest.raises(Exception):
        load_scenario_manifest(tmp_path)
