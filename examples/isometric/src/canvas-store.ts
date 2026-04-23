import { dia } from '@joint/core';

export interface CanvasRecord {
    id: string;
    name: string;
    canvasType: 'Infra_Logical' | 'Infra_Physical' | 'App_Workload';
    layerType: string;
    projectId: string;
    author: string;
    createdAt: string;
    updatedAt: string;
}

interface CanvasData {
    meta: CanvasRecord;
    cells: Record<string, unknown>[];
}

const INDEX_KEY = 'nextrack-canvas-index-v1';
const DATA_PREFIX = 'nextrack-canvas-data-';
const ACTIVE_KEY = 'nextrack-canvas-active-v1';
const LEGACY_KEY = 'nextrack-default-design-v1';

export const EXAMPLE_CANVAS_ID = 'example';

function readIndex(): CanvasRecord[] {
    try {
        const raw = localStorage.getItem(INDEX_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as CanvasRecord[];
    } catch { return []; }
}

function writeIndex(records: CanvasRecord[]): void {
    try { localStorage.setItem(INDEX_KEY, JSON.stringify(records)); }
    catch { /* non-critical */ }
}

function dataKey(id: string): string {
    return DATA_PREFIX + id;
}

export function listCanvases(): CanvasRecord[] {
    return readIndex();
}

export function getCanvas(id: string): CanvasRecord | undefined {
    return readIndex().find(c => c.id === id);
}

export function createCanvas(name: string, canvasType: CanvasRecord['canvasType']): CanvasRecord {
    const now = new Date().toISOString();
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        + '-' + Date.now().toString(36);
    const meta: CanvasRecord = {
        id, name, canvasType,
        layerType: '',
        projectId: '',
        author: '',
        createdAt: now,
        updatedAt: now,
    };
    const index = readIndex();
    index.push(meta);
    writeIndex(index);
    try { localStorage.setItem(dataKey(id), JSON.stringify({ cells: [] })); }
    catch { /* non-critical */ }
    return meta;
}

export function saveCanvasGraph(id: string, graph: dia.Graph): void {
    const data = { cells: graph.getCells().map(c => c.toJSON()) };
    try {
        localStorage.setItem(dataKey(id), JSON.stringify(data));
        const index = readIndex();
        const rec = index.find(c => c.id === id);
        if (rec) {
            rec.updatedAt = new Date().toISOString();
            writeIndex(index);
        }
    } catch { /* non-critical */ }
}

export function loadCanvasGraph(id: string, graph: dia.Graph): boolean {
    try {
        const raw = localStorage.getItem(dataKey(id));
        if (!raw) return false;
        const json = JSON.parse(raw);
        graph.fromJSON(json);
        return true;
    } catch { return false; }
}

export function getActiveCanvasId(): string {
    return localStorage.getItem(ACTIVE_KEY) ?? EXAMPLE_CANVAS_ID;
}

export function setActiveCanvasId(id: string): void {
    try { localStorage.setItem(ACTIVE_KEY, id); }
    catch { /* non-critical */ }
}

export function updateCanvas(id: string, patch: Partial<Pick<CanvasRecord, 'name' | 'layerType'>>): void {
    const index = readIndex();
    const rec = index.find(c => c.id === id);
    if (!rec) return;
    if (patch.name !== undefined) rec.name = patch.name;
    if (patch.layerType !== undefined) rec.layerType = patch.layerType;
    rec.updatedAt = new Date().toISOString();
    writeIndex(index);
}

export function deleteCanvas(id: string): boolean {
    const index = readIndex();
    if (index.length <= 1) return false;
    const filtered = index.filter(c => c.id !== id);
    if (filtered.length === index.length) return false;
    writeIndex(filtered);
    try { localStorage.removeItem(dataKey(id)); } catch { /* non-critical */ }
    return true;
}

export function ensureExampleCanvas(): void {
    const index = readIndex();
    if (index.some(c => c.id === EXAMPLE_CANVAS_ID)) return;

    const now = new Date().toISOString();
    const meta: CanvasRecord = {
        id: EXAMPLE_CANVAS_ID,
        name: 'Example',
        canvasType: 'Infra_Logical',
        layerType: 'Infrastructure',
        projectId: '',
        author: '',
        createdAt: now,
        updatedAt: now,
    };
    index.unshift(meta);
    writeIndex(index);

    // Migrate legacy default design into the example canvas
    try {
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy) {
            localStorage.setItem(dataKey(EXAMPLE_CANVAS_ID), legacy);
        }
    } catch { /* non-critical */ }
}
