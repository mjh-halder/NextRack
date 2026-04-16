import { ShapeDefinition } from './shapes/shape-registry';

export type ShapeCategory = 'general' | 'user';

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

export const shapeStore: ShapeStore = { list, get, save, remove };
