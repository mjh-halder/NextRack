---
id: 0007
title: System Designer — Area Independence, Tree-Drop Extraction, Group-Move Link Waypoints
status: ready-for-agent
created: 2026-05-29
labels: [system-designer, palette, multi-select, interaction]
---

# PRD 0007 — System Designer: Area Independence, Tree-Drop Extraction, Group-Move Link Waypoints

## Problem Statement

As a NextRack user working in the System Designer, I run into three
related interaction frictions when arranging Components and Zones:

1. **Areas get pulled into Zones**. When I drop an Area inside a Zone or
   drag it over one later, the Area becomes a child of that Zone (it
   embeds, moves with the Zone, and counts as "inside" it for selection
   and assignment). I don't want that. Areas are decorative design
   elements — like callout backgrounds, regions, or annotations — that
   should sit independently on the canvas, parallel to Zones rather than
   inside them.

2. **The element tree has no way to lift a Component out of a Zone**.
   Today the only drag gesture the tree accepts for an element is "drop
   onto a Zone row" — which moves the Component into that Zone. There is
   no gesture for the opposite: take a Component that is currently a
   child of a Zone and put it at the top level again. The only workaround
   is to delete + re-add, which loses the Component's properties and
   connections.

3. **Multi-selecting and moving elements leaves connecting Links kinked**.
   When I rubber-band a group of Components that are wired together,
   then drag the group to a new position, the Components translate but
   any Link waypoints between them stay at their old absolute positions.
   The result is bent, zig-zagging Links pointing back at where the
   group used to be. I have to manually fix the Links after every move.

## Solution

Three targeted changes in the System Designer's interaction layer, each
encoded as a small, pure decision module so the policy can be verified
in isolation:

1. **Area independence.** The zone-assignment chokepoint explicitly
   excludes Areas. Areas can be dragged anywhere on the canvas, can
   visually overlap Zones, but never become a Zone's child. The initial
   palette-drop path applies the same rule.

2. **Tree drop intent has an "extract to root" mode.** The Zone-row's
   drag-over region is split into three vertical bands: top quarter and
   bottom quarter both mean "extract the dragged element out of any
   Zone" (drop above / below the Zone row), the middle half keeps the
   current "drop into this Zone" behaviour. The same row geometry that
   distinguishes "reorder above" vs "reorder below" for Zone-to-Zone
   drags is reused, with the existing CSS classes
   `nr-tree-row--drop-above` / `--drop-below` / `--drop-into` providing
   the visual feedback.

3. **Group move propagates to Link waypoints.** When the group-move
   handler translates the selected Components by `(dx, dy)`, it
   additionally walks every Link in the graph: any Link whose source
   AND target are both in the selection (or that is itself an explicit
   member of the selection) has every one of its waypoints translated
   by the same delta. Links whose endpoints straddle the selection
   boundary keep their original waypoints — they need to deform
   geometrically as the group moves, and translating them would break
   that.

## User Stories

1. As a NextRack user, I want to drop an Area on top of a Zone without
   the Area becoming a child of the Zone, so that my Areas stay as
   independent design overlays.
2. As a NextRack user, I want to drag an existing Area into a Zone's
   visual bounds without the Area auto-embedding, so that the move
   gesture stays purely geometric.
3. As a NextRack user, I want an Area that was previously (accidentally
   or by older code) embedded in a Zone to be detached the next time the
   zone-assignment chokepoint runs, so that legacy designs self-heal.
4. As a NextRack user, I want Components to keep embedding into Zones
   the same way they do today, so that the Area-only carve-out doesn't
   regress the existing zone semantics.
5. As a NextRack user, I want to drag a Component from inside a Zone in
   the tree and drop it just above the Zone row to lift it out, so that
   I don't have to delete-and-re-add to move a Component to the top
   level.
6. As a NextRack user, I want to drop a Component just below a Zone row
   to also lift it to the top level, so that either edge of the row
   acts as an "extract" target.
7. As a NextRack user, I want the middle of a Zone row to still mean
   "drop into this Zone" when I drag a Component, so that the existing
   transfer gesture keeps working.
8. As a NextRack user, I want the drop-zone visual cues to match the
   intent — the top-edge highlight when I'm in the extract-above band,
   the body highlight when I'm in the enter-zone band, the bottom-edge
   highlight in the extract-below band, so that I can tell what will
   happen before I release the mouse.
9. As a NextRack user, I want Zone-to-Zone drag (reorder among
   same-parent siblings) to keep its current above/below midpoint
   semantics, so that the new element drop bands don't change Zone
   reordering.
10. As a NextRack user, I want my Component to retain its position on
    the canvas when I extract it via the tree, so that the Component
    doesn't visually jump after the drag.
11. As a NextRack user, I want to rubber-band-select several wired
    Components and drag the group, so that all of them move together
    without me having to drag each one individually.
12. As a NextRack user, I want every Link waypoint between two
    Components that are both in the selection to translate by the
    group's `(dx, dy)`, so that no Link develops kinks pointing back at
    the group's old position.
13. As a NextRack user, I want a Link whose only one endpoint is in the
    selection to keep its waypoints, so that the Link can stretch and
    bend naturally as the connected Component moves away from the rest.
14. As a NextRack user, I want a Link that I explicitly added to the
    selection (e.g. via Shift-click) to have its waypoints translated
    even if only one or neither endpoint is selected, so that I can
    move "just the routing" of a Link as a unit when I want to.
15. As a NextRack user, I want Links with no waypoints to be unaffected
    by group moves, so that auto-routed Links stay auto-routed.
16. As a NextRack user, I want group moves to commit only once (at
    `pointerup`), not on every intermediate `pointermove` frame, so
    that undo/redo treats the gesture as a single step and so the
    canvas doesn't redraw at every micro-step.

## Implementation Decisions

### Modules

Three pure decision modules. Each is a single exported function with a
plain-data interface, no JointJS coupling, no DOM coupling — so the
chokepoints stay testable in isolation and the policy logic lives in one
place.

**Zone Assignment Policy** — `decideZoneForElement`

Inputs: the element's identity (id, `isArea` flag, current parent id,
bounding-box centre), and a list of candidate Frames each with id,
bbox, and descendant-id set (to prevent circular embedding).

Output: the id of the Frame the element should be a child of, or
`null` for top-level.

Rules:
- If the element is an Area → return `null` always.
- Otherwise → return the id of the smallest-area Frame whose bbox
  contains the element's centre AND that is not the element itself nor
  one of its descendants. Returns `null` if no such Frame exists.

The system-designer's `updateZoneAssignment` becomes a thin adapter
that gathers the inputs, calls the policy, and applies the resulting
embed/unembed mutation.

**Tree Drop Intent Classifier** — `classifyTreeDropIntent`

Inputs: `pointerY` (clientY of the drag-over event), `rowTop`,
`rowHeight`, `draggedKind` (`'frame'` or `'element'`), `targetIsFrame`
(boolean), `sameSiblingsForReorder` (boolean — true only when source
and target are Zones with the same parent and reordering is meaningful).

Output: a discriminated union — `'extract-above'`, `'enter-zone'`,
`'extract-below'`, `'reorder-above'`, `'reorder-below'`, or `'none'`.

Rules (target is always a Zone row — element rows accept no drops):
- Dragged is an element:
  - `pointerY` in top 25% of the row → `'extract-above'`.
  - `pointerY` in bottom 25% of the row → `'extract-below'`.
  - Otherwise (middle 50%) → `'enter-zone'`.
- Dragged is a Frame and `sameSiblingsForReorder` is true:
  - Above row midpoint → `'reorder-above'`.
  - Below row midpoint → `'reorder-below'`.
- Anything else → `'none'`.

The palette's dragover/drop handlers reduce to: compute the intent,
apply the matching CSS class for visual feedback, call the matching
action (existing `transferToZone` / `reorderSiblings`, or new
`extractToRoot` which simply unembeds from the current parent).

**Group Move Waypoint Propagation** — `computeLinkVertexUpdates`

Inputs: `selectedElementIds` (set of strings), `explicitlySelectedLinkIds`
(set of strings), `links` (array of `{ id, sourceId, targetId, vertices }`
plain-data tuples), `dx`, `dy`.

Output: an array of `{ linkId, newVertices }` updates. Each update has
each vertex shifted by `(dx, dy)`. Links not needing updates are
omitted from the output.

Rule for inclusion: include a Link iff
- the Link's id is in `explicitlySelectedLinkIds`, OR
- both its `sourceId` and `targetId` are in `selectedElementIds`.
- AND the Link has at least one vertex.

The area-select's pointermove handler becomes: translate Components
(existing code) → call `computeLinkVertexUpdates` → apply each returned
update via `link.vertices(newVertices)`.

### Interfaces

The three pure modules export plain `function` signatures, no classes.
They consume and return plain data (numbers, strings, arrays, plain
objects) so tests need no JointJS mocking.

Adapter chokepoints retain the names they have today
(`updateZoneAssignment`, the row drag handlers, the `pointermove`
listener) — only the body changes.

### Visual Feedback Reuses Existing CSS

The three drop intents already have matching CSS:
- `nr-tree-row--drop-above` — element extract above / Zone reorder above.
- `nr-tree-row--drop-into` — element enter zone.
- `nr-tree-row--drop-below` — element extract below / Zone reorder below.

No new classes are introduced. The zone-highlight callback (`onZoneDrop
Highlight`) is invoked with the Zone id only in the `enter-zone` band;
for `extract-above` / `extract-below` it is invoked with `null` so the
canvas-side highlight goes away (the user is no longer about to drop
into the Zone).

### State on the Canvas After an Extract

When the tree extract action fires, the element is unembedded from its
current parent. **Its canvas position is not changed.** The user
explicitly may want the Component to keep sitting where it visually was
even after it has been lifted out of the Zone's child set. They can
then move it independently. This mirrors how the Linux file manager and
Figma both treat "move out of folder/group" actions — change the parent,
keep the spatial position.

### Group Move Commit Model

The waypoint propagation happens during `pointermove` (i.e., live, as
the user drags) so the user sees Links following their group in real
time. The existing `onGroupMoveEnd(cells)` callback fires at
`pointerup` and remains the single commit hook for downstream policies
(zone re-assignment, painter-sort, etc.) — no extra commit step is
introduced.

### Backwards Compatibility

- Legacy designs may have Areas embedded in Zones from before this
  change. The next time `updateZoneAssignment` runs for the Area
  (move, paste, load), the new Area branch will detach it. No
  migration script; the chokepoint self-heals.
- No persisted schema changes. The decision modules consume the same
  fields (`isArea`, `parent`, `bbox`, `vertices`, source/target ids)
  that are already on the cells.

## Testing Decisions

Tests target external behaviour only — the decision functions are
called with fixtures and asserted on the returned values. No JointJS
mocks, no DOM. Each module's function is sufficient on its own as the
public surface.

### What to test

**`decideZoneForElement`**:
- Area always returns `null`, regardless of how many candidate Frames
  the centre is inside.
- Non-Area with one containing Frame → returns that Frame's id.
- Non-Area with two nested Frames containing the centre → returns the
  inner one (smallest area).
- Non-Area whose centre is outside every Frame → returns `null`.
- Non-Area whose centre is inside a Frame that is its own descendant →
  returns `null` (no circular embedding).
- Tie-break on equal-area containment: deterministic, documented in
  the test (first by list order, or by lowest id — implementer's
  choice, locked by the test).

**`classifyTreeDropIntent`**:
- Element dragged onto a Frame row, pointer in top quarter →
  `'extract-above'`; middle half → `'enter-zone'`; bottom quarter →
  `'extract-below'`.
- Boundary cases: pointer exactly at the 25% line and at the 75% line
  — assert which side wins (document the choice).
- Frame dragged onto a Frame row with same-sibling reorder allowed →
  `'reorder-above'` / `'reorder-below'` around the midpoint.
- Frame dragged onto a Frame row when same-sibling reorder is not
  allowed → `'none'`.
- Element dragged onto an element row (`targetIsFrame=false`) →
  `'none'`.

**`computeLinkVertexUpdates`**:
- Link with both endpoints in selection and two vertices → returns one
  update with both vertices shifted by `(dx, dy)`.
- Link with only source in selection → not in the output.
- Link with only target in selection → not in the output.
- Link with neither endpoint in selection but the Link itself is
  explicitly selected → returns an update.
- Link with both endpoints selected but no vertices → not in the
  output (nothing to translate).
- Multiple Links in the graph — only the ones meeting the rule appear
  in the output; the rest are omitted.
- `(dx, dy) = (0, 0)` → output is empty.

### Prior art

The two existing tests in this codebase — `icon-resolver.test.ts` and
`color-derivation.test.ts` — both follow exactly the pattern this PRD
needs: pure inputs in, pure outputs out, no DOM, no JointJS, vitest
node environment. Each new test file should mirror that structure
(top-of-file `@vitest-environment node`, small factory helpers for
fixture creation, one `describe` per public function).

## Out of Scope

- Removing Areas from a Zone they were previously embedded into
  retroactively at load time. The chokepoint self-heals on next
  zone-assignment run; no eager migration.
- Canvas-side gestures for "drag Component out of a Zone visually"
  (i.e., moving a Component's centre outside a Zone's bbox on the
  canvas). The current rule — moving the centre out of a Zone
  unembeds — continues to apply. This PRD adds the tree-side gesture
  only.
- Smart Link routing that re-routes around obstacles after a group
  move. The propagation translates waypoints rigidly; it does not
  attempt to reflow the path. Smarter routing is the subject of PRD
  0006 and remains independent.
- Multi-select drag-from-tree. The tree drag remains single-item.
- Persisting an "I deliberately want this Area embedded in a Zone"
  override. There is no opt-in; Areas are always independent.
- Undo/redo semantics for the new tree extract gesture. It is a
  parent-pointer mutation; whatever undo coverage the existing
  embed/unembed actions have applies unchanged.

## Further Notes

- The three modules are independent of each other and can be landed in
  any order. The implementer should still land them in three separate
  commits so each can be reviewed against its tests in isolation.
- All three changes are interaction-only — no schema, no save format,
  no rendering pipeline touched. Risk surface is bounded to the
  System Designer's pointer handlers and the tree drop handlers.
- The Area-independence rule has the secondary benefit of unblocking
  a future "Area on top of multiple Zones" use case (call-outs that
  span Zones) without further code changes.
