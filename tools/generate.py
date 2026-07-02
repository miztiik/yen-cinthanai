"""Build-time daily-bank generator: pipes and filters, no in-browser solver.

  config/tiers.json + config/dials.json + datasets/ scenario + date
    -> story seed (PRNG + CP-SAT random_seed)
    -> subject-anchored matrix: sample a full bijective solution
    -> enumerate eq/neq + numeric + compound clues true under it (tier-gated by minTier)
    -> weighted-select a subset, verify uniqueness, prune to minimal
    -> render full-sentence clueText -> compute D (reject + reseed if out of band / not zero-guess)
    -> emit story-first PuzzleManifest v2 (validated by tools.models) + canonical-JSON sha
    -> append BankIndex; JSONL log to .logs/build-<date>.jsonl

Matrix-only (F1): the seating-row/round-table positional engine is retired (Row 9d contract
close), so every puzzle is a grid narrated by a scenario. Determinism: num_search_workers=1,
fixed random_seed; canonical JSON (sort_keys, ASCII) sha -> a rebuild of the same (date, tier,
variant) is byte-identical. No hardcoding: every tunable comes from config/. ASCII + POSIX only.
See docs/architecture/generator/pipeline.md, docs/concepts/difficulty-and-scoring.md.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import get_args

from ortools.sat.python import cp_model

sys.path.insert(0, str(Path(__file__).resolve().parent))  # sibling models on path

from models import (  # noqa: E402
    BANK_SCHEMA_VERSION,
    PUZZLE_SCHEMA_VERSION,
    AttributeCategory,
    AttributeValue,
    BankEntry,
    BankIndex,
    Categories,
    Constraint,
    HintForce,
    HintStep,
    Operand,
    PuzzleManifest,
    Tier,
)
from corpus import load_scenario_template  # noqa: E402
from translator import render_clue, render_story  # noqa: E402

_ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = _ROOT / "config"
PUZZLES_DIR = _ROOT / "frontend" / "public" / "puzzles"
DATASETS_DIR = _ROOT / "datasets"
LOGS_DIR = _ROOT / ".logs"

# Matrix-only clue vocabulary (the seating-row/round-table positional engine is retired, Row 9d).
# Compound reified clues are INDIRECT reasoning: they weaken any single cell, so they lift the
# indirection score (and the tier band) the same way neq does. Only the story path emits them.
COMPOUND_TYPES = ("oneOf", "oneEachOf", "ifThen")  # oneOf/oneEachOf Sharp+, ifThen Expert-only
INDIRECT_TYPES = ("neq", *COMPOUND_TYPES)
NUMERIC_TYPES = ("numDiff", "threshold")  # integer-magnitude clues on a numeric category
SOLVE_LIMIT_S = 10.0
STORY_SERVED_VARIANT = 1  # the canonical daily variant served in the bank (one puzzle per date x tier)

# Tier order is the single source of truth in the Tier type (models.py); no hardcoded tier list.
TIER_ORDER = get_args(Tier)
_STATUS_NAME = {
    cp_model.OPTIMAL: "OPTIMAL", cp_model.FEASIBLE: "FEASIBLE", cp_model.INFEASIBLE: "INFEASIBLE",
    cp_model.MODEL_INVALID: "MODEL_INVALID", cp_model.UNKNOWN: "UNKNOWN",
}


def tier_at_least(tier: str, min_tier: str) -> bool:
    """True when `tier` is at or above `min_tier` in the canonical Tier order (easy<...<expert)."""
    return TIER_ORDER.index(tier) >= TIER_ORDER.index(min_tier)


def _definite(status: int) -> int:
    """Fail fast on a non-DEFINITE CP-SAT status. A timeout (UNKNOWN) or MODEL_INVALID read
    silently as feasible/infeasible would make generation nondeterministic, so raise instead."""
    if status in (cp_model.UNKNOWN, cp_model.MODEL_INVALID):
        raise RuntimeError(
            f"non-definite CP-SAT status {_STATUS_NAME.get(status, status)}; "
            "generation requires OPTIMAL/FEASIBLE/INFEASIBLE (deterministic)"
        )
    return status

# Difficulty ENV dial weights (docs/concepts/difficulty-and-scoring.md). Keyed by
# the config/tiers.json dial values; no magic numbers escape this table.
_ATT = {-1: 0, 3: 4, 2: 8, 1: 12}
_HINT = {-1: 0, 2: 3, 1: 6, 0: 10}
_FB = {"realtime-names": 0, "count-wrong": 4, "binary-check": 8, "submit-binary": 12}


# --- config ---------------------------------------------------------------------


def load_config(name: str, config_dir: Path) -> dict:
    return json.loads((config_dir / f"{name}.json").read_text(encoding="ascii"))


@dataclass(frozen=True)
class Cat:
    """A resolved category: glyph-backed values in solution order, ordinal or not.

    bijective categories carry exactly `entities` values (a permutation); shared
    categories carry fewer values that repeat across slots (e.g. a binary team).
    """

    id: str
    label: str
    ordinal: bool
    value_ids: list[str]
    glyphs: list[str]
    labels: list[str]
    cardinality: str = "bijective"
    # Story-first (corpus-driven matrix) parallel metadata; all optional. `anchor` marks the
    # identity axis (the subject); the retired `ordinal` field is kept only as an internal flag
    # (always False for story cats) so identity_cat can fall back to cats[0] when no anchor is set.
    phrases: list[str | None] | None = None
    ref_phrases: list[str | None] | None = None
    magnitudes: list[int | None] | None = None
    kind: str | None = None
    unit: str | None = None
    glyph_pack: str | None = None
    anchor: bool | None = None

    @property
    def shared(self) -> bool:
        return self.cardinality == "shared"


_STORY_SALT = 0x85EBCA6B  # decorrelate the story value-pick PRNG (corpus-driven matrix)


def build_story_categories(scenario, entities: int, seed: int) -> list[Cat]:
    """Build one bijective Cat per scenario category (subject first == the anchor). Every Cat
    keeps ordinal=False so identity_cat() anchors on the subject; the emitted manifest derives
    its display ordinal from kind. Date-seeded pick of N values per category (N = entities);
    glyphPack decorates value.glyph as '<pack>.<id>' or '' when the category has no pack."""
    rng = random.Random(seed ^ _STORY_SALT)
    cats: list[Cat] = []
    for tc in scenario.categories:
        pool = list(tc.valuePool)
        picked = rng.sample(pool, min(entities, len(pool)))
        gp = getattr(tc, "glyphPack", None)
        cats.append(
            Cat(
                id=tc.id, label=tc.label, ordinal=False,
                value_ids=[v.id for v in picked],
                glyphs=[f"{gp}.{v.id}" if gp else "" for v in picked],
                labels=[v.label for v in picked],
                cardinality="bijective",
                phrases=[v.phrase for v in picked],
                ref_phrases=[v.refPhrase for v in picked],
                magnitudes=[v.magnitude for v in picked],
                kind=tc.kind, unit=tc.unit, glyph_pack=gp, anchor=tc.anchor,
            )
        )
    return cats


# --- seed -----------------------------------------------------------------------


def story_seed(date: str, tier: Tier, variant: int) -> int:
    """Deterministic per (date, tier, variant) seed for the story-first matrix path, so the
    same triple rebuilds byte-identically (num_search_workers=1 + fixed clue order)."""
    return int(hashlib.sha256(f"{date}:{tier}:{variant}".encode("ascii")).hexdigest()[:8], 16)


# --- CP-SAT model ---------------------------------------------------------------

# A clue = (type, [(cat_id, value_id), ...], params). cat/value, never an entity.
Clue = tuple[str, tuple[tuple[str, str], ...], tuple[tuple[str, int | str], ...]]


def _mag_at_slot(m: cp_model.CpModel, x: dict, cat_id: str, mags: dict, slot: int):
    """IntVar = the integer magnitude of the numeric value occupying the (constant) slot. One
    reified bool per value (b_v <-> value v sits at slot), exactly one true, magnitude = the
    weighted sum. The slot is a constant because numeric operands are anchor (identity) values."""
    bvs, weights = [], []
    for v, mg in mags.items():
        b = m.NewBoolVar("")
        m.Add(x[cat_id][v] == slot).OnlyEnforceIf(b)
        m.Add(x[cat_id][v] != slot).OnlyEnforceIf(b.Not())
        bvs.append(b)
        weights.append(mg)
    m.Add(sum(bvs) == 1)
    mag_v = m.NewIntVar(min(weights), max(weights), "")
    m.Add(mag_v == cp_model.LinearExpr.WeightedSum(bvs, weights))
    return mag_v


def _reify_at(m: cp_model.CpModel, var, slot: int):
    """A fresh bool b with b <-> (var == slot), enforced both ways so the compound clues built on
    it (oneOf disjunction, ifThen implication) reason correctly in either direction."""
    b = m.NewBoolVar("")
    m.Add(var == slot).OnlyEnforceIf(b)
    m.Add(var != slot).OnlyEnforceIf(b.Not())
    return b


def _add_clue(
    m: cp_model.CpModel, x: dict, seat: dict, vid: dict, n: int, mag: dict, clue: Clue,
) -> None:
    typ, ops, params = clue
    p = dict(params)
    ca, va = ops[0]
    if typ == "threshold":  # single anchor operand: numeric magnitude at its fixed slot vs a bound
        nc = p["numericCat"]
        mag_a = _mag_at_slot(m, x, nc, mag[nc], vid[ca][va])
        (m.Add(mag_a <= p["bound"]) if p.get("dir") == "atmost" else m.Add(mag_a >= p["bound"]))
        return
    cb, vb = ops[1]
    if typ == "numDiff":  # two anchor operands: magnitude gap of the numeric cat at their slots
        nc = p["numericCat"]
        mag_a = _mag_at_slot(m, x, nc, mag[nc], vid[ca][va])
        mag_b = _mag_at_slot(m, x, nc, mag[nc], vid[cb][vb])
        if p.get("dir") == "greater":  # directed: a is exactly delta more than b
            m.Add(mag_a == mag_b + p["delta"])
        else:  # undirected: absolute gap equals delta
            span = max(mag[nc].values()) - min(mag[nc].values())
            t = m.NewIntVar(0, span, "")
            m.AddAbsEquality(t, mag_a - mag_b)
            m.Add(t == p["delta"])
        return
    if typ == "oneOf":  # disjunction: the C-value at a's (anchor-fixed) slot is x OR y
        sa = vid[ca][va]  # a is an anchor value, so its slot is a constant (identity)
        cx, vx = ops[1]
        cy, vy = ops[2]
        bx = _reify_at(m, x[cx][vx], sa)
        by = _reify_at(m, x[cy][vy], sa)
        m.AddBoolOr([bx, by])
        return
    if typ == "oneEachOf":  # of entities x, y one holds fact A and the other holds fact B
        sx = vid[ops[0][0]][ops[0][1]]
        sy = vid[ops[1][0]][ops[1][1]]
        (ac, av), (bc2, bv2) = ops[2], ops[3]
        t = m.NewBoolVar("")  # t: x holds A and y holds B; not t: the mirror
        m.Add(x[ac][av] == sx).OnlyEnforceIf(t)
        m.Add(x[bc2][bv2] == sy).OnlyEnforceIf(t)
        m.Add(x[ac][av] == sy).OnlyEnforceIf(t.Not())
        m.Add(x[bc2][bv2] == sx).OnlyEnforceIf(t.Not())
        return
    if typ == "ifThen":  # material implication: (a holds P) => not (b holds Q)
        sa = vid[ops[0][0]][ops[0][1]]
        (pc, pv) = ops[1]
        sb = vid[ops[2][0]][ops[2][1]]
        (qc, qv) = ops[3]
        bp = _reify_at(m, x[pc][pv], sa)
        bq = _reify_at(m, x[qc][qv], sb)
        m.AddImplication(bp, bq.Not())
        return
    if typ in ("eq", "neq"):
        # eq/neq across a bijective + a (possibly) shared cat: the shared value at the
        # bijective value's slot == that value. Pure-bijective pairs compare slots.
        if cb in seat:  # b is shared: value at slot of a (a is bijective) is vb
            slot = m.NewIntVar(0, n - 1, "")
            m.Add(slot == x[ca][va])
            tv = m.NewIntVar(0, len(vid[cb]) - 1, "")
            m.AddElement(slot, seat[cb], tv)
            (m.Add(tv == vid[cb][vb]) if typ == "eq" else m.Add(tv != vid[cb][vb]))
        else:
            (m.Add(x[ca][va] == x[cb][vb]) if typ == "eq" else m.Add(x[ca][va] != x[cb][vb]))
        return
    raise ValueError(
        f"unsupported clue type {typ!r} "
        "(matrix-only vocabulary: eq/neq/numDiff/threshold/oneOf/oneEachOf/ifThen)"
    )


def identity_cat(cats: list[Cat]) -> Cat:
    """The identity axis: value i occupies slot i. The category flagged anchor, else the first."""
    return next((c for c in cats if c.anchor), cats[0])


def build_model(cats: list[Cat], n: int, clues: list[Clue]) -> tuple:
    m = cp_model.CpModel()
    anchor = identity_cat(cats)
    x: dict[str, dict[str, cp_model.IntVar]] = {}
    seat: dict[str, list[cp_model.IntVar]] = {}  # shared cats: slot -> value index
    vid: dict[str, dict[str, int]] = {}
    mag: dict[str, dict[str, int]] = {}  # numeric cats: value_id -> integer magnitude
    for c in cats:
        vid[c.id] = {v: i for i, v in enumerate(c.value_ids)}
        if getattr(c, "kind", None) == "numeric" and c.magnitudes:
            mag[c.id] = {c.value_ids[i]: c.magnitudes[i] for i in range(len(c.value_ids))}
        if c.shared:  # repeats allowed: one value index per slot, no AllDifferent
            seat[c.id] = [m.NewIntVar(0, len(c.value_ids) - 1, "") for _ in range(n)]
            continue
        x[c.id] = {v: m.NewIntVar(0, n - 1, "") for v in c.value_ids}
        m.AddAllDifferent(list(x[c.id].values()))
        if c is anchor:  # identity: value at index i sits at slot i (no floating)
            for i, v in enumerate(c.value_ids):
                m.Add(x[c.id][v] == i)
    for clue in clues:
        _add_clue(m, x, seat, vid, n, mag, clue)
    return m, x, seat, vid


def _solver(seed: int) -> cp_model.CpSolver:
    s = cp_model.CpSolver()
    s.parameters.num_search_workers = 1
    s.parameters.random_seed = seed & 0x7FFFFFFF
    s.parameters.max_time_in_seconds = SOLVE_LIMIT_S
    return s


def is_unique(cats: list[Cat], n: int, clues: list[Clue], seed: int) -> bool:
    """Solve; forbid that exact assignment via reified bools; re-solve INFEASIBLE."""
    m, x, seat, _ = build_model(cats, n, clues)
    s = _solver(seed)
    if _definite(s.Solve(m)) not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return False
    diff = []
    cells = [(var, s.Value(var)) for c in cats if c.id in x for var in x[c.id].values()]
    cells += [(var, s.Value(var)) for arr in seat.values() for var in arr]
    for var, val in cells:
        b = m.NewBoolVar("")
        m.Add(var != val).OnlyEnforceIf(b)
        m.Add(var == val).OnlyEnforceIf(b.Not())
        diff.append(b)
    m.AddBoolOr(diff)
    return _definite(_solver(seed).Solve(m)) == cp_model.INFEASIBLE


def uniqueness_status(cats: list[Cat], n: int, clues: list[Clue], seed: int) -> int:
    """The first-solve CP-SAT status for a clue set, guarded DEFINITE. Exposed so tests can assert
    a generated puzzle's solve is never UNKNOWN/MODEL_INVALID (a determinism precondition)."""
    m, *_ = build_model(cats, n, clues)
    return _definite(_solver(seed).Solve(m))


# --- enumerate clues true under the sampled solution ----------------------------


def sample_solution(cats: list[Cat], n: int, rng: random.Random) -> dict[str, list[str]]:
    """value_id -> slot per category. Position identity; bijective others a random
    permutation; shared repeats a balanced multiset across slots."""
    sol: dict[str, list[str]] = {}
    anchor = identity_cat(cats)
    for c in cats:
        if c.shared:
            mult = [c.value_ids[i % len(c.value_ids)] for i in range(n)]
            rng.shuffle(mult)
            sol[c.id] = mult  # slot -> value (repeats)
            continue
        ids = list(c.value_ids)
        if c is not anchor:
            rng.shuffle(ids)
        sol[c.id] = ids  # ids[slot] = value at that slot
    return sol


def _pos(sol: dict[str, list[str]], cat: str, val: str) -> int:
    return sol[cat].index(val)


def enumerate_clues(cats: list[Cat], n: int, sol: dict[str, list[str]]) -> list[Clue]:
    """Every eq/neq clue true under sol, across category pairs (matrix-only, shared-shared
    skipped). A shared cat compares via its partner's bijective slot; pure-bijective pairs
    compare slots directly. Numeric (numDiff/threshold) and compound (oneOf/oneEachOf/ifThen)
    candidates come from enumerate_numeric_clues + enumerate_compound_clues."""
    out: list[Clue] = []
    for ci, a in enumerate(cats):  # eq/neq across category pairs (skip shared-shared)
        for b in cats[ci + 1 :]:
            if a.shared and b.shared:
                continue
            lhs, rhs = (b, a) if a.shared else (a, b)  # bijective lhs resolves the slot
            for av in lhs.value_ids:
                slot = _pos(sol, lhs.id, av)
                for bv in rhs.value_ids:
                    same = sol[rhs.id][slot] == bv if rhs.shared else _pos(sol, rhs.id, bv) == slot
                    out.append(("eq" if same else "neq", ((lhs.id, av), (rhs.id, bv)), ()))
    return out


def enumerate_numeric_clues(cats: list[Cat], n: int, sol: dict[str, list[str]], tier: str, scenario) -> list[Clue]:
    """numDiff (directed 'greater') + threshold ('atleast') candidates TRUE under the sampled
    solution, for the first numeric category. Operands are anchor (identity) values so each slot
    is a constant; magnitudes are read from the category. Gated per type by the scenario
    clueTemplate minTier vs the tier (numDiff -> Standard+, threshold -> Sharp+). Empty when the
    scenario has no numeric category."""
    numcat = next((c for c in cats if getattr(c, "kind", None) == "numeric" and c.magnitudes), None)
    if numcat is None:
        return []
    anchor = identity_cat(cats)
    by_id = {v: i for i, v in enumerate(numcat.value_ids)}
    mag_by_slot = [numcat.magnitudes[by_id[sol[numcat.id][s]]] for s in range(n)]

    def mag_at(av: str) -> int:  # anchor value -> the magnitude sharing its (constant) slot
        return mag_by_slot[_pos(sol, anchor.id, av)]

    tmpl = scenario.clueTemplates
    out: list[Clue] = []
    if "numDiff" in tmpl and tier_at_least(tier, tmpl["numDiff"].minTier):
        for a in anchor.value_ids:  # every ordered pair where a is the larger charger
            for b in anchor.value_ids:
                if a != b and mag_at(a) > mag_at(b):
                    out.append(("numDiff", ((anchor.id, a), (anchor.id, b)),
                                (("numericCat", numcat.id), ("delta", mag_at(a) - mag_at(b)), ("dir", "greater"))))
    if "threshold" in tmpl and tier_at_least(tier, tmpl["threshold"].minTier):
        floor = min(mag_by_slot)
        bounds = sorted({mg for mg in mag_by_slot if mg > floor})  # non-trivial lower bounds
        for a in anchor.value_ids:
            for bound in bounds:
                if bound <= mag_at(a):
                    out.append(("threshold", ((anchor.id, a),),
                                (("numericCat", numcat.id), ("bound", bound), ("dir", "atleast"))))
    return out


def enumerate_compound_clues(cats: list[Cat], n: int, sol: dict[str, list[str]], tier: str, scenario) -> list[Clue]:
    """Reified compound candidates TRUE under the sampled solution, over the NON-anchor NOMINAL
    bijective categories (a numeric axis keeps its numDiff/threshold clues; "one of $5 or $8"
    reads poorly). Each type is gated by its clueTemplate minTier vs the tier, so oneOf/oneEachOf
    appear Sharp+ and ifThen Expert-only - no hardcoded tier list. Empty when the scenario omits a
    template or has no nominal attribute category. Operands put the anchor (identity) value first
    so its slot is a constant the model can reify against (see _add_clue)."""
    tmpl = scenario.clueTemplates
    anchor = identity_cat(cats)
    noms = [c for c in cats if c is not anchor and not c.shared and getattr(c, "kind", None) != "numeric"]
    out: list[Clue] = []
    if not noms:
        return out

    def val_at(cat: Cat, slot: int) -> str:  # the category value occupying a slot in the solution
        return sol[cat.id][slot]

    if "oneOf" in tmpl and tier_at_least(tier, tmpl["oneOf"].minTier):
        for a in anchor.value_ids:
            sa = _pos(sol, anchor.id, a)
            for c in noms:
                tv = val_at(c, sa)  # the value truly at a's slot (keeps the disjunction true)
                for decoy in c.value_ids:
                    if decoy != tv:
                        out.append(("oneOf", ((anchor.id, a), (c.id, tv), (c.id, decoy)), ()))
    if "oneEachOf" in tmpl and tier_at_least(tier, tmpl["oneEachOf"].minTier):
        for c in noms:
            for i, xe in enumerate(anchor.value_ids):
                for ye in anchor.value_ids[i + 1 :]:
                    sx, sy = _pos(sol, anchor.id, xe), _pos(sol, anchor.id, ye)
                    out.append(("oneEachOf", ((anchor.id, xe), (anchor.id, ye),
                                              (c.id, val_at(c, sx)), (c.id, val_at(c, sy))), ()))
    if "ifThen" in tmpl and tier_at_least(tier, tmpl["ifThen"].minTier):
        cp, cq = noms[0], noms[-1]  # antecedent over the first nominal, consequent over the last
        for i, a in enumerate(anchor.value_ids):
            sa = _pos(sol, anchor.id, a)
            for b in anchor.value_ids[i + 1 :]:  # one directed pair per couple keeps the pool small
                sb = _pos(sol, anchor.id, b)
                pv = val_at(cp, sa)  # a really holds P (antecedent true under the solution)
                qv = val_at(cq, (sb + 1) % n)  # a value b does NOT hold -> "b not Q" holds -> clue true
                if not (cp.id == cq.id and pv == qv):
                    out.append(("ifThen", ((anchor.id, a), (cp.id, pv), (anchor.id, b), (cq.id, qv)), ()))
    return out


# --- select + prune -------------------------------------------------------------


def select_minimal(
    cats: list[Cat], n: int, candidates: list[Clue], weights: dict, seed: int, rng: random.Random,
) -> list[Clue]:
    """Weighted greedy add to uniqueness, then shuffle-and-drop to a minimal set."""
    pool = sorted(candidates, key=lambda c: -weights.get(c[0], 1) + rng.random() / 1000)
    chosen: list[Clue] = []
    for clue in pool:
        if is_unique(cats, n, chosen, seed):
            break
        chosen.append(clue)
    order = list(chosen)
    rng.shuffle(order)
    for clue in order:
        trial = [c for c in chosen if c != clue]
        if is_unique(cats, n, trial, seed):
            chosen = trial
    return chosen


# --- hint trace (forced deduction order) ----------------------------------------


def hint_trace(cats: list[Cat], n: int, clues: list[Clue], sol: dict, seed: int) -> list[HintStep]:
    """Bijective cells forced in order: a cell is forced when no other value is feasible.
    Shared cells are not anchored to one entity, so the trace reveals bijective steps."""
    anchor = identity_cat(cats)
    attr = [c for c in cats if c is not anchor and not c.shared]
    known: list[tuple[str, str, int]] = []
    steps: list[HintStep] = []
    targets = [(c.id, v) for c in attr for v in c.value_ids]
    while len(steps) < len(targets):
        progressed = False
        for cat, val in targets:
            if any(k[0] == cat and k[1] == val for k in known):
                continue
            slot = _pos(sol, cat, val)
            m, x, _, _ = build_model(cats, n, clues)
            for kc, kv, ks in known:
                m.Add(x[kc][kv] == ks)
            m.Add(x[cat][val] != slot)
            if _definite(_solver(seed).Solve(m)) == cp_model.INFEASIBLE:
                ent = f"e{slot}"
                steps.append(
                    HintStep(
                        fromClues=_clue_ids_for(clues, cat, val),
                        forces=HintForce(entity=ent, cat=cat, value=val),
                    )
                )
                known.append((cat, val, slot))
                progressed = True
                break
        if not progressed:
            break
    return steps


def _clue_ids_for(clues: list[Clue], cat: str, val: str) -> list[str]:
    ids = [f"c{i + 1}" for i, cl in enumerate(clues) if any(o[0] == cat and o[1] == val for o in cl[1])]
    return ids or ["c1"]


# --- difficulty scorer ----------------------------------------------------------


def difficulty(tier_dial: dict, entities: int, n_cats: int, n_clues: int, indirect: int, depth: int) -> int:
    size = entities * n_cats
    indir = round(20 * indirect / n_clues) if n_clues else 0
    env = _ATT[tier_dial["attempts"]] + _HINT[tier_dial["hints"]] + _FB[tier_dial["feedback"]]
    return size + depth + indir + env


# --- emit manifest --------------------------------------------------------------


def canonical_sha(manifest: PuzzleManifest) -> tuple[str, str]:
    """Canonical one-line JSON + its sha256. exclude_none drops unset optionals so a served
    manifest carries NO null-valued fields (the manifest schema forbids present-null); a rebuild
    of the same (date, tier) is byte-identical."""
    payload = manifest.model_dump(by_alias=True, exclude_none=True)
    text = json.dumps(payload, sort_keys=True, ensure_ascii=True, separators=(",", ":"))
    return text, hashlib.sha256(text.encode("ascii")).hexdigest()


# --- pipeline -------------------------------------------------------------------


def write_puzzle(date: str, tier: Tier, out_dir: Path = PUZZLES_DIR, config_dir: Path = CONFIG_DIR) -> dict:
    """Write the served daily puzzle: a story-first master (canonical one-line JSON, no null
    optionals) to frontend/public/puzzles/<date>-<tier>.json. The served bank IS the story-first
    master - solutions ship in the manifest (design), variant 1 is the canonical daily. See
    docs/architecture/generator/pipeline.md."""
    manifest, d, _ = generate_story(date, tier, STORY_SERVED_VARIANT, config_dir)
    text, sha = canonical_sha(manifest)
    shape = manifest.shapeId
    fname = f"{date}-{tier}.json"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / fname).write_text(text + "\n", encoding="ascii")
    return {"date": date, "tier": tier, "shapeId": shape, "file": fname, "sha": sha, "D": d}


def write_index(date: str, entries: list[dict], out_dir: Path = PUZZLES_DIR) -> Path:
    index = BankIndex(
        schemaVersion=BANK_SCHEMA_VERSION, generatedSeed=date, builtAt=f"{date}T00:00:00Z",
        puzzles=[BankEntry(date=e["date"], tier=e["tier"], shapeId=e["shapeId"], file=e["file"], sha=e["sha"]) for e in entries],
    )
    text = json.dumps(index.model_dump(), sort_keys=True, ensure_ascii=True, indent=2) + "\n"
    out = out_dir / "index.json"
    out.write_text(text, encoding="ascii")
    return out


# --- story-first (corpus-driven matrix) -----------------------------------------


def _numeric_types_for_tier(scenario, tier: str) -> tuple[str, ...]:
    """The numeric clue types (numDiff/threshold) the scenario gates IN at this tier via minTier."""
    tmpl = scenario.clueTemplates
    return tuple(t for t in NUMERIC_TYPES if t in tmpl and tier_at_least(tier, tmpl[t].minTier))


def _story_acceptable(
    clues: list[Clue], hints: list[HintStep], d: int, band: tuple[int, int], share_cap: float,
    numeric_types: tuple[str, ...], full_depth: int, indir_band: tuple[float, float],
) -> bool:
    """Accept a story puzzle only when it is in the tier band, is zero-guess (the forced trace
    reaches every non-anchor cell), keeps eq present, satisfies the tier's indirection contract
    (config-driven from tiers.json `indir`), carries at least one numeric clue when the tier gates
    one in, holds at most one ifThen (the compound conditional is a rare spice), and has at least
    one single-clue eq opener. Guarantees the quality gates (P1/P2/P4/P5) hold on the emitted
    manifest even with numeric and compound clues present.

    Indirection contract: a tier whose `indir` upper bound is 0 (easy - the tutorial) is ALL-DIRECT
    by design, so it forbids any indirect clue and the variety/share cap does not apply (an all-eq
    easy grid is exactly what the tier wants, not a variety failure). Every other tier declares a
    non-zero indirection budget, so the share cap keeps a single type from dominating."""
    lo, hi = band
    if not (lo <= d <= hi):
        return False
    if len(hints) != full_depth:  # zero-guess: the trace forces every non-anchor bijective cell
        return False
    types = [c[0] for c in clues]
    if not types or "eq" not in types:
        return False
    if numeric_types and not any(t in numeric_types for t in types):  # a numeric clue must appear
        return False
    if types.count("ifThen") > 1:  # at most one conditional per puzzle (the gate the tests assert)
        return False
    if indir_band[1] > 0.0:  # tier allows indirection -> variety cap keeps one type from dominating
        if max(types.count(t) for t in set(types)) / len(types) > share_cap:
            return False
    elif any(t in INDIRECT_TYPES for t in types):  # all-direct tier: no indirect clues at all
        return False
    ctype = {f"c{i + 1}": clues[i][0] for i in range(len(clues))}
    return any(len(s.fromClues) == 1 and ctype.get(s.fromClues[0]) == "eq" for s in hints)


def to_story_manifest(date, tier, scenario, variant, cats, n, clues, sol, hints, rev, seed) -> PuzzleManifest:
    """Story-first PuzzleManifest v2: subject-anchored grid with narrative + full-sentence clues.
    Emits kind (required) + anchor (required, the subject) + optional unit/glyphPack per category
    and optional magnitude/phrase/refPhrase per value. The retired boolean `ordinal` field is not
    emitted; kind carries the ordinal/numeric distinction. schemaVersion is 2 (the contract close)."""
    cat_models = []
    for c in cats:
        values = [
            AttributeValue(
                id=v, glyph=c.glyphs[i], label=c.labels[i],
                magnitude=(c.magnitudes[i] if c.magnitudes else None),
                phrase=(c.phrases[i] if c.phrases else None),
                refPhrase=(c.ref_phrases[i] if c.ref_phrases else None),
            )
            for i, v in enumerate(c.value_ids)
        ]
        cat_models.append(
            AttributeCategory(
                id=c.id, label=c.label, kind=c.kind, anchor=bool(c.anchor),
                cardinality=c.cardinality, values=values, unit=c.unit, glyphPack=c.glyph_pack,
            )
        )
    constraints = [
        Constraint(
            id=f"c{i + 1}", type=cl[0], operands=[Operand(cat=o[0], value=o[1]) for o in cl[1]],
            params={k: v for k, v in cl[2]}, clueText=render_clue(scenario, tier, cats, cl, seed, i),
            renderHint=cl[0],
        )
        for i, cl in enumerate(clues)
    ]
    solution = {f"e{i}": {c.id: sol[c.id][i] for c in cats} for i in range(n)}
    return PuzzleManifest(
        schemaVersion=PUZZLE_SCHEMA_VERSION, puzzleId=date, tier=tier, shapeId="grid", templateRev=rev,
        entities=[f"e{i}" for i in range(n)],
        categories=Categories.model_validate({"n": len(cats), "list": cat_models}),
        constraints=constraints, solution=solution, hintTrace=hints,
        scenarioId=scenario.id, story=render_story(scenario, n, seed),
        subjectNoun=scenario.subjectNoun, variant=variant,
    )


@dataclass(frozen=True)
class StoryBuild:
    """The accepted story-first attempt: the emitted manifest plus the solver-internal artifacts
    (cats/clues/solution/seed) so tests can re-verify uniqueness, DEFINITE status, and numeric
    facts without re-running the reseed loop."""

    manifest: PuzzleManifest
    d: int
    log: list[dict]
    cats: list[Cat]
    clues: list[Clue]
    sol: dict[str, list[str]]
    hints: list[HintStep]
    seed: int
    entities: int
    scenario: object


def build_story(
    date: str, tier: Tier, variant: int = 1, config_dir: Path = CONFIG_DIR, scenario_path: Path | None = None
) -> StoryBuild:
    """Corpus-driven story-first matrix reusing the CP-SAT pipeline: take the tier's dimension
    budget (tiers.json categories, subject first), sample a unique solution, enumerate eq/neq +
    numeric (numDiff/threshold) + compound (oneOf/oneEachOf/ifThen) clues TRUE under it - each
    tier-gated by its clueTemplate minTier - weighted-select a minimal set, verify uniqueness,
    trace the forced deduction, and reseed until the puzzle is in band + zero-guess + varied +
    carries a numeric clue when the tier gates one in (<= 1 ifThen). Deterministic for a given
    (date, tier, variant). Returns the manifest plus the internals used to build it."""
    tiers = load_config("tiers", config_dir)[tier]
    dials = load_config("dials", config_dir)
    story = dials["story"]
    scenario = load_scenario_template() if scenario_path is None else load_scenario_template(scenario_path)
    entities = tiers["entities"]
    base = story_seed(date, tier, variant)
    cats = build_story_categories(scenario, entities, base)
    budget = min(tiers["categories"], len(cats))  # config-driven dimension count per tier (tiers.json)
    cats = cats[:budget]  # subject stays cats[0] (the identity anchor); lower tiers use fewer axes
    anchor = identity_cat(cats)
    full_depth = sum(1 for c in cats if c is not anchor and not c.shared) * entities
    numeric_types = _numeric_types_for_tier(scenario, tier)
    band = (tiers["band"][0], tiers["band"][1])
    share_cap = story["share_cap"]
    indir_band = (tiers["indir"][0], tiers["indir"][1])  # tier's declared indirection budget (fraction)
    log: list[dict] = []
    for attempt in range(dials["max_reseeds"]):
        seed = base + attempt
        rng = random.Random(seed)
        sol = sample_solution(cats, entities, rng)
        cand = enumerate_clues(cats, entities, sol)
        cand += enumerate_numeric_clues(cats, entities, sol, tier, scenario)
        cand += enumerate_compound_clues(cats, entities, sol, tier, scenario)
        clues = select_minimal(cats, entities, cand, story["weights"], seed, rng)
        hints = hint_trace(cats, entities, clues, sol, seed)
        indirect = sum(1 for c in clues if c[0] in INDIRECT_TYPES)
        d = difficulty(tiers, entities, len(cats), len(clues), indirect, len(hints))
        log.append({"attempt": attempt, "clues": len(clues), "indirect": indirect, "depth": len(hints), "D": d})
        if _story_acceptable(clues, hints, d, band, share_cap, numeric_types, full_depth, indir_band):
            m = to_story_manifest(
                date, tier, scenario, variant, cats, entities, clues, sol, hints, dials["template_rev"], seed
            )
            return StoryBuild(m, d, log, cats, clues, sol, hints, seed, entities, scenario)
    raise RuntimeError(
        f"no acceptable story puzzle for {date}/{tier} v{variant} after {dials['max_reseeds']} reseeds "
        f"(band {band}, numeric {numeric_types or 'none'})"
    )


def generate_story(
    date: str, tier: Tier, variant: int = 1, config_dir: Path = CONFIG_DIR, scenario_path: Path | None = None
) -> tuple[PuzzleManifest, int, list[dict]]:
    """Public entry: the story-first manifest + difficulty + per-attempt log (see build_story)."""
    b = build_story(date, tier, variant, config_dir, scenario_path)
    return b.manifest, b.d, b.log


def write_story_master(
    date: str, tier: Tier, variant: int = 1, out_root: Path = DATASETS_DIR,
    config_dir: Path = CONFIG_DIR, scenario_path: Path | None = None,
) -> dict:
    """Emit the story master to datasets/<yyyy>/<mm>/<dd>/<tier>/<date>-<vvv>.json as canonical
    JSON (sort_keys, ASCII, 2-space indent, trailing newline). None-valued optionals dropped."""
    m, d, _ = generate_story(date, tier, variant, config_dir, scenario_path)
    payload = m.model_dump(by_alias=True, exclude_none=True)
    text = json.dumps(payload, sort_keys=True, ensure_ascii=True, indent=2) + "\n"
    out_dir = out_root / date[:4] / date[5:7] / date[8:10] / tier
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{date}-{variant:03d}.json"
    out.write_text(text, encoding="ascii")
    return {"file": out.as_posix(), "tier": tier, "variant": variant, "D": d}


def _entry_for(date: str, tier: Tier, out_dir: Path, config_dir: Path, force: bool) -> dict:
    """Add-only: an EXISTING dated puzzle file is FROZEN - never regenerated - so an already
    shipped puzzle can't be invalidated when the glyph packs expand. The manifest is rebaked
    every build, but puzzles are immutable once written. Returns the bank entry either way;
    --force overrides the freeze (used once to migrate puzzles built before this contract)."""
    fpath = out_dir / f"{date}-{tier}.json"
    if fpath.exists() and not force:
        m = PuzzleManifest.model_validate_json(fpath.read_text(encoding="ascii"))
        _, sha = canonical_sha(m)
        return {"date": date, "tier": tier, "shapeId": m.shapeId, "file": fpath.name, "sha": sha, "D": -1, "frozen": True}
    e = write_puzzle(date, tier, out_dir, config_dir)
    e["frozen"] = False
    return e


def backfill_dates(end: str, n: int) -> list[str]:
    """The n calendar dates ending at `end` (inclusive), oldest-first. Deterministic;
    callers pass end <= today so a backfill never spoils a future (unreleased) date."""
    end_dt = datetime.strptime(end, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return [(end_dt - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(n - 1, -1, -1)]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Build the daily puzzle bank (add-only; existing files frozen).")
    ap.add_argument("--date", default="today", help="YYYY-MM-DD or 'today' (UTC)")
    ap.add_argument("--tiers", default="easy,standard,sharp,expert")
    ap.add_argument(
        "--backfill", type=int, nargs="?", const=7, default=0, metavar="N",
        help="also build the last N UTC days up to and including today (archive); never future. Bare flag = 7.",
    )
    ap.add_argument("--force", action="store_true", help="regenerate even if the dated file already exists")
    ap.add_argument(
        "--story", action="store_true",
        help="emit story-first master(s) to datasets/ (corpus-driven matrix) instead of the daily bank",
    )
    ap.add_argument("--variant", type=int, default=1, help="story variant number (with --story); default 1")
    args = ap.parse_args(argv)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    anchor = today if args.date == "today" else args.date
    tiers = [t.strip() for t in args.tiers.split(",") if t.strip()]
    if args.story:
        for tier in tiers:
            r = write_story_master(anchor, tier, args.variant)
            print(f"{r['file']} D={r['D']}")
        return 0
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    # Backfill ends at `anchor` but never past today (no spoiling an unreleased date).
    dates = backfill_dates(min(anchor, today), args.backfill) if args.backfill > 0 else [anchor]
    all_entries: list[dict] = []
    for date in dates:
        entries, lines = [], []
        for tier in tiers:
            e = _entry_for(date, tier, PUZZLES_DIR, CONFIG_DIR, args.force)
            entries.append(e)
            lines.append(json.dumps({"date": date, **e}, sort_keys=True))
            print(f"{e['file']} " + ("frozen" if e["frozen"] else f"sha={e['sha'][:12]} D={e['D']}"))
        (LOGS_DIR / f"build-{date}.jsonl").write_text("\n".join(lines) + "\n", encoding="ascii")
        all_entries.extend(entries)
    write_index(dates[-1], all_entries)  # dates[-1] == newest (today) -> generatedSeed served for play
    print(f"index.json ({len(all_entries)} puzzles across {len(dates)} day(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
