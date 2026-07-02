"""Contract gate: every persisted/config JSON validates against schemas/ (Draft 2020-12).

Machine-checkable formalization of the yen-cinthanai contracts (CLAUDE.md sec 11). For
each surface we load the matching JSON Schema from schemas/ and assert the REAL data
PASSES; we assert each schema is itself a valid Draft 2020-12 schema; and we assert its
embedded `evolution` log is present + well-formed (non-decreasing versions). Real
fixtures, no mocks (CLAUDE.md Holy Law #7). ASCII + POSIX (loads decode as ASCII).

The contract at v2: the puzzle-manifest schema is STRICT story-first + matrix-only - it requires
scenarioId/story/subjectNoun/variant and per-category kind/anchor, forbids the retired `ordinal`
field, and allows only shapeId grid. The save schema stays tolerant (a v0 pre-versioned save AND a
v1 save both validate, and a retired shapeId stays readable). Only PuzzleManifest is bumped to 2.
"""

from __future__ import annotations

import copy
import json
from datetime import datetime
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent.parent
SCHEMAS = ROOT / "schemas"
CONFIG = ROOT / "config"
DATASETS = ROOT / "datasets"
PUZZLES = ROOT / "frontend" / "public" / "puzzles"
GLYPHS = ROOT / "frontend" / "public" / "assets" / "glyphs"
FIXTURES = ROOT / "frontend" / "tests" / "fixtures"

DRAFT = "https://json-schema.org/draft/2020-12/schema"


def _read(path: Path) -> object:
    """Parse a JSON file, ASCII-only (repo convention). A non-ASCII byte fails the test."""
    return json.loads(path.read_text(encoding="ascii"))


def _schema(rel: str) -> dict:
    obj = _read(SCHEMAS / rel)
    assert isinstance(obj, dict)
    return obj


def _is_puzzle_file(p: Path) -> bool:
    """datasets/**/<date>-NNN.json - a dated, numbered generated manifest."""
    parts = p.stem.split("-")
    return len(parts) == 4 and parts[0].isdigit() and parts[3].isdigit()


# --- discover every schema (for meta-validation + evolution checks) --------------

ALL_SCHEMAS = sorted(
    p.relative_to(SCHEMAS).as_posix() for p in SCHEMAS.rglob("*.schema.json")
)


# --- build (instance, schema) pairs to prove every real JSON complies ------------


def _instance_cases() -> list:
    cases: list = []

    # config/*.json -> schemas/config/<name>.schema.json
    config_files = sorted(CONFIG.glob("*.json"))
    assert config_files, "no config/*.json found - path bug"
    for p in config_files:
        cases.append((p, f"config/{p.stem}.schema.json"))

    # datasets authoring inputs
    cases.append((DATASETS / "categories.json", "categories.schema.json"))
    template_files = sorted((DATASETS / "templates").glob("*.json"))
    assert template_files, "no datasets/templates/*.json found - path bug"
    for p in template_files:
        cases.append((p, "scenario-template.schema.json"))

    # datasets/**/<date>-NNN.json generated manifests
    dataset_puzzles = sorted(p for p in DATASETS.rglob("*.json") if _is_puzzle_file(p))
    assert dataset_puzzles, "no datasets/**/<date>-NNN.json found - path bug"
    for p in dataset_puzzles:
        cases.append((p, "puzzle-manifest.schema.json"))

    # frontend/public/puzzles/*.json - index.json is the BankIndex, the rest manifests
    served = sorted(PUZZLES.glob("*.json"))
    assert served, "no served puzzles found - path bug"
    for p in served:
        cases.append((p, "bank-index.schema.json" if p.name == "index.json" else "puzzle-manifest.schema.json"))

    # generated glyph manifest
    cases.append((GLYPHS / "index.json", "glyph-manifest.schema.json"))

    # save fixtures (v0 pre-versioned + v1)
    saves = sorted(FIXTURES.glob("save-v*.json"))
    assert saves, "no save-v*.json fixtures found - path bug"
    for p in saves:
        cases.append((p, "save.schema.json"))

    return cases


INSTANCE_CASES = _instance_cases()


def _case_id(case: tuple) -> str:
    path, schema = case
    return f"{path.relative_to(ROOT).as_posix()} -> {schema}"


# --- tests -----------------------------------------------------------------------


def test_schemas_discovered() -> None:
    """Every declared surface has a schema file on disk (guards a rename/path bug)."""
    expected = {
        "puzzle-manifest.schema.json",
        "bank-index.schema.json",
        "save.schema.json",
        "glyph-manifest.schema.json",
        "share-card.schema.json",
        "categories.schema.json",
        "scenario-template.schema.json",
        "config/tiers.schema.json",
        "config/dials.schema.json",
        "config/budgets.schema.json",
        "config/copy.schema.json",
        "config/ui.schema.json",
        "config/shapes.schema.json",
        "config/glyphpacks.schema.json",
        "config/palettes.schema.json",
        "config/retention.schema.json",
    }
    assert set(ALL_SCHEMAS) == expected


@pytest.mark.parametrize("rel", ALL_SCHEMAS)
def test_schema_is_valid_draft_2020_12(rel: str) -> None:
    """Each schema is a valid Draft 2020-12 schema with the required framing keywords."""
    schema = _schema(rel)
    Draft202012Validator.check_schema(schema)
    assert schema.get("$schema") == DRAFT, f"{rel}: $schema must be Draft 2020-12"
    sid = schema.get("$id")
    assert isinstance(sid, str) and sid, f"{rel}: $id required"
    assert "\\" not in sid and not sid.startswith("/") and ":" not in sid, (
        f"{rel}: $id must be a relative POSIX path, got {sid!r}"
    )
    for key in ("title", "description", "type"):
        assert isinstance(schema.get(key), str) and schema[key], f"{rel}: missing {key}"


@pytest.mark.parametrize("rel", ALL_SCHEMAS)
def test_schema_has_wellformed_evolution(rel: str) -> None:
    """Each schema embeds an evolution log with non-decreasing versions + real dates."""
    schema = _schema(rel)
    evo = schema.get("evolution")
    assert isinstance(evo, list) and evo, f"{rel}: evolution must be a non-empty list"
    prev: int | None = None
    for i, entry in enumerate(evo):
        assert isinstance(entry, dict), f"{rel}[{i}]: entry must be an object"
        assert set(entry) == {"version", "date", "change", "why"}, (
            f"{rel}[{i}]: keys must be version/date/change/why, got {sorted(entry)}"
        )
        version = entry["version"]
        assert isinstance(version, int) and not isinstance(version, bool), (
            f"{rel}[{i}]: version must be an int"
        )
        # a real calendar date in YYYY-MM-DD (raises ValueError on a bad date)
        assert datetime.strptime(entry["date"], "%Y-%m-%d")
        for field in ("change", "why"):
            assert isinstance(entry[field], str) and entry[field].strip(), (
                f"{rel}[{i}]: {field} must be a non-empty string"
            )
        if prev is not None:
            assert version >= prev, f"{rel}[{i}]: versions must be non-decreasing ({prev} -> {version})"
        prev = version


@pytest.mark.parametrize("case", INSTANCE_CASES, ids=[_case_id(c) for c in INSTANCE_CASES])
def test_real_json_complies(case: tuple) -> None:
    """Every real config + persisted/bundle JSON validates against its schema (PASSES)."""
    path, schema_rel = case
    schema = _schema(schema_rel)
    instance = _read(path)
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(instance), key=lambda e: list(e.path))
    assert not errors, "\n".join(
        f"{path.relative_to(ROOT).as_posix()}: /{'/'.join(map(str, e.path))} {e.message}"
        for e in errors
    )


def test_manifest_schema_requires_story_and_kind_anchor() -> None:
    """The v2 manifest schema is STRICT: a served story-first manifest validates, but a pre-pivot
    shape (a required story field stripped, or a category's kind/anchor stripped, or the retired
    `ordinal` field present, or a non-grid shapeId) is REJECTED. story-first + matrix-only is the
    contract at v2, not a tolerance."""
    schema = _schema("puzzle-manifest.schema.json")
    validator = Draft202012Validator(schema)
    story = _read(PUZZLES / "2026-07-01-standard.json")
    validator.validate(story)  # required scenarioId/story/subjectNoun/variant + per-cat kind/anchor
    assert story["schemaVersion"] == 2 and story["shapeId"] == "grid"

    for key in ("scenarioId", "story", "subjectNoun", "variant"):  # a missing story field is rejected
        missing = {k: v for k, v in story.items() if k != key}
        assert list(validator.iter_errors(missing)), f"missing {key} must be rejected"

    for key in ("kind", "anchor"):  # a category missing its required kind/anchor is rejected
        stripped = copy.deepcopy(story)
        stripped["categories"]["list"][0].pop(key, None)
        assert list(validator.iter_errors(stripped)), f"category missing {key} must be rejected"

    with_ordinal = copy.deepcopy(story)  # the retired boolean `ordinal` field is no longer allowed
    with_ordinal["categories"]["list"][0]["ordinal"] = False
    assert list(validator.iter_errors(with_ordinal)), "retired category ordinal must be rejected"

    assert list(validator.iter_errors({**story, "shapeId": "seating-row"})), "non-grid shape rejected"


def test_manifest_schema_rejects_present_null_optionals() -> None:
    """The v2 schema forbids present-null. The served/daily emit uses exclude_none, so an optional
    is OMITTED when unset; a null (required OR optional) signals a real emit bug and is rejected."""
    schema = _schema("puzzle-manifest.schema.json")
    validator = Draft202012Validator(schema)
    base = _read(PUZZLES / "2026-07-01-standard.json")
    for key in ("story", "scenarioId", "subjectNoun", "variant"):
        assert list(validator.iter_errors({**base, key: None})), f"{key}:null must be rejected"
    # a per-category null optional is rejected too (unit stays optional at v2)
    cat_null = copy.deepcopy(base)
    cat_null["categories"]["list"][0]["unit"] = None
    assert list(validator.iter_errors(cat_null)), "category unit:null must be rejected"


def test_save_schema_accepts_v0_and_v1() -> None:
    """The save schema accepts a pre-versioned v0 save (no schemaVersion, no puckSize)
    and a v1 save (no puckSize) - the migrating surface's tolerance contract."""
    schema = _schema("save.schema.json")
    validator = Draft202012Validator(schema)
    v0 = _read(FIXTURES / "save-v0.json")
    v1 = _read(FIXTURES / "save-v1.json")
    validator.validate(v0)
    validator.validate(v1)
    assert "schemaVersion" not in v0 and v1["schemaVersion"] == 1
    assert "puckSize" not in v0["settings"] and "puckSize" not in v1["settings"]
