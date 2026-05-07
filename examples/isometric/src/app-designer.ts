import {
    listWorkloads, getWorkload, saveWorkload, createWorkload, deleteWorkload,
    WorkloadDefinition,
} from './app-store';
import { getDataType } from './schema-registry';
import { carbonIconToString, CarbonIcon } from './icons';
import TrashCan16 from '@carbon/icons/es/trash-can/16.js';
import Copy16 from '@carbon/icons/es/copy/16.js';
import Close20 from '@carbon/icons/es/close/20.js';
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import { showWorkloadImporter } from './workload-importer';

const ICON_TRASH = carbonIconToString(TrashCan16 as CarbonIcon);
const ICON_COPY  = carbonIconToString(Copy16 as CarbonIcon);
const ICON_CLOSE = carbonIconToString(Close20 as CarbonIcon);

// ── Treemap types & constants ──

type TreemapMetric = 'vCpuCores' | 'ramGB' | 'storageCapacityGB';

const TREEMAP_METRICS: { key: TreemapMetric; label: string; unit: string; colors: string[] }[] = [
    // IBM Design Language Blue 50–80
    { key: 'vCpuCores', label: 'vCPU', unit: 'cores',
      colors: ['#4589ff', '#0f62fe', '#0043ce', '#002d9c'] },
    // IBM Design Language Purple 50–80
    { key: 'ramGB', label: 'RAM', unit: 'GB',
      colors: ['#a56eff', '#8a3ffc', '#6929c4', '#491d8b'] },
    // IBM Design Language Teal 50–80
    { key: 'storageCapacityGB', label: 'Storage', unit: 'GB',
      colors: ['#009d9a', '#007d79', '#005d5d', '#004144'] },
];

const CDS_ACCORDION_ARROW = `<svg focusable="false" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" class="cds--accordion__arrow"><path d="M11 8L6 13 5.3 12.3 9.6 8 5.3 3.7 6 3z"></path></svg>`;

const tableEl = document.getElementById('ad-table') as HTMLDivElement;

type SortKey = 'name' | 'vCpuCores' | 'ramGB' | 'storageCapacityGB' | 'bandwidthMbps';
type SortDir = 'asc' | 'desc' | 'none';

interface Column {
    key: SortKey;
    label: string;
}

const COLUMNS: Column[] = [
    { key: 'name', label: 'Name' },
    { key: 'vCpuCores', label: 'vCPU' },
    { key: 'ramGB', label: 'vRAM' },
    { key: 'storageCapacityGB', label: 'Storage' },
    { key: 'bandwidthMbps', label: 'Network' },
];

let panelId: string | null = null;
let sortKey: SortKey = 'name';
let sortDir: SortDir = 'asc';
let selectedIds = new Set<string>();

let panelEl: HTMLDivElement | null = null;
let overlayEl: HTMLDivElement | null = null;

// Treemap state
let activeMetric: TreemapMetric = 'vCpuCores';
let treemapChartEl: HTMLDivElement | null = null;
let treemapEmptyEl: HTMLDivElement | null = null;
let treemapTooltipEl: HTMLDivElement | null = null;

// Batch bar refs
let batchBarEl: HTMLDivElement | null = null;
let batchCountEl: HTMLSpanElement | null = null;
let toolbarEl: HTMLDivElement | null = null;

export function initAppDesigner(_container: HTMLDivElement): void {
    initTreemap();
    render();
}

// ── Treemap ──

const SVG_NS = 'http://www.w3.org/2000/svg';

function parseMetricValue(raw: string): number {
    const n = parseFloat(raw);
    return isNaN(n) || n <= 0 ? 0 : n;
}

function initTreemap(): void {
    const designer = document.getElementById('app-designer')!;

    const wrap = document.createElement('div');
    wrap.className = 'nr-ad__treemap-wrap';

    const headerRow = document.createElement('div');
    headerRow.className = 'nr-ad__treemap-header';

    const label = document.createElement('h3');
    label.className = 'nr-ad__treemap-label';
    label.textContent = 'Resource Distribution';
    headerRow.appendChild(label);

    const switcher = document.createElement('div');
    switcher.className = 'cds--content-switcher cds--content-switcher--sm';
    switcher.setAttribute('role', 'tablist');

    for (const metric of TREEMAP_METRICS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cds--content-switcher-btn';
        if (metric.key === activeMetric) btn.classList.add('cds--content-switcher--selected');
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', String(metric.key === activeMetric));

        const span = document.createElement('span');
        span.className = 'cds--content-switcher__label';
        span.textContent = metric.label;
        btn.appendChild(span);

        btn.addEventListener('click', () => {
            activeMetric = metric.key;
            switcher.querySelectorAll('.cds--content-switcher-btn').forEach(b => {
                b.classList.remove('cds--content-switcher--selected');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('cds--content-switcher--selected');
            btn.setAttribute('aria-selected', 'true');
            updateTreemap();
        });

        switcher.appendChild(btn);
    }

    headerRow.appendChild(switcher);
    wrap.appendChild(headerRow);

    treemapChartEl = document.createElement('div');
    treemapChartEl.className = 'nr-ad__treemap-chart';
    wrap.appendChild(treemapChartEl);

    treemapEmptyEl = document.createElement('div');
    treemapEmptyEl.className = 'nr-ad__treemap-empty';
    treemapEmptyEl.textContent = 'No workload data to display.';
    treemapEmptyEl.style.display = 'none';
    wrap.appendChild(treemapEmptyEl);

    treemapTooltipEl = document.createElement('div');
    treemapTooltipEl.className = 'nr-ad__treemap-tooltip';
    wrap.appendChild(treemapTooltipEl);

    designer.insertBefore(wrap, tableEl);

    new ResizeObserver(() => {
        if (treemapChartEl && treemapChartEl.offsetWidth > 0) {
            updateTreemap();
        }
    }).observe(treemapChartEl);
}

function updateTreemap(): void {
    if (!treemapChartEl || !treemapEmptyEl) return;

    const width = treemapChartEl.clientWidth;
    const height = treemapChartEl.clientHeight;
    if (width === 0 || height === 0) return;

    const metricDef = TREEMAP_METRICS.find(m => m.key === activeMetric)!;
    const colors = metricDef.colors;
    const items = listWorkloads()
        .map(wl => ({
            name: wl.name || wl.id,
            value: parseMetricValue(wl[activeMetric]),
        }))
        .filter(d => d.value > 0);

    if (items.length === 0) {
        treemapChartEl.style.display = 'none';
        treemapEmptyEl.style.display = '';
        return;
    }

    treemapChartEl.style.display = '';
    treemapEmptyEl.style.display = 'none';

    const vals = items.map(d => d.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;

    const root = hierarchy({ children: items } as any)
        .sum((d: any) => d.value || 0);

    treemap().size([width, height]).padding(1).tile(treemapSquarify)(root as any);

    const unit = metricDef.unit;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.style.display = 'block';

    for (const leaf of root.leaves()) {
        const d = leaf.data as any;
        const x0 = (leaf as any).x0 as number;
        const y0 = (leaf as any).y0 as number;
        const x1 = (leaf as any).x1 as number;
        const y1 = (leaf as any).y1 as number;
        const w = x1 - x0;
        const h = y1 - y0;

        const t = (d.value - min) / range;
        const idx = Math.min(Math.floor(t * colors.length), colors.length - 1);

        const g = document.createElementNS(SVG_NS, 'g');
        g.style.cursor = 'default';

        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', String(x0));
        rect.setAttribute('y', String(y0));
        rect.setAttribute('width', String(w));
        rect.setAttribute('height', String(h));
        rect.setAttribute('fill', colors[idx]);
        g.appendChild(rect);

        if (w > 50 && h > 24) {
            const text = document.createElementNS(SVG_NS, 'text');
            text.setAttribute('x', String(x0 + 8));
            text.setAttribute('y', String(y0 + 18));
            text.setAttribute('fill', '#fff');
            text.setAttribute('font-size', '13');
            text.setAttribute('font-family', "'IBM Plex Sans', sans-serif");
            text.textContent = d.name;
            g.appendChild(text);

            if (h > 40) {
                const valText = document.createElementNS(SVG_NS, 'text');
                valText.setAttribute('x', String(x0 + 8));
                valText.setAttribute('y', String(y0 + 34));
                valText.setAttribute('fill', 'rgba(255,255,255,0.7)');
                valText.setAttribute('font-size', '12');
                valText.setAttribute('font-family', "'IBM Plex Sans', sans-serif");
                valText.textContent = `${d.value} ${unit}`;
                g.appendChild(valText);
            }
        }

        g.addEventListener('mouseenter', (e) => {
            if (!treemapTooltipEl) return;
            treemapTooltipEl.innerHTML = `<strong>${d.name}</strong><br/>${d.value} ${unit}`;
            treemapTooltipEl.style.display = 'block';
            positionTooltip(e);
        });
        g.addEventListener('mousemove', positionTooltip);
        g.addEventListener('mouseleave', () => {
            if (treemapTooltipEl) treemapTooltipEl.style.display = 'none';
        });

        svg.appendChild(g);
    }

    treemapChartEl.innerHTML = '';
    treemapChartEl.appendChild(svg);
}

function positionTooltip(e: MouseEvent): void {
    if (!treemapTooltipEl) return;
    treemapTooltipEl.style.left = (e.clientX + 12) + 'px';
    treemapTooltipEl.style.top = (e.clientY + 12) + 'px';
}

// ── Sorting ──

function getSorted(): WorkloadDefinition[] {
    const items = listWorkloads();
    if (sortDir === 'none') return items;
    return items.sort((a, b) => {
        const av = (a[sortKey] || '').toLowerCase();
        const bv = (b[sortKey] || '').toLowerCase();
        const cmp = av.localeCompare(bv, undefined, { numeric: true });
        return sortDir === 'desc' ? -cmp : cmp;
    });
}

function toggleSort(key: SortKey): void {
    if (sortKey === key) {
        sortDir = sortDir === 'asc' ? 'desc' : sortDir === 'desc' ? 'none' : 'asc';
    } else {
        sortKey = key;
        sortDir = 'asc';
    }
    render();
}

// ── Batch selection bar ──

function syncSelection(): void {
    const count = selectedIds.size;
    const active = count > 0;
    if (batchBarEl) batchBarEl.classList.toggle('nr-dt__batch--active', active);
    if (toolbarEl) toolbarEl.classList.toggle('nr-dt__toolbar--batch-active', active);
    if (batchCountEl) batchCountEl.textContent = `${count} item${count !== 1 ? 's' : ''} selected`;
}

// ── Side Panel ──

function openPanel(id: string): void {
    panelId = id;
    renderPanel();
    renderTableRows();
}

function closePanel(): void {
    panelId = null;
    if (panelEl) panelEl.classList.remove('nr-ad__panel--open');
    if (overlayEl) overlayEl.classList.remove('nr-ad__overlay--visible');
    renderTableRows();
}

function ensurePanelShell(): void {
    if (panelEl) return;

    const designer = document.getElementById('app-designer') as HTMLDivElement;

    overlayEl = document.createElement('div');
    overlayEl.className = 'nr-ad__overlay';
    overlayEl.addEventListener('click', closePanel);
    designer.appendChild(overlayEl);

    panelEl = document.createElement('div');
    panelEl.className = 'nr-ad__panel';
    designer.appendChild(panelEl);
}

function renderPanel(): void {
    ensurePanelShell();
    if (!panelEl || !overlayEl || !panelId) return;

    const wl = getWorkload(panelId);
    if (!wl) { closePanel(); return; }

    panelEl.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'nr-ad__panel-header';

    const title = document.createElement('h2');
    title.className = 'nr-ad__panel-title';
    title.textContent = wl.name || 'Untitled Workload';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'nr-ad__panel-close';
    closeBtn.innerHTML = ICON_CLOSE;
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', closePanel);
    header.appendChild(closeBtn);

    panelEl.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'nr-ad__panel-body';

    const save = () => {
        saveWorkload(wl);
        renderTableRows();
        title.textContent = wl.name || 'Untitled Workload';
    };

    // Name field at top
    body.appendChild(buildField('Workload Name', wl.name, v => { wl.name = v; save(); }, 'text', 'e.g. SAP ERP Production'));

    // Accordion
    const accordion = document.createElement('ul');
    accordion.className = 'cds--accordion';

    // Type section
    accordion.appendChild(buildAccordionItem('Type', false, (c) => {
        c.appendChild(buildField('Workload Type', wl.deploymentModel, v => { wl.deploymentModel = v; save(); }, 'select', undefined, ['DB', 'App', 'Batch']));
        c.appendChild(buildNumberField('Replication Factor', wl.replicationLevel, v => { wl.replicationLevel = v; save(); }, 1, 1, 16));
    }));

    // Compute
    accordion.appendChild(buildAccordionItem('Compute', false, (c) => {
        c.appendChild(buildField('vCPU / Cores', wl.vCpuCores, v => { wl.vCpuCores = v; save(); }, 'text', 'e.g. 4'));
        c.appendChild(buildField('CPU Peak Factor', wl.cpuPeakFactor, v => { wl.cpuPeakFactor = v; save(); }, 'select', undefined, ['1x', '1.5x', '2x', '2.5x', '3x']));
    }));

    // Memory
    accordion.appendChild(buildAccordionItem('Memory', false, (c) => {
        c.appendChild(buildField('vRAM in GB', wl.ramGB, v => { wl.ramGB = v; save(); }, 'text', 'e.g. 16'));
    }));

    // Storage
    accordion.appendChild(buildAccordionItem('Storage', false, (c) => {
        c.appendChild(buildField('Capacity', wl.storageCapacityGB, v => { wl.storageCapacityGB = v; save(); }, 'text', 'e.g. 500 GB'));
        c.appendChild(buildField('IOPS Required', wl.iopsRequired, v => { wl.iopsRequired = v; save(); }, 'text', 'e.g. 3000'));
        c.appendChild(buildField('Throughput MB/s', wl.throughputMBs, v => { wl.throughputMBs = v; save(); }, 'text', 'e.g. 200'));
    }));

    // Network
    accordion.appendChild(buildAccordionItem('Network', false, (c) => {
        c.appendChild(buildField('Bandwidth', wl.bandwidthMbps, v => { wl.bandwidthMbps = v; save(); }, 'text', 'e.g. 1 Gbps'));
    }));

    body.appendChild(accordion);
    panelEl.appendChild(body);

    // Footer — reusable pattern from component designer
    const footer = document.createElement('div');
    footer.className = 'nr-panel-footer';

    const dupBtn = document.createElement('button');
    dupBtn.type = 'button';
    dupBtn.className = 'cds--btn cds--btn--secondary cds--btn--sm';
    dupBtn.style.width = '100%';
    dupBtn.textContent = 'Duplicate Workload';
    dupBtn.addEventListener('click', () => {
        duplicateWorkload(wl.id);
    });
    footer.appendChild(dupBtn);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'cds--btn cds--btn--sm nr-btn--danger-ghost';
    delBtn.style.width = '100%';
    delBtn.textContent = 'Delete Workload';
    delBtn.addEventListener('click', () => {
        if (!confirm(`Delete "${wl.name}"?`)) return;
        deleteWorkload(wl.id);
        selectedIds.delete(wl.id);
        closePanel();
        render();
    });
    footer.appendChild(delBtn);
    panelEl.appendChild(footer);

    panelEl.classList.add('nr-ad__panel--open');
    overlayEl.classList.add('nr-ad__overlay--visible');
}

// ── Table ──

let tbodyEl: HTMLTableSectionElement | null = null;

function render(): void {
    tableEl.innerHTML = '';

    const workloads = getSorted();

    // Header
    const header = document.createElement('div');
    header.className = 'nr-dt__header';
    const titleEl = document.createElement('h2');
    titleEl.className = 'nr-dt__title';
    titleEl.textContent = 'Workloads';
    header.appendChild(titleEl);
    tableEl.appendChild(header);

    // Toolbar
    toolbarEl = document.createElement('div');
    toolbarEl.className = 'nr-dt__toolbar';

    const toolbarActions = document.createElement('div');
    toolbarActions.className = 'nr-dt__toolbar-actions';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'cds--btn cds--btn--primary nr-dt__add-btn';
    addBtn.textContent = 'New Workload';
    addBtn.addEventListener('click', () => {
        const wl = createWorkload('New Workload');
        openPanel(wl.id);
        render();
    });
    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.className = 'cds--btn cds--btn--tertiary nr-dt__add-btn';
    importBtn.textContent = 'Import Excel';
    importBtn.addEventListener('click', () => {
        showWorkloadImporter(() => render());
    });

    toolbarActions.appendChild(importBtn);
    toolbarActions.appendChild(addBtn);
    toolbarEl.appendChild(toolbarActions);

    // Batch bar
    batchBarEl = document.createElement('div');
    batchBarEl.className = 'nr-dt__batch';

    batchCountEl = document.createElement('span');
    batchCountEl.className = 'nr-dt__batch-count';
    batchBarEl.appendChild(batchCountEl);

    const batchActions = document.createElement('div');
    batchActions.className = 'nr-dt__batch-actions';

    const batchDuplicateBtn = document.createElement('button');
    batchDuplicateBtn.type = 'button';
    batchDuplicateBtn.className = 'nr-dt__batch-btn';
    batchDuplicateBtn.innerHTML = `Duplicate<span class="nr-dt__batch-btn-icon">${ICON_COPY}</span>`;
    batchDuplicateBtn.addEventListener('click', () => {
        selectedIds.forEach(id => duplicateWorkload(id));
        selectedIds.clear();
        render();
    });
    batchActions.appendChild(batchDuplicateBtn);

    const batchDeleteBtn = document.createElement('button');
    batchDeleteBtn.type = 'button';
    batchDeleteBtn.className = 'nr-dt__batch-btn';
    batchDeleteBtn.innerHTML = `Delete<span class="nr-dt__batch-btn-icon">${ICON_TRASH}</span>`;
    batchDeleteBtn.addEventListener('click', () => {
        if (!confirm(`Delete ${selectedIds.size} workload${selectedIds.size !== 1 ? 's' : ''}?`)) return;
        selectedIds.forEach(id => deleteWorkload(id));
        selectedIds.clear();
        if (panelId && !getWorkload(panelId)) closePanel();
        render();
    });
    batchActions.appendChild(batchDeleteBtn);

    const batchCancelBtn = document.createElement('button');
    batchCancelBtn.type = 'button';
    batchCancelBtn.className = 'nr-dt__batch-btn nr-dt__batch-btn--cancel';
    batchCancelBtn.textContent = 'Cancel';
    batchCancelBtn.addEventListener('click', () => {
        selectedIds.clear();
        syncSelection();
        renderTableRows();
    });
    batchActions.appendChild(batchCancelBtn);

    batchBarEl.appendChild(batchActions);
    toolbarEl.appendChild(batchBarEl);

    tableEl.appendChild(toolbarEl);

    // Table
    const container = document.createElement('div');
    container.className = 'nr-dt';

    const table = document.createElement('table');
    table.className = 'nr-dt__table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');

    // Select-all checkbox
    const thSelect = document.createElement('th');
    thSelect.className = 'nr-dt__th nr-dt__th--checkbox';
    const selectAllWrap = document.createElement('div');
    selectAllWrap.className = 'nr-dt__checkbox-wrap';
    const selectAllCb = document.createElement('input');
    selectAllCb.type = 'checkbox';
    selectAllCb.setAttribute('aria-label', 'Select all');
    selectAllCb.checked = workloads.length > 0 && workloads.every(w => selectedIds.has(w.id));
    selectAllCb.indeterminate = selectedIds.size > 0 && !selectAllCb.checked;
    selectAllCb.addEventListener('change', () => {
        if (selectAllCb.checked) workloads.forEach(w => selectedIds.add(w.id));
        else selectedIds.clear();
        syncSelection();
        renderTableRows();
    });
    selectAllWrap.appendChild(selectAllCb);
    thSelect.appendChild(selectAllWrap);
    headRow.appendChild(thSelect);

    // Column headers
    for (const col of COLUMNS) {
        const th = document.createElement('th');
        th.className = 'nr-dt__th nr-dt__th--sortable';
        if (sortKey === col.key && sortDir !== 'none') th.classList.add('nr-dt__th--sorted');

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-dt__sort-btn';
        btn.textContent = col.label;

        if (sortKey === col.key && sortDir !== 'none') {
            const arrow = document.createElement('span');
            arrow.className = 'nr-dt__sort-icon';
            arrow.textContent = sortDir === 'asc' ? ' ↑' : ' ↓';
            btn.appendChild(arrow);
            th.setAttribute('aria-sort', sortDir === 'asc' ? 'ascending' : 'descending');
        }

        btn.addEventListener('click', () => toggleSort(col.key));
        th.appendChild(btn);
        headRow.appendChild(th);
    }

    // Actions column
    const thActions = document.createElement('th');
    thActions.className = 'nr-dt__th nr-dt__th--actions';
    headRow.appendChild(thActions);

    thead.appendChild(headRow);
    table.appendChild(thead);

    tbodyEl = document.createElement('tbody');
    renderTableRowsInto(tbodyEl, workloads);
    table.appendChild(tbodyEl);

    container.appendChild(table);
    tableEl.appendChild(container);

    syncSelection();
    updateTreemap();
}

function renderTableRows(): void {
    if (!tbodyEl) return;
    renderTableRowsInto(tbodyEl, getSorted());
    updateTreemap();
}

function renderTableRowsInto(tbody: HTMLTableSectionElement, workloads: WorkloadDefinition[]): void {
    tbody.innerHTML = '';

    if (workloads.length === 0) {
        const emptyRow = document.createElement('tr');
        const emptyTd = document.createElement('td');
        emptyTd.colSpan = COLUMNS.length + 2;
        emptyTd.className = 'nr-dt__cell nr-dt__empty';
        emptyTd.textContent = 'No workloads defined yet.';
        emptyRow.appendChild(emptyTd);
        tbody.appendChild(emptyRow);
        return;
    }

    for (const wl of workloads) {
        const tr = document.createElement('tr');
        tr.className = 'nr-dt__row';
        if (wl.id === panelId) tr.classList.add('nr-ad__row--active');

        // Checkbox
        const tdSelect = document.createElement('td');
        tdSelect.className = 'nr-dt__cell nr-dt__cell--checkbox';
        const cbWrap = document.createElement('div');
        cbWrap.className = 'nr-dt__checkbox-wrap';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.setAttribute('aria-label', `Select ${wl.name || wl.id}`);
        cb.checked = selectedIds.has(wl.id);
        cb.addEventListener('change', () => {
            if (cb.checked) selectedIds.add(wl.id);
            else selectedIds.delete(wl.id);
            syncSelection();
            renderTableRows();
        });
        cbWrap.appendChild(cb);
        tdSelect.appendChild(cbWrap);
        tr.appendChild(tdSelect);

        // Data cells
        for (const col of COLUMNS) {
            const td = document.createElement('td');
            td.className = 'nr-dt__cell';
            td.textContent = wl[col.key] || '—';
            td.style.cursor = 'pointer';
            td.addEventListener('click', () => openPanel(wl.id));
            tr.appendChild(td);
        }

        // Row delete
        const tdActions = document.createElement('td');
        tdActions.className = 'nr-dt__cell nr-dt__cell--actions';
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'nr-ad__row-action-btn nr-ad__row-action-btn--danger';
        delBtn.innerHTML = ICON_TRASH;
        delBtn.title = 'Delete';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!confirm(`Delete "${wl.name}"?`)) return;
            deleteWorkload(wl.id);
            selectedIds.delete(wl.id);
            if (panelId === wl.id) closePanel();
            render();
        });
        tdActions.appendChild(delBtn);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
    }
}

// ── Duplicate helper ──

function duplicateWorkload(id: string): void {
    const src = getWorkload(id);
    if (!src) return;
    const clone: WorkloadDefinition = {
        ...src,
        id: 'wl-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: (src.name || 'Workload') + ' (copy)',
    };
    saveWorkload(clone);
    openPanel(clone.id);
    render();
}

// ── Accordion helper (same pattern as component-designer) ──

function buildAccordionItem(
    title: string,
    startExpanded: boolean,
    buildContent: (container: HTMLElement) => void,
): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'cds--accordion__item' + (startExpanded ? ' cds--accordion__item--active' : '');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cds--accordion__heading';
    btn.setAttribute('aria-expanded', String(startExpanded));
    btn.innerHTML = CDS_ACCORDION_ARROW + `<div class="cds--accordion__title">${title}</div>`;

    const content = document.createElement('div');
    content.className = 'cds--accordion__content';
    buildContent(content);

    btn.addEventListener('click', () => {
        const expanded = li.classList.toggle('cds--accordion__item--active');
        btn.setAttribute('aria-expanded', String(expanded));
    });

    li.appendChild(btn);
    li.appendChild(content);
    return li;
}

// ── Form field helpers ──

function opts(typeId: string): string[] {
    const dt = getDataType(typeId);
    return dt ? dt.fields.map(f => f.key) : [];
}

function buildField(
    label: string,
    value: string,
    onChange: (v: string) => void,
    type: 'text' | 'select',
    placeholder?: string,
    options?: string[],
): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'nr-ad__field';

    const lbl = document.createElement('label');
    lbl.className = 'cds--label';
    lbl.textContent = label;
    wrapper.appendChild(lbl);

    if (type === 'select' && options) {
        const select = document.createElement('select');
        select.className = 'nr-ad__input';
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '— select —';
        select.appendChild(emptyOpt);
        for (const opt of options) {
            const el = document.createElement('option');
            el.value = opt;
            el.textContent = opt;
            if (opt === value) el.selected = true;
            select.appendChild(el);
        }
        select.addEventListener('change', () => onChange(select.value));
        wrapper.appendChild(select);
    } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'nr-ad__input';
        input.value = value;
        if (placeholder) input.placeholder = placeholder;
        input.addEventListener('change', () => onChange(input.value));
        wrapper.appendChild(input);
    }

    return wrapper;
}

function buildNumberField(
    label: string,
    value: string,
    onChange: (v: string) => void,
    defaultVal: number,
    min: number,
    max: number,
): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'nr-ad__field';

    const lbl = document.createElement('label');
    lbl.className = 'cds--label';
    lbl.textContent = label;
    wrapper.appendChild(lbl);

    const stepper = document.createElement('div');
    stepper.className = 'nr-ad__number-stepper';

    const decBtn = document.createElement('button');
    decBtn.type = 'button';
    decBtn.className = 'nr-ad__number-btn';
    decBtn.textContent = '−';
    decBtn.setAttribute('aria-label', 'Decrease');

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'nr-ad__number-input';
    input.min = String(min);
    input.max = String(max);
    input.value = value || String(defaultVal);

    const incBtn = document.createElement('button');
    incBtn.type = 'button';
    incBtn.className = 'nr-ad__number-btn';
    incBtn.textContent = '+';
    incBtn.setAttribute('aria-label', 'Increase');

    const update = (n: number) => {
        const clamped = Math.max(min, Math.min(max, n));
        input.value = String(clamped);
        onChange(String(clamped));
    };

    decBtn.addEventListener('click', () => update((parseInt(input.value, 10) || defaultVal) - 1));
    incBtn.addEventListener('click', () => update((parseInt(input.value, 10) || defaultVal) + 1));
    input.addEventListener('change', () => update(parseInt(input.value, 10) || defaultVal));

    stepper.appendChild(input);
    stepper.appendChild(decBtn);
    stepper.appendChild(incBtn);
    wrapper.appendChild(stepper);
    return wrapper;
}
