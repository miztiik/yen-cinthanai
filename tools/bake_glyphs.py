"""Bake the glyph manifest (frontend/public/assets/glyphs/index.json) from the asset tree.

Auto-discovering: every <pack>/ directory is a puzzle DIMENSION and every <name>.svg in it
is a value. Drop a new SVG - or a whole new collection folder - and the next bake picks it
up; nothing here is hand-listed. The manifest is GENERATED, never hand-kept (the old hand
list had already gone stale, still pointing at deleted color/violet.svg + household/cola.svg).

Each glyph carries the three things the frontend + generator need:
  - slug : stable [a-z0-9]+ reference id, used as "pack.slug". Derived from the filename by
           dropping kebab hyphens (bell-pepper -> bellpepper). Unique within a pack.
  - file : the real filename, kept in OUR convention (lowercase kebab-case), so a descriptive
           name like vegetables/bell-pepper.svg survives even though the slug is "bellpepper".
  - label: readable text derived from the filename (bell-pepper -> "Bell pepper").

Manifest (GlyphManifest v2, bundle-shipped, rewrite-in-place, no migration):
  { schemaVersion:2, generatedAt:"<UTC ISO Z>",
    packs:{ <pack>:{ <slug>:{ file:"<pack>/<name>.svg", label:"..." } } } }

generatedAt is provenance only - excluded from any gameplay/determinism hash (mirrors
BankIndex.builtAt); a re-bake runs only when assets change. Filenames must be lowercase
kebab-case (^[a-z0-9]+(-[a-z0-9]+)*$); the bake fails loudly on anything else and on slug
collisions, so the tree stays disciplined. Canonical ASCII, POSIX, sorted, trailing newline.
See docs/architecture/generator/pipeline.md and docs/architecture/contracts/schemas.md.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

SCHEMA_VERSION = 2
NAME_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")  # lowercase kebab-case filename stem

_ROOT = Path(__file__).resolve().parent.parent
GLYPHS_DIR = _ROOT / "frontend" / "public" / "assets" / "glyphs"
OUT = GLYPHS_DIR / "index.json"


def slug_of(stem: str) -> str:
    """Stable [a-z0-9]+ id from a kebab filename (bell-pepper -> bellpepper)."""
    return stem.replace("-", "")


def label_of(stem: str) -> str:
    """Readable label from a kebab filename (bell-pepper -> 'Bell pepper', monkey1 -> 'Monkey 1')."""
    words = re.sub(r"(?<=[a-z])(\d+)\b", r" \1", stem.replace("-", " ")).strip()
    return words[:1].upper() + words[1:]


def _stamp(now: datetime | None) -> str:
    dt = (now or datetime.now(timezone.utc)).astimezone(timezone.utc).replace(microsecond=0)
    return dt.isoformat().replace("+00:00", "Z")


def build_manifest(glyphs_dir: Path = GLYPHS_DIR, now: datetime | None = None) -> dict:
    """Walk glyphs_dir/<pack>/<name>.svg into a v2 manifest dict. Raises ValueError listing
    every naming violation or slug collision (fail fast - never emit an unusable id)."""
    packs: dict[str, dict] = {}
    violations: list[str] = []
    for pack_dir in sorted(p for p in glyphs_dir.iterdir() if p.is_dir()):
        pack = pack_dir.name
        if not NAME_RE.match(pack):
            violations.append(f"pack dir '{pack}' must be lowercase kebab-case")
        glyphs: dict[str, dict] = {}
        for svg in sorted(pack_dir.glob("*.svg")):
            stem = svg.stem
            if not NAME_RE.match(stem):
                violations.append(f"{pack}/{svg.name}: not lowercase kebab-case (no '_', spaces, caps, edge '-')")
                continue
            slug = slug_of(stem)
            if slug in glyphs:
                violations.append(f"{pack}/{svg.name}: slug '{slug}' collides with {glyphs[slug]['file']}")
                continue
            glyphs[slug] = {"file": f"{pack}/{stem}.svg", "label": label_of(stem)}
        packs[pack] = glyphs
    if violations:
        raise ValueError("glyph manifest violations:\n  " + "\n  ".join(violations))
    return {"schemaVersion": SCHEMA_VERSION, "generatedAt": _stamp(now), "packs": packs}


def write_manifest(manifest: dict, out: Path = OUT) -> Path:
    """Write canonical JSON (sorted, ASCII, trailing newline). Returns the out path."""
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(manifest, sort_keys=True, ensure_ascii=True, indent=2) + "\n",
        encoding="ascii",
    )
    return out


if __name__ == "__main__":
    m = build_manifest()
    p = write_manifest(m)
    total = sum(len(g) for g in m["packs"].values())
    print(f"{p.relative_to(_ROOT).as_posix()}  generatedAt={m['generatedAt']}  packs={len(m['packs'])}  glyphs={total}")
