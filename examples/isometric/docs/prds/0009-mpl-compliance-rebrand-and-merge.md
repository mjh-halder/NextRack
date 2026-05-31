# PRD 0009 — Finalize MPL-2.0 compliance rebrand + master merge

## Problem Statement

NextRack is being prepared for distribution as a hosted SaaS web application. ADR-0006 (Tier 1–3) already extracted every line of NextRack-authored code out of the inherited MPL-2.0 demo files, but five operational tasks remain before the project can ship:

1. `package.json` still identifies the project as `@joint/demo-isometric` with client IO as author and `jointjs.com` as homepage. Tooling, registry lookups, and any later auditor will see NextRack as the upstream demo.
2. There is no NOTICE / attribution file at the repo level distinguishing the (now trivially-modified) MPL-inherited files from the proprietary NextRack files.
3. MPL §3.2 requires that when the Executable Form is distributed (the SaaS JavaScript bundle delivered to browsers), the corresponding Source Code Form must be "made available … by reasonable means". No in-app pointer to the upstream sources exists yet.
4. There is no documented runbook for re-syncing the reverted MPL files with future `@joint/core` releases (the files are currently byte-equivalent to the upstream snapshot at commit `1c202b5e`; upstream will move on).
5. All the extraction work lives on branch `mpl-extract` (last checkpoint `b2c387b1`) and has not been merged into `master`.

Until these are closed, NextRack cannot ship without legal / branding ambiguity.

## Solution

Close out the five tasks as a single coordinated change set, in the order they appear above. Each task is small and independently verifiable; the final step is a clean fast-forward merge of `mpl-extract` into `master`.

## User Stories

1. As a NextRack engineer, I want `package.json` to identify the package as `@nextrack/system-designer` (or the user's chosen name), so it is no longer mis-identified as the upstream JointJS demo.
2. As a NextRack engineer, I want the `author` field set to NextRack's organisation / maintainer, so commits and tarballs attribute correctly.
3. As a NextRack engineer, I want `homepage` pointing at NextRack's project page, so anyone landing on the package metadata gets to the right place.
4. As a NextRack engineer, I want the workspace dependencies (`@joint/core`, `@joint/decorators`, `@joint/layout-directed-graph`) to remain unchanged, because those are MPL-licensed library dependencies we depend on without modification.
5. As a legal-compliance reviewer, I want a single human-readable NOTICE file at `examples/isometric/NOTICE.md` listing every MPL-inherited file together with the change category (UPSTREAM-EQUIVALENT, SHIM, DELETED), so an audit can be completed in one read.
6. As a legal-compliance reviewer, I want the NOTICE file to link to the public upstream repository (`https://github.com/clientIO/joint`) for each file, so the reader can verify "byte-equivalent to upstream" claims directly.
7. As a legal-compliance reviewer, I want the NOTICE file to enumerate the non-trivial deltas that remain (`PyramidShape` removed from `isometric-shape.ts`, related branch removed from `proportional-size-tool.ts`, 3-line shims in `shapes/index.ts` and `tools/index.ts`), so nothing is hidden.
8. As a SaaS user opening the NextRack web app, I want to find an "Open-source notices" link in the About dialog (or footer), so I can see what open-source code the app is built on.
9. As a SaaS user clicking the "Open-source notices" link, I want to land on a page (in-app or external) that lists the upstream JointJS attribution and a pointer to `https://github.com/clientIO/joint`, so MPL §3.4's notice-preservation requirement is satisfied.
10. As a SaaS user reviewing the open-source notices, I want a single statement that the modifications NextRack made to the upstream files are limited to `PyramidShape` removal plus the two 3-line barrel shims, with a link to each file's diff, so I can verify the claim if I want to.
11. As a NextRack engineer planning a `@joint/core` upgrade, I want a step-by-step runbook (`docs/runbooks/mpl-resync.md`) for re-syncing the 11 reverted MPL files with the new upstream snapshot, so upgrades are repeatable.
12. As a NextRack engineer following the runbook, I want a verification command that compares each reverted MPL file's hash to the corresponding file in the new upstream snapshot, so I know whether a manual re-sync is needed for that file.
13. As a NextRack engineer following the runbook, I want a separate check for the four re-implementations in `nextrack-utils.ts` (`nextrackTransformationMatrix`, `nextrackSortElements`, `nextrackDrawGrid`, `nextrackSwitchView`) so the re-implementations stay behaviour-compatible with any new upstream version of those functions.
14. As a NextRack engineer, I want `mpl-extract` merged into `master` via a fast-forward (no merge commit), so the linear history of the six MPL checkpoints stays intact and bisectable.
15. As a NextRack engineer, I want the rollback tag `mpl-rollback-2026-05-29` preserved after the merge, so the entire strategy can still be reverted if it proves unworkable later.
16. As a NextRack engineer, I want the work-in-progress branch `mpl-extract` deleted after the fast-forward, so the branch list stays clean.
17. As a NextRack engineer, I want `tsc --noEmit` and the existing vitest suite to pass on `master` after the merge, so the merge does not regress the type system or any existing test.
18. As a future maintainer reading the repo for the first time, I want ADR-0006 and the NOTICE file to be discoverable from `README.md`, so the MPL story is immediately apparent.
19. As a NextRack engineer, I do **not** want a commercial JointJS license purchased as part of this change set, so the change stays within the boundary of the merger-doctrine compliance strategy already documented in ADR-0006.
20. As a NextRack engineer, I want all changes from this PRD to live on a single feature branch (`mpl-finalize`) off `mpl-extract`, so the PR is reviewable as one unit and the existing extraction checkpoints stay untouched.

## Implementation Decisions

The five modules in scope. None is code-heavy; the value is in correctness and discoverability.

### A — `package.json` rebrand

- Update `name` from `@joint/demo-isometric` to the NextRack-chosen identifier. **Open question**: which exact name (e.g. `@nextrack/system-designer`, `nextrack-app`)? Pick at implementation time with the user.
- Update `author` to NextRack's organisation/maintainer (name + email or URL). Same open question.
- Update `homepage` to the NextRack project URL.
- Leave `dependencies` untouched — `@joint/core`, `@joint/decorators`, `@joint/layout-directed-graph` are MPL-2.0 libraries we consume without modification.
- Leave `license` at `UNLICENSED` (already done in `b2c387b1`).
- Leave `main` at `src/boot.ts` (already done in `b2c387b1`).
- Leave `private: true` (already correct).

### B — Repo NOTICE file

Static markdown at `examples/isometric/NOTICE.md`. Sections:

- **NextRack-proprietary files** — one sentence noting that everything not listed in the MPL section is NextRack-authored and proprietary.
- **MPL-2.0-inherited files** — table mirroring the final table in ADR-0006 (file path, status, link to upstream file in `clientIO/joint`).
- **MPL-2.0 library dependencies** — three bullets: `@joint/core`, `@joint/decorators`, `@joint/layout-directed-graph`, each linking to their upstream package.
- **Modification summary** — explicit statement that the only NextRack deltas in MPL files are: (a) `PyramidShape` removal in `isometric-shape.ts`, (b) the matching branch removal in `tools/proportional-size-tool.ts`, (c) 3-line shim replacements for `shapes/index.ts` and `tools/index.ts`, (d) the mandatory `jointjs` → `@joint/core` import path renames forced by upstream's own restructure. No NextRack-authored business logic lives in any MPL file.
- **Re-implementation note** — a paragraph covering the four functions re-implemented in `nextrack-utils.ts` (Tier 3) and the merger-doctrine reasoning, with a forward link to ADR-0006.

### C — In-app MPL attribution

A "Notices" entry in the existing Switcher menu (the same NextRack switcher panel that already exposes Settings and Knowledge Base in `boot.ts`). Clicking it opens a modal — same modal infrastructure as the existing Mode-Selection modal — containing:

- A heading "Open-source notices".
- A short paragraph attributing JointJS to client IO and stating that NextRack uses `@joint/core` (MPL-2.0) and a small set of files originally derived from the `isometric-diagram` JointJS demo.
- An external link to `https://github.com/clientIO/joint`.
- An external link to the in-repo `NOTICE.md` (served as a static asset or rendered via the existing `marked` dependency).
- A "Close" button that dismisses the modal back to the previous view.

Implementation details:

- Use existing Carbon Design components (Modal, Link) per CLAUDE.md's strict Carbon directive.
- No new dependencies.
- The modal markup goes in `boot.ts` adjacent to `showModeModal()` and `initSwitcherMenu()`.

### D — Upstream-sync runbook

Markdown at `examples/isometric/docs/runbooks/mpl-resync.md`. Section outline:

- **When to run** — triggered when `package.json` bumps any `@joint/*` workspace dependency.
- **Per-file checklist** — for each of the 11 MPL files in the ADR-0006 final table, list (a) the symbol(s) it exposes, (b) whether NextRack code depends on those symbol shapes, (c) the command to diff against the new upstream snapshot.
- **Re-implementation parity check** — for each `nextrack*` function in `nextrack-utils.ts`, the corresponding upstream function name and a manual review note (signature parity, behavioural parity).
- **Verification** — `yarn tsc --noEmit` plus the existing vitest suite plus a Playwright smoke run.
- **Rollback** — pointer to the `mpl-rollback-2026-05-29` tag.

### E — Branch merge

Sequence:

1. Confirm `mpl-extract` is at `b2c387b1` after Modules A–D are committed on a sub-branch `mpl-finalize`.
2. Fast-forward `mpl-extract` to `mpl-finalize`.
3. Fast-forward `master` to `mpl-extract`.
4. Push.
5. Delete the temporary `mpl-finalize` branch (local + remote if pushed).
6. Keep `mpl-extract` for one release cycle, then delete (separate decision).
7. Tag `mpl-rollback-2026-05-29` stays untouched.

## Testing Decisions

A good test exercises the externally observable contract of a module — not its internal call structure. For this PRD that means:

- **Module C (In-app attribution)** — Playwright smoke test (the project already has `.playwright-mcp/` infrastructure). Open the app, open the Switcher panel, click "Notices", assert the modal contains the upstream attribution text and an `<a href="https://github.com/clientIO/joint">` link. One test, end-to-end, asserts what a SaaS user actually sees.
- **Module B (NOTICE file)** — small vitest covering: (a) `NOTICE.md` exists at the expected path; (b) each MPL file listed in the NOTICE table actually exists in `src/`; (c) each upstream-link URL matches the documented `clientIO/joint` pattern. This catches drift if a file gets renamed or moved without updating the notice. Prior art: `src/color-derivation.test.ts` (existing vitest for pure logic).
- **Modules A, D, E (config / doc / git)** — no automated tests. `tsc --noEmit` covers Module A's correctness. Module D is human-read documentation. Module E's correctness is verified by `git log --oneline` showing the expected linear sequence.

## Out of Scope

- Purchasing a commercial JointJS license from client IO. ADR-0006 keeps that option open but does not select it; this PRD inherits the same boundary.
- Re-doing or refining the actual extraction work (Tier 1–3). All six extraction commits (`dae1fe7d`, `8ad26cf9`, `f731c624`, `2d99f760`, `f90c447a`, `b2c387b1`) are accepted as-is.
- A separate public mirror repository for the trivially-modified MPL files. The in-app NOTICE + the project's own GitHub repo are deemed sufficient "by reasonable means" under MPL §3.2. A mirror can be added later if a user actually requests source distribution.
- Master branch protection rules, CI gating, automated release tooling — separate concerns, separate PRD.
- Bumping `@joint/*` workspace dependencies. The runbook (Module D) prepares for that, but does not perform any actual bump.
- Translating NOTICE.md or the in-app attribution to languages other than English.
- Domain-model changes (shape registry, hardware validator, product catalog, etc.). This PRD is licensing + branding only.

## Further Notes

- The compliance strategy and the per-file verdict table are fully documented in `examples/isometric/docs/adr/0006-mpl-extraction-strategy.md`. Implementers should read it before starting.
- The rollback tag is `mpl-rollback-2026-05-29` — preserved across all subsequent commits and not to be deleted by this PRD.
- The six MPL-related commits (in chronological order): `dae1fe7d` (utils.ts extract), `8ad26cf9` (isometric-shape.ts extract), `f731c624` (boot.ts extract), `2d99f760` (Tier 1+2 extension), `f90c447a` (Tier 3 utils.ts re-implementations), `b2c387b1` (package.json license + main). All on branch `mpl-extract`.
- The merger-doctrine argument for the Tier-3 re-implementations is plausible but not 100% legally bulletproof. The Considered Options section of ADR-0006 records the commercial-license alternative; if a future legal review concludes the merger argument is too weak, that escape hatch is available.
- The author should confirm the chosen `name` / `author` / `homepage` values with the project owner before committing Module A — they are not derivable from the conversation context.
