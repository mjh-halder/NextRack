// Per-icon scope configuration for the Component Designer icon picker.
//
// Each icon has exactly one scope:
//   - 'general'      → shown in the standard Component Editor AND in Complex Shape.
//   - 'complex-only' → shown ONLY in Complex Shape.
//   - 'none'         → not offered in any picker; available in the admin to add.
//
// Complex Shape is therefore a superset of General (general + complex-only),
// and every catalog icon with scope='none' is a pool the admin curates from.
//
// Default scope depends on the icon source:
//   - 'custom' (project assets)      → 'general' (preserves legacy behaviour)
//   - 'carbon' (full Carbon library) → 'none'    (user opts in explicitly)
//
// Persisted in localStorage. Unknown icon ids fall back to the source-default.

import { ICON_CATALOG, IconCatalogEntry, getIconById } from './icon-catalog';

export type IconScope = 'general' | 'complex-only' | 'none';

// Stable external contract used by the Component Designer picker.
export type IconContext = 'componentEditor' | 'complexShape';

export type IconConfigMap = Record<string, IconScope>;

const STORAGE_KEY = 'nr-icon-config-v3';

function defaultScopeFor(entry: IconCatalogEntry | undefined): IconScope {
    if (!entry) return 'none';
    return (entry.source === 'custom' || entry.source === 'uploaded' || entry.source === 'aws') ? 'general' : 'none';
}

type Listener = () => void;
const listeners = new Set<Listener>();

function readRaw(): IconConfigMap {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
        console.error('[nextrack] Failed to read icon config:', e);
        return {};
    }
}

function writeRaw(map: IconConfigMap): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
        console.error('[nextrack] Failed to save icon config:', e);
    }
}

/** Full scope map for every icon in the catalog, with defaults applied. */
export function getAllConfig(): IconConfigMap {
    const stored = readRaw();
    const out: IconConfigMap = {};
    for (const icon of ICON_CATALOG) {
        out[icon.id] = stored[icon.id] ?? defaultScopeFor(icon);
    }
    return out;
}

export function getIconScope(iconId: string): IconScope {
    const stored = readRaw()[iconId];
    return stored ?? defaultScopeFor(getIconById(iconId));
}

export function setIconScope(iconId: string, scope: IconScope): void {
    const map = readRaw();
    map[iconId] = scope;
    writeRaw(map);
    listeners.forEach(l => l());
}

/** Returns catalog entries visible in the given picker context. */
export function getVisibleIcons(context: IconContext): IconCatalogEntry[] {
    const cfg = getAllConfig();
    if (context === 'componentEditor') {
        return ICON_CATALOG.filter(i => cfg[i.id] === 'general');
    }
    // Complex Shape = general ∪ complex-only.
    return ICON_CATALOG.filter(i => cfg[i.id] === 'general' || cfg[i.id] === 'complex-only');
}

export function onIconConfigChange(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
