import { dia } from '@joint/core';
import {
    computeInstances, listAllAssignments, setAssignment,
    WorkloadInstance,
} from './placement-store';
import { listWorkloads } from './app-store';
import { listCanvases, getActiveCanvasId, CanvasRecord } from './canvas-store';
import { META_KEY } from './inspector';
import { getProduct } from './product-catalog';
import { carbonIconToString, CarbonIcon } from './icons';
import Search16 from '@carbon/icons/es/search/16.js';
import SortAscending16 from '@carbon/icons/es/sort--ascending/16.js';

const ICON_SEARCH = carbonIconToString(Search16 as CarbonIcon);
const ICON_SORT = carbonIconToString(SortAscending16 as CarbonIcon);

// ── Types ──

interface ClusterInfo {
    id: string;
    name: string;
    canvasId: string;
    totalCpu: number;
    totalRam: number;
    totalStorage: number;
    totalBandwidth: number;
}

// Resource colors (IBM Design Language) — matching treemap
const COLOR_CPU       = '#0f62fe';
const COLOR_RAM       = '#8a3ffc';
const COLOR_STORAGE   = '#007d79';
const COLOR_BANDWIDTH = '#0072c3';

// ── Module state ──

let containerEl: HTMLDivElement | null = null;
let graphRef: dia.Graph | null = null;
let visibleClusterIds: Set<string> | null = null;
let filterPopupOpen = false;
let layoutEl: HTMLDivElement | null = null;
let pvSearchOpen = false;
let pvSearchTerm = '';
let clusterSortKey: Record<string, string> = {};
let clusterSortAsc: Record<string, boolean> = {};

// ── Public API ──

export function initPlacementView(el: HTMLDivElement, graph: dia.Graph): void {
    containerEl = el;
    graphRef = graph;
}

export function refreshPlacementView(): void {
    if (!containerEl || !graphRef) return;
    render();
}

// ── Cluster data ──

function getClusters(): ClusterInfo[] {
    if (!graphRef) return [];
    const activeCanvasId = getActiveCanvasId();
    const frames = graphRef.getElements().filter(el => el.get('isFrame'));
    return frames.map(frame => {
        const embedded = frame.getEmbeddedCells()
            .filter((c: any) => !c.get('isFrame') && c.get('componentRole') !== 'child') as dia.Element[];

        let cpu = 0, ram = 0, storage = 0, bandwidth = 0;
        for (const el of embedded) {
            const meta: Record<string, unknown> = el.get(META_KEY) ?? {};
            const productId = meta.productId as string | undefined;
            const product = productId ? getProduct(productId) : null;
            const pv = product?.values ?? {};
            cpu += num(meta.coreCount, pv.coreCount);
            ram += num(meta.ram, pv.ram);
            storage += num(meta.storageGB, pv.storageGB);
            bandwidth += num(meta.bandwidthMbps, pv.bandwidthMbps);
        }

        return {
            id: String(frame.id),
            name: (frame.attr('label/text') as string) || (frame.attr('headerLabel/text') as string) || `Zone ${String(frame.id).slice(0, 6)}`,
            canvasId: activeCanvasId,
            totalCpu: cpu,
            totalRam: ram,
            totalStorage: storage,
            totalBandwidth: bandwidth,
        };
    });
}

function getStoredClustersForCanvas(canvasId: string): { id: string; name: string }[] {
    try {
        const raw = localStorage.getItem('nextrack-canvas-data-' + canvasId);
        if (!raw) return [];
        const data = JSON.parse(raw);
        const cells = data.cells || [];
        return cells
            .filter((c: any) => c.isFrame)
            .map((c: any) => ({
                id: String(c.id),
                name: c.attrs?.label?.text || c.attrs?.headerLabel?.text || `Zone ${String(c.id).slice(0, 6)}`,
            }));
    } catch { return []; }
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

function getInstanceBandwidth(inst: WorkloadInstance): number {
    const wl = listWorkloads().find(w => w.id === inst.workloadId);
    return wl ? (parseFloat(wl.bandwidthMbps) || 0) : 0;
}

// ── Render ──

function render(): void {
    if (!containerEl) return;
    containerEl.innerHTML = '';
    filterPopupOpen = false;

    const clusters = getClusters();
    if (visibleClusterIds === null) {
        visibleClusterIds = new Set(clusters.map(c => c.id));
    }

    // Top bar
    const topBar = document.createElement('div');
    topBar.className = 'nr-pv__top-bar';

    const titleEl = document.createElement('h3');
    titleEl.className = 'nr-pv__panel-title';
    titleEl.style.margin = '0';
    titleEl.textContent = 'Placement';
    topBar.appendChild(titleEl);

    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'nr-pv__top-actions';

    // Search
    const searchWrap = document.createElement('div');
    searchWrap.className = 'nr-dt__search-wrap' + (pvSearchOpen ? ' nr-dt__search-wrap--open' : '');

    const searchBtn = document.createElement('button');
    searchBtn.type = 'button';
    searchBtn.className = 'nr-pv__filter-btn';
    searchBtn.title = 'Search';
    searchBtn.innerHTML = ICON_SEARCH;
    searchBtn.addEventListener('click', () => {
        pvSearchOpen = !pvSearchOpen;
        searchWrap.classList.toggle('nr-dt__search-wrap--open', pvSearchOpen);
        if (pvSearchOpen) {
            searchInput.focus();
        } else {
            pvSearchTerm = '';
            searchInput.value = '';
            renderLayout();
        }
    });
    searchWrap.appendChild(searchBtn);

    const searchInput = document.createElement('input');
    searchInput.autocomplete = 'off';
    searchInput.className = 'nr-dt__search-input';
    searchInput.placeholder = 'Search instances';
    searchInput.type = 'search';
    searchInput.value = pvSearchTerm;
    searchInput.addEventListener('input', () => {
        pvSearchTerm = searchInput.value;
        renderLayout();
    });
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            pvSearchOpen = false;
            pvSearchTerm = '';
            searchInput.value = '';
            searchWrap.classList.remove('nr-dt__search-wrap--open');
            renderLayout();
        }
    });
    searchInput.addEventListener('blur', () => {
        if (pvSearchOpen && !pvSearchTerm) {
            pvSearchOpen = false;
            searchWrap.classList.remove('nr-dt__search-wrap--open');
        }
    });
    searchWrap.appendChild(searchInput);
    actionsWrap.appendChild(searchWrap);

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'nr-pv__filter-btn';
    resetBtn.title = 'Reset all placements';
    resetBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" width="16" height="16"><path d="M18,28A12,12,0,1,0,6,16v6.2L2.4,18.6,1,20l6,6,6-6-1.4-1.4L8,22.2V16H8A10,10,0,1,1,18,26Z"/></svg>`;
    resetBtn.addEventListener('click', () => showResetModal());
    actionsWrap.appendChild(resetBtn);

    // Filter button
    const filterWrap = document.createElement('div');
    filterWrap.className = 'nr-pv__filter-wrap';

    const filterBtn = document.createElement('button');
    filterBtn.type = 'button';
    filterBtn.className = 'nr-pv__filter-btn';
    filterBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" width="16" height="16"><path d="M18 28h-4a2 2 0 01-2-2v-7.59L4.59 11A2 2 0 014 9.59V6a2 2 0 012-2h20a2 2 0 012 2v3.59A2 2 0 0127.41 11L20 18.41V26a2 2 0 01-2 2zM6 6v3.59l8 8V26h4v-8.41l8-8V6z"/></svg>`;
    filterBtn.title = 'Filter clusters';

    const hiddenCount = clusters.length - visibleClusterIds!.size;
    if (hiddenCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'nr-pv__filter-badge';
        badge.textContent = String(hiddenCount);
        filterBtn.appendChild(badge);
    }

    filterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        filterPopupOpen = !filterPopupOpen;
        renderFilterPopup(filterWrap, clusters);
    });
    filterWrap.appendChild(filterBtn);
    actionsWrap.appendChild(filterWrap);
    topBar.appendChild(actionsWrap);
    containerEl.appendChild(topBar);

    // Layout
    layoutEl = document.createElement('div');
    layoutEl.className = 'nr-pv__layout';
    containerEl.appendChild(layoutEl);

    renderLayout();
}

function renderLayout(): void {
    if (!layoutEl) return;
    layoutEl.innerHTML = '';

    const allInstances = computeInstances();
    const q = pvSearchTerm.toLowerCase();
    const instances = q
        ? allInstances.filter(i => i.workloadName.toLowerCase().includes(q))
        : allInstances;
    const assignments = listAllAssignments();
    const clusters = getClusters();

    const validClusterIds = new Set(clusters.map(c => c.id));
    for (const [iid, cid] of Object.entries(assignments)) {
        if (!validClusterIds.has(cid)) {
            setAssignment(iid, null);
            delete assignments[iid];
        }
    }

    const unassigned = instances.filter(i => !assignments[i.id]);
    const assignedByCluster: Record<string, WorkloadInstance[]> = {};
    for (const c of clusters) assignedByCluster[c.id] = [];
    for (const inst of instances) {
        const cid = assignments[inst.id];
        if (cid && assignedByCluster[cid]) assignedByCluster[cid].push(inst);
    }

    // Left: unassigned
    const leftPanel = document.createElement('div');
    leftPanel.className = 'nr-pv__left';

    const leftHeader = document.createElement('h3');
    leftHeader.className = 'nr-pv__panel-title';
    leftHeader.textContent = `Unassigned (${unassigned.length})`;
    leftPanel.appendChild(leftHeader);

    const unassignedList = document.createElement('div');
    unassignedList.className = 'nr-pv__instance-list';

    unassignedList.addEventListener('dragover', (e) => {
        e.preventDefault();
        unassignedList.classList.add('nr-pv__drop--active');
    });
    unassignedList.addEventListener('dragleave', () => {
        unassignedList.classList.remove('nr-pv__drop--active');
    });
    unassignedList.addEventListener('drop', (e) => {
        e.preventDefault();
        unassignedList.classList.remove('nr-pv__drop--active');
        const instanceId = e.dataTransfer?.getData('text/plain');
        if (instanceId) {
            setAssignment(instanceId, null);
            renderLayout();
        }
    });

    if (unassigned.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'nr-pv__empty';
        empty.textContent = 'All instances assigned.';
        unassignedList.appendChild(empty);
    } else {
        for (const inst of unassigned) {
            unassignedList.appendChild(buildInstanceChip(inst));
        }
    }
    leftPanel.appendChild(unassignedList);
    layoutEl.appendChild(leftPanel);

    // Right: cluster cards
    const rightPanel = document.createElement('div');
    rightPanel.className = 'nr-pv__right';

    const visibleClusters = clusters.filter(c => visibleClusterIds!.has(c.id));
    if (visibleClusters.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'nr-pv__empty';
        empty.textContent = clusters.length === 0
            ? 'No clusters defined in the System Designer.'
            : 'No clusters selected. Use the filter above.';
        rightPanel.appendChild(empty);
    } else {
        for (const cluster of visibleClusters) {
            rightPanel.appendChild(buildClusterCard(cluster, assignedByCluster[cluster.id] || []));
        }
    }
    layoutEl.appendChild(rightPanel);
}

// ── Filter popup ──

function renderFilterPopup(parent: HTMLElement, clusters: ClusterInfo[]): void {
    const existing = parent.querySelector('.nr-pv__filter-popup');
    if (existing) existing.remove();
    if (!filterPopupOpen) return;

    const popup = document.createElement('nav');
    popup.className = 'nr-pv__filter-popup';

    const activeId = getActiveCanvasId();
    const allCanvases = listCanvases();

    const canvasesWithClusters: { canvas: CanvasRecord; clusters: { id: string; name: string }[] }[] = [];
    for (const canvas of allCanvases) {
        let frameClusters: { id: string; name: string }[];
        if (canvas.id === activeId) {
            frameClusters = clusters.map(c => ({ id: c.id, name: c.name }));
        } else {
            frameClusters = getStoredClustersForCanvas(canvas.id);
        }
        if (frameClusters.length > 0) {
            canvasesWithClusters.push({ canvas, clusters: frameClusters });
        }
    }

    if (canvasesWithClusters.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'nr-pv__filter-empty';
        empty.textContent = 'No clusters available.';
        popup.appendChild(empty);
    } else {
        for (let gi = 0; gi < canvasesWithClusters.length; gi++) {
            const entry = canvasesWithClusters[gi];

            if (gi > 0) {
                const divider = document.createElement('div');
                divider.className = 'nr-pv__filter-divider';
                popup.appendChild(divider);
            }

            const section = document.createElement('div');
            section.className = 'nr-pv__filter-section';

            const heading = document.createElement('div');
            heading.className = 'nr-pv__filter-heading';
            const canvasName = entry.canvas.name || entry.canvas.id;
            const layerType = entry.canvas.layerType;
            heading.textContent = layerType ? `${canvasName} · ${layerType}` : canvasName;
            section.appendChild(heading);

            const itemsGrid = document.createElement('div');
            itemsGrid.className = 'nr-pv__filter-items-grid';
            for (const cl of entry.clusters) {
                const lbl = document.createElement('label');
                lbl.className = 'nr-pv__filter-item';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = visibleClusterIds!.has(cl.id);
                cb.addEventListener('change', () => {
                    if (cb.checked) visibleClusterIds!.add(cl.id);
                    else visibleClusterIds!.delete(cl.id);
                    renderLayout();
                    updateFilterBadge();
                });
                lbl.appendChild(cb);
                const span = document.createElement('span');
                span.textContent = cl.name;
                lbl.appendChild(span);
                itemsGrid.appendChild(lbl);
            }
            section.appendChild(itemsGrid);
            popup.appendChild(section);
        }
    }

    parent.appendChild(popup);

    const closeOnOutside = (e: MouseEvent) => {
        if (!parent.contains(e.target as Node)) {
            filterPopupOpen = false;
            popup.remove();
            document.removeEventListener('click', closeOnOutside);
        }
    };
    setTimeout(() => document.addEventListener('click', closeOnOutside), 0);
}

function updateFilterBadge(): void {
    if (!containerEl) return;
    const btn = containerEl.querySelector('.nr-pv__filter-btn:last-child') as HTMLElement;
    if (!btn) return;
    const existing = btn.querySelector('.nr-pv__filter-badge');
    if (existing) existing.remove();
    const clusters = getClusters();
    const hidden = clusters.length - (visibleClusterIds?.size ?? clusters.length);
    if (hidden > 0) {
        const badge = document.createElement('span');
        badge.className = 'nr-pv__filter-badge';
        badge.textContent = String(hidden);
        btn.appendChild(badge);
    }
}

// ── Reset modal ──

function showResetModal(): void {
    const overlay = document.createElement('div');
    overlay.className = 'nr-pv__modal-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'nr-pv__modal';

    const title = document.createElement('h3');
    title.className = 'nr-pv__modal-title';
    title.textContent = 'Reset All Placements';
    dialog.appendChild(title);

    const msg = document.createElement('p');
    msg.className = 'nr-pv__modal-text';
    msg.textContent = 'This will remove all instance-to-cluster assignments. This action cannot be undone.';
    dialog.appendChild(msg);

    const actions = document.createElement('div');
    actions.className = 'nr-pv__modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'cds--btn cds--btn--secondary cds--btn--sm';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => overlay.remove());
    actions.appendChild(cancelBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'cds--btn cds--btn--sm nr-btn--danger-ghost';
    confirmBtn.textContent = 'Reset Placements';
    confirmBtn.addEventListener('click', () => {
        const assignments = listAllAssignments();
        for (const id of Object.keys(assignments)) {
            setAssignment(id, null);
        }
        overlay.remove();
        renderLayout();
    });
    actions.appendChild(confirmBtn);

    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

// ── Instance chip ──

function buildInstanceChip(inst: WorkloadInstance): HTMLElement {
    const chip = document.createElement('div');
    chip.className = 'nr-pv__chip';
    chip.setAttribute('draggable', 'true');

    chip.addEventListener('dragstart', (e) => {
        e.dataTransfer!.setData('text/plain', inst.id);
        e.dataTransfer!.effectAllowed = 'move';
        chip.classList.add('nr-pv__chip--dragging');
    });
    chip.addEventListener('dragend', () => {
        chip.classList.remove('nr-pv__chip--dragging');
    });

    const nameRow = document.createElement('div');
    nameRow.className = 'nr-pv__chip-name';
    nameRow.textContent = `${inst.workloadName} #${inst.instanceIndex}`;
    chip.appendChild(nameRow);

    const metaRow = document.createElement('div');
    metaRow.className = 'nr-pv__chip-meta';

    metaRow.appendChild(carbonTag(
        inst.role === 'active' ? 'Active' : 'Standby',
        inst.role === 'active' ? 'green' : 'gray',
    ));

    if (inst.vCpu > 0) metaRow.appendChild(resourceTag(`${inst.vCpu} vCPU`, 'blue'));
    if (inst.ramGB > 0) metaRow.appendChild(resourceTag(`${inst.ramGB} GB RAM`, 'purple'));
    if (inst.storageGB > 0) metaRow.appendChild(resourceTag(`${inst.storageGB} GB`, 'teal'));
    const bw = getInstanceBandwidth(inst);
    if (bw > 0) metaRow.appendChild(resourceTag(`${bw} Mbps`, 'cyan'));

    chip.appendChild(metaRow);
    return chip;
}

function resourceTag(text: string, color: string): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = `cds--tag cds--tag--sm cds--tag--gray nr-pv__resource-tag`;
    span.setAttribute('data-color', color);
    span.textContent = text;
    return span;
}

function carbonTag(text: string, color: string): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = `cds--tag cds--tag--sm cds--tag--${color}`;
    span.textContent = text;
    return span;
}

// ── Cluster card ──

function buildClusterCard(cluster: ClusterInfo, assigned: WorkloadInstance[]): HTMLElement {
    const card = document.createElement('div');
    card.className = 'nr-pv__cluster-card';

    const header = document.createElement('div');
    header.className = 'nr-pv__cluster-header';
    const title = document.createElement('h4');
    title.className = 'nr-pv__cluster-name';
    title.textContent = cluster.name;
    title.style.cursor = 'pointer';
    title.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('nextrack:focus-cluster', { detail: { clusterId: cluster.id } }));
    });
    header.appendChild(title);
    const count = document.createElement('span');
    count.className = 'nr-pv__cluster-count';
    count.textContent = `${assigned.length} instance${assigned.length !== 1 ? 's' : ''}`;
    header.appendChild(count);
    card.appendChild(header);

    const sk = clusterSortKey[cluster.id];
    if (sk) {
        const sortLabels: Record<string, string> = { vCpu: 'CPU', ramGB: 'RAM', storageGB: 'Storage', bw: 'Bandwidth' };
        const asc = clusterSortAsc[cluster.id] !== false;
        const sortTag = document.createElement('div');
        sortTag.className = 'nr-pv__sort-tag';
        const sortText = document.createElement('span');
        sortText.textContent = `Sorted ${asc ? 'ascending' : 'descending'} by ${sortLabels[sk] || sk}`;
        sortTag.appendChild(sortText);
        const sortClear = document.createElement('button');
        sortClear.type = 'button';
        sortClear.className = 'nr-pv__sort-tag-close';
        sortClear.innerHTML = '\u00d7';
        sortClear.addEventListener('click', () => {
            delete clusterSortKey[cluster.id];
            delete clusterSortAsc[cluster.id];
            renderLayout();
        });
        sortTag.appendChild(sortClear);
        card.appendChild(sortTag);
    }

    const usedCpu = assigned.reduce((s, i) => s + i.vCpu, 0);
    const usedRam = assigned.reduce((s, i) => s + i.ramGB, 0);
    const usedStorage = assigned.reduce((s, i) => s + i.storageGB, 0);
    const usedBw = assigned.reduce((s, i) => s + getInstanceBandwidth(i), 0);

    const bars = document.createElement('div');
    bars.className = 'nr-pv__capacity-bars';
    bars.appendChild(buildBar('CPU', usedCpu, cluster.totalCpu, 'vCPU', COLOR_CPU));
    bars.appendChild(buildBar('RAM', usedRam, cluster.totalRam, 'GB', COLOR_RAM));
    bars.appendChild(buildBar('Storage', usedStorage, cluster.totalStorage, 'GB', COLOR_STORAGE));
    bars.appendChild(buildBar('BW', usedBw, cluster.totalBandwidth, 'Mbps', COLOR_BANDWIDTH));
    card.appendChild(bars);

    const zone = document.createElement('div');
    zone.className = 'nr-pv__cluster-zone';

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('nr-pv__drop--active');
    });
    zone.addEventListener('dragleave', () => {
        zone.classList.remove('nr-pv__drop--active');
    });
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('nr-pv__drop--active');
        const instanceId = e.dataTransfer?.getData('text/plain');
        if (instanceId) {
            setAssignment(instanceId, cluster.id);
            renderLayout();
        }
    });

    // Sort toolbar
    if (assigned.length > 1) {
        const sortBar = document.createElement('div');
        sortBar.className = 'nr-pv__sort-bar';
        const sortBtn = document.createElement('button');
        sortBtn.type = 'button';
        sortBtn.className = 'nr-pv__sort-btn';
        sortBtn.innerHTML = ICON_SORT;

        const sortMenu = document.createElement('div');
        sortMenu.className = 'nr-pv__sort-menu';
        sortMenu.style.display = 'none';

        const sortOptions = [
            { key: 'vCpu', label: 'CPU' },
            { key: 'ramGB', label: 'RAM' },
            { key: 'storageGB', label: 'Storage' },
            { key: 'bw', label: 'Bandwidth' },
        ];
        for (const opt of sortOptions) {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'nr-pv__sort-menu-item';
            const current = clusterSortKey[cluster.id] === opt.key;
            const asc = clusterSortAsc[cluster.id] !== false;
            item.textContent = current ? `${opt.label} ${asc ? '↑' : '↓'}` : opt.label;
            if (current) item.classList.add('nr-pv__sort-menu-item--active');
            item.addEventListener('click', () => {
                if (clusterSortKey[cluster.id] === opt.key) {
                    clusterSortAsc[cluster.id] = !clusterSortAsc[cluster.id];
                } else {
                    clusterSortKey[cluster.id] = opt.key;
                    clusterSortAsc[cluster.id] = false;
                }
                renderLayout();
            });
            sortMenu.appendChild(item);
        }

        sortBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sortMenu.style.display = sortMenu.style.display === 'none' ? 'block' : 'none';
        });
        document.addEventListener('mousedown', (e) => {
            if (!sortBar.contains(e.target as Node)) sortMenu.style.display = 'none';
        }, true);

        sortBar.appendChild(sortBtn);
        sortBar.appendChild(sortMenu);
        zone.appendChild(sortBar);
    }

    // Sort assigned instances
    let sorted = assigned;
    const sortKey = clusterSortKey[cluster.id];
    if (sortKey && assigned.length > 1) {
        const sortAsc = clusterSortAsc[cluster.id] !== false;
        sorted = [...assigned].sort((a, b) => {
            let va: number, vb: number;
            if (sortKey === 'bw') { va = getInstanceBandwidth(a); vb = getInstanceBandwidth(b); }
            else { va = (a as any)[sortKey] || 0; vb = (b as any)[sortKey] || 0; }
            return sortAsc ? va - vb : vb - va;
        });
    }

    if (sorted.length === 0 && assigned.length === 0) {
        const hint = document.createElement('div');
        hint.className = 'nr-pv__drop-hint';
        hint.textContent = 'Drop workload instances here';
        zone.appendChild(hint);
    } else {
        for (const inst of sorted) {
            zone.appendChild(buildInstanceChip(inst));
        }
    }
    card.appendChild(zone);
    return card;
}

// ── Capacity bar ──

function buildBar(label: string, used: number, total: number, unit: string, color: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'nr-pv__bar-row';

    const pct = total > 0 ? used / total : 0;
    const overCapacity = pct > 1;

    const labelEl = document.createElement('span');
    labelEl.className = 'nr-pv__bar-label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const track = document.createElement('div');
    track.className = 'nr-pv__bar-track';

    const fill = document.createElement('div');
    fill.className = 'nr-pv__bar-fill';
    if (overCapacity) {
        fill.classList.add('nr-pv__bar-fill--danger');
    } else {
        fill.style.backgroundColor = color;
    }
    fill.style.width = `${Math.min(pct * 100, 100)}%`;
    track.appendChild(fill);

    if (overCapacity) {
        const overflow = document.createElement('div');
        overflow.className = 'nr-pv__bar-overflow';
        overflow.style.width = `${Math.min((pct - 1) * 100, 100)}%`;
        track.appendChild(overflow);
    }
    row.appendChild(track);

    const valueEl = document.createElement('span');
    valueEl.className = 'nr-pv__bar-value';
    if (overCapacity) valueEl.classList.add('nr-pv__bar-value--danger');
    valueEl.textContent = `${fmt(used)} / ${fmt(total)} ${unit}`;
    row.appendChild(valueEl);

    return row;
}

function fmt(n: number): string {
    if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (n === Math.floor(n)) return String(n);
    return n.toFixed(1);
}
