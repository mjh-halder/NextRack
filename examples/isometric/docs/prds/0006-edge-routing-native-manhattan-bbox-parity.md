---
id: 0006
title: Edge Routing — Native Manhattan and 2D/Iso bbox Parity
status: done
created: 2026-05-28
closed: 2026-05-29
labels: [system-designer, routing, links, links-inspector, hit-area, views, refactor]
---

# PRD 0006 — Edge Routing: Native Manhattan and 2D/Iso bbox Parity

## Outcome (2026-05-29)

Closed as `done`. The PRD's two core goals — native Manhattan as default router, and view-consistent edge routing between iso and 2D — were achieved, but through a different mechanism than the one originally proposed:

- **Native Manhattan**: `paper.defaultRouter` is `{ name: 'manhattan' }` with no callback or overrides. ✓
- **2D/iso parity**: instead of patching `apply2DHitArea` so the SVG bbox of every Shape matches its iso bbox, the routing anchor was decoupled from the visible marker. [Connection Ports](../../CONTEXT.md#connection-port) anchor at the Hit Area edge in **both** views; in 2D the visible port marker is translated inward via SVG transform onto the icon edge, and a link-owned [Connection Stub](../../CONTEXT.md#connection-stub) fills the icon-to-port gap. The router sees identical anchor geometry across modes — same outcome, smaller blast radius (`apply2DHitArea` is left intact).

The new mechanism is documented in [ADR-0005](../adr/0005-connection-anchor-and-stub.md). An open follow-up about lead-out / shape clearance for routed edges (lines bending hard against the Hit Area edge with no breathing room) is tracked in that ADR's *Open follow-ups* section — not a new PRD.

The body below is preserved as audit history of the override-stack that this PRD set out to dismantle.

---

## Problem Statement

As a NextRack user wiring Components together in the System Designer, I want
Connections (Links) between them to follow clean, predictable orthogonal
paths — and I want the same diagram to look the same regardless of which
view mode (isometric or 2D) is active. Today, both expectations are broken:

- Links bend hard right at the source Port and run along — or into — the
  Component body, instead of leaving the Port cleanly before turning.
- The same Link, between the same two Components, takes visibly different
  paths in iso versus 2D view. The routing changes when the user flips the
  view toggle, even though the underlying graph has not changed.
- Links produce unnecessary loops, U-turns, and Z-kinks for no obvious
  geometric reason. In dense layouts, paths zigzag around Components that
  visually have plenty of free space next to them.
- Manhattan, the historical default router, frequently makes choices that
  look "absolut grottig" (the user's words): long detours, back-and-forth
  segments, and routes that pass through Components instead of beside them.

The audit found that this is not one bug but a stack of overlapping
overrides accumulated in the System Designer's paper config over time —
each one originally added to fix a specific symptom, all of them
interacting now to produce unpredictable behaviour. Compounding this, the
`apply2DHitArea` helper shrinks the SVG bounding box of most Shapes in 2D
view to a centred 40×40 cell, so the Manhattan router — which uses each
element's rendered bbox for obstacle-avoidance — literally sees a different
world in 2D than in iso.

## Solution

Strip the System Designer's routing pipeline back to **native JointJS
Manhattan**, remove every project-specific override, and patch the 2D
hit-area helper so the SVG bbox of every Shape matches its iso bbox. The
result is predictable, view-consistent edge routing with the smallest
possible code surface — a single `defaultRouter: { name: 'manhattan' }`
plus one targeted change in `apply2DHitArea`.

Concretely:

- The default router is plain `routers.manhattan`. No custom callback, no
  vertex injection, no obstacle pre-pass, no direction restrictions.
- The Inspector exposes the router family per Link via the existing
  "Routing" dropdown, including Manhattan as an explicit choice next to
  Auto/Direct/Orthogonal/Metro.
- All previously layered overrides — `defaultConnectionPoint`,
  `defaultAnchor`, custom `isPointObstacle`, port-exit stub injection,
  per-port `startDirections`/`endDirections`, and the short-distance
  `routers.normal` fallback — are deleted. JointJS defaults take over.
- The 2D hit-area helper now keeps the `base` rect at the full model bbox
  (visually transparent via `fillOpacity: 0`), and likewise leaves
  `hitArea` at full model bbox for ComplexComponent. The visual 40×40
  centred footprint stays on the dedicated `base2D` path for the Shapes
  that have one (Tube, Pipe, Duct, Channel). For Shapes whose only
  geometry is `base` (Hexahedron, Octagon, Rectangle, etc.) the formerly
  visible grey 40×40 backdrop becomes transparent — a deliberate visual
  trade-off for routing consistency.
- A temporary experimental "Port Exit" dropdown (modes None / Conditional
  / Short) that was added during the investigation is removed; its winner
  (None / native JointJS) is permanently in place.

## User Stories

1. As a System Designer user, I want edges between two Components to take
   the same path regardless of whether I am in iso or 2D view, so my
   diagram reads the same in both modes.
2. As a System Designer user, I want the default routing to be Manhattan
   without any project-specific tweaks, so the behaviour matches what I
   read in JointJS documentation.
3. As a System Designer user, I want short connections (two Components
   right next to each other) to route directly without long detours,
   without the project special-casing them.
4. As a System Designer user, I want Links to honour `isometricHeight`
   changes on other Components without producing visual loops in iso view
   — because routing should be based on the model bbox, not the screen
   bbox of the iso-projected volume.
5. As a System Designer user, I want to pick a different router per Link
   from the Inspector's "Routing" dropdown when Manhattan produces a poor
   result on a specific Link.
6. As a System Designer user, I want the Inspector dropdown to clearly
   label the default option "Auto (Manhattan)" so I understand what runs
   when I leave it untouched.
7. As a System Designer user, I want Manhattan to be selectable explicitly
   alongside Auto, in case I want to force Manhattan on a Link whose
   `customRouter` was previously set to something else.
8. As a System Designer user, I want the Inspector dropdown for Connector
   (Default / Straight / Rounded / Smooth / Jump Over) to keep working
   exactly as before — Connector choice is independent of router choice.
9. As a System Designer user, I want the experimental "Port Exit" toggle
   removed from the Inspector once the experiment is over, so the
   Inspector stays uncluttered.
10. As a System Designer user, I want my prior per-Link `customRouter` /
    `customConnector` selections to remain persisted on the Link and
    continue to override the default.
11. As a Component author working on a `dimYAdjustable` Shape (Tube, Pipe,
    Duct, Channel) at an elongated size, I want Connections passing near
    the elongated Shape to not detour through phantom space that is no
    longer part of the Shape's 2D footprint.
12. As a Component author placing a ComplexComponent in the System
    Designer's 2D view, I want clicking anywhere within the Component's
    model bbox to still select it, just like in iso view.
13. As a Component author of Hexahedron / Octagon / Rectangle / Circle /
    Hexagonal / DoubleArrow / SvgPolygon / GridLabel shapes, I accept that
    the grey 40×40 background rect previously visible behind the 2D icon
    is now transparent, as a trade-off for view-consistent routing.
14. As a Tube / Pipe / Duct / Channel author, I want the 2D visual — the
    centred 40×40 `base2D` path with its `#e0e0e0` fill — to look exactly
    as before, since these Shapes have a dedicated visual element separate
    from `base`.
15. As a System Designer user, I want self-loop prevention to continue to
    work — a Link must connect two different Components, even via Ports of
    the same Component.
16. As a System Designer user, I want the green port-dot indicator that
    lights up when a link drag touches a valid target to keep working
    exactly as before — this PRD does not touch link-drag UX.
17. As a System Designer user, I want Cluster Links between Frames to keep
    routing through the same default — they fall under the same Manhattan
    behaviour as Component Links.
18. As a System Designer user, I do not expect routing to depend on a
    `padding` value the project tunes; it should use whatever JointJS
    Manhattan picks by default.
19. As a System Designer user, I do not expect routing to depend on the
    project's custom `isPointObstacle` against the obstacle grid — that
    obstacle data is still used by `restrictTranslate` for drag
    constraints, but no longer for routing.
20. As a System Designer user, I want the link's connection point to be
    JointJS default (`boundary`), not an anchor offset by 2 px, so arrow
    tips do not poke into the Port circle.
21. As a System Designer user, I want the link's default anchor to be
    JointJS default (`center`) rather than `modelCenter`, since the latter
    matters only for non-port endpoints (Frames) and the default behaves
    correctly there.
22. As a maintainer, I want the codebase to stop carrying the
    `portDirection` / `portExitDirection` / `PORT_EXIT_OFFSET` helpers
    once they are no longer referenced — dead code should not linger.
23. As a maintainer, I want the experimental `routing-mode.ts` module
    deleted once its only consumer (the Port Exit dropdown) is removed,
    so no orphaned state machinery remains.
24. As a maintainer, I want unused imports (`routers` in
    `system-designer.ts`) removed when the custom defaultRouter callback
    goes away, so the import surface honestly reflects what the file
    needs.
25. As a maintainer, I want the audit findings recorded in this PRD so
    future contributors understand why the routing config in the System
    Designer is intentionally minimal — and what they should avoid
    re-introducing.

## Implementation Decisions

### Routing pipeline — back to JointJS native

- `paper.defaultRouter` is set to the literal value `{ name: 'manhattan' }`
  with no callback, no args. Every previously layered configuration is
  deleted.
- `paper.defaultConnector` remains unset — JointJS default `normal` (hard
  90° corners) is retained intentionally; the user confirmed harte Ecken
  are desired.
- `paper.defaultConnectionPoint` and `paper.defaultAnchor` are both
  deleted. JointJS defaults (`boundary` and `center`) take over.
- `paper.snapLinks`, `paper.gridSize`, `paper.validateConnection`, and the
  link-drag highlighters (`connecting`, `magnetAvailability`) are
  unchanged — they are validation/UX, not routing.

### Per-Link Inspector dropdown

- "Routing" dropdown options: `default` ("Auto (Manhattan)"), `normal`
  ("Direct"), `orthogonal` ("Orthogonal"), `manhattan` ("Manhattan"),
  `metro` ("Metro").
- Selecting "default" calls `link.unset('router')` so the Link falls back
  to the paper's `defaultRouter`. Any other selection sets
  `link.set('router', { name: val })`.
- `customRouter` is the persisted dropdown state (`'default'` ↔ unset
  router). The setter logic predates this PRD and is left intact.
- "Connector" dropdown is unchanged.
- The temporary "Port Exit" dropdown that experimented with stub-injection
  modes (None / Conditional / Short) is removed entirely. The user picked
  "None / native" after side-by-side testing.

### View-consistent SVG bounding box

The `apply2DHitArea(twoD)` helper on `IsometricShape` is patched. The new
contract:

- In 2D (`twoD === true`):
  - `base` rect is sized to the full `width × height` model bbox at
    `(x=0, y=0)`, with `fillOpacity: 0` and `strokeOpacity: 0`. It stays
    pointer-clickable because the underlying SVG `fill` attribute remains
    non-`none` in the Shape templates.
  - `base2D` path keeps the centred 40×40 hit-path `d` value, exactly as
    before (only Tube / Pipe / Duct / Channel have this selector).
  - `hitArea` rect is sized to the full `width × height` model bbox
    (only ComplexComponent has this selector — its default is already
    `calc(w) × calc(h)`, so this matches the iso default).
- In iso (`twoD === false`): all three selectors are reset to `null`
  values, restoring SVG template defaults (visible `base`, hidden
  `base2D`, default `hitArea`).

### Source-of-the-bbox-inconsistency note

JointJS Manhattan reads `elementView.getBBox()` for obstacle elements.
That bbox is the union of all visible SVG children of the element. Before
this PRD, the 2D path shrank `base` to a centred 40×40 rect, so the
visible SVG geometry — and therefore the bbox — was much smaller in 2D
than in iso. After the PRD, `base` covers the full model bbox in 2D
(invisibly), so the bbox is consistent across views.

### Deletions

The following symbols / files are deleted as a consequence of switching
to native Manhattan:

- `portDirection(portId)` helper in System Designer
- `portExitDirection(view, end)` helper in System Designer
- `PORT_EXIT_OFFSET` constant in System Designer
- `routing-mode.ts` module (the entire file)
- Custom-callback form of `defaultRouter` in System Designer
- `defaultConnectionPoint` and `defaultAnchor` properties from the
  Paper config
- `routers` named import from `@joint/core` in System Designer

### Trade-offs acknowledged

- Shapes whose only 2D geometry is the `base` rect (Hexahedron, Octagon,
  Rectangle, Circle, Hexagonal, DoubleArrow, SvgPolygon, GridLabel) lose
  the visible grey `#e0e0e0` background in 2D view. Visually, the icon
  now sits on the grid alone. The user accepted this trade-off in
  exchange for view-consistent routing. Restoring a visible 40×40
  backdrop for these Shapes would require an additional sibling element
  in each Shape's SVG template — explicitly out of scope here.
- ComplexComponent's `hitArea` is now full bbox in 2D rather than 40×40.
  Click-selection therefore lights up on any pointer event inside the
  Component, including the area around its layered 2D thumbnail. This
  matches iso behaviour.

## Testing Decisions

This PRD ships no new automated tests. Routing quality is a visual
concern best validated by hand against side-by-side iso/2D screenshots.
Prior art for non-rendering vitest-based tests in the repo exists in
`color-derivation.test.ts` and `icon-resolver.test.ts` — both validate
pure-function output without touching DOM or canvas — and could host
future tests if a coordinate-level invariant ever needs locking down.

Recommended manual verification, in order:

- Place two Components with `dimYAdjustable=false` side by side on the
  System Designer canvas. Connect Port → Port. Switch iso ↔ 2D. The
  rendered path should be congruent across views, modulo the iso
  projection.
- Place a Tube (or any `dimYAdjustable` Shape) at an elongated size and
  route a Connection past it. In 2D, the path should not detour through
  the empty corners where the 40×40 ghost used to live.
- Place a ComplexComponent in 2D. Click anywhere in its model bbox. The
  Component should select (matching iso behaviour). Toggle the view to
  iso and back; the Connections through it should remain congruent.
- Open the Inspector for a selected Link. Cycle through every entry of
  the "Routing" dropdown (Auto / Direct / Orthogonal / Manhattan /
  Metro). Each should re-render the Link without error and without
  losing the persisted Link metadata.
- Confirm the Inspector no longer shows a "Port Exit" dropdown.
- Confirm self-loop prevention still works: try to drag a Connection
  from a Port on Component A back to a different Port on Component A;
  the drop should be rejected with no Link created.

Things deliberately not tested in automation:

- "Routing looks the same in iso and 2D" — too dependent on screen-space
  pixel exactness; visual diffing is overkill for this code surface.
- Manhattan's internal A* path quality — that is JointJS's responsibility;
  this PRD's job is only to stop fighting it.

## Out of Scope

- Adding a visible 40×40 background back to the 8 Shape SVG templates
  that lost it (Hexahedron, Octagon, Rectangle, Circle, Hexagonal,
  DoubleArrow, SvgPolygon, GridLabel). If the visual loss matters, a
  follow-up can introduce a `base2D` sibling rect in each template.
- A "rounded corners" connector toggle in the Inspector for Manhattan /
  Orthogonal paths — the user explicitly stated hard corners are wanted.
- Per-Link `connectionPoint` or `anchor` overrides via the Inspector —
  only `router` and `connector` are exposed.
- Persisting a global routing-mode preference across sessions. The
  experimental dropdown is gone; per-Link `customRouter` is the only
  persisted routing state.
- Changes to `validateConnection` — its self-loop guard, port-pflicht
  rule, and Frame-to-Frame allowance all remain.
- Changes to the obstacle grid (`obstacles.ts`) — it still feeds
  `restrictTranslate`; only its routing role is gone.
- Changes to the Component Designer's drawing canvas — that designer's
  routing is unaffected.
- A custom Manhattan `padding` value. JointJS default is kept.
- Migrating Links whose `customRouter` was set to a value the dropdown
  no longer offers — no such value exists; the dropdown is a superset
  of historical options.

## Further Notes

- The audit walked through eleven distinct mechanisms that influenced
  edge routing in some way: `defaultRouter` callback shape,
  `defaultConnector` (absent → JointJS `normal`), `defaultConnectionPoint`,
  `defaultAnchor`, `gridSize`, `snapLinks`, `validateConnection`,
  per-Link Inspector router/connector, the Style-Paste contextual
  command's `customRouter`/`customConnector` propagation, the implicit
  Manhattan defaults (`padding`, `excludeEnds`, `startDirections`,
  `endDirections`), and the project-custom `isPointObstacle`. Removing
  the audit-flagged overrides — while keeping the per-Link Inspector
  features intact — landed the cleanest result.
- During the investigation, the user explicitly tested a three-way Port
  Exit mode toggle (None / Conditional / Short). The dropdown lived in
  the Link Inspector temporarily and was wired to a global module
  (`routing-mode.ts`) that re-rendered every Link on mode change. After
  side-by-side testing, mode "None / native" won decisively. The
  Conditional and Short modes plus the supporting infrastructure
  (module, subscriber, dropdown) were removed.
- The 2D bbox patch lives in `IsometricShape.apply2DHitArea`. Subclasses
  that override `toggleView` should not need changes; ComplexComponent
  does not override the helper and inherits the new behaviour
  automatically.
- The patch is reversible: setting `apply2DHitArea(true)` back to the
  centred 40×40 attrs restores the previous look (and the previous
  routing inconsistency).
