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
| `src/index.ts` | EXTRACT | Move bootstrap glue to new `src/boot.ts`; revert `index.ts` to upstream + 3-line invocation |
| `src/shapes/isometric-shape.ts` | EXTRACT | Move each of the 8 NextRack subclasses (`Polygon`, `Rectangle`, `Circle`, `Tube`, `Pipe`, `Duct`, `Channel`, `ProportionalRectangle`) to its own file; revert base file to upstream |
| `src/utils.ts` | PARTIAL | The 11 cleanly-added NextRack functions (icon SVG builders, style application, registry application, `raiseToFront`, `setGridOpacity`) were moved to new `src/nextrack-utils.ts`. Four original functions (`transformationMatrix`, `sortElements`, `drawGrid`, `switchView`) had their signatures and/or bodies modified in place and remain in `utils.ts` — reverting them would break callers, and rewriting them in a new file would risk creating near-clones of Covered Software (MPL §1.10(b)). `utils.ts` therefore stays as a modified MPL-2.0 file and must be published. |
| `src/shapes/index.ts` | PUBLISH | Registry barrel — replaced wholesale; no domain content |
| `src/theme.ts` | PUBLISH | 15 lines of constants; no domain content |
| `src/obstacles.ts` | PUBLISH | Grid obstacle detection with thin domain-y filters (`isFrame`, `isArea`, `componentRole`) |
| `src/shapes/link/link.ts` | PUBLISH | Link styling + custom vertex handle; no domain content |
| `src/tools/tools.ts` | PUBLISH | SVG markup templates with Carbon icons |
| `src/tools/size-tool.ts` | PUBLISH | `constrainAxis` resize logic inseparably interleaved |
| `src/tools/{index,proportional-size,center-based-height}.ts` | PUBLISH | Trivial import-path updates and cleanups |
| `src/svg.d.ts` | NO-OP | Unchanged from upstream |

Compliance for PUBLISH files: a copy of the source for those specific files will be made available alongside the SaaS app (e.g. a `/legal/mpl-sources.zip` link or a public mirror repository), together with the MPL-2.0 license text and an attribution to client IO. NextRack's own files (`src/component-store.ts`, `src/system-designer.ts`, `src/hardware-validator.ts`, `src/product-catalog.ts`, and the ~46 other NextRack creations) remain proprietary because they neither modify nor contain Covered Software — they only import the public API.

After extraction, `package.json` will be updated from `"license": "MPL-2.0"` to a NextRack-proprietary declaration with a separate notice covering the published MPL files.

## Considered Options

- **Maximum-clean extraction** — also extract the 7 PUBLISH-verdict files via subclass tricks (`AxisAwareSizeControl extends SizeControl`, `FilteringObstacles extends Obstacles`, etc.). *Rejected* because the remaining mods are generic diagram plumbing with no NextRack business secret, and the extra inheritance layers exist purely for license reasons — they obscure the code without giving meaningful protection.
- **Buy a commercial JointJS license from client IO** — relicenses both `@joint/core` and the demo files, removing all MPL obligations. *Not selected now* because the pragmatic strategy is sufficient for SaaS distribution and avoids recurring license fees; can be revisited if NextRack ever wants to redistribute source closed-form or partner-embed the library.
- **Clean-room rewrite of all 13 files** — re-implement without reference to upstream. *Rejected* because `isometric-shape.ts` and `utils.ts` together represent ~1300 lines of working code, the rewrite cost is high, and clean-room provenance is hard to defend without a separate uninvolved team.
- **Don't distribute (keep purely internal)** — MPL §3 only triggers on distribution. *Not applicable* — NextRack is a commercial SaaS product.

## Consequences

- One-time refactor cost of approximately 3 working days for the EXTRACT files.
- The repository will contain a clear split: `src/boot.ts`, `src/nextrack-utils.ts`, and `src/shapes/<shape>.ts` files own NextRack code; the reverted Original files own MPL upstream code; the PUBLISH files remain MPL-2.0 hybrids.
- A small ongoing compliance task: when `@joint/core` is upgraded, the reverted Original files may need to be re-synced with upstream changes, and the PUBLISH files re-diffed.
- New files must not copy code from MPL files — only import the public API. Subclassing is fine; copy-pasting a private helper is not.
- The `pre-mpl-extract` rollback point is tagged `mpl-rollback-2026-05-29` so the entire strategy can be reverted if it proves unworkable.
