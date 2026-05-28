# ADR 0001 — Input Sync Protocol

Date: 2026-05-21
Status: Accepted

## Context

The Component Designer and the Inspector (System Designer's property panel) repeatedly drift: form fields show stale values, the canvas renders state that disagrees with the inputs, and switching selection leaves residual values from the previously selected item. The user reports four observable symptom classes — Open-Drift (A), Render-Drift (B), Cross-Field-Drift (C), Selection-Switch-Drift (D) — across both editors.

A code audit identified the root cause: the project has at least three competing sync patterns in production at once, with no shared contract for where state lives or how views derive from it. Specifically:

- **Component Designer** maintains 15+ global variables (`selectedIconFace`, `selectedIconSize`, …) that cache the "currently edited" values. These are synced from the entry *after* the UI builds. The build code reads globals at build time, so the UI is rendered against the stale previous selection. The Face/Front bug at `component-designer.ts:3278–3283` is the literal instance.
- **Inspector** uses a `saveNode()` harvest pattern: input change → harvest all inputs → `cell.set(META_KEY, meta)`. Any field not in the harvest list silently drops on save; any field added to the model without being added to the harvest never persists.
- **Inspector + System Designer canvas** *also* uses immediate `cell.set(path, val)` in some places, which JointJS auto-rebroadcasts via `change:*` events.

There is no single document or convention saying which pattern is correct, so new code inherits whichever pattern is closest at hand. The drift bugs are emergent — they appear at every site that doesn't manage state and views uniformly.

## Decision

Adopt **single-source-of-truth + single-chokepoint-populate** as the project-wide sync protocol, with editor-specific implementations.

### Per-editor source of truth

| Editor | SoT during editing |
|---|---|
| Component Designer | The data model — `iconEntries[]` / `layers[]` / shape-level meta. This is what gets persisted to the Shape Store on Save. |
| Inspector / System Designer | The JointJS `Cell` (its `attrs`, `size`, `position`, and the `META_KEY` payload). |

The Component Designer's globals (`selectedIconFace`, `selectedIconSize`, etc.) are eliminated as a class. Build code and populate code both read directly from `currentEditingEntry()` / `layers[selectedLayerIndex]` / shape meta.

### The five sync rules

1. **Single SoT per editor.** Inputs and canvas are views over that SoT. No second cache.
2. **Mutators are the only write path.** Component Designer: `mutateIcon(id, patch)`, `mutateLayer(id, patch)`, `mutateMeta(patch)` (extensions of the existing `updateIcon` / `updateLayer`). Inspector: `cell.set(path, val)` directly — no `saveNode()` harvest.
3. **`populate()` is idempotent and selection-scoped.** It re-reads from the SoT and updates every visible input in the active panel. Build (DOM creation) and populate (value setting) are separated. Each input-building site registers a populator function via `registerPopulator(fn)`. `populate()` runs all registered populators.
4. **Refresh triggers:** (a) selection change rebuilds DOM and runs `populate()` afterwards; (b) every mutator call ends in `populate()` (or, for Inspector, JointJS's `change:*` event triggers it via `cell.on('change', populate)`).
5. **Drag commits on drop.** During a cursor drag on the canvas (e.g., moving a Layer, resizing the Hit Area overlay), the JointJS Cell is the live truth and the mutator is *not* called on every frame. On `pointerup` / `dragend`, the handler reads the final cell state once and calls the mutator. This keeps drag smooth and avoids 60× populate per second.

### Why this design

Three alternatives were considered:

- **(i) Observer pattern with per-property subscriptions** — most selective, but requires per-input subscription wiring at every of ~50 inputs. Higher boilerplate, marginal performance benefit (the bottleneck is JointJS cell rendering, which neither pattern controls).
- **(ii) Single-chokepoint populate — chosen.** Every mutator ends in `populate()`. `populate()` re-reads everything in the active panel. Coarse but uniformly correct; no per-field wiring; one audit rule ("every mutator must call populate; populate must be registered for every visible input").
- **(iii) Selection-only populate** — populate runs only on selection change; live edits don't refresh other fields. Solves Open/Switch-Drift (A/D) and Render-Drift (B) but leaves Cross-Field-Drift (C) as a permanent discipline burden — the developer must remember to update dependent fields manually after every change.

(ii) was selected because it solves all four bug classes structurally and adds no abstraction (no event bus, no subscription registry, just discipline + one helper).

### Granularity of mutators

Component Designer uses **per-entity mutators**: `mutateIcon`, `mutateLayer`, `mutateMeta`. Three functions, one per logical entity type, accepting `Partial<…>` patches. Considered alternatives: one mega-mutator (too flexible — patch shape becomes a free-for-all, audit becomes harder), or per-property setters (50+ functions, bureaucracy without payoff for current scale).

For the Inspector, mutator granularity is per-property: each input writes `cell.set('meta/<field>', value)`. JointJS's path-based set is the natural fit.

## Performance contract

`populate()` is bounded by panel size (~20–30 DOM writes), not by canvas size:

- Component Designer canvas redraw cost: O(layers in current shape) — typically <10.
- System Designer canvas redraw cost: per-cell incremental render handled by JointJS. **Not** triggered by `populate()` directly; `populate()` writes inputs, not cells. Cell renders happen only when a cell mutator (`cell.set`) is called, regardless of pattern.
- Cursor-jump guard: every populator does `if (input.value !== newValue) input.value = newValue;` so a user typing in input X is not interrupted when populate writes the same value back.

## Consequences

**Positive**

- Four bug classes (A/B/C/D) become structurally impossible at any site that follows the contract.
- One audit rule: every mutation goes through a mutator, every mutator calls populate, every input has a populator.
- Globals (~15 in Component Designer) are deleted. Reduces module-level state; TypeScript compiler finds every leftover reference.
- Inspector's `saveNode()` harvest disappears. Any field that exists on a cell is now editable without separately wiring up the harvest list.

**Negative**

- One-time refactor cost across `component-designer.ts` (~6,200 lines) and `inspector.ts` (~3,200 lines). Touches many sites.
- Build/Populate split adds ~one helper function per input panel section.
- New developer discipline: every new input must (a) register a populator, (b) write via a mutator, never directly.

**Open follow-ups**

- The persistent floor-anchor for the Shape label (Task 5 in REFACTOR-PLAN.md) is orthogonal but related: a stable floor anchor would simplify some populate paths. Not blocked, not blocking.
- If panel sizes ever grow to the point where `populate()` becomes measurable in a profile, switching to (i) Observer per-field is a local refactor — the chokepoints already exist.

## Status

Implementation started 2026-05-21. Phased rollout — the Component Designer's Icon panel popup is fully migrated; remaining sections will follow the same recipe.

### Done

**Infrastructure** (`component-designer.ts`):

- `populators: Array<() => void>` registry + `registerPopulator(fn)` / `clearPopulators()` / `populate()` helpers (after `setShapeLabel` declaration). `populate()` is wrapped in try/catch per populator so a stale-DOM reference can't break the chain.
- The six per-entity Component-Designer chokepoints (`updateIcon`, `addIcon`, `removeIcon`, `setMainIcon`, `reorderIcons`, `updateLayer`) now end with `populate()` after `markDirty` + render.
- `openIconEditor`: calls `clearPopulators()` before rebuilding DOM, pre-syncs legacy globals from the entry before build (so not-yet-migrated build code still reads correct values), and calls `populate()` after build. Close button also clears populators.

**Icon panel popup — migrated fields** (all now read from the entry via populator, all writes go through `updateIcon` with no parallel global write):

- Face switcher (Placement) — the anchor bug at `component-designer.ts:3278–3283` is fixed structurally; the build never reads the global, the populator runs after build with the right entry.
- Icon picker grid (catalog selection + AWS color/mono variant swap)
- Adaptive icon toggle + bg-enabled-driven visibility
- AWS mono/color mode switcher
- Background color display (`syncIconBgColorDisplay` — now an entry-reading populator; legacy module-level reference preserved for backward-compatible callers)
- Background shape switcher + per-shape control visibility (square→corner radius, octagon→cut depth)

**`collectCurrentDef` legacy bake removed.** A follow-up bug surfaced after the icon-picker migration: saving a Shape with a newly-changed icon produced a one-save-behind drift (icon updated in the entry, but the saved `ShapeDefinition` carried the previous icon's baked `href`, so System Designer instances kept showing the old icon until a second save). Cause: `collectCurrentDef` re-baked an `iconHref` from the `selectedIcon` / `selectedIcon*` globals and overwrote `icons[0].href` with it. Once the icon-picker migration removed the global writes, this re-bake used stale globals. Fix: deleted the entire legacy-bake block — `collectCurrentDef` is now a pure projection of the current Draft. Each entry's `href` is already correct via `applyIconToCurrentShape`.

**`applyIconToCurrentShape` legacy guard removed.** The renderer had an early-exit that read `selectedIcon` + `selectedIconBgEnabled` to decide whether to clear the icon overlay. With the entries as SoT, this was redundant with the multi-icon path below it; the legacy globals reads were the next drift vector in line. Replaced with an entry-only check.

**Shape Meta — rotation switcher migrated.** Default-rotation buttons used to read `selectedRotation` at build time; opening a Shape with `defaultRotation = 90` after one with `0` showed the old segment as selected until manually changed. Now a populator reads `selectedRotation` (still a module global, used internally by `applyRotation` / `collectCurrentDef`) and toggles the active segment on every `populate()`. `populate()` is called at the end of `syncExtrasFromShape` so shape-load triggers a refresh of all shape-level populators.

**Globals fully deleted (13 of them).** Every per-IconEntry global has been removed from the module:

- `selectedIcon`
- `selectedIconFace`
- `selectedIconSize`
- `selectedIconOffsetX`, `selectedIconOffsetY`
- `selectedIconSkewX`, `selectedIconSkewY`
- `selectedIconBgSize`, `selectedIconBgEnabled`, `selectedIconBgColor`
- `selectedIconBgShape`, `selectedIconBgRadius`, `selectedIconBgChamfer`
- `selectedIconMonochrome`, `selectedIconAdaptive`

All read sites now go through `currentEditingEntry()`; all write sites mutate the entry via `updateIcon`. The pre-sync block in `openIconEditor` (the 13-line "Sync legacy globals from the opened entry" block at lines 3282–3295) is gone. The DOM-sync block in `syncExtrasFromShape` (lines 4196–4259) is gone — it queried inspectorEl for elements that actually live in the floating popup, so it iterated zero elements anyway.

The dead helper `updateAdaptiveToggleVisibility` was deleted; the adaptive populator reads `entry.bgEnabled` to toggle visibility, and the bg-color handlers pass `adaptive: false` directly to `updateIcon` when enabling the background.

**`buildStepperRow` detached-input fix (inspector.ts).** Reported as the area-corner mode-toggle "lag": switching between unified-radius and per-corner mode left the visible display inputs showing stale values until the next interaction with the stepper. Root cause was the same detached-hidden-input bug that the prior session fixed in `component-designer.ts:buildSliderField`: the helper created the source-of-truth `<input>` but never appended it to the stepper element. Downstream code that walked from the input back to its display via `input.closest('.nr-sd-number-row')` got `null` (because `closest()` returns null on detached nodes) and silently skipped the display update. Fixed by appending the input with `display:none`. This was the last visible instance of the pattern across the codebase.

**Modifier-panel globals deleted (11 more).** After the user pushed back on leaving "works out of luck" code in place, the per-layer modifier globals were also eliminated: `selectedCornerRadius`, `selectedChamferSize`, `selectedChamferStart`, `selectedChamferBottomSize`, `selectedChamferBottomStart`, `selectedTaper`, `selectedTwist`, `selectedScaleTopX`, `selectedScaleTopY`, `selectedShedRoofDrop`, `selectedShedRoofDirection`. Each `apply*ToCurrentShape` function now takes a value parameter (single chokepoint per modifier — writes layer + cell + markDirty); the onChange handlers pass values directly. `syncInspectorToLayer`, `syncModifierFields`, `applyBaseShapeDefaults`, `syncExtrasFromShape` no longer write the globals; the save-defaults button reads from the current layer. Build-time reads of each modifier use `layers[selectedLayerIndex]?.X ?? default` directly.

**`selectedBaseShape` and `selectedStyle` deleted too.** Replaced by `currentBaseShape()` and `currentStyle()` helper functions that read fresh from `layers[selectedLayerIndex]` on every call. All ~40 read sites were migrated via global replace; the few writes (in dropdown handler, syncInspectorToLayer, layer-click/add/delete, syncExtrasFromShape) were either deleted (just-syncing-globals dead code) or rewritten to write `layer.baseShape` directly. Order fix in `loadShapeIntoCanvas`: the `layers` array reassignment was moved before `syncExtrasFromShape(id)` so downstream reads see the new shape's layers.

**Inspector field-drop fixes (`saveLink`, `saveZone`).** Both previously built their meta payload from scratch — any link/zone meta field not in the current input set was silently dropped on save. Now they spread `existing` first (same pattern as `saveNode`), preserving unknown fields.

### Final state

- `component-designer.ts`: 28 → 2 module globals (`selectedRotation` — Shape-level meta with no per-layer source; `selectedLayerIndex` — selection pointer). Everything else reads from `layers[selectedLayerIndex]` or per-icon `currentEditingEntry()`.
- `inspector.ts`: harvest patterns preserve existing meta via spread. `buildStepperRow` hidden input properly attached.
- `yarn tsc --noEmit`: clean.

**Documentation**:

- `CONTEXT.md` adds glossary entries for `Editor Draft`, `Populate`, `Mutator`.

### Remaining (carryover)

- ~~**Drag handlers commit-on-drop**~~ — Audited 2026-05-21: not actually a carryover. Per-frame work during drag (selection box, callout label, icon re-positioning, HUD input display, hit-area snap) is necessary visual feedback. There is no extraneous parallel model-write: the cell IS the model surface for size/position. JointJS handles size/position updates internally; everything else runs at frame rate because it has to. No populator runs during drag (populators are popup-scoped). Removed from the list.
- **Inspector live-refresh on external mutations** — Inspector inputs are repopulated on selection change (via `show(cell)`), not on external cell-meta mutations. If background code modifies `cell.get(META_KEY)` without the user re-selecting, inputs show stale values until the next selection. Fixing this requires `cell.on('change:meta', repopulate)` per show-call. No observed bug; deferred.
- **Shape Meta — displayName cursor guard** — `shapeNameInput` is user-typed and has no populator today. If a future change adds one, it must guard against overwriting in-progress typing (`if (input.value !== newVal && document.activeElement !== input)`). Note the constraint; no current bug.

### Verification

`yarn tsc --noEmit` is clean after each phase above. Manual UI verification (the Face switcher anchor bug) is the user's check — the dev server is not started by this implementation per the project's verification rules.
