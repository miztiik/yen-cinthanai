"""Glyph-coverage auditor: which scenario categories can render as glyph images, which
fall back to text, and exactly which image files are missing to close the gap.

The render contract (frontend): a category shows glyph images ONLY when EVERY one of its
values resolves to an existing image; otherwise the whole column falls back to green checks
- never a mix. This tool reports, per scenario category, one of:

  text      - no value carries a glyph (all green checks by design; fine)
  complete  - every value resolves to an existing image (renders as images)
  partial   - SOME values resolve to an image and others do not (would mix) -> falls back
              to text until the missing images exist

For every `partial` category it lists the missing refs (a referenced '<pack>.<slug>' with no
file) and the value labels that still need art. The tail aggregates the distinct missing refs
grouped by pack - the shopping list. Read-only; prints a report and exits non-zero if any
category is `partial` (so CI/authors notice regressions). Run:

    python -m tools.audit_glyphs            # human report
    python -m tools.audit_glyphs --md       # markdown (for the TODO doc)

See tools/generate.py `_value_glyph` (the resolution this mirrors) and docs/concepts/ui-shell.md.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = _ROOT / "datasets" / "templates"
GLYPH_INDEX = _ROOT / "frontend" / "public" / "assets" / "glyphs" / "index.json"


def available_refs() -> set[str]:
    """Every '<pack>.<slug>' that has a baked image file (the source of truth)."""
    data = json.loads(GLYPH_INDEX.read_text(encoding="utf-8"))
    refs: set[str] = set()
    for pack, slugs in data.get("packs", {}).items():
        for slug in slugs:
            refs.add(f"{pack}.{slug}")
    return refs


def value_glyph(glyph_pack: str | None, value: dict) -> str:
    """Mirror of generate.py `_value_glyph`: explicit per-value `glyph` wins (incl. '' = force
    text); else the category glyphPack decorates as '<pack>.<id>'; else '' (text-only)."""
    if "glyph" in value:
        return value["glyph"]
    return f"{glyph_pack}.{value['id']}" if glyph_pack else ""


class CatReport:
    def __init__(self, scenario: str, cat_id: str, cat_label: str):
        self.scenario = scenario
        self.cat_id = cat_id
        self.cat_label = cat_label
        self.status = "text"
        self.missing_refs: list[str] = []       # referenced '<pack>.<slug>' with no file
        self.text_values: list[str] = []        # value labels with no glyph while siblings have one


def audit_category(scenario: str, cat: dict, have: set[str]) -> CatReport:
    rep = CatReport(scenario, cat.get("id", "?"), cat.get("label", "?"))
    gp = cat.get("glyphPack")
    values = cat.get("valuePool", [])
    resolved = [(v, value_glyph(gp, v)) for v in values]
    non_empty = [(v, r) for v, r in resolved if r]
    if not non_empty:
        rep.status = "text"
        return rep
    all_present = True
    for v, ref in resolved:
        if not ref:
            rep.text_values.append(v.get("label", v.get("id", "?")))
            all_present = False
        elif ref not in have:
            rep.missing_refs.append(ref)
            all_present = False
    rep.status = "complete" if all_present else "partial"
    return rep


def audit() -> list[CatReport]:
    have = available_refs()
    reports: list[CatReport] = []
    for path in sorted(TEMPLATES_DIR.glob("*.json")):
        if path.name == "manifest.json":
            continue
        tpl = json.loads(path.read_text(encoding="utf-8"))
        for cat in tpl.get("categories", []):
            reports.append(audit_category(tpl.get("id", path.stem), cat, have))
    return reports


def render_text(reports: list[CatReport]) -> tuple[str, int]:
    partial = [r for r in reports if r.status == "partial"]
    complete = sum(1 for r in reports if r.status == "complete")
    text = sum(1 for r in reports if r.status == "text")
    lines: list[str] = []
    lines.append(f"scenarios: {len({r.scenario for r in reports})}  categories: {len(reports)}")
    lines.append(f"  complete (all images): {complete}")
    lines.append(f"  text     (all checks): {text}")
    lines.append(f"  partial  (would mix)  : {len(partial)}")
    lines.append("")
    if partial:
        lines.append("PARTIAL categories (fall back to text until fixed):")
        for r in sorted(partial, key=lambda x: (x.scenario, x.cat_id)):
            bits = []
            if r.missing_refs:
                bits.append("missing files: " + ", ".join(sorted(set(r.missing_refs))))
            if r.text_values:
                bits.append("no-glyph values: " + ", ".join(r.text_values))
            lines.append(f"  {r.scenario} / {r.cat_label} ({r.cat_id}) - " + "; ".join(bits))
        lines.append("")
    by_pack: dict[str, set[str]] = defaultdict(set)
    for r in partial:
        for ref in r.missing_refs:
            by_pack[ref.split(".", 1)[0]].add(ref)
    if by_pack:
        lines.append("MISSING IMAGE FILES (referenced by a template, no .svg present):")
        for pack in sorted(by_pack):
            lines.append(f"  {pack}: " + ", ".join(sorted(by_pack[pack])))
    return "\n".join(lines), len(partial)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Audit scenario glyph coverage (no-mix contract).")
    ap.add_argument("--md", action="store_true", help="emit markdown for the TODO doc")
    args = ap.parse_args(argv)
    reports = audit()
    report_text, n_partial = render_text(reports)
    print(report_text)
    return 1 if n_partial else 0


if __name__ == "__main__":
    raise SystemExit(main())
