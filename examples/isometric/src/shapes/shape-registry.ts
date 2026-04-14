import { GRID_SIZE } from '../theme';
import { BaseShape } from './shape-definition';

export interface ShapeStyle {
    topColor?: string;
    sideColor?: string;
    frontColor?: string;
    strokeColor?: string;
}

export interface ShapeDefaults {
    defaultSize: { width: number; height: number };
    defaultIsometricHeight: number;
    baseShape?: BaseShape;
    /** Human-readable display name shown as the shape label */
    displayName?: string;
    /** Which face the icon is placed on in isometric view */
    iconFace?: 'top' | 'front';
    /** ID of the selected icon from the asset library */
    icon?: string;
    /** Icon size in grid units (default 1 = GRID_SIZE px) */
    iconSize?: number;
    /** Background color of the icon badge */
    iconBgColor?: string;
    /** Background shape of the icon badge */
    iconBgShape?: 'circle' | 'square';
    /**
     * Pre-computed composite icon data URI (icon + coloured background).
     * Computed by the component designer at save time so the system designer
     * can apply it without rebuilding the SVG composite itself.
     */
    iconHref?: string;
    /** Optional color overrides applied when a new instance is created */
    style?: ShapeStyle;
}

/**
 * Canonical defaults for all built-in shapes.
 * This is the single source of truth — used to initialize the registry
 * and to re-hydrate it after localStorage is loaded (defensive).
 */
const BUILT_IN_DEFAULTS: Record<string, ShapeDefaults> = {
    'firewall': {
        defaultSize: { width: GRID_SIZE * 3, height: GRID_SIZE },
        defaultIsometricHeight: GRID_SIZE * 2,
    },
    'switch': {
        defaultSize: { width: GRID_SIZE * 2, height: GRID_SIZE * 2 },
        defaultIsometricHeight: GRID_SIZE / 2,
    },
    'router': {
        defaultSize: { width: GRID_SIZE * 2, height: GRID_SIZE * 2 },
        defaultIsometricHeight: GRID_SIZE / 2,
    },
    'computer': {
        defaultSize: { width: GRID_SIZE, height: GRID_SIZE * 2 },
        defaultIsometricHeight: GRID_SIZE * 2,
    },
    'database': {
        defaultSize: { width: GRID_SIZE, height: GRID_SIZE },
        defaultIsometricHeight: GRID_SIZE,
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

export function addShape(id: string, defaults: ShapeDefaults): void {
    ShapeRegistry[id] = defaults;
}

export function updateShapeDefaults(id: string, patch: Partial<ShapeDefaults>): void {
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
            const saved = JSON.parse(raw) as Record<string, ShapeDefaults>;
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

        // Defensive re-hydration: guarantee every built-in entry is always present.
        // This repairs any stale localStorage state that may have overwritten a built-in
        // with incomplete data, or any other unexpected corruption.
        for (const [id, defaults] of Object.entries(BUILT_IN_DEFAULTS)) {
            if (!ShapeRegistry[id]) {
                ShapeRegistry[id] = defaults;
            }
        }
    } catch (e) {
        console.error('[nextrack] Failed to load shape registry:', e);
    }
}

// Populated with built-in defaults, then immediately hydrated from localStorage.
export const ShapeRegistry: Record<string, ShapeDefaults> = { ...BUILT_IN_DEFAULTS };

// Hydrate with any user-saved shapes immediately on module load.
loadRegistryFromStorage();
