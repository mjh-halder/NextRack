# Session Handoff — 2026-05-16

## What was done this session

### Inspector Redesign
- **Component Inspector**: Fixed title to "Component Inspector", removed title background, added overflow menu (three-dot) for Duplicate/Delete actions, added tabs (Properties/Notes), accordion sections (Design/Data)
- **Zone Inspector**: Same tab+accordion structure, label position as dropdown, hex color picker replacing swatch buttons, notes support, "Zone Inspector" title
- **Connection Inspector**: Same structure, "Connection Inspector" title, notes support
- **Area Inspector**: Full inspector with Design (name, fill color, opacity slider), Outline (style dropdown: None/Dotted/Square-dotted/Dashed/Solid, thickness, color), Corner (rounded/cut, radius)
- **Label Inspector**: Text, color picker, font size input, orientation switcher (Default/Rotated)
- Helper methods added: `buildAccordionSection()`, `buildTabBar()`, `buildColorPicker()`, `hideAllSections()`

### Selection System
- **Selection outline**: Black 0.5px + white 0.5px double line (works on any background), 2px padding, 1px rounded corners
- **Corner squares**: 5×5px white-filled, grey border (#8d8d8d), subtle shadow (SVG filter), shown for resizable elements (zones, areas, labels)
- **Selection rendering**: FRONT layer for zones/areas/labels, FRONT for components too (was BACK briefly)
- **Rotation-aware**: `getVisualBounds()` in hover-highlight.ts computes rotated bounding box when `labelRotation === 270`
- **Tool handle visibility**: Uses `nr-tools--hover` class on `.joint-tools` elements, set in `applySelect`, cleared in `restoreSelectState`

### Hover System
- Brightness filter `brightness(1.1)` on hover for all elements (components + zones)
- Removed old spinning ring and zone glow effects

### New Design Elements
- **Area**: Visual-only rectangle, no collision, z=-1, dashed outline, resizable via FrameCornerControl. Default: blue (#0043CE), 50% opacity, no outline
- **Label (GridLabel)**: Text element on grid, no collision, z=-1, resizable via FrameCornerControl, auto-sizes to content. Font scales proportionally on resize
- **Double Arrow**: Block arrow shape with `barRatio` attribute (0.1–0.9), adjustable via yellow diamond handle (BarThicknessControl). Uses `@Function() arrowPath()` for reactive SVG path
- **All three** in Design section of palette, visible in just-draw mode

### Rotation System
- `applyRotation(el, deg)` in `tools/rotate-tool.ts` — sets `labelRotation`, applies `body/transform` and `label/transform` with `rotate(deg, cx, cy)`
- Selection outline accounts for rotation via `getVisualBounds()`
- Right-click "Rotate" for labels and double arrows (toggles 0°↔270°)
- Inspector switcher for labels (Default/Rotated)
- **Known issue**: BarThicknessControl yellow handle repositioning after rotation works but required `update()` override with `childNodes` guard

### Billboard (SVG Stand-Up)
- SVG Footprint section has "Stand Up" toggle for complex shapes
- Uses `<image>` element with front-face matrix transform: `matrix(1,0,-1,-1,0,h) rotate(180,cx,cy)`
- Stored as `layer.svgBillboard` flag on ShapeLayer
- 2D view shows flat SVG
- Depth effect was attempted but removed — just flat billboard for now

### Floating Callout Labels
- HTML overlay system in `src/callout-labels.ts`
- White rounded card with title+subtitle, dotted connector line (round dots via radial-gradient)
- Distance scales with isometricHeight
- Toggle via "Floating Label" checkbox in component inspector Design section
- Hidden in 2D view, refreshes on pan/zoom/move/minimap navigation

### Canvas & Navigation
- Panning fixed: uses `paper.matrix()` translation instead of broken `window.scroll()`
- Centering fixed: `centerGridInViewport()` uses matrix translation, called on initial load
- Zoom slider: derives `currentZoom` from actual paper matrix scale vs base matrix

### Other Fixes
- Pipe/duct resize constrained at tool level (SizeControl)
- Tube diameter field in component designer (replaces separate Y/Z)
- Pipe/tube 2D view: rectangular instead of capsule
- Icon background color: decode→replace→encode approach, inserts bg when missing
- Component designer: `markDirty()` on dimension and icon bg color changes
- Zone multi-select with coordinated resize already wired
- Dark mode: transparent base rects excluded from stroke override

## Key Files Modified
- `src/inspector.ts` — Major rewrite of all inspector panels
- `src/hover-highlight.ts` — Selection, connection highlights, hover
- `src/system-designer.ts` — Selection wiring, context menus, pan/zoom, callout hooks
- `src/callout-labels.ts` — NEW: floating label overlay
- `src/tools/rotate-tool.ts` — NEW: rotation logic
- `src/tools/frame-size-tool.ts` — Invisible hit-area handles (no visual)
- `src/tools/size-tool.ts` — Constrained resize for pipe/duct
- `src/tools/tools.ts` — Caret icons for constrained resize
- `src/shapes/area/` — NEW: Area shape
- `src/shapes/grid-label/` — NEW: GridLabel shape
- `src/shapes/double-arrow/` — NEW: DoubleArrow shape
- `src/palette.ts` — Design section, Area/DoubleArrow/Label items
- `src/shapes/svgpolygon/` — Billboard rendering additions
- `src/component-designer.ts` — Billboard toggle, dimension fixes, form factor sync
- `style.css` — Selection styles, callout styles, section headers, empty state

## Known Issues / Open Items
- Tool handle visibility is fragile — `nr-tools--hover` class approach works but timing-sensitive
- Billboard depth effect (thick cardboard cutout) was attempted but couldn't get the side strip to align with the two image faces — removed, just flat billboard now
- Label auto-size sometimes leaves extra whitespace
- Area "cut" corner style not visually implemented (only rounded works via rx/ry)
