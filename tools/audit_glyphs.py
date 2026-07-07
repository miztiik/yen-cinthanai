"""Glyph-coverage auditor: which categories can render as glyph images, which fall back to
text, and exactly which image files are missing to close the gap. It scans BOTH sources of
glyph-backed categories - the scenario templates (datasets/templates/*.json) and the shared
dimension source (datasets/categories.json) - so a broken ref in either is caught.

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

    python -m tools.audit_glyphs            # human report (exit 1 if any category is partial)
    python -m tools.audit_glyphs --md       # markdown snapshot for docs/reference/glyph-coverage.md

See tools/generate.py `_value_glyph` (the resolution this mirrors), docs/reference/glyph-coverage.md
(the coverage snapshot this feeds) and docs/concepts/ui-shell.md.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = _ROOT / "datasets" / "templates"
CATEGORIES_FILE = _ROOT / "datasets" / "categories.json"
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
    def __init__(self, scenario: str, cat_id: str, cat_label: str, source: str = "template"):
        self.scenario = scenario
        self.cat_id = cat_id
        self.cat_label = cat_label
        self.source = source                     # "template" | "categories"
        self.status = "text"
        self.missing_refs: list[str] = []       # referenced '<pack>.<slug>' with no file
        self.text_values: list[str] = []        # value labels with no glyph while siblings have one


def audit_category(scenario: str, cat: dict, have: set[str], source: str = "template") -> CatReport:
    rep = CatReport(scenario, cat.get("id", "?"), cat.get("label", "?"), source)
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


def audit_categories_source(have: set[str]) -> list[CatReport]:
    """Audit datasets/categories.json - the shared dimension source. Same no-mix contract as a
    template category, but the file shape differs: a dict of { <id>: { glyphPack?, values } }.
    A dimension whose glyphPack + value ids do not resolve to shipped art is a broken ref the
    template-only pass never sees (this is what caught the fruit -> food mismatch)."""
    reports: list[CatReport] = []
    if not CATEGORIES_FILE.exists():
        return reports
    data = json.loads(CATEGORIES_FILE.read_text(encoding="utf-8"))
    for dim_id, pool in data.get("categories", {}).items():
        cat = {
            "id": dim_id,
            "label": pool.get("label", dim_id),
            "glyphPack": pool.get("glyphPack"),
            "valuePool": pool.get("values", []),
        }
        reports.append(audit_category("categories.json", cat, have, source="categories"))
    return reports


def audit() -> list[CatReport]:
    have = available_refs()
    reports: list[CatReport] = []
    for path in sorted(TEMPLATES_DIR.glob("*.json")):
        if path.name == "manifest.json":
            continue
        tpl = json.loads(path.read_text(encoding="utf-8"))
        for cat in tpl.get("categories", []):
            reports.append(audit_category(tpl.get("id", path.stem), cat, have))
    reports.extend(audit_categories_source(have))
    return reports


def _counts(reports: list[CatReport]) -> tuple[int, int, int]:
    """(complete, text, partial) over a subset of reports."""
    return (
        sum(1 for r in reports if r.status == "complete"),
        sum(1 for r in reports if r.status == "text"),
        sum(1 for r in reports if r.status == "partial"),
    )


def render_text(reports: list[CatReport]) -> tuple[str, int]:
    tpl = [r for r in reports if r.source == "template"]
    cat = [r for r in reports if r.source == "categories"]
    partial = [r for r in reports if r.status == "partial"]
    tc, tt, tp = _counts(tpl)
    cc, ct, cp = _counts(cat)
    lines: list[str] = []
    lines.append(
        f"scenario templates: {len({r.scenario for r in tpl})} scenarios, {len(tpl)} categories"
        f"  ->  complete {tc}, text {tt}, partial {tp}"
    )
    lines.append(
        f"dimension source (categories.json): {len(cat)} dimensions"
        f"  ->  complete {cc}, text {ct}, partial {cp}"
    )
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
        lines.append("MISSING IMAGE FILES (referenced by a template or dimension, no .svg present):")
        for pack in sorted(by_pack):
            lines.append(f"  {pack}: " + ", ".join(sorted(by_pack[pack])))
    return "\n".join(lines), len(partial)


def render_md(reports: list[CatReport]) -> str:
    """Markdown coverage snapshot for docs/reference/glyph-coverage.md (regenerable body).

    Emits the mechanical truth only - the counts, the partial categories, and any broken
    file refs grouped by pack. The authored 'which art closes each gap' table lives in the
    reference doc, so regenerating this block never clobbers the human close-list."""
    tpl = [r for r in reports if r.source == "template"]
    cat = [r for r in reports if r.source == "categories"]
    partial = [r for r in reports if r.status == "partial"]
    tc, tt, tp = _counts(tpl)
    cc, ct, cp = _counts(cat)
    lines: list[str] = []
    lines.append(
        f"- Scenario templates: {len({r.scenario for r in tpl})} scenarios, {len(tpl)} categories "
        f"-> complete {tc}, text {tt}, partial {tp}."
    )
    lines.append(
        f"- Dimension source (categories.json): {len(cat)} dimensions "
        f"-> complete {cc}, text {ct}, partial {cp}."
    )
    lines.append("")
    if partial:
        lines.append("| Source | Category | Missing image files | Values with no art |")
        lines.append("| --- | --- | --- | --- |")
        for r in sorted(partial, key=lambda x: (x.scenario, x.cat_id)):
            miss = ", ".join(f"`{m}`" for m in sorted(set(r.missing_refs))) or "-"
            tv = ", ".join(r.text_values) or "-"
            lines.append(f"| {r.scenario} | {r.cat_label} ({r.cat_id}) | {miss} | {tv} |")
        lines.append("")
    by_pack: dict[str, set[str]] = defaultdict(set)
    for r in partial:
        for ref in r.missing_refs:
            by_pack[ref.split(".", 1)[0]].add(ref)
    if by_pack:
        lines.append("Broken references (a template or dimension names a glyph with no shipped file), by pack:")
        lines.append("")
        for pack in sorted(by_pack):
            lines.append(f"- `{pack}`: " + ", ".join(f"`{x}`" for x in sorted(by_pack[pack])))
    else:
        lines.append(
            "No broken references: every glyph a template or dimension names has a shipped file. Each "
            "gap above is a value carrying no glyph while its siblings do, which trips the axis to text."
        )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Audit scenario glyph coverage (no-mix contract).")
    ap.add_argument(
        "--md",
        action="store_true",
        help="emit a markdown snapshot for docs/reference/glyph-coverage.md (exit 0)",
    )
    args = ap.parse_args(argv)
    reports = audit()
    if args.md:
        print(render_md(reports))
        return 0
    report_text, n_partial = render_text(reports)
    print(report_text)
    return 1 if n_partial else 0


if __name__ == "__main__":
    raise SystemExit(main())
