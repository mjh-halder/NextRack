import { dia } from '@joint/core';
import { META_KEY } from './inspector';
import { getProduct } from './product-catalog';
import { carbonIconToString, CarbonIcon } from './icons';
import Flash16 from '@carbon/icons/es/flash/16.js';
import Cube16 from '@carbon/icons/es/cube/16.js';
import Chip16 from '@carbon/icons/es/chip/16.js';
import DataBase16 from '@carbon/icons/es/data--base/16.js';
import BlockStorage16 from '@carbon/icons/es/block-storage/16.js';

const ICON_POWER   = carbonIconToString(Flash16 as CarbonIcon);
const ICON_NODES   = carbonIconToString(Cube16 as CarbonIcon);
const ICON_CORES   = carbonIconToString(Chip16 as CarbonIcon);
const ICON_RAM     = carbonIconToString(DataBase16 as CarbonIcon);
const ICON_STORAGE = carbonIconToString(BlockStorage16 as CarbonIcon);

interface ResourceTotals {
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
let storageEl: HTMLSpanElement;
let storageItem: HTMLDivElement;
let nodeCountEl: HTMLSpanElement;
let graph: dia.Graph;

export function initResourceBar(container: HTMLDivElement, g: dia.Graph): void {
    barEl = container;
    graph = g;

    barEl.className = 'nr-hud';

    nodeCountEl  = addItem(barEl, ICON_NODES,   'Nodes');
    powerEl      = addItem(barEl, ICON_POWER,   'Power');
    coresEl      = addItem(barEl, ICON_CORES,   'Cores');
    ramEl        = addItem(barEl, ICON_RAM,     'RAM');

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

function addItem(parent: HTMLElement, iconSvg: string, tooltip: string): HTMLSpanElement {
    const item = document.createElement('div');
    item.className = 'nr-hud__item';
    item.title = tooltip;
    item.innerHTML = iconSvg;
    const val = document.createElement('span');
    val.className = 'nr-hud__val';
    item.appendChild(val);
    parent.appendChild(item);
    return val;
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
    storageEl.textContent = t.storage > 0 ? `${fmt(t.storage)}G` : '0';
    storageItem.style.display = t.storage > 0 ? '' : 'none';
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
let zNodeCountEl: HTMLSpanElement;
let zPowerEl: HTMLSpanElement;
let zCoresEl: HTMLSpanElement;
let zRamEl: HTMLSpanElement;
let zStorageEl: HTMLSpanElement;
let zStorageItem: HTMLDivElement;

function ensureZoneHud(): void {
    if (zoneHudEl) return;
    zoneHudEl = document.createElement('div');
    zoneHudEl.id = 'zone-hud';
    zoneHudEl.className = 'nr-hud nr-hud--zone';
    zoneHudEl.style.display = 'none';

    zNodeCountEl = addItem(zoneHudEl, ICON_NODES, 'Nodes');
    zPowerEl     = addItem(zoneHudEl, ICON_POWER, 'Power');
    zCoresEl     = addItem(zoneHudEl, ICON_CORES, 'Cores');
    zRamEl       = addItem(zoneHudEl, ICON_RAM,   'RAM');

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

export function showZoneHud(zone: dia.Element): void {
    ensureZoneHud();
    if (!zoneHudEl || !graph) return;

    const color = (zone.get('zoneColor') as string) || '#0072c3';
    zoneHudEl.style.setProperty('--zone-color', color);
    zoneHudEl.style.display = '';

    const embedded = zone.getEmbeddedCells()
        .filter(c => !c.get('isFrame') && c.get('componentRole') !== 'child') as dia.Element[];

    const t: ResourceTotals = { power: 0, cores: 0, ram: 0, storage: 0, nodeCount: embedded.length };

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

    zNodeCountEl.textContent = String(t.nodeCount);
    zPowerEl.textContent = t.power > 0 ? `${fmt(t.power)}W` : '0';
    zCoresEl.textContent = String(t.cores);
    zRamEl.textContent = t.ram > 0 ? `${fmt(t.ram)}G` : '0';
    zStorageEl.textContent = t.storage > 0 ? `${fmt(t.storage)}G` : '0';
    zStorageItem.style.display = t.storage > 0 ? '' : 'none';
}

export function hideZoneHud(): void {
    if (zoneHudEl) zoneHudEl.style.display = 'none';
}
