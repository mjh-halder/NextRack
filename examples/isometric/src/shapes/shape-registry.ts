import { GRID_SIZE } from '../theme';
import { BaseShape } from './shape-definition';

export interface ShapeStyle {
    topColor?: string;
    sideColor?: string;
    frontColor?: string;
    strokeColor?: string;
}

/**
 * One icon placed on a layer. A layer can carry zero or more.
 * `id` is the stable entry identity (survives reorders).
 * `iconId` is the catalog reference.
 */
export interface IconEntry {
    /** Stable entry identity. Used by editor chokepoints to address this entry. */
    id: string;
    /** Catalog icon id from the asset library. Empty string = background-only entry. */
    iconId: string;
    /** Display name shown in the icon list, defaulting to catalog label. */
    name?: string;
    face: 'top' | 'front' | 'side';
    size: number;
    offsetX: number;
    offsetY: number;
    skewX: number;
    skewY: number;
    bgEnabled: boolean;
    bgColor: string;
    bgShape: 'circle' | 'square' | 'octagon';
    bgSize: number;
    bgRadius: number;
    bgChamfer: number;
    monochrome: boolean;
    adaptive: boolean;
    /** Override icon color (when no background). */
    iconColor?: string;
    /** When true, this is the canonical icon shown in 2D view. Only one per layer. */
    isMain?: boolean;
    /** Pre-rendered composite href cached for instance-spawn. */
    href?: string;
    iconOpacity?: number;
    bgOpacity?: number;
}

/**
 * One visual building block inside a shape. Every shape has at least one layer.
 * All dimensional values are in pixels.
 */
export interface ShapeLayer {
    id: string;
    name: string;
    /**
     * Geometric form. 'custom' = user-drawn polygon; 'svgPolygon' = uploaded SVG.
     * For both, vertices are in `normalizedVerts`. For 'svgPolygon', the raw SVG
     * source is also kept in `svgFootprint` for re-parsing and billboard mode.
     */
    baseShape: BaseShape;
    width: number;
    height: number;
    depth: number;
    offsetX: number;        // horizontal offset across the base plane
    offsetY: number;        // depth offset across the base plane
    baseElevation: number;  // isometric Z lift above the component base
    style: ShapeStyle;
    cornerRadius?: number;
    chamferSize?: number;
    chamferStart?: number;
    chamferBottomSize?: number;
    chamferBottomStart?: number;
    taper?: number;
    twist?: number;
    scaleTopX?: number;
    scaleTopY?: number;
    shedRoofDrop?: number;
    shedRoofDirection?: string;

    /** Normalized [0..1] vertices. Present iff baseShape === 'custom' || 'svgPolygon'. */
    normalizedVerts?: [number, number][];
    /** Raw uploaded SVG source. Present iff baseShape === 'svgPolygon'. */
    svgFootprint?: string;
    /** Original filename of uploaded SVG. Present iff baseShape === 'svgPolygon'. */
    svgFootprintName?: string;
    /** When true, SVG renders as a standing billboard. Only used iff baseShape === 'svgPolygon'. */
    svgBillboard?: boolean;

    /** Icon entries on this layer. Always present, may be empty. */
    icons: IconEntry[];
}

/**
 * A component definition. Every shape has one or more layers — there is no
 * "simple vs. complex" distinction. A single-layer shape is the natural minimum;
 * multi-layer shapes stack additional layers above the main one.
 */
export interface ShapeDefinition {
    /** Human-readable display name. */
    displayName: string;
    /** Infrastructure component type (e.g., "Firewall", "Switch"). */
    componentType?: string;
    /** Palette grouping. */
    collection?: string;
    /** Whether Dimension Y is adjustable in the grid (tube/duct/pipe shapes). */
    dimYAdjustable?: boolean;
    /** Optional hit-area override (larger than layered bbox) for placement collision. */
    hitAreaSize?: { width: number; height: number };
    /** Whether this shape has a 90°-rotated variation. */
    hasVariations?: boolean;
    /** Alternate definition for the 90°-rotated variation. */
    turned90?: ShapeDefinition;
    /** Default rotation applied at instance-spawn. */
    defaultRotation?: number;
    /** One or more layers. Always at least one. layers[0] is the "main" layer. */
    layers: ShapeLayer[];
}

/** Helper: make a new ShapeLayer with sensible defaults and a fresh stable id. */
export function defaultShapeLayer(partial: Partial<ShapeLayer> = {}): ShapeLayer {
    return {
        id: `layer-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        name: 'Main',
        baseShape: 'cuboid',
        width: GRID_SIZE * 2,
        height: GRID_SIZE * 2,
        depth: GRID_SIZE,
        offsetX: 0,
        offsetY: 0,
        baseElevation: 0,
        style: {},
        icons: [],
        ...partial,
    };
}

/** Helper: make a new IconEntry with default settings and a fresh stable id. */
export function defaultIconEntry(partial: Partial<IconEntry> = {}): IconEntry {
    return {
        id: `icon-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        iconId: '',
        face: 'top',
        size: 1.5,
        offsetX: 0,
        offsetY: 0,
        skewX: 0,
        skewY: 0,
        bgEnabled: false,
        bgColor: '#525252',
        bgShape: 'circle',
        bgSize: 1.5,
        bgRadius: 6,
        bgChamfer: 0.18,
        monochrome: false,
        adaptive: false,
        ...partial,
    };
}

/**
 * Canonical defaults for all built-in shapes.
 * Built-ins are registry entries that legacy code paths may look up by id,
 * but they are NOT exposed in the palette (the user-facing list comes from
 * the shape store).
 */
const BUILT_IN_DEFAULTS: Record<string, ShapeDefinition> = {
    'firewall': {
        displayName: 'Firewall',
        componentType: 'Firewall',
        layers: [defaultShapeLayer({
            id: 'layer-firewall-main',
            width: GRID_SIZE * 3,
            height: GRID_SIZE,
            depth: GRID_SIZE * 2,
        })],
    },
    'switch': {
        displayName: 'Switch',
        componentType: 'Switch',
        layers: [defaultShapeLayer({
            id: 'layer-switch-main',
            width: GRID_SIZE * 2,
            height: GRID_SIZE * 2,
            depth: GRID_SIZE / 2,
        })],
    },
    'router': {
        displayName: 'Router',
        layers: [defaultShapeLayer({
            id: 'layer-router-main',
            width: GRID_SIZE * 2,
            height: GRID_SIZE * 2,
            depth: GRID_SIZE / 2,
        })],
    },
    'computer': {
        displayName: 'Server',
        componentType: 'Server',
        layers: [defaultShapeLayer({
            id: 'layer-computer-main',
            width: GRID_SIZE,
            height: GRID_SIZE * 2,
            depth: GRID_SIZE * 2,
        })],
    },
    'database': {
        displayName: 'Storage',
        componentType: 'Storage',
        layers: [defaultShapeLayer({
            id: 'layer-database-main',
            width: GRID_SIZE,
            height: GRID_SIZE,
            depth: GRID_SIZE,
        })],
    },
    'kubernetes-worker-node': {
        displayName: 'Worker Node',
        layers: [defaultShapeLayer({
            id: 'layer-k8s-main',
            width: GRID_SIZE * 2,
            height: GRID_SIZE * 2,
            depth: GRID_SIZE / 2,
        })],
    },
};

/** IDs of shapes that ship with the app and are not user-created. */
export const BUILT_IN_SHAPE_IDS = new Set(Object.keys(BUILT_IN_DEFAULTS));

export function deleteShape(id: string): void {
    // Built-in shapes must never be removed from the runtime registry.
    // They may be hidden in the UI via BUILT_IN_SHAPE_IDS, but the registry
    // entries must always exist because built-in shape modules read them at init.
    if (BUILT_IN_SHAPE_IDS.has(id)) return;

    delete ShapeRegistry[id];

    // Persist the deletion so user-defined shapes stay deleted across page reloads.
    try {
        const raw = localStorage.getItem(DELETED_STORAGE_KEY);
        const list: string[] = raw ? JSON.parse(raw) : [];
        if (!list.includes(id)) {
            list.push(id);
            localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(list));
        }
    } catch { /* non-critical */ }
}

export function addShape(id: string, defaults: ShapeDefinition): void {
    ShapeRegistry[id] = defaults;
    try {
        const raw = localStorage.getItem(DELETED_STORAGE_KEY);
        if (raw) {
            const list: string[] = JSON.parse(raw);
            const filtered = list.filter(d => d !== id);
            if (filtered.length !== list.length) {
                localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(filtered));
            }
        }
    } catch { /* non-critical */ }
}

export function updateShapeDefinition(id: string, patch: Partial<ShapeDefinition>): void {
    if (!ShapeRegistry[id]) return;
    Object.assign(ShapeRegistry[id], patch);
}

const REGISTRY_STORAGE_KEY = 'nextrack-shape-registry-v2';
const DELETED_STORAGE_KEY = 'nextrack-deleted-shapes-v2';

export function saveRegistryToStorage(): void {
    try {
        localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(ShapeRegistry));
    } catch (e) {
        console.error('[nextrack] Failed to save shape registry:', e);
    }
}

export function loadRegistryFromStorage(): void {
    try {
        // Merge user-saved shapes on top of the built-in defaults.
        const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
        if (raw) {
            const saved = JSON.parse(raw) as Record<string, ShapeDefinition>;
            for (const [id, defaults] of Object.entries(saved)) {
                ShapeRegistry[id] = defaults;
            }
        }

        // Apply deletion tombstones for user-defined shapes only.
        // Built-in IDs are never removed regardless of what the tombstone list contains.
        const deletedRaw = localStorage.getItem(DELETED_STORAGE_KEY);
        if (deletedRaw) {
            const deleted = JSON.parse(deletedRaw) as string[];
            for (const id of deleted) {
                if (!BUILT_IN_SHAPE_IDS.has(id)) {
                    delete ShapeRegistry[id];
                }
            }
        }

        // Defensive re-hydration: guarantee every built-in entry has at least
        // the canonical default values. Merges built-in defaults under the
        // saved entry so user overrides are preserved but missing fields
        // (e.g. componentType added after initial save) are filled in.
        for (const [id, defaults] of Object.entries(BUILT_IN_DEFAULTS)) {
            if (!ShapeRegistry[id]) {
                ShapeRegistry[id] = defaults;
            } else {
                const merged = { ...defaults, ...ShapeRegistry[id] };
                if (defaults.componentType && !merged.componentType) {
                    merged.componentType = defaults.componentType;
                }
                ShapeRegistry[id] = merged;
            }
        }
    } catch (e) {
        console.error('[nextrack] Failed to load shape registry:', e);
    }
}

// Populated with built-in defaults, then immediately hydrated from localStorage.
export const ShapeRegistry: Record<string, ShapeDefinition> = { ...BUILT_IN_DEFAULTS };

// Hydrate with any user-saved shapes immediately on module load.
loadRegistryFromStorage();
