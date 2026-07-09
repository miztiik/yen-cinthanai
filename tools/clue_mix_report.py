"""Build-time clue-mix report (read-only instrumentation; gates nothing).

Surfaces the difficulty-vs-clue distribution of the served daily bank so the
tuning of tiers/dials is calibrated against MEASURED data, not vibes. For each
tier it reports, over every shipped `<date>-<tier>.json` under the puzzles dir:

  - avg clue count per puzzle
  - clue-TYPE mix (eq / neq / numDiff / threshold / oneOf / oneEachOf / ifThen)
  - the pairing ("block") each clue targets, and the average share of clues that
    land in the single MOST-targeted pairing (the "clues cluster in one grid" read)
  - the share of clues touching the NUMERIC axis
  - the share of clues touching the ANCHOR (subject) axis

A "pairing" is the set of categories a clue's operands touch - the frontend
`GridBlock` (docs/concepts naming: an ANCHOR pairing includes the subject axis,
a CROSS/LINK pairing is attribute-vs-attribute). Read-only: this tool never
generates, mutates, or validates a puzzle; it only measures what is on disk.

CLI:
    python -m tools.clue_mix_report            # report over the served bank
    python -m tools.clue_mix_report --puzzles-dir <dir>

See docs/concepts/difficulty-and-scoring.md, TODO/20260709-difficulty-clue-tuning-proposal.md.
"""

from __future__ import annotations

import argparse
import collections
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
PUZZLES_DIR = _ROOT / "frontend" / "public" / "puzzles"

# Tier print order (easy -> expert). Kept local so the report has no import-time
# dependency on the generator/solver stack (it only reads shipped JSON).
TIER_ORDER = ("easy", "standard", "sharp", "expert")

# Numeric clue TYPES. A numDiff/threshold clue loads the numeric axis by its very
# kind even though its operands reference entities (e.g. two skaters compared by
# trick count), so "touches the numeric axis" = numeric TYPE or an operand on a
# numeric category - never operand-only, which would miss the numeric clues.
NUMERIC_TYPES = ("numDiff", "threshold")


def clue_pairing(constraint: dict) -> tuple[str, ...]:
    """The sorted, de-duplicated category ids a clue's operands touch = its pairing key.

    A direct eq/neq touches two categories (e.g. skater+deck); a magnitude clue whose
    operands are the same axis touches one (e.g. skater+skater -> ('skater',)); a compound
    clue may touch more. The pairing is the sub-grid(s) the clue constrains.
    """
    return tuple(sorted({op["cat"] for op in constraint.get("operands", [])}))


@dataclass
class PuzzleMix:
    """Per-puzzle clue distribution facts (all derived, nothing mutated)."""

    n_clues: int
    type_counts: dict[str, int]
    pairing_counts: dict[tuple[str, ...], int]
    numeric_clues: int
    anchor_clues: int

    @property
    def top_pairing_share(self) -> float:
        if not self.n_clues:
            return 0.0
        return max(self.pairing_counts.values()) / self.n_clues


def analyze_puzzle(manifest: dict) -> PuzzleMix:
    """Derive the clue-type / pairing / axis distribution for one puzzle manifest dict."""
    cats = manifest["categories"]["list"]
    numeric_ids = {c["id"] for c in cats if c.get("kind") == "numeric"}
    anchor_ids = {c["id"] for c in cats if c.get("anchor")}
    constraints = manifest.get("constraints", [])

    type_counts: dict[str, int] = collections.Counter()
    pairing_counts: dict[tuple[str, ...], int] = collections.Counter()
    numeric_clues = 0
    anchor_clues = 0
    for c in constraints:
        type_counts[c["type"]] += 1
        cats_touched = {op["cat"] for op in c.get("operands", [])}
        pairing_counts[clue_pairing(c)] += 1
        if c["type"] in NUMERIC_TYPES or (cats_touched & numeric_ids):
            numeric_clues += 1
        if cats_touched & anchor_ids:
            anchor_clues += 1
    return PuzzleMix(
        n_clues=len(constraints),
        type_counts=dict(type_counts),
        pairing_counts=dict(pairing_counts),
        numeric_clues=numeric_clues,
        anchor_clues=anchor_clues,
    )


@dataclass
class TierMix:
    """Aggregate clue distribution for one tier across every shipped day."""

    tier: str
    days: int = 0
    total_clues: int = 0
    type_counts: dict[str, int] = field(default_factory=lambda: collections.defaultdict(int))
    top_share_sum: float = 0.0
    numeric_share_sum: float = 0.0
    anchor_share_sum: float = 0.0

    def add(self, pm: PuzzleMix) -> None:
        self.days += 1
        self.total_clues += pm.n_clues
        for t, n in pm.type_counts.items():
            self.type_counts[t] += n
        if pm.n_clues:
            self.top_share_sum += pm.top_pairing_share
            self.numeric_share_sum += pm.numeric_clues / pm.n_clues
            self.anchor_share_sum += pm.anchor_clues / pm.n_clues

    @property
    def avg_clues(self) -> float:
        return self.total_clues / self.days if self.days else 0.0

    @property
    def avg_top_pairing_share(self) -> float:
        return self.top_share_sum / self.days if self.days else 0.0

    @property
    def avg_numeric_share(self) -> float:
        return self.numeric_share_sum / self.days if self.days else 0.0

    @property
    def avg_anchor_share(self) -> float:
        return self.anchor_share_sum / self.days if self.days else 0.0

    def type_shares(self) -> list[tuple[str, float]]:
        if not self.total_clues:
            return []
        return sorted(
            ((t, n / self.total_clues) for t, n in self.type_counts.items()),
            key=lambda kv: (-kv[1], kv[0]),
        )


def analyze_bank(puzzles_dir: Path) -> dict[str, TierMix]:
    """Read every `<date>-<tier>.json` under puzzles_dir into per-tier aggregates."""
    tiers: dict[str, TierMix] = {t: TierMix(tier=t) for t in TIER_ORDER}
    for path in sorted(puzzles_dir.glob("*.json")):
        if path.name == "index.json":
            continue
        manifest = json.loads(path.read_text(encoding="utf-8"))
        tier = manifest.get("tier")
        if tier not in tiers:
            continue
        tiers[tier].add(analyze_puzzle(manifest))
    return tiers


def format_report(tiers: dict[str, TierMix]) -> str:
    """Render the human-readable per-tier report."""
    lines: list[str] = []
    for tier in TIER_ORDER:
        tm = tiers.get(tier)
        if not tm or tm.days == 0:
            continue
        lines.append(f"=== {tier.upper()}  ({tm.days} days) ===")
        lines.append(f"  avg clues/puzzle : {tm.avg_clues:.1f}")
        shares = ", ".join(f"{t}={s:.0%}" for t, s in tm.type_shares())
        lines.append(f"  clue-type share  : {shares}")
        lines.append(f"  avg share in the single MOST-targeted pairing : {tm.avg_top_pairing_share:.0%}")
        lines.append(f"  avg share touching the NUMERIC axis           : {tm.avg_numeric_share:.0%}")
        lines.append(f"  avg share touching the ANCHOR (subject) axis  : {tm.avg_anchor_share:.0%}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Read-only clue-mix report over the served daily bank.")
    parser.add_argument("--puzzles-dir", type=Path, default=PUZZLES_DIR, help="dir of <date>-<tier>.json (default: served bank)")
    args = parser.parse_args(argv)
    tiers = analyze_bank(args.puzzles_dir)
    sys.stdout.write(format_report(tiers))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
