import { dia } from '@joint/core';
import { ShapeRegistry } from './shapes/shape-registry';
import { getDataType } from './schema-registry';
import { META_KEY } from './inspector';
import { getProduct, getProductsByType } from './product-catalog';
import { listWorkloads } from './app-store';
import { toCSV, downloadCSV, CsvColumn } from './csv-utils';
import { carbonIconToString, CarbonIcon } from './icons';
import Download16 from '@carbon/icons/es/download/16.js';
import Search16 from '@carbon/icons/es/search/16.js';
import * as XLSX from 'xlsx';

const ICON_DOWNLOAD = carbonIconToString(Download16 as CarbonIcon);
const ICON_SEARCH = carbonIconToString(Search16 as CarbonIcon);

let etSearchOpen = false;
let etSearchTerm = '';

interface ElementRow {
    cellId: string;
    name: string;
    shapeType: string;
    componentType: string;
    zone: string;
    values: Record<string, unknown>;
}

let modalEl: HTMLDivElement | null = null;
let selectedType = '';
let graphRef: dia.Graph | null = null;

function getElementRows(graph: dia.Graph): ElementRow[] {
    const rows: ElementRow[] = [];
    for (const el of graph.getElements()) {
        if (el.get('isFrame') || el.get('componentRole') === 'child') continue;
        const meta: Record<string, unknown> = el.get(META_KEY) ?? {};
        const shapeKey = (meta.shapeType as string) || '';
        const def = ShapeRegistry[shapeKey];
        const ct = def?.componentType || (meta.componentType as string) || '';
        if (!ct) continue;
        const parent = el.getParentCell();
        const zone = parent?.get('isFrame') ? (parent.attr('label/text') as string || 'Zone') : '';
        rows.push({
            cellId: String(el.id),
            name: (meta.name as string) || def?.displayName || shapeKey || '',
            shapeType: shapeKey,
            componentType: ct,
            zone,
            values: { ...meta },
        });
    }
    return rows;
}

function getComponentTypes(rows: ElementRow[]): Array<{ type: string; count: number }> {
    const map = new Map<string, number>();
    for (const r of rows) {
        map.set(r.componentType, (map.get(r.componentType) ?? 0) + 1);
    }
    return Array.from(map.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => a.type.localeCompare(b.type));
}

interface UnifiedRow {
    id: string;
    category: 'element' | 'workload';
    name: string;
    type: string;
    zone: string;
    vCpu: string;
    ram: string;
    storage: string;
    network: string;
    product: string;
    cellId?: string;
}

function getUnifiedRows(graph: dia.Graph): UnifiedRow[] {
    const rows: UnifiedRow[] = [];

    for (const el of graph.getElements()) {
        if (el.get('isFrame') || el.get('componentRole') === 'child') continue;
        const meta: Record<string, unknown> = el.get(META_KEY) ?? {};
        const shapeKey = (meta.shapeType as string) || '';
        const def = ShapeRegistry[shapeKey];
        const ct = def?.componentType || (meta.componentType as string) || '';
        if (!ct) continue;
        const parent = el.getParentCell();
        const zone = parent?.get('isFrame') ? (parent.attr('label/text') as string || 'Zone') : '';
        const productId = meta.productId as string | undefined;
        const product = productId ? getProduct(productId) : null;
        const pv = product?.values ?? {};
        rows.push({
            id: String(el.id),
            category: 'element',
            name: (meta.name as string) || def?.displayName || shapeKey || '',
            type: ct,
            zone,
            vCpu: String(meta.coreCount ?? pv.coreCount ?? ''),
            ram: String(meta.ram ?? pv.ram ?? ''),
            storage: String(meta.storageGB ?? pv.storageGB ?? ''),
            network: String(meta.bandwidthMbps ?? pv.bandwidthMbps ?? ''),
            product: product ? String(product.values.name || product.id) : '',
            cellId: String(el.id),
        });
    }

    for (const el of graph.getElements()) {
        if (!el.get('isArea') && !el.get('isGridLabel')) continue;
        const kind = el.get('isArea') ? 'Area' : 'Label';
        const name = (el.attr('label/text') as string) || kind;
        const parent = el.getParentCell();
        const zone = parent?.get('isFrame') ? (parent.attr('label/text') as string || 'Zone') : '';
        rows.push({
            id: String(el.id),
            category: 'element',
            name,
            type: kind,
            zone,
            vCpu: '',
            ram: '',
            storage: '',
            network: '',
            product: '',
            cellId: String(el.id),
        });
    }

    for (const wl of listWorkloads()) {
        rows.push({
            id: wl.id,
            category: 'workload',
            name: wl.name || wl.id,
            type: wl.deploymentModel || 'Workload',
            zone: '',
            vCpu: wl.vCpuCores,
            ram: wl.ramGB,
            storage: wl.storageCapacityGB,
            network: wl.bandwidthMbps,
            product: '',
        });
    }

    return rows;
}

function render(): void {
    if (!modalEl || !graphRef) return;
    const content = modalEl.querySelector('.nr-et__body') as HTMLElement;
    if (!content) return;
    content.innerHTML = '';

    const allRows = getUnifiedRows(graphRef);
    const columns: Array<{ key: keyof UnifiedRow; label: string }> = [
        { key: 'name', label: 'Name' },
        { key: 'category', label: 'Category' },
        { key: 'type', label: 'Type' },
        { key: 'zone', label: 'Zone' },
        { key: 'product', label: 'Product' },
        { key: 'vCpu', label: 'vCPU' },
        { key: 'ram', label: 'RAM' },
        { key: 'storage', label: 'Storage' },
        { key: 'network', label: 'Network' },
    ];

    const term = etSearchTerm.toLowerCase();
    const displayRows = term
        ? allRows.filter(r => columns.some(c => (r[c.key] || '').toLowerCase().includes(term)))
        : allRows;

    const modalSubtitle = modalEl!.querySelector('.nr-et__subtitle') as HTMLElement | null;
    if (modalSubtitle) {
        modalSubtitle.textContent = `${displayRows.length} item${displayRows.length !== 1 ? 's' : ''}${term ? ` (filtered from ${allRows.length})` : ''}`;
    }

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'nr-dt__toolbar';

    const toolbarActions = document.createElement('div');
    toolbarActions.className = 'nr-dt__toolbar-actions';

    // Search
    const searchWrap = document.createElement('div');
    searchWrap.className = 'nr-dt__search-wrap' + (etSearchOpen ? ' nr-dt__search-wrap--open' : '');

    const searchBtn = document.createElement('button');
    searchBtn.type = 'button';
    searchBtn.className = 'nr-dt__toolbar-icon-btn';
    searchBtn.title = 'Search';
    searchBtn.innerHTML = ICON_SEARCH;
    searchBtn.addEventListener('click', () => {
        etSearchOpen = !etSearchOpen;
        searchWrap.classList.toggle('nr-dt__search-wrap--open', etSearchOpen);
        if (etSearchOpen) {
            searchInput.focus();
        } else {
            etSearchTerm = '';
            searchInput.value = '';
            render();
        }
    });
    searchWrap.appendChild(searchBtn);

    const searchInput = document.createElement('input');
    searchInput.autocomplete = 'off';
    searchInput.className = 'nr-dt__search-input';
    searchInput.placeholder = 'Filter table';
    searchInput.type = 'search';
    searchInput.value = etSearchTerm;
    searchInput.addEventListener('input', () => {
        etSearchTerm = searchInput.value;
        render();
    });
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && etSearchTerm) {
            e.stopPropagation();
            etSearchOpen = false;
            etSearchTerm = '';
            searchInput.value = '';
            searchWrap.classList.remove('nr-dt__search-wrap--open');
            render();
        }
    });
    searchInput.addEventListener('blur', () => {
        if (etSearchOpen && !etSearchTerm) {
            etSearchOpen = false;
            searchWrap.classList.remove('nr-dt__search-wrap--open');
        }
    });
    searchWrap.appendChild(searchInput);
    toolbarActions.appendChild(searchWrap);

    // Export
    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'nr-dt__toolbar-icon-btn';
    exportBtn.title = 'Export XLSX';
    exportBtn.innerHTML = ICON_DOWNLOAD;
    exportBtn.addEventListener('click', () => {
        exportXlsx(displayRows, columns);
    });
    toolbarActions.appendChild(exportBtn);

    // Batch bar
    const batchBar = document.createElement('div');
    batchBar.className = 'nr-dt__batch';
    const batchCount = document.createElement('span');
    batchCount.className = 'nr-dt__batch-count';
    batchBar.appendChild(batchCount);
    const batchActions = document.createElement('div');
    batchActions.className = 'nr-dt__batch-actions';
    const batchExportBtn = document.createElement('button');
    batchExportBtn.type = 'button';
    batchExportBtn.className = 'nr-dt__batch-btn';
    batchExportBtn.innerHTML = `Export XLSX<span class="nr-dt__batch-btn-icon">${ICON_DOWNLOAD}</span>`;
    batchExportBtn.addEventListener('click', () => {
        const sel = displayRows.filter(r => selected.has(r.id));
        exportXlsx(sel, columns);
    });
    batchActions.appendChild(batchExportBtn);
    const batchCancel = document.createElement('button');
    batchCancel.type = 'button';
    batchCancel.className = 'nr-dt__batch-btn nr-dt__batch-btn--cancel';
    batchCancel.textContent = 'Cancel';
    batchCancel.addEventListener('click', () => { selected.clear(); syncSel(); });
    batchActions.appendChild(batchCancel);
    batchBar.appendChild(batchActions);
    toolbar.appendChild(batchBar);

    toolbar.appendChild(toolbarActions);
    content.appendChild(toolbar);

    const selected = new Set<string>();

    // Table
    const tableWrap = document.createElement('div');
    tableWrap.className = 'nr-dt';
    tableWrap.style.flex = '1';
    tableWrap.style.overflow = 'auto';
    const table = document.createElement('table');
    table.className = 'nr-dt__table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');

    const thCb = document.createElement('th');
    thCb.className = 'nr-dt__th nr-dt__th--checkbox';
    const selectAllWrap = document.createElement('div');
    selectAllWrap.className = 'nr-dt__checkbox-wrap';
    const selectAllCb = document.createElement('input');
    selectAllCb.type = 'checkbox';
    selectAllCb.setAttribute('aria-label', 'Select all');
    selectAllCb.addEventListener('change', () => {
        selected.clear();
        if (selectAllCb.checked) displayRows.forEach(r => selected.add(r.id));
        syncSel();
    });
    selectAllWrap.appendChild(selectAllCb);
    thCb.appendChild(selectAllWrap);
    headRow.appendChild(thCb);

    for (const col of columns) {
        const th = document.createElement('th');
        th.className = 'nr-dt__th';
        th.textContent = col.label;
        headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    if (displayRows.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = columns.length + 1;
        td.className = 'nr-dt__empty';
        td.textContent = term ? 'No matching items.' : 'No elements or workloads defined.';
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        for (const row of displayRows) {
            const tr = document.createElement('tr');
            tr.className = 'nr-dt__row';

            const tdCb = document.createElement('td');
            tdCb.className = 'nr-dt__cell nr-dt__cell--checkbox';
            const cbWrap = document.createElement('div');
            cbWrap.className = 'nr-dt__checkbox-wrap';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = selected.has(row.id);
            cb.setAttribute('aria-label', `Select ${row.name}`);
            cb.addEventListener('change', () => {
                if (cb.checked) selected.add(row.id); else selected.delete(row.id);
                syncSel();
            });
            cbWrap.appendChild(cb);
            tdCb.appendChild(cbWrap);
            tr.appendChild(tdCb);

            for (const col of columns) {
                const td = document.createElement('td');
                td.className = 'nr-dt__cell';
                td.style.whiteSpace = 'nowrap';
                const val = row[col.key];
                if (col.key === 'category') {
                    const tag = document.createElement('span');
                    tag.className = `cds--tag cds--tag--sm cds--tag--${row.category === 'element' ? 'teal' : 'purple'}`;
                    tag.textContent = row.category === 'element' ? 'Element' : 'Workload';
                    td.appendChild(tag);
                } else {
                    td.textContent = val || '\u2014';
                }
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
    }
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    content.appendChild(tableWrap);

    function syncSel() {
        const count = selected.size;
        batchBar.classList.toggle('nr-dt__batch--active', count > 0);
        toolbar.classList.toggle('nr-dt__toolbar--batch-active', count > 0);
        batchCount.textContent = `${count} item${count !== 1 ? 's' : ''} selected`;
        selectAllCb.checked = count === displayRows.length && displayRows.length > 0;
        selectAllCb.indeterminate = count > 0 && count < displayRows.length;
        tbody.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb, i) => {
            if (i < displayRows.length) cb.checked = selected.has(displayRows[i].id);
        });
    }
}

export function showElementTable(graph: dia.Graph): void {
    if (modalEl) { modalEl.remove(); modalEl = null; }
    graphRef = graph;
    selectedType = '';

    modalEl = document.createElement('div');
    modalEl.className = 'nr-et__overlay';
    modalEl.addEventListener('mousedown', (e) => { if (e.target === modalEl) hideElementTable(); });

    const dialog = document.createElement('div');
    dialog.className = 'nr-et__dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-label', 'Element Table');

    const headerBar = document.createElement('div');
    headerBar.className = 'nr-et__header';
    const titleWrap = document.createElement('div');
    const title = document.createElement('h2');
    title.className = 'nr-et__title';
    title.textContent = 'Elements in Grid';
    titleWrap.appendChild(title);
    const subtitle = document.createElement('p');
    subtitle.className = 'nr-et__subtitle';
    titleWrap.appendChild(subtitle);
    headerBar.appendChild(titleWrap);
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'nr-et__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" width="16" height="16"><path d="M24 9.4L22.6 8 16 14.6 9.4 8 8 9.4 14.6 16 8 22.6 9.4 24 16 17.4 22.6 24 24 22.6 17.4 16 24 9.4z"/></svg>';
    closeBtn.addEventListener('click', hideElementTable);
    headerBar.appendChild(closeBtn);
    dialog.appendChild(headerBar);

    const body = document.createElement('div');
    body.className = 'nr-et__body';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.overflow = 'hidden';
    dialog.appendChild(body);

    modalEl.appendChild(dialog);
    document.body.appendChild(modalEl);
    document.body.style.overflow = 'hidden';
    render();
    document.addEventListener('keydown', onEsc);
}

export function hideElementTable(): void {
    if (modalEl) { modalEl.remove(); modalEl = null; }
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onEsc);
    etSearchOpen = false;
    etSearchTerm = '';
}

function onEsc(e: KeyboardEvent): void {
    if (e.key === 'Escape') hideElementTable();
}

// ── CSV Export / Import ──────────────────────────────────────────────────────

function getElementColumns(componentType: string): CsvColumn[] {
    const typeId = componentType.toLowerCase().replace(/\s+/g, '-');
    const typeDef = getDataType(typeId);
    const cols: CsvColumn[] = [
        { key: 'cellId', label: 'Cell ID' },
        { key: 'name', label: 'Name' },
        { key: 'productId', label: 'Product ID' },
        { key: 'zone', label: 'Zone' },
    ];
    if (typeDef) {
        for (const f of typeDef.fields) {
            if (f.key === 'id' || f.key === 'name') continue;
            cols.push({ key: f.key, label: f.label });
        }
    }
    return cols;
}

function exportElementCSV(componentType: string, allRows: ElementRow[], rows: ElementRow[]): void {
    const columns = getElementColumns(componentType);
    const csvRows = rows.map(row => {
        const out: Record<string, unknown> = {
            cellId: row.cellId,
            name: row.name,
            productId: row.values.productId ?? '',
            zone: row.zone,
        };
        for (const col of columns) {
            if (out[col.key] != null) continue;
            const productId = row.values.productId as string | undefined;
            let val = row.values[col.key];
            if (productId) {
                const product = getProduct(productId);
                if (product?.values[col.key] != null) val = product.values[col.key];
            }
            out[col.key] = val ?? '';
        }
        return out;
    });
    const csv = toCSV(columns, csvRows);
    const safeName = componentType.toLowerCase().replace(/\s+/g, '-');
    downloadCSV(csv, `${safeName}-elements.csv`);
}

function exportXlsx(rows: UnifiedRow[], columns: Array<{ key: keyof UnifiedRow; label: string }>): void {
    const data = rows.map(r => {
        const obj: Record<string, string> = {};
        for (const c of columns) obj[c.label] = r[c.key] || '';
        return obj;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Elements');
    XLSX.writeFile(wb, 'elements-workloads.xlsx');
}

