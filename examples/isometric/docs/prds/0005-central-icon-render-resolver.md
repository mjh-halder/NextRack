---
id: 0005
title: Central Icon-Render Resolver — Family / Surface / Theme Policy
status: ready-for-agent
created: 2026-05-27
labels: [icons, rendering, component-designer, system-designer, recognition, dark-mode, refactor]
---

# PRD 0005 — Central Icon-Render Resolver: Family / Surface / Theme Policy

## Problem Statement

As a NextRack user working with Components that carry icons from several
sources — Carbon line-art, AWS, Azure, GCP, my own uploads — I expect the
icon to look "right" no matter where it appears: the palette tree, the icon
picker, the 2D grid cell, the isometric face on the canvas, the Admin
catalog preview. "Right" is not a single rule; it depends on the icon
family, the surface, the active theme, and a few per-IconEntry overrides
I can set in the Inspector.

In practice the rules were *implemented* differently at each site:

- Three separate predicates decided "keep the original vendor colour": one
  for recognition surfaces (`iconKeepsOriginalColor`), one for the 2D
  composite path (`getIconRenderSettings(...).iconTint === 'original'`),
  and an inline expression for the isometric composite
  (`isVendorColor = isAzure || isGcp || (isAws && !ie.monochrome)`).
- `bgEnabled` on an IconEntry meant different things on different surfaces:
  ignored in 2D, honoured on isoFace, ignored in recognition.
- AWS monochrome was implemented three ways — a baked `svgMono` variant in
  the catalog cache, an inline `ieMono` branch in the Component Designer,
  and a `.nr-icon-mono` CSS class — none of which knew about the others.
- The GCP `#f4f4f4` 2D backplate was hard-wired into the per-vendor render
  settings; recognition surfaces and isometric faces ignored it silently.
- The Admin "Icon Configuration" panel injected raw catalog SVG markup
  directly, bypassing the recognition pipeline (incl. `freshenVendorSvgIds`,
  which exists to keep AWS gradient `id`s unique across simultaneous
  renders).

The visible consequences I hit while authoring and arranging Components:

- An Azure icon placed on a Component renders mono-white in the System
  Designer's 3D view under the dark theme, even though it renders correctly
  in the Component Designer side-by-side. (Same icon. Same theme.)
- An AWS icon I marked **mono** in the Component Designer renders as a
  hard-black silhouette in the System Designer's dark theme — the theme
  switch only changes some surfaces, not others.
- Toggling `monochrome` on an Azure icon does nothing, but the Inspector
  still shows the toggle, so I assume it's broken.
- After switching theme, my icons in the System Designer sometimes update
  and sometimes don't, depending on which renderer surface owns them.
- The grey port hover-dots are missing on freshly placed Components until I
  reload, because the canvas Icon-Shape rendered with a cached background
  that the dark-mode CSS filter then over-painted.

Each fix that targeted a single symptom (a one-off CSS rule, an inline
`isVendorColor` adjustment, a per-vendor flag in `icon-rendering.ts`) made
the divergence worse: the next render path that read a different predicate
silently disagreed.

## Solution

Make the rules a first-class part of the codebase rather than a behaviour
that emerges from convergent edits at the render sites.

- A single **Icon Family Policy** declares per family — Carbon, AWS, Azure,
  GCP, Uploaded — which capabilities apply: does this family support
  monochrome, an iso-face background, a user iconColor override, a forced
  2D backplate, and what is its default tint per surface.
- A single **Icon-Render Resolver** takes an [IconEntry](../../CONTEXT.md#iconentry),
  a target Surface (`recognition`, `grid2d`, `isoFace`) and a Theme mode
  (`light`, `dark`), and returns a fully-resolved decision: which SVG to
  render, how to tint the glyph, whether to paint a background and how.
- Every render site — the recognition adapter, the 2D-cell URL builder, the
  Component Designer's iso composite loop, the ComplexComponentView in the
  System Designer, and the Admin catalog panel — calls the resolver and
  composites the result. None of them re-derive vendor or theme rules from
  the source `IconEntry` or the catalog metadata.
- The persisted `ie.href` (an old per-IconEntry composite cached at
  CD-save time) is no longer authoritative for SD-side rendering. The
  System Designer's `ComplexComponentView` rebuilds the composite live at
  render time, using the resolver. That kills the class-and-CSS-filter
  workaround (`.nr-icon-theme-invert`) that was needed only because the
  SD was painting a Light-mode composite under a Dark-mode theme.

As a user, the visible payoff:

- Azure, AWS-original, GCP icons keep their brand colours on every
  surface, in every theme.
- Carbon and Custom icons flip black/white with the theme, on every
  surface, in every theme.
- AWS-mono icons obey the theme on the isometric face and stay original
  in recognition and 2D, exactly as the segmented toggle implies.
- Toggling theme in the System Designer immediately repaints all Component
  icons through the same pipeline the Component Designer uses.

## User Stories

1. As a Component author, I want a Carbon icon I dropped onto a Shape to
   render black in the Light theme and white in the Dark theme on the
   Component Designer canvas, so that it remains readable.

2. As a Component author, I want the same Carbon icon to render black /
   white the same way on the 2D grid cell and on the isometric face, so
   that the System Designer and the Component Designer agree.

3. As a Component author, I want an AWS icon placed on a Shape to keep its
   official brand colours by default, on both 2D and the isometric face,
   so that the brand is recognisable.

4. As a Component author, I want to flip a single AWS icon to "monochrome"
   in the Inspector and see it follow the theme on the isometric face
   (black light, white dark), while the 2D grid cell and the recognition
   surfaces continue to show the original AWS colours, so that I can build
   a clean isometric badge without losing the icon's identity elsewhere.

5. As a Component author, I want the AWS "Color / Mono" segmented control
   to be hidden for non-AWS families, so that I am not offered a toggle
   that does nothing.

6. As a Component author, I want an Azure icon to render in its original
   colours on every surface and in every theme — no monochrome toggle, no
   user iconColor override applied — so that Microsoft's branding stays
   consistent.

7. As a Component author, I want a GCP icon to render in its original
   colours, with the GCP-conventional light backplate (#f4f4f4) appearing
   only in the 2D grid cell — never in recognition surfaces, never on the
   isometric face unless I explicitly enable a per-IconEntry background —
   so that the 2D representation is legible without leaking the plate
   into other views.

8. As a Component author, I want an Uploaded SVG icon to render in its
   own colours by default and to accept a user iconColor override when I
   set one in the Inspector, so that I can tint generic uploaded glyphs.

9. As a Component author, I want a Custom (curated) icon to behave like
   Carbon line-art — theme-mono everywhere, optional user iconColor
   override — so that the in-repo asset set looks consistent with Carbon.

10. As a Component author, I want toggling the global theme to instantly
    repaint every icon on the Component Designer canvas with the
    correct tint, so that I can preview both light and dark variants
    without reloading.

11. As a System Designer user, I want toggling the global theme to
    instantly repaint every Component's icon on the canvas — 2D and
    isometric — with the correct tint, so that I can preview a deployment
    in either theme.

12. As a System Designer user, I want a Component that was authored under
    one theme to render correctly when I view it under the other theme,
    so that author-time theme choice never bleeds into viewer-time render.

13. As a System Designer user, I want an AWS-monochrome icon to be black
    in the Light theme and white in the Dark theme on the isometric face,
    so that the mono badge stays readable on dark canvases.

14. As a System Designer user, I want an Azure icon to keep its colour on
    the isometric face in the Dark theme, so that it does not collapse to
    a mono-white silhouette.

15. As a System Designer user, I want a Component's recognition icon in
    the element tree to use the same tint policy as the canvas, so that
    "this icon in the tree" matches "this icon on the canvas".

16. As a System Designer user, I want the per-IconEntry `bgEnabled`,
    `bgColor`, and `bgOpacity` fields to apply only to the isometric face,
    so that "I added a badge background" doesn't unexpectedly recolour my
    2D cell.

17. As a System Designer user, I want the 2D grid cell to ignore my
    isoFace-level `bgOpacity`, so that a translucent badge on the iso
    side doesn't make my 2D icon look half-faded.

18. As an Admin user reviewing the Icon Configuration panel, I want each
    Shape's representative icon to render through the same recognition
    pipeline as the palette tree, so that AWS gradients display correctly
    and the panel matches the rest of the UI.

19. As an Inspector user editing an IconEntry, I want capability-aware
    controls — no `monochrome` for Azure, no `iconColor` for AWS / Azure /
    GCP — so that the UI never hands me a toggle that does nothing.

20. As a developer adding a new icon family later, I want one Policy entry
    in `icon-rendering.ts` and zero changes at any render site, so that
    onboarding a new vendor (e.g. IBM Cloud) is a single declarative
    addition.

21. As a developer hunting an icon-rendering bug, I want a single deep
    module (the resolver) whose external behaviour is fully described by
    unit tests, so that I can reason about "what should this render?"
    without tracing four surfaces.

22. As a developer reading the codebase, I want the recognition contract
    described in [CONTEXT.md](../../CONTEXT.md#icon-in-a-recognition-surface)
    to match the implementation literally (Icon = type-glyph, never
    affected by per-entry styling), so that the glossary and the code do
    not drift.

## Implementation Decisions

### Modules

The work is structured as one deep module (the resolver) and a small set of
thin adapters, plus a Family Policy table that the resolver reads. None of
the adapters re-derives any decision — they pass the IconEntry through and
compose the resolver's output.

- **Icon Family Policy** *(addition to `icon-rendering.ts`)*. Declares the
  five families and their capability flags. Static data, no runtime tuning.
  Companion helper `familyForSource(source)` collapses the wider catalog
  source enum (`carbon | custom | grid-icon | uploaded | aws | azure | gcp`)
  onto the policy keys.

  Capability flags per family:

  | Flag | Meaning |
  |---|---|
  | `defaultTint` | Per-surface default tint: `'original'` or `'theme-mono'`. |
  | `usesVendor2DBackground` | Reads `BAKED_VENDOR_RENDER_SETTINGS[vendor][mode].bgColor` as a forced 2D plate. |
  | `supportsMonochrome` | Honors `IconEntry.monochrome` on isoFace. |
  | `supportsIsoBackground` | Honors per-IconEntry bg fields on isoFace. |
  | `supportsUserIconColor` | Honors `IconEntry.iconColor` as a glyph tint override. |

  Concrete family settings (locked, no per-tweak admin override):

  | Family | Tint (light) | Tint (dark) | Forced 2D bg | Mono | Iso bg | User iconColor |
  |---|---|---|---|---|---|---|
  | `carbon`   | theme-mono | theme-mono | — | — | ✓ | ✓ |
  | `aws`      | original   | original   | — | ✓ | ✓ | — |
  | `azure`    | original   | original   | — | — | — | — |
  | `gcp`      | original   | original   | from vendor settings | — | ✓ | — |
  | `uploaded` | original   | original   | — | — | ✓ | ✓ |

- **Icon-Render Resolver** *(new `icon-resolver.ts`)*. The single deep
  module. Pure function:

  ```ts
  resolveIconRender(
      ie: IconEntry,
      surface: 'recognition' | 'grid2d' | 'isoFace',
      mode: 'light' | 'dark',
  ): IconRenderDecision | null
  ```

  Output shape:

  ```ts
  interface IconRenderDecision {
      glyphSvg: string;                       // ID-freshened, mono-converted for AWS+mono
      glyphTint: 'original' | string;         // 'original' or concrete hex
      background: {
          color: string;
          shape: 'square' | 'circle' | 'octagon';
          radius: number;
          chamfer: number;
          opacity: number;
      } | null;
      keepOriginalColor: boolean;             // shortcut: glyphTint === 'original'
  }
  ```

  Returns `null` only when both `iconId` is empty AND `bgEnabled` is false
  on isoFace — i.e. there is genuinely nothing to render. Recognition
  surface always ignores per-IconEntry overrides (per CONTEXT.md).

- **Recognition adapter** *(`icon-renderer.ts`)*. Thin wrapper. Builds a
  bare `IconEntry`-shell (just `iconId`) and calls the resolver with
  `surface = 'recognition'`. Maps `keepOriginalColor` to the `nr-icon-color`
  CSS class for the existing recognition-surface filter convention.

- **2D-cell adapter** *(`icon2DHref` in `utils.ts`)*. Calls the resolver
  with `surface = 'grid2d'`. Adds the 2D-specific transforms the resolver
  doesn't own: `stripVendorBackground` admin escape, `currentColor`
  replacement for embedded data URIs, oversize scaling. Forces the
  composite `bgOpacity` to 100 regardless of `IconEntry.bgOpacity`.

- **CD iso adapter** *(`applyIconToCurrentShape` in `component-designer.ts`)*.
  Calls the resolver per IconEntry with `surface = 'isoFace'` during the
  iso-composite build loop. Same `currentColor` replacement as the 2D path.
  Listens to `nr-theme-change`, `nr-color-derivation-change`, and
  `nr-icon-rendering-change` (existing wiring) and rebuilds.

- **SD iso adapter** *(`liveIconHref` + `appendIcon` in
  `complex-component.ts`)*. New helper `liveIconHref` mirrors the CD
  composite build via the resolver. `appendIcon` calls `liveIconHref(ie,
  canvasPx)` for the `<image>` href instead of the persisted `ie.href`.
  `ComplexComponentView` already listens to the three theme/setting events
  and triggers `rebuildLayers`, so the live-rebuild propagates.

- **Admin adapter** *(`buildShapeRow` in `admin.ts`)*. Routes the
  representative icon through `renderIcon()` (recognition pipeline)
  instead of injecting `entry.svg` raw. Picks up `freshenVendorSvgIds`
  for free and applies the `nr-icon-color` class.

- **Inspector hook + SD rehydrate** *(`inspector.ts`,
  `system-designer.ts`)*. The generic Icon-Shape in the SD (the standalone
  icon element accessible from the Inspector grid-picker / upload) is
  *not* an IconEntry on a Component — it is its own canvas Shape using
  `iconImage` / `iconFlat` selectors. To match the resolver's family
  policy on that surface, the Inspector stores `iconSource` on the cell
  and applies the `nr-icon-color` class via JointJS attribute when the
  source is `aws | azure | gcp | uploaded`. The SD's `add` handler
  re-applies the class on cell rehydration so persisted Icon-Shapes
  display correctly after a reload. CSS `style.css:4530-4533` is gated on
  `:not(.nr-icon-color)` to honour the opt-out.

### Surface contract (semantics)

The per-Surface meaning of each authoring field is now part of the policy
and not redundantly enforced at each render site:

| Field | Recognition | grid2d | isoFace |
|---|---|---|---|
| `iconColor` | ignored | honored iff family allows | honored iff family allows |
| `monochrome` | ignored | ignored (resolver enforces) | honored iff family allows |
| `bgEnabled` | ignored | ignored | honored iff family allows |
| `bgColor`   | ignored | ignored | honored iff family allows |
| `bgOpacity` | ignored | hard-100 (resolver enforces) | honored iff family allows |

Recognition deliberately ignores every per-entry field — this matches the
existing CONTEXT.md definition of an "Icon (in a recognition surface)"
verbatim, which the previous code had drifted from.

### Theme propagation

- `resolveStyleColors` (Layer fills/strokes) already read DOM theme class
  `cds--g100` at call time; unchanged.
- `applyIconToCurrentShape` and `ComplexComponentView.rebuildLayers` both
  listen to `nr-theme-change` / `nr-color-derivation-change` /
  `nr-icon-rendering-change` and re-call the resolver.
- The persisted `ie.href` is no longer the source of truth for SD
  rendering. It is kept (CD writes it at save time, schema unchanged) as a
  backward-compatibility cache only.

### CSS rules

- `style.css:4530-4533` (canvas Icon-Shape dark-mode invert) — gated on
  `:not(.nr-icon-color)` so vendor canvas icons opt out.
- `style.css:4536-4538` (`.nr-icon-theme-invert`) — kept as dormant CSS;
  the resolver-driven `complex-component.ts` no longer applies the class,
  but the rule is harmless and historic.
- New rule `.joint-port-body.nr-port-connecting` for the
  green-while-dragging port highlight (out of scope below).

## Testing Decisions

A good test for this work asserts external behaviour: given an IconEntry
shape, a surface, and a theme mode, the resolver returns a decision whose
glyph tint, glyph SVG, and background match the family policy. It does
**not** assert which internal helper was called or what string a private
helper returned.

- **`icon-resolver.test.ts`** *(present, 33 tests)*. Wahrheitstabelle over
  five families × three surfaces × two modes, plus the per-IconEntry
  override cases (`monochrome`, `iconColor`, `bgEnabled`) and edge cases
  (no glyph + no bg returns `null`; background-only on isoFace returns a
  no-glyph decision; 2D forces `bgOpacity = 100`). Mocks `getIconById` via
  `vi.mock` so the tests need no IndexedDB / localStorage / DOM.

- **Prior art**: `color-derivation.test.ts` — same Vitest convention,
  same "external behaviour over fixture" framing, same "pure function;
  mock the IO boundary" structure.

Not in test scope: the CD's `applyIconToCurrentShape` composite-string
output, the SD's `liveIconHref` data-URI bytes, and the recognition CSS
class output — those are thin adapters delegating to the resolver, and
testing them would lock in implementation details (the exact SVG markup,
encoding choices, attribute ordering). The resolver tests already cover
the decision; an adapter regression would surface visually in the
designer.

## Out of Scope

- **Data migration**. Existing persisted Shapes keep their per-IconEntry
  fields (`monochrome`, `iconColor`, `bgEnabled`, `bgColor`, `bgOpacity`,
  `bgShape`, `bgChamfer`, `bgRadius`). The resolver re-interprets them
  per-surface; values that the resolver now ignores stay on disk untouched
  and may become re-relevant if a future policy change re-enables them.

- **`ie.href` cleanup from persisted data**. The Component Designer still
  writes `ie.href` to every IconEntry at save time. The System Designer
  no longer reads it for rendering, but other surfaces and serialised
  exports may still depend on it. A follow-up PRD will remove the field
  once consumers are audited.

- **Simple-Shape path** (`applyRegistryDefaults` for non-ComplexComponent
  cells in the System Designer). Single-layer Shapes that bypass
  ComplexComponent still apply the persisted `icon.href` to `topIcon`
  without a live re-resolve on theme switch. In practice today every
  Shape goes through ComplexComponent, so this is latent rather than
  visible — but the asymmetry is worth a follow-up.

- **Capability-aware Inspector UI**. Hiding the `monochrome` toggle for
  non-AWS families, hiding `iconColor` for Azure / GCP / AWS, etc. The
  resolver enforces the rules at render time so the toggles are *safe*
  if a user sets them — they just don't render anything. Hiding them is
  a separate UI cleanup task.

- **Admin Icon Rendering panel UX**. The per-vendor render-settings panel
  in Admin keeps its current shape; only the Family Policy is new and
  static. Eventually `forcedGrid2DBackground` for GCP could move into the
  Family Policy outright, retiring the vendor-settings indirection — left
  for a future cleanup.

- **Drive-by SD connection fixes shipped in the same commit**. Self-loop
  guard (`validateConnection`), stale port-dot cleanup in `link:pointerup`,
  suppressed orange ring (`connecting: false` / `magnetAvailability:
  false`), green port highlight via the `connecting` addClass highlighter.
  These were small fixes uncovered while testing the resolver work; they
  belong to a different feature surface and are not described by this PRD.

## Further Notes

- The resolver is intentionally a **deep module**: one entry point, one
  output shape, full policy concentration. Render sites are intentionally
  shallow adapters. Adding a new family (e.g. IBM Cloud, Oracle) is a
  single declarative edit in `ICON_FAMILY_POLICIES`.

- The Surface vocabulary (`recognition`, `grid2d`, `isoFace`) is the same
  three Surfaces named in CONTEXT.md and is now the canonical decision
  axis. Future surfaces (e.g. "iso minimap thumbnail", "export
  Vorschaubild") should be added to `IconSurface` and to each policy's
  `defaultTint`.

- Performance: live-rebuild in `ComplexComponentView.rebuildLayers`
  performs one `buildCompositeIconSvg` per IconEntry per render call. The
  call is pure string work, no DOM. Profiling on a typical 20-element
  canvas with 1–3 IconEntries each shows negligible overhead; revisit if
  scenes balloon to hundreds of layered Components.

- The `.nr-icon-theme-invert` CSS class is currently dormant — no code
  applies it after the live-rebuild change. Safe to remove in a tidy-up
  commit if no consumer outside this folder uses it.
