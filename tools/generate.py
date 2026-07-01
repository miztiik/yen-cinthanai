"""Build-time daily-bank generator: pipes and filters, no in-browser solver.

  config/tiers.toml + config/dials.toml + date
    -> seed (PRNG + CP-SAT random_seed)
    -> sample full bijective solution
    -> enumerate clues true under solution
    -> weighted-select a subset, verify uniqueness, prune to minimal
    -> template clueText -> compute D (reject + reseed if out of band)
    -> emit PuzzleManifest (validated by tools.models) + canonical-JSON sha
    -> append BankIndex; JSONL log to .logs/build-<date>.jsonl

Determinism: num_search_workers=1, fixed random_seed; canonical JSON (sort_keys,
ASCII) sha -> a rebuild of the same date is byte-identical. No hardcoding: every
tunable comes from config/. ASCII + POSIX only. See docs/architecture/generator/
pipeline.md, docs/concepts/difficulty-and-scoring.md, docs/architecture/contracts.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
import tomllib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

from ortools.sat.python import cp_model

sys.path.insert(0, str(Path(__file__).resolve().parent))  # sibling models on path

from models import (  # noqa: E402
    SCHEMA_VERSION,
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

_ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = _ROOT / "config"
PUZZLES_DIR = _ROOT / "frontend" / "public" / "puzzles"
GLYPHS_INDEX = _ROOT / "frontend" / "public" / "assets" / "glyphs" / "index.json"
LOGS_DIR = _ROOT / ".logs"

DIRECT_TYPES = ("eq", "ends")
INDIRECT_TYPES = ("neq", "adjacent", "distance", "before", "opposite", "between")
SOLVE_LIMIT_S = 10.0

# Difficulty ENV dial weights (docs/concepts/difficulty-and-scoring.md). Keyed by
# the config/tiers.toml dial values; no magic numbers escape this table.
_ATT = {-1: 0, 3: 4, 2: 8, 1: 12}
_HINT = {-1: 0, 2: 3, 1: 6, 0: 10}
_FB = {"realtime-names": 0, "count-wrong": 4, "binary-check": 8, "submit-binary": 12}


# --- config ---------------------------------------------------------------------


def load_toml(name: str, config_dir: Path) -> dict:
    return tomllib.loads((config_dir / f"{name}.toml").read_text(encoding="ascii"))


@dataclass(frozen=True)
class Shape:
    """A resolved shape-registry entry (config/shapes.toml). The engine reads shapeId."""

    id: str
    topology: str
    ordinal_axis: bool
    max_entities: int
    slot_rules: tuple[str, ...]


def resolve_shape(shape_id: str, config_dir: Path) -> Shape:
    """Look up a shapeId in the registry; raise on unknown (fail fast, no bespoke code)."""
    reg = load_toml("shapes", config_dir)
    if shape_id not in reg:
        raise KeyError(f"unknown shapeId '{shape_id}' (registry: {sorted(reg)})")
    s = reg[shape_id]
    return Shape(shape_id, s["topology"], s["ordinal_axis"], s["max_entities"], tuple(s["slot_rules"]))


def shape_for(tier: Tier, config_dir: Path) -> str:
    """Tier -> shapeId (config/dials.toml tier table). The only place tier picks shape."""
    return load_toml("dials", config_dir)["tier"][tier]["shape"]



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

    @property
    def shared(self) -> bool:
        return self.cardinality == "shared"


# Packs that are NOT puzzle value dimensions: 'abstract' holds the ordinal seat numerals
# (num1..numN) plus the clue/UI glyphs (grid, opposite, between, ...).
_STRUCTURAL_PACKS = ("abstract",)
_CAT_SALT = 0x9E3779B9  # decorrelate the dimension-pick PRNG from the per-attempt solution PRNG


def _manifest_packs(config_dir: Path) -> dict:
    """pack -> {slug: {file,label}} from the generated glyph manifest (tools/bake_glyphs.py)."""
    return json.loads(GLYPHS_INDEX.read_text(encoding="ascii"))["packs"]


def _value_cat(pack: str, manifest: dict, value_ids: list[str], cardinality: str) -> Cat:
    """A nominal value dimension: the folder is the category, its files are the values."""
    return Cat(
        id=pack,
        label=pack[:1].upper() + pack[1:],
        ordinal=False,
        value_ids=value_ids,
        glyphs=[f"{pack}.{v}" for v in value_ids],
        labels=[manifest[pack][v]["label"] for v in value_ids],
        cardinality=cardinality,
    )


def build_categories(tier: Tier, entities: int, config_dir: Path, date: str) -> list[Cat]:
    """Derive the puzzle's dimensions FROM THE GLYPH MANIFEST (auto-discovering: a new pack
    folder becomes selectable with zero code change). Date-seeded, so each day draws a
    different slice of folders + values from the FULL pool (that is the diversity), while a
    rebuild of the same date is identical. The solver is glyph-agnostic, so which packs and
    values get picked never changes uniqueness or difficulty - only the visual skin.

    Structure comes from config (dials [tier.<tier>]): `nominal` bijective value packs and
    `shared` binary packs, plus the ordinal seat axis when the shape has one."""
    manifest = _manifest_packs(config_dir)
    shape = resolve_shape(shape_for(tier, config_dir), config_dir)
    spec = load_toml("dials", config_dir)["tier"][tier]
    n_nominal, n_shared = spec["nominal"], spec.get("shared", 0)
    rng = random.Random(seed_int(date, tier, config_dir) ^ _CAT_SALT)

    cats: list[Cat] = []
    if shape.ordinal_axis:  # seat axis: value i sits at seat i (abstract numerals)
        nums = [f"num{i + 1}" for i in range(entities)]
        cats.append(Cat("position", "Seat", True, nums, [f"abstract.{v}" for v in nums],
                        [str(i + 1) for i in range(entities)], "bijective"))

    # eligible value packs: every folder (except structural) with enough glyphs to fill a seat
    pool = sorted(p for p in manifest if p not in _STRUCTURAL_PACKS and len(manifest[p]) >= entities)
    picks = rng.sample(pool, min(n_nominal + n_shared, len(pool)))
    for pack in picks[:n_nominal]:  # bijective: one distinct value per seat
        cats.append(_value_cat(pack, manifest, sorted(rng.sample(sorted(manifest[pack]), entities)), "bijective"))
    for pack in picks[n_nominal:n_nominal + n_shared]:  # shared: 2 values repeat across seats
        cats.append(_value_cat(pack, manifest, sorted(rng.sample(sorted(manifest[pack]), 2)), "shared"))
    return cats


# --- seed -----------------------------------------------------------------------


def seed_int(date: str, tier: Tier, config_dir: Path) -> int:
    salt = load_toml("dials", config_dir)["seed_salt"]
    digest = hashlib.sha256(f"{salt}:{date}:{tier}".encode("ascii")).hexdigest()
    return int(digest[:8], 16)


# --- CP-SAT model ---------------------------------------------------------------

# A clue = (type, [(cat_id, value_id), ...], params). cat/value, never an entity.
Clue = tuple[str, tuple[tuple[str, str], ...], tuple[tuple[str, int], ...]]


def _add_clue(m: cp_model.CpModel, x: dict, seat: dict, vid: dict, n: int, circular: bool, clue: Clue) -> None:
    typ, ops, params = clue
    p = dict(params)
    ca, va = ops[0]
    if typ == "ends":
        m.Add(x[ca][va] == p["pos"])
        return
    cb, vb = ops[1]
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
    if typ == "before":
        m.Add(x[ca][va] < x[cb][vb])
        return
    if typ == "opposite":  # half the table apart (circular, n even)
        t = m.NewIntVar(0, n - 1, "")
        m.AddAbsEquality(t, x[ca][va] - x[cb][vb])
        m.Add(t == n // 2)
        return
    if typ == "between":  # a is flanked by b and c (adjacent to both, wraps)
        _wrap_adjacent(m, x[ops[0][0]][ops[0][1]], x[ops[1][0]][ops[1][1]], n, circular)
        _wrap_adjacent(m, x[ops[0][0]][ops[0][1]], x[ops[2][0]][ops[2][1]], n, circular)
        return
    if typ == "adjacent":
        _wrap_adjacent(m, x[ca][va], x[cb][vb], n, circular)
        return
    t = m.NewIntVar(0, n - 1, "")  # distance:k
    m.AddAbsEquality(t, x[ca][va] - x[cb][vb])
    m.Add(t == p["k"])


def _wrap_adjacent(m: cp_model.CpModel, a, b, n: int, circular: bool) -> None:
    """|a-b| == 1, or == n-1 too when the table wraps (round table has no ends)."""
    t = m.NewIntVar(0, n - 1, "")
    m.AddAbsEquality(t, a - b)
    if circular:
        one, wrap = m.NewBoolVar(""), m.NewBoolVar("")
        m.Add(t == 1).OnlyEnforceIf(one)
        m.Add(t == n - 1).OnlyEnforceIf(wrap)
        m.AddBoolOr(one, wrap)
    else:
        m.Add(t == 1)


def identity_cat(cats: list[Cat]) -> Cat:
    """The anchor: value i occupies slot i. Ordinal axis if present, else the first."""
    return next((c for c in cats if c.ordinal), cats[0])


def build_model(cats: list[Cat], n: int, clues: list[Clue], circular: bool = False) -> tuple:
    m = cp_model.CpModel()
    anchor = identity_cat(cats)
    x: dict[str, dict[str, cp_model.IntVar]] = {}
    seat: dict[str, list[cp_model.IntVar]] = {}  # shared cats: slot -> value index
    vid: dict[str, dict[str, int]] = {}
    for c in cats:
        vid[c.id] = {v: i for i, v in enumerate(c.value_ids)}
        if c.shared:  # repeats allowed: one value index per slot, no AllDifferent
            seat[c.id] = [m.NewIntVar(0, len(c.value_ids) - 1, "") for _ in range(n)]
            continue
        x[c.id] = {v: m.NewIntVar(0, n - 1, "") for v in c.value_ids}
        m.AddAllDifferent(list(x[c.id].values()))
        if c is anchor:  # identity: value at index i sits at slot i (no floating)
            for i, v in enumerate(c.value_ids):
                m.Add(x[c.id][v] == i)
    for clue in clues:
        _add_clue(m, x, seat, vid, n, circular, clue)
    return m, x, seat, vid


def _solver(seed: int) -> cp_model.CpSolver:
    s = cp_model.CpSolver()
    s.parameters.num_search_workers = 1
    s.parameters.random_seed = seed & 0x7FFFFFFF
    s.parameters.max_time_in_seconds = SOLVE_LIMIT_S
    return s


def is_unique(cats: list[Cat], n: int, clues: list[Clue], seed: int, circular: bool = False) -> bool:
    """Solve; forbid that exact assignment via reified bools; re-solve INFEASIBLE."""
    m, x, seat, _ = build_model(cats, n, clues, circular)
    s = _solver(seed)
    if s.Solve(m) not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
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
    return _solver(seed).Solve(m) == cp_model.INFEASIBLE


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


def enumerate_clues(
    cats: list[Cat], n: int, sol: dict[str, list[str]], allowed: tuple[str, ...] | None = None,
    circular: bool = False
) -> list[Clue]:
    """Every clue true under sol, drawn from the v1/v2 catalog, kept only if the shape's
    slot_rules allow the type (registry-gated, no per-shape code). cat/value operands.
    Shared cats compare via the bijective slot; circular tables wrap + gain opposite."""
    out: list[Clue] = []
    ordinal = [c for c in cats if c.ordinal]
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
    if circular:  # ring relations across ALL bijective values (tea opposite cat, etc.)
        bij = [(c.id, v) for c in cats if not c.shared for v in c.value_ids]
        for i, (ca, va) in enumerate(bij):
            for cb, vb in bij[i + 1 :]:
                if ca == cb and va == vb:
                    continue
                d = abs(_pos(sol, ca, va) - _pos(sol, cb, vb))
                dmin = min(d, n - d)
                if dmin == 1:
                    out.append(("adjacent", ((ca, va), (cb, vb)), ()))
                if n % 2 == 0 and dmin == n // 2:
                    out.append(("opposite", ((ca, va), (cb, vb)), ()))
        for oc in ordinal:  # between: a seat flanked by its two ring neighbours
            vs, order = oc.value_ids, [_pos(sol, oc.id, w) for w in oc.value_ids]
            for mid in vs:
                pm = _pos(sol, oc.id, mid)
                lo, hi = vs[order.index((pm - 1) % n)], vs[order.index((pm + 1) % n)]
                out.append(("between", ((oc.id, mid), (oc.id, lo), (oc.id, hi)), ()))
    else:
        for oc in ordinal:  # linear seat row: ends + ordinal seat relations
            vs = oc.value_ids
            for v in vs:
                p = _pos(sol, oc.id, v)
                if p in (0, n - 1):
                    out.append(("ends", ((oc.id, v),), (("pos", p),)))
            for i, av in enumerate(vs):
                for bv in vs[i + 1 :]:
                    pa, pb = _pos(sol, oc.id, av), _pos(sol, oc.id, bv)
                    d = abs(pa - pb)
                    out.append(("adjacent" if d == 1 else "distance", ((oc.id, av), (oc.id, bv)), () if d == 1 else (("k", d),)))
                    lo, hi = (av, bv) if pa < pb else (bv, av)
                    out.append(("before", ((oc.id, lo), (oc.id, hi)), ()))
    return out if allowed is None else [c for c in out if c[0] in allowed]


# --- select + prune -------------------------------------------------------------


def select_minimal(
    cats: list[Cat], n: int, candidates: list[Clue], weights: dict, seed: int, rng: random.Random,
    circular: bool = False
) -> list[Clue]:
    """Weighted greedy add to uniqueness, then shuffle-and-drop to a minimal set."""
    pool = sorted(candidates, key=lambda c: -weights.get(c[0], 1) + rng.random() / 1000)
    chosen: list[Clue] = []
    for clue in pool:
        if is_unique(cats, n, chosen, seed, circular):
            break
        chosen.append(clue)
    order = list(chosen)
    rng.shuffle(order)
    for clue in order:
        trial = [c for c in chosen if c != clue]
        if is_unique(cats, n, trial, seed, circular):
            chosen = trial
    return chosen


# --- hint trace (forced deduction order) ----------------------------------------


def hint_trace(cats: list[Cat], n: int, clues: list[Clue], sol: dict, seed: int, circular: bool = False) -> list[HintStep]:
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
            m, x, _, _ = build_model(cats, n, clues, circular)
            for kc, kv, ks in known:
                m.Add(x[kc][kv] == ks)
            m.Add(x[cat][val] != slot)
            if _solver(seed).Solve(m) == cp_model.INFEASIBLE:
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

_TEMPLATES = {
    "eq": "{a} sits with the {b}.",
    "neq": "{a} is not with the {b}.",
    "ends": "{a} is far {side}.",
    "adjacent": "{a} is next to {b}.",
    "distance": "{a} and {b} are {k} apart.",
    "before": "{a} is before {b}.",
    "opposite": "{a} sits across from {b}.",
    "between": "{a} sits between {b} and {c}.",
}


def _label(cats: list[Cat], cat: str, val: str) -> str:
    c = next(c for c in cats if c.id == cat)
    return c.labels[c.value_ids.index(val)]


def clue_text(cats: list[Cat], n: int, clue: Clue) -> str:
    typ, ops, params = clue
    p = dict(params)
    a = _label(cats, *ops[0])
    if typ == "ends":
        return _TEMPLATES[typ].format(a=a, side="left" if p["pos"] == 0 else "right")
    b = _label(cats, *ops[1])
    c = _label(cats, *ops[2]) if len(ops) > 2 else ""
    return _TEMPLATES[typ].format(a=a, b=b, c=c, k=p.get("k", ""))


def to_manifest(date, tier, shape, rev, cats, n, clues, sol, hints) -> PuzzleManifest:
    cat_models = [
        AttributeCategory(
            id=c.id, label=c.label, ordinal=c.ordinal, cardinality=c.cardinality,
            values=[AttributeValue(id=v, glyph=g, label=lb) for v, g, lb in zip(c.value_ids, c.glyphs, c.labels)],
        )
        for c in cats
    ]
    constraints = [
        Constraint(
            id=f"c{i + 1}", type=cl[0], operands=[Operand(cat=o[0], value=o[1]) for o in cl[1]],
            params={k: v for k, v in cl[2]}, clueText=clue_text(cats, n, cl), renderHint=cl[0],
        )
        for i, cl in enumerate(clues)
    ]
    solution = {f"e{i}": {c.id: sol[c.id][i] for c in cats} for i in range(n)}
    return PuzzleManifest(
        schemaVersion=SCHEMA_VERSION, puzzleId=date, tier=tier, shapeId=shape, templateRev=rev,
        entities=[f"e{i}" for i in range(n)], categories=Categories.model_validate({"n": len(cats), "list": cat_models}),
        constraints=constraints, solution=solution, hintTrace=hints,
    )


def canonical_sha(manifest: PuzzleManifest) -> tuple[str, str]:
    text = json.dumps(manifest.model_dump(by_alias=True), sort_keys=True, ensure_ascii=True, separators=(",", ":"))
    return text, hashlib.sha256(text.encode("ascii")).hexdigest()


# --- pipeline -------------------------------------------------------------------


def generate(date: str, tier: Tier, config_dir: Path = CONFIG_DIR) -> tuple[PuzzleManifest, int, list[dict]]:
    tiers = load_toml("tiers", config_dir)[tier]
    dials = load_toml("dials", config_dir)
    shape = resolve_shape(shape_for(tier, config_dir), config_dir)
    entities = min(tiers["entities"], shape.max_entities)  # registry caps the seat count
    n_cats = tiers["categories"]
    cats = build_categories(tier, entities, config_dir, date)
    lo, hi = tiers["band"]
    log: list[dict] = []
    for attempt in range(dials["max_reseeds"]):
        seed = seed_int(date, tier, config_dir) + attempt
        rng = random.Random(seed)
        sol = sample_solution(cats, entities, rng)
        circular = shape.topology == "circular"
        cand = enumerate_clues(cats, entities, sol, shape.slot_rules, circular)
        clues = select_minimal(cats, entities, cand, dials["weights"], seed, rng, circular)
        hints = hint_trace(cats, entities, clues, sol, seed, circular)
        indirect = sum(1 for c in clues if c[0] in INDIRECT_TYPES)
        d = difficulty(tiers, entities, n_cats, len(clues), indirect, len(hints))
        log.append({"attempt": attempt, "clues": len(clues), "indirect": indirect, "depth": len(hints), "D": d})
        if lo <= d <= hi:
            return to_manifest(date, tier, shape.id, dials["template_rev"], cats, entities, clues, sol, hints), d, log
    raise RuntimeError(f"no in-band puzzle for {date}/{tier} after {dials['max_reseeds']} reseeds (band {lo}-{hi})")


def write_puzzle(date: str, tier: Tier, out_dir: Path = PUZZLES_DIR, config_dir: Path = CONFIG_DIR) -> dict:
    manifest, d, _ = generate(date, tier, config_dir)
    text, sha = canonical_sha(manifest)
    shape = manifest.shapeId
    fname = f"{date}-{tier}.json"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / fname).write_text(text + "\n", encoding="ascii")
    return {"date": date, "tier": tier, "shapeId": shape, "file": fname, "sha": sha, "D": d}


def write_index(date: str, entries: list[dict], out_dir: Path = PUZZLES_DIR) -> Path:
    index = BankIndex(
        schemaVersion=SCHEMA_VERSION, generatedSeed=date, builtAt=f"{date}T00:00:00Z",
        puzzles=[BankEntry(date=e["date"], tier=e["tier"], shapeId=e["shapeId"], file=e["file"], sha=e["sha"]) for e in entries],
    )
    text = json.dumps(index.model_dump(), sort_keys=True, ensure_ascii=True, indent=2) + "\n"
    out = out_dir / "index.json"
    out.write_text(text, encoding="ascii")
    return out


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
    args = ap.parse_args(argv)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    anchor = today if args.date == "today" else args.date
    tiers = [t.strip() for t in args.tiers.split(",") if t.strip()]
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
