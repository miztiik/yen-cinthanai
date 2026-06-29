"""Canonical contract models (build-time source of truth).

Pydantic 2.11, strict, ASCII. One model per persisted surface, each carrying a
schemaVersion. Bank/manifest/share are bundle-shipped (rewrite-in-place); Save is
the only migrating surface. The TS readers in frontend/src/contracts mirror these.
Types only - no game logic. PAR/stars read from config/tiers.toml (no hardcoding).

See docs/architecture/contracts/schemas.md and docs/concepts/difficulty-and-scoring.md.
"""

from __future__ import annotations

import tomllib
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Tier = Literal["easy", "standard", "sharp", "expert"]
ShapeId = Literal["grid", "seating-row", "round-table"]
Cardinality = Literal["bijective", "shared"]
DayStatus = Literal["unplayed", "playing", "won", "lost"]

SCHEMA_VERSION = 1


class _Strict(BaseModel):
    """Strict, no extra fields - fail fast at the boundary (CLAUDE.md anti-patterns)."""

    model_config = ConfigDict(strict=True, extra="forbid")


# --- PuzzleManifest -------------------------------------------------------------


class AttributeValue(_Strict):
    id: str
    glyph: str
    label: str


class AttributeCategory(_Strict):
    id: str
    label: str
    ordinal: bool
    cardinality: Cardinality
    values: list[AttributeValue]


class Operand(_Strict):
    cat: str
    value: str


class Constraint(_Strict):
    id: str
    type: str
    operands: list[Operand]
    params: dict[str, int | str]
    clueText: str
    renderHint: str


class HintForce(_Strict):
    entity: str
    cat: str
    value: str


class HintStep(_Strict):
    fromClues: list[str]
    forces: HintForce


class Categories(_Strict):
    n: int
    items: list[AttributeCategory] = Field(alias="list")


class PuzzleManifest(_Strict):
    schemaVersion: Literal[1]
    puzzleId: str
    tier: Tier
    shapeId: ShapeId
    templateRev: int
    entities: list[str]
    categories: Categories
    constraints: list[Constraint]
    solution: dict[str, dict[str, str]]
    hintTrace: list[HintStep]


# --- BankIndex ------------------------------------------------------------------


class BankEntry(_Strict):
    date: str
    tier: Tier
    shapeId: ShapeId
    file: str
    sha: str


class BankIndex(_Strict):
    schemaVersion: Literal[1]
    generatedSeed: str
    builtAt: str
    puzzles: list[BankEntry]


# --- Save (migrating surface) ---------------------------------------------------


class DayState(_Strict):
    date: str
    tier: Tier
    shapeId: ShapeId
    status: DayStatus
    placements: dict[str, dict[str, str]]
    attempts: int
    solveMs: int
    hintsUsed: int
    stars: int


class Hero(_Strict):
    bestMs: int
    date: str


class Streak(_Strict):
    count: int
    lastDate: str
    skipsLeft: int


class Settings(_Strict):
    sound: bool
    volume: int
    theme: str
    palette: str
    reducedMotion: bool


class Save(_Strict):
    schemaVersion: Literal[1]
    days: dict[str, DayState]
    hero: Hero
    streak: Streak
    settings: Settings


# --- ShareCard (built from DayState stats only; no leak) ------------------------


class ShareCard(_Strict):
    schemaVersion: Literal[1]
    date: str
    tier: Tier
    shapeGlyph: str
    status: DayStatus
    moves: int
    wrong: int
    solveMs: int
    hintsUsed: int
    streak: int


# --- PAR / stars (config-driven; no hardcoding) ---------------------------------

_CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"


def par_seconds(tier: Tier, config_dir: Path = _CONFIG_DIR) -> int:
    """PAR for a tier, read from config/tiers.toml. Raises if absent (fail fast)."""
    data = tomllib.loads((config_dir / "tiers.toml").read_text(encoding="ascii"))
    return int(data[tier]["par_s"])


def compute_stars(
    tier: Tier,
    solve_ms: int,
    hints_used: int,
    wrong: int,
    config_dir: Path = _CONFIG_DIR,
) -> int:
    """1=solved, 2=+0 hints, 3=+0 hints+0 wrong+solveMs<=PAR. PAR from config."""
    stars = 1
    if hints_used == 0:
        stars = 2
        if wrong == 0 and solve_ms <= par_seconds(tier, config_dir) * 1000:
            stars = 3
    return stars
