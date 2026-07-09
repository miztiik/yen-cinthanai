"""Content-addressed INCREMENTAL scenario verification (the build cache that lets the catalog scale).

Fully verifying every catalogued scenario at every tier is O(catalog size) - it does not scale as the
catalog grows toward ~100 scenarios. This module makes verification INCREMENTAL: each scenario carries
a `verifiedSha` stamp (in datasets/templates/manifest.json) recording the content-address at which it
last passed. A scenario is re-verified only when that address changes, so CI verifies only the CHANGED
scenarios - bounded regardless of catalog size.

The content-address of a scenario's verification is its `scenario_fingerprint`:

    scenario_fingerprint(id) = sha256( canonical-JSON(template) + generator_fingerprint() )
    generator_fingerprint()  = sha256( GENERATOR_VERSION + canonical-JSON(config/{tiers,dials}.json) )

so the stamp invalidates when either the scenario TEMPLATE changes (its meaning, not its whitespace -
the template is canonicalized first), a config VALUE changes (a band, a weight - config is content-
hashed), or an output-affecting generator-source change bumps GENERATOR_VERSION. A comment or a
behaviour-preserving refactor of the .py sources does NOT re-stamp the catalog (the old raw-byte hash
did). It is stable across the author's machine and CI because config is content-addressed, not byte-hashed.

`verify_one(id)` is the shared verification primitive - it generates the scenario at EVERY tier and
asserts the story-first invariants (P1 zero-guess, difficulty in band, schemaVersion 2, eq toehold, a
numeric clue when the tier gates one in, byte-identical deterministic rebuild, per-tier narrative
coherence). It is reused by both this module's check()/stamp() and the incremental gate in
tools/test_quality.py. Real solver + real corpus, deterministic, no mocks (CLAUDE.md #7, #13).

CLI:
    python -m tools.verify_scenarios --check   # verify only changed/unstamped live scenarios; nonzero on failure
    python -m tools.verify_scenarios --stamp   # verify stale live scenarios, then write their verifiedSha

See docs/architecture/generator/pipeline.md (the verifiedSha dirty-tracking contract).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # flat sibling imports (like generate.py)

import corpus  # noqa: E402
import generate as g  # noqa: E402
from models import PUZZLE_SCHEMA_VERSION  # noqa: E402

_ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = _ROOT / "config"
TEMPLATES_DIR = _ROOT / "datasets" / "templates"

# Verification is CONTENT-addressed, not date-addressed: a fixed reference date + variant so the only
# things that move a scenario's fingerprint are its template and the generator sources, never "today".
VERIFY_DATE = "2026-07-01"
VERIFY_VARIANT = 1

# GENERATOR_VERSION is the explicit behaviour version of the generator SOURCES
# (tools/{generate,corpus,translator,models}.py). BUMP IT when a source change alters what a scenario
# GENERATES - a new/removed clue type, a changed acceptance rule, a different render. A comment, a
# rename, or a behaviour-preserving refactor does NOT bump it, so it does not re-stamp the ~100-
# scenario catalog. A missed bump is still caught: tools/test_generate.py generates + invariant-checks
# the fixture date at every tier on EVERY run, so the stamp is a catalog-sweep cache, not the only
# gate. (Explicit-version over raw-byte hashing: an AI-agent-authored casual game does not need the
# byte-hash's coarse "re-stamp on any edit" tax.)
GENERATOR_VERSION = 2  # 2: identity/anchor axis auto-decorated with distinct people avatars (Option B)

# Config inputs that feed generation, content-hashed (canonicalized JSON) so a reformat is free but a
# value change - a tier band, a clue weight, an ENV weight - moves the fingerprint.
_FINGERPRINT_CONFIG = ("config/tiers.json", "config/dials.json")


# --- content-address (fingerprint) ----------------------------------------------


def generator_fingerprint(root: Path = _ROOT) -> str:
    """sha256 over GENERATOR_VERSION + the canonical JSON of the config inputs. Replaces the old raw-
    byte hash of the .py sources (which re-stamped the whole catalog on any edit, even a comment).
    Config is content-addressed (canonicalized), so file formatting is irrelevant and only VALUES move
    the fingerprint; bump GENERATOR_VERSION for an output-affecting generator-source change."""
    h = hashlib.sha256()
    h.update(f"v{GENERATOR_VERSION}".encode("ascii"))
    for rel in _FINGERPRINT_CONFIG:
        obj = json.loads((root / rel).read_text(encoding="ascii"))
        h.update(json.dumps(obj, sort_keys=True, ensure_ascii=True, separators=(",", ":")).encode("ascii"))
    return h.hexdigest()


def scenario_fingerprint(
    scenario_id: str, templates_dir: Path = TEMPLATES_DIR, root: Path = _ROOT
) -> str:
    """The content-address of a scenario's verification: sha256 of the scenario TEMPLATE, canonicalized
    (sort_keys + compact ASCII, so re-indenting the file does not invalidate the stamp) concatenated
    with the generator fingerprint. Changes exactly when the template's MEANING or the generator does."""
    path = corpus.scenario_path_by_id(scenario_id, templates_dir)
    template = json.loads(path.read_text(encoding="ascii"))
    canon = json.dumps(template, sort_keys=True, ensure_ascii=True, separators=(",", ":"))
    return hashlib.sha256((canon + generator_fingerprint(root)).encode("ascii")).hexdigest()


# --- invariants (shared with tools/test_quality.py) -----------------------------


def anchor_id(m) -> str:
    """The subject/anchor category id (the identity axis) of a story-first manifest."""
    return next(c.id for c in m.categories.items if c.anchor)


def full_depth(m) -> int:
    """Zero-guess target: one forced deduction per non-anchor bijective cell
    (non-anchor bijective categories * entities)."""
    a = anchor_id(m)
    non_anchor_bij = [c for c in m.categories.items if c.id != a and c.cardinality == "bijective"]
    return len(non_anchor_bij) * len(m.entities)


def _assert_narrative_coherence(scenario, manifests: dict[str, object]) -> None:
    """The narrative never names a dimension a tier sliced out, and names every dimension it keeps.
    Easy (fewest cats) must OMIT every sliced-out non-anchor label; expert (all cats) must NAME every
    non-anchor label in its generated match-line. Tier extremes come from the canonical Tier order,
    never a hardcoded name."""
    easy = manifests[g.TIER_ORDER[0]]
    expert = manifests[g.TIER_ORDER[-1]]
    present_easy = {c.id for c in easy.categories.items}
    sliced = [
        c for c in scenario.categories
        if c.id != scenario.subjectCategory and c.id not in present_easy
    ]
    assert sliced, (scenario.id, "expected easy to slice out at least one category")
    easy_low = easy.story.lower()
    for c in sliced:
        assert c.label.lower() not in easy_low, (scenario.id, "easy narrative leaked sliced label", c.label)
    expert_low = expert.story.lower()
    for c in scenario.categories:
        if c.id != scenario.subjectCategory:
            assert c.label.lower() in expert_low, (scenario.id, "expert narrative omits present label", c.label)


def verify_one(
    scenario_id: str, templates_dir: Path = TEMPLATES_DIR, config_dir: Path = CONFIG_DIR
) -> None:
    """Fully verify ONE scenario: generate it at EVERY tier and assert the story-first invariants,
    plus a byte-identical deterministic rebuild and per-tier narrative coherence. Returns None on
    success; raises AssertionError (invariant violation) or the generator's RuntimeError (no
    acceptable puzzle) on the first failure. The shared verification primitive - check()/stamp() and
    tools/test_quality.py's incremental gate both call this. Real solver, deterministic, no mocks."""
    scenario_path = corpus.scenario_path_by_id(scenario_id, templates_dir)
    scenario = corpus.load_scenario_template(scenario_path)
    manifests: dict[str, object] = {}
    for tier in g.TIER_ORDER:
        b = g.build_story(VERIFY_DATE, tier, VERIFY_VARIANT, config_dir, scenario_path=scenario_path)
        m = b.manifest
        where = (scenario_id, tier)
        # story-first shape (the v2 contract: grid + narrative + scenario id)
        assert m.schemaVersion == PUZZLE_SCHEMA_VERSION, (where, "schemaVersion", m.schemaVersion)
        assert m.shapeId == "grid", (where, "shapeId", m.shapeId)
        assert m.story, (where, "empty story")
        assert m.scenarioId == scenario_id, (where, "scenarioId mismatch", m.scenarioId)
        # P1 zero-guess: the forced trace visits every non-anchor bijective cell exactly once
        assert len(m.hintTrace) == full_depth(m), (where, "hintTrace depth", len(m.hintTrace), full_depth(m))
        # difficulty inside the tier band
        lo, hi = g.load_config("tiers", config_dir)[tier]["band"]
        assert lo <= b.d <= hi, (where, "difficulty out of band", b.d, (lo, hi))
        # an eq toehold is always present (the P2/P5 variety floor)
        types = [c.type for c in m.constraints]
        assert "eq" in types, (where, "no eq clue", types)
        # a tier that gates a numeric clue in must carry at least one
        numeric_types = g._numeric_types_for_tier(scenario, tier)
        if numeric_types:
            assert any(t in numeric_types for t in types), (where, "numeric gated in but absent", types)
        # byte-identical deterministic rebuild
        rebuilt = g.generate_story(VERIFY_DATE, tier, VERIFY_VARIANT, config_dir, scenario_path=scenario_path)[0]
        assert rebuilt.model_dump(by_alias=True) == m.model_dump(by_alias=True), (where, "non-deterministic rebuild")
        manifests[tier] = m
    _assert_narrative_coherence(scenario, manifests)


# --- incremental check + stamp --------------------------------------------------


@dataclass
class CheckResult:
    """The outcome of an incremental pass: the live scenarios SKIPPED (stamp current), VERIFIED
    (stale + passed), and FAILED (stale + raised, id -> message). `ok` is True iff nothing failed."""

    skipped: list[str] = field(default_factory=list)
    verified: list[str] = field(default_factory=list)
    failed: list[tuple[str, str]] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.failed


def live_entries(templates_dir: Path = TEMPLATES_DIR) -> list:
    """The live catalog entries (status == 'live'), in manifest order - the set the daily bank
    rotates over and therefore the set worth keeping verified."""
    return [e for e in corpus.load_scenario_manifest(templates_dir).scenarios if e.status == "live"]


def stamped_current(entry, templates_dir: Path = TEMPLATES_DIR, root: Path = _ROOT) -> bool:
    """True when the entry's stored verifiedSha equals its current scenario_fingerprint - i.e. the
    scenario is unchanged since it was last verified, so the incremental pass can SKIP it."""
    return bool(entry.verifiedSha) and entry.verifiedSha == scenario_fingerprint(entry.id, templates_dir, root)


def check(
    templates_dir: Path = TEMPLATES_DIR, config_dir: Path = CONFIG_DIR, root: Path = _ROOT
) -> CheckResult:
    """Incrementally verify the LIVE catalog: SKIP a scenario whose verifiedSha matches its current
    fingerprint (unchanged since last stamped), fully verify_one the rest (new / changed / never
    stamped). Bounded by the number of CHANGED scenarios, not the catalog size. Never raises for a
    scenario failure - it records every failure so a caller can report them all and exit once (the
    run-all-then-report contract of a verification harness)."""
    result = CheckResult()
    for entry in live_entries(templates_dir):
        if stamped_current(entry, templates_dir, root):
            result.skipped.append(entry.id)
            continue
        try:
            verify_one(entry.id, templates_dir, config_dir)
        except Exception as exc:  # a scenario that raises for ANY reason is a FAILED scenario
            result.failed.append((entry.id, f"{type(exc).__name__}: {exc}"))
        else:
            result.verified.append(entry.id)
    return result


def stamp(
    templates_dir: Path = TEMPLATES_DIR, config_dir: Path = CONFIG_DIR, root: Path = _ROOT
) -> CheckResult:
    """Verify every STALE live scenario, then write its current fingerprint into that entry's
    verifiedSha and rewrite datasets/templates/manifest.json. Atomic + idempotent: verification runs
    BEFORE the file is written (a scenario that fails verification raises and no stamp is certified),
    and a second stamp with nothing changed reproduces byte-identical bytes (already-current entries
    are skipped and the writer preserves the authored key order + 2-space indent). manifest.json is
    NOT a fingerprint source, so writing verifiedSha never perturbs any scenario's fingerprint."""
    manifest_path = templates_dir / corpus.MANIFEST_FILENAME
    raw = json.loads(manifest_path.read_text(encoding="ascii"))
    by_id = {e["id"]: e for e in raw["scenarios"]}
    result = CheckResult()
    for entry in live_entries(templates_dir):
        if stamped_current(entry, templates_dir, root):
            result.skipped.append(entry.id)
            continue
        verify_one(entry.id, templates_dir, config_dir)  # raises on failure -> nothing written (atomic)
        by_id[entry.id]["verifiedSha"] = scenario_fingerprint(entry.id, templates_dir, root)
        result.verified.append(entry.id)
    _write_manifest(manifest_path, raw)
    return result


def _write_manifest(path: Path, raw: dict) -> None:
    """Rewrite the manifest preserving the AUTHORED key order (minimal diff - stamping only ADDS
    verifiedSha lines), 2-space indent, ASCII, LF line endings + trailing newline: the exact format
    the file already uses. `newline=""` prevents the platform newline translation that would emit
    CRLF on Windows, so a stamp made on any OS reproduces byte-identical LF (POSIX convention)."""
    text = json.dumps(raw, ensure_ascii=True, indent=2) + "\n"
    path.write_text(text, encoding="ascii", newline="")


# --- CLI ------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Content-addressed incremental scenario verification.")
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--check", action="store_true",
        help="verify only changed/unstamped live scenarios (skip stamp-current); exit nonzero on any failure",
    )
    mode.add_argument(
        "--stamp", action="store_true",
        help="verify stale live scenarios, then write their verifiedSha into datasets/templates/manifest.json",
    )
    args = ap.parse_args(argv)

    if args.stamp:
        result = stamp()
        for sid in result.verified:
            print(f"stamped   {sid}")
        for sid in result.skipped:
            print(f"current   {sid}")
        print(f"-- stamped {len(result.verified)}, already-current {len(result.skipped)}")
        return 0

    result = check()
    for sid in result.skipped:
        print(f"skip      {sid}")
    for sid in result.verified:
        print(f"verified  {sid}")
    for sid, err in result.failed:
        print(f"FAIL      {sid}: {err}")
    print(f"-- verified {len(result.verified)}, skipped {len(result.skipped)}, failed {len(result.failed)}")
    return 1 if result.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
