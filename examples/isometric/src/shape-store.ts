import { ShapeDefinition, IconEntry, addShape, ShapeRegistry, defaultShapeLayer, defaultIconEntry } from './shapes/shape-registry';
import { getIconById } from './icon-catalog';
import { getPaletteIcon } from './shape-query';

export type ShapeCategory = 'general' | 'user';

/**
 * Bake a 64x64 composite preview href from an IconEntry.
 * Used for palette tiles and admin previews — a cheap "snapshot" of how the
 * icon looks with its background applied. The editor uses its own composite
 * builder (`buildCompositeIconSvg`) for live rendering.
 */
export function bakeIconHref(entry: IconEntry | undefined): string | undefined {
    if (!entry || !entry.iconId) return undefined;
    const cat = getIconById(entry.iconId);
    if (!cat) return undefined;
    const S = 64;
    const isVendor = cat.source === 'aws' || cat.source === 'gcp' || cat.source === 'azure';
    const pad = isVendor ? 3 : 13;
    const inner = S - 2 * pad;
    const bgColor = entry.bgEnabled ? entry.bgColor : null;
    const bgShape = entry.bgShape;
    const bgRadius = entry.bgRadius;
    const bgChamfer = entry.bgChamfer;
    let bgEl = '';
    if (bgColor) {
        if (bgShape === 'circle') bgEl = `<circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}" fill="${bgColor}"/>`;
        else if (bgShape === 'octagon') { const c = Math.round(S * bgChamfer); bgEl = `<polygon points="${c},0 ${S - c},0 ${S},${c} ${S},${S - c} ${S - c},${S} ${c},${S} 0,${S - c} 0,${c}" fill="${bgColor}"/>`; }
        else bgEl = `<rect width="${S}" height="${S}" rx="${bgRadius}" fill="${bgColor}"/>`;
    }
    const iconDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cat.svg)}`;
    const applyWhite = !isVendor;
    const filter = applyWhite ? `<defs><filter id="nr-white" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter></defs>` : '';
    const filterAttr = applyWhite ? ' filter="url(#nr-white)"' : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">${filter}${bgEl}<image href="${iconDataUri}" x="${pad}" y="${pad}" width="${inner}" height="${inner}"${filterAttr}/></svg>`;
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
    general: 'nextrack-shapes-general-v2',
    user: 'nextrack-shapes-user-v2',
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
    const defaults: StoredShape[] = [
        {
            id: 'hsm',
            definition: {
                displayName: 'HSM Appliance',
                componentType: 'HSM',
                collection: 'General',
                layers: [defaultShapeLayer({
                    id: 'layer-hsm-main',
                    width: 40,
                    height: 40,
                    depth: 20,
                    chamferSize: 4,
                    chamferStart: 0.6,
                    icons: [defaultIconEntry({
                        id: 'icon-hsm-main',
                        iconId: 'security',
                        size: 1,
                        bgEnabled: true,
                        bgColor: '#161616',
                        bgShape: 'square',
                        bgRadius: 2,
                        isMain: true,
                    })],
                })],
            },
        },
    ];
    let changed = false;
    for (const d of defaults) {
        const entry = getPaletteIcon(d.definition);
        if (entry && !entry.href) {
            entry.href = bakeIconHref(entry);
        }
        const idx = existing.findIndex(s => s.id === d.id);
        if (idx < 0) {
            existing.push(d);
            changed = true;
        }
    }
    if (changed) writeCollection('general', existing);
}
ensureDefaults();

function syncGeneralToRegistry(): void {
    for (const stored of readCollection('general')) {
        if (!ShapeRegistry[stored.id]) {
            addShape(stored.id, { ...stored.definition });
        }
    }
}
syncGeneralToRegistry();

export const shapeStore: ShapeStore = { list, get, save, remove };

// ── User Folders ──────────────────────────────────────────────────────────────
//
// User-created sub-folders that group user-generated Shapes inside the
// "User Created" section of the Component Designer palette. System
// collections (General, Oracle, ...) are unaffected — those come from the
// `component-collection` schema datatype.

export interface UserFolder {
    id: string;
    name: string;
    createdAt: number;
}

const USER_FOLDERS_KEY = 'nextrack-user-folders-v1';
export const USER_FOLDERS_CHANGED_EVENT = 'nextrack:user-folders-changed';

function readUserFolders(): UserFolder[] {
    try {
        const raw = localStorage.getItem(USER_FOLDERS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeUserFolders(folders: UserFolder[]): void {
    try {
        localStorage.setItem(USER_FOLDERS_KEY, JSON.stringify(folders));
        document.dispatchEvent(new CustomEvent(USER_FOLDERS_CHANGED_EVENT));
    } catch (e) {
        console.error('[nextrack] Failed to save user folders:', e);
    }
}

function folderIdFromName(name: string): string {
    const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `uf-${base || 'folder'}-${Date.now().toString(36)}`;
}

export function listUserFolders(): UserFolder[] {
    return readUserFolders();
}

export function createUserFolder(name: string): UserFolder {
    const folder: UserFolder = { id: folderIdFromName(name), name: name.trim(), createdAt: Date.now() };
    const all = readUserFolders();
    all.push(folder);
    writeUserFolders(all);
    return folder;
}

export function renameUserFolder(id: string, newName: string): void {
    const all = readUserFolders();
    const idx = all.findIndex(f => f.id === id);
    if (idx < 0) return;
    all[idx] = { ...all[idx], name: newName.trim() };
    writeUserFolders(all);
}

export function deleteUserFolder(id: string): void {
    writeUserFolders(readUserFolders().filter(f => f.id !== id));
}

export function userFolderNameExists(name: string, ignoreId?: string): boolean {
    const norm = name.trim().toLowerCase();
    return readUserFolders().some(f => f.name.toLowerCase() === norm && f.id !== ignoreId);
}
