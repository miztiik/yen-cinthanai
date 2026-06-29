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
from datetime import datetime, timezone
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
INDIRECT_TYPES = ("neq", "adjacent", "distance", "before")
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
    """A resolved category: glyph-backed values in solution order, ordinal or not."""

    id: str
    label: str
    ordinal: bool
    value_ids: list[str]
    glyphs: list[str]
    labels: list[str]


def build_categories(tier: Tier, entities: int, config_dir: Path) -> list[Cat]:
    """Resolve tier categories from dials + glyph packs (bijective; first N values)."""
    dials = load_toml("dials", config_dir)
    packs = json.loads(GLYPHS_INDEX.read_text(encoding="ascii"))["packs"]
    glyph_labels = load_toml("glyphpacks", config_dir)
    cats: list[Cat] = []
    for cid in dials["tier"][tier]["categories"]:
        spec = dials["category"][cid]
        pack = spec["pack"]
        ids = list(packs[pack].keys())[:entities]
        if spec["ordinal"]:
            labels = [str(i + 1) for i in range(entities)]
        else:
            labels = [glyph_labels[pack][vid]["label"] for vid in ids]
        cats.append(
            Cat(
                id=cid,
                label=spec["label"],
                ordinal=spec["ordinal"],
                value_ids=ids,
                glyphs=[f"{pack}.{vid}" for vid in ids],
                labels=labels,
            )
        )
    return cats


# --- seed -----------------------------------------------------------------------


def seed_int(date: str, tier: Tier, config_dir: Path) -> int:
    salt = load_toml("dials", config_dir)["seed_salt"]
    digest = hashlib.sha256(f"{salt}:{date}:{tier}".encode("ascii")).hexdigest()
    return int(digest[:8], 16)


# --- CP-SAT model ---------------------------------------------------------------

# A clue = (type, [(cat_id, value_id), ...], params). cat/value, never an entity.
Clue = tuple[str, tuple[tuple[str, str], ...], tuple[tuple[str, int], ...]]


def _add_clue(m: cp_model.CpModel, x: dict, n: int, clue: Clue) -> None:
    typ, ops, params = clue
    p = dict(params)
    a = x[ops[0][0]][ops[0][1]]
    if typ == "ends":
        m.Add(a == p["pos"])
        return
    b = x[ops[1][0]][ops[1][1]]
    if typ == "eq":
        m.Add(a == b)
    elif typ == "neq":
        m.Add(a != b)
    elif typ == "before":
        m.Add(a < b)
    else:  # adjacent (|d|=1) or distance:k
        d = m.NewIntVar(-(n - 1), n - 1, "")
        t = m.NewIntVar(0, n - 1, "")
        m.Add(d == a - b)
        m.AddAbsEquality(t, d)
        m.Add(t == (1 if typ == "adjacent" else p["k"]))


def identity_cat(cats: list[Cat]) -> Cat:
    """The anchor: value i occupies slot i. Ordinal axis if present, else the first."""
    return next((c for c in cats if c.ordinal), cats[0])


def build_model(cats: list[Cat], n: int, clues: list[Clue]) -> tuple:
    m = cp_model.CpModel()
    anchor = identity_cat(cats)
    x: dict[str, dict[str, cp_model.IntVar]] = {}
    for c in cats:
        x[c.id] = {v: m.NewIntVar(0, n - 1, "") for v in c.value_ids}
        m.AddAllDifferent(list(x[c.id].values()))
        if c is anchor:  # identity: value at index i sits at slot i (no floating)
            for i, v in enumerate(c.value_ids):
                m.Add(x[c.id][v] == i)
    for clue in clues:
        _add_clue(m, x, n, clue)
    return m, x


def _solver(seed: int) -> cp_model.CpSolver:
    s = cp_model.CpSolver()
    s.parameters.num_search_workers = 1
    s.parameters.random_seed = seed & 0x7FFFFFFF
    s.parameters.max_time_in_seconds = SOLVE_LIMIT_S
    return s


def is_unique(cats: list[Cat], n: int, clues: list[Clue], seed: int) -> bool:
    """Solve; forbid that exact assignment via reified bools; re-solve INFEASIBLE."""
    m, x = build_model(cats, n, clues)
    s = _solver(seed)
    if s.Solve(m) not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return False
    diff = []
    for c in cats:
        for v, var in x[c.id].items():
            b = m.NewBoolVar("")
            m.Add(var != s.Value(var)).OnlyEnforceIf(b)
            m.Add(var == s.Value(var)).OnlyEnforceIf(b.Not())
            diff.append(b)
    m.AddBoolOr(diff)
    return _solver(seed).Solve(m) == cp_model.INFEASIBLE


# --- enumerate clues true under the sampled solution ----------------------------


def sample_solution(cats: list[Cat], n: int, rng: random.Random) -> dict[str, list[str]]:
    """value_id -> slot per category. Position identity; others random permutation."""
    sol: dict[str, list[str]] = {}
    anchor = identity_cat(cats)
    for c in cats:
        ids = list(c.value_ids)
        if c is not anchor:
            rng.shuffle(ids)
        sol[c.id] = ids  # ids[slot] = value at that slot
    return sol


def _pos(sol: dict[str, list[str]], cat: str, val: str) -> int:
    return sol[cat].index(val)


def enumerate_clues(
    cats: list[Cat], n: int, sol: dict[str, list[str]], allowed: tuple[str, ...] | None = None
) -> list[Clue]:
    """Every clue true under sol, drawn from the v1 catalog, kept only if the shape's
    slot_rules allow the type (registry-gated, no per-shape code). cat/value operands."""
    out: list[Clue] = []
    ordinal = [c for c in cats if c.ordinal]
    for ci, a in enumerate(cats):  # eq/neq across every category pair (incl anchor)
        for b in cats[ci + 1 :]:
            for av in a.value_ids:
                for bv in b.value_ids:
                    typ = "eq" if _pos(sol, a.id, av) == _pos(sol, b.id, bv) else "neq"
                    out.append((typ, ((a.id, av), (b.id, bv)), ()))
    for oc in ordinal:
        for v in oc.value_ids:
            p = _pos(sol, oc.id, v)
            if p in (0, n - 1):
                out.append(("ends", ((oc.id, v),), (("pos", p),)))
        vs = oc.value_ids
        for i, av in enumerate(vs):
            for bv in vs[i + 1 :]:
                pa, pb = _pos(sol, oc.id, av), _pos(sol, oc.id, bv)
                d = abs(pa - pb)
                if d == 1:
                    out.append(("adjacent", ((oc.id, av), (oc.id, bv)), ()))
                else:
                    out.append(("distance", ((oc.id, av), (oc.id, bv)), (("k", d),)))
                lo, hi = (av, bv) if pa < pb else (bv, av)
                out.append(("before", ((oc.id, lo), (oc.id, hi)), ()))
    return out if allowed is None else [c for c in out if c[0] in allowed]


# --- select + prune -------------------------------------------------------------


def select_minimal(
    cats: list[Cat], n: int, candidates: list[Clue], weights: dict, seed: int, rng: random.Random
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
    """Attribute cells forced in order: a cell is forced when no other value is feasible."""
    anchor = identity_cat(cats)
    attr = [c for c in cats if c is not anchor]
    known: list[tuple[str, str, int]] = []
    steps: list[HintStep] = []
    targets = [(c.id, v) for c in attr for v in c.value_ids]
    while len(steps) < len(targets):
        progressed = False
        for cat, val in targets:
            if any(k[0] == cat and k[1] == val for k in known):
                continue
            slot = _pos(sol, cat, val)
            m, x = build_model(cats, n, clues)
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
    return _TEMPLATES[typ].format(a=a, b=b, k=p.get("k", ""))


def to_manifest(date, tier, shape, rev, cats, n, clues, sol, hints) -> PuzzleManifest:
    cat_models = [
        AttributeCategory(
            id=c.id, label=c.label, ordinal=c.ordinal, cardinality="bijective",
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
    cats = build_categories(tier, entities, config_dir)
    lo, hi = tiers["band"]
    log: list[dict] = []
    for attempt in range(dials["max_reseeds"]):
        seed = seed_int(date, tier, config_dir) + attempt
        rng = random.Random(seed)
        sol = sample_solution(cats, entities, rng)
        cand = enumerate_clues(cats, entities, sol, shape.slot_rules)
        clues = select_minimal(cats, entities, cand, dials["weights"], seed, rng)
        hints = hint_trace(cats, entities, clues, sol, seed)
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


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Build the daily puzzle bank.")
    ap.add_argument("--date", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    ap.add_argument("--tiers", default="easy,standard,sharp,expert")
    args = ap.parse_args(argv)
    tiers = [t.strip() for t in args.tiers.split(",") if t.strip()]
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    entries, lines = [], []
    for tier in tiers:
        e = write_puzzle(args.date, tier)
        entries.append(e)
        lines.append(json.dumps({"date": args.date, **e}, sort_keys=True))
        print(f"{e['file']} sha={e['sha'][:12]} D={e['D']}")
    write_index(args.date, entries)
    (LOGS_DIR / f"build-{args.date}.jsonl").write_text("\n".join(lines) + "\n", encoding="ascii")
    print(f"index.json ({len(entries)} puzzles)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
