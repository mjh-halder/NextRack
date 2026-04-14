/**
 * BaseShape identifies which isometric geometry class backs a shape.
 * Maps to the concrete classes in isometric-shape.ts.
 */
export type BaseShape =
    | 'cuboid'       // CuboidShape — rectangular prism
    | 'cylinder'     // CylinderShape — elliptical prism
    | 'pyramid'      // PyramidShape — tapered prism with single apex
    | 'hexagonal'    // ProportionalCuboidShape — hexagonal prism (6-sided)
    | 'octagon'      // CuboidShape — octagonal prism (8-sided, corner-cut square)
    | 'hexahedron';  // CuboidShape — regular cube (equal width, height, depth)

/**
 * Optional per-shape color overrides.
 * Any field omitted falls back to the global theme defaults.
 */
export interface ShapeStyle {
    topColor?: string;      // fill color of the top face
    sideColor?: string;     // fill color of the side (right) face
    frontColor?: string;    // fill color of the front (bottom) face
    strokeColor?: string;   // outline color used on all faces
}

/**
 * ShapeDefinition is the canonical template for a single component type.
 * It defines what a freshly dropped instance looks like before any user edits.
 * It does not represent a live canvas instance.
 */
export interface ShapeDefinition {
    /** Unique stable key; must match the corresponding ShapeRegistry key. */
    id: string;

    /** Human-readable name shown in the palette and Shape Designer. */
    label: string;

    /** Which isometric geometry class renders this shape. */
    baseShape: BaseShape;

    /** Default bounding-box width in pixels. */
    defaultWidth: number;

    /** Default bounding-box height in pixels. */
    defaultHeight: number;

    /** Default isometric extrusion depth in pixels (the 3-D lift). */
    defaultDepth: number;

    /** SVG string displayed as the icon on the top face of the shape. */
    icon: string;

    /** Optional color overrides applied when a new instance is created. */
    style?: ShapeStyle;
}
