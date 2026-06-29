"""Bake human-edited config/*.toml into runtime config/*.json.

Python is the one build language (CLAUDE.md). The game reads only baked JSON; it
never parses TOML at runtime. Output is canonical (sorted keys, ASCII, trailing
newline) so a rebuild is byte-identical - the determinism gate. POSIX paths.

See docs/architecture/runtime/stack-and-bundle.md and config/*.toml.
"""

from __future__ import annotations

import json
import tomllib
from pathlib import Path

CONFIGS = ("tiers", "shapes", "glyphpacks", "copy", "retention")

_ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = _ROOT / "config"
OUT_DIR = _ROOT / "frontend" / "public" / "config"


def bake_one(name: str, config_dir: Path, out_dir: Path) -> Path:
    """Read config/<name>.toml, write public/config/<name>.json, return out path."""
    data = tomllib.loads((config_dir / f"{name}.toml").read_text(encoding="ascii"))
    out = out_dir / f"{name}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(data, sort_keys=True, ensure_ascii=True, indent=2) + "\n",
        encoding="ascii",
    )
    return out


def bake_all(config_dir: Path = CONFIG_DIR, out_dir: Path = OUT_DIR) -> list[Path]:
    return [bake_one(name, config_dir, out_dir) for name in CONFIGS]


if __name__ == "__main__":
    for path in bake_all():
        print(path.relative_to(_ROOT).as_posix())
