"""Tests for tools/audit_glyphs.py (the glyph-coverage auditor).

Real dict fixtures, no mocks (CLAUDE.md #7). The synthetic-fixture tests pin the no-mix
CLASSIFICATION logic (text / complete / partial) and the value-glyph resolution; the corpus
tests assert only STRUCTURAL invariants against the real templates, never which categories
are partial today (that is content that changes as art lands, tracked live by the tool +
docs/reference/glyph-coverage.md - not frozen here).
"""

from audit_glyphs import (
    CatReport,
    audit,
    audit_category,
    main,
    render_md,
    render_text,
    value_glyph,
)


# --- value_glyph: how a value resolves to a '<pack>.<slug>' ref (or '' = text) --------------

def test_value_glyph_explicit_override_wins() -> None:
    assert value_glyph("food", {"id": "apple", "glyph": "creatures.cat"}) == "creatures.cat"


def test_value_glyph_empty_override_forces_text() -> None:
    # explicit '' beats the category glyphPack - the value stays text on purpose
    assert value_glyph("food", {"id": "apple", "glyph": ""}) == ""


def test_value_glyph_pack_decorates_by_id() -> None:
    assert value_glyph("food", {"id": "apple"}) == "food.apple"


def test_value_glyph_no_pack_is_text() -> None:
    assert value_glyph(None, {"id": "apple"}) == ""


# --- audit_category: the no-mix status decision --------------------------------------------

def _cat(**kw: object) -> dict:
    return {"id": "c", "label": "C", **kw}


def test_category_all_text_is_text() -> None:
    cat = _cat(valuePool=[{"id": "a"}, {"id": "b"}])  # no glyphPack, no overrides
    rep = audit_category("s", cat, have=set())
    assert rep.status == "text"
    assert rep.missing_refs == [] and rep.text_values == []


def test_category_every_value_present_is_complete() -> None:
    cat = _cat(glyphPack="food", valuePool=[{"id": "a"}, {"id": "b"}])
    rep = audit_category("s", cat, have={"food.a", "food.b"})
    assert rep.status == "complete"


def test_category_missing_file_is_partial_with_missing_ref() -> None:
    cat = _cat(glyphPack="food", valuePool=[{"id": "a"}, {"id": "b"}])
    rep = audit_category("s", cat, have={"food.a"})  # food.b has no file
    assert rep.status == "partial"
    assert rep.missing_refs == ["food.b"]


def test_category_sibling_has_glyph_odd_one_out_is_partial() -> None:
    # the real-world shape of today's gaps: a per-value pack where one value carries no glyph
    cat = _cat(valuePool=[{"id": "a", "glyph": "food.a"}, {"id": "b", "label": "Bee"}])
    rep = audit_category("s", cat, have={"food.a"})
    assert rep.status == "partial"
    assert rep.text_values == ["Bee"] and rep.missing_refs == []


def test_category_all_forced_text_is_text_not_partial() -> None:
    cat = _cat(glyphPack="food", valuePool=[{"id": "a", "glyph": ""}, {"id": "b", "glyph": ""}])
    rep = audit_category("s", cat, have={"food.a", "food.b"})
    assert rep.status == "text"


# --- render_md: the regenerable markdown snapshot ------------------------------------------

def _rep(status: str, missing: list[str] | None = None, text_vals: list[str] | None = None) -> CatReport:
    r = CatReport("scen", "cat", "Cat")
    r.status = status
    r.missing_refs = missing or []
    r.text_values = text_vals or []
    return r


def test_render_md_counts_and_no_broken_note() -> None:
    reports = [_rep("complete"), _rep("text"), _rep("partial", text_vals=["Lavender"])]
    md = render_md(reports)
    assert "- Scenario templates: 1 scenarios, 3 categories -> complete 1, text 1, partial 1." in md
    assert "- Dimension source (categories.json): 0 dimensions -> complete 0, text 0, partial 0." in md
    assert "| Source | Category | Missing image files | Values with no art |" in md
    assert "No broken references" in md  # no missing files -> the explanatory note, not a shopping list


def test_render_md_groups_broken_refs_by_pack() -> None:
    md = render_md([_rep("partial", missing=["flowers.lavender", "medals.debut"])])
    assert "Broken references" in md
    assert "`flowers`: `flowers.lavender`" in md
    assert "`medals`: `medals.debut`" in md


# --- corpus: structural invariants over the real templates ---------------------------------

def test_audit_over_real_corpus_is_well_formed() -> None:
    reports = audit()
    assert reports, "expected the real corpus to yield reports"
    tpl = [r for r in reports if r.source == "template"]
    cat = [r for r in reports if r.source == "categories"]
    assert len(tpl) % 5 == 0  # 5 categories per scenario template
    assert cat, "expected categories.json dimensions to be audited too"
    assert {r.status for r in reports} <= {"text", "complete", "partial"}
    # both renderers run clean on the live corpus
    text, n_partial = render_text(reports)
    assert isinstance(text, str) and text
    assert n_partial == sum(1 for r in reports if r.status == "partial")
    assert render_md(reports)


def test_main_exit_codes(capsys) -> None:
    # default report gates: exit 1 iff any category is partial
    code = main([])
    reports = audit()
    expected = 1 if any(r.status == "partial" for r in reports) else 0
    assert code == expected
    # --md is a generator, never a gate
    assert main(["--md"]) == 0
    out = capsys.readouterr().out
    assert "Scenario templates:" in out


def test_categories_source_is_audited_and_resolves() -> None:
    # the dimension source is scanned too; the fruit dimension (fixed to vegetables) resolves
    reports = audit()
    cat = [r for r in reports if r.source == "categories"]
    assert cat, "categories.json dimensions should be audited"
    fruit = next((r for r in cat if r.cat_id == "fruit"), None)
    assert fruit is not None
    assert fruit.status in {"complete", "text"} and fruit.missing_refs == []


def test_audit_category_carries_source() -> None:
    cat = _cat(glyphPack="food", valuePool=[{"id": "a"}])
    rep = audit_category("categories.json", cat, have={"food.a"}, source="categories")
    assert rep.source == "categories" and rep.status == "complete"
