export interface StorageEntry {
    type: string;
    amount: string;
}

export interface AppDefinition {
    id: string;
    name: string;
    deploymentModel: string;
    operatingSystem: string;
    applicationServer: string;
    database: string;
    storageEntries: StorageEntry[];
    replicationLevel: string;
}

const STORAGE_KEY = 'nextrack-app-definitions-v1';

function readAll(): AppDefinition[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as AppDefinition[];
    } catch { return []; }
}

function writeAll(apps: AppDefinition[]): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(apps)); }
    catch { /* non-critical */ }
}

export function listApps(): AppDefinition[] {
    return readAll();
}

export function getApp(id: string): AppDefinition | undefined {
    return readAll().find(a => a.id === id);
}

export function saveApp(app: AppDefinition): void {
    const apps = readAll().filter(a => a.id !== app.id);
    apps.push(app);
    writeAll(apps);
}

export function deleteApp(id: string): void {
    writeAll(readAll().filter(a => a.id !== id));
}

export function createApp(name: string): AppDefinition {
    const id = 'app-' + Date.now().toString(36);
    const app: AppDefinition = {
        id,
        name,
        deploymentModel: '',
        operatingSystem: '',
        applicationServer: '',
        database: '',
        storageEntries: [],
        replicationLevel: '1x',
    };
    saveApp(app);
    return app;
}
