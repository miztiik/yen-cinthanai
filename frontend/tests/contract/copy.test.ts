// Contract: the celebration copy bags. Full v1 ships 50 SUCCESS / 50 ENCOURAGE / 10
// HERO (difficulty-and-scoring.md), each <=22 chars, ASCII, spoiler-free. Asserts the
// baked public/config/copy.json against the contract; bake_config.py is the writer.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const copy = JSON.parse(
  readFileSync(resolve(here, "../../public/config/copy.json"), "utf8"),
) as {
  success: string[]; encourage: string[]; hero: string[];
  share?: { title: string; line: string; streak: string };
  credits?: { intro: string; license: string };
};

describe("copy bags", () => {
  it("ship 50 / 50 / 10", () => {
    expect(copy.success.length).toBeGreaterThanOrEqual(50);
    expect(copy.encourage.length).toBeGreaterThanOrEqual(50);
    expect(copy.hero.length).toBeGreaterThanOrEqual(10);
  });
  it("every line is <=22 chars ASCII", () => {
    for (const line of [...copy.success, ...copy.encourage, ...copy.hero]) {
      expect(line.length).toBeLessThanOrEqual(22);
      expect(line).toMatch(/^[\x20-\x7e]+$/);
    }
  });
  it("carries share + credits chrome", () => {
    expect(copy.share?.title).toContain("{tier}");
    expect(copy.credits?.license).toBeTruthy();
  });
});
