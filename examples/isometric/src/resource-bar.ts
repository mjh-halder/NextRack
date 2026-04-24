import { dia } from '@joint/core';
import { META_KEY } from './inspector';
import { getProduct } from './product-catalog';
import { carbonIconToString, CarbonIcon } from './icons';
import Flash16 from '@carbon/icons/es/flash/16.js';
import Cube16 from '@carbon/icons/es/cube/16.js';
import Chip16 from '@carbon/icons/es/chip/16.js';
import DataBase16 from '@carbon/icons/es/data--base/16.js';
import BlockStorage16 from '@carbon/icons/es/block-storage/16.js';
import ChartVennDiagram16 from '@carbon/icons/es/chart--venn-diagram/16.js';

const ICON_POWER   = carbonIconToString(Flash16 as CarbonIcon);
const ICON_NODES   = carbonIconToString(Cube16 as CarbonIcon);
const ICON_CORES   = carbonIconToString(Chip16 as CarbonIcon);
const ICON_RAM     = carbonIconToString(DataBase16 as CarbonIcon);
const ICON_STORAGE = carbonIconToString(BlockStorage16 as CarbonIcon);
const ICON_CLUSTER = carbonIconToString(ChartVennDiagram16 as CarbonIcon);

export interface ResourceTotals {
    power: number;
    cores: number;
    ram: number;
    storage: number;
    nodeCount: number;
}

let barEl: HTMLDivElement | null = null;
let powerEl: HTMLSpanElement;
let coresEl: HTMLSpanElement;
let ramEl: HTMLSpanElement;
let ramItem: HTMLDivElement;
let storageEl: HTMLSpanElement;
let storageItem: HTMLDivElement;
let nodeCountEl: HTMLSpanElement;
let graph: dia.Graph;

export function initResourceBar(container: HTMLDivElement, g: dia.Graph): void {
    barEl = container;
    graph = g;

    barEl.className = 'nr-hud';

    nodeCountEl  = addItem(barEl, ICON_NODES,   'Nodes').val;
    powerEl      = addItem(barEl, ICON_POWER,   'Power').val;
    coresEl      = addItem(barEl, ICON_CORES,   'Cores').val;
    const ramResult = addItem(barEl, ICON_RAM,  'RAM');
    ramEl = ramResult.val;
    ramItem = ramResult.item;

    const si = document.createElement('div');
    si.className = 'nr-hud__item';
    si.title = 'Storage';
    si.innerHTML = ICON_STORAGE;
    const sv = document.createElement('span');
    sv.className = 'nr-hud__val';
    si.appendChild(sv);
    barEl.appendChild(si);
    storageEl = sv;
    storageItem = si;

    graph.on('add remove change', scheduleUpdate);
    update();
}

function addItem(parent: HTMLElement, iconSvg: string, tooltip: string): { val: HTMLSpanElement; item: HTMLDivElement } {
    const item = document.createElement('div') as HTMLDivElement;
    item.className = 'nr-hud__item';
    item.title = tooltip;
    item.innerHTML = iconSvg;
    const val = document.createElement('span');
    val.className = 'nr-hud__val';
    item.appendChild(val);
    parent.appendChild(item);
    return { val, item };
}

let rafId = 0;
function scheduleUpdate(): void {
    if (rafId) return;
    rafId = requestAnimationFrame(() => { rafId = 0; update(); });
}

function update(): void {
    if (!barEl || !graph) return;
    const t = aggregate();
    nodeCountEl.textContent = String(t.nodeCount);
    powerEl.textContent = t.power > 0 ? `${fmt(t.power)}W` : '0';
    coresEl.textContent = String(t.cores);
    ramEl.textContent = t.ram > 0 ? `${fmt(t.ram)}G` : '0';
    const showStorage = t.storage > 0;
    storageEl.textContent = showStorage ? `${fmt(t.storage)}G` : '0';
    storageItem.style.display = showStorage ? '' : 'none';
    ramItem.classList.toggle('nr-hud__item--last-visible', !showStorage);
}

function aggregate(): ResourceTotals {
    const totals: ResourceTotals = { power: 0, cores: 0, ram: 0, storage: 0, nodeCount: 0 };

    const elements = graph.getElements().filter(
        el => !el.get('isFrame') && el.get('componentRole') !== 'child'
    );

    totals.nodeCount = elements.length;

    for (const el of elements) {
        const meta: Record<string, unknown> = el.get(META_KEY) ?? {};
        const productId = meta.productId as string | undefined;
        const product = productId ? getProduct(productId) : null;
        const productValues = product?.values ?? {};

        // Resolve: manual meta value overrides product value
        totals.power   += num(meta.maxPower,   productValues.maxPower);
        totals.cores   += num(meta.coreCount,  productValues.coreCount);
        totals.ram     += num(meta.ram,         productValues.ram);
        totals.storage += num(meta.storageGB,   productValues.storageGB);
    }

    return totals;
}

function num(...sources: unknown[]): number {
    for (const v of sources) {
        if (v !== undefined && v !== null && v !== '') {
            const n = Number(v);
            if (!isNaN(n) && n > 0) return n;
        }
    }
    return 0;
}

function fmt(n: number): string {
    return n >= 1000 ? n.toLocaleString() : String(n);
}

export function showResourceBar(): void {
    if (barEl) barEl.style.display = '';
}

export function hideResourceBar(): void {
    if (barEl) barEl.style.display = 'none';
}

// ---- Zone HUD ----

let zoneHudEl: HTMLDivElement | null = null;
let zClusterIconEl: HTMLDivElement;
let zNodeCountEl: HTMLSpanElement;
let zPowerEl: HTMLSpanElement;
let zCoresEl: HTMLSpanElement;
let zRamEl: HTMLSpanElement;
let zRamItem: HTMLDivElement;
let zStorageEl: HTMLSpanElement;
let zStorageItem: HTMLDivElement;

function ensureZoneHud(): void {
    if (zoneHudEl) return;
    zoneHudEl = document.createElement('div');
    zoneHudEl.id = 'zone-hud';
    zoneHudEl.className = 'nr-hud nr-hud--zone';
    zoneHudEl.style.display = 'none';

    zClusterIconEl = document.createElement('div');
    zClusterIconEl.className = 'nr-hud__cluster-icon';
    zClusterIconEl.innerHTML = ICON_CLUSTER;
    zClusterIconEl.title = 'Stretch Cluster — combined totals';
    zClusterIconEl.style.display = 'none';
    zoneHudEl.appendChild(zClusterIconEl);

    zNodeCountEl = addItem(zoneHudEl, ICON_NODES, 'Nodes').val;
    zPowerEl     = addItem(zoneHudEl, ICON_POWER, 'Power').val;
    zCoresEl     = addItem(zoneHudEl, ICON_CORES, 'Cores').val;
    const zRamResult = addItem(zoneHudEl, ICON_RAM, 'RAM');
    zRamEl = zRamResult.val;
    zRamItem = zRamResult.item;

    const si = document.createElement('div');
    si.className = 'nr-hud__item';
    si.title = 'Storage';
    si.innerHTML = ICON_STORAGE;
    const sv = document.createElement('span');
    sv.className = 'nr-hud__val';
    si.appendChild(sv);
    zoneHudEl.appendChild(si);
    zStorageEl = sv;
    zStorageItem = si;

    document.body.appendChild(zoneHudEl);
}

export function showZoneHud(zone: dia.Element, clusterTotals?: ResourceTotals): void {
    ensureZoneHud();
    if (!zoneHudEl || !graph) return;

    const color = (zone.get('zoneColor') as string) || '#0072c3';
    zoneHudEl.style.setProperty('--zone-color', color);
    zoneHudEl.style.display = '';

    const isCluster = !!clusterTotals;
    zClusterIconEl.style.display = isCluster ? '' : 'none';

    let t: ResourceTotals;
    if (clusterTotals) {
        t = clusterTotals;
    } else {
        const embedded = zone.getEmbeddedCells()
            .filter(c => !c.get('isFrame') && c.get('componentRole') !== 'child') as dia.Element[];
        t = { power: 0, cores: 0, ram: 0, storage: 0, nodeCount: embedded.length };
        for (const el of embedded) {
            const meta: Record<string, unknown> = el.get(META_KEY) ?? {};
            const productId = meta.productId as string | undefined;
            const product = productId ? getProduct(productId) : null;
            const pv = product?.values ?? {};
            t.power   += num(meta.maxPower,  pv.maxPower);
            t.cores   += num(meta.coreCount, pv.coreCount);
            t.ram     += num(meta.ram,        pv.ram);
            t.storage += num(meta.storageGB,  pv.storageGB);
        }
    }

    zNodeCountEl.textContent = String(t.nodeCount);
    zPowerEl.textContent = t.power > 0 ? `${fmt(t.power)}W` : '0';
    zCoresEl.textContent = String(t.cores);
    zRamEl.textContent = t.ram > 0 ? `${fmt(t.ram)}G` : '0';
    const zShowStorage = t.storage > 0;
    zStorageEl.textContent = zShowStorage ? `${fmt(t.storage)}G` : '0';
    zStorageItem.style.display = zShowStorage ? '' : 'none';
    zRamItem.classList.toggle('nr-hud__item--last-visible', !zShowStorage);
}

export function hideZoneHud(): void {
    if (zoneHudEl) zoneHudEl.style.display = 'none';
}

// ---- Stretch Cluster Detection ----

export interface StretchCluster {
    id: string;
    zoneIds: string[];
    totals: ResourceTotals;
}

export function detectStretchClusters(g: dia.Graph): StretchCluster[] {
    const frames = g.getElements().filter(el => el.get('isFrame'));
    if (frames.length === 0) return [];

    const frameIdList = frames.map(f => f.id as string);
    const frameIdSet: Record<string, boolean> = {};
    const adj: Record<string, Record<string, boolean>> = {};
    for (const id of frameIdList) { frameIdSet[id] = true; adj[id] = {}; }

    for (const link of g.getLinks()) {
        const srcId = (link.source() as { id?: string }).id;
        const tgtId = (link.target() as { id?: string }).id;
        if (!srcId || !tgtId) continue;
        if (frameIdSet[srcId] && frameIdSet[tgtId] && srcId !== tgtId) {
            adj[srcId][tgtId] = true;
            adj[tgtId][srcId] = true;
        }
    }

    const visited: Record<string, boolean> = {};
    const clusters: StretchCluster[] = [];

    for (const startId of frameIdList) {
        if (visited[startId]) continue;
        const neighbors = Object.keys(adj[startId]);
        if (neighbors.length === 0) { visited[startId] = true; continue; }

        const group: string[] = [];
        const queue = [startId];
        while (queue.length > 0) {
            const id = queue.shift()!;
            if (visited[id]) continue;
            visited[id] = true;
            group.push(id);
            for (const n of Object.keys(adj[id] || {})) {
                if (!visited[n]) queue.push(n);
            }
        }

        if (group.length < 2) continue;

        const t: ResourceTotals = { power: 0, cores: 0, ram: 0, storage: 0, nodeCount: 0 };
        for (const zoneId of group) {
            const zone = g.getCell(zoneId) as dia.Element;
            const embedded = zone.getEmbeddedCells()
                .filter(c => !c.get('isFrame') && c.get('componentRole') !== 'child') as dia.Element[];
            t.nodeCount += embedded.length;
            for (const el of embedded) {
                const meta: Record<string, unknown> = el.get(META_KEY) ?? {};
                const productId = meta.productId as string | undefined;
                const product = productId ? getProduct(productId) : null;
                const pv = product?.values ?? {};
                t.power   += num(meta.maxPower,  pv.maxPower);
                t.cores   += num(meta.coreCount, pv.coreCount);
                t.ram     += num(meta.ram,        pv.ram);
                t.storage += num(meta.storageGB,  pv.storageGB);
            }
        }

        clusters.push({ id: group.sort().join(':'), zoneIds: group, totals: t });
    }

    return clusters;
}
