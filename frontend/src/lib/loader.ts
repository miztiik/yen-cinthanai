// Puzzle loader: fetch the bank index then today's manifest, base-aware. No game
// logic - just IO + a structural sanity pass against the contracts. Runtime caching
// is the PWA's job (NetworkFirst /puzzles/*.json, stack-and-bundle.md); here we just
// resolve URLs under import.meta.env.BASE_URL ('/' dev, '/yen-cinthanai/' Pages).
// See docs/architecture/contracts/schemas.md (BankIndex, PuzzleManifest).

import type { BankIndex, BankEntry } from "../contracts/bank";
import type { PuzzleManifest } from "../contracts/manifest";
import type { Tier } from "../contracts/save";

const BASE = import.meta.env.BASE_URL;
const PUZZLES = "puzzles/";

/** Base-aware URL for an in-bundle puzzles asset (POSIX, never absolute on disk). */
export function puzzleUrl(file: string): string {
  return BASE + PUZZLES + file.replace(/^\/+/, "");
}

function isBankIndex(b: unknown): b is BankIndex {
  if (typeof b !== "object" || b === null) return false;
  const o = b as Record<string, unknown>;
  return o.schemaVersion === 1 && Array.isArray(o.puzzles);
}

function isManifest(m: unknown): m is PuzzleManifest {
  if (typeof m !== "object" || m === null) return false;
  const o = m as Record<string, unknown>;
  return (
    o.schemaVersion === 1 &&
    typeof o.puzzleId === "string" &&
    Array.isArray(o.entities) &&
    typeof o.categories === "object" &&
    Array.isArray(o.constraints)
  );
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  return res.json();
}

/** Read the bank index. Fails fast on a malformed/absent index. */
export async function loadBank(): Promise<BankIndex> {
  const raw = await fetchJson(puzzleUrl("index.json"));
  if (!isBankIndex(raw)) throw new Error("bank index malformed");
  return raw;
}

/** Pick the entry for a date+tier (defaults to today's standard). Latest builtAt wins. */
export function pickEntry(bank: BankIndex, date: string, tier: Tier): BankEntry {
  const e = bank.puzzles.find((p) => p.date === date && p.tier === tier);
  if (!e) throw new Error(`no ${tier} puzzle for ${date}`);
  return e;
}

/** Fetch a single manifest file. */
export async function loadManifest(file: string): Promise<PuzzleManifest> {
  const raw = await fetchJson(puzzleUrl(file));
  if (!isManifest(raw)) throw new Error(`manifest malformed: ${file}`);
  return raw;
}

/** Load index + the chosen day/tier manifest in one call. */
export async function loadPuzzle(date: string, tier: Tier): Promise<PuzzleManifest> {
  const bank = await loadBank();
  return loadManifest(pickEntry(bank, date, tier).file);
}
