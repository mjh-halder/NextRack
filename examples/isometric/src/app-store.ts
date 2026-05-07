export interface StorageEntry {
    type: string;
    amount: string;
}

export interface WorkloadDefinition {
    id: string;
    name: string;
    // General
    deploymentModel: string;
    description: string;
    environment: string;
    operatingSystem: string;
    applicationServer: string;
    database: string;
    replicationLevel: string;
    // Compute
    vCpuCores: string;
    cpuPeakFactor: string;
    // Memory
    ramGB: string;
    // Storage
    storageCapacityGB: string;
    storageType: string;
    iopsRequired: string;
    throughputMBs: string;
    storageEntries: StorageEntry[];
    // Network
    bandwidthMbps: string;
    // Availability
    slaClass: string;
    // Backup & Recovery
    backupRequired: string;
    rpo: string;
    rto: string;
    // Growth
    growthPercentYear: string;
    // Criticality
    criticality: string;
    // Organizational
    location: string;
    owner: string;
    comments: string;
}

/** @deprecated Use WorkloadDefinition instead */
export type AppDefinition = WorkloadDefinition;

const STORAGE_KEY = 'nextrack-workload-definitions-v2';
const LEGACY_KEY = 'nextrack-app-definitions-v1';

function migrate(): void {
    if (localStorage.getItem(STORAGE_KEY)) return;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    try {
        const old = JSON.parse(legacy) as Record<string, unknown>[];
        const migrated = old.map(o => ({
            ...o,
            vCpuCores: '',
            cpuPeakFactor: '',
            ramGB: '',
            storageCapacityGB: '',
            iopsRequired: '',
            throughputMBs: '',
            bandwidthMbps: '',
            slaClass: '',
            growthPercentYear: '',
            criticality: '',
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    } catch { /* ignore corrupt data */ }
}

migrate();

function readAll(): WorkloadDefinition[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as WorkloadDefinition[];
    } catch { return []; }
}

function writeAll(items: WorkloadDefinition[]): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
    catch { /* non-critical */ }
}

export function listWorkloads(): WorkloadDefinition[] {
    return readAll();
}

export function getWorkload(id: string): WorkloadDefinition | undefined {
    return readAll().find(a => a.id === id);
}

export function saveWorkload(wl: WorkloadDefinition): void {
    const items = readAll().filter(a => a.id !== wl.id);
    items.push(wl);
    writeAll(items);
}

export function deleteWorkload(id: string): void {
    writeAll(readAll().filter(a => a.id !== id));
}

export function createWorkload(name: string): WorkloadDefinition {
    const id = 'wl-' + Date.now().toString(36);
    const wl: WorkloadDefinition = {
        id,
        name,
        deploymentModel: '',
        description: '',
        environment: '',
        operatingSystem: '',
        applicationServer: '',
        database: '',
        replicationLevel: '1',
        vCpuCores: '',
        cpuPeakFactor: '',
        ramGB: '',
        storageCapacityGB: '',
        storageType: '',
        iopsRequired: '',
        throughputMBs: '',
        storageEntries: [],
        bandwidthMbps: '',
        slaClass: '',
        backupRequired: '',
        rpo: '',
        rto: '',
        growthPercentYear: '',
        criticality: '',
        location: '',
        owner: '',
        comments: '',
    };
    saveWorkload(wl);
    return wl;
}

// Legacy aliases
export const listApps = listWorkloads;
export const getApp = getWorkload;
export const saveApp = saveWorkload;
export const deleteApp = deleteWorkload;
export const createApp = createWorkload;
