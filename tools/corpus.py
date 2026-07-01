"""Build-time authoring loaders for the story-first corpus (Row 3 consumes these).

Strict, ASCII, fail-fast Pydantic models for the human-authored inputs under
datasets/: the category value pools (the dimension source) and the scenario
templates (narrative + clue templates). These are BUILD-TIME inputs only - not
wired into tools/generate.py yet. The emitted PuzzleManifest lives in models.py.

See TODO/2026-07-01-story-first-pivot.md, datasets/categories.json and
datasets/templates/weekend-market.json.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict

from models import Tier

Kind = Literal["nominal", "ordinal", "numeric"]

_DATASETS_DIR = Path(__file__).resolve().parent.parent / "datasets"


class _Strict(BaseModel):
    """Strict, no extra fields - fail fast at the boundary (CLAUDE.md anti-patterns)."""

    model_config = ConfigDict(strict=True, extra="forbid")


# --- categories.json (the dimension source) -------------------------------------


class CategoryValue(_Strict):
    id: str
    label: str
    magnitude: int | None = None


class CategoryPool(_Strict):
    label: str
    kind: Kind
    values: list[CategoryValue]
    glyphPack: str | None = None
    unit: str | None = None
    note: str | None = None


class CategoriesFile(_Strict):
    schemaVersion: int
    categories: dict[str, CategoryPool]
    note: str | None = None


# --- templates/<scenario>.json (narrative + clue templates) ---------------------


class TemplateValue(_Strict):
    id: str
    label: str
    magnitude: int | None = None
    phrase: str | None = None
    refPhrase: str | None = None


class TemplateCategory(_Strict):
    id: str
    label: str
    kind: Kind
    valuePool: list[TemplateValue]
    anchor: bool | None = None
    unit: str | None = None
    glyphPack: str | None = None


class ClueTemplate(_Strict):
    minTier: Tier
    variants: list[str]
    appliesTo: str | None = None
    note: str | None = None


class Indirection(_Strict):
    byTier: dict[Tier, str]
    note: str | None = None


class ScenarioTemplate(_Strict):
    schemaVersion: int
    id: str
    title: str
    subjectNoun: str
    subjectCategory: str
    ordinalAxis: bool
    minTier: Tier
    maxTier: Tier
    narrativeTemplate: str
    flavorPools: dict[str, list[str]]
    indirection: Indirection
    categories: list[TemplateCategory]
    clueTemplates: dict[str, ClueTemplate]
    note: str | None = None


# --- loaders --------------------------------------------------------------------


def _read_json(path: Path) -> object:
    """Read + parse a JSON authoring file. ASCII-only (repo convention); fail fast."""
    return json.loads(Path(path).read_text(encoding="ascii"))


def load_categories(path: Path = _DATASETS_DIR / "categories.json") -> CategoriesFile:
    """Parse + validate the category dimension source. Raises on malformed input."""
    return CategoriesFile.model_validate(_read_json(path))


def load_scenario_template(
    path: Path = _DATASETS_DIR / "templates" / "weekend-market.json",
) -> ScenarioTemplate:
    """Parse + validate a scenario template. Raises on malformed input."""
    return ScenarioTemplate.model_validate(_read_json(path))
