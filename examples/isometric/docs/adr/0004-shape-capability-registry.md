# ADR 0004 — Shape capability registry

Date: 2026-05-24
Status: Accepted — supersedes ADR-0003

## Context

ADR-0003 placed modifier capability on each form-factor `IsometricShape` subclass via a `supportedModifiers()` method, on the principle that "the shape owns what it can do." Six months of live use surfaced two friction points:

1. **Adding a new modifier touches every shape class.** A new `ModifierKey` requires updating `CuboidShape`, `CylinderShape`, `Octagon`, `SvgPolygonShape` plus the `IsometricShape` default — even when the new modifier obviously applies to a whole *category* (e.g. "all polygonal shapes"). The fact that octagon and cuboid both extend `PolygonShape` is visible in the class hierarchy but not in the capability story; each leaf has to repeat the list.

2. **Dimension-behaviour rules grew elsewhere.** `requiresSquareBase()`, `TUBE_FAMILY`, `ROTATED_FORMS`, `BASE_SHAPE_LABELS`, the `isTube ? 'Length' : 'Dimension X'` ternary in the panel builder, the `dimYAdjustable` flag — all separate code paths in `component-designer.ts`, each making its own per-shape decision. The "capability" story was split across two surfaces (modifiers on the shape, dimensions in the UI) with no shared shape.

The result is what the project user described as "fixing many files whenever a new modifier is added."

## Decision

**A single capability registry at `src/shapes/shape-capabilities.ts` owns all per-`BaseShape` UI-relevant capability.**

The registry has four pieces:

1. **Categories** — `polygonal`, `radial`, `tubeLike`, `custom`. Each base shape maps to one category in `SHAPE_CATEGORY`.
2. **Baseline modifiers per category** in `CATEGORY_MODIFIERS`. The polygonal category supports the full modifier set; radial supports only top-scaling; tubeLike supports none; custom mirrors polygonal.
3. **Per-shape exclusions** in `SHAPE_EXCLUDES`, with matching tooltip strings in `UNSUPPORTED_REASONS`. Today: octagon excludes shed-roof (8 vertices).
4. **Layer-aware predicates** in `LAYER_PREDICATES`. The custom-shape shed-roof case (only active when `normalizedVerts.length === 4`) is expressed as a predicate function — the predicate runs after the category/exclusion lookup and can subtract further.

Helpers exposed:

- `getSupportedModifiers(baseShape, layer?): Set<ModifierKey>`
- `supportsModifier(baseShape, modifier, layer?): boolean`
- `getUnsupportedReason(baseShape, modifier): string | null` — short user-facing strings for tooltips on hidden controls (UI consumer-ready).
- `dimensionsFor(baseShape): { x, y, z }` — labels + read-only flags. `z = null` means the dimension is not exposed at all (tube-family depth is derived from diameter).
- `requiresSquareBase(baseShape)`, `isRotatedForm(baseShape)`, `isTubeFamily(baseShape)` — focused predicates the panel code uses.

The `supportedModifiers()` instance method on every `IsometricShape` subclass is removed. UI code consults the registry, not the shape instance.

## Alternatives considered

- **Keep ADR-0003 as-is** (per-class method). Rejected for the reasons in Context — friction has accumulated and is concrete.
- **Pure flat per-shape table.** No categories, just `Record<BaseShape, Set<ModifierKey>>`. Simpler at first but duplicates the same list across all polygonal shapes — same "touch many places" problem at a different layer.
- **Generated registry from class metadata.** Add a `@modifierSupport(...)` decorator that populates a runtime registry from each class file. More magic, no readability gain over a hand-written table this small, and it brings drift back in by another door (the decorator must stay in sync with the geometry the class actually renders).

## Consequences

**Positive**

- Adding a modifier: edit the `ModifierKey` type plus one or more `CATEGORY_MODIFIERS` entries — typically two lines, in one file.
- Adding a new shape: register it in `SHAPE_CATEGORY` and (if it doesn't fit a category cleanly) in `SHAPE_EXCLUDES` or `LAYER_PREDICATES`. No UI file changes.
- Capability + dimension rules live next to each other. The "what is this shape capable of in the panel" story is readable from one ~150-line file.
- Tooltip strings for hidden controls are wired in from day one (`getUnsupportedReason`) — the future picker UI can use them directly.

**Negative**

- The registry is a hand-written table — it can drift from what the shape's render code actually honours. Mitigations: keep the table small (we have 4 categories), document each exclusion with a `// Reason:` comment, and let the user's next "this knob does nothing" report drive a fix.
- ADR-0003's contract (each shape declares its own capability) was a deliberate design point; reversing it changes how new shape authors are expected to onboard. The header comment in `shape-capabilities.ts` explains the new flow.

**Migration**

- ADR-0003 → Status: Superseded.
- `supportedModifiers()` and `ModifierKey` overrides removed from all `IsometricShape` subclasses; `ModifierKey` type itself stays (it's the registry's vocabulary).
- `requiresSquareBase()` in `component-designer.ts` re-exports from the registry — same name, same signature.
- `TUBE_FAMILY` and `ROTATED_FORMS` constants in `component-designer.ts` replaced by `isTubeFamily()` / `isRotatedForm()` calls.

## Open follow-ups

- The capability table only covers modifiers + dimensions. A future picker UI (still planned per ADR-0003) will read the same `getSupportedModifiers` + `getUnsupportedReason` — no new infrastructure needed.
- `dimYAdjustable` on `ShapeDefinition` is a per-shape *user* setting (not a category fact) and stays on the data model, not in the registry.
