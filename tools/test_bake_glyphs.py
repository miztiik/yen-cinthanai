"""Contract + determinism tests for tools/bake_glyphs.py (GlyphManifest v2).

Real tmp fixtures, no mocks (CLAUDE.md #7). Asserts STRUCTURE + INVARIANTS, never brittle
counts: the bake walks whatever SVGs exist; the rules are "slug/file/label per glyph",
"lowercase kebab filenames", "no slug collision", and "byte-identical rebuild bar the stamp".
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pytest

from bake_glyphs import (
    BUDGETS,
    SCHEMA_VERSION,
    _max_svg_bytes,
    build_manifest,
    label_of,
    slug_of,
    write_manifest,
)

FIXED = datetime(2026, 6, 29, tzinfo=timezone.utc)
STAMP_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


def _tree(root: Path) -> Path:
    g = root / "glyphs"
    (g / "creatures").mkdir(parents=True)
    (g / "vegetables").mkdir(parents=True)
    for rel in ("creatures/cat.svg", "creatures/owl.svg", "vegetables/bell-pepper.svg"):
        (g / rel).write_text("<svg/>", encoding="ascii")
    return g


def test_v2_shape_slug_file_label(tmp_path: Path) -> None:
    m = build_manifest(_tree(tmp_path), now=FIXED)
    assert m["schemaVersion"] == SCHEMA_VERSION == 2
    assert STAMP_RE.match(m["generatedAt"])
    veg = m["packs"]["vegetables"]
    assert "bellpepper" in veg  # slug = key, kebab hyphens dropped
    assert veg["bellpepper"] == {"file": "vegetables/bell-pepper.svg", "label": "Bell pepper"}


def test_slug_and_label_helpers() -> None:
    assert slug_of("bell-pepper") == "bellpepper"
    assert slug_of("washing-machine") == "washingmachine"
    assert label_of("bell-pepper") == "Bell pepper"
    assert label_of("monkey1") == "Monkey 1"


def test_all_slugs_are_one_token(tmp_path: Path) -> None:
    m = build_manifest(_tree(tmp_path), now=FIXED)
    for pack in m["packs"].values():
        for slug in pack:
            assert re.fullmatch(r"[a-z0-9]+", slug), slug


def test_dirty_filename_fails(tmp_path: Path) -> None:
    g = _tree(tmp_path)
    (g / "creatures" / "Fish_.svg").write_text("<svg/>", encoding="ascii")  # caps + underscore
    with pytest.raises(ValueError, match=r"Fish_\.svg"):
        build_manifest(g, now=FIXED)


def test_slug_collision_fails(tmp_path: Path) -> None:
    g = _tree(tmp_path)
    (g / "vegetables" / "bellpepper.svg").write_text("<svg/>", encoding="ascii")  # collides with bell-pepper
    with pytest.raises(ValueError, match=r"collides"):
        build_manifest(g, now=FIXED)


def test_content_deterministic_stamp_is_not(tmp_path: Path) -> None:
    g = _tree(tmp_path)
    a = build_manifest(g, now=FIXED)
    b = build_manifest(g, now=datetime(2027, 1, 1, 12, tzinfo=timezone.utc))
    assert a["packs"] == b["packs"]  # gameplay content independent of bake time
    assert a["generatedAt"] != b["generatedAt"]


def test_write_is_canonical(tmp_path: Path) -> None:
    g = _tree(tmp_path)
    m = build_manifest(g, now=FIXED)
    out = tmp_path / "index.json"
    first = write_manifest(m, out).read_text("ascii")
    second = write_manifest(build_manifest(g, now=FIXED), out).read_text("ascii")
    assert first == second and first.endswith("\n")
    assert first == json.dumps(m, sort_keys=True, ensure_ascii=True, indent=2) + "\n"


def test_oversized_svg_fails(tmp_path: Path) -> None:
    """A glyph heavier than max_svg_bytes fails the bake, naming the offender (byte guard)."""
    g = _tree(tmp_path)
    (g / "creatures" / "huge.svg").write_bytes(b"<svg>" + b"x" * 300 + b"</svg>")
    with pytest.raises(ValueError, match=r"creatures/huge\.svg: \d+ bytes exceeds"):
        build_manifest(g, now=FIXED, max_svg_bytes=100)


def test_ceiling_read_from_config(tmp_path: Path) -> None:
    """The guard reads its ceiling from config/budgets.json - no hardcoded number in code."""
    budgets = tmp_path / "budgets.json"
    budgets.write_text('{"glyphs": {"max_svg_bytes": 4242}}', encoding="ascii")
    assert _max_svg_bytes(budgets) == 4242
    # the committed config carries a real, positive ceiling that the default guard uses
    committed = json.loads(BUDGETS.read_text(encoding="ascii"))["glyphs"]["max_svg_bytes"]
    assert _max_svg_bytes() == committed
    assert committed > 0


def test_flags_pack_auto_discovered_and_within_ceiling() -> None:
    """The real tree bakes clean: the flags pack is auto-discovered and every SVG (post-SVGO)
    clears the config ceiling, so the default byte guard raises nothing."""
    m = build_manifest()  # real dir + config ceiling, no override
    assert len(m["packs"].get("flags", {})) > 0
