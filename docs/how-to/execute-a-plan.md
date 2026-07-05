# How to execute a plan-doc autonomously

**Last Updated**: 2026-07-05

The execution contract for running a `TODO/<date>-<slug>-plan.md` end-to-end as the ORCHESTRATOR. This is the canonical home for the orchestrator + subagent-PR topology that plan-docs used to paste inline. A plan-doc no longer copies this block - it carries a one-line stamp that points here (see [author-a-plan.md](author-a-plan.md)), so there is one source of truth, per CLAUDE.md Holy Law #4 and the "link, do not copy" rule in [../reference/documentation-structure.md](../reference/documentation-structure.md).

Companion docs: [author-a-plan.md](author-a-plan.md) writes the plan this doc runs; [../agents/bootstrap.md](../agents/bootstrap.md) holds the autonomy-default policy ("AUTO is the default"); [ship-a-pr.md](ship-a-pr.md) holds the PR lifecycle each row follows.

When editing agent/customization Markdown, use ASCII only: "-", "->", ">=", "section".

## When this fires

The plan-doc is in context and the instruction is "implement it" (or an equivalent autonomous mandate). Execute as the ORCHESTRATOR with NO further questions except at an ESCALATE trigger. There is no processing step after reading this doc - the rules below are the whole instruction set.

## The execution contract

1. **Orchestrator + subagent-PR topology - the subagent owns the full row lifecycle.** The main agent owns the Status Reckoner (plan section 1) and the row-dependency graph; it never lets its own context overflow; it does NOT do git ops. Each ready PR-row is dispatched to a stateless `runSubagent` that owns the row end-to-end: branch, edit, commit, push, open PR, watch CI, fix-loop on its own PR, merge with `gh pr merge --squash --delete-branch`, post-merge hygiene (delete remote branch, prune `: gone` locals, remove `.tmp_*`), and the per-row distillation map per [distill-a-plan.md](distill-a-plan.md). The orchestrator only reads back the merged PR number and ticks the Reckoner.

2. **Worktree-per-subagent (mandatory isolation).** Before dispatch the orchestrator creates an isolated worktree: `git worktree add <ABS_PATH> -b <row-branch> origin/master` and passes that absolute path to the subagent. The subagent works ONLY inside that path. NEVER share a worktree across subagents - cross-agent contamination of the shared working tree is the number-one ship-time bug. Park the checked-out branch on `scratch-master-parking` so no worktree owns `master` (clean `gh pr merge`).

3. **Parallel fan-out, never idle on CI.** From the plan's dependency graph the orchestrator dispatches all rows whose predecessors are DONE, concurrently, up to N (default N = 3; overridable in the plan's section 0). The orchestrator MUST NOT wait for one row's CI to go green before dispatching the next non-blocked row - CI-watch and fix-loop are the subagent's job. As soon as a merge lands, the orchestrator recomputes the ready-set and re-saturates the fan-out.

4. **Subagent brief budget.** A brief is: (a) the row's section verbatim, (b) a pointer to this doc, (c) the absolute worktree path, (d) a pointer to the `bootstrap` skill. NOT the whole plan-doc. Target <= 200 lines of input context. The subagent reads more from disk on demand; the orchestrator does not push it.

5. **Persona debate converges to ONE ruling.** When a row hits a contested design call, run the authority personas - the five custom agents (Player, Jony, Palm, Fowler, Carmack) named in the authority table in [../agents/guardrails.md](../agents/guardrails.md) (CLAUDE.md section 14 is the roster) - in DEBATE, not parallel review. Bake the single written verdict into the row's Decisions table and proceed.

6. **PR lifecycle.** Author per [ship-a-pr.md](ship-a-pr.md): 2-commit-then-squash, the Definition-of-Done gates (CLAUDE.md section 9), browser-verify any `frontend/` runtime change (CLAUDE.md section 12). Tests ship with the row (CLAUDE.md section 13). Full suite green at merge. No new mocks unless asked (Holy Law #7). Pre-existing unrelated failures are not gating - document the baseline, do not block.

7. **Stop only at a real boundary.** Stop and ask ONLY when: an ESCALATE trigger fires (Level-5, CLAUDE.md section 6), an explicit user-named source or instruction would be scope-narrowed (STOP-AND-SURFACE per [handle-scope-change.md](handle-scope-change.md) and CLAUDE.md section 10), or an audit chain exceeds depth 3 (the loop is lossy - escalate with Path A/B/C options, do not ship a 4th audit). Otherwise do not pause; the user is not watching.

8. **Closure.** Done only when every in-scope row is DONE or COLLAPSED-with-cited-rationale. No-op rows carry a receipt (the command plus its zero result). Archive the plan-doc with a per-row distillation map per [distill-a-plan.md](distill-a-plan.md).

## The one-line stamp a plan-doc carries

Instead of pasting this contract, a plan-doc states, once, near the top:

```
Execution: autonomous orchestrator per docs/how-to/execute-a-plan.md. Parallel N = <n>.
```

That is sufficient for "implement it" to run - the executing agent reads this doc for the mechanics and [../agents/bootstrap.md](../agents/bootstrap.md) for the autonomy default.

## See also

- [author-a-plan.md](author-a-plan.md) - authoring the plan this contract executes.
- [distill-a-plan.md](distill-a-plan.md) - the per-row closure and archive ritual step 1 and step 8 reference.
- [ship-a-pr.md](ship-a-pr.md) - the PR lifecycle each row follows.
- [handle-scope-change.md](handle-scope-change.md) - the STOP-AND-SURFACE boundary in rule 7.
- [../agents/bootstrap.md](../agents/bootstrap.md) - "AUTO is the default": what autonomy means in yen-cinthanai plan execution.
- [../agents/guardrails.md](../agents/guardrails.md) - the authority table rule 5 debates converge against.
- [../../CLAUDE.md](../../CLAUDE.md) - correction levels (section 6), Definition of Done (section 9), anti-patterns (section 10), agent roster (section 14).
