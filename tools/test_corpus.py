"""Contract: story-first authoring loaders parse the real datasets inputs.

Real fixtures only (the on-disk datasets), no mocks. Proves load_categories and
load_scenario_template accept the committed inputs and fail fast on malformed ones.
"""

import json
from pathlib import Path

import pytest

from corpus import load_categories, load_scenario_template

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
