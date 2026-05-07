export interface ClusterAssignment {
    workloadId: string;
    clusterId: string;
}

const STORAGE_KEY = 'nextrack-cluster-assignments-v1';

function readAll(): ClusterAssignment[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as ClusterAssignment[];
    } catch { return []; }
}

function writeAll(items: ClusterAssignment[]): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
    catch { /* non-critical */ }
}

export function listAssignments(): ClusterAssignment[] {
    return readAll();
}

export function assignWorkload(workloadId: string, clusterId: string): void {
    const items = readAll().filter(a => a.workloadId !== workloadId);
    items.push({ workloadId, clusterId });
    writeAll(items);
}

export function unassignWorkload(workloadId: string): void {
    writeAll(readAll().filter(a => a.workloadId !== workloadId));
}

export function getClusterForWorkload(workloadId: string): string | undefined {
    return readAll().find(a => a.workloadId === workloadId)?.clusterId;
}
