---
id: 0008
title: System Designer — Display Settings Hub (Grid Visibility, Opacity, Pitch, Size)
status: done
created: 2026-05-29
closed: 2026-05-29
labels: [system-designer, ui, grid, display, persistence, refactor]
---

# PRD 0008 — System Designer: Display Settings Hub

## Outcome (2026-05-29)

Closed as `done`. A popover-style "Display Settings" hub sits next to the iso/2D
toggle in the System Designer's top-right corner. Five controls in one place:
Grid show/hide, Grid opacity, Cell Pitch (visual grid-line spacing
multiplier), Grid Width, Grid Height. All values persist per canvas via the new
`DisplayMeta` shape that round-trips through `canvas-store.ts`,
`persistence.ts`, and the file save/load path. The previous "Adjust Grid Size"
modal and the "Toggle Grid" / "Adjust Grid Size" Top-Header menu entries are
removed. Cell Pitch is intentionally **display-only** — it changes the
gridline visual cadence but does NOT touch snap raster, obstacles, paper
dimensions, or shape geometry. Soft-limit on Width/Height prevents accidentally
scrubbing shapes off the grid. Drag-to-scrub cursor is handled with a
transparent full-screen overlay so the `ew-resize` cursor persists across the
canvas (which sets its own `cursor: grab`).

## Problem Statement

As a System Designer user, I want a single, calm place to adjust how the canvas
*looks* — grid visibility, opacity, gridline spacing, and overall grid size —
without going through a modal dialog or hunting menu entries that hide one
setting each. Today:

- "Toggle Grid" is buried in the View menu of the global top-header.
- "Adjust Grid Size" opens a modal with three text inputs (Width, Height, Cell
  Size in px). The modal interrupts the canvas, and the Cell Size field is
  half-implemented: changing it leaves Minimap, ISO transformation matrix, and
  shape positions out of sync because ~190 call sites still reference the
  `GRID_SIZE` constant directly instead of the runtime `currentCellSize`.
- Reducing Width/Height in the modal can move shapes "off the grid" — the
  shapes remain in the model at coordinates outside the new bounds, visually
  hanging in empty space, with no warning.
- Display-state (gridVisible, etc.) is not persisted per diagram. Reload
  resets it; switching between canvases inherits whatever the previous one
  had. The `saveDefaultDesign` localStorage path silently omits Width/Height
  even though the file-export JSON includes them.

The user wants a small popover triggered by a Carbon `ColorPalette` icon
button, visually analogous to the Component Designer's "Display Preview" HUD,
where all five display controls live together and changes are reflected
instantly on the canvas.

## Solution

A `ColorPalette16`-icon trigger button sits inside the existing
`#view-toggle-container` (top-right, flex layout next to the iso/2D segmented
control). Clicking it opens a popover panel below the trigger with five items
in a fixed order:

1. **Grid** — segmented control with `Show` / `Hide`, same visual class as the
   iso/2D toggle.
2. **Opacity** — number stepper (0–100 %, step 10), live commit.
3. **Cell Pitch** — number stepper with four discrete stages `½× / 1× / 2× / 4×`,
   live commit. Multiplies the gridline spacing on top of `GRID_SIZE` —
   *display only*, snap stays at 20 px.
4. **Width** — number stepper, commits only on pointer-up. Soft-limit at the
   bbox of existing shapes.
5. **Height** — same as Width.

A Carbon-style × button in the panel's top-right corner closes the popover.
The popover also closes on Escape, on click outside, or on a second click on
the trigger. Default state: closed.

All five values are persisted per diagram as a new `DisplayMeta` shape, which
travels with the diagram through every save/load path: `saveCanvasGraph` /
`loadCanvasGraph` for the active per-canvas store, `saveGraph` / `loadGraph`
for the file export round-trip, and `saveDefaultDesign` for the legacy
localStorage default.

The previous "Adjust Grid Size" modal and the two Top-Header menu entries
(`view-toggle-grid`, `model-adjust-grid`) are removed. `showAdjustGridModal`
and the `currentCellSize` variable are deleted from the System Designer.

## User Stories

1. As a System Designer user, I want a single popover that consolidates every
   display-related setting (grid visibility, opacity, pitch, width, height) so
   I do not need to remember which menu entry hides which control.
2. As a System Designer user, I want to open and close the popover by clicking
   a small icon button next to the iso/2D toggle, so it stays out of the way
   when I am not configuring the display.
3. As a System Designer user, I want the popover to default to closed so it
   does not occupy canvas pixels until I open it.
4. As a System Designer user, I want to toggle grid visibility via a
   `Show` / `Hide` segmented control inside the popover, so I do not have to
   reach into the global top-header.
5. As a System Designer user, I want grid opacity to be a stepper (0–100 % in
   steps of 10), so I can fine-tune how prominent the grid is.
6. As a System Designer user, I want opacity changes to apply live while I
   scrub the value, so I can pick a value by eye instead of trial-and-error
   commits.
7. As a System Designer user, I want a Cell Pitch stepper with four discrete
   stages (½×, 1×, 2×, 4×) so I can make the grid "denser" or "more airy"
   without breaking snap behaviour.
8. As a System Designer user, I want Cell Pitch to be display-only: when I
   change it, my shapes do NOT move, the snap raster does NOT change, and the
   paper dimensions do NOT change. Only the gridline spacing visually shifts.
9. As a System Designer user, I want Cell Pitch values to remain on grid
   multiples so the visual lines always coincide with snap positions
   (½× → lines every 10 px, 1× → every 20 px, 2× → every 40 px, 4× → every
   80 px).
10. As a System Designer user, I want Width and Height steppers to adjust the
    grid extent in cell counts, so I can grow or shrink the canvas to match my
    layout needs.
11. As a System Designer user, I want a soft-limit on Width and Height so I
    cannot accidentally scrub shapes "off the grid" — the stepper minimum is
    the bounding box of all existing shapes (rounded up to the next cell),
    floored at 5.
12. As a System Designer user, I want Width / Height changes to commit only on
    pointer-up (not during scrub), because resizing the paper, rebuilding the
    obstacle grid, and re-rendering the minimap is too expensive for live
    updates.
13. As a System Designer user, I want every stepper to support drag-to-scrub
    on its number display, in addition to `−` / `+` buttons.
14. As a System Designer user, I want the scrub cursor (`ew-resize`) to stay
    visible as long as I am dragging, even when I move outside the popover
    over the canvas — so the interaction feels stable.
15. As a System Designer user, I want the popover to inherit the existing
    Inspector-shift behaviour: when the Inspector panel opens, the popover
    slides left by 350 px along with the iso/2D toggle.
16. As a System Designer user, I want display settings to persist per
    diagram: when I switch from canvas A to canvas B, canvas B remembers its
    own grid configuration.
17. As a System Designer user, I want display settings to be included in
    `Save` / `Open` round-trips, so JSON exports carry the gridConfig and
    re-importing produces the same look.
18. As a System Designer user, I want display settings to survive a reload
    of the example canvas (the `saveDefaultDesign` localStorage path).
19. As a System Designer user, I want legacy saved files that predate
    DisplayMeta to still load — missing fields fall back to current defaults,
    no error.
20. As a System Designer user, I want the close button to sit in the top-right
    corner of the popover (Carbon Modal pattern), not inline in the header.
21. As a System Designer user, I want every stepper and the segmented control
    in the popover to be the same height (28 px) and the same width (110 px),
    so the panel visually lines up.
22. As a System Designer user, I want stepper styling that matches the
    Carbon NumberInput pattern (no full border — only a `border-bottom`
    underline and a Carbon `field-01` background), consistent with the
    Inspector steppers.
23. As a Carbon design follower, I want the popover to use Carbon tokens
    (`field-01`, `border-strong-01`, `text-primary`, `icon-primary`,
    `layer-hover-01`, `field-hover-01`, `support-success`, etc.) for both
    light and `cds--g100` dark themes.
24. As a Component author moving between canvases, I want the popover to
    refresh its displayed values when a new canvas loads, so what I see
    matches the diagram I just opened.
25. As a maintainer, I want the `currentCellSize` variable removed, because
    Cell Pitch is now display-only and the existing partial Cell-Size
    implementation was the source of Minimap/transformationMatrix/shape drift.
26. As a maintainer, I want the `showAdjustGridModal` function deleted —
    replaced entirely by the popover.
27. As a maintainer, I want the `view-toggle-grid` and `model-adjust-grid`
    menu entries and their switch-cases removed.
28. As a maintainer, I want the soft-limit computed live from
    `graph.getElements()` so it adapts to whatever shapes the user has
    placed.
29. As a maintainer, I want a single `currentDisplayMeta()` snapshot helper
    and a single `applyDisplayMeta(meta)` apply helper, so the three
    persistence paths (canvas-store, persistence.ts file save/open,
    saveDefaultDesign) share the same shape and validation logic.
30. As a maintainer, I want `applyDisplayMeta` to defensively validate
    incoming values (type-guarded Cell Pitch, range-clamped Opacity,
    typeof-guarded counts and booleans) so a corrupt JSON file cannot
    silently break the runtime state.
31. As a maintainer, I want `loadCanvasGraph` to return `DisplayMeta | null`
    so callers can distinguish "canvas not found" from "canvas found, no
    display meta yet".
32. As a maintainer, I want `loadGraph`'s callback signature widened to
    `(display?: DisplayMeta) => void` so file-open round-trips display
    settings without a separate API.
33. As a maintainer, I want the drag-to-scrub cursor handled by a
    transparent full-screen overlay that is added on mousedown and removed
    on mouseup *and* on window blur. Setting `document.body.style.cursor`
    is not sufficient — `paper.el { cursor: grab }` wins on hover, and a
    mouseup outside the browser window strands the override.
34. As a maintainer, I want the popover to live inline inside
    `system-designer.ts` (not a new module), consistent with how the
    Component Designer's "Display Preview" HUD is structured.
35. As a maintainer, I want unit-test coverage for the soft-limit
    computation as the one piece of pure logic worth locking down.

## Implementation Decisions

### Modules touched

- **System Designer** (`system-designer.ts`) — hosts the hub trigger button,
  popover, all five stepper/seg-toggle items, the `rebuildGrid()` helper,
  `applyGridResize(newX, newY)` (the `newCellSize` parameter is removed),
  the soft-limit computation `computeGridSoftMin()`, the
  `currentDisplayMeta()` and `applyDisplayMeta()` helpers, and the wiring
  into the three persistence paths.
- **Canvas store** (`canvas-store.ts`) — exports new `DisplayMeta` type;
  `saveCanvasGraph(id, graph, display?)` accepts the display payload;
  `loadCanvasGraph(id, graph)` returns `DisplayMeta | null`.
- **Persistence** (`persistence.ts`) — `saveGraph(graph, display?)`,
  `saveDefaultDesign(graph, display?)`, and `loadGraph(graph, onLoaded)` with
  the callback widened to `(display?: DisplayMeta) => void`.
- **Utils** (`utils.ts`) — `drawGrid(...)` accepts a 6th `opacity` parameter
  (default 1) that writes `stroke-opacity`; new `setGridOpacity(gridVEl, v)`
  helper for live updates without a path rebuild.
- **Top Header** (`top-header.ts`) — the `view-toggle-grid` and
  `model-adjust-grid` menu entries are deleted.
- **CSS** (`style.css`) — `#view-toggle-container` switches to
  `display: flex; gap: 6px`; new `.nr-sd-hub-*` rules for the trigger,
  popover panel, header, divider, close button, items, label, stepper,
  display, and step buttons; `.nr-sd-hub-item .nr-seg-control` gets a 110 px
  width to line up with the steppers.

### `DisplayMeta` shape

```ts
interface DisplayMeta {
    gridCountX?: number;
    gridCountY?: number;
    gridVisible?: boolean;
    gridOpacity?: number;       // 0..1
    gridCellPitch?: number;     // 0.5 | 1 | 2 | 4
}
```

All fields optional so legacy saves load unchanged. `applyDisplayMeta`
validates each field independently.

### Hub layout

- Trigger: `<button class="nr-sd-hub-trigger">` with `ColorPalette16` icon.
  Carbon styling: `28×28`, `field-01` background, `border-strong-01` border,
  hover and `[aria-expanded="true"]` states.
- Popover: `<div class="nr-sd-hub-panel" hidden>`, absolutely positioned at
  `top: calc(100% + 6px); right: 0` inside the fixed container. A `[hidden]`
  override is needed because `display: flex` overrides the user-agent
  `display: none` rule.
- Header: title `Display Settings` (uppercase, letter-spaced) plus an
  absolutely positioned `32×32` × button in the top-right corner (Carbon
  Modal pattern).
- Items: every row is `display: flex; justify-content: space-between` with a
  text label on the left and a control on the right. All controls share a
  fixed 110 px × 28 px footprint.
- Divider between Item 3 (Cell Pitch) and Item 4 (Width) separates
  "Display" from "Size".

### Stepper builder

A local `buildStepper(opts)` helper inside `initDisplaySettingsHub` produces a
row with `−` / display / `+` controls. Common parameters:

- `getValue` / `setValue` / `commit` — the three-step interaction (read,
  write, side-effect).
- `format(v)` — how the display renders the current value.
- `minFn` / `maxFn` — bounds (called per interaction so soft-limits can be
  dynamic).
- `stepFn(v, dir)` — one tap is one step (lets Cell Pitch jump by index
  instead of by raw unit).
- `scrubPxPerUnit` — drag sensitivity.
- `liveCommit` — whether each scrub-tick commits or only the final
  pointer-up commits.

The Grid Visible row uses a sibling `buildSegToggle(opts)` helper that
emits `.nr-seg-control` + `.nr-seg-btn` markup matching the existing
iso/2D segmented control.

### Live-commit vs. on-release matrix

| Item | Live commit during scrub | Reason |
|---|---|---|
| Grid (Show/Hide) | N/A (click only) | Segmented control |
| Opacity | yes | `setGridOpacity` is one attribute write |
| Cell Pitch | yes | `rebuildGrid()` is a single path replacement |
| Width | no — pointer-up | `applyGridResize` rebuilds obstacles, paper dims, minimap |
| Height | no — pointer-up | same |

### Soft-limit on Width / Height

`computeGridSoftMin()` iterates `graph.getElements()`, tracks the maximum
`bbox.x + bbox.width` and `bbox.y + bbox.height`, and returns
`{ minX: max(5, ceil(maxRight / GRID_SIZE)), minY: max(5, ceil(maxBottom / GRID_SIZE)) }`.

Called once on every popover open. The stepper's `minFn` reads from a
captured `softMin` snapshot. While the popover stays open the snapshot does
not refresh, so the soft-limit is consistent within an editing session.

### Cell Pitch math

`rebuildGrid()` computes:

```ts
const step = GRID_SIZE * gridCellPitch;
const linesX = Math.round(currentGridCountX / gridCellPitch);
const linesY = Math.round(currentGridCountY / gridCellPitch);
drawGrid(paper, linesX, step, '#e8e8e8', linesY, gridOpacity);
```

So total area `linesX * step = currentGridCountX * GRID_SIZE` stays
constant — the grid covers the same canvas region regardless of pitch. Only
the number of visible lines changes. Snap remains at `GRID_SIZE = 20 px`.

### Persistence flow

- Snapshot: `currentDisplayMeta()` reads the five state variables into a
  `DisplayMeta`.
- Save paths: `saveCanvasGraph(activeCanvasId, graph, currentDisplayMeta())`
  on canvas switch; `saveGraph(graph, currentDisplayMeta())` on File → Save;
  `saveDefaultDesign(graph, currentDisplayMeta())` (analogous fix for the
  legacy localStorage path).
- Load paths: `applyDisplayMeta(loadCanvasGraph(activeCanvasId, graph))` on
  startup and on canvas switch; `loadGraph(graph, (display) => { ...; applyDisplayMeta(display); })`
  on File → Open.
- Apply: `applyDisplayMeta` defensively validates each field, calls
  `applyGridResize` or `rebuildGrid` as needed, and calls
  `refreshDisplayHub()` to re-sync the popover's displayed values.

### Hub-trigger toggle and outside-close

- Trigger button: click → `setOpen(panelEl.hidden)` (toggle).
- Close button: click → `setOpen(false)` plus focus restoration to trigger.
- Outside click: a document-level `mousedown` listener that closes only if
  the popover is open and the event target is neither inside the panel nor
  inside the trigger.
- Escape: a document-level `keydown` listener that closes only if the
  popover is open.

### Cursor handling during scrub

A transparent full-screen overlay div is appended on mousedown with:

```css
position: fixed; inset: 0; z-index: 99999; cursor: ew-resize; background: transparent;
```

It captures cursor display for the entire viewport, beating per-element
cursor declarations like `paper.el { cursor: grab }`. `mousemove` events
still reach the document-level listener via bubbling, so the scrub
arithmetic continues to work.

Removed on **mouseup** *and* on **window blur** — handles both the normal
mouseup and the case where the user releases the mouse outside the browser
window (no mouseup arrives).

This pattern is strictly tied to the hub. The Inspector steppers' existing
`document.body.style.cursor = 'ew-resize'` pattern stays unchanged because
their narrow scrub range typically doesn't cross the canvas.

### Carbon styling alignment

- Stepper: no outer border. Display and step buttons each carry their own
  `border-bottom: 1px solid var(--cds-border-strong-01)` and
  `background: var(--cds-field-01)`. Step buttons have an additional
  `border-left: 1px solid var(--cds-border-subtle-01)` divider.
- Segmented control: `.nr-seg-control` styles are reused; width is forced
  to 110 px in the hub item context for visual alignment with steppers.
- Close button: absolutely positioned at `top: 0; right: 0; width: 32px; height: 32px`
  inside the panel — same pattern as the Carbon Modal close.
- Dark theme (`.cds--g100`) overrides every color token explicitly.

### Deletions

- `showAdjustGridModal` function (~120 lines).
- `currentCellSize` state variable.
- `newCellSize` parameter on `applyGridResize`.
- Switch-cases `view-toggle-grid` and `model-adjust-grid` in the header-action
  listener.
- Menu entries with the same actions in `top-header.ts`.

## Testing Decisions

This PRD ships one new automated test: a Vitest unit test for
`computeGridSoftMin`. The test treats the function as a pure black box —
inputs are an iterable of bbox-bearing objects, output is a
`{ minX, minY }` pair — and asserts external behaviour only:

- Empty graph → `{ minX: 5, minY: 5 }` (the hard floor).
- Single small shape contained well inside the grid → minimums equal the
  shape's right/bottom edge in cell units, rounded up.
- Multiple shapes — minimums equal the union extent, not the per-shape
  extent.
- Shapes that already touch the grid edge → minimums equal the current
  grid count (cannot shrink further without losing the shape).
- Zero-size or negative-extent shapes → minimums fall back to the hard
  floor.

What makes this a good test: it asserts the contract callers depend on
(soft-limit prevents shape loss), not the implementation (the `ceil`,
`max`, iteration form). Refactors that keep the contract pass without
changes.

Prior art: `color-derivation.test.ts` and `icon-resolver.test.ts` — both
pure-function tests via Vitest with no DOM, canvas, or framework
dependencies.

Things deliberately not tested in automation:

- The hub UI rendering, popover open/close behaviour, drag-to-scrub
  arithmetic, and cursor-overlay lifecycle. Visual concerns best
  validated by hand against the live canvas.
- `applyDisplayMeta`'s field-by-field validation. The branches are simple
  type guards; covering them with tests would add code-shaped noise
  without protecting against a realistic failure mode.
- `drawGrid` and `setGridOpacity`. DOM-coupled, no useful invariant to
  lock down beyond "the attribute is set".

## Out of Scope

- The full Cell-Size refactor that would replace the `GRID_SIZE` constant
  (~190 import sites) with a runtime variable. Cell Pitch stays
  display-only on purpose to avoid that blast radius.
- Synchronising the Minimap's gridline rendering with Cell Pitch. The
  Minimap continues to render at the snap raster.
- Auto-moving or auto-clipping shapes when Width/Height is reduced. The
  soft-limit avoids the problem at the source; clipping logic is not
  needed.
- Extracting the stepper into a reusable component. The CD has its own
  inline stepper, the Inspector has its own; the hub matches the same
  inline-helper pattern.
- Adding further display knobs (canvas background, axis labels, callout
  visibility, snap toggle, etc.). The hub is intentionally limited to the
  five existing items.
- A separate "display presets" system (save/load named configurations).
  No-one has asked for it; per-diagram persistence is enough for the
  MVP roadmap.
- Persisting display settings as a global user preference. The decision
  was explicit: display settings live per diagram, so the look follows
  the diagram on switch.
- Replacing the Inspector's stepper or the CD's stepper with the hub's
  builder. They are orthogonal use-cases.

## Further Notes

- The hub lives inline in `system-designer.ts` rather than in a new
  `display-settings-hub.ts` module. The rendering is tightly coupled to
  the System Designer's `gridVisible`, `gridOpacity`, `gridCellPitch`,
  `currentGridCountX/Y` state, plus the `paper`, `gridVEl`, and
  `obstacles` instances. Extracting would create a thick interface for a
  flat UI surface — net negative.
- The cursor-overlay pattern (transparent full-screen div with
  `cursor: ew-resize`, removed on mouseup AND window blur) is the
  bulletproof variant. The first attempt at this — setting
  `document.body.classList.add('nr-scrubbing')` with a global
  `body.nr-scrubbing * { cursor: ew-resize !important }` rule — failed
  because a missed mouseup (e.g. mouse released outside the browser
  window) left the class on body, then every input in the app
  inherited the override. The overlay-based variant cannot strand
  because the overlay element itself disappears on cleanup.
- `saveDefaultDesign` was previously missing `gridCountX/Y` even though
  the file-export JSON included them. This PRD closes that gap by
  routing DisplayMeta through every persistence path.
- The popover-vs-modal decision rested on the fact that display
  settings are a calm, low-frequency interaction. A modal would
  needlessly seize the canvas; a popover stays adjacent to the
  iso/2D toggle and lets the user keep working.
- `loadCanvasGraph` returns `DisplayMeta | null` rather than the previous
  `boolean`. Existing call sites in `system-designer.ts` did not consume
  the return value as a boolean, so the migration was lossless.
- The trigger button uses `ColorPalette16` rather than a dedicated
  "settings" gear — the user explicitly requested the
  `icon Color palette` Carbon glyph, which sits semantically between
  "color" and "display" without overlapping the existing gear icons
  (e.g. `SettingsView16`) used elsewhere.
