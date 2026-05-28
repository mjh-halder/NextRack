---
id: 0004
title: Multilayer Component Authoring — Main-Icon Invariant and 2D Rendering Parity
status: done
created: 2026-05-27
labels: [component-designer, system-designer, complex-component, multilayer, icons, rendering]
---

# PRD 0004 — Multilayer Component Authoring: Main-Icon Invariant and 2D Rendering Parity

## Problem Statement

As a NextRack user authoring multilayer Components in the Component Designer
and placing them in the System Designer, I want the Shape's identity icon —
the **Main IconEntry** — to remain the single visual ground truth across
every authoring action: layer duplication, layer creation, icon removal, and
the iso/2D view switch. Today, several authoring paths quietly violate that
invariant and produce broken visuals:

- Duplicating a Layer that contains the Main icon creates a second Layer
  whose icon **also** carries the `isMain` flag — the Shape suddenly has two
  Main icons, both rendered in 2D, both stamped with the **Main** tag in the
  Icon list.
- Adding a new Layer to a multilayer Shape forces an IconEntry on it
  whether the user wants one or not. The Component Designer's `+` button on
  the new Layer is therefore the only escape, and any icon a user does add
  to a non-main Layer is shown with a non-functional minus button.
- The shape-wide Main icon's minus button is disabled (greyed out) rather
  than hidden — users repeatedly try to click it, expecting it to work.
- In the System Designer, multilayer Shapes in 2D view render every Layer's
  IconEntry stacked on top of each other AND apply each Layer's per-icon
  offset to the 2D position. The result is two or more icons spread out
  sideways in 2D — wrong against the design rule "2D = one main icon,
  centred".
- Selecting a multilayer Component in 2D shows the selection outline,
  hover-brightness ring, and ports of the hidden secondary Layer too,
  because the iso-Layer's `<g>` still occupies the same model bounds even
  when not painted.
- A Shape with asymmetric Layer offsets (e.g. Layer 0 at `offsetX=0`,
  Layer 1 at `offsetX=40`) renders the Layer cluster shifted sideways from
  the element bbox centre in iso, but the 2D icon — which renders at the
  bbox centre — stays put. iso and 2D therefore disagree visually about
  where "the Shape" is.
- Components live exclusively in the browser's localStorage. Clearing site
  data wipes every user-authored Shape — only the in-code seed (`HSM
  Appliance`) survives. There is no off-browser backup path.

## Solution

Re-establish the **shape-wide Main-Icon invariant** ("exactly one Main icon
per Shape, never deletable") as a hard rule across every authoring path,
and align the 2D rendering of multilayer Shapes — in both designers — to
the rule "**2D = exactly one main icon, centred on the element's bbox**".

Concretely:

- **Layer duplication** deep-clones the source Layer's IconEntries with
  fresh ids, and strips `isMain` from every entry on the copy. Only the
  original Layer continues to own the Shape's Main icon.
- **New Layers** are created without any IconEntries — `defaultShapeLayer`
  already returned `icons: []`, but the authoring path is now strict about
  honouring that: a freshly added Layer has zero icons until the user
  presses `+` on its Icon list. Adding an icon there still defaults the
  glyph to `cube` so a freshly created entry is never empty.
- The **minus button** is rendered for every non-Main IconEntry, with no
  enabled/disabled state distinction. The Main IconEntry gets **no minus
  button** at all — its presence in the list, with the **Main** tag,
  signals "protected" without offering a control that can't be used.
- A second delete affordance lives in the Icon Editor popup header: a red
  trash-can next to the close `X`, visible only when the open entry is
  not Main.
- **Multilayer 2D rendering**: only the Main icon paints into the 2D
  group. The composite SVG used for the 2D `<image>` is built through
  `icon2DHref` — vendor presets and per-IconEntry tint settings apply,
  but the per-Layer `offsetX/Y` and per-Icon `offsetX/Y` are ignored.
  Secondary Layers' DOM is emptied entirely in 2D — no faces, no icons,
  no hit area — so hover, ports, and selection geometry collapse to the
  visible 40×40 cell.
- **Asymmetric Layer offsets** are compensated at render time: the Layer
  union bbox's centre (in Shape coords) is subtracted from each Layer's
  offset before placing it. iso shows the cluster centred inside the
  element bbox; 2D shows the Main icon centred on the same element bbox.
  iso and 2D therefore agree where "the Shape" is regardless of how
  lopsided the offset distribution is. Single-Layer Shapes preserve the
  raw `offsetX/Y` value (typing `40` in the inspector still means "shift
  this one Layer 40 px") because there is no union to compensate.
- **Persistence**: the Admin → Component Library view gains a **Backup &
  Restore** block with **Export (JSON)**, **Import (JSON)** and **Export
  as code** actions. The JSON path is the everyday backup for users; the
  "Export as code" path produces a TypeScript snippet (`SEEDED_USER_SHAPES`
  record + `seedUserShapesFromCode()`) to paste into a project-local seed
  file, so committed Shapes survive every browser-side reset.
- **Migration on load**: `loadShapeIntoCanvas` normalises legacy Shapes
  whose registry entries carry multiple `isMain: true` (from the old
  duplicate path) — keep the first, clear the rest. The fix is silent
  and idempotent.

## User Stories

1. As a Component Designer user, I want a duplicated Layer's icons to lose the `isMain` flag, so that my Shape never accidentally ends up with two Main icons.
2. As a Component Designer user, I want each IconEntry on a duplicated Layer to have a fresh stable id, so that subsequent edits target the right entry instead of mutating both the source and the copy.
3. As a Component Designer user, I want a newly added Layer to start with **zero** IconEntries, so that I'm not forced to delete an unwanted default icon every time I extend a Shape.
4. As a Component Designer user, I want the `+` button on a Layer's Icon list to seed a new entry with the Cube glyph, so that a freshly added IconEntry is never an empty placeholder.
5. As a Component Designer user, I want the Main IconEntry to render with the **Main** tag and **no minus button**, so that I never see a non-functional disabled control on the protected entry.
6. As a Component Designer user, I want every non-Main IconEntry to render a working minus button on its row, so that I can freely remove decorations from any Layer.
7. As a Component Designer user, I want the Icon Editor popup to expose a red trash-can next to its close button for non-Main entries, so that I can scrap an icon I'm editing without first closing the popup.
8. As a Component Designer user, I want the trash-can to be hidden when the popup is open on the Main IconEntry, so that the popup remains consistent with the list-row rule.
9. As a Component Designer user, I want my Shape's 2D preview to show exactly one icon — the Main one — centred on the canvas, so that the 2D representation gives a single clear recognition surface regardless of how many Layers the Shape has.
10. As a Component Designer user, I want per-Layer `offsetX/Y` to **not** affect the 2D preview, so that pushing Layer 1 sideways in iso doesn't drag the 2D icon away from centre.
11. As a Component Designer user, I want per-IconEntry `offsetX/Y` to **not** affect the 2D preview either, so that an iso-only stylistic offset stays iso-only.
12. As a Component Designer user, I want my iso preview to keep the multilayer cluster centred inside the canvas even when one Layer is offset sideways, so that the Shape doesn't drift outside the canvas centre region as I tweak offsets.
13. As a System Designer user, I want a placed multilayer Component to render a single 40×40 Main icon in 2D view, so that my 2D plan is readable and consistent with how single-layer Components render.
14. As a System Designer user, I want the iso and 2D renderings of a placed multilayer Component to agree on where the Shape's centre is, so that switching views doesn't shift my mental model of the layout.
15. As a System Designer user, I want the selection outline of a placed multilayer Component in 2D to hug the visible 40×40 icon, so that the outline doesn't leak out over the area the secondary Layer used to occupy in iso.
16. As a System Designer user, I want hover-brightness on a placed multilayer Component in 2D to highlight only the visible icon, so that the secondary Layer doesn't ghost into the hover effect.
17. As a System Designer user, I want connection ports on a placed multilayer Component in 2D to appear at the four edges of the visible icon, so that I can connect to the right place regardless of which Layer of the Shape used to extend the bbox in iso.
18. As a System Designer user, I want the secondary Layer's hit area to be entirely inert in 2D, so that clicking next to the visible icon doesn't accidentally select the Component.
19. As a Component Designer user, I want a Shape with asymmetric Layer offsets to look identical in CD and SD, so that what I author is what gets placed.
20. As a Component Designer user, I want offsetX/Y on a single-Layer Shape to behave exactly as before (typing `40` shifts the one Layer 40 px), so that the new multilayer compensation doesn't break the simple-shape authoring workflow.
21. As a NextRack user opening an old Shape from before this PRD, I want any orphan `isMain` flags on secondary Layers to be cleared automatically on load, so that legacy data heals itself without needing a manual migration step.
22. As a NextRack user opening an old Shape, I want my deliberate Main icon to survive that normalisation, so that the first `isMain: true` in storage stays Main.
23. As a NextRack user, I want an **Export (JSON)** button in Admin → Component Library that downloads every user-authored Shape, so that I can back up my work before clearing site data.
24. As a NextRack user, I want the JSON export filename to include a timestamp, so that successive exports don't overwrite each other on disk.
25. As a NextRack user, I want an **Import (JSON)** button that lets me upload an export file and restores every Shape into the registry, so that I can recover my work after a localStorage clear or move to a new machine/browser.
26. As a NextRack user, I want the Import action to warn me before overwriting a Shape whose id already exists, so that I can keep working alongside a partial restore.
27. As a NextRack user, I want the Import action to skip built-in IDs (e.g. `hsm`) so that the seeded baseline cannot be silently shadowed by an old export.
28. As a NextRack user, I want the Import action to show a summary message (`Imported N, skipped M`) so that I can immediately tell whether the restore did what I expected.
29. As a developer who uses NextRack heavily, I want an **Export as code** button that produces a TypeScript snippet of my Shapes, so that I can commit them to a project seed file and have them survive every localStorage clear.
30. As a developer, I want the generated seed snippet to expose a `seedUserShapesFromCode()` function that idempotently adds each Shape only when the registry doesn't already have it, so that re-running the seed never clobbers later user edits.
31. As a Component Designer user, I want the export buttons to be disabled when I have zero user Shapes, so that I'm not tempted to download an empty backup file.
32. As a NextRack user, I want the Import action to be available regardless of how many user Shapes I currently have, so that I can restore a backup into a freshly cleared installation.

## Implementation Decisions

### Module shape

- **`shapes/complex-component`** owns the multilayer rendering decisions:
  - `ComplexComponentView.rebuildLayers` is the single render entry point.
    It listens for `change:layers change:size change:isometricHeight
    change:simplified2D change:viewMode` and rebuilds both `layers2D` and
    `layersISO` from scratch on every call.
  - In 2D mode the iso group is emptied (`replaceChildren()`), and
    `display: none` + `pointer-events: none` are also set on it as a
    belt-and-braces against any stale geometry. Symmetric in iso mode.
  - The 2D group contains exactly one `<image>` element — the Main icon
    via `icon2DHref` — at `((modelW - 40) / 2, (modelH - 40) / 2)`. No
    per-layer offset, no per-icon offset, no oversize bleed past the
    cell.
  - `findMainIcon(layers)` returns the explicit `isMain: true` entry, or
    falls back to the first entry that has an `href`. Used by the 2D
    path.
  - `shapeBboxCentre(layers)` is the deep, testable geometry primitive:
    given a Layer array, return the centre of the floor-layer union
    bbox. The iso path calls it through `layerOriginIso` and subtracts
    it from each Layer's `offsetX/Y` before placing the Layer. Single-
    layer Shapes skip the compensation (no union → no skew).

- **`component-designer.renderLayersOnCanvas`** mirrors the same
  centring math via a local `layerUnionCentre` helper. The two
  implementations are kept in sync deliberately — the alternative
  (sharing one helper across the package) was rejected as
  premature given the helper's tiny surface and the different
  ShapeLayer accessors each call site already uses.

- **`component-designer.recenterCompositeShape`** previously subtracted
  `layer.offsetX/Y` from both iso AND 2D positions when computing the
  visual bbox. The 2D branch now subtracts zero — the 2D paper already
  ignores `offsetX/Y` at placement time, so the compensation was a
  phantom that pushed multilayer Shapes sideways.

- **`component-designer.onDuplicateLayer`** deep-clones `icons` via
  `source.icons.map(ie => ({ ...ie, id: <fresh>, isMain: false }))`.
  This solves two latent bugs at once: aliased icon arrays (shallow
  spread shared the `icons` reference between source and copy) and
  multi-Main violations.

- **`component-designer.onAddLayer`** stays as-is — it already builds
  the new Layer via `defaultShapeLayer({ ... })` which provides
  `icons: []`. The PRD just declares that behaviour load-bearing.

- **`component-designer.loadShapeIntoCanvas`** runs an `isMain`
  normalisation pass after cloning the saved Layer array: scan every
  IconEntry, keep the first `isMain: true`, clear the rest. Heals
  legacy data on the fly.

- **CD icon-list (`renderIconsList`)** drops the
  `iconEntries.length > 1` gate around the remove button. The button is
  now rendered iff `!entry.isMain`. The disabled state is gone — Main
  shows no button at all.

- **CD icon-editor popup header** gains a red `TrashCan16` button next
  to the close `X`, conditional on `!entry.isMain`. Click handler
  delegates to `removeIcon(entry.id)` then closes the popup.

- **Admin → Component Library** gains a `Backup & Restore` block
  rendered at the top of the view. Three actions:
  - **Export N components (JSON)** — serialises every non-built-in
    `ShapeRegistry` entry into a `{ version: 1, exportedAt, shapes }`
    envelope and triggers a Blob download.
  - **Import (JSON)** — file-input picks a JSON; the parser accepts
    either the envelope shape (`parsed.shapes`) or a raw
    `Record<string, ShapeDefinition>`. Each entry routes through
    `addShape()` so the existing tombstone-clear behaviour kicks in.
    Built-in IDs are silently skipped. Existing IDs prompt `confirm()`
    to overwrite.
  - **Export as code** — generates a self-contained TS module
    (`SEEDED_USER_SHAPES` record + `seedUserShapesFromCode()` function)
    and shows it in a copy-to-clipboard textarea. The function
    idempotency-gates on `ShapeRegistry[id]` so re-running the seed
    never clobbers later user changes.

### Schema / Token

No new persistence keys. No new ShapeDefinition fields. The `isMain`
flag on `IconEntry` already existed; this PRD just enforces its
single-Main invariant across every authoring path and lets non-Main
layers have zero icons. Single-layer Shapes still seed the default
Main IconEntry on create — that part of the original "main icon
invariant" memory stands unchanged.

### Geometry decision — centring math

The decision that unblocked iso/2D parity, distilled from the diagnosis
arc rather than from a prototype:

```text
Single-layer:
  layerOrigin(layer) = (bx - w/2 + offsetX, by - h/2 + offsetY)
  // user-typed offset means "shift this layer by N px" — preserve verbatim

Multi-layer:
  bbox = unionCentreOfFloorLayers(layers)   // shape-coords, may be ≠ (0,0)
  layerOrigin(layer) = (bx - w/2 + (offsetX - bbox.x),
                        by - h/2 + (offsetY - bbox.y))
  // compensate so the cluster centres on the element bbox no matter
  // how lopsided the offsets are
```

The 2D path bypasses `offsetX/Y` entirely and centres a single 40×40
`<image>` at `((modelW - 40)/2, (modelH - 40)/2)`. iso and 2D agree on
"the Shape's centre" because the iso compensation lands the union at
the same point.

### Backward compatibility

- Shapes saved before the duplicate-isMain fix may carry multiple
  `isMain: true` entries. `loadShapeIntoCanvas` heals them silently on
  load. No migration step is required.
- The previous Main icon's disabled minus button is gone; users
  expecting it should now see no button at all. The list still shows
  the **Main** tag and the row is still left-clickable to open the
  editor.
- `Export (JSON)` exports a versioned envelope. `Import (JSON)`
  accepts the envelope **and** legacy raw `Record<string,
  ShapeDefinition>` shape so an export from any future bump remains
  re-importable.
- Built-in IDs (`hsm` at the time of writing) are never overwritten by
  Import. A seeded Shape edited by the user — same id — goes through
  the standard overwrite-confirm flow.

## Testing Decisions

### What makes a good test here

A good test exercises the **external invariants** of the multilayer
authoring rules:

- After `onDuplicateLayer`, the duplicated Layer's `icons` has its own
  identity (different array reference, different `id`s) and every
  entry has `isMain === false`.
- After `loadShapeIntoCanvas` on a Shape with multiple `isMain: true`,
  exactly one entry in `layers` retains `isMain: true` and that entry
  is the first one in document order.
- `shapeBboxCentre(layers)` returns `(0, 0)` for any single Layer or
  for Layers arranged symmetrically around the origin; for an
  asymmetric arrangement it returns the geometric midpoint of the
  floor-layer union.
- `addShape` followed by `Export as JSON` round-trips through
  `Import as JSON` produces an identical registry entry.

Tests should NOT assert on:

- The exact DOM structure of the `layers2D` / `layersISO` groups (the
  rendering is imperative and may change as we extract a renderer
  module).
- The specific filename produced by Export (timestamp varies).
- The order of inputs in the Backup & Restore button row.
- The exact styling of the disabled-vs-hidden state — that's a UI
  decision tested by visual inspection.

### Modules to test

- **`shapeBboxCentre` (in complex-component)** — pure function over
  `ShapeLayer[]`. Trivial to fixture-drive with synthetic layers.
- **`layerUnionCentre` (in component-designer)** — same shape, same
  test pattern; the two helpers are intentionally duplicated and the
  tests document the cross-designer agreement.
- **`onDuplicateLayer` invariants** — pre-call snapshot vs post-call
  state assertion. Set up a `layers` array with `isMain: true` on the
  source, invoke, assert.
- **Load-time `isMain` normalisation** — give `loadShapeIntoCanvas`
  a registry entry with multi-Main and assert post-load
  `layers.flatMap(l => l.icons).filter(e => e.isMain).length === 1`.
- **Export → Import round-trip** — write a fixture registry, call
  the JSON serialiser, feed it back through the import parser,
  assert the registry equals the original modulo built-ins.

UI rendering paths (the popup trash-can, the list-row minus button,
the Backup & Restore section) are shallow glue and are easier to
verify visually in the app.

### Prior art

PRD 0001 introduced Vitest in this repo with
`src/color-derivation.test.ts` as the reference. PRD 0003 added
`shape-store` user-folder tests in the same style: ESM, Node
environment, fixture-driven, `expect`-based assertions on pure
function output, no jsdom. The new tests follow the same pattern —
single-purpose `.test.ts` files next to the module under test, all of
the assertions on pure-function output, none on DOM state.

## Out of Scope

- **A general "main element" concept** beyond Components. The
  IsMain invariant is per-Shape only. Areas, Labels, DoubleArrows
  are untouched.
- **Layer-level reorder and Layer styling rules.** The duplicate fix
  is about icons only; layer-order semantics stay as they were.
- **Per-Icon 2D rendering knobs** — the 2D view is deliberately
  vendor-only and per-IconEntry overrides (background, opacity)
  apply via `icon2DHref` settings, not via per-Shape configuration.
- **Backwards-compatible Shape export across major versions.** The
  envelope is `version: 1`; later schema changes will bump and emit a
  migration shim then.
- **A backend Shape sync.** Phase V2 / Next.js work covers cross-
  device persistence; this PRD stays MVP-local.
- **Sharing exported Shapes between users.** The JSON is a local
  backup file — no schema for "shared via URL".
- **Layer-level metadata** beyond what `ShapeLayer` already carries.
- **Re-ordering of `iconEntries` from outside the Component Designer.**

## Further Notes

- The user-facing rule "Shape has exactly one Main icon" continues
  to apply at Shape creation time too: `onCreateShape` still seeds
  Layer 0 with a single IconEntry where `isMain: true, iconId:
  'cube'`. The PRD does not change that path.
- The "Main icon cannot be removed" rule combined with "new Layers
  start iconless" means that a multilayer Shape always has its Main
  icon on its FIRST Layer in practice — but the code does not assume
  this. `findMainIcon` scans every Layer's `icons` so a Shape whose
  Main has been moved to a later Layer (via a future "make main"
  context-menu action) keeps working.
- The "Export as code" output deliberately writes through `addShape`
  rather than mutating the `ShapeRegistry` object directly, so the
  generated seed inherits the same tombstone-clear semantics as the
  Component Designer's create path.
- The compensation math in `shapeBboxCentre` only considers floor
  layers (`baseElevation === 0`) when at least one exists, falling
  back to all layers otherwise. This matches the `getHitArea` rule
  and keeps a Shape with a single elevated Layer from being treated
  as if it had no floor.
- Recenter-related drift bugs (the previous `recenterCompositeShape`
  subtracting `offsetX/Y` from the 2D branch unconditionally) are
  the kind of redundancy this PRD documents so the two designers
  don't diverge again. If a future change wants to consolidate the
  geometry helper into a shared `shape-geometry.ts`, the invariants
  in the "Testing Decisions" section above should hold word-for-word
  on the consolidated module.
