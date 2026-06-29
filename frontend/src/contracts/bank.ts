// BankIndex v1 - bundle-shipped index at public/puzzles/index.json (rewrite-in-place,
// no migration). sha = canonical-JSON sha256; a rebuild must match (determinism gate).
// See docs/architecture/contracts/schemas.md. Types only; no logic here.

import type { Tier, ShapeId } from "./save";

export interface BankEntry {
  date: string;
  tier: Tier;
  shapeId: ShapeId;
  file: string;
  sha: string;
}

export interface BankIndex {
  schemaVersion: 1;
  generatedSeed: string;
  builtAt: string;
  puzzles: BankEntry[];
}
