// PuzzleManifest v1 - bundle-shipped (rewrite-in-place, no migration). See
// docs/architecture/contracts/schemas.md and TODO/2026-06-29-system-design.md sec 5.
// Types only; no logic here. BankIndex -> bank.ts, ShareCard -> share.ts.

import type { Tier, ShapeId } from "./save";

export type Cardinality = "bijective" | "shared";

export interface AttributeValue {
  id: string;
  glyph: string;
  label: string;
}

export interface AttributeCategory {
  id: string;
  label: string;
  ordinal: boolean;
  cardinality: Cardinality;
  values: AttributeValue[];
}

export interface Operand {
  cat: string;
  value: string;
}

export interface Constraint {
  id: string;
  type: string;
  operands: Operand[];
  params: Record<string, number | string>;
  clueText: string;
  renderHint: string;
}

export interface HintStep {
  fromClues: string[];
  forces: { entity: string; cat: string; value: string };
}

export interface PuzzleManifest {
  schemaVersion: 1;
  puzzleId: string;
  tier: Tier;
  shapeId: ShapeId;
  templateRev: number;
  entities: string[];
  categories: { n: number; list: AttributeCategory[] };
  constraints: Constraint[];
  solution: Record<string, Record<string, string>>;
  hintTrace: HintStep[];
}
