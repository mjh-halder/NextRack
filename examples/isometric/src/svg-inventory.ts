const STORAGE_KEY = 'nextrack-svg-inventory-v1';

export interface SvgInventoryEntry {
    componentId: string;
    displayName: string;
    collection: string;
    svgLight: string;
    svgDark: string;
    updatedAt: string;
}

function readAll(): SvgInventoryEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function writeAll(entries: SvgInventoryEntry[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function saveToInventory(componentId: string, displayName: string, collection: string, svgLight: string, svgDark: string): void {
    const entries = readAll();
    const idx = entries.findIndex(e => e.componentId === componentId);
    const entry: SvgInventoryEntry = {
        componentId,
        displayName,
        collection,
        svgLight,
        svgDark,
        updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) entries[idx] = entry;
    else entries.push(entry);
    writeAll(entries);
}

export function removeFromInventory(componentId: string): void {
    writeAll(readAll().filter(e => e.componentId !== componentId));
}

export function listInventory(): SvgInventoryEntry[] {
    return readAll();
}

export function isDarkMode(): boolean {
    return document.documentElement.classList.contains('cds--g100');
}
