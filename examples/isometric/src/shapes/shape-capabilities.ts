/**
 * Shape capability registry — single source of truth for which modifiers and
 * dimension behaviours apply to which base shape. See ADR-0004.
 *
 * Adding a new modifier:
 *   1. Add the key to `ModifierKey` in isometric-shape.ts.
 *   2. Add it to the categories in `CATEGORY_MODIFIERS` that support it.
 *   3. (Optional) Add per-shape exclusion in `SHAPE_EXCLUDES` and a tooltip
 *      string in `UNSUPPORTED_REASONS`.
 *   4. (Optional) Add a `LAYER_PREDICATES` entry if support depends on
 *      runtime layer state (e.g. custom-shape vertex count).
 *
 * No UI file should encode its own capability rules — consume the helpers
 * exported at the bottom of this file instead.
 */

import { BaseShape } from './shape-definition';
import { ModifierKey } from './nextrack-isometric-shape';
import { ShapeLayer } from './shape-registry';

// ── Categories ──────────────────────────────────────────────────────────────

export type ShapeCategory = 'polygonal' | 'radial' | 'tubeLike' | 'custom';

export const SHAPE_CATEGORY: Record<BaseShape, ShapeCategory> = {
    rectangle:     'polygonal',
    hexahedron: 'polygonal',
    octagon:    'polygonal',
    circle:   'radial',
    tube:       'tubeLike',
    pipe:       'tubeLike',
    duct:       'tubeLike',
    channel:    'tubeLike',
    custom:     'custom',
    svgPolygon: 'custom',
};

// ── Modifier capability ─────────────────────────────────────────────────────

const ALL_POLYGON_MODIFIERS: readonly ModifierKey[] = [
    'cornerRadius',
    'chamfer', 'chamferHeight', 'chamferBottom', 'chamferBottomHeight',
    'twist', 'scaleTopX', 'scaleTopY',
    'shedRoof', 'shedRoofDir',
];

const CATEGORY_MODIFIERS: Record<ShapeCategory, ReadonlySet<ModifierKey>> = {
    polygonal: new Set<ModifierKey>(ALL_POLYGON_MODIFIERS),
    // Circle body is axially-symmetric: no corners/chamfer/shed-roof; no
    // twist on a round body. Only top-scaling makes sense.
    radial: new Set<ModifierKey>(['scaleTopX', 'scaleTopY']),
    // Tube-family templates have no modifier wiring at all today.
    tubeLike: new Set<ModifierKey>(),
    custom: new Set<ModifierKey>(ALL_POLYGON_MODIFIERS),
};

/** Per-shape modifiers to *exclude* from the category baseline. */
const SHAPE_EXCLUDES: Partial<Record<BaseShape, ReadonlySet<ModifierKey>>> = {
    // Octagon is polygonal but has 8 vertices — shedRoofDrops returns zeroes
    // for n !== 4, so the slider would silently no-op.
    octagon: new Set<ModifierKey>(['shedRoof', 'shedRoofDir']),
};

/**
 * Per-shape exclusion reasons — used for UI tooltips on hidden modifiers.
 * Strings are user-facing; keep them short and explanatory.
 */
const UNSUPPORTED_REASONS: Partial<Record<BaseShape, Partial<Record<ModifierKey, string>>>> = {
    circle: {
        cornerRadius: 'Round shapes have no corners.',
        chamfer: 'Chamfer requires angular edges.',
        chamferBottom: 'Chamfer requires angular edges.',
        twist: 'Twist is not defined for axially-symmetric shapes.',
        shedRoof: 'Shed roof requires a flat polygon top.',
    },
    octagon: {
        shedRoof: 'Shed roof requires a 4-vertex base.',
        shedRoofDir: 'Shed roof requires a 4-vertex base.',
    },
    custom: {
        shedRoof: 'Shed roof requires exactly 4 vertices.',
        shedRoofDir: 'Shed roof requires exactly 4 vertices.',
    },
};

/**
 * Layer-aware capability predicates. Returns `false` to subtract a modifier
 * from the otherwise-supported set; `null` means no opinion (use baseline).
 */
type LayerPredicate = (modifier: ModifierKey, layer: ShapeLayer) => boolean | null;

function customShedRoofPredicate(mod: ModifierKey, layer: ShapeLayer): boolean | null {
    if (mod !== 'shedRoof' && mod !== 'shedRoofDir') return null;
    const verts = (layer.normalizedVerts ?? []) as Array<[number, number]>;
    return verts.length === 4;
}

const LAYER_PREDICATES: Partial<Record<BaseShape, LayerPredicate>> = {
    custom: customShedRoofPredicate,
    svgPolygon: customShedRoofPredicate,
};

// ── Modifier helpers ────────────────────────────────────────────────────────

export function getSupportedModifiers(baseShape: BaseShape, layer?: ShapeLayer): Set<ModifierKey> {
    const category = SHAPE_CATEGORY[baseShape];
    const result = new Set(CATEGORY_MODIFIERS[category]);
    SHAPE_EXCLUDES[baseShape]?.forEach(m => result.delete(m));
    if (layer) {
        const pred = LAYER_PREDICATES[baseShape];
        if (pred) {
            const toCheck: ModifierKey[] = [];
            result.forEach(m => toCheck.push(m));
            toCheck.forEach(mod => {
                if (pred(mod, layer) === false) result.delete(mod);
            });
        }
    }
    return result;
}

export function supportsModifier(baseShape: BaseShape, modifier: ModifierKey, layer?: ShapeLayer): boolean {
    return getSupportedModifiers(baseShape, layer).has(modifier);
}

export function getUnsupportedReason(baseShape: BaseShape, modifier: ModifierKey): string | null {
    return UNSUPPORTED_REASONS[baseShape]?.[modifier] ?? null;
}

// ── Dimension capability ────────────────────────────────────────────────────

export interface DimensionInfo {
    /** Label shown next to the stepper. */
    label: string;
    /** When true, the input is auto-synced from another dimension (read-only). */
    readonly: boolean;
}

export interface ShapeDimensions {
    x: DimensionInfo;
    y: DimensionInfo;
    /** null = dimension is not exposed in the UI (e.g. tube depth is derived). */
    z: DimensionInfo | null;
}

const DEFAULT_DIMENSIONS: ShapeDimensions = {
    x: { label: 'Dimension X', readonly: false },
    y: { label: 'Dimension Y', readonly: false },
    z: { label: 'Dimension Z', readonly: false },
};

export function dimensionsFor(baseShape: BaseShape): ShapeDimensions {
    const category = SHAPE_CATEGORY[baseShape];
    if (category === 'tubeLike') {
        return {
            x: { label: 'Length',   readonly: false },
            y: { label: 'Diameter', readonly: false },
            z: null,
        };
    }
    // Radial (round) and octagon: visual shape forces height === width.
    if (category === 'radial' || baseShape === 'octagon') {
        return {
            x: { label: 'Dimension X', readonly: false },
            y: { label: 'Dimension Y', readonly: true },
            z: { label: 'Dimension Z', readonly: false },
        };
    }
    return DEFAULT_DIMENSIONS;
}

/** Convenience predicate for callers that only care about the Y-locked case. */
export function requiresSquareBase(baseShape: BaseShape): boolean {
    return dimensionsFor(baseShape).y.readonly;
}

/** True for shapes whose orientation is the 90°-rotated variant of another. */
export function isRotatedForm(baseShape: BaseShape): boolean {
    return baseShape === 'pipe' || baseShape === 'channel';
}

/** True for tube-family shapes (tube/pipe/duct/channel). */
export function isTubeFamily(baseShape: BaseShape): boolean {
    return SHAPE_CATEGORY[baseShape] === 'tubeLike';
}

// ── Pipe variant group ──────────────────────────────────────────────────────
//
// "Pipe" is one UI base shape with two cross-section variants (round vs.
// octagonal), each in two orientations (default vs. 90°-rotated). The four
// internal BaseShape values (tube/pipe/duct/channel) are derived from
// (variant, rotated) — they share the same dimension behaviour (Length /
// Diameter; no Z) and modifier set, so it's natural to expose them as one
// group with an in-panel variant switcher instead of four dropdown entries.

export type PipeVariant = 'round' | 'octagonal';

/** Returns the variant if the shape is part of the pipe group, else null. */
export function pipeVariantOf(baseShape: BaseShape): PipeVariant | null {
    if (baseShape === 'tube' || baseShape === 'pipe')    return 'round';
    if (baseShape === 'duct' || baseShape === 'channel') return 'octagonal';
    return null;
}

/** True if the shape belongs to the pipe variant group. */
export function isPipeGroup(baseShape: BaseShape): boolean {
    return pipeVariantOf(baseShape) !== null;
}

/**
 * Resolve a pipe-group BaseShape from (variant, isRotated). Used when the
 * UI's variant switcher changes the cross-section but the orientation
 * (= rotated form) must be preserved.
 */
export function pipeBaseShape(variant: PipeVariant, rotated: boolean): BaseShape {
    if (variant === 'round')     return rotated ? 'pipe'    : 'tube';
    /* octagonal */              return rotated ? 'channel' : 'duct';
}

// ── Default dimensions per base shape ───────────────────────────────────────
//
// Single source of truth for "what size does a new instance of this base shape
// have?" — consumed by the shape classes (module-init defaults), the Component
// Designer's Reset-to-default button, and any other code that needs the
// canonical size for a base shape. Pixels.

export interface ShapeDimensionDefaults {
    width: number;
    height: number;
    depth: number;
}

// Note for tube-like shapes: the Y stepper is "Diameter" (= depth in the
// model). The model `height` field is unused by the UI for tube-family but
// kept consistent with the diameter for sane rendering bounds.
// Pipe/Channel are 90°-rotated variants — their model width/height swap so
// the UI's "Length" axis matches the on-screen orientation.
export const DIMENSION_DEFAULTS: Record<BaseShape, ShapeDimensionDefaults> = {
    rectangle:  { width: 40, height: 40, depth: 10 },
    circle:     { width: 40, height: 40, depth: 10 },
    octagon:    { width: 40, height: 40, depth: 10 },
    hexahedron: { width: 40, height: 40, depth: 40 },
    tube:       { width: 40, height: 20, depth: 20 },
    pipe:       { width: 20, height: 40, depth: 20 },
    duct:       { width: 40, height: 20, depth: 20 },
    channel:    { width: 20, height: 40, depth: 20 },
    custom:     { width: 40, height: 40, depth: 10 },
    svgPolygon: { width: 40, height: 40, depth: 10 },
};

export function defaultDimensionsFor(baseShape: BaseShape): ShapeDimensionDefaults {
    return DIMENSION_DEFAULTS[baseShape] ?? DIMENSION_DEFAULTS.rectangle;
}

// ── Color themes ────────────────────────────────────────────────────────────
//
// Named presets for the shape's fill + stroke colors. "Default" = the
// renderer's own neutral defaults (no custom colors set). "Custom" =
// user-defined values in layer.style.{top,front,side,stroke}Color{,Dark}.
// Vendor presets (Azure, GCP, …) write known brand colors into those
// same fields.

export type ColorTheme = 'default' | 'gcp' | 'aws' | 'azure' | 'custom';

export interface ThemeColorSet {
    shapeLight: string;
    shapeDark:  string;
    lineLight:  string;
    lineDark:   string;
}

/**
 * Vendor presets live as a single base hex; the four shape tokens
 * (light.fill, light.edge, dark.fill, dark.edge) are derived per-call from
 * the base via `createThemeColor` (see color-derivation.ts). This keeps the
 * Light/Dark visual character consistent and lets the admin Color Adjustment
 * tuning UI re-derive everything from one source.
 */
import { createThemeColor, getDerivationSettings, type CreateThemeColorOptions, type TunableTheme } from '../color-derivation';

interface SemanticBase { base: string; options?: CreateThemeColorOptions }

/**
 * Per-theme base hex + neutrality flag. The four shape-render tokens
 * (light.fill, light.edge, dark.fill, dark.edge) are derived from these on
 * every read via `createThemeColor`, using the per-theme tuning settings
 * managed by the admin Color Adjustment UI.
 */
export const SEMANTIC_COLOR_BASES: Partial<Record<ColorTheme, SemanticBase>> = {
    default: { base: '#a8a8a8', options: { neutral: true } },
    azure:   { base: '#0078D4' },                              // Microsoft Blue
    aws:     { base: '#FFB000' },                              // Amazon Yellow
    gcp:     { base: '#F2F4F7', options: { neutral: true } }, // Google Neutral
};

/** Resolve a preset to its current four shape tokens using per-theme tuning. */
export function getThemeColors(theme: ColorTheme): ThemeColorSet | undefined {
    const def = SEMANTIC_COLOR_BASES[theme];
    if (!def) return undefined;
    const settings = getDerivationSettings(theme as TunableTheme);
    const tok = createThemeColor(def.base, def.options, settings);
    return {
        shapeLight: tok.light.fill,
        shapeDark:  tok.dark.fill,
        lineLight:  tok.light.edge,
        lineDark:   tok.dark.edge,
    };
}

/**
 * Back-compat surface. Consumers should prefer `getThemeColors(theme)` so
 * they pick up live tuning of the derivation settings, but legacy lookups
 * via THEME_COLORS[theme] keep working — every read computes the tokens
 * fresh from the current base + derivation settings.
 */
export const THEME_COLORS: Partial<Record<ColorTheme, ThemeColorSet>> = new Proxy({}, {
    get(_, prop: string): ThemeColorSet | undefined {
        return getThemeColors(prop as ColorTheme);
    },
}) as Partial<Record<ColorTheme, ThemeColorSet>>;

/**
 * Effective Default-theme look — derived live so it matches whatever the
 * admin's Color Adjustment UI has tuned for the 'default' theme.
 *
 * NOTE: this used to be a flat constant. Callers should now call
 * `getDefaultColors()` so they always see the up-to-date set after a
 * derivation tuning change.
 */
export function getDefaultColors(): ThemeColorSet {
    return getThemeColors('default') ?? {
        shapeLight: '#e0e0e0',
        shapeDark:  '#525252',
        lineLight:  '#333333',
        lineDark:   '#161616',
    };
}

/** @deprecated Use getDefaultColors() — live-derived. Proxy stays for back-compat. */
export const DEFAULT_COLORS: ThemeColorSet = new Proxy({} as ThemeColorSet, {
    get(_, prop: string): string | undefined {
        const colors = getDefaultColors() as unknown as Record<string, string>;
        return colors[prop];
    },
}) as ThemeColorSet;
