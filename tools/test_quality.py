"""Row-3 story-first quality gates on the corpus-driven standard matrix: zero-guess (P1), a
single-clue eq opener (P2), difficulty in the tier band (P4), variety with eq present (P5), no
non-anchor value leaked into the story (P7), and every clue rendered to brace-free ASCII (T1).
Row 5 adds numeric clues: magnitude round-trip (T13), numeric facts true (T14), and a DEFINITE
solver-status guard. Row 6 adds reified compound clues (oneOf/oneEachOf Sharp+, ifThen Expert-only
and at most one): the per-tier type gate (T15), the indirection gate (T16), and the zero-guess P1
tripwire on a Sharp manifest carrying a oneOf and an Expert manifest carrying an ifThen. Real solver
+ real corpus, deterministic, no mocks (CLAUDE.md #7, #13)."""

import json
import re
from pathlib import Path

import pytest
from ortools.sat.python import cp_model

import corpus
import generate as g
from models import PuzzleManifest

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"
# The compound/numeric/indirection gates below assert behaviour that is a function of a SPECIFIC
# scenario's clue templates + values, so they pin the reference scenario (weekend-market) instead
# of the per-date catalog pick. The story_seed is scenario-independent, so this reproduces exactly
# the puzzles these gates were written against (sharp v1 keeps a oneOf, expert v2 keeps an ifThen).
# Per-date scenario VARIETY is covered separately by the property sweep + the selection tests.
WEEKEND_MARKET = ROOT / "datasets" / "templates" / "weekend-market.json"
DATE, TIER, VARIANT = "2026-07-01", "standard", 1
# Compound tiers pinned to deterministic variants that keep the compound spice in their minimal
# set: Sharp v1 retains a oneOf, Expert v2 retains an ifThen (both in band + full-depth zero-guess).
SHARP_VARIANT, EXPERT_VARIANT = 1, 2


@pytest.fixture(scope="module")
def story() -> tuple:
    m, d, _ = g.generate_story(DATE, TIER, VARIANT, CONFIG_DIR, scenario_path=WEEKEND_MARKET)
    return m, d


@pytest.fixture(scope="module")
def build() -> g.StoryBuild:
    # The full accepted attempt, exposing the solver-internal cats/clues/solution/seed so the
    # numeric + DEFINITE-status gates can re-verify without re-running the reseed loop.
    return g.build_story(DATE, TIER, VARIANT, CONFIG_DIR, scenario_path=WEEKEND_MARKET)


@pytest.fixture(scope="module")
def sharp_build() -> g.StoryBuild:
    # Sharp gates in oneOf + oneEachOf (Sharp+); the pinned variant keeps a oneOf in the minimal set.
    return g.build_story(DATE, "sharp", SHARP_VARIANT, CONFIG_DIR, scenario_path=WEEKEND_MARKET)


@pytest.fixture(scope="module")
def expert_build() -> g.StoryBuild:
    # Expert additionally gates in ifThen (Expert-only, <= 1); the pinned variant keeps an ifThen.
    return g.build_story(DATE, "expert", EXPERT_VARIANT, CONFIG_DIR, scenario_path=WEEKEND_MARKET)


def _mag_by_anchor(m) -> tuple:
    # (numeric-cat id, {anchor value -> the integer magnitude sharing its slot in the solution}).
    numcat = next(c for c in m.categories.items if c.kind == "numeric")
    mag = {v.id: v.magnitude for v in numcat.values}
    anchor = next(c.id for c in m.categories.items if c.anchor)
    ent_of = {cells[anchor]: e for e, cells in m.solution.items()}
    return numcat.id, {av: mag[m.solution[ent_of[av]][numcat.id]] for av in ent_of}


def _anchor_id(m) -> str:
    return next(c.id for c in m.categories.items if c.anchor)


def test_p1_zero_guess_full_depth(story: tuple) -> None:
    # The forced-deduction trace visits every non-anchor bijective cell exactly once: the
    # solver never leaves a guess (len(hintTrace) == non-anchor bijective categories * entities).
    m, _ = story
    anchor = _anchor_id(m)
    non_anchor_bijective = [c for c in m.categories.items if c.id != anchor and c.cardinality == "bijective"]
    assert len(m.hintTrace) == len(non_anchor_bijective) * len(m.entities)


def test_p2_single_clue_eq_opener(story: tuple) -> None:
    # At least one eq clue, by itself, forces a cell (a single-clue opener) - the toehold a
    # solver needs to start without guessing.
    m, _ = story
    ctype = {c.id: c.type for c in m.constraints}
    openers = [s for s in m.hintTrace if len(s.fromClues) == 1 and ctype.get(s.fromClues[0]) == "eq"]
    assert openers


def test_p4_difficulty_in_band(story: tuple) -> None:
    m, d = story
    tiers = g.load_config("tiers", CONFIG_DIR)[TIER]
    lo, hi = tiers["band"]
    indirect = sum(1 for c in m.constraints if c.type in g.INDIRECT_TYPES)
    recomputed = g.difficulty(tiers, len(m.entities), m.categories.n, len(m.constraints), indirect, len(m.hintTrace))
    assert recomputed == d
    assert lo <= recomputed <= hi


def test_p5_variety_no_type_dominates(story: tuple) -> None:
    # eq is present and no single clue type exceeds the config share cap (variety guard).
    m, _ = story
    cap = g.load_config("dials", CONFIG_DIR)["story"]["share_cap"]
    types = [c.type for c in m.constraints]
    assert "eq" in types
    assert max(types.count(t) for t in set(types)) / len(types) <= cap


def test_p7_story_hides_non_anchor_values(story: tuple) -> None:
    # The narrative may name the subject (anchor) but must never spoil a non-anchor value.
    m, _ = story
    anchor = _anchor_id(m)
    for c in m.categories.items:
        if c.id == anchor:
            continue
        for v in c.values:
            assert v.label not in m.story


def test_t1_cluetext_is_ascii_without_slots(story: tuple) -> None:
    m, _ = story
    for c in m.constraints:
        assert c.clueText  # non-empty
        assert "{" not in c.clueText and "}" not in c.clueText  # every slot filled
        assert c.clueText.isascii()


def test_rebuild_is_byte_identical() -> None:
    # Determinism: same (date, tier, variant) -> identical manifest (num_search_workers=1,
    # fixed seed, fixed clue order, date-seeded narrative + variants).
    a = g.generate_story(DATE, TIER, VARIANT, CONFIG_DIR, scenario_path=WEEKEND_MARKET)[0]
    b = g.generate_story(DATE, TIER, VARIANT, CONFIG_DIR, scenario_path=WEEKEND_MARKET)[0]
    assert a.model_dump(by_alias=True) == b.model_dump(by_alias=True)


def test_standard_carries_a_numeric_clue(build: g.StoryBuild) -> None:
    # Row 5 deliverable: the regenerated standard matrix carries at least one numDiff clue.
    assert any(c.type == "numDiff" for c in build.manifest.constraints)


def test_t13_magnitude_round_trips(build: g.StoryBuild) -> None:
    # emit -> canonical JSON -> reparse: every numeric value.magnitude is an int and identical.
    m = build.manifest
    text = json.dumps(m.model_dump(by_alias=True, exclude_none=True), sort_keys=True, ensure_ascii=True)
    reparsed = PuzzleManifest.model_validate_json(text)
    seen = 0
    for c0, c1 in zip(m.categories.items, reparsed.categories.items):
        if c0.kind != "numeric":
            continue
        for v0, v1 in zip(c0.values, c1.values):
            assert isinstance(v1.magnitude, int) and not isinstance(v1.magnitude, bool)
            assert v1.magnitude == v0.magnitude
            seen += 1
    assert seen == len(m.entities)  # every numeric slot carried an int magnitude through the trip


def test_t14_numeric_facts_true(build: g.StoryBuild) -> None:
    # Every emitted numDiff and every enumerated threshold HOLDS under the solution magnitudes.
    m = build.manifest
    numcat_id, mag_at = _mag_by_anchor(m)
    diffs = [c for c in m.constraints if c.type == "numDiff"]
    assert diffs
    for c in diffs:
        p = dict(c.params)
        a, b = c.operands[0].value, c.operands[1].value
        assert p["numericCat"] == numcat_id and p["dir"] == "greater"
        assert mag_at[a] == mag_at[b] + p["delta"]  # directed: a is exactly delta more than b
    # threshold is Sharp+; enumerate it against the same solution and confirm each bound holds.
    thresholds = [
        cl for cl in g.enumerate_numeric_clues(build.cats, build.entities, build.sol, "sharp", build.scenario)
        if cl[0] == "threshold"
    ]
    assert thresholds
    for _typ, ops, params in thresholds:
        p = dict(params)
        assert p["numericCat"] == numcat_id and p["dir"] == "atleast"
        assert mag_at[ops[0][1]] >= p["bound"]


def test_uniqueness_solve_is_definite(build: g.StoryBuild) -> None:
    # The generated puzzle's uniqueness solve returns a DEFINITE status (never UNKNOWN/timeout).
    status = g.uniqueness_status(build.cats, build.entities, build.clues, build.seed)
    assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    assert g.is_unique(build.cats, build.entities, build.clues, build.seed) is True


def test_definite_guard_rejects_nondefinite() -> None:
    # The guard raises on a non-definite status rather than treating it as feasible/infeasible.
    for bad in (cp_model.UNKNOWN, cp_model.MODEL_INVALID):
        with pytest.raises(RuntimeError):
            g._definite(bad)
    for ok in (cp_model.OPTIMAL, cp_model.FEASIBLE, cp_model.INFEASIBLE):
        assert g._definite(ok) == ok


def test_numeric_modeling_undirected_and_atmost() -> None:
    # The undirected-numDiff and atmost-threshold model branches (implemented but not emitted by
    # generation) enforce the right arithmetic. Synthetic anchor + numeric magnitudes {2,5,9}.
    anchor = g.Cat("who", "Who", False, ["a", "b", "c"], ["", "", ""], ["A", "B", "C"])
    num = g.Cat("amt", "Amt", False, ["x", "y", "z"], ["", "", ""], ["2", "5", "9"],
                kind="numeric", magnitudes=[2, 5, 9])
    cats, n = [anchor, num], 3
    magmap = dict(zip(num.value_ids, num.magnitudes))

    # atmost: the entity at slot 0 charges <= 4, so it must hold magnitude 2 (the only one <= 4).
    m, x, _, _ = g.build_model(cats, n, [("threshold", (("who", "a"),),
                                          (("numericCat", "amt"), ("bound", 4), ("dir", "atmost")))])
    s = g._solver(0)
    assert g._definite(s.Solve(m)) in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    slot_val = {s.Value(x["amt"][v]): v for v in num.value_ids}
    assert magmap[slot_val[0]] <= 4

    # undirected numDiff: |slot0 - slot1| == 7, so those two slots hold {2, 9}.
    m, x, _, _ = g.build_model(cats, n, [("numDiff", (("who", "a"), ("who", "b")),
                                          (("numericCat", "amt"), ("delta", 7), ("dir", "abs")))])
    s = g._solver(0)
    assert g._definite(s.Solve(m)) in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    slot_val = {s.Value(x["amt"][v]): v for v in num.value_ids}
    assert abs(magmap[slot_val[0]] - magmap[slot_val[1]]) == 7


# --- Row 6: compound clue gates (oneOf/oneEachOf Sharp+, ifThen Expert-only) --------------------


def _full_depth(m) -> int:
    # Zero-guess target: one forced step per non-anchor bijective cell (non-anchor cats * entities).
    anchor = _anchor_id(m)
    non_anchor_bij = [c for c in m.categories.items if c.id != anchor and c.cardinality == "bijective"]
    return len(non_anchor_bij) * len(m.entities)


def _allowed_types(scenario, tier: str) -> set:
    # The clue types a tier gates IN (each clueTemplate's minTier <= tier). Config-driven: the single
    # source of truth is the template's minTier, never a hardcoded tier list in the test or logic.
    return {t for t, ct in scenario.clueTemplates.items() if g.tier_at_least(tier, ct.minTier)}


def test_t15_tier_type_gate(build: g.StoryBuild, sharp_build: g.StoryBuild, expert_build: g.StoryBuild) -> None:
    # Every generated manifest uses only clue types its tier gates in; the compound spice is tier
    # gated - oneOf/oneEachOf are Sharp+, ifThen is Expert-only and appears at most once per puzzle.
    scenario = build.scenario
    for b, tier in ((build, "standard"), (sharp_build, "sharp"), (expert_build, "expert")):
        types = {c.type for c in b.manifest.constraints}
        assert types <= _allowed_types(scenario, tier), (tier, sorted(types - _allowed_types(scenario, tier)))
    assert not any(c.type == "oneOf" for c in build.manifest.constraints)     # oneOf is Sharp+
    assert not any(c.type == "ifThen" for c in build.manifest.constraints)    # ifThen is Expert-only
    assert not any(c.type == "ifThen" for c in sharp_build.manifest.constraints)
    assert sum(1 for c in expert_build.manifest.constraints if c.type == "ifThen") <= 1
    # The gate lives in the enumerator (each clueTemplate's minTier), not a hardcoded tier list:
    assert g.enumerate_compound_clues(build.cats, build.entities, build.sol, "standard", scenario) == []
    assert not any(
        cl[0] == "ifThen"
        for cl in g.enumerate_compound_clues(sharp_build.cats, sharp_build.entities, sharp_build.sol, "sharp", scenario)
    )


def test_t16_indirection_gate(build: g.StoryBuild, sharp_build: g.StoryBuild) -> None:
    # Indirection is tier gated: standard names operands directly (no "the <refPhrase>"), while
    # sharp/expert refer to them indirectly by refPhrase ("the potter"), like a printed logic puzzle.
    # Word-boundary match so "the potter" is not spuriously found inside "threw the pottery".
    def ref_rendered(m) -> bool:
        refs = {v.refPhrase for c in m.categories.items for v in c.values if v.refPhrase}
        pats = [re.compile(rf"\bthe {re.escape(rp)}\b") for rp in refs]
        return any(p.search(cc.clueText) for cc in m.constraints for p in pats)

    assert not ref_rendered(build.manifest)    # standard: indirection.byTier == "name" -> labels only
    assert ref_rendered(sharp_build.manifest)  # sharp: indirection.byTier == "attribute" -> refPhrase


def test_p1_compound_sharp_oneof_full_depth(sharp_build: g.StoryBuild) -> None:
    # P1 tripwire with a compound clue present: a Sharp manifest carrying a oneOf is still fully
    # forced (the reified disjunction participates in is_unique + hint_trace; zero guesses remain).
    m = sharp_build.manifest
    assert any(c.type == "oneOf" for c in m.constraints)
    assert len(m.hintTrace) == _full_depth(m)
    assert g.is_unique(sharp_build.cats, sharp_build.entities, sharp_build.clues, sharp_build.seed) is True


def test_p1_compound_expert_ifthen_full_depth(expert_build: g.StoryBuild) -> None:
    # P1 tripwire with the conditional: an Expert manifest carrying an ifThen (AddImplication) stays
    # fully forced and unique - the implication reasons correctly inside the forced deduction trace.
    m = expert_build.manifest
    assert any(c.type == "ifThen" for c in m.constraints)
    assert len(m.hintTrace) == _full_depth(m)
    assert g.is_unique(expert_build.cats, expert_build.entities, expert_build.clues, expert_build.seed) is True


def test_rebuild_is_byte_identical_sharp(sharp_build: g.StoryBuild) -> None:
    # Determinism holds with oneOf/oneEachOf present: same (date, tier, variant) -> identical manifest.
    rebuilt = g.generate_story(DATE, "sharp", SHARP_VARIANT, CONFIG_DIR, scenario_path=WEEKEND_MARKET)[0]
    assert rebuilt.model_dump(by_alias=True) == sharp_build.manifest.model_dump(by_alias=True)


def test_rebuild_is_byte_identical_expert(expert_build: g.StoryBuild) -> None:
    # Determinism holds with an ifThen present: same (date, tier, variant) -> identical manifest.
    rebuilt = g.generate_story(DATE, "expert", EXPERT_VARIANT, CONFIG_DIR, scenario_path=WEEKEND_MARKET)[0]
    assert rebuilt.model_dump(by_alias=True) == expert_build.manifest.model_dump(by_alias=True)


# --- Row 9b: easy tier (all-direct tutorial) generates story-first, zero-guess -------------------

EASY_DATE = "2026-07-02"


@pytest.fixture(scope="module")
def easy_build() -> g.StoryBuild:
    # Easy is the all-direct tutorial: tiers.json indir == [0, 0], so the variety/share cap is
    # exempt and an all-eq grid is exactly the intended shape (the fix that unblocked easy).
    return g.build_story(EASY_DATE, "easy", 1, CONFIG_DIR, scenario_path=WEEKEND_MARKET)


def test_easy_is_all_direct_story_first(easy_build: g.StoryBuild) -> None:
    # Easy emits a story-first schemaVersion-2 grid with NO indirect clue (all-direct tutorial):
    # eq present, and no neq/compound - matching the tier's declared indirection budget [0, 0].
    m = easy_build.manifest
    assert m.schemaVersion == 2 and m.shapeId == "grid" and m.story and m.scenarioId
    types = [c.type for c in m.constraints]
    assert types and "eq" in types
    assert all(t not in g.INDIRECT_TYPES for t in types), [t for t in types if t in g.INDIRECT_TYPES]


def test_p1_easy_zero_guess(easy_build: g.StoryBuild) -> None:
    # P1 tripwire for EASY: the forced trace visits every non-anchor bijective cell and the clue
    # set is genuinely unique (zero guesses). This is the row-9b fix that made easy generate.
    m = easy_build.manifest
    assert len(m.hintTrace) == _full_depth(m)
    assert g.is_unique(easy_build.cats, easy_build.entities, easy_build.clues, easy_build.seed) is True


def test_p4_easy_in_band(easy_build: g.StoryBuild) -> None:
    tiers = g.load_config("tiers", CONFIG_DIR)["easy"]
    lo, hi = tiers["band"]
    assert lo <= easy_build.d <= hi


def test_rebuild_is_byte_identical_easy(easy_build: g.StoryBuild) -> None:
    # Determinism holds for the all-direct easy grid too: same (date, tier, variant) -> identical.
    rebuilt = g.generate_story(EASY_DATE, "easy", 1, CONFIG_DIR, scenario_path=WEEKEND_MARKET)[0]
    assert rebuilt.model_dump(by_alias=True) == easy_build.manifest.model_dump(by_alias=True)


# The served archive dates (deterministic, known in-band) sweep the full 8 x 4 cross-product.
SWEEP_DATES = [
    "2026-06-25", "2026-06-26", "2026-06-27", "2026-06-28",
    "2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02",
]


@pytest.mark.parametrize("date", SWEEP_DATES)
@pytest.mark.parametrize("tier", ["easy", "standard", "sharp", "expert"])
def test_property_sweep_p1_band_variety(date: str, tier: str) -> None:
    # Property sweep over 8 dates x 4 tiers (32 cases): every generated manifest is a story-first
    # schemaVersion-2 grid that holds P1 (zero-guess: len(hintTrace) == non-anchor bijective cells),
    # sits in the tier band, and keeps variety - eq is always present, and a tier that budgets
    # indirection (indir upper > 0) keeps no single clue type over the share cap; the all-direct
    # easy tier (indir == [0, 0]) instead carries no indirect clue at all. Deterministic (the seed
    # is a function of date/tier/variant), so a rebuild reproduces the same manifests.
    tiers = g.load_config("tiers", CONFIG_DIR)[tier]
    m, d, _ = g.generate_story(date, tier, 1, CONFIG_DIR)
    assert m.schemaVersion == 2 and m.shapeId == "grid" and m.story and m.scenarioId
    assert len(m.hintTrace) == _full_depth(m)                     # P1: zero-guess
    lo, hi = tiers["band"]
    assert lo <= d <= hi                                          # band
    types = [c.type for c in m.constraints]
    assert "eq" in types                                          # variety: an eq toehold always
    if tiers["indir"][1] > 0.0:  # a tier that budgets indirection keeps one type from dominating
        cap = g.load_config("dials", CONFIG_DIR)["story"]["share_cap"]
        assert max(types.count(t) for t in set(types)) / len(types) <= cap
    else:  # the all-direct easy tutorial: no indirect clue at all
        assert all(t not in g.INDIRECT_TYPES for t in types)


# --- Row 9e: per-tier narrative coherence + scenario-per-date selection --------------------------

TEMPLATES_DIR = ROOT / "datasets" / "templates"
CATALOG = corpus.list_scenario_paths(TEMPLATES_DIR)
PUZZLES_DIR = ROOT / "frontend" / "public" / "puzzles"


def test_catalog_has_a_diverse_batch() -> None:
    # The scenario catalog is a batch, not a single template (the row-9e deliverable).
    ids = [p.stem for p in CATALOG]
    assert "weekend-market" in ids
    assert len(ids) >= 4, ids  # weekend-market + >= 3 authored scenarios


@pytest.mark.parametrize("scenario_path", CATALOG, ids=lambda p: p.stem)
def test_narrative_coherence_per_tier(scenario_path: Path) -> None:
    # The story never names a category a tier sliced out. Build easy (2 cats) + expert (all cats)
    # for each catalogued scenario: the easy narrative must OMIT every sliced-out non-anchor label
    # (the row-9e fix - easy no longer says 'price' when it has no price column), while the expert
    # narrative NAMES every non-anchor dimension in its generated match-line.
    easy = g.build_story("2026-07-01", "easy", 1, CONFIG_DIR, scenario_path=scenario_path).manifest
    expert = g.build_story("2026-07-01", "expert", 1, CONFIG_DIR, scenario_path=scenario_path).manifest
    scenario = corpus.load_scenario_template(scenario_path)
    present_easy = {c.id for c in easy.categories.items}
    sliced = [c for c in scenario.categories if c.id != scenario.subjectCategory and c.id not in present_easy]
    assert sliced, ("expected easy to slice out a category", scenario.id)
    easy_low = easy.story.lower()
    for c in sliced:
        assert c.label.lower() not in easy_low, (scenario.id, "leaked sliced label", c.label)
    expert_low = expert.story.lower()
    for c in scenario.categories:
        if c.id != scenario.subjectCategory:
            assert c.label.lower() in expert_low, (scenario.id, "expert omits present label", c.label)


def test_scenario_per_date_is_deterministic_and_varies() -> None:
    # Same date -> same scenario (a stable hash of the date over the sorted catalog); a second
    # resolution is identical, and the served window spreads over more than one scenario.
    picks = [corpus.scenario_path_for_date(d, TEMPLATES_DIR).stem for d in SWEEP_DATES]
    assert picks == [corpus.scenario_path_for_date(d, TEMPLATES_DIR).stem for d in SWEEP_DATES]
    assert len(set(picks)) >= 2, picks  # variety: not one scenario for the whole window


def test_served_bank_matches_per_date_scenario_all_tiers() -> None:
    # Every served puzzle uses the date's per-date scenario, and all four tiers of a date share it
    # (sliced per tier) - the selection contract, verified against the actual shipped bank.
    for date in SWEEP_DATES:
        expected = corpus.scenario_path_for_date(date, TEMPLATES_DIR).stem
        for tier in ("easy", "standard", "sharp", "expert"):
            m = PuzzleManifest.model_validate_json((PUZZLES_DIR / f"{date}-{tier}.json").read_text("ascii"))
            assert m.scenarioId == expected, (date, tier, m.scenarioId)
