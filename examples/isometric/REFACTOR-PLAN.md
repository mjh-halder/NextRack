# Component Designer Refactor Plan

This plan refactors the Component Designer to fix a recurring bug ("Save button doesn't always activate when an icon changes") and to remove the dual "simple shape vs. complex shape" code paths that were the structural source of the bug.

It is the persistent specification of the work — once execution begins, this file is the source of truth. A subagent reading only this file (plus `CONTEXT.md`) should be able to execute any single Task without further conversation context.

---

## Domain Model

See [CONTEXT.md](CONTEXT.md). Key terms used throughout this plan:

- **Shape** — visual blueprint of a Component (geometry, layers, icons). German: *Form*.
- **Component** — domain object that references a Shape. Will eventually carry vendor/model/capacity properties.
- **Component Designer** — the editor (`component-designer.ts`). Forward-looking name: today it edits Shapes, eventually it will also edit Component properties.
- **Layer** — geometric building block within a Shape. All Layers are equal — there is no "main" Layer.
- **IconEntry** — one icon placed on a Layer. Stable `id`, catalog reference via `iconId`, optional `isMain` flag for 2D-view selection.
- **Catalog Icon** — entry in the asset library (Carbon, AWS, GCP, Azure).
- **Hit Area** — floor-plane rectangle that anchors the Shape's label and defines its placement footprint. Independent of Layers (Layers can float).

---

## The Bug Being Fixed

When the user changes a property of an icon in the Component Designer:

1. The data should update.
2. The "Save" button should activate (`markDirty()`).
3. The canvas should refresh.

Today only some property changes complete all three. Others silently drop step 2 or step 3. The root cause is **dual state**: icon edits flow through three layers of buffering (`selectedIcon*` legacy globals → `iconEntries` editing buffer → `layers[i].icons` persistence), each requiring a manual sync step, with many input handlers forgetting one or more of those steps.

The fix: **single source of truth + chokepoint API**. All icon and layer mutations go through a small set of functions that atomically mutate the data, mark dirty, and trigger render. No outside code touches the data directly.

---

## Prerequisites (Already Completed)

These changes are already on disk:

- **`src/shapes/shape-definition.ts`** — `BaseShape` union extended with `'svgPolygon'`.
- **`src/shapes/shape-registry.ts`** — schema rewritten:
  - `ShapeDefinition` shrunk to component-level metadata + required `layers: ShapeLayer[]`.
  - `ShapeLayer.icons` is now required (always present, may be empty).
  - `IconEntry.id` is now the stable entry identity; `IconEntry.iconId` is the catalog reference.
  - `IconEntry` gained typed fields `iconColor`, `name` (previously accessed via `(as any)` casts).
  - `ShapeLayer.svgNormVerts` renamed to `ShapeLayer.normalizedVerts`.
  - Helper exports `defaultShapeLayer(partial)` and `defaultIconEntry(partial)` produce instances with fresh stable ids.
  - Removed: `defaultSize`, `defaultIsometricHeight`, `style`, `complexShape`, `customVerts`, `rotation` (renamed `defaultRotation`), and all flat icon fields (`icon`, `iconSize`, `iconBgColor`, `iconBgShape`, `iconBgRadius`, `iconBgSize`, `iconBgChamfer`, `iconBgEnabled`, `iconFace`, `iconHref`, `iconLayerIndex`) from `ShapeDefinition`. Most geometry fields (`baseShape`, `cornerRadius`, `chamferSize`, `taper`, etc.) now live only on `ShapeLayer`.
  - Storage keys bumped to `-v2`, so old localStorage data is ignored (acceptable — user has agreed to re-create any existing Shapes).
  - `migrateIconDef` function deleted (no longer needed).
- **`src/shape-store.ts`** — `bakeIconHref(entry: IconEntry | undefined)` rewritten to consume an `IconEntry` directly. HSM default rewritten as a single-layer Shape with embedded IconEntry. Storage keys bumped to `-v2`.

**Starting state for the rest of the work:** the schema is in place. The codebase does NOT compile because every consumer of `ShapeDefinition` / `ShapeLayer` / `IconEntry` still references the old shape of those types. Every Task below brings one or more consumers in line with the new schema.

---

## Scope

### In Scope

- Single source of truth for icon data: `layers[layerIndex].icons[entryIndex]`.
- Chokepoint API for all Layer/Icon mutations in the Component Designer.
- Deletion of the `isComplexShape` flag and every branch on it. All Shapes are layered.
- Deletion of the `selectedIcon*` module globals and the legacy single-icon rendering path.
- Removal of the special status of `layers[0]` ("Main Layer") — all Layers are equal, except the constraint "a Shape must keep ≥1 Layer."
- Label anchoring switched from `layers[0]` to the Hit Area.
- Disambiguation of drawn polygons (`baseShape === 'custom'`) vs. uploaded SVGs (`baseShape === 'svgPolygon'`).
- Consumer migrations: every file that reads the old schema is updated to read the new one.

### Out of Scope

- **Undo/redo for icon edits** — relies on the existing `markDirty` mechanism; not extended in this refactor.
- **Per-instance icon override propagation** — the existing model (instance-level overrides stored as JointJS attrs) is preserved as-is.
- **Multi-preset variations** — `turned90` is kept as-is; no generalized presets.
- **Live propagation from definition to placed instances** — fork-on-spawn stays the model.
- **Component property layer** — `vendor`, `model`, `capacity` etc. on Components are forward-looking; not built in this refactor.
- **Automated tests** — none exist for the Component Designer; verification is manual (see Phase C).
- **Migration of old localStorage data** — storage keys are bumped to `-v2`, so any existing Shapes in the browser need to be re-created by the user.
- **Renaming `component-designer.ts`** — kept as-is; the name is forward-looking, not a bug.

---

## Execution Model

Tasks are designed to be executed **strictly sequentially**, one at a time. A new subagent (or fresh session) reads this plan, picks the next pending Task by number, executes it, and reports done.

Compilation status during execution:

- After **Task 0** (already complete): broken — consumers reference old schema.
- After **Tasks 1–9** (Component Designer): still broken — consumers haven't caught up.
- After **Tasks 10–15** (Consumer Migrations): should compile.
- After **Task 16**: compilation verified.
- After **Task 17**: user smoke test passes.

A subagent does NOT need to keep the codebase compiling between Tasks. It only needs to leave its specific Task complete and correct.

---

# PHASE A — COMPONENT DESIGNER CORE

## Task 1: Add Chokepoint API

**Goal:** Introduce the mutation chokepoint functions. Additive — no existing code is deleted yet. After this Task, the new API exists but nothing uses it yet.

**File:** `src/component-designer.ts`

**Place new code:** near the existing `markDirty()` function (~line 389).

**Steps:**

1. Add a top-of-module state variable to track the currently-selected layer by id (not by index — ids survive reorders):

   ```ts
   let selectedLayerId: string | null = null;
   ```

   Initialize on Shape load to `layers[0]?.id ?? null`. Update on layer click in the Layers panel.

2. Add lookup helpers:

   ```ts
   function findLayer(layerId: string): ShapeLayer | undefined {
       return layers.find(l => l.id === layerId);
   }

   function findIcon(layerId: string, entryId: string): IconEntry | undefined {
       return findLayer(layerId)?.icons.find(e => e.id === entryId);
   }
   ```

3. Add per-layer apply helpers (placeholders; their bodies will be implemented in Task 2):

   ```ts
   function applyIconsToLayer(layerId: string): void { /* implemented in Task 2 */ }
   function renderLayerGeometry(layerId: string): void { /* in-place resize + reapply modifiers */ }
   ```

4. Add the chokepoints. Each chokepoint: locate target → mutate → `markDirty()` → render. Return values indicate success (false if target not found or invariant would be violated).

   ```ts
   function updateIcon(layerId: string, entryId: string, patch: Partial<IconEntry>): boolean {
       const icon = findIcon(layerId, entryId);
       if (!icon) return false;
       Object.assign(icon, patch);
       markDirty();
       applyIconsToLayer(layerId);
       return true;
   }

   function updateLayer(layerId: string, patch: Partial<ShapeLayer>): boolean {
       const layer = findLayer(layerId);
       if (!layer) return false;
       Object.assign(layer, patch);
       markDirty();
       // Re-render this one layer's shape (resize, reapply modifiers, reapply icons)
       renderLayerGeometry(layerId);
       applyIconsToLayer(layerId);
       return true;
   }

   function addIcon(layerId: string, partial: Partial<IconEntry> = {}): IconEntry | null {
       const layer = findLayer(layerId);
       if (!layer) return null;
       const entry = defaultIconEntry({ isMain: layer.icons.length === 0, ...partial });
       layer.icons.push(entry);
       markDirty();
       applyIconsToLayer(layerId);
       return entry;
   }

   function removeIcon(layerId: string, entryId: string): boolean {
       const layer = findLayer(layerId);
       if (!layer) return false;
       const idx = layer.icons.findIndex(e => e.id === entryId);
       if (idx < 0) return false;
       layer.icons.splice(idx, 1);
       markDirty();
       applyIconsToLayer(layerId);
       return true;
   }

   function reorderIcons(layerId: string, fromIdx: number, toIdx: number): boolean {
       const layer = findLayer(layerId);
       if (!layer || fromIdx < 0 || fromIdx >= layer.icons.length || toIdx < 0 || toIdx >= layer.icons.length) return false;
       const [moved] = layer.icons.splice(fromIdx, 1);
       layer.icons.splice(toIdx, 0, moved);
       markDirty();
       applyIconsToLayer(layerId);
       return true;
   }

   function setMainIcon(layerId: string, entryId: string): boolean {
       const layer = findLayer(layerId);
       if (!layer) return false;
       const target = layer.icons.find(e => e.id === entryId);
       if (!target) return false;
       for (const ie of layer.icons) ie.isMain = (ie === target);
       markDirty();
       applyIconsToLayer(layerId);
       return true;
   }

   function addLayer(partial: Partial<ShapeLayer> = {}): ShapeLayer {
       const stackElevation = layers.reduce((sum, l) => sum + l.depth, 0);
       const layer = defaultShapeLayer({
           name: `Layer ${layers.length + 1}`,
           baseElevation: stackElevation,
           ...partial,
       });
       layers.push(layer);
       markDirty();
       renderLayersOnCanvas();
       return layer;
   }

   function removeLayer(layerId: string): boolean {
       if (layers.length <= 1) return false;   // must keep at least one layer
       const idx = layers.findIndex(l => l.id === layerId);
       if (idx < 0) return false;
       layers.splice(idx, 1);
       if (selectedLayerId === layerId) selectedLayerId = layers[0]?.id ?? null;
       markDirty();
       renderLayersOnCanvas();
       return true;
   }

   function reorderLayers(fromIdx: number, toIdx: number): boolean {
       if (fromIdx < 0 || fromIdx >= layers.length || toIdx < 0 || toIdx >= layers.length) return false;
       const [moved] = layers.splice(fromIdx, 1);
       layers.splice(toIdx, 0, moved);
       markDirty();
       renderLayersOnCanvas();
       return true;
   }
   ```

**Done when:**

- All eleven chokepoint functions exist in `component-designer.ts`.
- The new `selectedLayerId` variable is declared and initialized on shape load.
- Nothing else has been deleted yet (additive only).
- The file may still have schema errors from the existing code — that's expected and addressed in subsequent Tasks.

---

## Task 2: Rewrite the Icon Apply Pipeline

**Goal:** Replace `applyIconToCurrentShape` (which reads module globals) with `applyIconsToLayer(layerId)` (which reads from `layers`). Delete the legacy single-icon rendering path.

**File:** `src/component-designer.ts`

**Steps:**

1. Implement `applyIconsToLayer(layerId: string)`:
   - Look up the layer by id.
   - Look up the iso + 2D shapes for that layer (today these are in `layerShapes[idx]` / `layerShapes2D[idx]` — index by `layers.indexOf(layer)`).
   - If `layer.icons.length === 0`: clear `topIcon` / `topIcon2D` attrs on both shapes, return.
   - Otherwise: build the multi-icon composite SVG (use the existing `buildCompositeIconSvg` helper, around line 1463). For ISO: each icon's face/offset/skew is baked into its `<g transform="...">`. For 2D: only the `isMain` icon (or the only icon) renders.
   - Set `topIcon` and `topIcon2D` attrs on both the iso shape and the 2D shape.
   - Call `raiseToFront(view, 'topIcon')` to keep icons painted above face paths (the DOM hack).
   - Do NOT call `markDirty()` here — apply functions are render-only; chokepoints mark dirty.

   The existing logic in `applyIconToCurrentShape` (lines 1577–1660) is the multi-entry path; copy/adapt that code, then change every read of `iconEntries[]` to read `layer.icons[]`, and every read of `currentShape` / `currentShape2D` to read the layer's specific iso + 2D shape.

2. Implement `renderLayerGeometry(layerId: string)`:
   - In-place update of the layer's iso + 2D shape: `shape.resize(w, h)`, set isometricHeight, reapply modifiers (cornerRadius, chamferSize, taper, twist, scaleTopX/Y, shedRoof*, position).
   - Equivalent to what one iteration of the loop in `renderLayersOnCanvas` does, without `graph.clear()`.

3. Convert `applyAllLayerIcons` from a swap-and-restore loop to a simple iteration:

   ```ts
   function applyAllLayerIcons(): void {
       for (const layer of layers) applyIconsToLayer(layer.id);
   }
   ```

4. Delete:
   - `applyIconToCurrentShape` (the entire function, ~250 lines)
   - `applyingAllLayerIcons` flag and its three guard sites
   - `syncLegacyStateToIconEntry` (entire function)
   - `saveIconEntriesToLayer` (entire function)
   - `loadIconEntriesFromLayer` (entire function)
   - All callers of those deleted functions (find via grep)

**Done when:**

- `applyIconsToLayer` and `renderLayerGeometry` exist and are implemented.
- `applyAllLayerIcons` is the trivial loop above.
- The functions in the deletion list above are gone.
- No reference to `applyIconToCurrentShape`, `applyingAllLayerIcons`, `syncLegacyStateToIconEntry`, `saveIconEntriesToLayer`, or `loadIconEntriesFromLayer` remains anywhere in the file.

---

## Task 3: Delete the `iconEntries` Editing Buffer

**Goal:** Remove the module-global `iconEntries` array. All reads/writes go to `layers[i].icons` directly.

**File:** `src/component-designer.ts`

**Steps:**

1. Delete the declaration: `let iconEntries: ... = [];`
2. Find every read/write of `iconEntries` (`grep -n iconEntries`) — about 30 sites. For each:
   - **Reads** (`iconEntries[i]`, `iconEntries.length`, `iconEntries.some(...)`, etc.) — replace with the equivalent read of `findLayer(selectedLayerId!).icons` (with appropriate null-safety).
   - **Mutating writes** (`iconEntries.push`, `iconEntries.splice`, `iconEntries[i].x = y`, etc.) — replace with calls to the chokepoint functions (`addIcon`, `removeIcon`, `updateIcon`, etc.).
   - **The icon-list render function** (referenced via `renderIconsListFn`) — its closure should read `findLayer(selectedLayerId!)?.icons ?? []`. It rebuilds the visible list of icons in the inspector.
3. The `editingIconIndex` global is now `editingIconEntryId: string | null` — track the currently-edited icon by stable id, not by index. Update every site (~15 references).

**Done when:**

- The string `iconEntries` does not appear anywhere in `component-designer.ts`.
- The string `editingIconIndex` does not appear anywhere; replaced by `editingIconEntryId`.
- All inspector controls that edit an icon read/write through `findIcon` + `updateIcon`.

---

## Task 4: Rewire Inspector Handlers Through Chokepoints

**Goal:** Delete the `selectedIcon*` module globals. Each inspector input handler captures `(layerId, entryId)` via closure and calls the appropriate chokepoint on change.

**File:** `src/component-designer.ts`

**Steps:**

1. Find every `selectedIcon*` declaration (~15: `selectedIcon`, `selectedIconFace`, `selectedIconSize`, `selectedIconOffsetX`, `selectedIconOffsetY`, `selectedIconSkewX`, `selectedIconSkewY`, `selectedIconBgEnabled`, `selectedIconBgColor`, `selectedIconBgShape`, `selectedIconBgRadius`, `selectedIconBgSize`, `selectedIconBgChamfer`, `selectedIconAdaptive`, `selectedIconMonochrome`). Delete them.

2. For each inspector input that today writes to a `selectedIcon*` global and triggers a sync:

   **Before** (illustrative):
   ```ts
   sizeInput.addEventListener('input', () => {
       selectedIconSize = parseFloat(sizeInput.value);
       applyIconToCurrentShape();
   });
   ```

   **After:**
   ```ts
   sizeInput.addEventListener('input', () => {
       if (!selectedLayerId || !editingIconEntryId) return;
       updateIcon(selectedLayerId, editingIconEntryId, { size: parseFloat(sizeInput.value) });
   });
   ```

3. When the inspector is built for a specific icon entry, the (layerId, entryId) is in scope (via the `editingIconEntryId` global + `selectedLayerId`). Closures capture the live ids; reorders/removes are handled because the inspector rebuilds when the layer/icon set changes (see Task 8).

4. Initial values for inspector inputs come from `findIcon(selectedLayerId!, editingIconEntryId!)`, not from `selectedIcon*` globals.

5. Delete the `iconColor` / `iconOpacity` / `bgOpacity` handlers that currently mutate via `(iconEntries[editingIconIndex] as any).iconColor = c` style — replace with `updateIcon(selectedLayerId, editingIconEntryId, { iconColor: c })`. These now have typed fields (no more `as any`).

**Done when:**

- No `selectedIcon*` identifier exists anywhere in the file.
- Every inspector input handler that modifies an icon property routes through `updateIcon`.
- Loading a Shape into the canvas does NOT initialize any `selectedIcon*` state (because none exists).

---

## Task 5: Eliminate `isComplexShape`, Unify the Code Paths, Remove Main Layer Special Status

**Goal:** Delete the `isComplexShape` global and all 60+ branches on it. Rewrite `loadShapeIntoCanvas` as a single layered path. Remove the special status of `layers[0]` (Main Layer concept) — replaced by the Hit Area for label anchoring.

**File:** `src/component-designer.ts`

**Steps:**

1. **Delete the global:** `let isComplexShape = false;` and every `if (isComplexShape)` / `if (!isComplexShape)` branch. For each branch:
   - The "complex" arm becomes the only code path.
   - The "simple" arm is deleted.

2. **Rewrite `loadShapeIntoCanvas`** (line 6552) as a single path:
   - Read `savedDefaults.layers` (always present in new schema).
   - Set `selectedLayerId = layers[0].id`.
   - Call `renderLayersOnCanvas()` (no fork).
   - Set the label via the Hit Area (see step 4 below).
   - Build the inspector for `layers[0]` and its first icon (if any).

3. **Delete the "Complex toggle" UI** in the inspector. The toggle (`#sd-complex-toggle`) no longer represents anything meaningful. The Layers panel is always visible.

4. **Label anchoring switched to Hit Area:**
   - Today the label is set on `layerShapes[0]` (the main layer's iso model).
   - New: compute label position from `getHitAreaSize()` (or from the union bbox of all layers if no explicit hit area is set).
   - The label visual element is rendered as part of the canvas overlay tied to the Hit Area, not to any specific Layer's shape.
   - Find every site that does `layerShapes[0]?.attr('label/text', ...)` and route through a new helper `setShapeLabel(text, position)`.

5. **Remove Main Layer constraints:**
   - In `onMoveLayerUp` / `onMoveLayerDown`: remove the "index ≤ 1" and "index ≥ layers.length - 1" guards that prevented layers[0] from being reordered. Now any layer can move freely.
   - In `onDeleteLayer`: the new rule is "you cannot delete the last remaining layer." Already enforced by `removeLayer` chokepoint (Task 1). Delete the old `if (index === 0) return;` guard.
   - In `onOffsetChange`: remove `selectedLayerIndex === 0 ? 0 : parseFloat(baseElevationInput.value)`. Every layer's baseElevation is free.
   - The `baseElevationInput.disabled = index === 0;` (line 5515) is deleted — baseElevation is always enabled.

6. **Update the Layers Panel UI** (`buildLayersPanel`, line 5192):
   - Remove the "Main" badge (`nr-layer-main-tag`).
   - Remove the `isMain` styling class.
   - All layers get up/down chevrons, except disabled at the array boundary.
   - All layers get the overflow menu including Delete (disabled only when `layers.length === 1`).

7. **`collectCurrentDef`** (line 4416): rewrite to produce the new `ShapeDefinition` shape — only `displayName`, `componentType`, `collection`, `hitAreaSize`, `hasVariations`, `turned90`, `defaultRotation`, `layers`. No `defaultSize`, `defaultIsometricHeight`, `complexShape`, `style`, `customVerts`, flat icon fields.

**Done when:**

- `isComplexShape` identifier does not appear in the file.
- `loadShapeIntoCanvas` has one code path (no `if (savedDefaults?.complexShape ...)` fork).
- The Layers panel does not render a "Main" tag.
- `layers[0]` has no special handling anywhere in the file.
- The label is anchored to the Hit Area, not to `layerShapes[0]`.
- `collectCurrentDef` produces the new ShapeDefinition shape.

---

## Task 6: Disambiguate Drawn Polygons from Uploaded SVGs

**Goal:** Make `baseShape` the discriminator. A drawn polygon has `baseShape === 'custom'`. An uploaded SVG has `baseShape === 'svgPolygon'`. Both store vertices in `normalizedVerts`.

**File:** `src/component-designer.ts`

**Steps:**

1. The polygon-vertex storage on `ShapeLayer` is now `normalizedVerts` (renamed from `svgNormVerts`). Update every read/write in `component-designer.ts` accordingly.

2. The "custom polygon drawer" UI (interactive vertex placement): when active, `selectedBaseShape === 'custom'` and the layer's `normalizedVerts` are read/written from the JointJS shape's `normalizedVerts` attribute.

3. The "SVG upload" UI (file picker): when a user uploads, set `layer.baseShape = 'svgPolygon'`, parse the SVG into vertices stored in `layer.normalizedVerts`, keep the raw SVG in `layer.svgFootprint`, and the filename in `layer.svgFootprintName`.

4. When the user **switches baseShape between `'custom'` and `'svgPolygon'`**: clear `normalizedVerts`, `svgFootprint`, `svgFootprintName`, `svgBillboard`. (Switching modes is destructive — show a confirm dialog before erasing.)

5. `isLayerSvg` and `isLayerCustomVerts` helpers (lines 3858–3866): redefine in terms of `baseShape`:

   ```ts
   function isLayerSvg(layer: ShapeLayer): boolean {
       return layer.baseShape === 'svgPolygon';
   }
   function isLayerCustomVerts(layer: ShapeLayer): boolean {
       return layer.baseShape === 'custom' || layer.baseShape === 'svgPolygon';
   }
   ```

6. The Form-Factor picker UI: add `'svgPolygon'` as a tile alongside `'custom'`. The "Upload SVG" affordance lives behind selecting the `svgPolygon` tile.

**Done when:**

- The string `svgNormVerts` does not appear anywhere in `component-designer.ts`.
- `isLayerSvg` and `isLayerCustomVerts` decide based on `baseShape`, not on which field is populated.
- Uploading an SVG sets `baseShape: 'svgPolygon'`. Drawing a polygon sets `baseShape: 'custom'`.

---

# PHASE B — CONSUMER MIGRATIONS

These can be done in any order (they're independent of each other). The Component Designer must be done first (Phase A); after that, consumers can be migrated in parallel if multiple subagents run.

## Task 7: Migrate `src/shapes/complex-component.ts`

**Goal:** Update the System-Designer-side composite shape to read the new `ShapeLayer` schema.

**File:** `src/shapes/complex-component.ts`

**Steps:**

1. Find every read of `layer.svgNormVerts` → rename to `layer.normalizedVerts`. There are ~3 sites.
2. The `makeProxy` function at line 65: its check `!!(layer.svgNormVerts && layer.svgNormVerts.length >= 3)` becomes `layer.baseShape === 'svgPolygon' || layer.baseShape === 'custom'` (any layer with normalized verts is rendered via SvgPolygonShape).

**Done when:** `svgNormVerts` is not referenced in this file; `normalizedVerts` is.

---

## Task 8: Migrate `src/utils.ts`

**Goal:** Update `addShapeToCanvas` to read from the new layered schema.

**File:** `src/utils.ts` (lines 240–320)

**Steps:**

1. Today the function reads `defaults.defaultSize`, `defaults.defaultIsometricHeight`, `defaults.baseShape`, `defaults.iconHref`, `defaults.iconSize`, `defaults.iconFace`, `defaults.iconBgColor`, `defaults.customVerts`, `defaults.rotation`. All of these are gone from `ShapeDefinition`.
2. New reads:
   - `defaults.layers[0].width` / `.height` → spawn dimensions (was `defaultSize`).
   - `defaults.layers[0].depth` → spawn depth (was `defaultIsometricHeight`).
   - `defaults.layers[0].baseShape` → geometry kind (was `baseShape`).
   - `defaults.layers[0].normalizedVerts` → vertices (was `customVerts`).
   - `defaults.layers[0].icons[0]` → icon attrs (if present; was the flat `icon*` fields).
   - `defaults.defaultRotation` → rotation (was `rotation`).
3. If the Shape has multiple layers, this function spawns a `ComplexComponent` (see `system-designer.ts:1975-1984` for the existing path). The "simple single shape" branch becomes the "single-layer Shape" branch — but uses the same code as multi-layer, since simple is just `layers.length === 1`. Collapse to one path.

**Done when:** No reference to `defaultSize`, `defaultIsometricHeight`, `iconHref`, `iconSize`, `iconFace`, `iconBgColor`, `customVerts`, or `rotation` as `ShapeDefinition` properties.

---

## Task 9: Migrate `src/system-designer.ts`

**Goal:** Update the three instance-spawn sites and the icon-refresh logic.

**File:** `src/system-designer.ts`

**Steps:**

1. **Three spawn sites with `if (def.complexShape && def.layers?.length)` fork** (lines 1975, 2779, plus the related block at 2722-2723):
   - Collapse to single layered path: every Shape is layered, so always spawn via the multi-layer code path.
   - Read `def.layers` directly (no `complexShape` check needed).
   - Read `def.layers[0].width / height / depth` instead of `def.defaultSize` / `defaultIsometricHeight`.
2. **Icon refresh on instance** (lines 730–736): currently reads `def.iconHref`, `def.iconFace`, `def.iconSize`. New: read from `def.layers[0].icons[0]` — `entry.href`, `entry.face`, `entry.size`. If the layered Shape has more than one layer or more than one icon, this MVP refresh logic only handles the primary (layer 0 + icon 0). Multi-icon refresh is out of scope.
3. **`def.baseShape` lookups** (lines 1993, 1999, 2707, 2729, 2792): replace with `def.layers[0].baseShape` (or pick the right layer's baseShape if context demands).
4. **`hitAreaSize` fallback** (line 1978): `def.hitAreaSize ?? { width: baseLayer.width, height: baseLayer.height }` — unchanged in spirit, just use the new layer reference.

**Done when:** `complexShape`, `defaultSize`, `defaultIsometricHeight`, `iconHref`, `iconFace`, `iconSize` (as `ShapeDefinition` props) no longer appear in this file.

---

## Task 10: Migrate `src/inspector.ts`

**Goal:** Rewrite the instance-side "icon color override" block to use the new schema.

**File:** `src/inspector.ts`

**Steps:**

1. **Lines 2246–2314** (the instance icon color override): currently reverse-engineers the baked SVG via string manipulation (`svgStr.replace(...)`). This is the "rebake the icon when the instance color changes" path.
2. Rewrite to:
   - Read the source `IconEntry` from `def.layers[0].icons[0]` (or whichever the canonical icon is — for MVP, the first one).
   - Construct a copy of the IconEntry with the instance's color overlay applied.
   - Build the composite SVG using `buildCompositeIconSvg` (already exists in `component-designer.ts` — either export it from there or move it to a shared module like `src/icon-render.ts`).
   - Set the resulting href on the instance's `topIcon` / `topIcon2D` attrs.
3. **Line 2318** `if (def.complexShape && def.layers)`: collapse to read `def.layers` unconditionally.
4. Read `def.iconBgColor`, `def.iconBgShape`, etc. → `def.layers[0].icons[0]?.bgColor`, etc.

**Done when:** The string-replace bake hack is gone, replaced by a call to `buildCompositeIconSvg`. No `def.iconBgColor` / `def.iconHref` etc. as ShapeDefinition props.

---

## Task 11: Migrate `src/palette.ts`

**Goal:** Update the palette drag-start and palette-item construction.

**File:** `src/palette.ts`

**Steps:**

1. **Lines 1136–1146** (the `if (defaults?.complexShape && defaults.layers?.length)` fork at drag-start): collapse to single layered path.
2. **Line 844** (`ShapeRegistry[shapeKey]?.icon` lookup): change to `ShapeRegistry[shapeKey]?.layers[0]?.icons[0]?.iconId`.
3. **Line 1062** (`iconBgColor: paletteItem.iconBgColor`): the palette item's icon background color comes from `layers[0].icons[0]?.bgColor`. Update where palette items are constructed accordingly.
4. **Line 1156** (`defaults.rotation`): rename to `defaults.defaultRotation`.

**Done when:** `complexShape`, `def.icon`, `def.iconBgColor`, `def.rotation` (as ShapeDefinition props) no longer appear in this file.

---

## Task 12: Migrate `src/record-source.ts` and `src/admin.ts`

**Goal:** Update the admin/CSV reads to read from the new layered schema.

**Files:** `src/record-source.ts`, `src/admin.ts`

**Steps:**

1. `record-source.ts` lines 172–184: read geometry/icon from `def.layers[0]` (not flat fields). Decide whether to emit one row per Shape (status quo, just read from layers[0]) or one row per Layer (richer but bigger format change — **stick with status quo for MVP**).
2. `record-source.ts` lines 228–229: the `if (!def.layers) continue;` becomes unnecessary since `layers` is always present. Replace with `if (def.layers.length === 0) continue;` if defensive coding desired.
3. `admin.ts` line 268: `def.icon` → `def.layers[0]?.icons[0]?.iconId`.
4. `admin.ts` lines 302–316: `def.baseShape`, `def.defaultSize`, `def.defaultIsometricHeight` → all from `def.layers[0]`.
5. `admin.ts` lines 739, 789: `def.icon` lookups → `def.layers[0]?.icons[0]?.iconId`.

**Done when:** Flat `ShapeDefinition` icon / geometry fields not referenced in either file.

---

# PHASE C — VERIFICATION

## Task 13: Type-Check

**Goal:** Confirm the whole codebase compiles cleanly under the new schema.

**Steps:**

1. From the project root, run:
   ```bash
   yarn tsc --noEmit
   ```
2. Fix any remaining type errors. Common categories:
   - Stale references to deleted fields (`def.defaultSize`, `def.icon`, etc.).
   - Missed `svgNormVerts → normalizedVerts` renames.
   - Stale `complexShape` checks.
   - Helper functions still reading old fields.

**Done when:** `yarn tsc --noEmit` reports zero errors.

---

## Task 14: Manual Smoke Test (User-Driven)

**Goal:** Verify the bug fix works and nothing visual has regressed.

This must be done by the user, not a subagent. The subagent prepares by:

1. Clearing localStorage (`localStorage.clear()` in the browser console), since storage keys bumped to `-v2`.
2. Reloading the app.

**User checklist:**

- [ ] Open the Component Designer. The HSM Appliance default Shape loads with its icon visible.
- [ ] Change the icon's `face` (top → front → side). Verify: icon repositions visually, **Save button activates**.
- [ ] Change the icon's `size` via the slider. Verify: icon resizes, **Save button activates**.
- [ ] Change the icon's `color` via the color picker. Verify: icon recolors, **Save button activates**.
- [ ] Change the icon's `background color`. Verify: background updates, **Save button activates**.
- [ ] Change the icon's `opacity`. Verify: icon dims, **Save button activates**.
- [ ] Add a second icon to the Layer. Verify: visible on canvas, **Save button activates**.
- [ ] Mark the second icon as Main. Verify: 2D view now shows the second icon (not the first), **Save button activates**.
- [ ] Delete the second icon. Verify: gone, **Save button activates**.
- [ ] Create a new Shape "Test Box". Confirm it appears in the Layers panel as a single Layer (no "Main" tag).
- [ ] Add a second Layer. Set its `baseElevation` > 0. Verify: it floats above Layer 1.
- [ ] Add an icon to Layer 2. Switch the Layer selector back to Layer 1. Verify: inspector shows Layer 1's icons, not Layer 2's. **Save button stays activated.**
- [ ] Move Layer 2 → Layer 1 (drag down). Verify: stacking order changes.
- [ ] Delete Layer 2. Verify: only Layer 1 remains. Delete button on Layer 1 is now disabled (can't delete the last layer).
- [ ] Save the Shape. Reload the page. Verify: the saved Shape loads correctly with all its layers, icons, properties.
- [ ] Drag the saved Shape from the palette into the System Designer canvas. Verify: it spawns at the correct size, with the correct icon, in the correct color.
- [ ] In the System Designer, change the spawned Component's color. Verify: its icon recolors correctly (the rebake works).

**Done when:** all checklist items pass. If any fail, the subagent (or main session) investigates the specific failure and patches it.

---

# Design Decisions

The grilling session before this plan resolved several non-obvious design calls:

1. **Why unify simple and complex Shapes** rather than keep them separate. The dual code paths in `loadShapeIntoCanvas`, `applyIconToCurrentShape`, `palette.ts` drag-start, and `system-designer.ts` spawn were the structural source of the dirty-marking bug. Fixing the bug without unifying would leave landmines for next month. With unification, there is exactly one code path for every concern.

2. **Why no "Main Layer"**. Historically `layers[0]` was forced to baseElevation=0 because the label was anchored to it. Now the Hit Area takes that anchor role, so any Layer can float and there's no reason to mark one as special. Simpler model.

3. **Why stable `id` fields on `IconEntry`** instead of addressing by index. Reorders shift indexes; ids don't. The chokepoint API addresses by id so inspector closures stay valid across reorders without re-binding.

4. **Why not extract a domain-layer module** (e.g., `component-edit-store.ts`). The CLAUDE.md says "only extract structure when the current code clearly benefits from it." For now the chokepoints live in `component-designer.ts` as module-internal functions. If a future need arises (e.g., the System Designer needing to perform the same operations), extraction becomes natural — for now it'd be premature.

5. **Why `baseShape` discriminates `'custom'` vs `'svgPolygon'`** instead of having two separate fields. The old code conflated drawn polygons and uploaded SVGs into one `svgNormVerts` field, telling them apart only by "is `svgFootprint` set?". `baseShape` as the explicit discriminator removes the ambiguity at the type level.

6. **Why no migration of old localStorage data**. The user has agreed that any existing Shapes in localStorage are throwaway (small number, easy to re-create). Storage keys bumped to `-v2` cause old data to be ignored, no migration code needed.
