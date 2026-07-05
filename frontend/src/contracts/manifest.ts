// PuzzleManifest v2 - bundle-shipped (rewrite-in-place, no migration). Matrix-only (grid) +
// story-first: the seating/round-table engine is retired (Row 9d). See
// docs/architecture/contracts/schemas.md. Types only; no logic here. BankIndex -> bank.ts, ShareCard -> share.ts.

import type { Tier, ShapeId } from "./save";

export type Cardinality = "bijective" | "shared";

export interface AttributeValue {
  id: string;
  glyph: string;
  label: string;
  // Optional numeric/story metadata (present only where meaningful; absent when unset):
  magnitude?: number;
  phrase?: string;
  refPhrase?: string;
}

export interface AttributeCategory {
  id: string;
  label: string;
  // Required at v2: `kind` replaces the retired boolean `ordinal` flag; exactly one
  // category is the `anchor` (the identity axis).
  kind: "nominal" | "ordinal" | "numeric";
  anchor: boolean;
  cardinality: Cardinality;
  values: AttributeValue[];
  // Optional metadata:
  unit?: string;
  glyphPack?: string;
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
  schemaVersion: 2;
  puzzleId: string;
  tier: Tier;
  shapeId: ShapeId;
  templateRev: number;
  entities: string[];
  categories: { n: number; list: AttributeCategory[] };
  constraints: Constraint[];
  solution: Record<string, Record<string, string>>;
  hintTrace: HintStep[];
  // Story-first is REQUIRED at v2 (matrix-only, narrated grid):
  scenarioId: string;
  story: string;
  subjectNoun: string;
  variant: number;
}
