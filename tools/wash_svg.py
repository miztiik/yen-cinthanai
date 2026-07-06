"""Wash (optimize) SVG glyphs via SVGO so an oversized SVG fits the glyph byte ceiling.

A thin, reusable wrapper over `npx svgo` - the same optimizer used to shrink the flower
pack from multi-MB illustrations down to a few KB. Run it on a single SVG or a whole pack
folder to produce optimized copies (or edit in place). The bake byte-ceiling guard
(config/budgets.json max_svg_bytes, enforced by tools/bake_glyphs.py) is the GATE; this is
the tool that gets an oversized SVG under it.

Usage:
  python -m tools.wash_svg <path.svg | pack-folder> [--precision N] [--in-place] [--suffix -1]

Prints before/after bytes and flags anything still over the ceiling (nonzero exit if any
remain over). Build-time only; requires Node + npx (svgo is fetched by npx on first use);
never shipped to the browser bundle. See docs/reference/glyph-coverage.md.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_CEILING = 73728  # 72 KiB fallback if budgets.json lacks the key


def svg_ceiling() -> int:
    """The max glyph SVG byte budget, read from config/budgets.json (fail-soft to default)."""
    try:
        data = json.loads((_ROOT / "config" / "budgets.json").read_text(encoding="ascii"))
    except (FileNotFoundError, ValueError):
        return _DEFAULT_CEILING
    if isinstance(data.get("max_svg_bytes"), int):
        return int(data["max_svg_bytes"])
    glyph = data.get("glyph")
    if isinstance(glyph, dict) and isinstance(glyph.get("max_svg_bytes"), int):
        return int(glyph["max_svg_bytes"])
    return _DEFAULT_CEILING


def wash_one(src: Path, precision: int, in_place: bool, suffix: str) -> Path:
    """Run SVGO on `src`; return the written path. `in_place` overwrites; else `<stem><suffix>.svg`."""
    out = src if in_place else src.with_name(f"{src.stem}{suffix}.svg")
    subprocess.run(
        ["npx", "--yes", "svgo", str(src), "-o", str(out), f"--precision={precision}", "--multipass"],
        check=True,
        shell=(sys.platform == "win32"),
    )
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Optimize SVG glyph(s) via SVGO to fit the byte ceiling.")
    ap.add_argument("path", help="a single .svg or a pack folder (all *.svg washed)")
    ap.add_argument("--precision", type=int, default=1, help="SVGO numeric precision (lower = smaller)")
    ap.add_argument("--in-place", action="store_true", help="overwrite the source instead of writing a copy")
    ap.add_argument("--suffix", default="-1", help="copy suffix when not in-place (default: -1)")
    args = ap.parse_args(argv)

    root = Path(args.path)
    files = sorted(p for p in root.glob("*.svg") if not p.stem.endswith(args.suffix)) if root.is_dir() else [root]
    cap = svg_ceiling()
    over = 0
    for f in files:
        before = f.stat().st_size
        out = wash_one(f, args.precision, args.in_place, args.suffix)
        after = out.stat().st_size
        flag = "  <- STILL OVER CEILING (re-source as flat art)" if after > cap else ""
        if after > cap:
            over += 1
        print(f"{f.name}: {before} -> {after} bytes{flag}")
    print(f"ceiling={cap} bytes; {over} file(s) still over.")
    return 1 if over else 0


if __name__ == "__main__":
    raise SystemExit(main())
