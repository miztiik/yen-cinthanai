"""Build-time authoring loaders for the story-first corpus (Row 3 consumes these).

Strict, ASCII, fail-fast Pydantic models for the human-authored inputs under
datasets/: the category value pools (the dimension source) and the scenario
templates (narrative + clue templates). These are BUILD-TIME inputs only - not
wired into tools/generate.py yet. The emitted PuzzleManifest lives in models.py.

See TODO/2026-07-01-story-first-pivot.md, datasets/categories.json and
datasets/templates/weekend-market.json.
"""

from __future__ import annotations

import hashlib
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
    glyph: str | None = None


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


# --- templates/manifest.json (the scenario CATALOG index) -----------------------

Status = Literal["live", "build"]
MANIFEST_FILENAME = "manifest.json"


class ScenarioManifestEntry(_Strict):
    """One catalogued scenario. `status` gates the daily rotation: 'live' scenarios rotate into
    the served bank; a 'build' scenario is staged (authorable + testable via --scenario) but kept
    OUT of the live rotation. tone/kind are free-form editorial tags. file == '<id>.json'.

    `verifiedSha` is the OPTIONAL build-cache stamp written by `tools/verify_scenarios.py --stamp`:
    the content-address (`scenario_fingerprint`) at which this scenario last passed full multi-tier
    verification. When it matches the current fingerprint the incremental check SKIPS re-verifying
    the scenario, so CI verifies only CHANGED scenarios (bounded regardless of catalog size). It is
    optional so an unstamped/new scenario simply always verifies; absent == never verified."""

    id: str
    file: str
    title: str
    tone: str
    kind: str
    status: Status
    verifiedSha: str | None = None


class ScenarioManifest(_Strict):
    schemaVersion: int
    scenarios: list[ScenarioManifestEntry]
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


# --- scenario catalog (manifest-driven per-date selection + build/live staging) --


def load_scenario_manifest(templates_dir: Path = _DATASETS_DIR / "templates") -> ScenarioManifest:
    """Parse + validate the scenario catalog index (templates_dir/manifest.json), then reconcile it
    with the templates on disk: every listed `file` must exist (and be named '<id>.json'), and every
    *.json template on disk (except the manifest itself) must be listed - no orphans, no dangling
    entries, no duplicate ids. Fail fast at the boundary (CLAUDE.md anti-patterns) so a mis-staged
    scenario is caught at build time rather than silently dropped from - or into - the daily bank."""
    templates_dir = Path(templates_dir)
    manifest = ScenarioManifest.model_validate(_read_json(templates_dir / MANIFEST_FILENAME))
    ids = [e.id for e in manifest.scenarios]
    if len(ids) != len(set(ids)):
        raise ValueError(f"duplicate scenario id in {MANIFEST_FILENAME}: {sorted(ids)}")
    listed: set[str] = set()
    for e in manifest.scenarios:
        if e.file != f"{e.id}.json":
            raise ValueError(f"manifest entry {e.id!r}: file must be '{e.id}.json', got {e.file!r}")
        if not (templates_dir / e.file).exists():
            raise FileNotFoundError(
                f"manifest lists {e.file!r} but it is missing under {templates_dir.as_posix()}"
            )
        listed.add(e.file)
    on_disk = {p.name for p in templates_dir.glob("*.json") if p.name != MANIFEST_FILENAME}
    orphans = sorted(on_disk - listed)
    if orphans:
        raise ValueError(f"scenario templates on disk are not listed in {MANIFEST_FILENAME}: {orphans}")
    return manifest


def live_scenario_ids(manifest: ScenarioManifest) -> list[str]:
    """The sorted ids of the scenarios in the LIVE daily rotation (status == 'live'). Sorted so the
    per-date picker indexes a stable order independent of the manifest's authoring order."""
    return sorted(e.id for e in manifest.scenarios if e.status == "live")


def list_scenario_paths(templates_dir: Path = _DATASETS_DIR / "templates") -> list[Path]:
    """Every authored scenario template file on disk, sorted by filename (the manifest index is
    excluded). Filename == scenario id (weekend-market.json -> weekend-market)."""
    return sorted(p for p in Path(templates_dir).glob("*.json") if p.name != MANIFEST_FILENAME)


def scenario_path_for_date(date: str, templates_dir: Path = _DATASETS_DIR / "templates") -> Path:
    """Pick one LIVE scenario for a date deterministically: a stable hash of the date modulo the
    number of live scenarios, indexing the sorted live ids from the manifest. Consecutive dates
    vary while the same date always resolves to the same scenario, so all four tiers of a date
    share one scenario (sliced per tier) and a rebuild is byte-identical. Only status=='live'
    scenarios rotate - a 'build' scenario is staged out of the daily bank (see scenario_path_by_id)."""
    templates_dir = Path(templates_dir)
    live = live_scenario_ids(load_scenario_manifest(templates_dir))
    if not live:
        raise FileNotFoundError(f"no live scenarios in {(templates_dir / MANIFEST_FILENAME).as_posix()}")
    idx = int(hashlib.sha256(date.encode("ascii")).hexdigest()[:8], 16) % len(live)
    return templates_dir / f"{live[idx]}.json"


def scenario_path_by_id(scenario_id: str, templates_dir: Path = _DATASETS_DIR / "templates") -> Path:
    """Resolve ANY manifest scenario (live OR build) by id to its template path - the escape hatch
    that lets `generate.py --scenario <id>` author + test a staged 'build' scenario that is not yet
    in the live daily rotation. Raises if the id is not in the manifest."""
    templates_dir = Path(templates_dir)
    manifest = load_scenario_manifest(templates_dir)
    entry = next((e for e in manifest.scenarios if e.id == scenario_id), None)
    if entry is None:
        known = ", ".join(sorted(e.id for e in manifest.scenarios))
        raise KeyError(f"unknown scenario id {scenario_id!r} (manifest has: {known})")
    return templates_dir / entry.file

