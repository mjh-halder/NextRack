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

Implementation note: `layers[0]` used to carry special status (label anchor, icon anchor, undeleteable, immovable, forced `baseElevation=0`). That status is obsolete and gets removed in the upcoming refactor.

## Hit Area

A rectangle on the floor plane that defines a Component's placement footprint in the System Designer — used for collision detection, snapping, and as the **anchor for the Shape's label**. It is independent of the Layers: the Hit Area always sits at floor level, even when every Layer floats above it.

Stored as `hitAreaSize: { width, height }` on the Shape Definition. If not explicitly set, derived from the bounding box of all Layers.

The Hit Area is what allows Layers to float freely. Before this concept was used for labels, `layers[0]` had to be pinned to the floor so the label rendered correctly; now the Hit Area takes that job and `layers[0]` is freed from the floor.

## IconEntry

A single icon placed on a Layer. A Layer carries zero or more IconEntries (`layer.icons[]`).

Each IconEntry has:
- a stable `id` for editor addressing (survives reorders)
- an `iconId` referencing the icon catalog (e.g., `"security"`, `"firewall"`)
- placement (face: top/front/side, offset, size, skew)
- background styling (color, shape, radius, chamfer)
- an `isMain` flag

**isMain** marks the *one* IconEntry within a Layer that represents the Layer in the 2D view (where only one icon can be shown clearly). It is **per-Layer**, not per-Shape. It is unrelated to the now-obsolete "Main Layer" concept.

## Catalog Icon

An entry in the icon library (Carbon, AWS, GCP, Azure icon sets). Addressed by `iconId`. An IconEntry references a Catalog Icon — they are not the same thing. The Catalog Icon is the raw asset; the IconEntry is its placement on a Layer with all the styling around it.
