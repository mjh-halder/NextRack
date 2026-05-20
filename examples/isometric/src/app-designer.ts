import {
    listWorkloads, getWorkload, saveWorkload, createWorkload, deleteWorkload,
    WorkloadDefinition,
} from './app-store';
import { getDataType } from './schema-registry';
import { carbonIconToString, CarbonIcon } from './icons';
import TrashCan16 from '@carbon/icons/es/trash-can/16.js';
import Copy16 from '@carbon/icons/es/copy/16.js';
import Close20 from '@carbon/icons/es/close/20.js';
import Upload16 from '@carbon/icons/es/upload/16.js';
import Download16 from '@carbon/icons/es/download/16.js';
import Search16 from '@carbon/icons/es/search/16.js';
import Close16 from '@carbon/icons/es/close/16.js';
import Filter16 from '@carbon/icons/es/filter/16.js';
import FilterRemove16 from '@carbon/icons/es/filter--remove/16.js';
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import { showWorkloadImporter } from './workload-importer';
import { getInstancesForWorkload, setInstanceStatus, InstanceRole } from './placement-store';
import ChevronRight16 from '@carbon/icons/es/chevron--right/16.js';
import SettingsAdjust16 from '@carbon/icons/es/settings--adjust/16.js';
import * as XLSX from 'xlsx';

const ICON_CHEVRON   = carbonIconToString(ChevronRight16 as CarbonIcon);
const ICON_UPLOAD    = carbonIconToString(Upload16 as CarbonIcon);
const ICON_DOWNLOAD  = carbonIconToString(Download16 as CarbonIcon);
const ICON_SEARCH    = carbonIconToString(Search16 as CarbonIcon);
const ICON_CLOSE_SM  = carbonIconToString(Close16 as CarbonIcon);
const ICON_SETTINGS  = carbonIconToString(SettingsAdjust16 as CarbonIcon);
const ICON_FILTER    = carbonIconToString(Filter16 as CarbonIcon);
const ICON_FILTER_RM = carbonIconToString(FilterRemove16 as CarbonIcon);

const ICON_TRASH = carbonIconToString(TrashCan16 as CarbonIcon);
const ICON_COPY  = carbonIconToString(Copy16 as CarbonIcon);
const ICON_CLOSE = carbonIconToString(Close20 as CarbonIcon);

// ── Treemap types & constants ──

type TreemapMetric = 'vCpuCores' | 'ramGB' | 'storageCapacityGB' | 'bandwidthMbps';

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
    // IBM Design Language Cyan 50–80
    { key: 'bandwidthMbps', label: 'Bandwidth', unit: 'Mbps',
      colors: ['#1192e8', '#0072c3', '#00539a', '#003a6d'] },
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
let expandedIds = new Set<string>();
let searchQuery = '';
let searchOpen = false;
let treemapFilterIds: Set<string> | null = null;

let panelEl: HTMLDivElement | null = null;
let overlayEl: HTMLDivElement | null = null;

// Treemap state
let activeMetric: TreemapMetric = 'vCpuCores';
let considerReplication = false;
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

    const controls = document.createElement('div');
    controls.className = 'nr-ad__treemap-controls';

    const filterIndicator = document.createElement('button');
    filterIndicator.type = 'button';
    filterIndicator.className = 'nr-ad__treemap-filter-indicator';
    filterIndicator.title = 'Clear treemap filter';
    filterIndicator.innerHTML = ICON_FILTER_RM;
    filterIndicator.addEventListener('click', () => {
        treemapFilterIds = null;
        updateTreemap();
        render();
    });
    controls.appendChild(filterIndicator);

    // Treemap settings icon + popup
    const settingsWrap = document.createElement('div');
    settingsWrap.className = 'nr-ad__treemap-settings';

    const settingsBtn = document.createElement('button');
    settingsBtn.type = 'button';
    settingsBtn.className = 'nr-ad__treemap-settings-btn';
    settingsBtn.title = 'Chart settings';
    settingsBtn.innerHTML = ICON_SETTINGS;
    if (considerReplication) settingsBtn.classList.add('nr-ad__treemap-settings-btn--active');

    const settingsPopup = document.createElement('div');
    settingsPopup.className = 'nr-ad__treemap-settings-popup';

    const repLabel = document.createElement('label');
    repLabel.className = 'nr-ad__treemap-settings-item';
    const repCb = document.createElement('input');
    repCb.type = 'checkbox';
    repCb.checked = considerReplication;
    repCb.addEventListener('change', () => {
        considerReplication = repCb.checked;
        settingsBtn.classList.toggle('nr-ad__treemap-settings-btn--active', considerReplication);
        updateTreemap();
    });
    repLabel.appendChild(repCb);
    const repText = document.createElement('span');
    repText.textContent = 'Consider Replication';
    repLabel.appendChild(repText);
    settingsPopup.appendChild(repLabel);

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPopup.classList.toggle('nr-ad__treemap-settings-popup--open');
    });
    document.addEventListener('mousedown', (e) => {
        if (!settingsWrap.contains(e.target as Node)) {
            settingsPopup.classList.remove('nr-ad__treemap-settings-popup--open');
        }
    }, true);

    settingsWrap.appendChild(settingsBtn);
    settingsWrap.appendChild(settingsPopup);
    controls.appendChild(settingsWrap);

    // Metric switcher (seg-control style)
    const switcher = document.createElement('div');
    switcher.className = 'nr-seg-control';
    switcher.setAttribute('role', 'tablist');

    for (const metric of TREEMAP_METRICS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-seg-btn';
        if (metric.key === activeMetric) btn.classList.add('nr-seg-btn--selected');
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', String(metric.key === activeMetric));
        btn.textContent = metric.label;

        btn.addEventListener('click', () => {
            activeMetric = metric.key;
            switcher.querySelectorAll('.nr-seg-btn').forEach(b => {
                b.classList.remove('nr-seg-btn--selected');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('nr-seg-btn--selected');
            btn.setAttribute('aria-selected', 'true');
            updateTreemap();
        });

        switcher.appendChild(btn);
    }

    controls.appendChild(switcher);
    headerRow.appendChild(controls);
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

    const indicator = document.querySelector('.nr-ad__treemap-filter-indicator') as HTMLElement;
    if (indicator) indicator.style.display = treemapFilterIds ? 'inline-flex' : 'none';

    const metricDef = TREEMAP_METRICS.find(m => m.key === activeMetric)!;
    const colors = metricDef.colors;
    const allWorkloads = listWorkloads();
    const filteredWorkloads = treemapFilterIds
        ? allWorkloads.filter(wl => treemapFilterIds!.has(wl.id))
        : allWorkloads;
    const items = filteredWorkloads
        .map(wl => {
            const base = parseMetricValue(wl[activeMetric]);
            const rep = considerReplication ? Math.max(1, parseInt(wl.replicationLevel) || 1) : 1;
            return { name: wl.name || wl.id, value: base * rep };
        })
        .filter(d => d.value > 0);

    if (items.length === 0) {
        treemapChartEl.style.display = 'none';
        treemapEmptyEl.style.display = '';
        return;
    }

    treemapChartEl.style.display = '';
    treemapEmptyEl.style.display = 'none';

    const width = treemapChartEl.clientWidth;
    const height = treemapChartEl.clientHeight;
    if (width === 0 || height === 0) return;

    const vals = items.map(d => d.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;

    items.sort((a, b) => b.value - a.value);

    const root = hierarchy({ children: items } as any)
        .sum((d: any) => d.value || 0)
        .sort((a: any, b: any) => (b.value || 0) - (a.value || 0));

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
    let items = listWorkloads();
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        items = items.filter(wl =>
            COLUMNS.some(col => (wl[col.key] || '').toLowerCase().includes(q))
        );
    }
    if (sortDir === 'none') return items;
    return items.sort((a, b) => {
        const av = (a[sortKey] || '').toLowerCase();
        const bv = (b[sortKey] || '').toLowerCase();
        const cmp = av.localeCompare(bv, undefined, { numeric: true });
        return sortDir === 'desc' ? -cmp : cmp;
    });
}

function exportWorkloads(): void {
    const workloads = getSorted();
    const rows = workloads.map(wl => ({
        'Name': wl.name,
        'vCPU': wl.vCpuCores,
        'RAM (GB)': wl.ramGB,
        'Storage (GB)': wl.storageCapacityGB,
        'Network (Mbps)': wl.bandwidthMbps,
        'Type': wl.deploymentModel,
        'Environment': wl.environment,
        'OS': wl.operatingSystem,
        'Application': wl.applicationServer,
        'Database': wl.database,
        'Replication': wl.replicationLevel,
        'Criticality': wl.criticality,
        'SLA Class': wl.slaClass,
        'Storage Type': wl.storageType,
        'Location': wl.location,
        'Owner': wl.owner,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Workloads');
    XLSX.writeFile(wb, 'workloads.xlsx');
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
    // Search
    const searchWrap = document.createElement('div');
    searchWrap.className = 'nr-dt__search-wrap' + (searchOpen ? ' nr-dt__search-wrap--open' : '');

    const searchBtn = document.createElement('button');
    searchBtn.type = 'button';
    searchBtn.className = 'nr-dt__toolbar-icon-btn';
    searchBtn.title = 'Search';
    searchBtn.innerHTML = ICON_SEARCH;
    searchBtn.addEventListener('click', () => {
        searchOpen = !searchOpen;
        searchWrap.classList.toggle('nr-dt__search-wrap--open', searchOpen);
        if (searchOpen) {
            searchInput.focus();
        } else {
            searchQuery = '';
            searchInput.value = '';
            renderTableRows();
        }
    });
    searchWrap.appendChild(searchBtn);

    const searchInput = document.createElement('input');
    searchInput.autocomplete = 'off';
    searchInput.className = 'nr-dt__search-input';
    searchInput.placeholder = 'Filter table';
    searchInput.type = 'search';
    searchInput.value = searchQuery;
    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value;
        renderTableRows();
    });
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSearch();
        }
    });
    searchInput.addEventListener('blur', () => {
        if (searchOpen && !searchQuery) {
            closeSearch();
        }
    });

    function closeSearch() {
        searchOpen = false;
        searchQuery = '';
        searchInput.value = '';
        searchWrap.classList.remove('nr-dt__search-wrap--open');
        renderTableRows();
    }

    searchWrap.appendChild(searchInput);

    toolbarActions.appendChild(searchWrap);

    // Export
    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'nr-dt__toolbar-icon-btn';
    exportBtn.title = 'Export Excel';
    exportBtn.innerHTML = ICON_DOWNLOAD;
    exportBtn.addEventListener('click', exportWorkloads);
    toolbarActions.appendChild(exportBtn);

    // Import
    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.className = 'nr-dt__toolbar-icon-btn';
    importBtn.title = 'Import Excel';
    importBtn.innerHTML = ICON_UPLOAD;
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

    const batchFilterBtn = document.createElement('button');
    batchFilterBtn.type = 'button';
    batchFilterBtn.className = 'nr-dt__batch-btn';
    batchFilterBtn.innerHTML = treemapFilterIds
        ? `Clear Filter<span class="nr-dt__batch-btn-icon">${ICON_FILTER_RM}</span>`
        : `Filter Treemap<span class="nr-dt__batch-btn-icon">${ICON_FILTER}</span>`;
    batchFilterBtn.addEventListener('click', () => {
        if (treemapFilterIds) {
            treemapFilterIds = null;
        } else {
            treemapFilterIds = new Set(selectedIds);
        }
        batchFilterBtn.innerHTML = treemapFilterIds
            ? `Clear Filter<span class="nr-dt__batch-btn-icon">${ICON_FILTER_RM}</span>`
            : `Filter Treemap<span class="nr-dt__batch-btn-icon">${ICON_FILTER}</span>`;
        updateTreemap();
    });
    batchActions.appendChild(batchFilterBtn);

    const batchCancelBtn = document.createElement('button');
    batchCancelBtn.type = 'button';
    batchCancelBtn.className = 'nr-dt__batch-btn nr-dt__batch-btn--cancel';
    batchCancelBtn.textContent = 'Cancel';
    batchCancelBtn.addEventListener('click', () => {
        selectedIds.clear();
        treemapFilterIds = null;
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
        const rep = Math.max(1, parseInt(wl.replicationLevel) || 1);
        const expandable = rep > 1;
        const expanded = expandedIds.has(wl.id);

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
        for (let ci = 0; ci < COLUMNS.length; ci++) {
            const col = COLUMNS[ci];
            const td = document.createElement('td');
            td.className = 'nr-dt__cell';

            if (ci === 0 && expandable) {
                const expandBtn = document.createElement('button');
                expandBtn.type = 'button';
                expandBtn.className = 'nr-ad__expand-btn' + (expanded ? ' nr-ad__expand-btn--open' : '');
                expandBtn.innerHTML = ICON_CHEVRON;
                expandBtn.addEventListener('click', () => {
                    if (expandedIds.has(wl.id)) expandedIds.delete(wl.id);
                    else expandedIds.add(wl.id);
                    renderTableRows();
                });
                td.appendChild(expandBtn);

                const nameSpan = document.createElement('span');
                nameSpan.className = 'nr-ad__name-link';
                nameSpan.textContent = wl[col.key] || '—';
                nameSpan.addEventListener('click', () => openPanel(wl.id));
                td.appendChild(nameSpan);

                const repBadge = document.createElement('span');
                repBadge.className = 'nr-ad__rep-badge';
                repBadge.textContent = `\u00d7${rep}`;
                td.appendChild(repBadge);
            } else {
                td.textContent = wl[col.key] || '—';
                td.style.cursor = 'pointer';
                td.addEventListener('click', () => openPanel(wl.id));
            }
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

        // Instance sub-rows
        if (expandable && expanded) {
            const instances = getInstancesForWorkload(wl.id);
            for (const inst of instances) {
                const itr = document.createElement('tr');
                itr.className = 'nr-dt__row nr-ad__instance-row';

                // Empty checkbox cell
                const emptyTd = document.createElement('td');
                emptyTd.className = 'nr-dt__cell';
                itr.appendChild(emptyTd);

                // Instance name + status
                const nameTd = document.createElement('td');
                nameTd.className = 'nr-dt__cell nr-ad__instance-name-cell';

                const dot = document.createElement('span');
                dot.className = `nr-ad__status-dot nr-ad__status-dot--${inst.role}`;
                nameTd.appendChild(dot);

                const statusBtn = document.createElement('button');
                statusBtn.type = 'button';
                statusBtn.className = `nr-ad__status-label nr-ad__status-label--${inst.role}`;
                statusBtn.textContent = inst.role === 'active' ? 'Active' : 'Standby';
                statusBtn.title = 'Click to toggle status';
                statusBtn.addEventListener('click', () => {
                    const next: InstanceRole = inst.role === 'active' ? 'standby' : 'active';
                    setInstanceStatus(inst.id, next);
                    renderTableRows();
                });
                nameTd.appendChild(statusBtn);

                const instName = document.createElement('span');
                instName.className = 'nr-ad__instance-label';
                instName.textContent = `${inst.workloadName} #${inst.instanceIndex}`;
                nameTd.appendChild(instName);

                itr.appendChild(nameTd);

                // vCPU
                const cpuTd = document.createElement('td');
                cpuTd.className = 'nr-dt__cell nr-ad__instance-cell';
                cpuTd.textContent = inst.vCpu > 0 ? String(inst.vCpu) : '—';
                itr.appendChild(cpuTd);

                // RAM
                const ramTd = document.createElement('td');
                ramTd.className = 'nr-dt__cell nr-ad__instance-cell';
                ramTd.textContent = inst.ramGB > 0 ? String(inst.ramGB) : '—';
                itr.appendChild(ramTd);

                // Storage
                const storageTd = document.createElement('td');
                storageTd.className = 'nr-dt__cell nr-ad__instance-cell';
                storageTd.textContent = inst.storageGB > 0 ? String(inst.storageGB) : '—';
                itr.appendChild(storageTd);

                // Network (same as parent)
                const netTd = document.createElement('td');
                netTd.className = 'nr-dt__cell nr-ad__instance-cell';
                netTd.textContent = '—';
                itr.appendChild(netTd);

                // Empty actions cell
                const actTd = document.createElement('td');
                actTd.className = 'nr-dt__cell';
                itr.appendChild(actTd);

                tbody.appendChild(itr);
            }
        }
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
