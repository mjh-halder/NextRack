---
id: 0002
title: 2D Icon-Only View and Icon Rendering Developer Tool
status: done
created: 2026-05-26
labels: [2d-view, icons, theming, admin, dev-tool]
---

# PRD 0002 — 2D Icon-Only View and Icon Rendering Developer Tool

## Problem Statement

As a NextRack user, when I switch the System Designer to 2D mode I want every
Component to read as a clean, recognisable 40×40 icon — not as a flat-shaded
isometric projection with a frame around it. Today, the 2D view of a Shape
is just the iso geometry without the side faces: a coloured rectangle with
the icon shrunken in the middle. Pipes and channels stay 20×40 because the
underlying cell size is non-square. Selection outlines, hit areas and ports
follow that non-square cell, so a small pipe is harder to click than a
hexahedron and the visuals are inconsistent.

On top of that, the same Component shows up looking different in the System
Designer than it does in the Component Designer, because two separate code
paths build the 2D icon and they have drifted apart. Vendor icons (AWS / GCP
/ Azure) compound the problem: AWS icons ship with a coloured background
panel that sometimes you want to keep and sometimes you want to strip;
Carbon line icons need to be tinted black on a light background and white
on a dark one; GCP wants a white rounded-square plate behind a coloured
glyph. Hard-coding any of these rules per vendor leaves no escape hatch —
the developer cannot retune the behaviour without a code change.

As the NextRack developer, I want a tool — analogous to the existing Color
Adjustment tool — that lets me tune how each vendor's icons render in 2D,
separately for Light Mode and Dark Mode, live with a visible preview, and
export the result as a committable code default.

## Solution

### Two coupled features

**1. A unified 2D Icon-Only view** that is used by both the System Designer
and the Component Designer:

- Every Shape collapses visually to a centred 40×40 "default cell" (named
  `SHAPE_CELL_SIZE` and equal to two grid units).
- The shape body (all side faces, top, base) is not painted in 2D — only
  the icon is. No frame.
- The hit area (click / drag target) is 40×40, centred on the cell. A
  20×40 Pipe is therefore 40×40 clickable in 2D.
- The four magnet ports (front / back / left / right) sit on the edges of
  that 40×40 box, not on the underlying non-square footprint.
- The selection outline tracks the 40×40 box, not the cell footprint.
- The link-drawing connect-arrow tool is hidden in 2D (Ports remain the
  canonical link surface).
- Switching the view refreshes selection, tools, port positions, and the
  icon URL on every cell — nothing stays frozen from the previous view.

**2. A new admin tool "Icon Rendering"** with the same UX language as the
existing Color Adjustment tool, that tunes how the 2D icon is composed
**per vendor (Carbon, AWS, Azure, GCP) per mode (Light, Dark)**:

- Per (vendor, mode) the developer can set: icon tint (Original / Black /
  White / Custom hex), background colour, background shape (square /
  circle / octagon / none), background corner radius, a "strip vendor
  background" flag (for AWS icons that ship with their own panel), and an
  icon "oversize" factor (1.0–1.5) to defeat source-SVG padding.
- Live Light and Dark preview tiles update on every knob change.
- Reset-per-vendor and Export-as-code-defaults buttons.
- Settings auto-save to localStorage; the dispatched
  `nr-icon-rendering-change` event triggers immediate re-render across SD,
  CD and ComplexComponent canvases.
- Catalog sources that don't have their own vendor bucket
  (custom / grid-icon / uploaded) inherit the Carbon bucket because they
  are line art designed to be tinted.

### A single 2D-icon composition pipeline

Both designers funnel through one function, `icon2DHref(IconEntry)`. That
function reads the active vendor settings, resolves `currentColor` in the
glyph SVG to a concrete contrast colour, optionally strips the source's
background panel, composes the configured background plate, and produces a
data-URL `<image>` href that fits the 40×40 cell. There is no inline 2D
composition logic in any designer any more — all of them call this one
function. SD and CD render pixel-identical 2D icons.

## User Stories

1. As a NextRack user, I want every Component to look like a clean 40×40 icon in 2D mode, so that the canvas is easy to scan at a glance.
2. As a NextRack user, I want the 2D view to drop the side / top faces, so that the iso geometry doesn't visually fight with the icon when I'm reading the system layout.
3. As a NextRack user, I want a Pipe or a Channel (non-square footprint) to render as a 40×40 icon in 2D, so that long thin components don't look smaller than square ones.
4. As a NextRack user, I want the click / drag target of a Component in 2D to be 40×40, so that small Components are as easy to grab as large ones.
5. As a NextRack user, I want the selection outline in 2D to follow the 40×40 visual, so that what I see selected matches what I clicked.
6. As a NextRack user, I want the four magnet ports in 2D to sit on the edges of the 40×40 box, so that the visible drag-out points match the visible icon.
7. As a NextRack user, I want switching from 3D to 2D (and back) to update the selected Component's outline immediately, so that I don't see a stale outline that no longer matches the geometry.
8. As a NextRack user, I want the orange "connect-arrow" tool not to appear in 2D, so that the 2D overview view stays uncluttered.
9. As a NextRack user, I want resize handles to disappear in 2D, so that the overview view has no incidental editing affordances.
10. As a NextRack user, I want the connect-arrow tool to be gone in 3D as well (Ports are the canonical link surface), so that I have one consistent way to draw links.
11. As a NextRack user, I want connected neighbour Components NOT to be highlighted when I select a Component, so that the selection visual is unambiguous about what I selected.
12. As a NextRack user, I want Carbon icons in 2D to be black on a light background and white on a dark background, so that the icon reads with full contrast in either theme.
13. As a NextRack user, I want AWS icons in 2D to keep their original colour (and original background panel, when configured), so that the brand identity is preserved.
14. As a NextRack user, I want GCP icons in 2D to render on a white rounded-square plate, so that the multi-colour Google glyph reads on either theme without losing its brand look.
15. As a NextRack user, I want Azure icons in 2D to render in their original colours, so that they look as the vendor intended.
16. As a NextRack user, I want the same Shape to look identical in the Component Designer's 2D preview and in the System Designer's 2D canvas, so that what I design is what I place.
17. As a NextRack user, I want toggling Light / Dark mode to update every icon on the canvas immediately, so that mono icons don't stay frozen in the previous theme's contrast colour.
18. As a NextRack user, I want the Component Designer's Layers panel to disappear when I'm not editing a Shape, so that the editor doesn't show stale UI from a previous session.
19. As a NextRack user, I want White available as a preset background colour for icon-background pickers, so that I can pick the most common brand background without typing a hex.
20. As a NextRack user, I want the Display Preview HUD's Mode (Light / Dark) switcher to react on the first click, so that I don't have to click twice to get the expected toggle.
21. As the NextRack developer, I want a single configurable place to tune how 2D icons are composed, so that I can change "AWS Light Mode is too padded" without touching code in three places.
22. As the NextRack developer, I want one tuning section per vendor — Carbon, AWS, Azure, GCP — with one set of knobs for Light Mode and one for Dark Mode, so that I can give each vendor a distinct treatment in each theme.
23. As the NextRack developer, I want an "Icon tint" knob with Original / Black / White / Custom-hex options, so that I can keep brand colours, force a flat tint, or pick a specific colour per vendor.
24. As the NextRack developer, I want a per-vendor "Background colour + shape + radius" knob, so that GCP can ship with a white rounded-square plate by default and the other vendors can override per project.
25. As the NextRack developer, I want a per-vendor "Strip vendor background" toggle, so that AWS source SVGs (which include their own coloured panel) can be flattened to glyph-only when I want a cleaner look.
26. As the NextRack developer, I want a per-vendor "Icon oversize" slider (0.8–1.5), so that I can defeat the internal padding that some vendor SVGs ship with and make the glyph fill the 40×40 cell.
27. As the NextRack developer, I want a Light Mode preview tile and a Dark Mode preview tile side by side, so that I can judge contrast and tint in both themes simultaneously.
28. As the NextRack developer, I want the preview tile for each vendor to use a representative demo glyph (Carbon line art, AWS panel + glyph, Azure flat-colour glyph, GCP multi-colour glyph), so that the preview communicates the typical-case rendering.
29. As the NextRack developer, I want the preview to update live as I drag a slider or change a dropdown, so that the feedback loop is immediate.
30. As the NextRack developer, I want every settings change to auto-save to localStorage, so that I can refresh the page mid-tuning without losing my work.
31. As the NextRack developer, I want a Reset button per vendor that drops the localStorage overrides for both modes, so that I can undo my tuning without re-typing the defaults.
32. As the NextRack developer, I want an Export-as-code-defaults button that produces a TypeScript snippet for ALL four vendors, so that I can commit the current tuning as the new baseline in one paste.
33. As the NextRack developer, I want a status badge that tells me whether my current state is the baked default or a localStorage override, so that I never confuse "browser-only" with "committed".
34. As the NextRack developer, I want the same `icon2DHref` function used by SD, CD and ComplexComponent, so that fixing or tuning the 2D look in one place fixes it everywhere.
35. As the NextRack developer, I want `currentColor` in source SVGs (Carbon icons) resolved to a concrete contrast colour before embedding, so that the icon stays visible when the embedded SVG has no colour context.
36. As the NextRack developer, I want the per-IconEntry `bgEnabled` / `bgColor` (the iso authoring affordance) to NOT affect the 2D rendering, so that 2D look is purely a per-vendor concern.
37. As the NextRack developer, I want a per-IconEntry `iconColor` override (the iso authoring affordance) to still win over the vendor tint in 2D, so that I can deliberately recolour an individual placement.
38. As the NextRack developer, I want the `icon-rendering` module to be testable in isolation, so that I can verify that get/set/reset/export behave correctly without launching the app.
39. As the NextRack developer, I want the `icon2DHref` function to be testable in isolation, so that I can pin known-good composite URLs against fixtures per (vendor, mode) and notice regressions.
40. As the NextRack developer, I want the export snippet to be valid TypeScript that drops straight into the source file, so that committing a new baseline takes one paste, no editing.

## Implementation Decisions

### Module shape

**`icon-rendering` (new, deep)** — owns the per-vendor per-mode settings dimension:

- `IconVendor` union: `'carbon' | 'aws' | 'azure' | 'gcp'`. Catalog-source-to-vendor mapping via `vendorForSource(source)` — vendor codes pass through, everything else (`custom`, `grid-icon`, `uploaded`) buckets to `'carbon'` (mono treatment).
- `IconMode` union: `'light' | 'dark'`.
- `IconRenderSettings` interface (per vendor × mode):

  ```ts
  interface IconRenderSettings {
      iconTint: 'original' | 'black' | 'white' | string;  // string = hex
      bgColor: string;                                     // '' = no bg
      bgShape: 'square' | 'circle' | 'octagon' | 'none';
      bgRadius: number;
      stripVendorBackground: boolean;
      oversize: number;
  }
  ```

- `BAKED_VENDOR_RENDER_SETTINGS: Record<IconVendor, Record<IconMode, IconRenderSettings>>` — committed per-vendor defaults; the "code source of truth".
- `getIconRenderSettings(v, m)` / `setIconRenderSettings(v, m, patch)` / `resetIconRenderSettings(v, m?)` — localStorage-backed.
- `isIconRenderingDirty(v, m)` — true iff localStorage diverges from the baked default.
- `exportBakedIconRenderingCode()` — deterministic, paste-ready TS snippet generator.
- Dispatches `nr-icon-rendering-change` on every mutation.

**`utils.icon2DHref` (single composition path)** — pure function: given an `IconEntry`, resolves the catalog entry, picks the vendor bucket and the current mode, reads the live settings, applies the rules (strip vendor bg, resolve `currentColor`, tint, oversize, background plate), and returns a data-URL composite. Used identically by:

- `utils.applyRegistryDefaults` (System Designer single-layer shapes)
- `system-designer.applyIconAttrsToShape` (System Designer cell updates)
- `complex-component.ComplexComponentView.rebuildLayers` (System Designer multi-layer shapes)
- `component-designer.applyIconToCurrentShape` (Component Designer 2D preview)

No designer carries its own 2D composition logic.

Per-IconEntry overrides resolution (decision):

- `iconColor` (per-entry tint override) wins over the vendor `iconTint`.
- `bgEnabled` / `bgColor` / `bgShape` / `bgRadius` / `bgChamfer` are
  **iso-only authoring choices** and do not affect 2D. 2D background
  comes solely from the vendor settings.

**`utils.buildCompositeIconSvg`** — the underlying composite builder, moved out of `component-designer` so SD and CD share it. Knows nothing about vendors — it just stitches a viewBox, a background shape, a centred icon image, and an optional feColorMatrix filter into an SVG.

**`isometric-shape`** — every shape now publishes a `viewMode` model attribute (`'iso' | '2d'`), set in `toggleView`. The same method also calls `apply2DHitArea(twoD)`, which sets the `base`, `base2D`, and `hitArea` selector attrs to a centred 40×40 box in 2D and resets them to template defaults in 3D. `addTools(...)` unconditionally skips `CONNECT_KEY` so the orange connect arrow never appears.

**`ports`** — `getPortPositions(w, h, iH, view)` returns 40×40-centred positions when `view === '2d'`; otherwise returns the legacy bbox positions. Called from `IsometricShape.toggleView` so a view switch repositions ports.

**`hover-highlight`** — `getVisualBounds(cell)` reads `cell.get('viewMode')`. When `'2d'`, it returns a 40×40 box centred on the cell, regardless of the cell's underlying size. Otherwise it returns the existing rotation-aware bbox.

**`complex-component`** — the 2D branch of `rebuildLayers` no longer iterates layers. It picks the main `IconEntry` for the Shape and renders one centred 40×40 image via `icon2DHref`. The iso branch is unchanged.

**`system-designer`** — view-toggle handler refreshes the selected cell's tools (with `[]` in 2D, undefined in 3D), refreshes the selection outline via `refreshSelect`, and re-applies the icon for every cell on `nr-theme-change` / `nr-icon-rendering-change` (via `refreshAll2DIcons()`). Connection-highlighting (the grey ring on connected neighbours) is removed.

**`component-designer`** — `paper2D.el` carries the `nr-2d-icons-only` class statically. The CD's 2D composite path was removed; `applyIconToCurrentShape` now calls `icon2DHref(mainIcon)` for the 2D output. The "reapply layer styles" handler that listens to `nr-theme-change` and `nr-color-derivation-change` was extended to also rebuild the icon hrefs, and a third listener was added for `nr-icon-rendering-change`. The Display Preview HUD's Mode switcher calls `applyTheme(dark)` (exported from `index.ts`) directly instead of clicking the nav-theme button — the old click-handler inverted the state, causing the first click to no-op.

**`admin`** — `renderIconRenderingSection(container)` follows the same UX as the existing `renderColorAdjustmentSection`: vendor switcher, two-column Light / Dark layout with preview + knobs, status badge, reset button per vendor, export button with paste-ready snippet. The preview composites are produced via `buildCompositeIconSvg` directly against representative demo glyphs (one per vendor), so the preview works even when the real catalog hasn't loaded.

**`style.css`** — `.nr-2d-icons-only [joint-selector="base"]` and `... [joint-selector="base2D"]` get `fill: transparent` + `stroke: none`. The hit surface stays clickable but is invisible.

**`theme`** — new exported constant `SHAPE_CELL_SIZE = GRID_SIZE * 2` (= 40 px). The "edge length of a single shape cell" — referenced everywhere the 2D footprint is 40×40.

### Persistence

- **Baked baseline:** `BAKED_VENDOR_RENDER_SETTINGS` in `icon-rendering.ts`.
- **Per-vendor / per-mode override:** localStorage key `nr-icon-rendering-v1`, JSON object shape `Partial<Record<IconVendor, Partial<Record<IconMode, Partial<IconRenderSettings>>>>>`. Written on every change.
- **Loading:** lazy on first read per (vendor, mode), merged with the baked baseline (so adding a new field in the future falls back to the baked value rather than crashing).

### Vendor defaults (current bake — committed in source)

| Vendor | Light tint | Light bg | Light strip | Light oversize | Dark tint | Dark bg | Dark strip | Dark oversize |
|--------|-----------|----------|-------------|----------------|-----------|---------|-----------|---------------|
| carbon | original  | —        | no          | 1.00           | white     | —       | no        | 1.00          |
| aws    | original  | —        | no          | 1.20           | original  | —       | no        | 1.20          |
| azure  | original  | —        | no          | 1.00           | original  | —       | no        | 1.00          |
| gcp    | original  | #ffffff sq r=8 | no    | 1.00           | original  | #ffffff sq r=10 | no | 1.00      |

### Re-render trigger

A change to any of three events triggers a full canvas re-render:

- `nr-theme-change` (Light / Dark toggle)
- `nr-color-derivation-change` (Color Adjustment slider)
- `nr-icon-rendering-change` (Icon Rendering slider, this PRD)

Both designers and `ComplexComponentView` subscribe to all three.

### Out-of-flow concerns

- **currentColor resolution.** Carbon icons ship with `fill="currentColor"`. When loaded through an `<image href="data:...">`, the embedded SVG has no colour context, so `currentColor` falls back to a browser default (often invisible-on-white). `icon2DHref` resolves `currentColor` to a concrete contrast hex (black on light, white on dark) before embedding.

- **Cell footprint vs. visual footprint.** The underlying cell size (e.g. 20×40 for Pipe) is unchanged in 2D. Only the *visual* footprint, the hit-area attr, the selection-outline calculation, and the port positions are remapped to 40×40. Links anchored at modelCenter still hit the cell centre, which is also the icon centre.

- **`viewMode` model attribute.** Stored on every IsometricShape via `set('viewMode', ...)`. Read by `hover-highlight.getVisualBounds` (no other code path needs it). Set in `toggleView`.

### Backward compatibility

- Existing per-Shape custom colours (iso authoring choices on `IconEntry`) are unaffected in iso. They are intentionally ignored in 2D (decision above).
- Components placed before this PRD render correctly because the new pipeline is read-only against the existing `ShapeDefinition` / `IconEntry` schemas.

## Testing Decisions

### What makes a good test here

A good test exercises the **external behaviour** of the pure modules:

- For `icon-rendering`: given a vendor and a mode, what does `getIconRenderSettings` return? What does `setIconRenderSettings` persist? Does `exportBakedIconRenderingCode` round-trip into a valid TypeScript literal that matches the type? Does `vendorForSource` map known and unknown sources correctly?
- For `icon2DHref`: given a fixture `IconEntry` and a known settings configuration, what data URL comes out? Does the output respect the vendor settings? Does the per-entry `iconColor` override beat the vendor tint? Does `bgEnabled` get ignored in 2D (per-entry bg is iso-only)?

Tests don't poke at how the SVG string is assembled, don't mock `Math.cbrt`, don't snapshot full XML. They assert on the *user-visible promises*:

- A Carbon entry in Light mode → glyph tinted black, no background.
- A Carbon entry in Dark mode → glyph tinted white, no background.
- A GCP entry in Light mode → white square background, original colour glyph.
- An AWS entry with `stripVendorBackground=true` → glyph SVG no longer contains the original `<rect>` panel.
- An entry with `iconColor='#ff0000'` → glyph tinted red regardless of the vendor tint.
- An entry with `bgEnabled=true` → 2D output contains no background (iso-only signal).

### Modules to test (confirmed scope)

- **`icon-rendering`** — pure data + getter/setter, deterministic vendor mapping, deterministic export snippet. Unit tests against fixtures.
- **`utils.icon2DHref`** — pure function. Unit tests against per-vendor fixture entries × per-mode settings, asserting the user-facing promises listed above.

Out of test scope (DOM glue, JointJS interaction, event-driven re-render): the admin Icon Rendering section, the SD / CD theme-change wiring, ComplexComponentView. These are thin compositions over the deep modules and are easier to verify by visual inspection in the app.

### Prior art

The Color Adjustment tool (PRD 0001) introduced Vitest in this repo and shipped `src/color-derivation.test.ts` as the reference test file. The new tests follow the same shape: ESM, Node environment, fixture-driven, `expect`-based assertions on pure-function output. No new tooling is needed.

## Out of Scope

- **3-tone face shading.** The light/side/front lightness deltas in the iso view (`deriveFaceShades`) are an extension of PRD 0001's Color Adjustment work and are tracked there — not in this PRD.
- **Display Preview HUD click bug, Layers section auto-hide, Connection-highlight removal, White in PRIMARY_COLORS, `applyTheme` exported.** Each of these is a small, self-contained fix shipped alongside this PRD but is not a deep-module change. They will be commit-level notes, not their own PRDs.
- **Adding new vendor buckets** beyond Carbon / AWS / Azure / GCP. The shape of `IconVendor` is a closed union for now; adding a fifth vendor is a future code change.
- **Tuning the per-IconEntry `iconColor`** or `bgColor` pickers in the Inspector. Those are end-user authoring affordances and live outside the per-vendor pipeline.
- **An Inspector-level per-Shape override for vendor settings.** End users get one rendering policy per vendor (set by the developer); they don't pick "this AWS Component should be stripped, this one shouldn't".
- **Animated transitions** when toggling between 2D and 3D. The switch is instantaneous by design.
- **Resize behaviour while in 2D.** Resize tools are intentionally not shown in 2D; live re-positioning of the 40×40 hit area on cell resize is not required because the relevant tools are inactive.

## Further Notes

- The Icon Rendering admin tool intentionally mirrors the UX of the existing Color Adjustment tool: developers learn one pattern (vendor switcher + status badge + Reset + Export) and apply it to a second tuning dimension.
- The vendor source mapping (`vendorForSource`) gives custom / grid-icon / uploaded icons "Carbon-style" tinting by default. This matches how `iconKeepsOriginalColor` already classifies them in the rest of the app.
- `icon2DHref`'s decision to ignore the per-IconEntry `bgEnabled` flag in 2D is deliberate: per-Entry background is an iso authoring choice, and silently re-using it in 2D produced double-painted plates (vendor plate + entry plate) that the user had to disable manually. Splitting the two dimensions cleanly resolves the recurring "background shows up twice" class of bugs.
- `applyTheme` was promoted from a module-private function in `index.ts` to a named export so the Display Preview HUD's Mode switcher can call it directly. The previous workaround (`navBtn.click()`) re-entered the theme-toggle handler and inverted the state on the first click — a textbook double-toggle bug. Calling `applyTheme(dark)` once is the simple fix.
