import { ShapeDefinition, addShape, ShapeRegistry } from './shapes/shape-registry';
import { getIconById } from './icon-catalog';

export type ShapeCategory = 'general' | 'user';

function bakeIconHref(def: ShapeDefinition): string | undefined {
    if (!def.icon) return undefined;
    const entry = getIconById(def.icon);
    if (!entry) return undefined;
    const S = 64;
    const pad = 13;
    const inner = S - 2 * pad;
    const bgColor = def.iconBgColor ?? null;
    const bgShape = def.iconBgShape ?? 'circle';
    const bgRadius = def.iconBgRadius ?? 6;
    const bgChamfer = def.iconBgChamfer ?? 0.18;
    let bgEl = '';
    if (bgColor) {
        if (bgShape === 'circle') bgEl = `<circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}" fill="${bgColor}"/>`;
        else if (bgShape === 'octagon') { const c = Math.round(S * bgChamfer); bgEl = `<polygon points="${c},0 ${S - c},0 ${S},${c} ${S},${S - c} ${S - c},${S} ${c},${S} 0,${S - c} 0,${c}" fill="${bgColor}"/>`; }
        else bgEl = `<rect width="${S}" height="${S}" rx="${bgRadius}" fill="${bgColor}"/>`;
    }
    const iconDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(entry.svg)}`;
    const filter = `<defs><filter id="nr-white" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter></defs>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">${filter}${bgEl}<image href="${iconDataUri}" x="${pad}" y="${pad}" width="${inner}" height="${inner}" filter="url(#nr-white)"/></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export interface StoredShape {
    id: string;
    definition: ShapeDefinition;
}

interface ShapeStore {
    list(category: ShapeCategory): StoredShape[];
    get(category: ShapeCategory, id: string): StoredShape | undefined;
    save(category: ShapeCategory, id: string, definition: ShapeDefinition): void;
    remove(category: ShapeCategory, id: string): void;
}

const STORAGE_KEYS: Record<ShapeCategory, string> = {
    general: 'nextrack-shapes-general-v1',
    user: 'nextrack-shapes-user-v1',
};

function readCollection(category: ShapeCategory): StoredShape[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS[category]);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeCollection(category: ShapeCategory, shapes: StoredShape[]): void {
    try {
        localStorage.setItem(STORAGE_KEYS[category], JSON.stringify(shapes));
    } catch (e) {
        console.error(`[nextrack] Failed to save ${category} shapes:`, e);
    }
}

function list(category: ShapeCategory): StoredShape[] {
    return readCollection(category);
}

function get(category: ShapeCategory, id: string): StoredShape | undefined {
    return readCollection(category).find(s => s.id === id);
}

function save(category: ShapeCategory, id: string, definition: ShapeDefinition): void {
    const shapes = readCollection(category).filter(s => s.id !== id);
    shapes.push({ id, definition: structuredClone(definition) });
    writeCollection(category, shapes);
}

function remove(category: ShapeCategory, id: string): void {
    writeCollection(category, readCollection(category).filter(s => s.id !== id));
}

function ensureDefaults(): void {
    const existing = readCollection('general');
    const ids = new Set(existing.map(s => s.id));
    const defaults: StoredShape[] = [
        {
            id: 'hsm',
            definition: {
                defaultSize: { width: 40, height: 40 },
                defaultIsometricHeight: 20,
                displayName: 'HSM Appliance',
                componentType: 'HSM',
                baseShape: 'cuboid',
                chamferSize: 4,
                chamferStart: 0.6,
                icon: 'security',
                iconSize: 1,
                iconBgColor: '#161616',
                iconBgShape: 'square',
                iconBgRadius: 2,
                collection: 'General',
            },
        },
    ];
    let changed = false;
    for (const d of defaults) {
        if (!d.definition.iconHref) {
            d.definition.iconHref = bakeIconHref(d.definition);
        }
        const idx = existing.findIndex(s => s.id === d.id);
        if (idx < 0) {
            existing.push(d);
            changed = true;
        } else {
            const cur = existing[idx].definition;
            if (!cur.icon || !cur.iconHref || !cur.iconBgColor) {
                existing[idx] = { id: d.id, definition: { ...cur, ...d.definition } };
                changed = true;
            }
        }
    }
    if (changed) writeCollection('general', existing);
}
ensureDefaults();

function syncGeneralToRegistry(): void {
    for (const stored of readCollection('general')) {
        if (!ShapeRegistry[stored.id]) {
            addShape(stored.id, { ...stored.definition });
        } else {
            Object.assign(ShapeRegistry[stored.id], stored.definition);
        }
    }
}
syncGeneralToRegistry();

export const shapeStore: ShapeStore = { list, get, save, remove };
