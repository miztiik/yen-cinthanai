**Short answer: yes — and this is a well-defined problem class, not greenfield design.**

Seating-order, zebra/Einstein puzzles, ranking puzzles, and logic grids are all the same object underneath: a **constraint satisfaction problem (CSP)** with a UI skin. Build the CSP engine once, skin it N ways.

### 1. The abstraction — "closing the subset" you asked about

| Puzzle type | Slot topology | Typical constraints |
|---|---|---|
| Seating, row | Linear sequence | adjacency, left/right-of, not-adjacent, ends |
| Seating, round table | Circular sequence | adjacency (wraps), opposite, between |
| Race / ranking | Ordered sequence | before/after, exact position, gap |
| Zebra / logic grid | N×M grid (category × entity) | same-row, exclusion, conditional |
| Scheduling | Grid (people × time) | non-overlap, exactly-one, capacity |
| Pairing / grouping | Partition into sets | same-group, never-same-group, group size |

Every row reduces to: **entities + slots (with topology) + typed constraints + a unique solution**. One engine, six skins.

### 2. Has anyone done this
- Generation algorithm (used by the ZebraLogic benchmark): sample a full random solution, enumerate every clue type consistent with it, then strip clues out by weighted sampling while continuously checking the remaining set still forces a unique solution. An open-source generator does the same thing using SAT-based constraint solving to produce random zebra puzzles, and a recent benchmark formalizes the difficulty-tuning step as weighted sampling over constraint types, with harder tiers favoring more indirect clue types.
- The play surface (seating/zebra-style apps) is a mature genre; the solver-driven generator is what's *not* commonly public. That's your actual build target, not a risk area.

### 3. Tech stack

| Layer | Recommendation | Why |
|---|---|---|
| Generator/solver | Python + OR-Tools CP-SAT, or hand-rolled backtracking/AC-3 | Mature CSP tooling; runs server-side or in a build step, not per-request |
| Algorithm | sample solution → add constraints → verify uniqueness → prune to minimal set | This *is* the puzzle design; rendering is the easy part |
| Delivery | Pre-generate a bank, ship as static JSON over CDN | True statelessness — no per-request solve |
| Rendering | DOM + CSS (React/Svelte/vanilla); Canvas/WebGL only if >100 nodes or particles | Drag-arrange doesn't need GPU |
| Drag | dnd-kit / SortableJS / interact.js (pointer-events based) | Native HTML5 DnD has poor touch support — kills "playful" on mobile |
| Animation | CSS transitions / Web Animations API, or GSAP/Framer Motion for spring feel | No WASM needed here |
| Client validation | Re-check constraints in JS against the clue list, not an answer-key diff | Enables instant per-move feedback and real hints |

**Where WASM actually matters**: only if you want the *solver* itself running in-browser (fully offline, zero backend even for generation). Z3 ships as WASM via the official `z3-solver` npm package, but needs SharedArrayBuffer support in the browser plus serving the page with special cross-origin headers — real deployment friction. OR-Tools has a community WASM port covering CP-SAT, claimed to retain near-native performance by translating the C++ codebase to WASM and enabling multithreading — treat that claim with the same skepticism as any single blog post; it's not yet a default-recommended path. Given the `SafeIntOnOverflow`/WebGPU issues you hit pinning SmolLM2 to WASM, expect a similar "works, budget debugging time" experience here. For v1: **skip in-browser solving** — pre-generate, ship JSON, validate client-side against the clue list.

### 4. Architecture (matches your stateless-frontend split)

- **Puzzle Service** (separate, stateless): `params {type, entityCount, difficulty} → JSON {entities, slots, constraints, solution, hintTrace, difficultyScore}`. Idempotent, no session — same pre-bake-once-reuse-via-CDN pattern as your choropleth tiles.
- **Game Client** (the "no server backend" part): pure consumer of that JSON. Validates moves against `constraints` (not `solution`, so partial-progress feedback works), drives animation/scoring/hints in memory.
- **Hint engine**: don't reveal randomly — re-run step-wise constraint propagation and surface "the next clue you can legally apply now." Same principle as keeping your tsumego SGF comments restricted to real decision points instead of annotating every move.

### 5. Assumptions/constraints to state explicitly
- "Stateless" = no per-user session, not "no backend." Generation runs offline into a static bank, or as a stateless API call.
- Solver must verify **uniqueness**, not just satisfiability — a clue set with 2+ valid layouts is the most common generator bug.
- Difficulty ≠ entity count alone: it's entity count × constraint density × constraint-type mix (direct vs. relative/negative/distance) × required propagation depth.
- Touch UX needs tap-to-select/tap-to-place as a fallback to drag — drag-only degrades badly on small screens.

### 6. Variation, difficulty, hints, "addictive"
- One schema → many skins: swap topology + constraint-type set + theme, reuse the engine.
- Difficulty knobs: entity count, clue indirection ratio, hint budget, optional timer.
- Progressive ("fog of war") clue reveal instead of showing all clues up front — steeper but still fair, since the solver already proved it's solvable.
- Color-coded clue-type chips (adjacency / exclusion / ranking) for fast scanning.
- Immediate snap-feedback on every placement (glow + light haptic on valid, shake on invalid) — this tight loop, not difficulty, drives "addictive."
- Streaks, daily puzzle, hint-adjusted star rating, adaptive next-puzzle difficulty from solve-time + hints-used telemetry.

**Bottom line**: buildable with a fully separated, stateless architecture — CSP generator on the backend (or pre-baked to static JSON), pure interactive renderer on the frontend, no WASM required for v1. The hard part isn't the UI; it's the generator's uniqueness-check and minimal-clue pruning, which the academic work above has already solved and published the algorithm for.
-----
**Understanding check** — confirming before I build on it:

- Each puzzle entity (person/object) is a "piece" with empty attribute slots (drink, pet, house-color, etc.).
- A shared token pool holds the possible values per attribute. Player drags a token into a slot to assign it, drags it out to remove it. Pool depletion handles "each value used exactly once" with zero text.
- Constraints (the clues) and their satisfy/violate state are communicated through glyphs/color/motion — not sentences.
- Goal feel: assembling a jigsaw/dress-up puzzle, not reading a worksheet.

That's correct as I understand it. One thing I can't infer and need to flag rather than guess wrong: **are the constraints shown to the player upfront** (classic deduction — reason it out before placing anything), **or hidden and discovered through trial-and-feedback** (Mastermind-style — place, get a glyph signal, adjust)? These are two different games — different generator, different hint logic, different difficulty model. I'll answer below assuming **upfront/visible clues** (matches "logic puzzle" and your seating-game framing) — flag it if you meant guess-and-check instead.

---

### 1. Generation without an LLM — yes, fully
The generation algorithm from last turn (sample a solution → add constraints → verify uniqueness with a solver → prune to minimal set) is deterministic combinatorial search. Zero language model involvement, at generation *or* at solving/validating a move — both are plain constraint checks. The benchmarks I cited last turn (ZebraLogic, BeyondBench) only use an LLM as the *system being tested for reasoning* — not as the puzzle author. An LLM is irrelevant to your pipeline either way, and doubly so for a non-text design — there's no text to generate.

### 2. Hardest part — revised given UI-as-central-theme
Not the generator anymore (that's a published, solved algorithm). It's **designing a minimal visual grammar that can express relational constraints without text**, because:

- Structural constraints (one value per slot, adjacency = neighboring slot) map naturally to spatial metaphors — low risk, jigsaw-style geometry handles it for free.
- Relational constraints (X excludes Y, X is two seats from Y, conditional clues) are propositions over 2+ variables with no universal visual sign — each clue *type* needs its own bespoke glyph.
- Second-order effect: as entity/category count grows, you need *more* clue types to keep the puzzle uniquely solvable, which means *more* glyphs — directly fighting "simple and playful." This expressiveness-vs-learnability tension is the real open problem; there's far less prior art here than for the solver.
- This also feeds back into the generator: it can no longer use the full classic zebra clue-type library — only the subset you've designed legible glyphs for. That's a real coupling most teams miss until late.

### 3. Inspiration — non-text constraint precedent

| Precedent | What it solves | Maps to |
|---|---|---|
| Tantrix / Eternity tiles | Binary compatibility via edge shape/color matching | Adjacency/exclusion clues |
| Mastermind | Satisfy/violate signaled by color feedback, no rule text shown | Ambient violation feedback |
| Sudoku conflict highlighting | Permutation constraint shown via duplicate-highlighting | Your token-pool-depletion idea, already non-text |
| Rummikub / Set | Attribute-token visual matching | The assign/remove mechanic itself |
| NYT Connections | Grouping without naming the rule | Same-group/never-same-group clues |

### 4. Affirm / flag, by component

| Your idea | Verdict | Why |
|---|---|---|
| Drag-assign/remove attribute tokens, jigsaw-style | ✅ Solid | Directly precedented (dress-up games, Rummikub); zero new research needed |
| Pool depletion enforces "used once" | ✅ Solid | This *is* Sudoku's conflict-prevention trick, already non-text |
| Visual glow/shake for satisfy/violate | ✅ Solid | Directly precedented (Mastermind feedback) |
| Fully non-text *clue* representation | ⚠️ Open R&D | No off-the-shelf solution; needs its own design+playtest phase, separate from the engine build — don't budget it as "just UI polish" |

### 5. Enhancement to the architecture
- Add a **clue-type → glyph template** registry as a first-class artifact. The generator's clue-type library gets *constrained to* (or tagged with) only relation types that have a defined glyph — not the full classic zebra clue set by default.
- Each constraint in the puzzle JSON gets a `renderHint` field (e.g. `adjacency`, `exclusion`, `distance:2`) so the client knows which glyph template to draw — glyphs are per-relation-type, not generic.
- "Fog of war" hint reveal from last turn still applies — just reveals a glyph instead of a sentence.

### 6. Consolidated requirements (both turns)

| Category | Requirement |
|---|---|
| Genre | Constraint-satisfaction arrangement/assignment puzzles; seating order is one instance |
| Frontend | Stateless, browser-based, no server backend during play |
| Backend | Separate, generation-only, outputs JSON {entities, slots, constraints, solution, hints} |
| Interaction | Drag pieces, assign/remove attribute tokens — jigsaw/dress-up metaphor |
| Feedback | Real-time visual satisfy/violate via glyph/color/motion — non-text |
| Generation | Solver-driven (CSP/SAT), non-LLM, must verify unique solution |
| Difficulty | Entity count × clue density × clue-type mix × propagation depth |
| Hints | From solver's deduction trace, glyph-rendered |
| Variation | One schema (entities/slots/constraints), many topology "skins" |
| Open risk | Non-text glyph grammar for relational clues — dedicated design phase, not solved by the engine |
| Open fork | Clues visible-upfront (assumed) vs. hidden/guess-and-check — confirm |
-----------------
**Confirmed, with one assumption flagged:** multi-attribute entities, feedback-as-difficulty-lever, attempt-limited guess-and-check, your own manifest standard, and text+glyph clues — all consistent and buildable. One fork I'm resolving by assumption rather than stopping: some categories (gender) are inherently **shared-value** (multiple entities can have the same value), while others (clothing color, in the classic zebra format) are typically **bijective** (each value used exactly once). I'm assuming you want to mix both types per puzzle — flag if you'd rather force everything bijective for solver simplicity.

### Updated requirements (consolidated across all three turns)

| Category | Requirement |
|---|---|
| Genre | CSP arrangement/assignment puzzles; seating is one topology instance |
| Data model | Entities × attribute categories (additive/multi-attribute); position is just one more ordinal category, not a separate model |
| Cardinality | Mixed: bijective categories (permutation, classic zebra-style) + shared-value categories (e.g., binary gender) — solver must handle both |
| Frontend | Stateless browser app, no server backend at play time |
| Backend | Separate, generation-only, non-LLM, CSP/SAT-driven, outputs a puzzle manifest |
| Interaction | Drag tokens to assign/remove attributes — jigsaw/dress-up metaphor, pool depletion enforces uniqueness |
| Clue display | Text problem statement, with entity/attribute glyphs inline — text teaches the icon vocabulary |
| Board feedback | Real-time glyph satisfy/violate signaling, on the solving surface (not the clue panel) |
| Verification timing | Configurable axis, not fixed — Casual/Standard/Expert modes (below) |
| Attempts | Limited per difficulty tier, separate dial from feedback timing |
| Manifest | Own canonical schema — not tied to any external benchmark format |
| Difficulty | Entity count × clue density × cardinality mix × feedback mode × attempt budget |
| Generation | Solver-driven, deterministic, zero LLM — including clue *text* (templated, see below) |

### 1. Multi-attribute, additive entities — affirm + unify
This doesn't need a new model — it *is* the "Zebra/logic grid" row from turn one's table, generalized. The unifying insight: **position is not special** — in the classic zebra puzzle, house-number is just an ordinal attribute category that happens to support adjacency/before-after clues, exactly like any other category would if you marked it ordinal. So your engine needs exactly one generalized object — *entity × attribute-category*, where each category is tagged ordinal (supports spatial clue types) or nominal (supports only equality/exclusion) — and seating, zebra-grid, and scheduling all fall out of that one structure with different category configs. This single unification is worth locking into the manifest now; retrofitting it later is the expensive path.

### 2 & 5. Feedback timing and attempts — the options you asked for
"Verification only on submission" is correct for **one** difficulty tier, not as a universal rule — make it a configurable axis:

| Mode | Feedback timing | Feedback detail | Attempts | Best for |
|---|---|---|---|---|
| Casual | Real-time, every move | Names the specific clue violated | Unlimited | Onboarding, teaching the glyph vocabulary |
| Standard | On-demand "check" | Count of wrong assignments, not which | Limited (e.g. 3) | Core loop |
| Expert | Submission only | Binary pass/fail, no detail | 1, then reveal | Competitive/leaderboard mode |

Treat **feedback timing**, **feedback detail**, and **attempt budget** as three separate dials (not one mode-switch) — e.g. you could ship "real-time timing + binary detail" as a distinct fourth tier. Clue density (turn 1) is a fourth, independent axis layered on top.

### 3. Guess-and-check safety — affirm, with one caveat
Mechanically, yes — validation is a deterministic constraint check; running it once per move or once at submission is computationally identical and equally "safe," no exploit surface either way. The caveat is about *game feel*, not safety: if feedback detail is per-assignment correctness (Mastermind-style), a patient player can solve by systematic trial instead of deduction — for small puzzles this is often faster than reasoning. If detail is clue-level or binary, brute-force search is impractical for a *human* in a UI even though it's trivial for a script. So pick feedback detail deliberately per tier (table above) rather than letting it default to whatever's easiest to implement — that choice is what decides whether a given tier is actually a logic puzzle or a search-and-feedback game.

### 4. Canonical manifest — affirm, sketch the fields
Right call — don't couple to an external benchmark format (ZebraLogic's schema is built for LLM-eval, has no rendering/feedback/glyph fields). Your manifest needs:

| Field | Purpose |
|---|---|
| `meta` | puzzleId, topology type, difficultyTier, feedbackMode, attemptBudget |
| `entities` | list of entity IDs |
| `attributeCategories` | id, label, value domain (each value: id + icon + label), cardinality (bijective / shared), ordinal flag |
| `constraints` | id, type, operands, `clueText` (templated NL string), inline glyph refs, board-feedback render hint |
| `solution` | canonical entity → {category: value} map |
| `hintTrace` | ordered deduction steps, clue(s) → forced next assignment |
| `clueTemplateRegistry` | constraint type → NL template with placeholders + icon-slot markers |

### 6. Text + glyph clues — this invalidates last turn's flagged risk, in a good way
Last response flagged "fully non-text relational clues" as open R&D with no off-the-shelf solution. This decision removes that risk almost entirely: you only need icons for *attribute values* (finite, easy, and the icons get reused identically on the solving board — same vocabulary, two surfaces, which is exactly what teaches it). The clue *sentences* themselves are a templating problem, already solved at scale — the standard approach defines clue types as language templates with placeholders for values, filled in per-puzzle from the solution. Zero generative/LLM step required, consistent with your no-LLM constraint from earlier.

**Where the hard part moved, given today's decisions:**
1. Generator complexity — mixing bijective and shared-value categories in one solver model is a step up from vanilla permutation-based zebra generation; uniqueness-checking gets heavier as category count grows.
2. Difficulty calibration is now genuinely multi-dimensional (clue density × cardinality mix × feedback mode × attempts), not the single-axis "entity count" you'd naively start with — worth building the difficulty scorer as its own component, tested independently of the generator.