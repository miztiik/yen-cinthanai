"""Round-trip: config/*.toml bakes to canonical JSON; rebuild is byte-identical."""

import json
import tomllib
from pathlib import Path

from bake_config import CONFIGS, bake_all

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"


def test_bake_round_trip(tmp_path: Path) -> None:
    out = bake_all(CONFIG_DIR, tmp_path)
    assert {p.name for p in out} == {f"{n}.json" for n in CONFIGS}
    for name in CONFIGS:
        src = tomllib.loads((CONFIG_DIR / f"{name}.toml").read_text(encoding="ascii"))
        baked = json.loads((tmp_path / f"{name}.json").read_text(encoding="ascii"))
        assert baked == src


def test_bake_is_deterministic(tmp_path: Path) -> None:
    first = bake_all(CONFIG_DIR, tmp_path)[0].read_text(encoding="ascii")
    second = bake_all(CONFIG_DIR, tmp_path)[0].read_text(encoding="ascii")
    assert first == second  # canonical (sorted, ASCII) -> rebuild matches


def test_tiers_par_survives_bake(tmp_path: Path) -> None:
    bake_all(CONFIG_DIR, tmp_path)
    tiers = json.loads((tmp_path / "tiers.json").read_text(encoding="ascii"))
    assert tiers["easy"]["par_s"] == 90 and tiers["expert"]["par_s"] == 900
