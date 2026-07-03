"""Mechanism tests for the incremental scenario verifier (tools/verify_scenarios.py).

Real tmp catalogs, real generator, real config - no mocks (CLAUDE.md Holy Law #7). Each test builds
an isolated scenario catalog under tmp_path (a copy of a real, valid scenario template + a manifest
listing it), so the real datasets/templates/manifest.json is never touched and the tests do not depend
on whether the shipped catalog is currently stamped.

The four mechanism guarantees:
  (a) a stamped-current scenario is SKIPPED by check (the incremental win);
  (b) mutating the template's meaning makes check RE-VERIFY it (dirty-tracking works);
  (c) stamp is idempotent - a second stamp with nothing changed is byte-identical;
  (d) a broken scenario makes check report a failure (ok is False -> the CLI exits nonzero).
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import corpus
import verify_scenarios as vs

ROOT = Path(__file__).resolve().parent.parent
REAL_TEMPLATES = ROOT / "datasets" / "templates"
CONFIG_DIR = ROOT / "config"
REF_SCENARIO = "weekend-market"  # a real, valid, always-in-band scenario used as the fixture source


def _make_catalog(tmp_path: Path, scenario_id: str = REF_SCENARIO) -> Path:
    """Build a real tmp scenario catalog: copy a real template + write a manifest that lists it.
    Returns the tmp templates dir (loadable by corpus.load_scenario_manifest, verifiable by vs)."""
    tdir = tmp_path / "templates"
    tdir.mkdir()
    shutil.copyfile(REAL_TEMPLATES / f"{scenario_id}.json", tdir / f"{scenario_id}.json")
    manifest = {
        "schemaVersion": 1,
        "scenarios": [
            {
                "id": scenario_id,
                "file": f"{scenario_id}.json",
                "title": "Fixture",
                "tone": "cozy",
                "kind": "test",
                "status": "live",
            }
        ],
    }
    (tdir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="ascii")
    return tdir


def _rewrite_template(tdir: Path, scenario_id: str, mutate) -> None:
    """Load, mutate (in place), and rewrite the tmp template as canonical-indent ASCII JSON."""
    tpath = tdir / f"{scenario_id}.json"
    tmpl = json.loads(tpath.read_text(encoding="ascii"))
    mutate(tmpl)
    tpath.write_text(json.dumps(tmpl, ensure_ascii=True, indent=2) + "\n", encoding="ascii")


def test_a_stamped_scenario_is_skipped_by_check(tmp_path: Path) -> None:
    # After a stamp, an unchanged scenario is SKIPPED (not re-verified) - the incremental win.
    tdir = _make_catalog(tmp_path)
    stamped = vs.stamp(tdir, CONFIG_DIR)
    assert stamped.verified == [REF_SCENARIO] and stamped.ok

    result = vs.check(tdir, CONFIG_DIR)
    assert result.skipped == [REF_SCENARIO]
    assert result.verified == [] and result.failed == []


def test_b_mutating_template_reverifies(tmp_path: Path) -> None:
    # Changing the template's MEANING moves its fingerprint, so a stamped scenario goes stale and is
    # re-verified. `title` is inert metadata (does not affect generation), so it still passes.
    tdir = _make_catalog(tmp_path)
    vs.stamp(tdir, CONFIG_DIR)
    assert vs.check(tdir, CONFIG_DIR).skipped == [REF_SCENARIO]  # baseline: stamp is current

    _rewrite_template(tdir, REF_SCENARIO, lambda t: t.__setitem__("title", t["title"] + " (revised)"))

    result = vs.check(tdir, CONFIG_DIR)
    assert result.verified == [REF_SCENARIO]  # stale -> re-verified
    assert result.skipped == [] and result.ok


def test_c_stamp_is_idempotent(tmp_path: Path) -> None:
    # A second stamp with nothing changed writes byte-identical manifest bytes and verifies nothing.
    tdir = _make_catalog(tmp_path)
    mpath = tdir / corpus.MANIFEST_FILENAME

    vs.stamp(tdir, CONFIG_DIR)
    first = mpath.read_bytes()
    second = vs.stamp(tdir, CONFIG_DIR)
    assert mpath.read_bytes() == first  # idempotent: byte-identical re-stamp
    assert second.verified == [] and second.skipped == [REF_SCENARIO]

    # The stamp actually recorded the current fingerprint into the entry.
    entry = corpus.load_scenario_manifest(tdir).scenarios[0]
    assert entry.verifiedSha == vs.scenario_fingerprint(REF_SCENARIO, tdir)


def test_d_broken_scenario_fails_check(tmp_path: Path) -> None:
    # A scenario whose generated manifest violates an invariant is reported as FAILED (never skipped
    # or silently passed), so check().ok is False and the CLI exits nonzero. Here the template's
    # internal id no longer matches its catalogued id, tripping verify_one's scenarioId assertion.
    tdir = _make_catalog(tmp_path)
    _rewrite_template(tdir, REF_SCENARIO, lambda t: t.__setitem__("id", "mismatched-id"))

    result = vs.check(tdir, CONFIG_DIR)
    assert not result.ok
    assert [sid for sid, _ in result.failed] == [REF_SCENARIO]
    assert result.verified == [] and result.skipped == []


def test_d2_broken_scenario_blocks_stamp(tmp_path: Path) -> None:
    # A stamp must never certify a broken scenario: stamp verifies BEFORE writing, so a failing
    # scenario raises and the manifest is left unstamped (atomic - no verifiedSha written).
    tdir = _make_catalog(tmp_path)
    _rewrite_template(tdir, REF_SCENARIO, lambda t: t.__setitem__("id", "mismatched-id"))

    try:
        vs.stamp(tdir, CONFIG_DIR)
    except AssertionError:
        pass
    else:
        raise AssertionError("stamp certified a broken scenario")

    assert corpus.load_scenario_manifest(tdir).scenarios[0].verifiedSha is None
