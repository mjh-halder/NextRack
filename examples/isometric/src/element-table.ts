import { dia } from '@joint/core';
import { ShapeRegistry } from './shapes/shape-registry';
import { getDataType } from './schema-registry';
import { META_KEY } from './inspector';
import { getProduct, getProductsByType } from './product-catalog';
import { toCSV, downloadCSV, CsvColumn } from './csv-utils';
import { carbonIconToString, CarbonIcon } from './icons';
import Download16 from '@carbon/icons/es/download/16.js';

const ICON_DOWNLOAD = carbonIconToString(Download16 as CarbonIcon);

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

function render(): void {
    if (!modalEl || !graphRef) return;
    const content = modalEl.querySelector('.nr-et__body') as HTMLElement;
    if (!content) return;
    content.innerHTML = '';

    const allRows = getElementRows(graphRef);
    const types = getComponentTypes(allRows);
    if (!selectedType && types.length > 0) selectedType = types[0].type;

    // Left panel
    const left = document.createElement('div');
    left.className = 'nr-dm__left';

    const leftHeader = document.createElement('div');
    leftHeader.className = 'nr-dm__left-header';
    const leftTitle = document.createElement('h2');
    leftTitle.className = 'nr-dm__left-title';
    leftTitle.textContent = 'Component Types';
    leftHeader.appendChild(leftTitle);
    left.appendChild(leftHeader);

    const typeList = document.createElement('div');
    typeList.className = 'nr-dm__type-list';
    typeList.setAttribute('role', 'listbox');
    for (const t of types) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'nr-dm__type-item' + (t.type === selectedType ? ' nr-dm__type-item--selected' : '');
        item.setAttribute('role', 'option');
        if (t.type === selectedType) item.setAttribute('aria-selected', 'true');
        item.addEventListener('click', () => { selectedType = t.type; render(); });
        const label = document.createElement('span');
        label.className = 'nr-dm__type-label';
        label.textContent = t.type;
        item.appendChild(label);
        const count = document.createElement('span');
        count.className = 'nr-dm__type-count';
        count.textContent = String(t.count);
        item.appendChild(count);
        typeList.appendChild(item);
    }
    left.appendChild(typeList);
    content.appendChild(left);

    // Right panel
    const right = document.createElement('div');
    right.className = 'nr-dm__right';
    const filtered = allRows.filter(r => r.componentType === selectedType);
    const selected = new Set<string>();

    // Columns
    const typeId = selectedType.toLowerCase().replace(/\s+/g, '-');
    const typeDef = getDataType(typeId);
    const columns: Array<{ key: string; label: string }> = [
        { key: 'name', label: 'Name' },
        { key: '_product', label: 'Product' },
        { key: 'zone', label: 'Zone' },
    ];
    if (typeDef) {
        for (const f of typeDef.fields) {
            if (f.key === 'id' || f.key === 'name') continue;
            columns.push({ key: f.key, label: f.label });
        }
    }

    // Header
    const header = document.createElement('div');
    header.className = 'nr-dt__header';
    const hTitle = document.createElement('h3');
    hTitle.className = 'nr-dt__header-title';
    hTitle.textContent = selectedType;
    header.appendChild(hTitle);
    const hDesc = document.createElement('p');
    hDesc.className = 'nr-dt__header-desc';
    hDesc.textContent = `${filtered.length} element${filtered.length !== 1 ? 's' : ''} on canvas`;
    header.appendChild(hDesc);
    right.appendChild(header);

    // Toolbar with batch bar
    const toolbar = document.createElement('div');
    toolbar.className = 'nr-dt__toolbar';
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
    batchExportBtn.innerHTML = `Export CSV<span class="nr-dt__batch-btn-icon">${ICON_DOWNLOAD}</span>`;
    batchExportBtn.addEventListener('click', () => {
        exportElementCSV(selectedType, allRows, filtered.filter(r => selected.has(r.cellId)));
    });
    batchActions.appendChild(batchExportBtn);

    const batchCancel = document.createElement('button');
    batchCancel.type = 'button';
    batchCancel.className = 'nr-dt__batch-btn nr-dt__batch-btn--cancel';
    batchCancel.textContent = 'Cancel';
    batchCancel.addEventListener('click', () => { selected.clear(); syncSelection(); });
    batchActions.appendChild(batchCancel);
    batchBar.appendChild(batchActions);
    toolbar.appendChild(batchBar);

    right.appendChild(toolbar);

    // Table
    const tableWrap = document.createElement('div');
    tableWrap.className = 'nr-dt';
    const table = document.createElement('table');
    table.className = 'nr-dt__table';

    // Thead
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
        if (selectAllCb.checked) filtered.forEach(r => selected.add(r.cellId));
        syncSelection();
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

    // Tbody
    const tbody = document.createElement('tbody');
    if (filtered.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = columns.length + 1;
        td.className = 'nr-dt__empty';
        td.textContent = 'No elements of this type on the canvas.';
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        for (const row of filtered) {
            const tr = document.createElement('tr');
            tr.className = 'nr-dt__row';

            const tdCb = document.createElement('td');
            tdCb.className = 'nr-dt__cell nr-dt__cell--checkbox';
            const cbWrap = document.createElement('div');
            cbWrap.className = 'nr-dt__checkbox-wrap';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = selected.has(row.cellId);
            cb.dataset.cellId = row.cellId;
            cb.setAttribute('aria-label', `Select ${row.name}`);
            cb.addEventListener('change', () => {
                if (cb.checked) selected.add(row.cellId); else selected.delete(row.cellId);
                selectAllCb.checked = selected.size === filtered.length;
                selectAllCb.indeterminate = selected.size > 0 && selected.size < filtered.length;
                syncSelection();
            });
            cbWrap.appendChild(cb);
            tdCb.appendChild(cbWrap);
            tr.appendChild(tdCb);

            for (const col of columns) {
                const td = document.createElement('td');
                td.className = 'nr-dt__cell';
                td.style.whiteSpace = 'nowrap';

                if (col.key === 'name') {
                    td.textContent = row.name;
                } else if (col.key === '_product') {
                    const products = getProductsByType(row.componentType);
                    const currentProductId = row.values.productId as string | undefined;
                    const sel = document.createElement('select');
                    sel.className = 'nr-dt__inline-select';
                    const noneOpt = document.createElement('option');
                    noneOpt.value = '';
                    noneOpt.textContent = '— none —';
                    if (!currentProductId) noneOpt.selected = true;
                    sel.appendChild(noneOpt);
                    for (const p of products) {
                        const opt = document.createElement('option');
                        opt.value = p.id;
                        opt.textContent = String(p.values.name || p.id);
                        if (p.id === currentProductId) opt.selected = true;
                        sel.appendChild(opt);
                    }
                    sel.addEventListener('change', () => {
                        if (!graphRef) return;
                        const cell = graphRef.getCell(row.cellId);
                        if (!cell) return;
                        const meta = cell.get(META_KEY) ?? {};
                        meta.productId = sel.value || undefined;
                        cell.set(META_KEY, { ...meta });
                        render();
                    });
                    td.appendChild(sel);
                } else if (col.key === 'zone') {
                    td.textContent = row.zone;
                } else {
                    const productId = row.values.productId as string | undefined;
                    let val = row.values[col.key];
                    if (productId) {
                        const product = getProduct(productId);
                        if (product?.values[col.key] != null) val = product.values[col.key];
                    }
                    td.textContent = val != null ? String(val) : '';
                }
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
    }
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    right.appendChild(tableWrap);
    content.appendChild(right);

    function syncSelection() {
        batchBar.classList.toggle('nr-dt__batch--active', selected.size > 0);
        batchCount.textContent = `${selected.size} selected`;
        selectAllCb.checked = selected.size === filtered.length && filtered.length > 0;
        selectAllCb.indeterminate = selected.size > 0 && selected.size < filtered.length;
        tbody.querySelectorAll<HTMLInputElement>('.nr-dt__checkbox-wrap input[data-cell-id]').forEach(cb => {
            cb.checked = selected.has(cb.dataset.cellId ?? '');
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
    const title = document.createElement('h2');
    title.className = 'nr-et__title';
    title.textContent = 'Canvas Elements';
    headerBar.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'nr-et__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" width="16" height="16"><path d="M24 9.4L22.6 8 16 14.6 9.4 8 8 9.4 14.6 16 8 22.6 9.4 24 16 17.4 22.6 24 24 22.6 17.4 16 24 9.4z"/></svg>';
    closeBtn.addEventListener('click', hideElementTable);
    headerBar.appendChild(closeBtn);
    dialog.appendChild(headerBar);

    const body = document.createElement('div');
    body.className = 'nr-et__body nr-dm__body';
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

