# ADR 0002 — Rename legacy form-factor shapes

Date: 2026-05-22
Status: Accepted

## Context

The `src/shapes/` directory grew from the original JointJS isometric example, which shipped six sample shape classes representing concrete equipment types: `Computer`, `Database`, `Firewall`, `Switch`, `Router`, `KubernetesWorkerNode`. Each was a thin subclass of one of three actual geometric primitives — cuboid, cylinder, or octagon — that added nothing structural beyond a registry entry and a custom SVG label.

As the editor evolved into a base-shape-driven Component Designer (`baseShape: 'cuboid' | 'cylinder' | 'octagon' | 'pyramid' | 'tube' | 'duct' | 'custom'`), these sample classes accumulated two distinct roles:

1. **Computer and Database silently became load-bearing.** `complex-component.ts:makeProxy` uses `new Computer()` as the canonical renderer for `baseShape === 'cuboid'`, and `new Database()` for `'cylinder'`. `shape-factories.ts:FORM_FACTOR_PREVIEWS` does the same. The class name `Computer` no longer described what the class did — it was the cuboid renderer wearing a sample-shape name.
2. **Firewall, Switch, Router, KubernetesWorkerNode are not used.** They are not exposed in the base-shape dropdown, not in the palette (they sit in `BUILT_IN_DEFAULTS` which is documented as "registry entries that legacy code paths may look up by id, but they are NOT exposed in the palette"), and not referenced by any active rendering path. Each is a method-forwarding stub.

The mismatch caused concrete confusion: the user reading `computer.svg` and `firewall.svg` side-by-side reasonably concluded both were legacy demo content, when in fact one is the active cuboid template and the other is dead code.

A separate but related bug (B1 in the chamfer-quality grilling session) traces to `computer.svg`: its calc-path dependency arrays omit `chamferBottomSize` and `chamferBottomStart`, so bottom-chamfer mutations don't trigger a re-render. Three other SVG templates (`switch.svg`, `firewall.svg`) carry the same gap by copy-paste. Fixing the gap in `computer.svg` while leaving the misleading name in place would have made the file harder to find next time.

## Decision

**Rename the two load-bearing classes; delete the four unused ones.**

| Action | From | To |
|---|---|---|
| Rename | `src/shapes/computer/computer.{ts,svg}`, class `Computer` | `src/shapes/cuboid/cuboid.{ts,svg}`, class `Cuboid` |
| Rename | `src/shapes/database/database.{ts,svg}`, class `Database` | `src/shapes/cylinder/cylinder.{ts,svg}`, class `Cylinder` |
| Delete | `src/shapes/firewall/`, `switch/`, `router/`, `kubernetes-worker-node/` | — |

Bundle the B1 dependency-array fix into the same change — while editing `cuboid.svg`, add `chamferBottomSize, chamferBottomStart, shapeRotation` to all path-method dep arrays, and change the iso base face's calc from `baseCuboidPath` to `baseCuboidPathIso`. Same single-file edit in `complex-component.ts:146`.

`BUILT_IN_DEFAULTS` keeps the two surviving entries (renamed to `'cuboid'` and `'cylinder'`) because `Cuboid` and `Cylinder` read from the registry at module-init to compute their default size and depth. The legacy `displayName` and `componentType` fields on those two entries are stripped — they're no longer sample components, they're pure form-factor renderers. `BUILT_IN_SHAPE_IDS` (the filter Set) shrinks accordingly; existing filter call-sites remain correct.

### No data migration

The user confirmed no backwards compatibility is required. Any saved data referencing legacy shape IDs (`computer`, `database`, `firewall`, etc.) or class names will fail to load. This is acceptable because the saved data in question is from the personal-project's pre-MVP experimentation.

## Alternatives considered

- **Keep everything; just fix B1 in place.** Smallest possible change, but leaves the naming trap that prompted the cleanup (next time someone touches the cuboid template they will read it as "the computer template" and look elsewhere for the cuboid renderer).
- **Soft-deprecate via alias.** Export `Computer = Cuboid` and `Database = Cylinder` for one release. Rejected per project convention in `CLAUDE.md`: "do not add backwards-compatibility shims when you can just change the code." Adds vocabulary that has to be explained and eventually removed.
- **Inline defaults into the Cuboid/Cylinder constructors and delete BUILT_IN_DEFAULTS entirely.** Cleaner end-state, but cascades into 6+ additional filter-call-sites and `BUILT_IN_SHAPE_IDS` semantics. Out of scope for this cleanup; can be a follow-up if the registry mechanism turns out to be vestigial.

## Consequences

**Positive**

- The file you open to edit cuboid geometry is named `cuboid.svg`. Discoverability matches the domain language already established in `CONTEXT.md` (`Shape`, `Component`) and in the base-shape dropdown.
- B1 fix lands in the same commit as the rename, so the file-history reader sees one coherent change ("rename + fix bug surfaced by the rename") rather than two unrelated ones.
- 4 unused shape folders deleted (8 files + their registry entries + their factory entries + their `instanceof` checks).
- The "this looks like demo content" confusion that triggered this ADR is closed.

**Negative**

- Touches 12 files in one commit (4 new, 4 modified, 4 folders deleted). Larger than the "medium task: up to 5 files" guidance in `CLAUDE.md`, but the larger scope is the cleanup itself, not unrelated work creeping in.
- Any pre-existing saved diagram that references the legacy shape IDs or class names will fail to load. Accepted (see "No data migration").

**Open follow-ups**

- The remaining four cuboid-template-pattern SVGs that are now legitimate (only `cuboid.svg` survives; nothing inherits the pattern) don't need a shared dep-list yet. If a second cuboid-derived shape gets added, revisit whether the calc-deps list should be centralised.
- Several other shape folders (`hexagonal/`, `hexahedron/`, `active-directory/`, `user/`, `frame/`, `grid-label/`, `icon/`, `double-arrow/`, `area/`) are not in the base-shape dropdown and may also be dead weight. Out of scope for this ADR.
- The dependency-array gap exists in `octagon.svg` and `svg-polygon.svg` too (`chamferBottomSize`, `chamferBottomStart` missing). Those are not load-bearing for B1's reported symptom (cuboid) but should be fixed as part of the broader chamfer-quality work.
