# ADR 0003 — Modifier capability lives on the shape

Date: 2026-05-22
Status: Superseded by ADR-0004 (2026-05-24)

## Context

The Component Designer's modifier section currently shows every modifier input (corner radius, top/bottom chamfer + heights, taper, twist, scale-top X/Y, shed-roof + direction) for every base shape, with a small deny-list (`HIDDEN_MODIFIERS` in `component-designer.ts:4001`) hiding a few combinations that are known to be useless. The deny-list is incomplete and skews towards "broken-by-luck rather than broken-on-purpose":

- Cylinder shows a chamfer slider that does nothing — the cylinder SVG template has no chamfer-aware paths (phantom B2-family).
- Octagon shows a shed-roof slider — `shedRoofDrops()` returns `[0,…]` for any polygon with `n !== 4`, so nothing happens (phantom B2).
- A custom (SVG-polygon) shape with ≥5 anchors shows a working-looking shed-roof slider that silently no-ops, because the same `n !== 4` gate fires (phantom B5).

The user reported these as "fragile and random" — the underlying renderer doesn't honour the input, but the input looks live and editable. There's no single source of truth for "what can this shape actually do?" The deny-list lives on the UI side, the renderer is silent about what it ignores, and the two drift.

A separate forward-looking goal compounds the question: the modifier section will be redesigned to mirror the icon section — an empty section with a `+` button in the header that opens a picker. Only modifiers compatible with the current shape should appear in the picker. Both the current (always-on inputs) and future (picker) UIs need to ask the same question.

## Decision

**Each `IsometricShape` form-factor subclass declares its supported modifiers via a method `supportedModifiers(): Set<ModifierKey>`.** The UI is a consumer; the renderer is the authority.

```typescript
type ModifierKey =
    | 'cornerRadius' | 'chamfer' | 'chamferHeight' | 'chamferBottom' | 'chamferBottomHeight'
    | 'taper' | 'twist' | 'scaleTopX' | 'scaleTopY'
    | 'shedRoof' | 'shedRoofDir';

// On IsometricShape (default: no modifiers — utility shapes don't need any)
supportedModifiers(): Set<ModifierKey> { return new Set(); }

// Overridden on each form-factor class
```

Form-factor capabilities (current state of each class's actual rendering):

| Class | Supports |
|---|---|
| `Cuboid` (`CuboidShape`) | all 11 |
| `Cylinder` | `taper`, `scaleTopX`, `scaleTopY` only — no corners/chamfer/shed-roof; no twist on a round body |
| `Octagon` | all except `shedRoof` + `shedRoofDir` (n=8, `shedRoofDrops` returns zeroes) |
| `Pyramid` | none today — the pyramid template has no modifier wiring |
| `Tube`, `Pipe`, `Duct`, `Channel` | none — tube-family templates have no modifier paths |
| `SvgPolygonShape` (custom) | all 11 when `normalizedVerts.length === 4`; all except `shedRoof` + `shedRoofDir` otherwise — layer-aware |

The modifier panel's current `syncModifierVisibility` becomes a single read of `layerShapes[selectedLayerIndex].supportedModifiers()` to decide which `[data-modifier]` rows are hidden. The legacy `HIDDEN_MODIFIERS` deny-list is removed.

### Future picker UI (planned, not implemented yet)

When the modifier section is rebuilt as `header + button` → picker dialog, the picker will:

1. Read `currentShape.supportedModifiers()`.
2. Subtract modifiers already applied to the layer.
3. Show the remaining set as picker options.
4. On selection, add the chosen modifier to the layer with sensible defaults.

No new infrastructure required at the capability layer — same method, same return shape.

## Alternatives considered

- **(a) Capability table in UI.** Extend `MODIFIER_DEFAULTS` into a complete `BASE_SHAPE_CAPABILITIES` map: per base shape, which modifiers are supported. Rejected because the custom-shape case (n≥5) needs layer-aware logic, the table forces a second update site every time a renderer changes, and it puts the source of truth far from the code that implements (or fails to implement) the modifier. The current `HIDDEN_MODIFIERS` is exactly this pattern and it has drifted.

- **(c) Hard-code guards per case.** A handful of explicit `if` branches in `syncModifierVisibility` for the known broken cases. Pragmatic and the smallest diff today, but the same pattern that produced the current bug — leaves drift as an emergent problem the next time someone changes a renderer.

## Consequences

**Positive**

- Single source of truth for modifier capability. Both the current fixed panel and the future picker call the same method.
- Capability lives next to the rendering code that implements (or doesn't implement) the modifier. Drift between "claims to support" and "actually renders" is mechanically harder.
- Layer-aware capability (custom shape n≥5) is expressed in the natural place: the shape instance reads its own state.
- Phantom-control bugs (cylinder chamfer, octagon shed-roof, custom-shape shed-roof at n≥5) close as a class — the inputs simply don't appear when the renderer can't honour them.

**Negative**

- Every form-factor class now has a `supportedModifiers()` method. Bureaucracy when adding a new shape, but the kind that surfaces drift (forgetting = empty Set = invisible inputs = obvious during dev) rather than hiding it.
- The default implementation on `IsometricShape` returns an empty Set, so a new form-factor class that forgets to override gets no modifiers in the UI. Discoverable (the user sees nothing), but not a compile error.

**Open follow-ups**

- The future picker UI is not built yet — this ADR commits to the capability layer that the picker will consume, but the picker itself is a separate piece of work.
- `Pyramid` is declared as supporting no modifiers because its template has no modifier wiring; if pyramid modifiers are added later, the method updates alongside the template.
- The ModifierKey vocabulary (`chamfer` + `chamferHeight` as separate keys, etc.) is preserved as-is. Consolidation (e.g. merging the two chamfer keys into a single capability) is deferred — it's a UX decision for the picker design, easier to merge later than split.
