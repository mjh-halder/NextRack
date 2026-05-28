# CONTEXT

Glossary of canonical domain terms for this project. The code, UI, and discussions should use these terms consistently. When a term has a German synonym, both appear together. Implementation details live elsewhere (ADRs, code comments) — this file is a glossary, nothing more.

## Shape (de: Form)

A visual blueprint. Geometry, layers, icons, colors, and dimensions. No domain intelligence — it doesn't know what a "Firewall" is, it just knows how one looks. Shapes are authored in the Shape Designer and stored in the shape store.

**Not to be confused with**: Component (which has domain meaning and references a Shape).

The German word "Form" maps to Shape. In English code and UI, the canonical term is Shape.

## Component

A domain object: "Firewall", "Router", "HSM Appliance". Carries properties (vendor, model, capacity — empty in MVP). References a Shape via `shapeId` to know how to render.

A Component is a *thing in the data center*. A Shape is a *picture of that thing*. The split exists because the product evolves toward validation (V1) and a vendor catalog (V2) — domain intelligence belongs on the Component, not the Shape.

## Component Designer

The editor where users design Components. A Component is authored in three layers:

1. **Visual** — its Shape (geometry, layers, icons, colors). Today this is the whole editor.
2. **Identity** — name, component type. Partially present today.
3. **Domain properties** — vendor, model, capacity, etc. Not built yet (MVP scope, but unimplemented).

The forward-looking framing is intentional: the editor is named for the *whole Component* it will eventually design, not just for the Shape it edits today. Shapes are a means to an end — the means is "the visual layer of a Component."

Lives in `component-designer.ts`.

## System Designer

The canvas where users place Components into a system diagram. Lives in `system-designer.ts`. Distinct from the Component Designer — the System Designer is about composition (arranging existing Components into a system), the Component Designer is about authoring new Components.

## Layer

A geometric building block within a Shape. The name reflects the typical case: layers stack vertically, like the three cylinders of a database icon. Horizontal arrangements are possible (`offsetX`/`offsetY` exist) but are the exception, not the rule.

A Shape has at least one Layer. There is **no "main" or "special" Layer** — all Layers are equal. The whole multi-Layer Shape is treated as a single visual entity in the System Designer; internally it doesn't matter which Layer "owns" the icon or the label.

Every Layer can float (have `baseElevation > 0`) — the floor anchor and label position come from the Hit Area, not from any specific Layer.

The only structural rule: a Shape must keep at least one Layer. The chokepoint that deletes a Layer refuses if it would leave zero. Which specific Layer is "the last one" is irrelevant.

Implementation note: `layers[0]` used to carry special status (label anchor, icon anchor, undeleteable, immovable, forced `baseElevation=0`, and the anchor frame for spawn placement & composite centering). That status has been removed from:

- the Component Designer's composite recentering (`recenterCompositeShape` — now anchors on the floor-layer bbox, i.e. the Hit Area center)
- `applyRegistryDefaults` (skips layer-specific work for multi-Layer Shapes — the `ComplexComponent` owns per-Layer rendering)
- the `getPaletteIcon` / `getHitArea` / `getCompositeIsoHeight` facade (Shape-wide rules, no `layers[0]` reads)
- `addIcon` / `setMainIcon` chokepoints (Shape-wide `isMain` uniqueness)
- the three instance-spawn sites (`system-designer.ts`, `palette.ts`) — they now derive `isometricHeight` from `getCompositeIsoHeight(def)` (= max of `baseElevation + depth` across all Layers), not from `layers[0].depth`. Painter's-sort z-order reflects the actual composite top.

The only remaining `layers[0]` use is the editor's label (`setShapeLabel` pins to `layerShapes[0]`); a permanent floor anchor element will replace that in a separate step.

## Hit Area

A rectangle on the floor plane that defines a Component's placement footprint in the System Designer — used for collision detection, snapping, and as the **anchor for the Shape's label**. It is independent of the Layers: the Hit Area always sits at floor level, even when every Layer floats above it.

Stored as `hitAreaSize: { width, height }` on the Shape Definition. If not explicitly set, derived as follows:

1. **Single Layer** — Hit Area = that Layer's `width × height`.
2. **Multiple Layers** — Hit Area = bounding box of all Layers with `baseElevation === 0` (the floor-standing Layers).
3. **Edge case: all Layers float** (no Layer has `baseElevation === 0`) — Hit Area = bounding box of *all* Layers, regardless of elevation. Pragmatic fallback for visually-floating Shapes.

Reason: the Hit Area is the *floor footprint* of the Component. Floor-standing Layers define it; floating Layers above don't extend the footprint.

**Rounding.** The returned dimensions always snap **up** to the next multiple of 10px in both width and height. Applies to all four cases above, including explicit `hitAreaSize`. Constant: `HIT_AREA_STEP` in `src/shape-query.ts`.

The Hit Area is what allows Layers to float freely. Before this concept was used for labels, `layers[0]` had to be pinned to the floor so the label rendered correctly; now the Hit Area takes that job and `layers[0]` is freed from the floor.

## IconEntry

A single icon placed on a Layer. A Layer carries zero or more IconEntries (`layer.icons[]`).

Each IconEntry has:
- a stable `id` for editor addressing (survives reorders)
- an `iconId` referencing the icon catalog (e.g., `"security"`, `"firewall"`)
- placement (face: top/front/side, offset, size, skew)
- background styling (color, shape, radius, chamfer)
- an `isMain` flag

**isMain** marks the *one* IconEntry — across the whole Shape — that represents the Component in the 2D view (where only one icon can be shown clearly). It is **per-Shape**: at most one IconEntry in a Shape has `isMain === true`, regardless of which Layer it sits on. Authoring chokepoints enforce uniqueness — setting `isMain` on an entry clears it on every other entry in every other Layer.

It is unrelated to the obsolete "Main Layer" concept: `isMain` identifies an icon, not a Layer.

> Implementation note: earlier code scoped `isMain` uniqueness per-Layer. That was a slip — the field has always been a Shape-level concept. Chokepoints (`addIcon`, `setMainIcon`) and the palette-icon reader use Shape-wide semantics.

## Catalog Icon

An entry in the icon library (Carbon, AWS, GCP, Azure icon sets). Addressed by `iconId`. An IconEntry references a Catalog Icon — they are not the same thing. The Catalog Icon is the raw asset; the IconEntry is its placement on a Layer with all the styling around it.

## Icon (in a recognition surface)

The small, identity-bearing glyph shown for a Shape in trees, palettes, lists, and pickers. Always the **Catalog Icon SVG** of the Shape's `isMain` [IconEntry](#iconentry) — the raw asset, not a render of how the Shape will appear on the canvas.

Recognition surfaces are designed for fast scanning and type identification. The "Icon" is therefore a stable, single-look representation of the Shape's type. It is the SAME image everywhere a Shape appears in a tree or palette.

What "Icon" is NOT:

- Not the Shape's full visual on the canvas (that is the [Vorschaubild](#vorschaubild)).
- Not affected by per-IconEntry styling like `monochrome`, `bgEnabled`, `bgColor`, `iconColor`. Those are properties of the rendered Shape, not properties of the Icon.
- Not the inventory snapshot. The snapshot is a Vorschaubild, not an Icon.

Vendor icons (AWS / Azure / GCP) and uploaded icons render in their original colors. Carbon and curated `custom` icons are line art and are tinted with the active theme.

## Vorschaubild

A pre-rendered preview image of how a Shape looks on the canvas — with its layers, backgrounds, per-entry styling, monochrome flag where set. Stored in the inventory as a saved SVG snapshot at save time.

Distinct from the [Icon](#icon-in-a-recognition-surface): the Icon identifies the Shape's type at a glance; the Vorschaubild shows how the Shape will actually look when placed.

Vorschaubilder are used in dedicated preview UIs (e.g. the SVG-grid view of the palette, gallery views, export thumbnails). They are NEVER substituted for the Icon in a list/tree row, even if both are SVG files.

> The "everything-SVG-must-be-the-icon" confusion is the source of the recurring CD-vs-SD tree mismatch — same Shape rendered differently in two surfaces because one used the Vorschaubild and the other used the Icon. The two concepts must stay distinguished even though they share a file type.

## Editor Draft

The in-flight state of whatever an editor is currently authoring or modifying — the single source of truth that inputs and the canvas both derive from. Can hold temporary, not-yet-persisted values.

The Editor Draft is editor-specific:

- In the **Component Designer**, the Draft is the `iconEntries[]` / `layers[]` data plus shape-level meta. It becomes a ShapeDefinition when the user saves to the Shape Store.
- In the **Inspector**, the Draft is the selected JointJS Cell itself — its `attrs`, `size`, `position`, and the `META_KEY` payload. Every edit is live; there is no separate "unsaved" layer.

Form inputs and canvas rendering are both views of the Draft. They never disagree because they read the same source. See [Populate](#populate) and [Mutator](#mutator).

## Populate

The act of reading from the [Editor Draft](#editor-draft) and writing the current values into every visible form input in the active panel. Idempotent — calling it twice in a row leaves the UI unchanged.

`populate()` runs at two moments:

1. **Selection change** — when the user opens an Icon, picks a different Layer, or selects a different Cell in the System Designer. The DOM is (re)built, populators are registered, and `populate()` fills the values.
2. **After every mutation** — when a [Mutator](#mutator) finishes, `populate()` runs to refresh fields that depend on the changed value (so width changes can update derived hit-area dimensions, etc.).

Populate is bounded by the size of the active panel, not by the size of the canvas. It does not iterate cells. It does not redraw the canvas — cell rendering happens through JointJS's own change-event chain.

## Mutator

The only sanctioned write path into the [Editor Draft](#editor-draft). Outside callers (input handlers, drag handlers, command actions) must never mutate Draft data directly — they call a Mutator instead.

Per editor:

- **Component Designer:** `mutateIcon(id, patch)`, `mutateLayer(id, patch)`, `mutateMeta(patch)`. Per-entity granularity; patches are `Partial<…>`. (Built on top of the pre-existing `updateIcon` / `updateLayer` chokepoints.)
- **Inspector:** `cell.set(path, value)` — JointJS's native path-based set is the per-property mutator. `change:*` events are the refresh trigger.

A Mutator does three things: writes the Draft, triggers canvas re-render where applicable, and calls [`populate()`](#populate). Anything that bypasses a Mutator risks the Draft and the views falling out of sync.

For continuous cursor-driven canvas drags (Layer move, Hit Area resize), the Mutator is called only once at `pointerup` — during the drag, the JointJS Cell is the live truth and the Draft stays untouched until the drop.
