import { listWorkloads, WorkloadDefinition } from './app-store';

export interface WorkloadInstance {
    id: string;
    workloadId: string;
    workloadName: string;
    instanceIndex: number;
    role: 'active' | 'standby';
    vCpu: number;
    ramGB: number;
    storageGB: number;
}

const STORAGE_KEY = 'nextrack-placement-v1';
const STATUS_KEY = 'nextrack-instance-status-v1';

export type InstanceRole = 'active' | 'standby';

function readStatuses(): Record<string, InstanceRole> {
    try {
        const raw = localStorage.getItem(STATUS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function writeStatuses(map: Record<string, InstanceRole>): void {
    try { localStorage.setItem(STATUS_KEY, JSON.stringify(map)); }
    catch { /* non-critical */ }
}

export function getInstanceStatus(instanceId: string): InstanceRole | null {
    return readStatuses()[instanceId] || null;
}

export function setInstanceStatus(instanceId: string, role: InstanceRole): void {
    const map = readStatuses();
    map[instanceId] = role;
    writeStatuses(map);
}

function readAssignments(): Record<string, string> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function writeAssignments(map: Record<string, string>): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); }
    catch { /* non-critical */ }
}

export function getAssignment(instanceId: string): string | null {
    return readAssignments()[instanceId] || null;
}

export function setAssignment(instanceId: string, clusterId: string | null): void {
    const map = readAssignments();
    if (clusterId) {
        map[instanceId] = clusterId;
    } else {
        delete map[instanceId];
    }
    writeAssignments(map);
}

export function listAllAssignments(): Record<string, string> {
    return readAssignments();
}

export function computeInstances(): WorkloadInstance[] {
    const workloads = listWorkloads();
    const statuses = readStatuses();
    const instances: WorkloadInstance[] = [];
    for (const wl of workloads) {
        const rep = Math.max(1, parseInt(wl.replicationLevel) || 1);
        const vCpu = parseFloat(wl.vCpuCores) || 0;
        const ram = parseFloat(wl.ramGB) || 0;
        const storage = parseFloat(wl.storageCapacityGB) || 0;

        for (let i = 1; i <= rep; i++) {
            const id = `${wl.id}:${i}`;
            const defaultRole: InstanceRole = i === 1 ? 'active' : 'standby';
            instances.push({
                id,
                workloadId: wl.id,
                workloadName: wl.name || wl.id,
                instanceIndex: i,
                role: statuses[id] || defaultRole,
                vCpu,
                ramGB: ram,
                storageGB: storage,
            });
        }
    }
    return instances;
}

export function getInstancesForWorkload(workloadId: string): WorkloadInstance[] {
    return computeInstances().filter(i => i.workloadId === workloadId);
}
