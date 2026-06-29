# Generator Pipeline

**Last Updated**: 2026-06-29

Build-time only (tools/, Python, CI). Pipes and filters, one Pydantic model per arrow, JSONL log to `.logs/build-<date>.jsonl`. No runtime backend; no in-browser solver in v1 (WASM allowed later if it enriches play).

## Stages

```
config/tiers.toml + date
  -> seed (PRNG + CP-SAT seed) -> sample full bijective solution
  -> enumerate clues true under solution -> select weighted subset
  -> verify uniqueness -> prune to minimal -> template clueText
  -> emit PuzzleManifest + sha256 -> append BankIndex
```

## CP-SAT model (4x3 bijective grid)

Vars `x[c][k]` = position of value k in category c, domain 0..3; `AddAllDifferent` per category; position is identity. Clauses: eq `==`, neq `!=`, ends `in {0,N-1}`, adjacent `|d|=1`, distance:k `|d|=k`, before `<`. Determinism: `num_search_workers=1`, fixed `random_seed`.

## Uniqueness + prune

solve -> sol1; forbid that exact assignment via reified bools, Not(And); re-solve must be INFEASIBLE (2-solve cap). seed = sha256(date+":"+tier)[:8]. Prune: shuffle, drop each clue if remainder stays unique, to fixpoint = minimal. Canonical JSON (sort_keys, ASCII) -> sha; CI rebuild must match.

## Pins (tools/requirements.txt)

python 3.12 | ortools 9.15.6755 | pydantic 2.11 | pytest 8.3. Config baked to public/config/*.json by tools/bake_config.py (one build language).

## CI (.github/workflows/daily.yml)

cron 0 0 * * * + dispatch -> setup-python -> generate today's easy/standard/sharp/expert -> ruff/mypy/pytest + determinism + share-no-leak -> vite build base /yen-cinthanai/ -> Pages. Past days commit back; bank accretes.

## See also
- [../contracts/schemas.md](../contracts/schemas.md) - manifest/bank output.
- [../../concepts/difficulty-and-scoring.md](../../concepts/difficulty-and-scoring.md) - reject-if-out-of-band.
- [../../how-to/ship-to-github-pages.md](../../how-to/ship-to-github-pages.md) - deploy.
