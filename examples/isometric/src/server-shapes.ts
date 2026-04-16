import { ShapeDefaults } from './shapes/shape-registry';

const STORAGE_KEY = 'nextrack-server-shapes-v1';

export interface ServerShapeEntry {
    id: string;
    defaults: ShapeDefaults;
    publishedAt: string;
}

function readStore(): ServerShapeEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeStore(entries: ServerShapeEntry[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
        console.error('[nextrack] Failed to save server shapes:', e);
    }
}

export function getServerShapes(): ServerShapeEntry[] {
    return readStore();
}

export function publishShape(id: string, defaults: ShapeDefaults): void {
    const entries = readStore().filter(e => e.id !== id);
    entries.push({ id, defaults: structuredClone(defaults), publishedAt: new Date().toISOString() });
    writeStore(entries);
}

export function unpublishShape(id: string): void {
    writeStore(readStore().filter(e => e.id !== id));
}
