import { GRID_SIZE } from '../theme';
import { BaseShape } from './shape-definition';

export interface ShapeStyle {
    topColor?: string;
    sideColor?: string;
    frontColor?: string;
    strokeColor?: string;
}

/**
 * One visual building block inside a Complex Shape component.
 * All dimensional values are in pixels.
 */
export interface ShapeLayer {
    id: string;
    name: string;
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
    /** Raw uploaded SVG string, stored for re-processing and serialization. */
    svgFootprint?: string;
    /** Normalized [0..1] vertices derived from svgFootprint. Scaled to layer size at render time. */
    svgNormVerts?: [number, number][];
    /** Original filename of the uploaded SVG, shown in the inspector. */
    svgFootprintName?: string;
    /** When true, SVG footprint renders as a standing billboard instead of top-down extrusion. */
    svgBillboard?: boolean;
    /** Per-layer icon entries for multi-layer shapes. */
    icons?: IconEntry[];
}

export interface IconEntry {
    id: string;
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
    isMain?: boolean;
    href?: string;
    iconOpacity?: number;
    bgOpacity?: number;
}

export interface ShapeDefinition {
    defaultSize: { width: number; height: number };
    defaultIsometricHeight: number;
    baseShape?: BaseShape;
    /** Whether Dimension Y is adjustable in the grid for tube/duct shapes */
    dimYAdjustable?: boolean;
    /** Human-readable display name shown as the shape label */
    displayName?: string;
    /** Which face the icon is placed on in isometric view */
    iconFace?: 'top' | 'front' | 'side';
    /** ID of the selected icon from the asset library */
    icon?: string;
    /** Icon size in grid units (default 1 = GRID_SIZE px) */
    iconSize?: number;
    /** Whether the icon background is enabled */
    iconBgEnabled?: boolean;
    /** Background color of the icon badge */
    iconBgColor?: string;
    /** Background shape of the icon badge */
    iconBgShape?: 'circle' | 'square' | 'octagon';
    iconBgRadius?: number;
    /** Background size in grid units (default = same as iconSize) */
    iconBgSize?: number;
    /** Octagon corner cut depth as fraction of size (0–0.45, default 0.18) */
    iconBgChamfer?: number;
    /**
     * Pre-computed composite icon data URI (icon + coloured background).
     * Computed by the component designer at save time so the system designer
     * can apply it without rebuilding the SVG composite itself.
     */
    iconHref?: string;
    /**
     * For complex shapes only: which layer (by index into `layers`) carries
     * the icon. Defaults to 0 (main layer) for backwards compatibility.
     */
    iconLayerIndex?: number;
    /** Multi-icon entries (new format, replaces individual icon* fields) */
    icons?: IconEntry[];
    /** Infrastructure component type this shape represents */
    componentType?: string;
    /** Optional color overrides applied when a new instance is created */
    style?: ShapeStyle;
    /** When true, the component is composed of multiple layers instead of a single shape */
    complexShape?: boolean;
    /** Layer definitions for complex shapes; empty for simple shapes */
    layers?: ShapeLayer[];
    cornerRadius?: number;
    chamferSize?: number;
    chamferStart?: number;
    collection?: string;
    customVerts?: [number, number][] | [number, number][][];
    rotation?: number;
    hasVariations?: boolean;
    turned90?: ShapeDefinition;
    hitAreaSize?: { width: number; height: number };
    taper?: number;
    twist?: number;
    scaleTopX?: number;
    scaleTopY?: number;
}

/**
 * Canonical defaults for all built-in shapes.
 * This is the single source of truth — used to initialize the registry
 * and to re-hydrate it after localStorage is loaded (defensive).
 */
const BUILT_IN_DEFAULTS: Record<string, ShapeDefinition> = {
    'firewall': {
        defaultSize: { width: GRID_SIZE * 3, height: GRID_SIZE },
        defaultIsometricHeight: GRID_SIZE * 2,
        componentType: 'Firewall',
    },
    'switch': {
        defaultSize: { width: GRID_SIZE * 2, height: GRID_SIZE * 2 },
        defaultIsometricHeight: GRID_SIZE / 2,
        componentType: 'Switch',
    },
    'router': {
        defaultSize: { width: GRID_SIZE * 2, height: GRID_SIZE * 2 },
        defaultIsometricHeight: GRID_SIZE / 2,
    },
    'computer': {
        defaultSize: { width: GRID_SIZE, height: GRID_SIZE * 2 },
        defaultIsometricHeight: GRID_SIZE * 2,
        componentType: 'Server',
    },
    'database': {
        defaultSize: { width: GRID_SIZE, height: GRID_SIZE },
        defaultIsometricHeight: GRID_SIZE,
        componentType: 'Storage',
    },
    'kubernetes-worker-node': {
        defaultSize: { width: GRID_SIZE * 2, height: GRID_SIZE * 2 },
        defaultIsometricHeight: GRID_SIZE / 2,
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
    const { style, ...rest } = patch;
    Object.assign(ShapeRegistry[id], rest);
    if (style) {
        if (!ShapeRegistry[id].style) ShapeRegistry[id].style = {};
        Object.assign(ShapeRegistry[id].style, style);
    }
}

const REGISTRY_STORAGE_KEY = 'nextrack-shape-registry-v1';
const DELETED_STORAGE_KEY = 'nextrack-deleted-shapes-v1';

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

/** Migrate old single-icon properties to the new icons array format. */
export function migrateIconDef(def: ShapeDefinition): IconEntry[] {
    if (def.icons) return def.icons;
    if (!def.icon) return [];
    return [{
        id: def.icon,
        face: def.iconFace || 'top',
        size: def.iconSize || 1.5,
        offsetX: 0,
        offsetY: 0,
        skewX: 0,
        skewY: 0,
        bgEnabled: def.iconBgEnabled || false,
        bgColor: def.iconBgColor || '#525252',
        bgShape: def.iconBgShape || 'circle',
        bgSize: def.iconBgSize || 1.5,
        bgRadius: def.iconBgRadius || 6,
        bgChamfer: def.iconBgChamfer || 0.18,
        monochrome: false,
        adaptive: false,
        href: def.iconHref,
    }];
}

export function defaultIconEntry(isMain = false): IconEntry {
    return {
        id: '',
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
        isMain,
    };
}

// Populated with built-in defaults, then immediately hydrated from localStorage.
export const ShapeRegistry: Record<string, ShapeDefinition> = { ...BUILT_IN_DEFAULTS };

// Hydrate with any user-saved shapes immediately on module load.
loadRegistryFromStorage();
