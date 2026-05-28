---
id: 0001
title: Color Adjustment Developer Tool
status: done
created: 2026-05-26
labels: [color, theming, dev-tool, admin]
---

# PRD 0001 — Color Adjustment Developer Tool

## Problem Statement

As the developer of NextRack, I want to tune the default colours that every
new Shape ships with — both the per-vendor presets (Microsoft Blue, Amazon
Yellow, Google Neutral) and the neutral default — without going into the
source code, re-deriving four hex values by hand for each Light/Dark
combination, or pushing a code change every time I want to see how a
slightly different tint looks on the canvas.

Today, when I want to change a Shape's default colours I either edit a
hardcoded table in `shape-capabilities.ts`, or I tweak the four output
values per theme (light.fill, light.edge, dark.fill, dark.edge) by hand —
which means I keep four hex codes in my head per vendor, and Light/Dark
visually drift apart because nothing keeps them coherent.

The colours also have to behave correctly across the Light Mode and Dark
Mode grids: shapes need to read clearly on both backgrounds, the
edge/outline has to provide enough contrast against the fill in both
modes, and the hue/character of the colour must not shift between modes.

## Solution

Introduce a central colour-derivation pipeline driven by **one base hex per
semantic colour**. The pipeline derives four shape-rendering tokens from
that base — `light.fill`, `light.edge`, `dark.fill`, `dark.edge` — using
OKLCH so the perceived hue stays stable when the colour is lightened or
darkened, and chroma can be reduced separately for Light vs. Dark modes so
saturated colours don't go neon on the dark grid.

The pipeline is driven by a small set of tuning parameters per theme
(lightness deltas for fill and edge, chroma multipliers, neutral-mode
absolute lightness targets). Those parameters live in two places:

1. **`BAKED_THEME_SETTINGS`** — a per-theme constant committed in
   `color-derivation.ts`. This is the production baseline every browser
   sees on first load.
2. **`localStorage`** — per-theme overrides written automatically while a
   developer tunes the sliders in the admin tool. Browser-local only.

A new section **"Color Adjustment"** in the admin **User Settings** view
gives me, the developer, the live tuning controls:

- A theme switcher across the four tunable themes (Default, AWS, GCP, Azure).
- A slider grid for the active theme's derivation parameters.
- Live re-render of every Shape on every CD/SD canvas as I drag the sliders.
- A side-by-side Light/Dark mini-isometric preview of the active theme.
- A summary block showing the resulting hex tokens for ALL four themes.
- A status badge showing whether the active state is in sync with the
  baked code defaults or has been modified.
- A **Reset** button per theme that drops the localStorage override.
- An **Export as code defaults** button that prints the current per-theme
  settings as a TypeScript snippet I can paste back into
  `BAKED_THEME_SETTINGS` to commit the new baseline.

## User Stories

1. As the NextRack developer, I want one base hex per vendor preset, so that I never have to keep four hex values per vendor in my head.

2. As the NextRack developer, I want the four shape tokens (`light.fill`, `light.edge`, `dark.fill`, `dark.edge`) derived automatically from the base, so that Light and Dark modes stay visually coherent without manual work.

3. As the NextRack developer, I want the derivation done in OKLCH, so that the colour's hue and character stay perceptually stable when the value is lightened or darkened.

4. As the NextRack developer, I want a per-theme set of tuning parameters, so that I can give Azure a different lightness profile than AWS or GCP without forking the derivation logic.

5. As the NextRack developer, I want one tuning slider for each of: light-fill lightness, dark-fill lightness, light-edge contrast, dark-edge contrast, light chroma multiplier, dark chroma multiplier, so that I can shape the colour ramp with intent.

6. As the NextRack developer, I want a separate set of "neutral" parameters (absolute lightness targets and edge deltas) for neutral / near-grey colours, so that GCP-style greys don't follow the colour-mode deltas that work for saturated bases.

7. As the NextRack developer, I want a theme switcher in the admin tool that lets me jump between Default / AWS / GCP / Azure, so that I can tune one theme at a time without losing my place.

8. As the NextRack developer, I want only the relevant sliders shown for the active theme (colored knobs hidden when the theme is neutral, and vice versa), so that I'm not distracted by parameters that don't apply.

9. As the NextRack developer, I want my slider changes to auto-save to localStorage, so that I can refresh the page mid-tuning without losing my work.

10. As the NextRack developer, I want a clearly visible status badge in the admin tool that tells me whether my current tuning matches the baked code defaults or is a local override, so that I never confuse "browser-only" with "committed".

11. As the NextRack developer, I want a per-theme Reset button that drops the localStorage override and falls back to the baked code defaults, so that I can undo my tuning without manually retyping the original values.

12. As the NextRack developer, I want an **Export as code defaults** button that produces a TypeScript snippet of the current settings for all four themes, so that I can paste the snippet back into the source as the new committed baseline.

13. As the NextRack developer, I want the export snippet to be valid TypeScript that drops in as-is, so that committing a new baseline takes one paste and not an editing pass.

14. As the NextRack developer, I want a side-by-side Light-background and Dark-background preview of an isometric cuboid using the active theme's tokens, so that I can judge contrast and hue in both modes at the same time.

15. As the NextRack developer, I want a swatch column next to the preview showing the base hex and each of the four output tokens, so that I can read the exact resulting values.

16. As the NextRack developer, I want a summary block at the bottom of the admin tool showing the resulting tokens for all four themes, so that I can compare them at a glance.

17. As the NextRack developer, I want the Component Designer canvas to re-render every Shape with the new colours the moment I move a slider, so that the feedback loop is immediate.

18. As the NextRack developer, I want the System Designer canvas to re-render every placed ComplexComponent with the new colours the moment I move a slider, so that I see the effect across the whole app.

19. As a NextRack end user, I want my custom per-Shape colour picks (when I've chosen the **Custom** Color Theme in the inspector) to remain untouched when the developer adjusts derivation settings, so that my deliberate overrides are not silently rewritten.

20. As a NextRack end user, I want the Default / Azure / AWS / GCP themes I picked for a Shape to reflect the developer's current tuning when I open the app, so that visual updates ship with the app without my having to re-pick the theme.

21. As the NextRack developer, I want hue to remain perceptually stable when a colour is moved from base to either fill or edge, so that the colour does not visibly shift family (e.g. blue becoming purple) under the derivation.

22. As the NextRack developer, I want lightness to be clamped into the valid range under all slider combinations, so that an extreme slider value never breaks the SVG output.

23. As the NextRack developer, I want every output token to be a valid 6-digit hex, so that the renderer can stamp it directly into SVG `fill`/`stroke` attributes without further parsing.

24. As the NextRack developer, I want the central derivation pipeline to be testable in isolation, so that I can pin known good colour outputs against fixtures and notice regressions in derivation behaviour without launching the app.

## Implementation Decisions

### Module shape

- **`color-derivation` module** owns the entire pipeline:
  - Inline OKLCH math (`hexToOklch`, `oklchToHex`) — no external dependency.
  - `ColorDerivationSettings` interface — ten tunable parameters.
  - `TunableTheme` union of the four tunable theme keys.
  - `BAKED_THEME_SETTINGS: Record<TunableTheme, ColorDerivationSettings>` — committed per-theme defaults; this is the "code source of truth".
  - `getDerivationSettings(theme)` / `setDerivationSettings(theme, patch)` / `resetDerivationSettings(theme)` — localStorage-backed per-theme state.
  - `createThemeColor(base, opts, settings) → ThemeColorToken` — pure derivation; the rest of the app consumes the resulting `{ base, light: { fill, edge }, dark: { fill, edge } }`.
  - `isDirty(theme)` — true iff localStorage diverges from `BAKED_THEME_SETTINGS[theme]`.
  - `exportBakedThemeSettingsCode()` — deterministic TS snippet generator.
  - Dispatches `nr-color-derivation-change` on every mutation.

- **`shape-capabilities` module** holds the per-theme base hex (`SEMANTIC_COLOR_BASES`) and re-exports `getThemeColors(theme): ThemeColorSet` that runs the derivation live against the current per-theme settings. `DEFAULT_COLORS` is a thin proxy on top so legacy callers always see a live-derived neutral set.

- **`utils` module** owns the central resolver `resolveStyleColors(style)` (Light vs. Dark switch based on `cds--g100`) and the always-write-all-attrs `applyShapeStyle(shape, style)`. Same function used by the CD direct-instance render path and by the SD `complex-component` render path.

- **`admin` module** owns the Color Adjustment UI. The UI is a flat composition over the deep `color-derivation` module and stays out of the math.

- **`component-designer` and `complex-component`** subscribe to `nr-color-derivation-change` and re-apply / rebuild as appropriate.

### Token shape

The output type the rest of the app consumes:

```ts
interface ThemeColorToken {
    base: string;
    light: { fill: string; edge: string };
    dark:  { fill: string; edge: string };
}
```

`shape-capabilities.getThemeColors(theme)` returns the legacy `ShapeColorSet` shape (`shapeLight`, `shapeDark`, `lineLight`, `lineDark`) by projecting the `ThemeColorToken` — keeps existing consumers stable.

### Derivation parameter shape

```ts
interface ColorDerivationSettings {
    lightFillLightnessDelta: number;
    darkFillLightnessDelta: number;
    lightEdgeLightnessDelta: number;
    darkEdgeLightnessDelta: number;
    lightChromaMultiplier: number;
    darkChromaMultiplier: number;
    neutralLightFillLightness: number;
    neutralDarkFillLightness: number;
    neutralLightEdgeDelta: number;
    neutralDarkEdgeDelta: number;
}
```

The first six parameters apply to colored bases; the last four apply when `opts.neutral === true`. UI hides the irrelevant set per theme.

### Persistence

- **Baked baseline:** `BAKED_THEME_SETTINGS` in source.
- **Per-theme override:** `localStorage` key `nr-color-derivation-v2-{theme}`, written on every slider change.
- **Loading:** Lazy on first read per theme — merged with the baked baseline so adding a new tuning parameter in the future falls back to the baked value rather than crashing on a missing key.

### Vendor presets (current bases — committed in source)

| Theme   | Base hex   | Neutral? |
|---------|------------|----------|
| Default | `#a8a8a8`  | yes      |
| Azure   | `#0078D4`  | no       |
| AWS     | `#FFB000`  | no       |
| GCP     | `#F2F4F7`  | yes      |

### Re-render trigger

Both the CD layer-style listener and the SD `ComplexComponentView` listen to `nr-theme-change` AND `nr-color-derivation-change`. The two events go through the same handler so the canvas reacts identically whether the user toggles Light/Dark or the developer drags a derivation slider.

### Backward compatibility

- Existing per-Shape custom colours stored as concrete `topColor` / `strokeColor` hex values on a layer are **not** touched. The derivation pipeline only affects Shapes whose `colorTheme` is one of `default | azure | aws | gcp`. Picks made via the **Custom** color theme override the derivation entirely.
- The old single `DEFAULT_DERIVATION_SETTINGS` export stays as a back-compat shim, pointing at `BAKED_THEME_SETTINGS.default`.

### Out-of-flow concern: CSS dark-mode overrides

The dark-mode CSS in `style.css` rewrites `[stroke="#333"] → #161616` for the template default stroke. The derivation must produce token values that are NOT `#333` for vendor themes, otherwise they would also be rewritten. (This is naturally satisfied because vendor tokens carry actual brand hex values; the only case it bites is `default.line.light`, which must be allowed to be `#333` to keep the existing fallback behaviour intact.)

## Testing Decisions

### What makes a good test here

A good test for this feature exercises the **external behaviour** of the derivation pipeline: given a base hex, an options object, and a settings object, what `ThemeColorToken` comes out? It does not inspect intermediate OKLCH triples, does not mock `Math.cbrt`, does not assert on private helper signatures.

Tests verify properties of the output that the user-facing solution promises:
- Round-trip stability of the colour-space conversion.
- Hue stability across a lightness change.
- Correct ordering of fill vs. edge lightness in each mode.
- Lightness clamping under extreme slider values.
- Chroma suppression in neutral mode.
- Validity of every output hex.
- Deterministic, paste-ready format of the export snippet.

### Modules to test

- **`color-derivation`** — the deep pure-function module. Unit tests cover the points above against fixtures.

The other modules are either thin DOM glue (`admin` rendering, the change-event subscribers) or thin projections on top of the derivation module (`shape-capabilities.getThemeColors`). They are out of scope for the first test pass; if they grow non-trivial logic they get their own test files later.

### Prior art

None — this project has no existing test setup. As part of this PRD we
introduce Vitest as the test runner. Reasons:

- ESM-native, plays nicely with the existing TypeScript build.
- Node environment by default — pure-function tests don't need jsdom.
- `// @vitest-environment jsdom` opt-in per file when a future test needs DOM.
- Zero-config snapshot support for export-snippet tests.

The first test file (`color-derivation.test.ts`) is shipped alongside the PRD as the reference example for future tests in this repo.

## Out of Scope

- Per-end-user persistence of derivation parameters. The admin UI is a developer-internal tuning tool; only `BAKED_THEME_SETTINGS` ships to end users.
- A migration of previously-saved per-Shape custom hex values to the new pipeline. Existing diagrams keep whatever hex they have.
- Tuning the SD Inspector's "Custom Style" picker — that's an end-user-facing colour pick and lives outside the derivation pipeline.
- Tuning the Connection-link colours or any non-Shape stroke in the SD.
- A theme/file-export feature (e.g. CSS variables, design-token JSON for handoff to designers).
- Adding new vendor presets beyond the four already present.

## Further Notes

- The conversation around this feature produced ADR-0004 ("Shape capability registry") as the architectural reference for how per-theme behaviour is centralised; the colour-derivation pipeline follows the same single-source-of-truth pattern for the colour dimension.
- The export snippet is intentionally formatted with three-decimal-place numbers and aligned columns so a diff against the existing `BAKED_THEME_SETTINGS` block is easy to read in a PR.
- The "Modified" status badge specifically avoids the word "Unsaved" — the localStorage write happens immediately on every slider move, so the state IS saved; the badge tracks divergence from the baked source, not save/unsaved.
