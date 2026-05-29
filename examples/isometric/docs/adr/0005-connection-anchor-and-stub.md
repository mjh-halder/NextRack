# ADR 0005 — Hit Area as canonical connection anchor + link-owned 2D stub

Date: 2026-05-29
Status: Accepted

## Context

Connections in the System Designer look spatially different between isometric and 2D views. Components with a non-square Hit Area (e.g., a Gate at 80×40) shrink visually to a centered 40×40 icon in 2D (`isometric-shape.ts:140-160`, `complex-component.ts:364-375`). The Connection Ports in `ports.ts:84-101` migrate with the visual:

- **Isometric**: ports at the model bbox edges — `{x: w/2, y: h}` etc.
- **2D**: ports at the centered 40×40 icon edges — `{x: cx + 20, y: cy}` etc.

The router (`obstacles.ts`) still computes against the full element bbox, so the routing space is iso-sized while the anchor is icon-sized in 2D. Lines bend "too early" in 2D — the first bend can happen between the iso footprint edge and the icon edge, producing visually different paths in the two views even with identical waypoints. The user works around this today by placing manual vertices, which is fragile and doesn't survive view switches cleanly.

## Decision

Two coupled changes.

### 1. Hit Area is the canonical Connection Port anchor in both views

Both `front`/`back`/`left`/`right` ports anchor at the midpoint of the corresponding [Hit Area](../../CONTEXT.md#hit-area) edge — same point in iso and 2D. The view-mode branching in `ports.ts:84-101` is collapsed into a single mode-independent formula based on `getHitArea(def)`.

The Hit Area was already the canonical "floor footprint" semantically (used for placement collision, snapping, label anchoring). Extending its role to Connection anchoring removes the asymmetry between iso and 2D anchor positions without inventing a new concept.

### 2. The 2D stub belongs to the link, not the component

In 2D, the visible Icon is a centered 40×40 box inside the Hit Area. The Port sits outside the Icon. A custom **connector** prepends/appends a straight [Connection Stub](../../CONTEXT.md#connection-stub) segment from the Icon edge to the Port at each end of the link. The stub renders only on sides that have a Connection — isolated Components keep their minimal "bare icon" look.

A custom **anchor** returns the Hit Area edge midpoint per port direction so the router computes its path between Port positions exactly as in iso. The connector reads source/target views to determine the stub length per end (= half the Hit-Area axis minus 20px, per direction). In iso, source and target icon boxes coincide with the Hit Area, so the stub length collapses to zero and the connector reduces to a no-op extension.

### 3. Routing strategy: deliberately left alone (vanilla `{ name: 'manhattan' }`)

A custom router (`smartRouter`) was explored to add lead-out padding and short-distance fallbacks. Multiple iterations were tried — Manhattan args (`padding`, `excludeEnds`, `startDirections`, `endDirections`), mandatory lead-out vertices, custom fallback routers — and each iteration introduced new artefacts (diagonal segments from a wrong `fallbackRouter` override, U-loops from A* picking the cheapest bbox side as seed, asymmetric padding between cell axes). The Manhattan-internal behaviour with user-defined vertices and padding interacted in ways that couldn't be made to look right without significantly deeper investment.

**Decision**: revert to vanilla `defaultRouter: { name: 'manhattan' }` and accept that lines can bend close to the source/target shape edge. The `getsHitArea`-as-anchor + 2D stub work in §1/§2 still solves the original "lines look different on view switch" problem. The "lines don't give shapes breathing room" complaint is left as a known open item — see *Open follow-ups*.

## Alternatives considered

- **B — visible footprint tile in 2D.** Render the Hit Area as a flat rectangle ("floor-plan tile") with the icon centered inside. Ports anchor at the tile edge; no separate stub concept. *Rejected* because the user wants to preserve the minimalist "single icon" 2D look; the tile adds visual weight to every Component.
- **A2 — component-owned stub stamps.** Each Component renders four small stub stumps from its icon to the Hit Area edges in 2D, regardless of whether a Connection exists. *Rejected* because it (a) decorates isolated Components with sterile "antennae", (b) requires a separate styling decision for stubs independent of link color, (c) duplicates rendering responsibility (Component-side stumps + Link endpoints from separate sources).
- **Asymmetric: keep bbox as iso anchor, only move 2D to Hit Area.** *Rejected* because the inconsistency just relocates — a link can then jump between bbox-top (iso) and Hit-Area-bottom (2D) when switching views on a Multi-Layer Shape with floating layers.

## Consequences

**Positive**

- 2D ↔ iso view switches preserve routing geometry. Lines no longer "bend too early" in 2D and no longer drift on mode switch.
- Stubs only appear where Connections do. Isolated 2D Components stay visually clean.
- Stubs inherit link styling automatically — no separate stylesheet, no cross-styling drift.
- One uniform semantic for "where a Connection meets a Component": its Hit Area edge. Applies in iso and 2D.
- Removes the `if(twoD)` branch in `ports.ts:84-101` instead of widening it.
- Router and obstacle code are unaffected — `obstacles.ts` already operates on the cell bbox.

**Negative**

- Iso semantic shift for Multi-Layer Shapes with floating-only layers above a smaller floor footprint: connections now anchor at the floor edge, not at a floating layer's top edge. Most existing Shapes have a floor-standing primary layer and are unaffected; the few that aren't will look subtly different after load. Accepted with eyes open.
- The custom connector must read source/target Hit Areas and icon boxes per render. Cheap, but introduces a new dependency from connector → element shape data.
- One new shared concept ([Connection Stub](../../CONTEXT.md#connection-stub)) for code readers to learn. Documented in `CONTEXT.md` and here.

## Rollback

Anchor commit (pre-rollout): `eaeef5f4ed9b3bf1ed405a69d3d53b241e3b6945` — "isometric: design icons, area path editing, surface text, multi-select polish".

Full revert: `git checkout eaeef5f4 -- src/ CONTEXT.md` then delete this file and `docs/adr/0005-connection-anchor-and-stub.md`. Or selective per the file table below.

### Files touched in this ADR's rollout

| File | Change | Rollback recipe |
|---|---|---|
| `CONTEXT.md` | Extended `Hit Area` entry; added `Connection Port` and `Connection Stub` entries. | `git checkout eaeef5f4 -- CONTEXT.md` |
| `src/shapes/ports.ts` | (a) Removed `view === '2d'` branch in `getPortPositions`; port LOGICAL positions sit at cell-bbox edge midpoints in both modes (= routing anchor). (b) Added `getPortMarkerTransforms` — per-port SVG `transform` on `portBody` that translates the VISIBLE marker circle inward to the centered 40×40 icon edge in 2D (no transform in iso). Wired into both `initPorts` and `updatePortPositions` so the marker repositions on view-toggle / resize / iH change. | `git checkout eaeef5f4 -- src/shapes/ports.ts` |
| `src/shapes/link/link.ts` | _not touched_ — paper-level `defaultConnector` applies because Link defaults don't set `connector`. | n/a |
| `src/system-designer.ts` | Named import of `stubConnector` (from `./connectors/stub-connector`). `defaultConnector: stubConnector` set on the Paper options (function passed directly — bypasses `{ name }` lookup so we don't depend on namespace mutation propagating into the paper's internal namespace). `defaultRouter` left at vanilla `{ name: 'manhattan' }`. | `git checkout eaeef5f4 -- src/system-designer.ts` |
| `src/connectors/stub-connector.ts` | NEW. Custom JointJS connector. In 2D (detected via the `nr-2d-icons-only` class on `paper.el`), prepends/appends a straight stub segment from icon edge (`SHAPE_CELL_SIZE/2` from cell center) to the port (cell-bbox edge midpoint) — only on ends where the link attaches to a port. In iso the class is absent → reduces to a normal straight-segment path. Accepts `linkView` via either the 5th argument or `this`-context. Also self-registers as `connectors.stub` (for future per-link override via `{ name: 'stub' }`). | `rm src/connectors/stub-connector.ts && rmdir src/connectors 2>/dev/null` |
| `src/routers/smart-router.ts` | **Rolled back** — file and parent directory removed. Multiple attempts to customise Manhattan (padding, excludeEnds, startDirections, lead-out vertices, custom fallback routers) each introduced new artefacts (diagonal segments, U-loops, asymmetric per-axis behaviour). Reverted to vanilla `{ name: 'manhattan' }` on the Paper. The "lines don't give shapes breathing room" complaint that motivated this work is moved to the *Open follow-ups* section. | n/a |

## Open follow-ups

- **Multi-Connection fanout on the same side.** Today all incoming connections collapse onto the single port midpoint. The new architecture supports per-link fanout cleanly (the anchor can be a function of the link), but no behavior change is taken in this ADR — revisit when it becomes a felt problem.
- **Existing saved diagrams.** Links with manual waypoints keep their waypoints; only the first/last segment endpoint moves. Visual drift on load is expected and accepted. No automated migration.
- **Non-Manhattan routers.** A diagonal main segment plus an orthogonal stub will produce a small kink at the Port. Not a new regression — current 2D already has this artefact; the stub does not worsen it. Revisit if it becomes felt.
- **Manhattan padding / lead-out.** The user reported that lines can bend immediately at the Hit Area edge in both views (the line "hugs" the shape and the arrowhead can end up pointing at the shape edge rather than at the target body). A custom router was attempted in this session but produced new artefacts in every configuration (see §3 of the Decision section). Left as vanilla Manhattan for now; a future attempt should either build a dedicated router with explicit per-port emergence handling, or accept the geometry and improve it visually via a different route (e.g. magnet-aware port direction hints at link-creation time).
