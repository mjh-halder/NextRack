# ADR 0006 — MPL-2.0 compliance via extraction of NextRack additions from inherited demo files

Date: 2026-05-29
Status: Accepted

## Context

NextRack is a fork of `@joint/demo-isometric` (Mozilla Public License 2.0, © client IO). The original demo entered this repo on commit `1c202b5e` (2023-08-23) with ~28 source files; substantial NextRack development began on `2026-04-12`. Today, 13 of the original MPL-2.0-licensed files still exist and have been modified (`src/index.ts` +444/-144, `src/shapes/isometric-shape.ts` +780/-32, `src/utils.ts` +542/-17, plus 10 smaller files); other originals were deleted. The remaining ~50 files under `src/` are NextRack creations and have never been part of any MPL-covered file.

NextRack will be distributed as a **hosted SaaS web application**. Under MPL-2.0 §3.2 the JavaScript bundle delivered to the user's browser counts as distribution of Executable Form, which triggers the source-availability obligation on §1.10 "Modifications" — including both (a) changes to existing MPL files and (b) new files that *contain* Covered Software (i.e. copy-pasted MPL code, not files that merely import the public API).

We want to ship NextRack's domain layer (component model, hardware validator, product catalog, system designer, etc.) under proprietary terms while remaining cleanly compliant with MPL-2.0.

## Decision

Adopt a **pragmatic extraction strategy**:

1. For each Original MPL file where the additions are cleanly separable, extract the NextRack code into new files (which sit in the "Larger Work" and may be proprietary) and revert the Original file to its upstream state.
2. For files where the modifications are inseparably interleaved with the original logic *and* are generic in nature (visual styling, grid filters, registry barrel files, etc.), leave them as modified MPL-2.0 files and publish them.
3. Treat `@joint/core` itself (also MPL-2.0, used as a workspace dependency and bundled into the SaaS JavaScript) as compliant via a footer/about-page link to the public upstream repository at `https://github.com/clientIO/joint`.

**Per-file verdict for the 13 modified Original files:**

| File | Verdict | Mechanism |
|---|---|---|
| `src/index.ts` | DELETED | All NextRack app shell moved to `src/boot.ts`; `webpack.config.js` entry repointed from `./src/index.ts` to `./src/boot.ts`; the file was deleted entirely. No publish obligation. |
| `src/shapes/isometric-shape.ts` | UPSTREAM-EQUIVALENT | Reverted to byte-equivalent upstream content (modulo the mandatory `'jointjs' → '@joint/core'` import path and removal of `PyramidShape` whose `PyramidHeightControl` dependency was already deleted). All NextRack code (port plumbing, modifier-key getters, `addTools` widening, `toggleView` body, `apply2DHitArea`) extracted into new `src/shapes/nextrack-isometric-shape.ts` as `NextrackIsometricShape extends IsometricShape`. Constructor-ordering hazard handled by an `undefined`-guard on `currentPortView`. All NextRack-extending shape classes now extend `NextrackIsometricShape`. `ModifierKey` and the public `ToolKeys` type live in the new file. |
| `src/utils.ts` | UPSTREAM-EQUIVALENT | Reverted to byte-equivalent upstream (modulo the mandatory `'jointjs' → '@joint/core'` import path). The 11 cleanly-added NextRack functions live in `src/nextrack-utils.ts`. The four originally-modified demo functions (`transformationMatrix`, `sortElements`, `drawGrid`, `switchView`) were re-implemented in `nextrack-utils.ts` from the functional requirements — the underlying matrix math is dictated by the isometric projection, topological sort is a standard graph algorithm, SVG path generation is mechanical, and the view-switch orchestration is a fixed sequence of API calls. Each re-implementation is written in independent style (early returns, different variable names, restructured loops) so that the only common ground with upstream is non-protectable expression (merger doctrine). All four NextRack consumers (system-designer, component-designer, minimap, auto-layout) repointed to the `nextrack*` symbols. |
| `src/shapes/index.ts` | SHIM | 3-line `export * from './cell-namespace';` shim; the entire NextRack barrel moved to `src/shapes/cell-namespace.ts`. |
| `src/theme.ts` | UPSTREAM-EQUIVALENT | Reverted byte-equivalent to upstream. NextRack overrides (`GRID_COUNT = 100`, `HIGHLIGHT_COLOR = '#ff832b'`) and additions (`SHAPE_CELL_SIZE`, `MIN_ZOOM`, `MAX_ZOOM`) live in new `src/nextrack-theme.ts`. NextRack consumers import from `nextrack-theme`; MPL-resident files (utils, obstacles, tools) keep importing from `theme` and see upstream values. |
| `src/obstacles.ts` | UPSTREAM-EQUIVALENT | Reverted (modulo `jointjs → @joint/core`). NextRack additions (canvas size override + Frame/Area/GridLabel/child filter) live in new `src/nextrack-obstacles.ts` as `NextrackObstacles extends Obstacles` — filter-then-delegate composition over the upstream cell-aware methods (no upstream method bodies are reproduced). `system-designer.ts` now instantiates `NextrackObstacles`. |
| `src/shapes/link/link.ts` | UPSTREAM-EQUIVALENT | Reverted (modulo `jointjs → @joint/core`). NextRack styling + `SquareVertexHandle` + alternative tool preset live in new `src/shapes/link/nextrack-link.ts` as `NextrackLink extends Link`. `cell-namespace.ts` re-exports `NextrackLink as Link` so JointJS's namespace lookup and all consumers get the NextRack visual via the existing `Link` identifier. |
| `src/tools/tools.ts` | UPSTREAM-EQUIVALENT | Reverted (modulo `jointjs → @joint/core`). NextRack markup constants (Carbon icon paths, NEXTRACK_ variants of size/connect/height markups) plus `NEXTRACK_CONNECT_TOOL_PRESET`, `NextrackCenterBasedHeightControl` and `NextrackProportionalSizeControl` subclasses live in new `src/tools/nextrack-tools.ts`. |
| `src/tools/size-tool.ts` | UPSTREAM-EQUIVALENT | Reverted (modulo `jointjs → @joint/core`). NextRack `constrainAxis` + Y-dim-only resize behaviour lives in new `src/tools/nextrack-size-tool.ts` as `NextrackSizeControl extends SizeControl`. |
| `src/tools/index.ts` | SHIM | 3-line `export * from './tools-barrel';` shim; the re-exports moved to `src/tools/tools-barrel.ts` (which also re-exports `nextrack-tools` and `nextrack-size-tool`). |
| `src/tools/proportional-size-tool.ts` | UPSTREAM-EQUIVALENT | `'jointjs → @joint/core'` import path plus removal of the `instanceof PyramidShape` branch (whose class was already deleted). No NextRack content. |
| `src/tools/center-based-height-tool.ts` | UPSTREAM-EQUIVALENT | `'jointjs → @joint/core'` import path only. No NextRack content. |
| `src/svg.d.ts` | NO-OP | Unchanged from upstream. |

Compliance for PUBLISH files: a copy of the source for those specific files will be made available alongside the SaaS app (e.g. a `/legal/mpl-sources.zip` link or a public mirror repository), together with the MPL-2.0 license text and an attribution to client IO. NextRack's own files (`src/component-store.ts`, `src/system-designer.ts`, `src/hardware-validator.ts`, `src/product-catalog.ts`, and the ~46 other NextRack creations) remain proprietary because they neither modify nor contain Covered Software — they only import the public API.

After extraction, `package.json` will be updated from `"license": "MPL-2.0"` to a NextRack-proprietary declaration with a separate notice covering the published MPL files.

## Considered Options

- **Maximum-clean extraction (initially rejected, later adopted)** — the original ADR rejected extracting the smaller PUBLISH-verdict files via subclass tricks, on the grounds that the resulting inheritance layers would exist purely for license reasons. After user pushback (Schöpfungshöhe argument applied to a 3-line shim) the decision was revisited and the maximum-clean path was adopted for Tier 1+2: every modified MPL file *except* `src/utils.ts` is now either deleted, byte-equivalent to upstream, or a trivial shim. The "license-only inheritance layers" (`NextrackIsometricShape`, `NextrackObstacles`, `NextrackLink`, `NextrackCenterBasedHeightControl`, `NextrackProportionalSizeControl`, `NextrackSizeControl`) are explicit in their names and self-documenting; the obscurity concern did not materialise. `utils.ts` was left at the partial-extraction state (Tier 3) because rewriting its four modified functions in a new file would risk near-clone Covered Software under MPL §1.10(b).
- **Buy a commercial JointJS license from client IO** — relicenses both `@joint/core` and the demo files, removing all MPL obligations. *Not selected now* because the pragmatic strategy is sufficient for SaaS distribution and avoids recurring license fees; can be revisited if NextRack ever wants to redistribute source closed-form or partner-embed the library.
- **Clean-room rewrite of all 13 files** — re-implement without reference to upstream. *Rejected* because `isometric-shape.ts` and `utils.ts` together represent ~1300 lines of working code, the rewrite cost is high, and clean-room provenance is hard to defend without a separate uninvolved team.
- **Don't distribute (keep purely internal)** — MPL §3 only triggers on distribution. *Not applicable* — NextRack is a commercial SaaS product.

## Consequences

- One-time refactor cost of approximately 3 working days for the EXTRACT files.
- The repository will contain a clear split: `src/boot.ts`, `src/nextrack-utils.ts`, and `src/shapes/<shape>.ts` files own NextRack code; the reverted Original files own MPL upstream code; the PUBLISH files remain MPL-2.0 hybrids.
- A small ongoing compliance task: when `@joint/core` is upgraded, the reverted Original files may need to be re-synced with upstream changes, and the PUBLISH files re-diffed.
- New files must not copy code from MPL files — only import the public API. Subclassing is fine; copy-pasting a private helper is not.
- The `pre-mpl-extract` rollback point is tagged `mpl-rollback-2026-05-29` so the entire strategy can be reverted if it proves unworkable.
